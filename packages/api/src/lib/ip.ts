/**
 * IP del cliente.
 *
 * La usan el rate limit, las sesiones y el audit log: si cada uno la leyera a su
 * manera, un intento podría figurar con una IP en el log y con otra en el cupo.
 *
 * **Sólo se puede confiar en el header que escribe el proxy de adelante.**
 * `X-Forwarded-For` no es ése: los proxies *agregan* al final, así que el primer
 * valor lo escribe quien hace el request. Railway documenta `X-Real-IP` como la
 * IP del cliente; en producción es el que se usa. Ver `TRUSTED_IP_HEADER` en
 * `env.ts`.
 */

import type { Context } from 'hono';
import { env } from '../env.js';

const primerValor = (header: string | undefined): string | undefined =>
  header?.split(',')[0]?.trim() || undefined;

/**
 * IP del cliente, o `null` si ningún header la trae.
 *
 * Con un header de confianza configurado se usa ése y nada más que ése. Si el
 * proxy no lo mandó se cae al comportamiento de antes en vez de agrupar a todos
 * bajo una misma IP: peor que un cupo esquivable sería uno compartido por todo
 * el club.
 */
export function ipDelCliente(c: Context): string | null {
  const confiable = env().trustedIpHeader;
  const deConfianza = confiable ? primerValor(c.req.header(confiable)) : undefined;

  return (
    deConfianza ??
    primerValor(c.req.header('x-forwarded-for')) ??
    primerValor(c.req.header('x-real-ip')) ??
    null
  );
}
