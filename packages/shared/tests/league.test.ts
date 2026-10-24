import { describe, expect, it } from 'vitest';
import {
  type ArcherStanding,
  applyTournamentToStandings,
  bestNAvgPct,
  eligibleForRanking,
  normalizedPct,
  type Rankable,
  sortStandings,
  sortStandingsByGender,
  type TournamentContribution,
} from '../src/index.js';

/**
 * Liga y temporada (SH-5, rediseñado en SH-9).
 *
 * Un solo ranking por categoría: «mejor de N», el promedio de los N mejores
 * `normalizedPct` de la temporada. `N` (`bestN`) es un parámetro —lo decide
 * quien llama, nunca una constante del módulo— porque en producción viene de
 * `LEAGUE_BEST_N` (`BE-18`). El ranking «por posición» (puntos 5-4-3-2-1) y
 * los acumulados `leaguePoints`/`podiums` que lo sostenían se retiraron el
 * 2026-10-24. Ver docs/DOMAIN_WA.md §9 y BITACORA.md.
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

function standing(overrides: Partial<ArcherStanding> = {}): ArcherStanding {
  return {
    archerId: 'a1',
    firstName: 'Juan',
    lastName: 'Pérez',
    category: 'razo',
    tournamentsPlayed: 0,
    bestNormalizedPct: 0,
    bestRawScore: 0,
    bestTournamentId: null,
    topNPcts: [],
    totalX: 0,
    totalTens: 0,
    totalM: 0,
    ...overrides,
  };
}

/** Standing con porcentajes ya cargados, tantos torneos jugados como porcentajes. */
const conPcts = (pcts: number[], o: Partial<ArcherStanding> = {}) =>
  standing({ topNPcts: pcts, tournamentsPlayed: pcts.length, ...o });

describe('normalizedPct', () => {
  it('es el porcentaje del máximo posible del torneo', () => {
    expect(normalizedPct(165, 330)).toBe(50);
    expect(normalizedPct(330, 330)).toBe(100);
    expect(normalizedPct(0, 330)).toBe(0);
  });

  it('redondea a dos decimales, de forma consistente', () => {
    expect(normalizedPct(259, 330)).toBe(78.48);
  });

  it('con máximo 0 devuelve 0 en vez de dividir por cero', () => {
    expect(normalizedPct(100, 0)).toBe(0);
  });

  // Es la razón de ser de la normalización: dos torneos con configuraciones
  // distintas no son comparables en bruto.
  it('hace comparables dos torneos de máximo distinto', () => {
    const enTorneoCorto = normalizedPct(200, 250);
    const enTorneoLargo = normalizedPct(240, 400);
    expect(enTorneoCorto).toBeGreaterThan(enTorneoLargo);
    expect(200).toBeLessThan(240); // en bruto, el orden es el inverso
  });
});

/**
 * «Mejor de N»: el ranking de la liga promedia los N mejores porcentajes de
 * la temporada, no el mejor suelto. Premia la regularidad y no un día bueno.
 * `bestNAvgPct` promedia lo que haya en `topNPcts` — el tope de cuántos
 * entran ahí lo pone `applyTournamentToStandings`, no esta función.
 *
 * Ver docs/DOMAIN_WA.md §9.
 */
describe('bestNAvgPct', () => {
  it('con dos porcentajes guardados, promedia los dos', () => {
    expect(bestNAvgPct(conPcts([90, 80]))).toBe(85);
  });

  it('con tres porcentajes guardados, promedia los tres', () => {
    expect(bestNAvgPct(conPcts([90, 80, 40]))).toBeCloseTo(70, 5);
  });

  it('con un solo porcentaje guardado es ese porcentaje', () => {
    expect(bestNAvgPct(conPcts([70]))).toBe(70);
  });

  it('sin porcentajes guardados es 0, no NaN', () => {
    expect(bestNAvgPct(conPcts([]))).toBe(0);
  });

  it('redondea a dos decimales', () => {
    expect(bestNAvgPct(conPcts([78.48, 91.21]))).toBe(84.85);
  });
});

