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

import type { Context, Env, MiddlewareHandler } from 'hono';
import type { input, output, ZodType } from 'zod';
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
 * Valida el body **antes del handler** y lo deja en `c.req.valid('json')`, ya con el tipo que
 * devuelve el schema.
 *
 * Es `parseJsonBody` movido a un middleware, y nada más: misma validación, mismos errores, mismo
 * orden (después de la sesión y del CSRF, antes del servicio). Lo que gana es que Hono ve el schema
 * en el tipo de la ruta, y el cliente RPC de los frontends (`hc<…>`) sabe qué cuerpo acepta
 * cada una: un campo que el servidor ya no espera rompe el `typecheck` de quien lo manda
 * (`REF6-11` / `C-3`). Lo que entra es el tipo de **entrada** del schema; lo que el handler lee,
 * el de **salida** (con las transformaciones aplicadas).
 */
export const bodyValidado =
  <S extends ZodType>(
    schema: S,
  ): MiddlewareHandler<Env, string, { in: { json: input<S> }; out: { json: output<S> } }> =>
  async (c, next) => {
    c.req.addValidatedData('json', (await parseJsonBody(c, schema)) as object);
    await next();
  };

/** Lo mismo para los query params: `c.req.valid('query')`. Ver `bodyValidado`. */
export const consultaValidada =
  <S extends ZodType>(
    schema: S,
  ): MiddlewareHandler<Env, string, { in: { query: input<S> }; out: { query: output<S> } }> =>
  async (c, next) => {
    c.req.addValidatedData('query', parseQuery(c, schema) as object);
    await next();
  };
