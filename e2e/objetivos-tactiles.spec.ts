import { expect, test } from '@playwright/test';
import { adminApi, PASSWORD_NUEVO, torneoIniciado } from './ayudas.js';

/**
 * Los objetivos táctiles, **medidos**.
 *
 * `DESIGN_SYSTEM.md` §5 los llama «la regla que manda»: 56 px en el teclado de
 * scoring, 44 px en todo lo demás, y *«si un componente no llega, se rediseña el
 * componente, no se baja el número»*.
 *
 * §11 pide medirlos **sobre estilos computados, no a ojo**, y hasta ahora nadie
 * lo hacía: un `min-h-[44px]` escrito en el código no prueba que el elemento
 * mida 44 en la pantalla — un contenedor con `overflow`, un `flex` que encoge o
 * una clase que le gana por orden lo dejan más chico sin que nada avise.
 *
 * Se mide en un navegador de verdad porque jsdom no hace layout: ahí todo mide
 * cero y el test pasaría siempre.
 */

const MINIMO = 44;

/** Un celular chico: es donde el espacio aprieta y algo puede encogerse. */
const CELULAR = { width: 360, height: 740 };

interface Chico {
  readonly etiqueta: string;
  readonly alto: number;
  readonly ancho: number;
}

/**
 * Todo lo que se toca y no llega al mínimo.
 *
 * Se saltean los que **no se ven**: un control dentro de un `details` cerrado,
 * o de una rama que no está montada, mide cero y no es un defecto. Lo que
 * importa es lo que el dedo puede alcanzar.
 */
async function demasiadoChicos(pagina: import('@playwright/test').Page): Promise<Chico[]> {
  return pagina.evaluate((minimo) => {
    const tocables = [
      ...document.querySelectorAll<HTMLElement>(
        'button, a[href], input:not([type=hidden]), select, textarea, [role=button]',
      ),
    ];

    /**
     * Lo que el dedo toca de verdad.
     *
     * Un checkbox de 20 px dentro de un `<label>` de 44 **no es un objetivo de
     * 20**: tocar cualquier punto del label activa el control. Medir el `input`
     * marcaría como defecto un patrón que está bien.
     */
    const objetivo = (e: HTMLElement): HTMLElement => e.closest('label') ?? e;

    return tocables
      .map(objetivo)
      .filter((e) => {
        const caja = e.getBoundingClientRect();
        // Invisible o no montado: no hay nada que tocar.
        return caja.width > 0 && caja.height > 0;
      })
      .filter((e) => {
        const caja = e.getBoundingClientRect();
        return caja.height < minimo || caja.width < minimo;
      })
      .map((e) => {
        const caja = e.getBoundingClientRect();
        const texto = (e.textContent ?? '').trim().slice(0, 30);
        const nombre = e.getAttribute('aria-label') ?? texto ?? e.tagName;
        return {
          etiqueta: `${e.tagName.toLowerCase()} «${nombre}»`,
          alto: Math.round(caja.height),
          ancho: Math.round(caja.width),
        };
      });
  }, MINIMO);
}

test('en WAFA nada tocable baja de 44 px', async ({ page, request }) => {
  const api = await adminApi(request);
  const { tournamentId } = await torneoIniciado(api, { nombre: 'objetivos tactiles' });

  await page.setViewportSize(CELULAR);

  await page.goto('/app/wafa');
  await page.getByLabel('Usuario').fill('admin');
  await page.getByLabel('Password').fill(PASSWORD_NUEVO);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Crear torneo')).toBeVisible();

  /**
   * Las pantallas con listas largas y con acciones por fila, que son donde el
   * ancho aprieta y algo se encoge.
   */
  const pantallas = [
    '/app/wafa',
    '/app/wafa/arqueros',
    '/app/wafa/temporadas',
    '/app/wafa/ranking',
    `/app/wafa/torneos/${tournamentId}`,
    `/app/wafa/torneos/${tournamentId}/pagos`,
  ];

  for (const ruta of pantallas) {
    await page.goto(ruta);
    await page.waitForLoadState('networkidle');

    const chicos = await demasiadoChicos(page);
    expect(chicos, `${ruta} tiene objetivos táctiles por debajo de ${MINIMO} px`).toEqual([]);
  }
});

/**
 * El anillo de foco existe **en la pantalla**, no sólo en el CSS.
 *
 * `DESIGN_SYSTEM.md` §10 lo declara: *«foco visible global: `:focus-visible`
 * con anillo de 3px en `--nock`, con desplazamiento»*, y §11 pide navegación
 * completa por teclado — importante para el admin, que usa notebook.
 *
 * Una regla escrita en `tokens.css` no prueba que llegue al elemento: puede
 * quedar tapada por un `outline: none` de un reset, o por una utilidad que gane
 * por orden. Se lee el estilo **computado** después de tabular de verdad.
 */
test('el foco se ve al navegar con teclado', async ({ page, request }) => {
  await adminApi(request);

  await page.goto('/app/wafa');
  await page.getByLabel('Usuario').fill('admin');
  await page.getByLabel('Password').fill(PASSWORD_NUEVO);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Crear torneo')).toBeVisible();

  // Tabular, no enfocar por API: `:focus-visible` distingue el teclado del
  // mouse, y un `focus()` programático puede no activarlo.
  await page.keyboard.press('Tab');

  const foco = await page.evaluate(() => {
    const activo = document.activeElement;
    if (!activo || activo === document.body) return null;

    const estilo = getComputedStyle(activo);
    return {
      etiqueta: activo.tagName.toLowerCase(),
      ancho: estilo.outlineWidth,
      estilo: estilo.outlineStyle,
    };
  });

  expect(foco, 'tabular no dejó el foco en ningún elemento').not.toBeNull();
  expect(foco?.estilo, 'el elemento enfocado no dibuja contorno').not.toBe('none');
  expect(
    Number.parseFloat(foco?.ancho ?? '0'),
    'el anillo de foco es más fino que los 3px que declara el sistema',
  ).toBeGreaterThanOrEqual(3);
});
