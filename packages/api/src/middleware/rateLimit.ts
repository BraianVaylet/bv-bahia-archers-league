/**
 * Rate limiting por ventana deslizante, en memoria.
 *
 * **Balance deliberado.** Un rate limit mal calibrado es un denial of service
 * autoinfligido el día del torneo. Los límites de `/api/wafl/sync` son
 * generosos a propósito: una patrulla que vuelve de tres horas sin señal manda
 * cientos de operaciones de golpe y **nunca** debe ser rechazada. Ese endpoint
 * está protegido por la autenticación y la autorización, no por el rate limit.
 *
 * Ver `docs/SECURITY.md` §3.3.
 *
 * Limitación conocida: el estado vive en memoria del proceso. Alcanza para el
 * despliegue de un solo contenedor de `docs/ARCHITECTURE.md` §3. Si alguna vez
 * se escala a varias instancias, hay que mover esto a la base o a un Redis.
 */

import type { Context, MiddlewareHandler } from 'hono';
import { AppError } from '../lib/errors.js';

interface Ventana {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Máximo de solicitudes por ventana. */
  readonly limit: number;
  /** Duración de la ventana, en milisegundos. */
  readonly windowMs: number;
  /** Cómo se agrupa. Por defecto, por IP. */
  readonly keyBy?: (c: Context) => string;
  /** Prefijo para que dos limitadores no compartan contadores. */
  readonly scope?: string;
}

const buckets = new Map<string, Ventana>();

/** Sólo para tests: olvida todos los contadores. */
export function resetRateLimits(): void {
  buckets.clear();
}

function limpiarVencidos(ahora: number): void {
  for (const [clave, ventana] of buckets) {
    if (ventana.resetAt <= ahora) buckets.delete(clave);
  }
}

export function clientIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    'desconocida'
  );
}

/**
 * Consume una unidad del cupo.
 * @returns segundos que faltan para el reset si se excedió, o `null` si hay cupo.
 */
export function consume(clave: string, limit: number, windowMs: number): number | null {
  const ahora = Date.now();

  // Barrido barato: la cantidad de claves vivas es chica (decenas).
  if (buckets.size > 1_000) limpiarVencidos(ahora);

  const ventana = buckets.get(clave);
  if (!ventana || ventana.resetAt <= ahora) {
    buckets.set(clave, { count: 1, resetAt: ahora + windowMs });
    return null;
  }

  ventana.count++;
  if (ventana.count > limit) {
    return Math.ceil((ventana.resetAt - ahora) / 1000);
  }

  return null;
}

export const rateLimit = (options: RateLimitOptions): MiddlewareHandler => {
  const { limit, windowMs, keyBy = clientIp, scope = 'global' } = options;

  return async (c, next) => {
    const retryAfter = consume(`${scope}:${keyBy(c)}`, limit, windowMs);

    if (retryAfter !== null) {
      throw new AppError('RATE_LIMITED', {
        headers: { 'Retry-After': String(retryAfter) },
        details: { retryAfterSeconds: retryAfter },
      });
    }

    return next();
  };
};
