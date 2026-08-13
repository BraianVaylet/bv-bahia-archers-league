/**
 * Errores de la API.
 *
 * Todos llevan `code`; nunca se lanzan strings sueltos. El catálogo y su mapeo
 * a HTTP está en `docs/TECHNICAL.md` §7.
 */

import type { ContentfulStatusCode } from 'hono/utils/http-status';

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CSRF_INVALID'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'ARROW_COUNT'
  | 'INVALID_TOKEN'
  | 'INVALID_STATE_TRANSITION'
  | 'TARGET_LOCKED'
  | 'TOURNAMENT_HAS_SCORES'
  | 'ARCHER_IN_USE'
  | 'SIGNATURES_MISSING'
  | 'SIGNATURE_MISMATCH'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'INTERNAL';

const STATUS: Record<ErrorCode, ContentfulStatusCode> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CSRF_INVALID: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  ARROW_COUNT: 400,
  INVALID_TOKEN: 400,
  INVALID_STATE_TRANSITION: 409,
  TARGET_LOCKED: 409,
  TOURNAMENT_HAS_SCORES: 409,
  ARCHER_IN_USE: 409,
  SIGNATURES_MISSING: 409,
  SIGNATURE_MISMATCH: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

/** Mensajes por defecto. Nunca revelan si un usuario o un recurso existe. */
const MENSAJES: Record<ErrorCode, string> = {
  UNAUTHORIZED: 'Necesitás iniciar sesión.',
  FORBIDDEN: 'No tenés permiso para esta acción.',
  CSRF_INVALID: 'La solicitud no pudo validarse. Recargá la página y probá de nuevo.',
  NOT_FOUND: 'No se encontró lo que buscabas.',
  VALIDATION_ERROR: 'Los datos enviados no son válidos.',
  ARROW_COUNT: 'La cantidad de flechas no coincide con la del blanco.',
  INVALID_TOKEN: 'Ese puntaje no es válido para la modalidad de este blanco.',
  INVALID_STATE_TRANSITION: 'El torneo no está en un estado que permita esta acción.',
  TARGET_LOCKED: 'Este blanco ya tiene puntajes cargados y no se puede editar.',
  TOURNAMENT_HAS_SCORES: 'El torneo ya tiene puntajes cargados.',
  ARCHER_IN_USE: 'El arquero participó de un torneo. Archivalo en vez de eliminarlo.',
  SIGNATURES_MISSING: 'Faltan firmas para cerrar el circuito.',
  SIGNATURE_MISMATCH: 'El puntaje cambió después de firmarse.',
  PAYLOAD_TOO_LARGE: 'El contenido enviado es demasiado grande.',
  RATE_LIMITED: 'Demasiados intentos. Esperá un momento.',
  INTERNAL: 'Ocurrió un error inesperado.',
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: ContentfulStatusCode;
  readonly details: Record<string, unknown> | undefined;
  /** Cabeceras extra que la respuesta debe llevar (ej. `Retry-After`). */
  readonly headers: Record<string, string> | undefined;

  constructor(
    code: ErrorCode,
    options: {
      message?: string;
      details?: Record<string, unknown>;
      headers?: Record<string, string>;
    } = {},
  ) {
    super(options.message ?? MENSAJES[code]);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    this.details = options.details;
    this.headers = options.headers;
  }
}

export const unauthorized = () => new AppError('UNAUTHORIZED');
export const forbidden = () => new AppError('FORBIDDEN');
/**
 * Recurso inexistente **o ajeno**: no se distinguen a propósito, para que no se
 * pueda enumerar qué existe probando ids. Ver `docs/SECURITY.md` §4.
 */
export const notFound = () => new AppError('NOT_FOUND');

export const validationError = (details: Record<string, unknown>) =>
  new AppError('VALIDATION_ERROR', { details });

export const invalidState = (message: string) =>
  new AppError('INVALID_STATE_TRANSITION', { message });
