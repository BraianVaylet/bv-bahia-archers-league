/**
 * Servido de los frontends construidos.
 *
 * En producción **un solo contenedor sirve todo**: la landing en `/`, la PWA en
 * `/app/`. Un solo origen significa sin CORS y cookies simples. Ver
 * `docs/ARCHITECTURE.md` §3.
 *
 * En desarrollo cada frontend corre en su Vite y esto no se monta: los `dist`
 * no existen, y se detecta en vez de configurarse, para que nadie tenga que
 * acordarse de una variable de entorno.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';

const AQUI = dirname(fileURLToPath(import.meta.url));

/**
 * Raíz del monorepo.
 *
 * Se sube desde `packages/api/{src,dist}/middleware` hasta la raíz. Vale para el
 * código compilado y para `tsx` en desarrollo, porque la profundidad es la misma.
 */
const RAIZ = resolve(AQUI, '..', '..', '..', '..');

export interface RutasDeFrontend {
  readonly landing: string;
  readonly app: string;
}

export const RUTAS_POR_DEFECTO: RutasDeFrontend = {
  landing: join(RAIZ, 'packages', 'landing', 'dist'),
  app: join(RAIZ, 'packages', 'app', 'dist'),
};

/** `true` si el frontend está construido y se puede servir. */
export function hayBuild(rutas: RutasDeFrontend = RUTAS_POR_DEFECTO): boolean {
  return existsSync(join(rutas.landing, 'index.html')) && existsSync(join(rutas.app, 'index.html'));
}

/**
 * Monta los dos frontends.
 *
 * **Se llama después de las rutas de `/api`**, así que un endpoint inexistente
 * sigue devolviendo el JSON de error y no el HTML de la landing.
 *
 * Las dos apps son SPA: cualquier ruta que no sea un archivo devuelve su
 * `index.html` y el router del cliente resuelve. Sin eso, recargar en
 * `/app/wafl` daría 404 — que es exactamente lo que hace un líder al que se le
 * cierra el navegador a mitad del recorrido.
 */
export function montarEstaticos(app: Hono, rutas: RutasDeFrontend = RUTAS_POR_DEFECTO): void {
  const html = async (ruta: string) => readFile(join(ruta, 'index.html'), 'utf8');

  app.use(
    '/app/*',
    serveStatic({ root: rutas.app, rewriteRequestPath: (p) => p.slice('/app'.length) }),
  );
  app.get('/app', async (c) => c.html(await html(rutas.app)));
  app.get('/app/*', async (c) => c.html(await html(rutas.app)));

  app.use('/*', serveStatic({ root: rutas.landing }));
  app.get('*', async (c) => {
    // Un `/api/...` que no existe responde JSON, no el HTML de la landing:
    // devolverle HTML a un cliente que espera JSON esconde el error real.
    if (c.req.path.startsWith('/api/')) return c.notFound();
    return c.html(await html(rutas.landing));
  });
}
