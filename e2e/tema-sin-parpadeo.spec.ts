import { expect, test } from '@playwright/test';

/**
 * El tema oscuro se aplica **antes** de que React pinte, y sin violar la CSP.
 *
 * El script anti-FOUC estaba **inline** en los dos `index.html`, y la CSP de
 * producción es `script-src 'self'` sin `'unsafe-inline'` ni hashes (a propósito:
 * ver `docs/SECURITY.md` §10). El navegador lo bloqueaba y la consola se llenaba
 * de violaciones, pero nada fallaba: quien usa el tema oscuro veía la pantalla
 * en claro y el salto a oscuro cuando React montaba — el parpadeo que el script
 * existe para evitar. Ningún test miraba la CSP ni el orden de pintado.
 *
 * Se prueba contra el stack de producción (`e2e/servidor.ts`), que es el que
 * sirve la CSP real. En `pnpm dev` no hay CSP y el problema no se ve.
 *
 * Ver `docs/DESIGN_SYSTEM.md` §9 · `docs/post/ref-6` (`REF6-3` / `U-1`).
 */

const PAGINAS = ['/', '/app/', '/app/wafl', '/app/wafa'] as const;

/**
 * Instrumenta la página **antes** de que corra cualquier script suyo.
 *
 * Anota, en orden, dos hechos: cuándo se escribió `data-theme` y cuándo React
 * puso su primer hijo en `#root`. Que el tema vaya primero es lo que significa
 * «antes del primer pintado». Y junta toda violación de la CSP.
 */
const INSTRUMENTAR = `
  window.__orden = [];
  window.__violaciones = [];

  document.addEventListener('securitypolicyviolation', (e) => {
    // Dónde ocurrió, no sólo qué directiva: una violación sin archivo ni línea
    // obliga a adivinar quién la causó.
    window.__violaciones.push(
      e.violatedDirective + ' → ' + (e.blockedURI || 'inline') +
        ' en ' + (e.sourceFile || '?') + ':' + e.lineNumber + ':' + e.columnNumber +
        (e.sample ? ' «' + e.sample.slice(0, 60) + '»' : ''),
    );
  });

  new MutationObserver((registros) => {
    for (const r of registros) {
      if (r.type === 'attributes' && r.attributeName === 'data-theme') {
        window.__orden.push('tema');
      }
      if (r.type === 'childList' && r.target.id === 'root' && r.addedNodes.length > 0) {
        window.__orden.push('react');
      }
    }
  }).observe(document, {
    attributes: true,
    attributeFilter: ['data-theme'],
    childList: true,
    subtree: true,
  });
`;

for (const ruta of PAGINAS) {
  test.describe(`${ruta}`, () => {
    test.beforeEach(async ({ page }) => {
      // Antes de navegar: el script del tema lee la preferencia de forma síncrona.
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.addInitScript(INSTRUMENTAR);
    });

    test('con el sistema en oscuro, el tema está puesto antes de que React pinte', async ({
      page,
    }) => {
      await page.goto(ruta);
      await page.waitForFunction(() => document.getElementById('root')?.childElementCount);

      const orden = await page.evaluate(() => (window as unknown as { __orden: string[] }).__orden);

      // «tema» primero. Si el script no corrió, el tema lo pone el botón de React
      // en un efecto — después de montar, con la pantalla ya pintada en claro.
      expect(orden[0], `orden de los hechos: ${orden.join(', ')}`).toBe('tema');
      expect(await page.getAttribute('html', 'data-theme')).toBe('dark');
    });

    test('no hay una sola violación de la CSP', async ({ page }) => {
      await page.goto(ruta);
      await page.waitForFunction(() => document.getElementById('root')?.childElementCount);

      const violaciones = await page.evaluate(
        () => (window as unknown as { __violaciones: string[] }).__violaciones,
      );

      expect(violaciones).toEqual([]);
    });
  });
}
