import { describe, expect, it } from 'vitest';
import {
  type ArcherStanding,
  applyTournamentToStandings,
  eligibleForRanking,
  leaguePointsForPosition,
  normalizedPct,
  type Rankable,
  sortStandings,
  type TournamentContribution,
} from '../src/index.js';

/**
 * Liga y temporada (SH-5).
 *
 * Dos rankings por categoría:
 *   - por posición:      5-4-3-2-1 según el podio de cada torneo
 *   - por mejor puntaje: mejor normalizedPct de la temporada
 * Mínimo 2 torneos publicados para figurar. Ver docs/DOMAIN_WA.md §9.
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
    leaguePoints: 0,
    tournamentsPlayed: 0,
    podiums: { first: 0, second: 0, third: 0 },
    bestNormalizedPct: 0,
    bestRawScore: 0,
    bestTournamentId: null,
    totalX: 0,
    totalTens: 0,
    totalM: 0,
    ...overrides,
  };
}

describe('leaguePointsForPosition', () => {
  it('reparte 5-4-3-2-1 del primero al quinto', () => {
    expect([1, 2, 3, 4, 5].map(leaguePointsForPosition)).toEqual([5, 4, 3, 2, 1]);
  });

  it('del sexto en adelante no reparte puntos', () => {
    expect([6, 7, 20, 100].map(leaguePointsForPosition)).toEqual([0, 0, 0, 0]);
  });

  it('una posición inválida no reparte puntos', () => {
    expect(leaguePointsForPosition(0)).toBe(0);
    expect(leaguePointsForPosition(-1)).toBe(0);
  });
});

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

describe('applyTournamentToStandings', () => {
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
      arquero({ archerId: 'cuarto', lastName: 'Cuarto', total: 150 }),
      arquero({ archerId: 'quinto', lastName: 'Quinto', total: 100 }),
      arquero({ archerId: 'sexto', lastName: 'Sexto', total: 50 }),
    ],
  };

  it('reparte los puntos de liga según el podio de la categoría', () => {
    const r = applyTournamentToStandings([], torneo);
    const puntos = Object.fromEntries(r.map((s) => [s.archerId, s.leaguePoints]));

    expect(puntos).toEqual({ oro: 5, plata: 4, bronce: 3, cuarto: 2, quinto: 1, sexto: 0 });
  });

  it('registra el podio y cuenta el torneo disputado', () => {
    const r = applyTournamentToStandings([], torneo);
    const oro = r.find((s) => s.archerId === 'oro');

    expect(oro?.podiums).toEqual({ first: 1, second: 0, third: 0 });
    expect(oro?.tournamentsPlayed).toBe(1);
  });

  it('guarda el mejor puntaje con su bruto y el torneo de origen', () => {
    const oro = applyTournamentToStandings([], torneo).find((s) => s.archerId === 'oro');

    expect(oro?.bestRawScore).toBe(300);
    expect(oro?.bestNormalizedPct).toBe(normalizedPct(300, 330));
    expect(oro?.bestTournamentId).toBe('t1');
  });

  it('acumula X, 10 y M de la temporada', () => {
    const oro = applyTournamentToStandings([], torneo).find((s) => s.archerId === 'oro');
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

    const r = applyTournamentToStandings([], mixto);
    // Cada uno gana su categoría, así que los dos se llevan 5 puntos.
    expect(r.every((s) => s.leaguePoints === 5)).toBe(true);
  });

  it('escuela suma puntos de liga como cualquier otra categoría', () => {
    const conEscuela: TournamentContribution = {
      tournamentId: 't1',
      maxPossibleScore: 330,
      participants: [arquero({ archerId: 'e1', category: 'escuela', total: 90 })],
    };

    expect(applyTournamentToStandings([], conEscuela)[0]?.leaguePoints).toBe(5);
  });

  describe('puesto compartido', () => {
    const conEmpate: TournamentContribution = {
      tournamentId: 't1',
      maxPossibleScore: 330,
      participants: [
        arquero({ archerId: 'empateA', lastName: 'A', total: 300 }),
        arquero({ archerId: 'empateB', lastName: 'B', total: 300 }),
        arquero({ archerId: 'tercero', lastName: 'C', total: 200 }),
      ],
    };

    it('los dos primeros reciben 5 puntos cada uno', () => {
      const r = applyTournamentToStandings([], conEmpate);
      const puntos = Object.fromEntries(r.map((s) => [s.archerId, s.leaguePoints]));
      expect(puntos.empateA).toBe(5);
      expect(puntos.empateB).toBe(5);
    });

    it('el siguiente queda TERCERO y recibe 3 puntos, no 4', () => {
      const r = applyTournamentToStandings([], conEmpate);
      expect(r.find((s) => s.archerId === 'tercero')?.leaguePoints).toBe(3);
    });

    it('ambos empatados cuentan el podio de primero', () => {
      const r = applyTournamentToStandings([], conEmpate);
      expect(r.find((s) => s.archerId === 'empateA')?.podiums.first).toBe(1);
      expect(r.find((s) => s.archerId === 'empateB')?.podiums.first).toBe(1);
    });
  });

  describe('acumulación sobre torneos previos', () => {
    it('suma los puntos de liga', () => {
      const previo = [standing({ archerId: 'a1', leaguePoints: 4, tournamentsPlayed: 1 })];
      const segundo: TournamentContribution = {
        tournamentId: 't2',
        maxPossibleScore: 330,
        participants: [arquero({ archerId: 'a1', total: 300 })],
      };

      const r = applyTournamentToStandings(previo, segundo);
      expect(r[0]?.leaguePoints).toBe(9);
      expect(r[0]?.tournamentsPlayed).toBe(2);
    });

    it('mejora el mejor puntaje si el nuevo es superior', () => {
      const previo = [standing({ archerId: 'a1', bestNormalizedPct: 50, bestRawScore: 165 })];
      const mejor: TournamentContribution = {
        tournamentId: 't2',
        maxPossibleScore: 330,
        participants: [arquero({ archerId: 'a1', total: 300 })],
      };

      const r = applyTournamentToStandings(previo, mejor);
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

      const r = applyTournamentToStandings(previo, peor);
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

      const r = applyTournamentToStandings(previo, cortoPeroMejor);
      expect(r[0]?.bestNormalizedPct).toBe(80);
      expect(r[0]?.bestRawScore).toBe(200);
    });

    it('no toca a los arqueros que no participaron de este torneo', () => {
      const previo = [
        standing({ archerId: 'presente', leaguePoints: 4, tournamentsPlayed: 1 }),
        standing({ archerId: 'ausente', leaguePoints: 3, tournamentsPlayed: 1 }),
      ];
      const torneoSolo: TournamentContribution = {
        tournamentId: 't2',
        maxPossibleScore: 330,
        participants: [arquero({ archerId: 'presente', total: 300 })],
      };

      const r = applyTournamentToStandings(previo, torneoSolo);
      const ausente = r.find((s) => s.archerId === 'ausente');
      expect(ausente?.leaguePoints).toBe(3);
      expect(ausente?.tournamentsPlayed).toBe(1);
    });
  });
});

describe('eligibleForRanking', () => {
  it('exige al menos 2 torneos disputados', () => {
    expect(eligibleForRanking(standing({ tournamentsPlayed: 0 }))).toBe(false);
    expect(eligibleForRanking(standing({ tournamentsPlayed: 1 }))).toBe(false);
    expect(eligibleForRanking(standing({ tournamentsPlayed: 2 }))).toBe(true);
    expect(eligibleForRanking(standing({ tournamentsPlayed: 9 }))).toBe(true);
  });
});

describe('sortStandings', () => {
  const conDosTorneos = (o: Partial<ArcherStanding>) => standing({ tournamentsPlayed: 2, ...o });

  describe('modo posición', () => {
    it('ordena por puntos de liga descendente', () => {
      const r = sortStandings(
        [
          conDosTorneos({ archerId: 'b', leaguePoints: 8 }),
          conDosTorneos({ archerId: 'a', leaguePoints: 12 }),
        ],
        'position',
      );
      expect(r.ranked.map((s) => s.archerId)).toEqual(['a', 'b']);
    });

    it('a igual puntaje, desempata por cantidad de primeros puestos', () => {
      const r = sortStandings(
        [
          conDosTorneos({
            archerId: 'menos',
            leaguePoints: 10,
            podiums: { first: 1, second: 3, third: 0 },
          }),
          conDosTorneos({
            archerId: 'mas',
            leaguePoints: 10,
            podiums: { first: 2, second: 0, third: 0 },
          }),
        ],
        'position',
      );
      expect(r.ranked.map((s) => s.archerId)).toEqual(['mas', 'menos']);
    });

    it('después desempata por segundos puestos, y después por mejor porcentaje', () => {
      const podiums = { first: 1, second: 1, third: 0 };
      const r = sortStandings(
        [
          conDosTorneos({ archerId: 'peor', leaguePoints: 10, podiums, bestNormalizedPct: 70 }),
          conDosTorneos({ archerId: 'mejor', leaguePoints: 10, podiums, bestNormalizedPct: 85 }),
        ],
        'position',
      );
      expect(r.ranked.map((s) => s.archerId)).toEqual(['mejor', 'peor']);
    });
  });

  describe('modo mejor puntaje', () => {
    it('ordena por mejor porcentaje descendente', () => {
      const r = sortStandings(
        [
          conDosTorneos({ archerId: 'b', bestNormalizedPct: 70 }),
          conDosTorneos({ archerId: 'a', bestNormalizedPct: 85 }),
        ],
        'score',
      );
      expect(r.ranked.map((s) => s.archerId)).toEqual(['a', 'b']);
    });

    it('a igual porcentaje, desempata por inner y después por menos M', () => {
      const r = sortStandings(
        [
          conDosTorneos({ archerId: 'masM', bestNormalizedPct: 80, totalX: 5, totalM: 4 }),
          conDosTorneos({ archerId: 'menosM', bestNormalizedPct: 80, totalX: 5, totalM: 1 }),
        ],
        'score',
      );
      expect(r.ranked.map((s) => s.archerId)).toEqual(['menosM', 'masM']);
    });
  });

  describe('mínimo de torneos', () => {
    it('separa a los que todavía no clasifican', () => {
      const r = sortStandings(
        [
          conDosTorneos({ archerId: 'clasifica', leaguePoints: 5 }),
          standing({ archerId: 'noClasifica', tournamentsPlayed: 1, leaguePoints: 5 }),
        ],
        'position',
      );

      expect(r.ranked.map((s) => s.archerId)).toEqual(['clasifica']);
      expect(r.notYetEligible.map((s) => s.archerId)).toEqual(['noClasifica']);
    });

    it('ordena también a los que no clasifican, de forma determinista', () => {
      const r = sortStandings(
        [
          standing({ archerId: 'z', lastName: 'Pérez', firstName: 'Ana', tournamentsPlayed: 1 }),
          standing({ archerId: 'a', lastName: 'Pérez', firstName: 'Ana', tournamentsPlayed: 1 }),
          standing({ archerId: 'm', lastName: 'Álvarez', firstName: 'Beto', tournamentsPlayed: 1 }),
        ],
        'position',
      );
      expect(r.notYetEligible.map((s) => s.archerId)).toEqual(['m', 'a', 'z']);
    });

    it('asigna posiciones sólo entre los que clasifican', () => {
      const r = sortStandings(
        [
          standing({ archerId: 'x', tournamentsPlayed: 1, leaguePoints: 99 }),
          conDosTorneos({ archerId: 'a', leaguePoints: 10 }),
          conDosTorneos({ archerId: 'b', leaguePoints: 5 }),
        ],
        'position',
      );
      expect(r.ranked.map((s) => s.position)).toEqual([1, 2]);
    });

    it('con empate total asigna puesto compartido', () => {
      const iguales = {
        leaguePoints: 10,
        podiums: { first: 1, second: 1, third: 0 },
        bestNormalizedPct: 80,
      };
      const r = sortStandings(
        [
          conDosTorneos({ archerId: 'a', ...iguales }),
          conDosTorneos({ archerId: 'b', ...iguales }),
          conDosTorneos({ archerId: 'c', leaguePoints: 5 }),
        ],
        'position',
      );
      expect(r.ranked.map((s) => s.position)).toEqual([1, 1, 3]);
    });
  });

  it('no muta el array recibido', () => {
    const entrada = [conDosTorneos({ archerId: 'a', leaguePoints: 1 })];
    const copia = [...entrada];
    sortStandings(entrada, 'position');
    expect(entrada).toEqual(copia);
  });
});
