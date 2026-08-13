import { expect, test } from '@playwright/test';

/**
 * La PWA es instalable, y **no se actualiza sola**.
 *
 * `registerType: 'prompt'` es una de las diez reglas del proyecto: recargar la
 * app a mitad de recorrido es inaceptable. Un `autoUpdate` accidental reemplaza
 * el service worker mientras el líder anota, y eso no se puede dejar librado a
 * revisar un archivo de configuración a ojo.
 *
 * Ver `CLAUDE.md` regla 7 · `docs/TECHNICAL.md` §1 · `docs/TESTING.md` §6.
 */
test('el manifest tiene lo que hace falta para instalar', async ({ page, request }) => {
  await page.goto('/app/');

  const href = await page.getAttribute('link[rel=manifest]', 'href');
  expect(href).toBeTruthy();

  const res = await request.get(new URL(href ?? '', page.url()).pathname);
  expect(res.ok()).toBe(true);

  const manifest = (await res.json()) as {
    name?: string;
    short_name?: string;
    start_url?: string;
    display?: string;
    icons?: { sizes: string; src: string; purpose?: string }[];
  };

  expect(manifest.name).toBeTruthy();
  expect(manifest.short_name).toBeTruthy();
  expect(manifest.start_url).toBeTruthy();

  // `standalone` o `fullscreen`: en una pestaña con barra de direcciones se
  // pierde alto de pantalla, que es justo lo que le falta al teclado.
  expect(['standalone', 'fullscreen']).toContain(manifest.display);

  /**
   * Un ícono que el instalador acepte.
   *
   * Chrome pide un maskable de al menos 192px, y toma un SVG con `sizes: "any"`
   * como cualquier tamaño. Se aceptan las dos formas en vez de exigir un 512
   * raster: el proyecto usa SVG, y sumar un PNG grande al bundle de la PWA por
   * una regla que no aplica sería pagar peso a cambio de nada.
   */
  const iconos = manifest.icons ?? [];
  expect(iconos.length).toBeGreaterThan(0);

  const sirveParaInstalar = iconos.some(
    (i) => i.sizes === 'any' || Number.parseInt(i.sizes, 10) >= 192,
  );
  expect(sirveParaInstalar).toBe(true);

  // Maskable: sin esto Android recorta el ícono con un cuadrado blanco detrás.
  expect(iconos.some((i) => (i.purpose ?? '').includes('maskable'))).toBe(true);
});

test('el service worker se registra y responde', async ({ page }) => {
  await page.goto('/app/');

  const registrado = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    return reg !== undefined;
  });

  expect(registrado).toBe(true);
});

/**
 * El service worker generado **no toma el control solo**.
 *
 * Se lee el archivo servido y no la configuración: que `vite.config.ts` diga
 * `prompt` no prueba que lo generado se comporte así — es la misma lección del
 * `.env` que nadie cargaba y del CSS que la PWA nunca importó.
 */
test('el service worker NO se auto-actualiza a mitad de recorrido', async ({ request }) => {
  const sw = await request.get('/app/sw.js');
  expect(sw.ok()).toBe(true);

  const codigo = await sw.text();

  /**
   * `skipWaiting()` **sí** está, y tiene que estar: es lo que corre cuando el
   * usuario acepta el aviso de actualización. Lo que no puede pasar es que
   * corra solo.
   *
   * Así que se verifica que esté **detrás del mensaje** `SKIP_WAITING` que
   * manda la página, no suelto en `install` o `activate`. La primera versión de
   * este test prohibía `skipWaiting` a secas y fallaba contra un service worker
   * correcto.
   */
  expect(codigo).toMatch(/SKIP_WAITING/);
  expect(codigo).toMatch(/addEventListener\("message"/);

  // Y sin `clientsClaim()`: eso haría que el service worker nuevo tome las
  // pestañas abiertas sin preguntar, que es exactamente `autoUpdate`.
  expect(codigo).not.toMatch(/clientsClaim\s*\(\)/);

  // Y sí precachea: sin precache, sin señal no hay app que abrir.
  expect(codigo).toMatch(/precache/i);
});
