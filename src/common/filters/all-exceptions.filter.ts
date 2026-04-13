import { Response } from 'express';
import { QueryFailedError, EntityNotFoundError } from 'typeorm';
import { Catch, Logger, HttpStatus, ArgumentsHost, HttpException, ExceptionFilter } from '@nestjs/common';

/**
 * Extracts a human-readable detail from a PostgreSQL constraint error.
 * e.g. 'Key (rif)=(J-12345678-9) already exists.' → 'rif: J-12345678-9 ya existe'
 */
function parseConstraintDetail(detail: string): string {
  const match = detail.match(/Key \((.+?)\)=\((.+?)\)/);
  if (match) {
    return `${match[1]}: "${match[2]}" ya existe`;
  }
  return detail;
}

function parseForeignKeyDetail(detail: string): string {
  const match = detail.match(/Key \((.+?)\)=\((.+?)\) is not present in table "(.+?)"/);
  if (match) {
    return `${match[1]}: "${match[2]}" no existe en ${match[3]}`;
  }
  return detail;
}

interface ErrorResponseBody {
  statusCode: number;
  message: string;
  errors?: Record<string, string | string[]> | string;
  timestamp: string;
  path: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const body: ErrorResponseBody = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error interno del servidor',
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // ─── NestJS HTTP exceptions (NotFoundException, BadRequestException, etc.) ──
    if (exception instanceof HttpException) {
      body.statusCode = exception.getStatus();
      const exResponse = exception.getResponse();

      if (typeof exResponse === 'string') {
        body.message = exResponse;
      } else if (typeof exResponse === 'object' && exResponse !== null) {
        const obj = exResponse as Record<string, unknown>;
        body.message = (obj.message as string) || exception.message;
        if (obj.errors) {
          body.errors = obj.errors as Record<string, string | string[]>;
        }
      }

      // ─── TypeORM: unique constraint violation (23505) ──────────────────
    } else if (exception instanceof QueryFailedError) {
      const driverError = (exception as any).driverError;
      const pgCode: string = driverError?.code || '';

      switch (pgCode) {
        case '23505': {
          // unique_violation
          body.statusCode = HttpStatus.CONFLICT;
          body.message = 'Registro duplicado';
          if (driverError.detail) {
            body.errors = { constraint: parseConstraintDetail(driverError.detail) };
          }
          break;
        }
        case '23503': {
          // foreign_key_violation
          body.statusCode = HttpStatus.BAD_REQUEST;
          body.message = 'Referencia inválida (llave foránea)';
          if (driverError.detail) {
            body.errors = { constraint: parseForeignKeyDetail(driverError.detail) };
          }
          break;
        }
        case '23502': {
          // not_null_violation
          body.statusCode = HttpStatus.BAD_REQUEST;
          body.message = 'Campo requerido faltante';
          body.errors = { column: driverError.column || 'desconocido' };
          break;
        }
        case '22P02': {
          // invalid_text_representation (e.g. invalid UUID)
          body.statusCode = HttpStatus.BAD_REQUEST;
          body.message = 'Formato de dato inválido';
          body.errors = { detail: driverError.message || 'UUID u otro campo con formato incorrecto' };
          break;
        }
        default: {
          body.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
          body.message = 'Error de base de datos';
          this.logger.error(`DB error [${pgCode}]: ${driverError?.message}`, (exception as Error).stack);
        }
      }

      // ─── TypeORM: entity not found ─────────────────────────────────────
    } else if (exception instanceof EntityNotFoundError) {
      body.statusCode = HttpStatus.NOT_FOUND;
      body.message = 'Recurso no encontrado';

      // ─── Generic Error ─────────────────────────────────────────────────
    } else if (exception instanceof Error) {
      // Catch plain `throw new Error(...)` from user repos, etc.
      if (exception.message.toLowerCase().includes('not found')) {
        body.statusCode = HttpStatus.NOT_FOUND;
        body.message = exception.message;
      } else {
        this.logger.error(`Unhandled: ${exception.message}`, exception.stack);
      }
    }

    // Log non-trivial server errors
    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }
}
