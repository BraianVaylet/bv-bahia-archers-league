// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * El contraste de cada par de tokens que la interfaz usa junto, en los dos temas (`REF7-2`).
 *
 * Es la tabla de `docs/post/ref-7/DISENO.md` §2.3, convertida en test. Cuatro pares estaban por
 * debajo de WCAG y nadie lo sabía, porque ningún test los miraba:
 *
 * - `A-1` · el anillo de foco (`--nock` sobre `--bg`) daba **2.59:1** en claro. `tokens.css` decía
 *   que no se aclaraba el verde «para no empeorar el foco», pero el foco ya estaba por debajo.
 * - `A-2` · el borde de los controles (`--line`) daba **1.3:1**: un input sin borde visible.
 * - `A-3` · el blanco sobre `--danger` en oscuro daba **≈3:1**.
 * - `A-4` · el badge «Completado, sin publicar» (`--bg` sobre `--nock`) daba **2.59:1** en claro.
 *
 * Se leen los valores de `tokens.css`, como en `accion-primaria.test.ts`: una constante en
 * TypeScript que dice lo correcto no prueba que la hoja de estilos diga lo mismo.
 */

const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

type Tema = 'claro' | 'oscuro';

/**
 * Los tokens de color de cada tema. El oscuro hereda lo que no redefine (las estacas, por ejemplo),
 * igual que en el navegador.
 */
function tokensPorTema(): Record<Tema, Record<string, string>> {
  const claro: Record<string, string> = {};
  const oscuro: Record<string, string> = {};

  for (const [, selector, cuerpo] of css.matchAll(
    /(:root(?:\[data-theme='dark'\])?)\s*\{([^}]*)\}/g,
  )) {
    const destino = selector === ':root' ? claro : oscuro;
    for (const [, nombre, valor] of (cuerpo ?? '').matchAll(
      /--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi,
    )) {
      destino[nombre as string] = (valor as string).toLowerCase();
    }
  }
  return { claro, oscuro: { ...claro, ...oscuro } };
}

function luminancia(hex: string): number {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((i) => Number.parseInt(n.slice(i, i + 2), 16) / 255)
    .map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (claro + 0.05) / (oscuro + 0.05);
}

/** Los mínimos de WCAG 2: texto (1.4.3), y bordes, foco y marcas (1.4.11 y 2.4.11). */
const TEXTO = 4.5;
const NO_TEXTO = 3;
/** §2.4 de `DESIGN_SYSTEM.md`: AAA en la pantalla de scoring. */
const SCORING = 7;

const SUPERFICIES = ['bg', 'surface', 'surface-2'] as const;

/** `[primer plano, fondo, mínimo, para qué]`. */
type Par = readonly [string, string, number, string];

const sobreSuperficies = (token: string, minimo: number, uso: string): Par[] =>
  SUPERFICIES.map((s) => [token, s, minimo, uso] as const);

const PARES: readonly Par[] = [
  ...sobreSuperficies('ink', SCORING, 'texto'),
  ...sobreSuperficies('ink-muted', TEXTO, 'texto secundario'),
  ['nock-ink', 'nock', SCORING, 'botón primario y tecla del inner'],
  ...sobreSuperficies('nock-text', TEXTO, 'el verde que se lee: enlaces, nav activa'),
  ['nock-text', 'nock-soft', TEXTO, 'enlace sobre la selección'],
  ['ink', 'nock-soft', TEXTO, 'pestaña activa y posiciones 1–3'],
  ...sobreSuperficies('focus-ring', NO_TEXTO, 'anillo de foco (A-1)'),
  ...sobreSuperficies('line-strong', NO_TEXTO, 'borde de un control (A-2)'),
  ['danger-ink', 'danger', TEXTO, 'botón de peligro (A-3)'],
  ['monte-ink', 'monte', TEXTO, 'texto sobre la banda monte'],
  ['monte-muted', 'monte', TEXTO, 'texto secundario sobre monte'],
  ['monte-accent', 'monte', NO_TEXTO, 'palabra destacada y anillo sobre monte'],
  ['monte-ink', 'monte-2', TEXTO, 'badge sobre monte'],
  // Los puntos de `BadgeEstado` (`REF7-4`): una marca, no texto.
  ...['ink-muted', 'nock-text', 'warn', 'ok'].flatMap((t) =>
    sobreSuperficies(t, NO_TEXTO, 'punto de estado'),
  ),
  // El texto de `SyncBadge` y de los errores de un campo, sobre el fondo y las tarjetas.
  ...['ok', 'warn', 'danger'].flatMap((t) =>
    (['bg', 'surface'] as const).map((s) => [t, s, TEXTO, 'texto de estado'] as const),
  ),
];

const tokens = tokensPorTema();

describe('contraste de los tokens (DISENO.md §2.3)', () => {
  const necesarios = [...new Set(PARES.flatMap((par) => par.slice(0, 2) as string[]))];

  it.each(['claro', 'oscuro'] as const)(
    'el tema %s define todos los tokens de la tabla',
    (tema) => {
      const faltan = necesarios.filter((t) => !tokens[tema][t]);
      expect(faltan).toEqual([]);
    },
  );

  describe.each(['claro', 'oscuro'] as const)('tema %s', (tema) => {
    it.each(PARES.map(([a, b, min, uso]) => [`${a} / ${b} ≥ ${min} · ${uso}`, a, b, min] as const))(
      '%s',
      (_nombre, frente, fondo, minimo) => {
        const a = tokens[tema][frente] ?? '';
        const b = tokens[tema][fondo] ?? '';

        expect(contraste(a, b), `${frente} ${a} sobre ${fondo} ${b}`).toBeGreaterThanOrEqual(
          minimo,
        );
      },
    );
  });
});

describe('el anillo de foco', () => {
  const foco = css.match(/:focus-visible\s*\{([^}]+)\}/)?.[1] ?? '';

  it('usa --focus-ring, no --nock (2.59:1 sobre el fondo claro)', () => {
    expect(foco).toMatch(/outline:\s*3px solid var\(--focus-ring\)/);
    expect(foco).not.toMatch(/var\(--nock\)/);
  });
});

describe('las sombras', () => {
  it.each(['shadow-dock', 'shadow-float'])('--%s está en los dos temas', (sombra) => {
    expect(css.match(new RegExp(`--${sombra}:`, 'g')) ?? []).toHaveLength(2);
  });
});
