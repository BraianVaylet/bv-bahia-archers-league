import { describe, expect, it } from 'vitest';
import {
  compareForRanking,
  type Rankable,
  rankByCategory,
  rankByStake,
  rankParticipants,
} from '../src/index.js';

/**
 * Ranking dentro de un torneo (SH-4).
 *
 * Orden: total → inner → cantidad de 10 → menos M. Si persiste el empate,
 * PUESTO COMPARTIDO. Ver docs/DOMAIN_WA.md §8.
 */

let n = 0;

function arquero(overrides: Partial<Rankable> = {}): Rankable {
  n++;
  return {
    participantId: `p${n}`,
    archerId: `a${n}`,
    firstName: `Nombre${n}`,
    lastName: `Apellido${String(n).padStart(3, '0')}`,
    category: 'razo',
    stake: 'azul',
    total: 0,
    innerCount: 0,
    tenCount: 0,
    mCount: 0,
    ...overrides,
  };
}

const posiciones = (r: { position: number }[]) => r.map((e) => e.position);
const ids = (r: { entry: Rankable }[]) => r.map((e) => e.entry.participantId);

describe('compareForRanking', () => {
  it('ordena por puntaje total descendente', () => {
    const a = arquero({ total: 200 });
    const b = arquero({ total: 180 });
    expect(compareForRanking(a, b)).toBeLessThan(0);
    expect(compareForRanking(b, a)).toBeGreaterThan(0);
  });

  it('a igual total, desempata por inner', () => {
    const a = arquero({ total: 200, innerCount: 5 });
    const b = arquero({ total: 200, innerCount: 3 });
    expect(compareForRanking(a, b)).toBeLessThan(0);
  });

  it('a igual total e inner, desempata por cantidad de 10', () => {
    const a = arquero({ total: 200, innerCount: 3, tenCount: 12 });
    const b = arquero({ total: 200, innerCount: 3, tenCount: 9 });
    expect(compareForRanking(a, b)).toBeLessThan(0);
  });

  it('a igual todo lo anterior, gana quien tiene MENOS M', () => {
    const a = arquero({ total: 200, innerCount: 3, tenCount: 9, mCount: 1 });
    const b = arquero({ total: 200, innerCount: 3, tenCount: 9, mCount: 4 });
    expect(compareForRanking(a, b)).toBeLessThan(0);
  });

  it('devuelve 0 cuando empatan en los cuatro criterios', () => {
    const base = { total: 200, innerCount: 3, tenCount: 9, mCount: 1 };
    expect(compareForRanking(arquero(base), arquero(base))).toBe(0);
  });
});

