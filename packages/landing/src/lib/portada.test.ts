import { SCORING } from '@bal/shared';
import { describe, expect, it } from 'vitest';
import {
  avanceAgregado,
  fichasDelSet,
  formatearPuntos,
  torneoDestacado,
  torneosDeLaPortada,
} from './portada.js';

/**
 * Lo que la portada decide antes de dibujar (`REF7-6`, `DISENO.md` §5.1). Son funciones puras: el
 * componente sólo pinta lo que salga de acá.
 */

const torneo = (id: string, status: 'en_proceso' | 'publicado', date: string) => ({
  id,
  name: `Torneo ${id}`,
  date,
  status,
  targetCount: 6,
  participantCount: 8,
});

describe('torneoDestacado (la tarjeta que flota sobre el hero)', () => {
  it('es el que está en curso', () => {
    const lista = [
      torneo('p1', 'publicado', '2026-09-01'),
      torneo('c1', 'en_proceso', '2026-08-01'),
    ];
    expect(torneoDestacado(lista)?.id).toBe('c1');
  });

  it('sin ninguno en curso, la última fecha publicada', () => {
    // El listado llega de la más nueva a la más vieja.
    const lista = [
      torneo('p2', 'publicado', '2026-09-01'),
      torneo('p1', 'publicado', '2026-08-01'),
    ];
    expect(torneoDestacado(lista)?.id).toBe('p2');
  });

  it('sin torneos no hay tarjeta', () => {
    expect(torneoDestacado([])).toBeNull();
  });
});

describe('torneosDeLaPortada', () => {
  it('hasta tres, los en curso primero y después del más nuevo al más viejo', () => {
    const lista = [
      torneo('p3', 'publicado', '2026-10-01'),
      torneo('p2', 'publicado', '2026-09-01'),
      torneo('c1', 'en_proceso', '2026-08-15'),
      torneo('p1', 'publicado', '2026-08-01'),
    ];
    expect(torneosDeLaPortada(lista).map((t) => t.id)).toEqual(['c1', 'p3', 'p2']);
  });

  it('no muta el listado que recibe', () => {
    const lista = [
      torneo('p1', 'publicado', '2026-08-01'),
      torneo('c1', 'en_proceso', '2026-09-01'),
    ];
    const copia = [...lista];
    torneosDeLaPortada(lista);
    expect(lista).toEqual(copia);
  });
});

describe('avanceAgregado (el anillo de la tarjeta en curso)', () => {
  it('suma los blancos de todas las patrullas', () => {
    const detalle = {
      targets: Array.from({ length: 6 }, (_, i) => ({ index: i + 1 })),
      patrols: [{ targetsCompleted: 6 }, { targetsCompleted: 2 }, { targetsCompleted: 0 }],
    };
    expect(avanceAgregado(detalle)).toEqual({ total: 18, completados: 8, patrullas: 3 });
  });

  it('una patrulla nunca suma más blancos que los del recorrido', () => {
    const detalle = { targets: [{ index: 1 }, { index: 2 }], patrols: [{ targetsCompleted: 5 }] };
    expect(avanceAgregado(detalle).completados).toBe(2);
  });
});

describe('fichasDelSet (los valores de flecha de cada modalidad)', () => {
  it('salen del set de la modalidad, no de una lista escrita a mano', () => {
    expect(fichasDelSet(SCORING['3d'].scoringSet)).toEqual([...SCORING['3d'].scoringSet]);
  });

  it('con más de siete se abrevian: los cuatro primeros, «…» y los dos últimos', () => {
    const set = SCORING.sala.scoringSet;
    expect(set.length).toBeGreaterThan(7);
    expect(fichasDelSet(set)).toEqual([...set.slice(0, 4), '…', ...set.slice(-2)]);
  });
});

describe('formatearPuntos', () => {
  it('con coma decimal y dos decimales, como se escribe en Argentina', () => {
    expect(formatearPuntos(89.391)).toBe('89,39');
    expect(formatearPuntos(100)).toBe('100,00');
  });
});
