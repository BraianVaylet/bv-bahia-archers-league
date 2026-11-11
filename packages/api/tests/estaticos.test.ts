import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { resetEnvCache } from '../src/env.js';
import {
  elegirRutas,
  hayBuild,
  marcarAmbiente,
  montarEstaticos,
} from '../src/middleware/estaticos.js';
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
  // Los precomprimidos que deja el build junto a cada asset. No son brotli ni gzip
  // de verdad: el servidor los pasa tal cual, y distinguirlos alcanza.
  await writeFile(join(RUTAS.app, 'assets', 'x.js.br'), 'BROTLI-DE-X');
  await writeFile(join(RUTAS.app, 'assets', 'x.js.gz'), 'GZIP-DE-X');
  await writeFile(join(RUTAS.landing, 'assets', 'y.css'), 'body{}');
  await writeFile(join(RUTAS.app, 'sw.js'), 'self.skipWaiting();');
  await writeFile(join(RUTAS.app, 'manifest.webmanifest'), '{}');
  await writeFile(join(RUTAS.app, 'theme-init.js'), '/* tema */');
  await writeFile(join(RUTAS.landing, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
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

describe('elegirRutas', () => {
  const inexistente = { landing: join(RAIZ, 'no-a'), app: join(RAIZ, 'no-b') };

  // En la imagen los frontends quedan junto al `dist` de la API; en el monorepo,
  // cada uno en el suyo. Se detecta en vez de configurarse: una variable más es
  // una cosa más que puede quedar mal seteada el día del deploy.
  it('prefiere la primera ubicación que tenga los builds', () => {
    expect(elegirRutas([RUTAS, inexistente])).toEqual(RUTAS);
    expect(elegirRutas([inexistente, RUTAS])).toEqual(RUTAS);
  });

  it('sin ninguna construida devuelve la última, y no se sirve nada', () => {
    const elegida = elegirRutas([inexistente, inexistente]);

    expect(elegida).toEqual(inexistente);
    expect(hayBuild(elegida)).toBe(false);
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

// ── P-4 · Política de caché ──────────────────────────────────────────────────

/**
 * `REF6-8` / `P-4`. `montarEstaticos` no ponía `Cache-Control`: los archivos de
 * `/assets/*` llevan el hash en el nombre y se pueden guardar para siempre, pero
 * `index.html`, `sw.js` y el manifest tienen que revalidarse siempre, o una
 * versión nueva tarda días en llegar. Sin ninguna política, el navegador decide
 * solo, y la landing —que no tiene service worker— revalidaba todo en cada visita.
 */
describe('política de caché', () => {
  const INMUTABLE = 'public, max-age=31536000, immutable';

  it('los assets con hash son inmutables, en la PWA y en la landing', async () => {
    const app = conEstaticos();

    expect((await pedir(app, '/app/assets/x.js')).headers.get('cache-control')).toBe(INMUTABLE);
    expect((await pedir(app, '/assets/y.css')).headers.get('cache-control')).toBe(INMUTABLE);
  });

  /**
   * Lo que no tiene hash en el nombre y cambia con cada versión: si se guardara,
   * una versión nueva no llegaría nunca. `no-cache` no es «no guardar»: es guardar
   * y preguntar antes de usar, que con un `ETag`/`Last-Modified` cuesta un 304.
   */
  it.each([
    '/app/',
    '/app',
    '/app/index.html',
    '/app/wafl/blanco/7',
    '/app/sw.js',
    '/app/manifest.webmanifest',
    '/app/theme-init.js',
    '/',
    '/torneos/abc123',
    '/favicon.svg',
  ])('%s se revalida siempre', async (ruta) => {
    const res = await pedir(conEstaticos(), ruta);

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-cache');
  });

  /**
   * Se leía de disco en cada fallback de SPA: es el request que hace cada líder al
   * reabrir el navegador en la ruta donde estaba. Se lee una vez al montar.
   */
  it('lee el index.html una vez al montar, no en cada request', async () => {
    const ruta = { landing: join(RAIZ, 'mem-landing'), app: join(RAIZ, 'mem-app') };
    await mkdir(ruta.landing, { recursive: true });
    await mkdir(ruta.app, { recursive: true });
    await writeFile(join(ruta.landing, 'index.html'), '<html>LANDING-EN-MEMORIA</html>');
    await writeFile(join(ruta.app, 'index.html'), '<html>PWA-EN-MEMORIA</html>');

    const app = new Hono();
    montarEstaticos(app, ruta);
    await rm(join(ruta.landing, 'index.html'));
    await rm(join(ruta.app, 'index.html'));

    expect(await (await pedir(app, '/app/wafl/blanco/7')).text()).toMatch('PWA-EN-MEMORIA');
    expect(await (await pedir(app, '/torneos/abc')).text()).toMatch('LANDING-EN-MEMORIA');
  });
});

// ── P-3 · Compresión ─────────────────────────────────────────────────────────

/**
 * `REF6-8` / `P-3`. El JS de la PWA viajaba como 438 KB en vez de ~126 KB
 * comprimido. El build deja un `.br` y un `.gz` junto a cada asset y el servidor
 * entrega el que el cliente acepta, sin comprimir nada en cada request.
 */
describe('compresión de los estáticos', () => {
  const pedirCon = (ruta: string, aceptado?: string) =>
    conEstaticos().request(`http://localhost${ruta}`, {
      headers: aceptado ? { 'accept-encoding': aceptado } : {},
    });

  it('entrega el brotli si el cliente lo acepta', async () => {
    const res = await pedirCon('/app/assets/x.js', 'gzip, deflate, br');

    expect(res.headers.get('content-encoding')).toBe('br');
    expect(await res.text()).toBe('BROTLI-DE-X');
    // El tipo es el del archivo original, no el del `.br`.
    expect(res.headers.get('content-type')).toMatch('javascript');
  });

  it('si sólo acepta gzip, entrega el gzip', async () => {
    const res = await pedirCon('/app/assets/x.js', 'gzip');

    expect(res.headers.get('content-encoding')).toBe('gzip');
    expect(await res.text()).toBe('GZIP-DE-X');
  });

  it('sin Accept-Encoding entrega el original', async () => {
    const res = await pedirCon('/app/assets/x.js');

    expect(res.headers.get('content-encoding')).toBeNull();
    expect(await res.text()).toBe('export const x = 1;');
  });

  // Sin `Vary`, una caché intermedia podría servirle el brotli a quien no lo entiende.
  it('avisa a las cachés que depende de Accept-Encoding, también la sin comprimir', async () => {
    for (const aceptado of ['br', undefined]) {
      const res = await pedirCon('/app/assets/x.js', aceptado);
      expect(res.headers.get('vary') ?? '', String(aceptado)).toMatch(/accept-encoding/i);
    }
  });
});

describe('compresión del JSON de la API', () => {
  function conRutasGrandes() {
    const app = createApp({ servirFrontends: false });
    app.get('/api/_grande', (c) => c.json({ relleno: 'x'.repeat(5_000) }));
    app.get('/api/_chico', (c) => c.json({ ok: true }));
    return app;
  }
  const con = (app: Hono, ruta: string, aceptado?: string) =>
    app.request(`http://localhost${ruta}`, {
      headers: aceptado ? { 'accept-encoding': aceptado } : {},
    });

  it('comprime una respuesta de más de 1 KB si el cliente lo acepta', async () => {
    const res = await con(conRutasGrandes(), '/api/_grande', 'gzip');

    expect(res.headers.get('content-encoding')).toBe('gzip');
  });

  it('no comprime lo chico: no vale la pena', async () => {
    const res = await con(conRutasGrandes(), '/api/_chico', 'gzip');

    expect(res.headers.get('content-encoding')).toBeNull();
  });

  it('no comprime si el cliente no lo pide', async () => {
    const res = await con(conRutasGrandes(), '/api/_grande');

    expect(res.headers.get('content-encoding')).toBeNull();
  });
});

// ── Indicador de ambiente ────────────────────────────────────────────────────

/**
 * La barra «estás en modo desarrollo» de la landing, WAFA y WAFL.
 *
 * **El build no sabe en qué ambiente va a correr.** `vite build` corre siempre en modo
 * `production` y la imagen de Docker es la misma para los dos ambientes de Railway: lo único
 * que cambia entre uno y otro es el `NODE_ENV` del contenedor. Así que el servidor lo escribe
 * en el `<html>` que entrega, y la interfaz lo lee del documento, sin un fetch: WAFL tiene que
 * arrancar sin red, y su `index.html` es el que precacheó el service worker.
 */
describe('ambiente en el index.html', () => {
  const RUTAS_AMB = { landing: join(RAIZ, 'amb-landing'), app: join(RAIZ, 'amb-app') };

  beforeAll(async () => {
    await mkdir(RUTAS_AMB.landing, { recursive: true });
    await mkdir(RUTAS_AMB.app, { recursive: true });
    await writeFile(
      join(RUTAS_AMB.landing, 'index.html'),
      '<!doctype html><html lang="es-AR"><body>LANDING</body></html>',
    );
    await writeFile(
      join(RUTAS_AMB.app, 'index.html'),
      '<!doctype html><html lang="es-AR"><body>PWA</body></html>',
    );
    // El build deja precomprimido el `index.html` también. Si `serveStatic` lo entregara,
    // saldría el del disco, sin el ambiente.
    await writeFile(join(RUTAS_AMB.app, 'index.html.br'), 'BROTLI-DEL-INDEX');
    await writeFile(join(RUTAS_AMB.landing, 'index.html.br'), 'BROTLI-DEL-INDEX');
  });

  function montadoEn(ambiente: 'development' | 'production' | 'test') {
    const app = new Hono();
    montarEstaticos(app, RUTAS_AMB, ambiente);
    return app;
  }

  it('marcarAmbiente agrega el atributo al <html> y respeta los que ya tenía', () => {
    expect(marcarAmbiente('<!doctype html><html lang="es-AR"><head>', 'development')).toBe(
      '<!doctype html><html data-ambiente="development" lang="es-AR"><head>',
    );
  });

  it('marcarAmbiente no toca otra etiqueta que empiece igual', () => {
    expect(marcarAmbiente('<htmlx><html>', 'production')).toBe(
      '<htmlx><html data-ambiente="production">',
    );
  });

  it.each([
    '/',
    '/index.html',
    '/torneos/abc123',
    '/app',
    '/app/',
    '/app/index.html',
    '/app/wafl/blanco/7',
  ])('%s lleva el ambiente del servidor', async (ruta) => {
    const res = await montadoEn('development').request(`http://localhost${ruta}`, {
      headers: { 'accept-encoding': 'gzip, deflate, br' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(await res.text()).toMatch('<html data-ambiente="development" lang="es-AR">');
  });

  // El que precachea el service worker de WAFL: lo pide con un parámetro de revisión.
  it('el index.html que pide el service worker también lo lleva', async () => {
    const res = await montadoEn('development').request(
      'http://localhost/app/index.html?__WB_REVISION__=abc',
    );
    expect(await res.text()).toMatch('data-ambiente="development"');
  });

  it('en producción dice producción', async () => {
    const res = await montadoEn('production').request('http://localhost/app/wafl');
    expect(await res.text()).toMatch('data-ambiente="production"');
  });

  it('sin ambiente explícito asume producción: la barra no aparece por omisión', async () => {
    const app = new Hono();
    montarEstaticos(app, RUTAS_AMB);
    expect(await (await app.request('http://localhost/')).text()).toMatch(
      'data-ambiente="production"',
    );
  });
});
