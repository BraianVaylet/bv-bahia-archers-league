import { describe, expect, it } from 'vitest';
import {
  distribucionDeCategorias,
  distribucionDeModalidades,
  repartirPorcentajes,
} from '../src/distribucion.js';

/**
 * Reparto porcentual (REF2-4).
 *
 * Suena a formateo y no lo es. Con catorce blancos, seis en 3D son el 42,857…%
 * y redondear cada parte por su cuenta da **99% o 101%**. Un renglón que dice
 * «50% campo · 21% 3D · 29% sala» y no suma cien hace dudar del resto de la
 * pantalla, que es lo último que se quiere en la que decide si un torneo se
 * puede correr.
 */

describe('repartirPorcentajes', () => {
  it('reparte exacto lo que divide exacto', () => {
    expect(repartirPorcentajes({ a: 1, b: 1, c: 1, d: 1 })).toEqual({ a: 25, b: 25, c: 25, d: 25 });
  });

  /**
   * El caso del recorrido de referencia: 6 de 3D, 6 de campo, 1 de aire libre y
   * 1 de sala sobre 14 blancos. Los crudos son 42,857 · 42,857 · 7,142 · 7,142.
   *
   * Redondeando cada uno por separado: 43 + 43 + 7 + 7 = **100**, que acá sale
   * bien de casualidad. El que no perdona es el de abajo.
   */
  it('el recorrido de referencia suma 100', () => {
    const r = distribucionDeModalidades([
      ...Array.from({ length: 6 }, () => '3d' as const),
      ...Array.from({ length: 6 }, () => 'campo' as const),
      'aire_libre',
      'sala',
    ]);

    expect(r.reduce((n, x) => n + x.pct, 0)).toBe(100);
    expect(r.map((x) => x.pct)).toEqual([43, 43, 7, 7]);
  });

  /**
   * **Tres partes iguales.** 33,33 cada una: redondeando por separado da 99.
   * Es el caso que rompe la implementación ingenua, y por eso está acá.
   */
  it('tres partes iguales suman 100, no 99', () => {
    const r = repartirPorcentajes({ a: 1, b: 1, c: 1 });

    expect(r.a + r.b + r.c).toBe(100);
    // El resto sobrante va a la primera parte, que es la de mayor resto y, a
    // igualdad de resto, la que apareció primero. Repartirlo al azar haría que
    // dos pantallas iguales muestren números distintos.
    expect([r.a, r.b, r.c]).toEqual([34, 33, 33]);
  });

  it('seis partes iguales también', () => {
    const r = repartirPorcentajes({ a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 });
    expect(Object.values(r).reduce((n, x) => n + x, 0)).toBe(100);
  });

  /**
   * Cualquier reparto, en un barrido. No es un test de ejemplos: es la
   * propiedad. Si alguien cambia el redondeo, esto lo dice sin depender de que
   * el caso que rompe esté entre los que a alguien se le ocurrieron.
   */
  it('CUALQUIER reparto suma exactamente 100', () => {
    for (let total = 1; total <= 30; total++) {
      for (let partes = 1; partes <= Math.min(total, 7); partes++) {
        const conteos: Record<string, number> = {};
        for (let i = 0; i < partes; i++) {
          // Reparto desparejo a propósito: los parejos esconden el problema.
          conteos[`p${i}`] = Math.floor(total / partes) + (i < total % partes ? 1 : 0);
        }

        const r = repartirPorcentajes(conteos);
        const suma = Object.values(r).reduce((n, x) => n + x, 0);

        expect(suma, `total ${total} en ${partes} partes dio ${suma}`).toBe(100);
      }
    }
  });

  it('sin nada que repartir devuelve vacío', () => {
    expect(repartirPorcentajes({})).toEqual({});
  });

  // Una parte en cero no aparece: «0% sala» es ruido en un torneo sin sala.
  it('descarta las partes vacías', () => {
    expect(repartirPorcentajes({ a: 3, b: 0, c: 1 })).toEqual({ a: 75, c: 25 });
  });
});

describe('distribucionDeModalidades', () => {
  it('ordena de mayor a menor, y desempata por el orden del catálogo', () => {
    const r = distribucionDeModalidades(['sala', '3d', '3d', 'campo']);

    expect(r.map((x) => x.modality)).toEqual(['3d', 'sala', 'campo']);
    expect(r.map((x) => x.pct)).toEqual([50, 25, 25]);
  });

  it('un torneo de una sola modalidad da 100%', () => {
    expect(distribucionDeModalidades(['sala', 'sala'])).toEqual([
      { modality: 'sala', count: 2, pct: 100 },
    ]);
  });

  it('sin blancos no hay nada que mostrar', () => {
    expect(distribucionDeModalidades([])).toEqual([]);
  });
});

describe('distribucionDeCategorias', () => {
  it('reparte los participantes por categoría', () => {
    const r = distribucionDeCategorias(['razo', 'razo', 'recurvo', 'escuela']);

    expect(r.reduce((n, x) => n + x.pct, 0)).toBe(100);
    expect(r[0]).toEqual({ category: 'razo', count: 2, pct: 50 });
  });
});
