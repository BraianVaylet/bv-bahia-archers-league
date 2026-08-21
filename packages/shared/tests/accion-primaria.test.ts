import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * El contraste de la acción primaria, leído de `tokens.css` (`REF5-5`).
 *
 * **Este par no tenía test, y por eso derivó de lo que el documento decía.**
 * `DESIGN_SYSTEM.md` §2.1 afirmaba que en tema claro el verde *«se oscurece a
 * `#8FA800` para llegar a contraste AA»*. Con la tinta blanca que tenía al
 * lado, el par daba **2.70:1**: ni AA ni cerca.
 *
 * No era un detalle de una pantalla: `--nock` con `--nock-ink` es **todo botón
 * primario de las tres aplicaciones**, y el tema claro es el default de WAFL
 * porque es el que gana bajo el sol.
 *
 * Se exige **AAA (7:1)** y no AA, porque el par aparece en el teclado de
 * scoring — la tecla del inner— y §2.4 pide AAA ahí.
 *
 * Se leen los valores del **CSS que compila**, no de una copia en TypeScript:
 * una constante que dice lo correcto no prueba que la hoja de estilos diga lo
 * mismo. Es la misma razón por la que el test del tema lee los dos `index.html`.
 */

const TOKENS = new URL('../styles/tokens.css', import.meta.url);

function aRgb(hex: string): [number, number, number] {
  const n = hex.replace('#', '');
  return [0, 2, 4].map((i) => Number.parseInt(n.slice(i, i + 2), 16)) as [number, number, number];
}

function luminancia(hex: string): number {
  const [r, g, b] = aRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (claro + 0.05) / (oscuro + 0.05);
}

/**
 * Los valores de un token, en orden de aparición: primero el del tema claro,
 * después el del oscuro.
 */
function valoresDe(css: string, token: string): string[] {
  const encontrados = [...css.matchAll(new RegExp(`--${token}:\\s*(#[0-9a-f]{6})`, 'gi'))];
  return encontrados.map((m) => m[1] ?? '');
}

describe('la acción primaria', () => {
  const css = readFileSync(TOKENS, 'utf8');
  const verdes = valoresDe(css, 'nock');
  const tintas = valoresDe(css, 'nock-ink');

  it('define el par en los dos temas', () => {
    expect(verdes).toHaveLength(2);
    expect(tintas).toHaveLength(2);
  });

  it.each([
    ['claro', 0],
    ['oscuro', 1],
  ])('en tema %s llega a AAA', (_tema, i) => {
    const verde = verdes[i] ?? '';
    const tinta = tintas[i] ?? '';

    expect(contraste(tinta, verde), `${tinta} sobre ${verde}`).toBeGreaterThanOrEqual(7);
  });
});
