/**
 * Límite del tamaño del body, medido en bytes reales.
 *
 * `REF6-6` / `S-5`. `parseJsonBody` sólo miraba el `Content-Length` que el cliente
 * declara. Con `Transfer-Encoding: chunked` no hay header, y `c.req.json()` leía
 * el body entero a memoria antes de decidir nada. Acá se cuentan los bytes que
 * llegan y se corta apenas se pasa del máximo, sin seguir leyendo.
 *
 * Ver `docs/SECURITY.md` §5.
 */

import type { Context, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { AppError } from '../lib/errors.js';

/**
 * Lo que admite cualquier ruta que no sea el sync.
 *
 * El body más grande legítimo de esas rutas es la creación de un torneo (60 blancos
 * y 200 arqueros: ~10 KB) o la redistribución de patrullas. 64 KB tiene holgura de
 * sobra y es 16 veces menos que lo que `parseJsonBody` toleraba.
 */
export const LIMITE_GENERAL_BYTES = 64 * 1024;

/**
 * El sync es la excepción: un lote de 200 operaciones con firmas en PNG pesa
 * cientos de KB, y una patrulla que vuelve de tres horas sin señal **nunca** debe
 * ser rechazada por esto. Ver `docs/OFFLINE_SYNC.md` §6.
 */
export const LIMITE_SYNC_BYTES = 1024 * 1024;

const RUTA_DE_SYNC = '/api/wafl/sync';

/** Misma forma de error que el resto de la API: `{ error: { code, message } }`. */
const demasiadoGrande = (c: Context): Response => {
  const error = new AppError('PAYLOAD_TOO_LARGE');
  return c.json({ error: { code: error.code, message: error.message } }, error.status);
};

const general = bodyLimit({ maxSize: LIMITE_GENERAL_BYTES, onError: demasiadoGrande });
const sync = bodyLimit({ maxSize: LIMITE_SYNC_BYTES, onError: demasiadoGrande });

/** Elige el techo según la ruta. Un `GET`, sin body, pasa de largo. */
export const limiteDeBody = (): MiddlewareHandler => (c, next) =>
  (c.req.path === RUTA_DE_SYNC ? sync : general)(c, next);
