// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Reglas globales de `tokens.css` que salieron de la revisión con las guías de interfaz
 * (`REF7-12`). Se leen del CSS que compila, como `contraste.test.ts`.
 */

const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

describe('los controles', () => {
  /**
   * En iOS, dos toques rápidos sobre el mismo botón se pueden leer como zoom. En el teclado de
   * scoring eso es cargar «10, 10» y que la pantalla se agrande en vez de anotar la segunda.
   */
  it('no esperan un doble toque para hacer zoom', () => {
    const regla = css.match(/:where\(a, button,[^)]*\)\s*\{([^}]+)\}/)?.[1] ?? '';
    expect(regla).toMatch(/touch-action:\s*manipulation/);
  });
});

describe('los títulos', () => {
  /** Sin viudas: el titular del hero y los de sección reparten las palabras entre renglones. */
  it('reparten el texto entre renglones', () => {
    const regla = css.match(/:where\(h1, h2, h3\)\s*\{([^}]+)\}/)?.[1] ?? '';
    expect(regla).toMatch(/text-wrap:\s*balance/);
  });
});