describe('rankParticipants', () => {
  it('asigna posiciones 1..N sin empates', () => {
    const r = rankParticipants([
      arquero({ participantId: 'tercero', total: 100 }),
      arquero({ participantId: 'primero', total: 300 }),
      arquero({ participantId: 'segundo', total: 200 }),
    ]);

    expect(ids(r)).toEqual(['primero', 'segundo', 'tercero']);
    expect(posiciones(r)).toEqual([1, 2, 3]);
    expect(r.every((e) => !e.tied)).toBe(true);
  });

  // La regla del reglamento: dos segundos, y el siguiente es CUARTO.
  it('con empate asigna puesto compartido y saltea la posición siguiente', () => {
    const empate = { total: 200, innerCount: 3, tenCount: 9, mCount: 1 };
    const r = rankParticipants([
      arquero({ participantId: 'primero', total: 300 }),
      arquero({ participantId: 'empateA', ...empate }),
      arquero({ participantId: 'empateB', ...empate }),
      arquero({ participantId: 'cuarto', total: 100 }),
    ]);

    expect(posiciones(r)).toEqual([1, 2, 2, 4]);
    expect(r.map((e) => e.tied)).toEqual([false, true, true, false]);
  });

  it('con tres empatados en el primer puesto, el siguiente es cuarto', () => {
    const empate = { total: 200, innerCount: 0, tenCount: 0, mCount: 0 };
    const r = rankParticipants([
      arquero({ ...empate }),
      arquero({ ...empate }),
      arquero({ ...empate }),
      arquero({ total: 50 }),
    ]);

    expect(posiciones(r)).toEqual([1, 1, 1, 4]);
  });

  it('el empate se rompe si difieren en cualquiera de los cuatro criterios', () => {
    const r = rankParticipants([
      arquero({ participantId: 'menosM', total: 200, innerCount: 3, tenCount: 9, mCount: 0 }),
      arquero({ participantId: 'masM', total: 200, innerCount: 3, tenCount: 9, mCount: 2 }),
    ]);

    expect(ids(r)).toEqual(['menosM', 'masM']);
    expect(posiciones(r)).toEqual([1, 2]);
    // Nadie comparte puesto: el mCount los separó.
    expect(r.every((e) => !e.tied)).toBe(true);
  });

  it('es determinista ante un empate total: ordena por apellido, nombre e id', () => {
    const empate = { total: 100, innerCount: 0, tenCount: 0, mCount: 0 };
    const entrada: Rankable[] = [
      { ...arquero(empate), participantId: 'z', lastName: 'Zapata', firstName: 'Ana' },
      { ...arquero(empate), participantId: 'a', lastName: 'Álvarez', firstName: 'Beto' },
    ];

    const primera = rankParticipants(entrada);
    const segunda = rankParticipants([...entrada].reverse());

    expect(ids(primera)).toEqual(['a', 'z']);
    expect(ids(segunda)).toEqual(ids(primera));
  });

  it('con homónimos empatados, desempata por id para no depender del orden de entrada', () => {
    const empate = { total: 100, innerCount: 0, tenCount: 0, mCount: 0 };
    const entrada: Rankable[] = [
      { ...arquero(empate), participantId: 'zzz', lastName: 'Pérez', firstName: 'Ana' },
      { ...arquero(empate), participantId: 'aaa', lastName: 'Pérez', firstName: 'Ana' },
    ];

    expect(ids(rankParticipants(entrada))).toEqual(['aaa', 'zzz']);
    expect(ids(rankParticipants([...entrada].reverse()))).toEqual(['aaa', 'zzz']);
  });

  it('no muta el array recibido', () => {
    const entrada = [arquero({ total: 100 }), arquero({ total: 300 })];
    const copia = [...entrada];
    rankParticipants(entrada);
    expect(entrada).toEqual(copia);
  });

  it('con una lista vacía devuelve una lista vacía', () => {
    expect(rankParticipants([])).toEqual([]);
  });

  it('con un solo participante, ese participante es primero', () => {
    const r = rankParticipants([arquero({ total: 10 })]);
    expect(posiciones(r)).toEqual([1]);
    expect(r[0]?.tied).toBe(false);
  });

  it('deja afuera a los participantes ausentes', () => {
    const r = rankParticipants([
      arquero({ participantId: 'presente', total: 100 }),
      arquero({ participantId: 'ausente', total: 0, status: 'ausente' }),
    ]);

    expect(ids(r)).toEqual(['presente']);
  });
});

describe('rankByCategory', () => {
  it('rankea cada categoría por separado', () => {
    const porCategoria = rankByCategory([
      arquero({ participantId: 'razo1', category: 'razo', total: 100 }),
      arquero({ participantId: 'razo2', category: 'razo', total: 200 }),
      arquero({ participantId: 'comp1', category: 'compuesto', total: 50 }),
    ]);

    expect(ids(porCategoria.razo ?? [])).toEqual(['razo2', 'razo1']);
    expect(posiciones(porCategoria.razo ?? [])).toEqual([1, 2]);
    expect(ids(porCategoria.compuesto ?? [])).toEqual(['comp1']);
    expect(posiciones(porCategoria.compuesto ?? [])).toEqual([1]);
  });

  it('una categoría con un solo participante lo pone primero', () => {
    // Es correcto: la categoría existe con esa cantidad de participantes.
    const r = rankByCategory([arquero({ category: 'longbow', total: 10 })]);
    expect(posiciones(r.longbow ?? [])).toEqual([1]);
  });

  it('no crea entradas para categorías sin participantes', () => {
    const r = rankByCategory([arquero({ category: 'razo' })]);
    expect(r.recurvo).toBeUndefined();
  });

  it('escuela se rankea como una categoría más', () => {
    const r = rankByCategory([
      arquero({ participantId: 'e1', category: 'escuela', total: 80 }),
      arquero({ participantId: 'e2', category: 'escuela', total: 120 }),
    ]);
    expect(ids(r.escuela ?? [])).toEqual(['e2', 'e1']);
  });
});

describe('rankByStake', () => {
  it('rankea cada estaca por separado', () => {
    const r = rankByStake([
      arquero({ participantId: 'roja1', stake: 'roja', total: 100 }),
      arquero({ participantId: 'azul1', stake: 'azul', total: 300 }),
      arquero({ participantId: 'roja2', stake: 'roja', total: 200 }),
    ]);

    expect(ids(r.roja ?? [])).toEqual(['roja2', 'roja1']);
    expect(ids(r.azul ?? [])).toEqual(['azul1']);
    expect(r.amarilla).toBeUndefined();
  });
});