describe('applyTournamentToStandings', () => {
  const BEST_N = 2;

  const torneo: TournamentContribution = {
    tournamentId: 't1',
    maxPossibleScore: 330,
    participants: [
      arquero({
        archerId: 'oro',
        lastName: 'Oro',
        total: 300,
        tenCount: 20,
        innerCount: 8,
        mCount: 1,
      }),
      arquero({ archerId: 'plata', lastName: 'Plata', total: 250 }),
      arquero({ archerId: 'bronce', lastName: 'Bronce', total: 200 }),
    ],
  };

  it('registra el torneo disputado', () => {
    const r = applyTournamentToStandings([], torneo, BEST_N);
    const oro = r.find((s) => s.archerId === 'oro');
    expect(oro?.tournamentsPlayed).toBe(1);
  });

  it('guarda el mejor puntaje con su bruto y el torneo de origen', () => {
    const oro = applyTournamentToStandings([], torneo, BEST_N).find((s) => s.archerId === 'oro');

    expect(oro?.bestRawScore).toBe(300);
    expect(oro?.bestNormalizedPct).toBe(normalizedPct(300, 330));
    expect(oro?.bestTournamentId).toBe('t1');
  });

  it('acumula X, 10 y M de la temporada', () => {
    const oro = applyTournamentToStandings([], torneo, BEST_N).find((s) => s.archerId === 'oro');
    expect(oro?.totalTens).toBe(20);
    expect(oro?.totalM).toBe(1);
  });

  it('rankea cada categoría por separado', () => {
    const mixto: TournamentContribution = {
      tournamentId: 't1',
      maxPossibleScore: 330,
      participants: [
        arquero({ archerId: 'razo1', category: 'razo', total: 100 }),
        arquero({ archerId: 'comp1', category: 'compuesto', total: 50 }),
      ],
    };

    // Cada uno gana su categoría: a los dos les queda un solo porcentaje guardado.
    const r = applyTournamentToStandings([], mixto, BEST_N);
    expect(r.every((s) => s.topNPcts.length === 1)).toBe(true);
  });

  it('guarda el sexo del arquero, para el ranking por sexo', () => {
    const r = applyTournamentToStandings(
      [],
      { ...torneo, participants: [arquero({ archerId: 'ana', sex: 'femenino', total: 100 })] },
      BEST_N,
    );
    expect(r[0]?.sex).toBe('femenino');
  });

  it('un arquero sin sexo cargado no rompe nada: queda `undefined`, no un throw', () => {
    const r = applyTournamentToStandings(
      [],
      { ...torneo, participants: [arquero({ archerId: 'viejo', total: 100 })] },
      BEST_N,
    );
    expect(r[0]?.sex).toBeUndefined();
  });

  it('no pisa un sexo ya conocido con uno desconocido de un snapshot más viejo', () => {
    const previo = [standing({ archerId: 'a1', sex: 'masculino' })];
    const sinSexo: TournamentContribution = {
      tournamentId: 't2',
      maxPossibleScore: 330,
      participants: [arquero({ archerId: 'a1', total: 100 })],
    };

    const r = applyTournamentToStandings(previo, sinSexo, BEST_N);
    expect(r[0]?.sex).toBe('masculino');
  });

  it('escuela y principiantes acumulan como cualquier otra categoría', () => {
    const conNoSenior: TournamentContribution = {
      tournamentId: 't1',
      maxPossibleScore: 330,
      participants: [
        arquero({ archerId: 'e1', category: 'escuela', total: 90 }),
        arquero({ archerId: 'p1', category: 'principiantes', total: 60 }),
      ],
    };

    const r = applyTournamentToStandings([], conNoSenior, BEST_N);
    expect(r.find((s) => s.archerId === 'e1')?.tournamentsPlayed).toBe(1);
    expect(r.find((s) => s.archerId === 'p1')?.tournamentsPlayed).toBe(1);
  });

  describe('con bestN = 3, guarda tres porcentajes en vez de dos', () => {
    const conTotal = (id: string, total: number, max = 330): TournamentContribution => ({
      tournamentId: id,
      maxPossibleScore: max,
      participants: [arquero({ archerId: 'a1', total })],
    });

    it('un tercer torneo se suma, no desplaza a ninguno', () => {
      let r = applyTournamentToStandings([], conTotal('t1', 264), 3); // 80 %
      r = applyTournamentToStandings(r, conTotal('t2', 297), 3); // 90 %
      r = applyTournamentToStandings(r, conTotal('t3', 33), 3); // 10 %

      expect(r[0]?.topNPcts).toEqual([90, 80, 10]);
    });

    it('un cuarto torneo peor que los tres NO desplaza a ninguno', () => {
      let r = applyTournamentToStandings([], conTotal('t1', 264), 3); // 80 %
      r = applyTournamentToStandings(r, conTotal('t2', 297), 3); // 90 %
      r = applyTournamentToStandings(r, conTotal('t3', 33), 3); // 10 %
      r = applyTournamentToStandings(r, conTotal('t4', 33), 3); // 10 % también

      expect(r[0]?.topNPcts).toEqual([90, 80, 10]);
    });
  });

  describe('acumulación sobre torneos previos', () => {
    it('suma los torneos jugados', () => {
      const previo = [standing({ archerId: 'a1', tournamentsPlayed: 1 })];
      const segundo: TournamentContribution = {
        tournamentId: 't2',
        maxPossibleScore: 330,
        participants: [arquero({ archerId: 'a1', total: 300 })],
      };

      const r = applyTournamentToStandings(previo, segundo, BEST_N);
      expect(r[0]?.tournamentsPlayed).toBe(2);
    });

    it('mejora el mejor puntaje si el nuevo es superior', () => {
      const previo = [standing({ archerId: 'a1', bestNormalizedPct: 50, bestRawScore: 165 })];
      const mejor: TournamentContribution = {
        tournamentId: 't2',
        maxPossibleScore: 330,
        participants: [arquero({ archerId: 'a1', total: 300 })],
      };

      const r = applyTournamentToStandings(previo, mejor, BEST_N);
      expect(r[0]?.bestNormalizedPct).toBe(normalizedPct(300, 330));
      expect(r[0]?.bestTournamentId).toBe('t2');
    });

    it('NO pisa el mejor puntaje con uno peor', () => {
      const previo = [
        standing({
          archerId: 'a1',
          bestNormalizedPct: 90,
          bestRawScore: 297,
          bestTournamentId: 't1',
        }),
      ];
      const peor: TournamentContribution = {
        tournamentId: 't2',
        maxPossibleScore: 330,
        participants: [arquero({ archerId: 'a1', total: 100 })],
      };

      const r = applyTournamentToStandings(previo, peor, BEST_N);
      expect(r[0]?.bestNormalizedPct).toBe(90);
      expect(r[0]?.bestRawScore).toBe(297);
      expect(r[0]?.bestTournamentId).toBe('t1');
    });

    it('compara por porcentaje, no por bruto', () => {
      // 200/250 = 80% supera a 240/400 = 60%, aunque el bruto sea menor.
      const previo = [standing({ archerId: 'a1', bestNormalizedPct: 60, bestRawScore: 240 })];
      const cortoPeroMejor: TournamentContribution = {
        tournamentId: 't2',
        maxPossibleScore: 250,
        participants: [arquero({ archerId: 'a1', total: 200 })],
      };

      const r = applyTournamentToStandings(previo, cortoPeroMejor, BEST_N);
      expect(r[0]?.bestNormalizedPct).toBe(80);
      expect(r[0]?.bestRawScore).toBe(200);
    });

    describe('los N mejores porcentajes', () => {
      const conTotal = (id: string, total: number, max = 330): TournamentContribution => ({
        tournamentId: id,
        maxPossibleScore: max,
        participants: [arquero({ archerId: 'a1', total })],
      });

      it('el primer torneo deja un solo porcentaje', () => {
        const r = applyTournamentToStandings([], conTotal('t1', 264), BEST_N);
        expect(r[0]?.topNPcts).toEqual([80]);
      });

      it('el segundo se suma y quedan ordenados de mayor a menor', () => {
        const previo = applyTournamentToStandings([], conTotal('t1', 264), BEST_N); // 80 %
        const r = applyTournamentToStandings(previo, conTotal('t2', 297), BEST_N); // 90 %

        expect(r[0]?.topNPcts).toEqual([90, 80]);
        expect(bestNAvgPct(r[0] as ArcherStanding)).toBe(85);
      });

      it('un tercer torneo peor NO desplaza a ninguno de los dos', () => {
        const previo = [conPcts([90, 80], { archerId: 'a1' })];
        const r = applyTournamentToStandings(previo, conTotal('t3', 33), BEST_N); // 10 %

        expect(r[0]?.topNPcts).toEqual([90, 80]);
      });

      it('un tercer torneo mejor desplaza al PEOR de los dos', () => {
        const previo = [conPcts([90, 80], { archerId: 'a1' })];
        const r = applyTournamentToStandings(previo, conTotal('t3', 313.5), BEST_N); // 95 %

        expect(r[0]?.topNPcts).toEqual([95, 90]);
      });

      // Es la misma razón por la que existe `normalizedPct`: el bruto premia al
      // recorrido más largo, no al mejor tiro.
      it('compara por porcentaje, no por bruto', () => {
        const previo = [conPcts([60, 50], { archerId: 'a1' })];
        const r = applyTournamentToStandings(previo, conTotal('t3', 200, 250), BEST_N); // 80 %

        expect(r[0]?.topNPcts).toEqual([80, 60]);
      });
    });

    it('no toca a los arqueros que no participaron de este torneo', () => {
      const previo = [
        standing({ archerId: 'presente', tournamentsPlayed: 1 }),
        standing({ archerId: 'ausente', tournamentsPlayed: 1 }),
      ];
      const torneoSolo: TournamentContribution = {
        tournamentId: 't2',
        maxPossibleScore: 330,
        participants: [arquero({ archerId: 'presente', total: 300 })],
      };

      const r = applyTournamentToStandings(previo, torneoSolo, BEST_N);
      const ausente = r.find((s) => s.archerId === 'ausente');
      expect(ausente?.tournamentsPlayed).toBe(1);
    });
  });
});

