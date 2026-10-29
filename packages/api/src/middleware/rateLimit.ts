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
import { ipDelCliente } from '../lib/ip.js';

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

/**
 * Tope de contadores vivos. Un cliente que inventa una IP distinta en cada
 * request crea una clave por request; sin tope, el `Map` crece hasta agotar la
 * memoria del proceso.
 */
export const MAX_CONTADORES = 10_000;

/** Sólo para tests: olvida todos los contadores. */
export function resetRateLimits(): void {
  buckets.clear();
}

/** Sólo para tests: cuántos contadores hay hoy. */
export function contadoresVivos(): number {
  return buckets.size;
}

function limpiarVencidos(ahora: number): void {
  for (const [clave, ventana] of buckets) {
    if (ventana.resetAt <= ahora) buckets.delete(clave);
  }
}

export function clientIp(c: Context): string {
  return ipDelCliente(c) ?? 'desconocida';
}

/**
 * Abre una ventana nueva para la clave, respetando el tope.
 *
 * Al llegar al tope primero se barren las vencidas; si no alcanza, sale la más
 * vieja —el `Map` conserva el orden de inserción—. Lo que se pierde es el
 * contador de quien lleva más tiempo sin volver, que es lo que menos duele.
 */
function abrirVentana(clave: string, windowMs: number, ahora: number): Ventana {
  if (buckets.size >= MAX_CONTADORES) limpiarVencidos(ahora);

  while (buckets.size >= MAX_CONTADORES) {
    const masVieja = buckets.keys().next().value;
    if (masVieja === undefined) break;
    buckets.delete(masVieja);
  }

  // Se borra antes de escribir: un `set` sobre una clave que ya existe la deja
  // en su lugar original, y la que se reabre pasaría por «vieja».
  buckets.delete(clave);
  const ventana: Ventana = { count: 1, resetAt: ahora + windowMs };
  buckets.set(clave, ventana);
  return ventana;
}

/**
 * Reserva un lugar en el cupo de la clave: suma uno, o abre la ventana si no hay
 * una vigente. Es sincrónico, así que dos requests que llegan juntos no ven el
 * mismo número.
 */
function reservar(clave: string, windowMs: number, ahora: number): Ventana {
  const vigente = buckets.get(clave);
  if (vigente && vigente.resetAt > ahora) {
    vigente.count++;
    return vigente;
  }
  return abrirVentana(clave, windowMs, ahora);
}

const segundosHasta = (ventana: Ventana, ahora: number): number =>
  Math.ceil((ventana.resetAt - ahora) / 1000);

/**
 * Consume una unidad del cupo.
 * @returns segundos que faltan para el reset si se excedió, o `null` si hay cupo.
 */
export function consume(clave: string, limit: number, windowMs: number): number | null {
  const ahora = Date.now();
  const ventana = reservar(clave, windowMs, ahora);
  return ventana.count > limit ? segundosHasta(ventana, ahora) : null;
}

/**
 * Cupo de **intentos fallidos** por IP, para los endpoints de ingreso.
 *
 * A diferencia de `rateLimit`, no gasta el cupo con cada request: cada intento
 * **reserva su lugar al entrar** y lo **devuelve** si no terminó en `401`. Un
 * ingreso correcto no gasta nada, y por eso el wifi del club —una sola IP para
 * todas las patrullas— no se queda sin cupo el día del torneo. Lo que frena la
 * fuerza bruta contra una cuenta es su propio bloqueo; esto es contra quien
 * rocía intentos por muchas cuentas, y en la recuperación del password, que no
 * tiene bloqueo por cuenta, es lo único que frena adivinar el código.
 *
 * **Reservar al entrar y no anotar el fallo al salir es lo que importa.** Con
 * "mirar al entrar, anotar al salir", una ráfaga de requests simultáneos mira el
 * contador antes de que el primero termine y pasan todos: el cupo de cinco
 * dejaba pasar treinta.
 *
 * Un `429` del bloqueo por cuenta, un `403` de CSRF o un `409` de torneo no
 * iniciado devuelven el lugar: no son credenciales equivocadas. El costo de
 * reservar es que los intentos **en vuelo** cuentan hasta que terminan (unos
 * milisegundos): hacen falta `limit` ingresos simultáneos para cortar a uno
 * legítimo.
 */
export const failedAttemptsLimit = (options: {
  readonly limit: number;
  readonly windowMs: number;
  readonly scope: string;
  readonly keyBy?: (c: Context) => string;
}): MiddlewareHandler => {
  const { limit, windowMs, scope, keyBy = clientIp } = options;

  return async (c, next) => {
    const clave = `${scope}:${keyBy(c)}`;
    const ahora = Date.now();
    const ventana = reservar(clave, windowMs, ahora);

    if (ventana.count > limit) {
      const retryAfter = segundosHasta(ventana, ahora);
      throw new AppError('RATE_LIMITED', {
        headers: { 'Retry-After': String(retryAfter) },
        details: { retryAfterSeconds: retryAfter },
      });
    }

    await next();

    // El error del handler ya es una respuesta cuando `next()` vuelve: Hono lo
    // convierte con `onError` dentro de su `compose` y no lo propaga hacia acá.
    // `ventana` es la que se reservó, no una búsqueda por clave: si venció y se
    // reabrió otra mientras tanto, restarle a la vieja no toca a la nueva.
    if (c.res.status !== 401) ventana.count--;
  };
};

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
