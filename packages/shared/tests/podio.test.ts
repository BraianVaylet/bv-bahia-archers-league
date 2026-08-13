import { describe, expect, it } from 'vitest';
import { ETIQUETA_DE_MODO, medallaDe, type StandingsMode } from '../src/index.js';

/**
 * Podio y modos del ranking (FE-16).
 *
 * Viven en `@bal/shared` porque los muestran **dos apps**: la landing y WAFA.
 * Los paquetes no comparten componentes —no comparten bundle— pero sí pueden
 * compartir la decisión, que es lo que no debería divergir.
 */

describe('medallaDe', () => {
  it('los tres del podio', () => {
    expect(medallaDe(1)?.emoji).toBe('🥇');
    expect(medallaDe(2)?.emoji).toBe('🥈');
    expect(medallaDe(3)?.emoji).toBe('🥉');
  });

  // Inventar una medalla donde no la hay sería decir algo que no pasó.
  it('del cuarto en adelante no hay medalla', () => {
    expect(medallaDe(4)).toBeUndefined();
    expect(medallaDe(20)).toBeUndefined();
  });

  it('sin puesto tampoco', () => {
    expect(medallaDe(undefined)).toBeUndefined();
    expect(medallaDe(0)).toBeUndefined();
  });

  /**
   * Cada medalla lleva su nombre escrito.
   *
   * El emoji nunca es el único portador: en un lector de pantalla, `🥇` sin
   * nombre no dice nada. Ver `docs/DESIGN_SYSTEM.md` §10.
   */
  it('cada medalla dice su puesto en palabras', () => {
    expect(medallaDe(1)?.nombre).toMatch(/primer/i);
    expect(medallaDe(2)?.nombre).toMatch(/segundo/i);
    expect(medallaDe(3)?.nombre).toMatch(/tercer/i);
  });
});

describe('ETIQUETA_DE_MODO', () => {
  it('cubre los dos modos que la API acepta', () => {
    const modos: StandingsMode[] = ['position', 'best_two'];
    for (const modo of modos) {
      expect(ETIQUETA_DE_MODO[modo]).toBeTruthy();
    }
  });

  // Si un día se agrega un modo, esto obliga a darle nombre en los dos lados.
  it('no tiene más entradas que modos', () => {
    expect(Object.keys(ETIQUETA_DE_MODO)).toHaveLength(2);
  });
});