describe('eligibleForRanking', () => {
  it('con bestN = 2, exige al menos 2 torneos disputados', () => {
    expect(eligibleForRanking(standing({ tournamentsPlayed: 0 }), 2)).toBe(false);
    expect(eligibleForRanking(standing({ tournamentsPlayed: 1 }), 2)).toBe(false);
    expect(eligibleForRanking(standing({ tournamentsPlayed: 2 }), 2)).toBe(true);
    expect(eligibleForRanking(standing({ tournamentsPlayed: 9 }), 2)).toBe(true);
  });

  it('con bestN = 3, el mínimo pasa a ser 3', () => {
    expect(eligibleForRanking(standing({ tournamentsPlayed: 2 }), 3)).toBe(false);
    expect(eligibleForRanking(standing({ tournamentsPlayed: 3 }), 3)).toBe(true);
  });
});

describe('sortStandings', () => {
  const conDosTorneos = (o: Partial<ArcherStanding>) => standing({ tournamentsPlayed: 2, ...o });

  it('ordena por el promedio de los N mejores, descendente', () => {
    const r = sortStandings(
      [conPcts([70, 70], { archerId: 'b' }), conPcts([90, 80], { archerId: 'a' })],
      2,
    );
    expect(r.ranked.map((s) => s.archerId)).toEqual(['a', 'b']);
  });

  /**
   * `irregular` promedia 75 y `regular` promedia 85, aunque `irregular` tenga
   * el mejor porcentaje suelto de los dos. La regularidad gana.
   */
  it('NO ordena por el mejor porcentaje suelto', () => {
    const r = sortStandings(
      [conPcts([95, 55], { archerId: 'irregular' }), conPcts([86, 84], { archerId: 'regular' })],
      2,
    );

    expect(r.ranked.map((s) => s.archerId)).toEqual(['regular', 'irregular']);
  });

  it('a igual promedio, desempata por inner y después por menos M', () => {
    const r = sortStandings(
      [
        conPcts([80, 80], { archerId: 'masM', totalX: 5, totalM: 4 }),
        conPcts([80, 80], { archerId: 'menosM', totalX: 5, totalM: 1 }),
      ],
      2,
    );
    expect(r.ranked.map((s) => s.archerId)).toEqual(['menosM', 'masM']);
  });

  describe('mínimo de torneos', () => {
    it('separa a los que todavía no clasifican', () => {
      const r = sortStandings(
        [
          conDosTorneos({ archerId: 'clasifica' }),
          standing({ archerId: 'noClasifica', tournamentsPlayed: 1 }),
        ],
        2,
      );

      expect(r.ranked.map((s) => s.archerId)).toEqual(['clasifica']);
      expect(r.notYetEligible.map((s) => s.archerId)).toEqual(['noClasifica']);
    });

    it('con bestN = 3, dos torneos no alcanzan', () => {
      const r = sortStandings([conDosTorneos({ archerId: 'dosTorneos' })], 3);

      expect(r.ranked).toEqual([]);
      expect(r.notYetEligible.map((s) => s.archerId)).toEqual(['dosTorneos']);
    });

    it('ordena también a los que no clasifican, de forma determinista', () => {
      const r = sortStandings(
        [
          standing({ archerId: 'z', lastName: 'Pérez', firstName: 'Ana', tournamentsPlayed: 1 }),
          standing({ archerId: 'a', lastName: 'Pérez', firstName: 'Ana', tournamentsPlayed: 1 }),
          standing({ archerId: 'm', lastName: 'Álvarez', firstName: 'Beto', tournamentsPlayed: 1 }),
        ],
        2,
      );
      expect(r.notYetEligible.map((s) => s.archerId)).toEqual(['m', 'a', 'z']);
    });

    it('asigna posiciones sólo entre los que clasifican', () => {
      const r = sortStandings(
        [
          standing({ archerId: 'x', tournamentsPlayed: 1, topNPcts: [99] }),
          conDosTorneos({ archerId: 'a', topNPcts: [90, 80] }),
          conDosTorneos({ archerId: 'b', topNPcts: [50, 40] }),
        ],
        2,
      );
      expect(r.ranked.map((s) => s.position)).toEqual([1, 2]);
    });

    it('con empate total asigna puesto compartido', () => {
      const iguales = { topNPcts: [80, 80], totalX: 3, totalM: 0 };
      const r = sortStandings(
        [
          conDosTorneos({ archerId: 'a', ...iguales }),
          conDosTorneos({ archerId: 'b', ...iguales }),
          conDosTorneos({ archerId: 'c', topNPcts: [50, 40] }),
        ],
        2,
      );
      expect(r.ranked.map((s) => s.position)).toEqual([1, 1, 3]);
    });
  });

  it('no muta el array recibido', () => {
    const entrada = [conDosTorneos({ archerId: 'a' })];
    const copia = [...entrada];
    sortStandings(entrada, 2);
    expect(entrada).toEqual(copia);
  });
});

