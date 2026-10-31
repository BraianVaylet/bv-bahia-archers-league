import { expect, test } from '@playwright/test';

/**
 * Cómo se entregan los assets (`REF6-8`: `P-3`, `P-4`, `P-5`, `U-4`, `S-8`).
 *
 * Se prueba contra el stack construido y servido por la API, igual que en
 * producción: ni la política de caché ni el precomprimido existen en `vite dev`.
 */

const JS_DE_LA_APP = /\/app\/assets\/[^?]+\.js$/;

/** Los `.js` que el navegador pide mientras carga una ruta. */
async function jsPedidos(page: import('@playwright/test').Page, ruta: string): Promise<string[]> {
  const pedidos: string[] = [];
  page.on('request', (r) => {
    const { pathname } = new URL(r.url());
    if (JS_DE_LA_APP.test(pathname)) pedidos.push(pathname);
  });

  await page.goto(ruta);
  await page.waitForLoadState('networkidle');
  return pedidos;
}

// ── P-5 · Code splitting ─────────────────────────────────────────────────────

/**
 * `TECHNICAL.md` §5 lo pide: «entrar como líder no descarga el código de
 * administración». `App.tsx` importaba las dos apps de forma estática, así que el
 * líder de patrulla —con la peor señal de todo el torneo— bajaba el panel del admin.
 *
 * Vite nombra el chunk de un `import()` por su módulo: `WafaApp-<hash>.js`.
 */
test.describe('code splitting', () => {
  test('entrar como líder no descarga el código de administración', async ({ page }) => {
    const pedidos = await jsPedidos(page, '/app/wafl');

    // Que cargó algo: si no, el test pasaría por no haber mirado nada.
    expect(pedidos.length).toBeGreaterThan(0);
    expect(
      pedidos.some((p) => /WaflApp/.test(p)),
      'tendría que cargar WAFL',
    ).toBe(true);
    expect(
      pedidos.filter((p) => /WafaApp/.test(p)),
      'bajó el código de WAFA',
    ).toEqual([]);
  });

  test('y entrar como administrador no descarga el scoring', async ({ page }) => {
    const pedidos = await jsPedidos(page, '/app/wafa');

    expect(
      pedidos.some((p) => /WafaApp/.test(p)),
      'tendría que cargar WAFA',
    ).toBe(true);
    expect(
      pedidos.filter((p) => /WaflApp/.test(p)),
      'bajó el código de WAFL',
    ).toEqual([]);
  });

  test('la pantalla de elegir rol no baja ninguna de las dos', async ({ page }) => {
    const pedidos = await jsPedidos(page, '/app/');

    expect(pedidos.filter((p) => /Waf[al]App/.test(p))).toEqual([]);
  });
});

// ── P-4 · Caché ──────────────────────────────────────────────────────────────

