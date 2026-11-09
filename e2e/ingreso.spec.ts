import { expect, test } from '@playwright/test';

/**
 * De la landing a la PWA, por una sola puerta.
 *
 * La landing tenía dos accesos, uno por rol. Ahora tiene **«Ingresar»** y quién
 * sos lo pregunta la app, que ya tenía esa pantalla.
 *
 * Se prueba de punta a punta y no con un test de componente porque lo que
 * importa es justamente el cruce entre las dos aplicaciones: son dos builds
 * distintos, y acá —igual que en producción— los sirve un solo origen. Un test
 * de componente ve el `href` y no que del otro lado haya algo.
 *
 * Ver `docs/FUNCTIONAL.md` §5.1.
 */
test('«Ingresar» lleva de la landing a la PWA', async ({ page }) => {
  await page.goto('/');

  // `exact`: el pie también tiene «Ingresar a la app», y sin esto serían dos.
  await page.getByRole('link', { name: 'Ingresar', exact: true }).click();

  await expect(page).toHaveURL(/\/app\/?$/);

  // Y del otro lado está la elección de rol, que es lo que reemplaza a los dos
  // botones que había en la landing. Son enlaces, no botones —navegan a una
  // ruta distinta— y el `role` lo dice: `FE-21` los cambió de un `<button>`
  // anidado dentro de un `<a>` (HTML inválido) a un `<a>` con esa pinta.
  await expect(page.getByRole('link', { name: 'Soy líder de patrulla' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Soy administrador' })).toBeVisible();
});

/**
 * **El acceso por rol no vuelve por la ventana.** Si alguien repone un botón
 * «Administración» en la landing, vuelve el problema que se quiso sacar: dos
 * lugares donde mantener el nombre de cada rol, que ya se habían separado del
 * que usa la app.
 *
 * Hasta `REF7-4` esto contaba **un** enlace a `/app`. Con la decisión 2 de
 * `ref-7` «Ingresar» está en el encabezado y en el pie, así que lo que se exige
 * es lo que importaba: que todos sean «Ingresar» y ninguno nombre un rol.
 */
test('la landing no ofrece un acceso por rol', async ({ page }) => {
  await page.goto('/');

  const aLaApp = page.locator('a[href*="/app"]');
  await expect(aLaApp.first()).toBeVisible();

  for (const nombre of await aLaApp.allInnerTexts()) {
    expect(nombre.trim()).toMatch(/^Ingresar/);
    expect(nombre).not.toMatch(/líder|patrulla|administr/i);
  }
});
