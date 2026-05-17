import { Reflector } from '@nestjs/core';
import { of, from, Observable } from 'rxjs';
import { Request, Response } from 'express';
import { tap, switchMap, catchError } from 'rxjs/operators';
import {
  Inject,
  Injectable,
  CallHandler,
  HttpException,
  NestInterceptor,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';

import { IdempotencyService } from './idempotency.service';
import { IDEMPOTENT_METADATA_KEY } from './idempotent.decorator';

const HEADER_NAME = 'idempotency-key';

interface RequestWithUser extends Request {
  user?: { id?: string };
}

/**
 * Interceptor que materializa la idempotencia para handlers marcados con
 * `@Idempotent()`. Se aplica globalmente o por controlador y respeta sólo
 * los handlers que tengan la metadata, evitando overhead en GETs/listas.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(IdempotencyService)
    private readonly idempotency: IdempotencyService,
    @Inject(Reflector)
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler();
    const isIdempotent = this.reflector.get<boolean>(IDEMPOTENT_METADATA_KEY, handler);
    if (!isIdempotent) return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithUser>();
    const res = http.getResponse<Response>();
    const key = (req.headers[HEADER_NAME] as string | undefined)?.trim();
    if (!key) {
      throw new BadRequestException(`Header "${HEADER_NAME}" es obligatorio para este endpoint`);
    }

    const endpoint = `${req.method} ${req.route?.path ?? req.path}`;
    const hash = this.idempotency.hashRequest(req.body);
    const userId = req.user?.id ?? null;

    return from(this.idempotency.reserveOrFetch({ key, endpoint, requestHash: hash, userId })).pipe(
      switchMap((cached) => {
        if (cached) {
          res.status(cached.statusCode);
          return of(cached.body);
        }
        return next.handle().pipe(
          tap({
            next: async (body) => {
              await this.idempotency.store(key, res.statusCode || 200, body);
            },
            error: async (err) => {
              // Si el handler falló, liberamos el lock para permitir reintento.
              // No persistimos el error como respuesta cacheada — sólo 2xx
              // se considera "respuesta válida" para idempotencia.
              await this.idempotency.release(key);
              return err;
            },
          }),
        );
      }),
      catchError((err) => {
        if (err instanceof HttpException) throw err;
        throw err;
      }),
    );
  }
}
