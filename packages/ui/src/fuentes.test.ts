// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La carga de las fuentes (`REF7-1` / `D-1`).
 *
 * **Las fuentes nunca habían cargado.** `tokens.css` declaraba `'Archivo Expanded'`, `'Archivo'` y
 * `'Martian Mono'`, pero no había un solo `@font-face` en el repo: el navegador caía en
 * `system-ui` (Segoe UI en Windows, Roboto en Android) y nadie lo notó, porque una familia que
 * no existe no da error: da otra fuente.
 *
 * Y `'Archivo Expanded'` ni siquiera es una familia. Archivo es una fuente variable con eje de
 * ancho (`wdth`, 62–125): lo expandido es `font-stretch: 125%` sobre la misma familia.
 *
 * Se lee el CSS que compila y el CSS del paquete que lo declara: el nombre de la familia tiene que
 * coincidir **letra por letra** con el del `@font-face`, o se vuelve a caer en la del sistema.
 */

const RAIZ = process.cwd();
const PACKAGES = join(RAIZ, '..');
/** `tokens.css` sin comentarios: los comentarios nombran `@theme` y `@import` al explicarlos. */
const tokens = readFileSync(join(RAIZ, 'styles', 'tokens.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

const FUENTES = [
  { paquete: '@fontsource-variable/archivo', familia: 'Archivo Variable' },
  { paquete: '@fontsource-variable/martian-mono', familia: 'Martian Mono Variable' },
] as const;

/** El valor de un token de `@theme`, sin el `;`. */
function token(nombre: string): string {
  return tokens.match(new RegExp(`--${nombre}:\\s*([^;]+);`))?.[1]?.trim() ?? '';
}

describe('tokens.css importa las fuentes', () => {
  it.each(FUENTES)('$paquete, con el eje de ancho', ({ paquete }) => {
    expect(tokens).toContain(`@import '${paquete}/wdth.css';`);
  });

  it('los @import van antes de cualquier regla: después, el navegador los ignora', () => {
    const primerImport = tokens.indexOf('@import');
    const primeraRegla = tokens.indexOf('@theme');

    expect(primerImport).toBeGreaterThanOrEqual(0);
    expect(primerImport).toBeLessThan(primeraRegla);
  });

  it('ninguna familia es "Archivo Expanded", que no existe', () => {
    expect(tokens).not.toMatch(/Archivo Expanded/);
  });

  it('los tres tokens de familia usan las fuentes cargadas', () => {
    expect(token('font-display')).toMatch(/^'Archivo Variable',/);
    expect(token('font-sans')).toMatch(/^'Archivo Variable',/);
    expect(token('font-mono')).toMatch(/^'Martian Mono Variable',/);
  });

  /**
   * Un nombre largo en un título a 32px expandido no entra en un celular (`REF7-5`): un apellido
   * de 18 letras ya pasa los 328px útiles de una pantalla de 360. Sin esto, la página scrollea de
   * costado; antes lo tapaba el `main` con `overflow-y-auto`, que también recortaba en horizontal.
   */
  it('los títulos parten una palabra que no entra', () => {
    expect(tokens).toMatch(/:where\(h1, h2, h3\)\s*\{\s*overflow-wrap:\s*anywhere;/);
  });

  it('lo expandido es el eje de ancho de la misma familia', () => {
    const utilidad = tokens.match(/@utility font-display\s*\{([^}]+)\}/)?.[1] ?? '';

    expect(utilidad).toMatch(/font-family:\s*var\(--font-display\)/);
    expect(utilidad).toMatch(/font-stretch:\s*125%/);
    expect(utilidad).toMatch(/font-variation-settings:\s*'wdth' 125/);
  });
});

describe('los paquetes de fuentes', () => {
  const paquete = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };

  it.each(FUENTES)('$paquete es dependencia de @bal/ui, no de desarrollo', ({ paquete: p }) => {
    // Lo importa el CSS que compilan la PWA y la landing: tiene que viajar con el paquete.
    expect(paquete.dependencies?.[p]).toBeDefined();
  });

  it.each(FUENTES)('$paquete declara la familia "$familia"', ({ paquete: p, familia }) => {
    const css = join(RAIZ, 'node_modules', ...p.split('/'), 'wdth.css');

    expect(existsSync(css), css).toBe(true);
    expect(readFileSync(css, 'utf8')).toContain(`font-family: '${familia}'`);
  });
});

/** Todos los `.tsx` de una carpeta, recursivamente. */
function componentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory())
      return e.name === 'node_modules' || e.name === 'dist' ? [] : componentes(ruta);
    return e.name.endsWith('.tsx') ? [ruta] : [];
  });
}

describe('quien usa la tipografía display', () => {
  const archivos = ['app', 'landing', 'ui'].flatMap((p) => componentes(join(PACKAGES, p, 'src')));

  it('recorre archivos: no corre sobre una lista vacía', () => {
    expect(archivos.length).toBeGreaterThan(20);
  });

  /**
   * La clase vieja, el valor arbitrario con `var(--font-display)`, sólo cambia la familia y no el
   * ancho: con la fuente cargada, se vería Archivo normal y no la expandida. Además Tailwind 4 no
   * sabe si un valor arbitrario con `var()` es familia o peso. La utilidad `font-display` hace las
   * dos cosas. (Se arma por partes para que un reemplazo en masa no reescriba este test.)
   */
  const CLASE_VIEJA = ['font-[var(', '--font-display', ')]'].join('');

  it('nadie usa la familia display sin el ancho', () => {
    const conLaClaseVieja = archivos
      .filter((ruta) => readFileSync(ruta, 'utf8').includes(CLASE_VIEJA))
      .map((ruta) => ruta.split('packages')[1]);

    expect(conLaClaseVieja).toEqual([]);
  });

  /**
   * El mismo problema con el tamaño (`REF7-2`, hallado en `REF7-1`). Con un `var()` en un valor
   * arbitrario, `text-[…]` es ambiguo entre color y tamaño, y Tailwind 4 elige **color**: el
   * tamaño no se aplica. Los `h1` de las tres apps medían 16px y no 32. Cada token de la escala
   * genera su utilidad (`text-display`, `text-score`, `text-h2`…), que es lo que se usa.
   */
  const TAMAÑO_ARBITRARIO = ['text-[var(', '--text-'].join('');

  it('nadie pide un tamaño de la escala con un valor arbitrario', () => {
    const conTamañoArbitrario = archivos
      .filter((ruta) => readFileSync(ruta, 'utf8').includes(TAMAÑO_ARBITRARIO))
      .map((ruta) => ruta.split('packages')[1]);

    expect(conTamañoArbitrario).toEqual([]);
  });
});
