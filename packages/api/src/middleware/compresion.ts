/**
 * Compresión del JSON de la API (`REF6-8` / `P-3`).
 *
 * `hono/compress` ya hace casi todo: elige `gzip` o `deflate` según lo que el
 * cliente acepta, respeta `no-transform`, no toca lo ya codificado ni las
 * respuestas parciales. Pero su umbral de 1 KB **sólo se mira si la respuesta trae
 * `Content-Length`**, y `c.json()` no lo trae: sin esto comprimiría hasta un
 * `{ "ok": true }`, que pesa más comprimido que sin comprimir y gasta CPU en cada
 * request.
 *
 * Acá se declara el largo antes de dejarle la decisión. Las respuestas de la API
 * son JSON de a lo sumo cientos de KB (el bundle de una patrulla es lo más
 * grande), así que leerlas para medirlas es barato.
 */

import type { MiddlewareHandler } from 'hono';
import { compress } from 'hono/compress';

export function compresionDeJson(): MiddlewareHandler {
  const comprimir = compress();

  return (c, next) =>
    comprimir(c, async () => {
      await next();

      if (!c.res.headers.has('Content-Length') && c.res.body) {
        const bytes = (await c.res.clone().arrayBuffer()).byteLength;
        c.res.headers.set('Content-Length', String(bytes));
      }
    });
}