/**
 * Ranking General / Femenino / Masculino (SH-10).
 *
 * Las tres vistas se calculan filtrando **antes** de ordenar, no filtrando un
 * ranking ya ordenado: el puesto compartido y el salto de posición dependen de
 * la pool exacta que se está rankeando, y una mujer que es 4ª en el general
 * puede ser 1ª en el femenino.
 */
describe('sortStandingsByGender', () => {
  const conDosTorneos = (o: Partial<ArcherStanding>) => standing({ tournamentsPlayed: 2, ...o });

  it('cada sexo tiene su propia numeración, no un subconjunto del general', () => {
    const mujeres = ['f1', 'f2', 'f3'].map((id) =>
      conDosTorneos({ archerId: id, sex: 'femenino' }),
    );
    const varones = ['m1', 'm2', 'm3', 'm4', 'm5'].map((id) =>
      conDosTorneos({ archerId: id, sex: 'masculino' }),
    );

    const r = sortStandingsByGender([...mujeres, ...varones], 2);

    expect(r.general.ranked).toHaveLength(8);
    expect(r.femenino.ranked).toHaveLength(3);
    expect(r.masculino.ranked).toHaveLength(5);
    expect(r.femenino.ranked.map((s) => s.position)).toEqual([1, 1, 1]);
  });

  it('una mujer que es cuarta en el general puede ser primera en el femenino', () => {
    const r = sortStandingsByGender(
      [
        conDosTorneos({ archerId: 'm1', sex: 'masculino', topNPcts: [95, 90] }),
        conDosTorneos({ archerId: 'm2', sex: 'masculino', topNPcts: [92, 88] }),
        conDosTorneos({ archerId: 'm3', sex: 'masculino', topNPcts: [91, 87] }),
        conDosTorneos({ archerId: 'f1', sex: 'femenino', topNPcts: [85, 80] }),
      ],
      2,
    );

    expect(r.general.ranked.find((s) => s.archerId === 'f1')?.position).toBe(4);
    expect(r.femenino.ranked.find((s) => s.archerId === 'f1')?.position).toBe(1);
  });

  // No se filtra el resultado ya ordenado: se filtra la pool antes de ordenar.
  it('el mínimo de torneos se evalúa dentro de cada pool, no contra el general', () => {
    const r = sortStandingsByGender(
      [
        conDosTorneos({ archerId: 'f1', sex: 'femenino' }),
        standing({ archerId: 'f2', sex: 'femenino', tournamentsPlayed: 1 }),
      ],
      2,
    );

    expect(r.femenino.ranked.map((s) => s.archerId)).toEqual(['f1']);
    expect(r.femenino.notYetEligible.map((s) => s.archerId)).toEqual(['f2']);
  });

  /**
   * Un arquero sin `sex` (padrón viejo) no rompe el cálculo: no figura en
   * ninguno de los dos rankings por sexo, pero sigue en el general.
   */
  it('un arquero sin sexo cargado no rompe el cálculo, y no figura en los rankings por sexo', () => {
    const r = sortStandingsByGender(
      [conDosTorneos({ archerId: 'sinSexo' }), conDosTorneos({ archerId: 'f1', sex: 'femenino' })],
      2,
    );

    expect(() => r).not.toThrow();
    expect(r.general.ranked.map((s) => s.archerId).sort()).toEqual(['f1', 'sinSexo']);
    expect(r.femenino.ranked.map((s) => s.archerId)).toEqual(['f1']);
    expect(r.masculino.ranked).toEqual([]);
  });
});
