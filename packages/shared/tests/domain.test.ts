import { describe, expect, it } from 'vitest';
import {
  BOW_CATEGORIES,
  CATEGORY_INFO,
  DEFAULT_STAKE_MAP,
  DomainError,
  isEscuela,
  MAX_ARROWS_PER_TARGET,
  MIN_ARROWS_PER_TARGET,
  MISS_TOKEN,
  MODALITIES,
  SCORING,
  STAKES,
  stakeForCategory,
} from '../src/index';

/**
 * Catálogos de dominio (SH-1).
 *
 * La tabla normativa está en docs/DOMAIN_WA.md §1, §3 y §4. Estos tests son la
 * traducción literal de esa tabla: si alguno falla, o cambió el reglamento y
 * hay que actualizar el documento, o se rompió el catálogo.
 */

describe('modalidades', () => {
  it('son exactamente las cuatro del reglamento', () => {
    expect([...MODALITIES]).toEqual(['sala', 'aire_libre', 'campo', '3d']);
  });

  // docs/DOMAIN_WA.md §1 — tabla de modalidades.
  const tablaNormativa = [
    {
      key: 'sala',
      defaultArrows: 3,
      maxPerArrow: 10,
      scoringSet: ['X', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'M'],
      innerToken: 'X',
      tiebreakTokens: ['X', '10'],
      hasX: true,
    },
    {
      key: 'aire_libre',
      defaultArrows: 6,
      maxPerArrow: 10,
      scoringSet: ['X', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'M'],
      innerToken: 'X',
      tiebreakTokens: ['X', '10'],
      hasX: true,
    },
    {
      key: 'campo',
      defaultArrows: 3,
      maxPerArrow: 6,
      scoringSet: ['X6', '6', '5', '4', '3', '2', '1', 'M'],
      innerToken: 'X6',
      tiebreakTokens: ['X6', '6'],
      hasX: false,
    },
    {
      key: '3d',
      defaultArrows: 2,
      maxPerArrow: 11,
      scoringSet: ['11', '10', '8', '5', 'M'],
      innerToken: '11',
      tiebreakTokens: ['11', '10'],
      hasX: false,
    },
  ] as const;

  for (const esperado of tablaNormativa) {
    describe(esperado.key, () => {
      const cfg = SCORING[esperado.key];

      it('tiene las flechas por defecto del reglamento', () => {
        expect(cfg.defaultArrows).toBe(esperado.defaultArrows);
      });

      it('tiene el máximo por flecha del reglamento', () => {
        expect(cfg.maxPerArrow).toBe(esperado.maxPerArrow);
      });

      it('tiene el set de tokens en orden descendente', () => {
        expect([...cfg.scoringSet]).toEqual([...esperado.scoringSet]);
      });

      it('tiene el token inner y los de desempate', () => {
        expect(cfg.innerToken).toBe(esperado.innerToken);
        expect([...cfg.tiebreakTokens]).toEqual([...esperado.tiebreakTokens]);
      });

      it('declara si la modalidad usa X', () => {
        expect(cfg.hasX).toBe(esperado.hasX);
      });

      it('mapea un valor numérico para cada token del set, y solo para esos', () => {
        expect(Object.keys(cfg.values).sort()).toEqual([...cfg.scoringSet].sort());
      });

      it('el valor más alto del mapa coincide con maxPerArrow', () => {
        expect(Math.max(...Object.values(cfg.values))).toBe(cfg.maxPerArrow);
      });

      it('M vale 0 y es el último token del set', () => {
        expect(cfg.values[MISS_TOKEN]).toBe(0);
        expect(cfg.scoringSet.at(-1)).toBe(MISS_TOKEN);
      });

      it('el set está ordenado de mayor a menor valor', () => {
        const valores = cfg.scoringSet.map((t) => cfg.values[t] ?? Number.NaN);
        const ordenado = [...valores].sort((a, b) => b - a);
        expect(valores).toEqual(ordenado);
      });

      it('el token inner pertenece al set', () => {
        expect(cfg.scoringSet).toContain(cfg.innerToken);
      });
    });
  }

  it('X y X6 valen lo mismo que el token exterior de su anillo', () => {
    // X es un 10 que además cuenta para desempate; X6 es un 6.
    expect(SCORING.sala.values.X).toBe(10);
    expect(SCORING.aire_libre.values.X).toBe(10);
    expect(SCORING.campo.values.X6).toBe(6);
  });

  it('el 11 del 3D vale 11', () => {
    expect(SCORING['3d'].values['11']).toBe(11);
  });

  it('ninguna modalidad comparte el set completo con otra de distinto máximo', () => {
    // Guarda contra copiar y pegar mal una configuración.
    expect(SCORING.campo.scoringSet).not.toEqual(SCORING.sala.scoringSet);
    expect(SCORING['3d'].scoringSet).not.toEqual(SCORING.sala.scoringSet);
  });
});

