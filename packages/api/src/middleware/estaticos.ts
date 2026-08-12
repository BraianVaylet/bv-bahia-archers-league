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

/** `packages/api`, subiendo desde `{src,dist}/middleware`. */
const PAQUETE = resolve(AQUI, '..', '..');

/** Raíz del monorepo. */
const RAIZ = resolve(PAQUETE, '..', '..');

export interface RutasDeFrontend {
  readonly landing: string;
  readonly app: string;
}

/** `true` si el frontend está construido y se puede servir. */
export function hayBuild(rutas: RutasDeFrontend): boolean {
  return existsSync(join(rutas.landing, 'index.html')) && existsSync(join(rutas.app, 'index.html'));
}

/** Layout de la imagen: los builds se copian junto al `dist` de la API. */
const EN_IMAGEN: RutasDeFrontend = {
  landing: join(PAQUETE, 'public', 'landing'),
  app: join(PAQUETE, 'public', 'app'),
};

/** Layout del monorepo: cada frontend en su propio `dist`. */
const EN_MONOREPO: RutasDeFrontend = {
  landing: join(RAIZ, 'packages', 'landing', 'dist'),
  app: join(RAIZ, 'packages', 'app', 'dist'),
};

/**
 * La primera ubicación que tenga los frontends construidos.
 *
 * Si ninguna los tiene devuelve la última, que es la del monorepo: en
 * desarrollo no hay build y no servir nada es exactamente lo correcto.
 */
export function elegirRutas(candidatas: readonly RutasDeFrontend[]): RutasDeFrontend {
  const encontrada = candidatas.find(hayBuild);
  // biome-ignore lint/style/noNonNullAssertion: la lista nunca está vacía
  return encontrada ?? candidatas[candidatas.length - 1]!;
}

/**
 * Dónde están los frontends.
 *
 * **Se detecta, no se configura.** En la imagen quedan junto al `dist` de la
 * API; en el monorepo, cada uno en el suyo. Una variable de entorno más sería
 * una cosa más que puede quedar mal seteada el día del deploy.
 */
export const RUTAS_POR_DEFECTO: RutasDeFrontend = elegirRutas([EN_IMAGEN, EN_MONOREPO]);

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
