/**
 * Caché de respuestas públicas.
 *
 * La landing es lo único público y lo que más tráfico recibe. `ETag` +
 * `Cache-Control` bajan la carga sin agregar infraestructura.
 *
 * Ver `docs/TECHNICAL.md` §5.
 */

import { createHash } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';

export interface CacheOptions {
  /** Segundos de frescura. */
  readonly maxAge: number;
  /** Segundos durante los que se puede servir contenido viejo mientras se revalida. */
  readonly staleWhileRevalidate?: number;
}

/**
 * Agrega `Cache-Control` y `ETag`, y responde 304 si el cliente ya tiene la
 * versión vigente.
 */
export const publicCache = (options: CacheOptions): MiddlewareHandler => {
  const { maxAge, staleWhileRevalidate = maxAge * 5 } = options;
  const control = `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`;

  return async (c, next) => {
    await next();

    if (c.res.status !== 200) return;

    const cuerpo = await c.res.clone().text();
    const etag = `W/"${createHash('sha256').update(cuerpo).digest('base64url').slice(0, 27)}"`;

    c.header('Cache-Control', control);
    c.header('ETag', etag);

    if (c.req.header('if-none-match') === etag) {
      c.res = new Response(null, { status: 304, headers: c.res.headers });
    }
  };
};
