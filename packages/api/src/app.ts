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
import { compresionDeJson } from './middleware/compresion.js';
import { csrfProtection } from './middleware/csrf.js';
import { handleError } from './middleware/error.js';
import { hayBuild, montarEstaticos, RUTAS_POR_DEFECTO } from './middleware/estaticos.js';
import { limiteDeBody } from './middleware/limiteDeBody.js';
import { clavePorSesion, failedAttemptsLimit, rateLimit } from './middleware/rateLimit.js';
import { securityHeaders } from './middleware/security.js';
import { admin } from './routes/admin.js';
import { auth } from './routes/auth.js';
import { health } from './routes/health.js';
import { publico } from './routes/publico.js';
import { wafl } from './routes/wafl.js';

/** Cuántas veces el cupo de una sesión de sync es el tope de **toda una IP**. */
const TOPE_POR_IP_DE_SYNC = 20;

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

  // Sólo los endpoints de ingreso, y sólo los intentos que fallan. Antes era
  // todo `/api/auth/*` contando cada request: `/me` y `/csrf` los pide la app en
  // cada carga, y diez patrullas entrando bien desde el wifi del club dejaban
  // afuera a la undécima. Admin y patrulla comparten cupo: quien rocía
  // intentos no distingue entre una puerta y la otra.
  const ventanaDeLogin = cfg.RATE_LIMIT_LOGIN_WINDOW_MIN * 60_000;
  const intentosDeLogin = failedAttemptsLimit({
    limit: cfg.RATE_LIMIT_LOGIN,
    windowMs: ventanaDeLogin,
    scope: 'login',
  });
  app.use('/api/auth/admin/login', intentosDeLogin);
  app.use('/api/auth/patrol/login', intentosDeLogin);

  // La recuperación del password tiene su cupo, aparte y más corto: no tiene
  // bloqueo por cuenta que la proteja, y errar el código no tiene que dejar a
  // nadie sin poder entrar con su PIN (ni al revés).
  app.use(
    '/api/auth/admin/recover',
    failedAttemptsLimit({
      limit: cfg.RATE_LIMIT_RECOVER,
      windowMs: ventanaDeLogin,
      scope: 'recover',
    }),
  );

  // El alta pública escribe sin sesión, así que tiene un cupo propio además del de
  // lectura. Sólo el POST: la ficha de un arquero (GET) no lo gasta.
  app.on(
    'POST',
    '/api/public/archers',
    rateLimit({ limit: cfg.RATE_LIMIT_REGISTER, windowMs: 3_600_000, scope: 'alta' }),
  );

  // Generoso a propósito: una patrulla que vuelve de tres horas sin señal manda
  // cientos de operaciones de golpe y NUNCA debe ser rechazada. Ese endpoint lo
  // protegen la autenticación y la autorización, no el rate limit.
  //
  // Dos capas (`REF6-15` / `B-2`). El cupo es **de la sesión**: el wifi del club es una sola IP para
  // todas las patrullas, y uno por IP las cortaría entre sí. Pero una cookie inventada tiene su
  // propio cupo, así que quien rota la cookie en cada request no lo gasta nunca: para eso está el
  // tope por IP, veinte veces más alto, que no mira la cookie y sólo se alcanza con una inundación.
  app.use(
    '/api/wafl/sync',
    rateLimit({
      limit: cfg.RATE_LIMIT_SYNC * TOPE_POR_IP_DE_SYNC,
      windowMs: 60_000,
      scope: 'sync-ip',
    }),
  );
  app.use(
    '/api/wafl/sync',
    rateLimit({
      limit: cfg.RATE_LIMIT_SYNC,
      windowMs: 60_000,
      scope: 'sync',
      keyBy: clavePorSesion,
    }),
  );

  // Después de los rate limits y antes de cualquier handler: un body de más se corta
  // antes de que algo lo lea entero.
  // El JSON grande (el bundle de una patrulla, los resultados) viaja comprimido si el
  // cliente lo acepta. Hono lo omite por debajo de 1 KB, donde no vale la pena.
  app.use('/api/*', compresionDeJson());

  app.use('/api/*', limiteDeBody());

  app.use('/api/*', csrfProtection());

  app.route('/api/auth', auth);
  app.route('/api/admin', admin);
  app.route('/api/wafl', wafl);
  app.route('/api/public', publico);

  // En desarrollo cada frontend corre en su Vite y esto no se monta. En tests
  // tampoco: que una suite pase o falle según si alguien corrió `pnpm build`
  // antes es exactamente el tipo de intermitencia que no se puede tener.
  if (options.servirFrontends ?? (cfg.NODE_ENV !== 'test' && hayBuild(RUTAS_POR_DEFECTO))) {
    montarEstaticos(app, RUTAS_POR_DEFECTO, cfg.NODE_ENV);
  }

  app.notFound((c) =>
    c.json({ error: { code: 'NOT_FOUND', message: 'No se encontró lo que buscabas.' } }, 404),
  );

  return app;
}