test.describe('política de caché', () => {
  test('los assets con hash son inmutables y lo que cambia se revalida', async ({
    page,
    request,
  }) => {
    const pedidos = await jsPedidos(page, '/app/wafl');
    const asset = pedidos.find((p) => /index-/.test(p));
    if (!asset) throw new Error('no se pidió el chunk principal');

    expect((await request.get(asset)).headers()['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );

    // Si el service worker o el index se guardaran para siempre, una versión nueva
    // no llegaría nunca.
    for (const ruta of ['/app/', '/app/sw.js', '/app/manifest.webmanifest']) {
      expect((await request.get(ruta)).headers()['cache-control'], ruta).toBe('no-cache');
    }
  });
});

// ── P-3 · Compresión ─────────────────────────────────────────────────────────

test.describe('compresión', () => {
  test('el JS de la PWA se entrega en brotli, y pesa mucho menos', async ({ page, request }) => {
    const pedidos = await jsPedidos(page, '/app/wafl');
    const asset = pedidos.find((p) => /index-/.test(p));
    if (!asset) throw new Error('no se pidió el chunk principal');

    const comprimido = await request.get(asset, { headers: { 'accept-encoding': 'br' } });
    const plano = await request.get(asset, { headers: { 'accept-encoding': 'identity' } });

    expect(comprimido.headers()['content-encoding']).toBe('br');
    expect(plano.headers()['content-encoding']).toBeUndefined();
    // Ambos pedidos llegan descomprimidos al test: lo que se compara es lo que
    // viajó por la red (`content-length`).
    expect(Number(comprimido.headers()['content-length'])).toBeLessThan(
      Number(plano.headers()['content-length']) / 2,
    );
  });
});

// ── U-4 · Íconos, manifest y logos sin señal ─────────────────────────────────

test.describe('instalación', () => {
  test('el manifest declara PNG 192 y 512, y un maskable aparte', async ({ page, request }) => {
    await page.goto('/app/');
    const href = await page.getAttribute('link[rel=manifest]', 'href');
    const manifest = (await (await request.get(href ?? '')).json()) as {
      theme_color: string;
      icons: { src: string; sizes: string; type: string; purpose?: string }[];
    };

    const png = manifest.icons.filter((i) => i.type === 'image/png');
    const tamanos = (proposito: string) =>
      png.filter((i) => (i.purpose ?? 'any') === proposito).map((i) => i.sizes);

    // Android e iOS esperan PNG: un SVG solo no alcanza para instalar con ícono propio.
    expect(tamanos('any')).toEqual(expect.arrayContaining(['192x192', '512x512']));
    // Y el maskable va aparte: con `any maskable` en el mismo, Android lo recorta
    // sin zona segura y se come el borde del logo.
    expect(tamanos('maskable').length).toBeGreaterThan(0);
    expect(manifest.icons.filter((i) => i.purpose === 'any maskable')).toEqual([]);

    // Y existen de verdad (un 200 con HTML de la SPA no es un ícono).
    for (const icono of png) {
      const res = await request.get(icono.src);
      expect(res.status(), icono.src).toBe(200);
      expect(res.headers()['content-type'], icono.src).toMatch('image/png');
    }
  });

  test('el apple-touch-icon está enlazado y se sirve', async ({ page, request }) => {
    await page.goto('/app/');
    // Sin `await` al atributo de un elemento que no existe: Playwright espera 5 minutos.
    const enlace = page.locator('link[rel=apple-touch-icon]');
    await expect(enlace).toHaveCount(1);
    const href = await enlace.getAttribute('href');

    const res = await request.get(href ?? '');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch('image/png');
  });

  // Barra del sistema de un color y manifest de otro: la app instalada y la pestaña
  // se ven como dos productos distintos.
  test('theme_color del manifest coincide con el de la página', async ({ page, request }) => {
    await page.goto('/app/');
    const href = await page.getAttribute('link[rel=manifest]', 'href');
    const manifest = (await (await request.get(href ?? '')).json()) as { theme_color: string };
    const meta = await page.getAttribute('meta[name=theme-color]', 'content');

    expect(manifest.theme_color.toLowerCase()).toBe(meta?.toLowerCase());
  });

  /**
   * `cba.webp` pesa 18 KB, por encima del límite de inline de Vite, y lo usan el
   * login de WAFL y el pie, que está **siempre visible**. `globPatterns` no
   * incluía `webp`: sin señal, el logo se veía roto.
   */
  test('sin conexión, todas las imágenes del login de WAFL se ven', async ({ browser }) => {
    const contexto = await browser.newContext();
    const page = await contexto.newPage();

    await page.goto('/app/wafl');
    // Que el service worker esté instalado y controle la página.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    await contexto.setOffline(true);
    await contexto.route('**/api/**', (ruta) => ruta.abort());
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const imagenes = page.locator('img');
    await expect(imagenes.first()).toBeVisible();

    const rotas = await imagenes.evaluateAll((todas) =>
      (todas as HTMLImageElement[])
        .filter((i) => !i.complete || i.naturalWidth === 0)
        .map((i) => i.currentSrc || i.src),
    );
    expect(rotas, 'imágenes que no cargan sin conexión').toEqual([]);

    await contexto.close();
  });
});

// ── S-8 · Nada de la API en el caché del service worker ──────────────────────

/**
 * `runtimeCaching` usaba `/^\/api\/…/` y Workbox lo evalúa contra la URL completa,
 * así que nunca matcheaba: hoy no hacía nada. Si alguien lo «arreglaba», guardaba
 * 24 h las respuestas de `/api/admin/*` —con los PIN en claro— y el logout no las
 * limpiaba. WAFL lee de IndexedDB y WAFA es online por diseño: no hay nada que
 * cachear.
 */
test('el service worker no tiene ninguna regla de caché para la API', async ({ request }) => {
  const sw = await (await request.get('/app/sw.js')).text();

  expect(sw).not.toMatch(/api-cache/);
  expect(sw).not.toMatch(/NetworkFirst/);
});
