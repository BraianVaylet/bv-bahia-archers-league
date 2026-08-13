import { describe, expect, it } from 'vitest';
import { CATEGORY_INFO, SCORING } from '../src/constants.js';
import { BOW_CATEGORIES, MODALITIES, TOURNAMENT_STATUSES } from '../src/domain.js';
import { ESTADO_DE_TORNEO } from '../src/estados.js';
import {
  COLOR_DE_CATEGORIA,
  COLOR_DE_MODALIDAD,
  type ParDeColor,
  TONOS_DE_ESTACA,
} from '../src/paleta.js';

/**
 * La paleta de categorías y modalidades (REF2-1).
 *
 * Dos cosas se comprueban acá, y ninguna es estética:
 *
 * 1. **Contraste AA.** La app se usa al sol. Un color que no llega a 4.5:1 no
 *    se lee, y no se lee en el peor momento posible.
 * 2. **Que ninguno se parezca a una estaca.** Es la regla 8 de `CLAUDE.md`. Un
 *    chip de categoría que tira a rojo hace dudar de si está diciendo «roja».
 */

// ── Utilidades de color ──────────────────────────────────────────────────────

function aRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminancia relativa de WCAG 2.1. */
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

/** Tono en grados y saturación 0-1, del espacio HSL. */
function hsl(hex: string): { tono: number; sat: number } {
  const [r, g, b] = aRgb(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  if (d === 0) return { tono: 0, sat: 0 };

  const l = (max + min) / 2;
  const sat = d / (1 - Math.abs(2 * l - 1));

  const tono = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;

  return { tono: (((tono * 60) % 360) + 360) % 360, sat };
}

/** Distancia angular entre dos tonos, siempre 0-180. */
function distanciaDeTono(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Los dos fondos de `tokens.css`. */
const FONDO = { claro: '#fbfaf5', oscuro: '#16170f' } as const;

const TODOS: [string, ParDeColor][] = [
  ...Object.entries(COLOR_DE_CATEGORIA).map(
    ([k, v]) => [`categoría ${k}`, v] as [string, ParDeColor],
  ),
  ...Object.entries(COLOR_DE_MODALIDAD).map(
    ([k, v]) => [`modalidad ${k}`, v] as [string, ParDeColor],
  ),
];

// ── Cobertura ────────────────────────────────────────────────────────────────

describe('cobertura de los catálogos', () => {
  /**
   * El typecheck ya obliga a que el `Record` esté completo. Esto cubre lo otro:
   * que las claves sean **las mismas** que las del catálogo del reglamento, y
   * no un conjunto paralelo que se fue separando.
   */
  it('hay un color por cada categoría del reglamento', () => {
    expect(Object.keys(COLOR_DE_CATEGORIA).sort()).toEqual([...BOW_CATEGORIES].sort());
    expect(Object.keys(COLOR_DE_CATEGORIA).sort()).toEqual(Object.keys(CATEGORY_INFO).sort());
  });

  it('hay un color por cada modalidad', () => {
    expect(Object.keys(COLOR_DE_MODALIDAD).sort()).toEqual([...MODALITIES].sort());
    expect(Object.keys(COLOR_DE_MODALIDAD).sort()).toEqual(Object.keys(SCORING).sort());
  });

  it('hay una etiqueta por cada estado de torneo', () => {
    expect(Object.keys(ESTADO_DE_TORNEO).sort()).toEqual([...TOURNAMENT_STATUSES].sort());
  });

  // El texto del admin nunca falta; el del público puede no existir a propósito.
  it('cada estado tiene texto de admin, plural, vacío y color', () => {
    for (const info of Object.values(ESTADO_DE_TORNEO)) {
      expect(info.label.length, info.key).toBeGreaterThan(0);
      expect(info.plural.length, info.key).toBeGreaterThan(0);
      expect(info.vacio.length, info.key).toBeGreaterThan(0);
      expect(info.color, info.key).toMatch(/^var\(--[a-z-]+\)$/);
    }
  });
});

// ── Contraste ────────────────────────────────────────────────────────────────

describe('contraste', () => {
  it.each(TODOS)('%s llega a AA en tema claro', (_nombre, par) => {
    expect(contraste(par.claro, FONDO.claro)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(TODOS)('%s llega a AA en tema oscuro', (_nombre, par) => {
    expect(contraste(par.oscuro, FONDO.oscuro)).toBeGreaterThanOrEqual(4.5);
  });
});

// ── Regla 8 ──────────────────────────────────────────────────────────────────

describe('regla 8: los tonos de estaca no se usan para otra cosa', () => {
  /**
   * Un color se confunde con una estaca cuando está **cerca en tono Y es
   * saturado**. Un tierra apagado no se lee como «roja» aunque su tono esté a
   * 20 grados del rojo; un rojo vivo sí.
   */
  it.each(TODOS)('%s no se confunde con una estaca', (nombre, par) => {
    for (const tema of ['claro', 'oscuro'] as const) {
      const color = hsl(par[tema]);

      for (const estaca of TONOS_DE_ESTACA) {
        const cerca = distanciaDeTono(color.tono, hsl(estaca).tono) < 25;
        const vivo = color.sat > 0.6;

        expect(
          cerca && vivo,
          `${nombre} en ${tema} (${par[tema]}) está a ${Math.round(
            distanciaDeTono(color.tono, hsl(estaca).tono),
          )}° de ${estaca} con saturación ${color.sat.toFixed(2)}`,
        ).toBe(false);
      }
    }
  });
});
