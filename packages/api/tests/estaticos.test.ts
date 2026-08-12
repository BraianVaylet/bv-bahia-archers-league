import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { resetEnvCache } from '../src/env.js';
import { hayBuild, montarEstaticos } from '../src/middleware/estaticos.js';
import { startDb, stopDb, testEnvRaw } from './helpers.js';

/**
 * Servido de los frontends construidos.
 *
 * En producción un solo contenedor sirve todo: la landing en `/`, la PWA en
 * `/app/`. Ver `docs/ARCHITECTURE.md` §3.
 */

const RAIZ = join(tmpdir(), `bal-estaticos-${Date.now()}`);
const RUTAS = { landing: join(RAIZ, 'landing'), app: join(RAIZ, 'app') };

beforeAll(async () => {
  Object.assign(process.env, testEnvRaw());
  resetEnvCache();
  await startDb();

  await mkdir(join(RUTAS.landing, 'assets'), { recursive: true });
  await mkdir(join(RUTAS.app, 'assets'), { recursive: true });
  await writeFile(join(RUTAS.landing, 'index.html'), '<html><body>LANDING</body></html>');
  await writeFile(join(RUTAS.app, 'index.html'), '<html><body>PWA</body></html>');
  await writeFile(join(RUTAS.app, 'assets', 'x.js'), 'export const x = 1;');
}, 120_000);

afterAll(async () => {
  await stopDb();
});

function conEstaticos() {
  const app = new Hono();
  montarEstaticos(app, RUTAS);
  return app;
}

const pedir = (app: Hono, path: string) => app.request(`http://localhost${path}`);

describe('hayBuild', () => {
  it('es falso si los frontends no están construidos', () => {
    expect(hayBuild({ landing: join(RAIZ, 'no-existe'), app: RUTAS.app })).toBe(false);
  });

  it('es verdadero con los dos construidos', () => {
    expect(hayBuild(RUTAS)).toBe(true);
  });
});

describe('servido de frontends', () => {
  it('la raíz sirve la landing', async () => {
    const res = await pedir(conEstaticos(), '/');
    expect(await res.text()).toMatch('LANDING');
  });

  it('`/app` sirve la PWA', async () => {
    const res = await pedir(conEstaticos(), '/app');
    expect(await res.text()).toMatch('PWA');
  });

  it('sirve los assets de la PWA desde su propio directorio', async () => {
    const res = await pedir(conEstaticos(), '/app/assets/x.js');
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch('export const x');
  });

  /**
   * Es exactamente lo que hace un líder al que se le cierra el navegador a mitad
   * del recorrido: vuelve a abrirlo en la ruta donde estaba.
   */
  it('una ruta interna de la PWA devuelve su index, no un 404', async () => {
    const res = await pedir(conEstaticos(), '/app/wafl/blanco/7');
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch('PWA');
  });

  it('una ruta interna de la landing devuelve la landing, no la PWA', async () => {
    const res = await pedir(conEstaticos(), '/torneos/abc123');
    expect(await res.text()).toMatch('LANDING');
  });

  // Devolverle HTML a un cliente que espera JSON esconde el error real.
  it('un endpoint de la API que no existe sigue respondiendo JSON', async () => {
    const app = createApp({ servirFrontends: false });
    const res = await app.request('http://localhost/api/no-existe');

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toMatch('application/json');
  });

  it('con los estáticos montados, tampoco se le devuelve HTML a la API', async () => {
    const app = new Hono();
    montarEstaticos(app, RUTAS);

    const res = await pedir(app, '/api/lo-que-sea');
    expect(await res.text()).not.toMatch('LANDING');
  });
});
