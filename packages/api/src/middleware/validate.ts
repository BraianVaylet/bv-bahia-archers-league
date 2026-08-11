/**
 * Validación de entrada con Zod.
 *
 * **Todo** input pasa por acá antes de tocar un servicio. Los schemas son
 * `.strict()`, así que una propiedad no declarada se rechaza: es lo que previene
 * el mass assignment y, con tipos primitivos explícitos, la inyección NoSQL
 * (`{ $ne: null }` no es un `string`).
 *
 * Ver `docs/SECURITY.md` §5 y §6.
 */

import type { Context, MiddlewareHandler } from 'hono';
import type { ZodType } from 'zod';
import { AppError, validationError } from '../lib/errors.js';

/** 1 MB. Un batch de sincronización de 200 ops entra con holgura. */
export const MAX_BODY_BYTES = 1_048_576;

function detallesDeZod(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return {
    fields: error.issues.map((i) => ({
      path: i.path.map(String).join('.') || '(raíz)',
      message: i.message,
    })),
  };
}

/** Parsea y valida el body JSON. Lanza `AppError` tipado si algo no cierra. */
export async function parseJsonBody<T>(c: Context, schema: ZodType<T>): Promise<T> {
  const declarado = Number(c.req.header('content-length') ?? 0);
  if (declarado > MAX_BODY_BYTES) {
    throw new AppError('PAYLOAD_TOO_LARGE');
  }

  let crudo: unknown;
  try {
    crudo = await c.req.json();
  } catch {
    throw validationError({ fields: [{ path: '(raíz)', message: 'El body no es JSON válido.' }] });
  }

  const resultado = schema.safeParse(crudo);
  if (!resultado.success) {
    throw validationError(detallesDeZod(resultado.error));
  }

  return resultado.data;
}

/** Valida los query params contra un schema. */
export function parseQuery<T>(c: Context, schema: ZodType<T>): T {
  const resultado = schema.safeParse(c.req.query());
  if (!resultado.success) {
    throw validationError(detallesDeZod(resultado.error));
  }
  return resultado.data;
}

/**
 * Valida el body y lo deja en `c.set('body', ...)`.
 * Útil cuando el handler ya recibe el contexto tipado.
 */
export const validateBody =
  <T>(schema: ZodType<T>): MiddlewareHandler =>
  async (c, next) => {
    c.set('body', await parseJsonBody(c, schema));
    return next();
  };