describe('límites de flechas por blanco', () => {
  it('el rango configurable es de 1 a 12', () => {
    expect(MIN_ARROWS_PER_TARGET).toBe(1);
    expect(MAX_ARROWS_PER_TARGET).toBe(12);
  });

  it('las flechas por defecto de cada modalidad caen dentro del rango', () => {
    for (const key of MODALITIES) {
      const { defaultArrows } = SCORING[key];
      expect(defaultArrows).toBeGreaterThanOrEqual(MIN_ARROWS_PER_TARGET);
      expect(defaultArrows).toBeLessThanOrEqual(MAX_ARROWS_PER_TARGET);
    }
  });
});

describe('categorías de arco', () => {
  it('son exactamente las siete de la liga', () => {
    expect([...BOW_CATEGORIES]).toEqual([
      'recurvo',
      'compuesto',
      'cazador',
      'razo',
      'tradicional',
      'longbow',
      'escuela',
    ]);
  });

  it('cada categoría tiene etiqueta y orden', () => {
    for (const cat of BOW_CATEGORIES) {
      expect(CATEGORY_INFO[cat].label.length).toBeGreaterThan(0);
      expect(CATEGORY_INFO[cat].sort).toBeTypeOf('number');
    }
  });

  it('el orden es único y contiguo desde 1', () => {
    const ordenes = BOW_CATEGORIES.map((c) => CATEGORY_INFO[c].sort).sort((a, b) => a - b);
    expect(ordenes).toEqual(BOW_CATEGORIES.map((_, i) => i + 1));
  });

  it('escuela es la única categoría no senior', () => {
    const noSenior = BOW_CATEGORIES.filter((c) => isEscuela(c));
    expect(noSenior).toEqual(['escuela']);
  });
});

describe('estacas', () => {
  it('son exactamente roja, azul y amarilla', () => {
    expect([...STAKES]).toEqual(['roja', 'azul', 'amarilla']);
  });

  it('el mapeo por defecto es el del reglamento del club', () => {
    expect(DEFAULT_STAKE_MAP).toEqual({
      roja: ['recurvo', 'compuesto', 'cazador'],
      azul: ['razo', 'tradicional', 'longbow'],
      amarilla: ['escuela'],
    });
  });

  it('cada categoría aparece en exactamente una estaca', () => {
    const todas = STAKES.flatMap((s) => DEFAULT_STAKE_MAP[s]);
    expect(todas.length).toBe(BOW_CATEGORIES.length);
    expect(new Set(todas).size).toBe(BOW_CATEGORIES.length);
  });

  it('stakeForCategory resuelve la estaca de cada categoría', () => {
    expect(stakeForCategory('recurvo')).toBe('roja');
    expect(stakeForCategory('compuesto')).toBe('roja');
    expect(stakeForCategory('cazador')).toBe('roja');
    expect(stakeForCategory('razo')).toBe('azul');
    expect(stakeForCategory('tradicional')).toBe('azul');
    expect(stakeForCategory('longbow')).toBe('azul');
    expect(stakeForCategory('escuela')).toBe('amarilla');
  });

  it('stakeForCategory acepta un mapeo personalizado del torneo', () => {
    // El stakeMap es editable por torneo: DOMAIN_WA.md §4.
    const personalizado = {
      roja: ['recurvo'],
      azul: ['compuesto', 'cazador', 'razo', 'tradicional', 'longbow'],
      amarilla: ['escuela'],
    } as const;
    expect(stakeForCategory('compuesto', personalizado)).toBe('azul');
    expect(stakeForCategory('recurvo', personalizado)).toBe('roja');
  });

  it('stakeForCategory falla con error tipado si el mapeo no cubre la categoría', () => {
    const incompleto = { roja: ['recurvo'], azul: [], amarilla: [] } as const;

    expect(() => stakeForCategory('escuela', incompleto)).toThrow(DomainError);
    expect(() => stakeForCategory('escuela', incompleto)).toThrow(/escuela/);

    try {
      stakeForCategory('escuela', incompleto);
      expect.unreachable('debería haber lanzado');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('STAKE_MAP_INCOMPLETE');
    }
  });
});
