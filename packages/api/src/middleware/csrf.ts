/**
 * Exige el header `x-csrf-token` en toda mutación.
 *
 * Ver `docs/SECURITY.md` §8 y el checklist de §13.
 */

import type { MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { env } from '../env.js';
import { csrfMatches, generateCsrfToken } from '../lib/csrf.js';
import { AppError } from '../lib/errors.js';

const MUTACIONES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
export const CSRF_HEADER = 'x-csrf-token';

/** Asegura la cookie CSRF y devuelve el token vigente. */
export function ensureCsrfCookie(c: Parameters<MiddlewareHandler>[0]): string {
  const cfg = env();
  const existente = getCookie(c, cfg.CSRF_COOKIE_NAME);
  if (existente) return existente;

  const token = generateCsrfToken();
  setCookie(c, cfg.CSRF_COOKIE_NAME, token, {
    // Legible por JavaScript a propósito: el frontend tiene que poder mandarla
    // en el header. Lo que protege no es el secreto de la cookie sino que un
    // sitio de terceros no puede leerla para copiarla al header.
    httpOnly: false,
    secure: cfg.cookieSecure,
    sameSite: 'Lax',
    path: '/',
  });

  return token;
}

export const csrfProtection = (): MiddlewareHandler => async (c, next) => {
  if (!MUTACIONES.has(c.req.method)) {
    ensureCsrfCookie(c);
    return next();
  }

  const cookieToken = getCookie(c, env().CSRF_COOKIE_NAME);
  const headerToken = c.req.header(CSRF_HEADER);

  if (!csrfMatches(cookieToken, headerToken)) {
    throw new AppError('CSRF_INVALID');
  }

  return next();
};
