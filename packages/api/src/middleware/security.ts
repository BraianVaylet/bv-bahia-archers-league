/**
 * Cabeceras de seguridad.
 *
 * Ver `docs/SECURITY.md` §10. Cualquier cambio acá se verifica contra el
 * checklist de §13 antes de mergear.
 */

import type { MiddlewareHandler } from 'hono';
import { env } from '../env.js';

/**
 * CSP restrictiva.
 *
 * - `img-src data: blob:` hace falta para las firmas en canvas.
 * - `camera=(self)` en Permissions-Policy queda para el escaneo de QR (FE-22);
 *   si esa función no se implementa, se saca.
 * - El script anti-FOUC del tema va con **hash**, no con `'unsafe-inline'`.
 *   El hash lo inyecta el build del frontend.
 */
function csp(scriptHashes: readonly string[]): string {
  const scriptSrc = ["'self'", ...scriptHashes.map((h) => `'${h}'`)].join(' ');

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

export interface SecurityOptions {
  /** Hashes SHA-256 de los scripts inline permitidos (ej. anti-FOUC del tema). */
  readonly scriptHashes?: readonly string[];
}

export const securityHeaders = (options: SecurityOptions = {}): MiddlewareHandler => {
  const policy = csp(options.scriptHashes ?? []);

  return async (c, next) => {
    await next();

    c.header('Content-Security-Policy', policy);
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'same-origin');
    c.header('X-Frame-Options', 'DENY');
    c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=(self)');
    c.header('Cross-Origin-Opener-Policy', 'same-origin');

    if (env().isProduction) {
      c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  };
};
