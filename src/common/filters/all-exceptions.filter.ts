import { Response } from 'express';
import { QueryFailedError, EntityNotFoundError } from 'typeorm';
import { Catch, Logger, HttpStatus, ArgumentsHost, HttpException, ExceptionFilter } from '@nestjs/common';

/**
 * Mapeo de nombres de tablas técnicas → nombres de recurso amigables al usuario.
 * Solo agregar entradas cuando un FK pueda chocar y burbujee al filtro.
 */
const TABLE_FRIENDLY_NAMES: Record<string, string> = {
  products: 'productos',
  product_active_ingredients: 'productos',
  product_barcodes: 'productos',
  product_substitutes: 'productos',
  active_ingredients: 'principios activos',
  therapeutic_uses: 'acciones terapéuticas',
  brands: 'marcas',
  categories: 'categorías',
  suppliers: 'proveedores',
  branches: 'sucursales',
  inventory_lots: 'lotes de inventario',
  goods_receipts: 'entradas de mercancía',
  goods_receipt_items: 'partidas de mercancía',
  purchase_orders: 'órdenes de compra',
  promotions: 'promociones',
  promotion_scopes: 'alcances de promoción',
  users: 'usuarios',
  roles: 'roles',
  permissions: 'permisos',
};

function friendlyTable(table: string): string {
  return TABLE_FRIENDLY_NAMES[table] ?? table.replace(/_/g, ' ');
}

/**
 * Extrae detalle legible de un error de constraint UNIQUE de PostgreSQL.
 * Ej: 'Key (rif)=(J-12345678-9) already exists.' → 'rif "J-12345678-9" ya existe'
 */
function parseUniqueDetail(detail: string): string {
  const match = detail.match(/Key \((.+?)\)=\((.+?)\)/);
  if (match) {
    return `${match[1]} "${match[2]}" ya existe`;
  }
  return 'Registro duplicado';
}

/**
 * Resuelve un error de FK a un mensaje completo y user-friendly. Cubre los dos
 * casos típicos:
 *   1. INSERT/UPDATE referenciando un padre inexistente
 *      ('is not present in table "x"' / 'no está presente en la tabla «x»')
 *   2. DELETE/UPDATE de un padre todavía referenciado por hijos
 *      ('is still referenced from table "x"' / 'todavía es referida desde la tabla «x»')
 *
 * Postgres localiza estos mensajes según el `lc_messages` del servidor (suele
 * ser español en instalaciones venezolanas), por lo que matcheamos ambos
 * idiomas. Si no calza ningún patrón, devolvemos un mensaje genérico (sin
 * exponer el detalle crudo de PG).
 */
function parseForeignKeyMessage(detail: string): string {
  const stillReferenced =
    detail.match(/is still referenced from table "(.+?)"/) ??
    detail.match(/todavía es referida desde la tabla [«"](.+?)[»"]/);
  if (stillReferenced) {
    const table = friendlyTable(stillReferenced[1]);
    return `No se puede eliminar este registro porque está siendo usado por ${table}. Quítalo primero de los registros que lo referencian.`;
  }

  const notPresent =
    detail.match(/Key \((.+?)\)=\((.+?)\) is not present in table "(.+?)"/) ??
    detail.match(/La llave \((.+?)\)=\((.+?)\) no está presente en la tabla [«"](.+?)[»"]/);
  if (notPresent) {
    const table = friendlyTable(notPresent[3]);
    return `El valor referenciado en ${notPresent[1]} no existe en ${table}.`;
  }

  return 'Operación rechazada: viola una restricción de integridad referencial.';
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
          body.message = driverError.detail ? parseUniqueDetail(driverError.detail) : 'Registro duplicado';
          break;
        }
        case '23503': {
          // foreign_key_violation
          body.statusCode = HttpStatus.CONFLICT;
          body.message = parseForeignKeyMessage(driverError?.detail ?? '');
          // Loggeamos el detalle crudo para diagnóstico, pero NO se lo exponemos
          // al cliente para no filtrar nombres de tablas/columnas internas.
          this.logger.warn(`FK violation: ${driverError?.detail ?? driverError?.message}`);
          break;
        }
        case '23502': {
          // not_null_violation
          body.statusCode = HttpStatus.BAD_REQUEST;
          body.message = `Falta un campo requerido${driverError?.column ? `: ${driverError.column}` : ''}.`;
          break;
        }
        case '22P02': {
          // invalid_text_representation (e.g. invalid UUID)
          body.statusCode = HttpStatus.BAD_REQUEST;
          body.message = 'Uno de los datos enviados tiene un formato inválido.';
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
