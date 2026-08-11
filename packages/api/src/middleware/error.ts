/**
 * Manejo de errores.
 *
 * Forma única de respuesta: `{ error: { code, message, details? } }`.
 * En producción, un error inesperado **nunca** expone el stack ni el mensaje
 * original: se loguea con un `requestId` correlacionable y se responde genérico.
 *
 * Ver `docs/TECHNICAL.md` §7 y `docs/SECURITY.md` §11.
 *
 * Se engancha con `app.onError`, **no** como middleware con `try/catch`: Hono
 * captura los errores del handler dentro de su `compose` y los convierte en
 * respuesta sin propagarlos hacia arriba, así que un `try { await next() }` en
 * un middleware nunca los ve.
 */

import { randomUUID } from 'node:crypto';
import type { Context } from 'hono';
import { env } from '../env.js';
import { AppError } from '../lib/errors.js';

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

function responder(c: Context, error: AppError, requestId?: string): Response {
  const body: ErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
      ...(requestId ? { requestId } : {}),
    },
  };

  for (const [k, v] of Object.entries(error.headers ?? {})) {
    c.header(k, v);
  }

  return c.json(body, error.status);
}

export function handleError(error: Error, c: Context): Response {
  if (error instanceof AppError) {
    return responder(c, error);
  }

  // Inesperado: se loguea completo, se responde sin detalle.
  const requestId = randomUUID();
  console.error(`[${requestId}] ${c.req.method} ${c.req.path}`, error);

  // En desarrollo el mensaje real ayuda a depurar; en producción es información
  // de más y se responde el mensaje genérico del catálogo.
  const interno = env().isProduction
    ? new AppError('INTERNAL')
    : new AppError('INTERNAL', { message: error.message });

  return responder(c, interno, requestId);
}
