import { expect, test } from '@playwright/test';
import { adminApi, entrarComoLider, PASSWORD_NUEVO, torneoIniciado } from './ayudas.js';

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

/**
 * **El teclado de scoring, medido en 56 px.**
 *
 * `DESIGN_SYSTEM.md` §5 lo llama «la regla que manda»: 56 px no es un número
 * redondo elegido al azar, es lo que hace falta para acertar con guante de tiro,
 * caminando, sin mirar de cerca. *«Si un componente no llega, se rediseña el
 * componente, no se baja el número.»*
 *
 * Hasta ahora el número vivía en una clase de Tailwind y nadie lo comprobaba
 * contra la pantalla.
 */
test('las teclas del scoring miden 56 px', async ({ page, request }) => {
  const api = await adminApi(request);
  const { tournamentId, patrols } = await torneoIniciado(api, { nombre: 'teclas' });

  const lider = patrols[0];
  if (!lider) throw new Error('el torneo no dejó patrullas');

  await page.setViewportSize(CELULAR);
  await entrarComoLider(page, tournamentId, 'teclas', lider.username, lider.pin);

  // Al primer blanco del recorrido, que es donde vive el teclado.
  await page.getByTestId('numero-blanco').first().click();
  await expect(page.getByRole('button', { name: /^Puntaje / }).first()).toBeVisible();

  const teclasChicas = await page.evaluate(() => {
    const teclas = [...document.querySelectorAll<HTMLElement>('button[aria-label^="Puntaje "]')];

    return teclas
      .map((t) => ({ caja: t.getBoundingClientRect(), nombre: t.getAttribute('aria-label') ?? '' }))
      .filter(({ caja }) => caja.width > 0 && caja.height > 0)
      .filter(({ caja }) => caja.height < 56 || caja.width < 56)
      .map(({ caja, nombre }) => `${nombre}: ${Math.round(caja.width)}×${Math.round(caja.height)}`);
  });

  expect(teclasChicas, 'hay teclas por debajo de los 56 px de la regla 9').toEqual([]);
});

/**
 * **Contraste AAA en la pantalla de scoring.**
 *
 * §2.4: mínimo AA en todo texto, **AAA (7:1) en la pantalla de scoring y en los
 * números de puntaje** — es la que se lee bajo el sol.
 *
 * Se calcula sobre los colores **computados**, que es la única forma de saber
 * qué salió: los tokens se combinan en tiempo de ejecución y un par que nadie
 * verificó puede quedar por debajo sin que ningún test lo note.
 */
test('el scoring cumple AAA de contraste', async ({ page, request }) => {
  const api = await adminApi(request);
  const { tournamentId, patrols } = await torneoIniciado(api, { nombre: 'contraste' });

  const lider = patrols[0];
  if (!lider) throw new Error('el torneo no dejó patrullas');

  await page.setViewportSize(CELULAR);
  await entrarComoLider(page, tournamentId, 'contraste', lider.username, lider.pin);
  await page.getByTestId('numero-blanco').first().click();
  await expect(page.getByRole('button', { name: /^Puntaje / }).first()).toBeVisible();

  const flojos = await page.evaluate(() => {
    /** Luminancia relativa, según la definición de WCAG. */
    const luminancia = (rgb: number[]): number => {
      const [r = 0, g = 0, b = 0] = rgb.map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const leerRgb = (color: string): number[] =>
      (color.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);

    /** El primer ancestro con fondo opaco: el que de verdad se ve detrás. */
    const fondoDe = (e: Element): number[] => {
      let actual: Element | null = e;
      while (actual) {
        const c = getComputedStyle(actual).backgroundColor;
        const rgb = leerRgb(c);
        const opaco = !c.includes('rgba') || !/,\s*0\s*\)/.test(c);
        if (rgb.length === 3 && opaco) return rgb;
        actual = actual.parentElement;
      }
      return [255, 255, 255];
    };

    const razon = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

    return [...document.querySelectorAll<HTMLElement>('button[aria-label^="Puntaje "]')]
      .map((e) => {
        const estilo = getComputedStyle(e);
        const r = razon(luminancia(leerRgb(estilo.color)), luminancia(fondoDe(e)));
        return { nombre: e.getAttribute('aria-label') ?? '', razon: Math.round(r * 100) / 100 };
      })
      .filter((x) => x.razon < 7)
      .map((x) => `${x.nombre}: ${x.razon}:1`);
  });

  expect(flojos, 'hay texto del scoring por debajo de AAA (7:1)').toEqual([]);
});
