/**
 * Aplicación Hono.
 *
 * Un solo origen sirve `/api`, la PWA en `/app` y la landing en `/`. Sin CORS,
 * cookies simples. Ver `docs/ARCHITECTURE.md` §3.
 *
 * Orden de los middlewares, y por qué:
 *   1. securityHeaders se aplican incluso a las respuestas de error
 *   2. rateLimit       antes de tocar la base
 *   3. csrfProtection  antes de cualquier handler que escriba
 *
 * Los errores se manejan con `app.onError`, no con un middleware que envuelva
 * en `try/catch`: Hono captura los errores del handler dentro de su `compose` y
 * no los propaga hacia arriba.
 */

import { Hono } from 'hono';
import { env } from './env.js';
import { csrfProtection } from './middleware/csrf.js';
import { handleError } from './middleware/error.js';
import { hayBuild, montarEstaticos } from './middleware/estaticos.js';
import { rateLimit } from './middleware/rateLimit.js';
import { securityHeaders } from './middleware/security.js';
import { admin } from './routes/admin.js';
import { auth } from './routes/auth.js';
import { health } from './routes/health.js';
import { publico } from './routes/publico.js';
import { wafl } from './routes/wafl.js';

export interface AppOptions {
  /** Hashes SHA-256 de los scripts inline permitidos por la CSP. */
  readonly scriptHashes?: readonly string[];
  /**
   * Servir los frontends construidos. Por defecto se detecta: si los `dist`
   * existen, se sirven. Los tests lo apagan para no depender de un build.
   */
  readonly servirFrontends?: boolean;
}

export function createApp(options: AppOptions = {}): Hono {
  const cfg = env();
  const app = new Hono();

  app.onError(handleError);
  app.use('*', securityHeaders({ scriptHashes: options.scriptHashes ?? [] }));

  // El healthcheck no lleva rate limit: Railway lo consulta seguido y
  // bloquearlo daría de baja el servicio por su propio monitoreo.
  app.route('/api/health', health);

  app.use(
    '/api/public/*',
    rateLimit({ limit: cfg.RATE_LIMIT_PUBLIC, windowMs: 60_000, scope: 'public' }),
  );

  app.use(
    '/api/auth/*',
    rateLimit({
      limit: cfg.RATE_LIMIT_LOGIN,
      windowMs: cfg.RATE_LIMIT_LOGIN_WINDOW_MIN * 60_000,
      scope: 'auth',
    }),
  );

  // Generoso a propósito: una patrulla que vuelve de tres horas sin señal manda
  // cientos de operaciones de golpe y NUNCA debe ser rechazada. Ese endpoint lo
  // protegen la autenticación y la autorización, no el rate limit.
  app.use(
    '/api/wafl/sync',
    rateLimit({ limit: cfg.RATE_LIMIT_SYNC, windowMs: 60_000, scope: 'sync' }),
  );

  app.use('/api/*', csrfProtection());

  app.route('/api/auth', auth);
  app.route('/api/admin', admin);
  app.route('/api/wafl', wafl);
  app.route('/api/public', publico);

  // En desarrollo cada frontend corre en su Vite y esto no se monta. En tests
  // tampoco: que una suite pase o falle según si alguien corrió `pnpm build`
  // antes es exactamente el tipo de intermitencia que no se puede tener.
  if (options.servirFrontends ?? (cfg.NODE_ENV !== 'test' && hayBuild())) {
    montarEstaticos(app);
  }

  app.notFound((c) =>
    c.json({ error: { code: 'NOT_FOUND', message: 'No se encontró lo que buscabas.' } }, 404),
  );

  return app;
}
