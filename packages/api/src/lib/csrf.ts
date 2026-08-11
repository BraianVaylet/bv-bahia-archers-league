/**
 * CSRF: cookie legible + header obligatorio en toda mutación.
 *
 * `SameSite=Lax` es la primera línea; el token es la segunda. Defensa en
 * profundidad: si alguna vez `SameSite` no alcanza —un navegador viejo, una
 * subida de subdominio— el token sigue parando el ataque.
 *
 * Ver `docs/SECURITY.md` §8.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';

export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Compara en tiempo constante. Con `timingSafeEqual` hace falta que los buffers
 * midan lo mismo, así que la diferencia de longitud se resuelve antes.
 */
export function csrfMatches(
  cookieToken: string | undefined,
  headerToken: string | undefined,
): boolean {
  if (!cookieToken || !headerToken) return false;

  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
