import { describe, expect, it } from 'vitest';
import {
  type ArcherTournamentResult,
  archerCareerStats,
  DomainError,
  participantStats,
  patrolProgress,
  type StatParticipantRollup,
  type StatPatrolMember,
  type StatTarget,
  tournamentStats,
} from '../src/index.js';

/**
 * Estadísticas derivadas (SH-6).
 *
 * Todo se calcula sobre datos **ya validados**: el servidor es la autoridad del
 * scoring y valida al escribir. Ver docs/DOMAIN_WA.md §10.
 */

// ── Ayudas ───────────────────────────────────────────────────────────────────

/** Recorrido de la patrulla que arranca en el 2: blancos 2, 3, 1. */
const RECORRIDO: StatTarget[] = [
  { index: 2, modality: 'sala', arrows: ['X', '10', '9'] },
  { index: 3, modality: 'campo', arrows: ['6', '5', '4'] },
  { index: 1, modality: '3d', arrows: ['11', '10'] },
];

function rollup(overrides: Partial<StatParticipantRollup> = {}): StatParticipantRollup {
  return {
    participantId: 'p1',
    category: 'razo',
    total: 0,
    innerCount: 0,
    tenCount: 0,
    mCount: 0,
    targetsCompleted: 0,
    ...overrides,
  };
}

function resultado(overrides: Partial<ArcherTournamentResult> = {}): ArcherTournamentResult {
  return {
    tournamentId: 't1',
    tournamentName: '1ª fecha',
    date: '2026-03-01',
    category: 'razo',
    total: 0,
    maxPossibleScore: 100,
    position: 1,
    leaguePoints: 5,
    innerCount: 0,
    tenCount: 0,
    mCount: 0,
    ...overrides,
  };
}

// ── participantStats ─────────────────────────────────────────────────────────

describe('participantStats', () => {
  it('suma el total del recorrido', () => {
    // sala X+10+9 = 29 · campo 6+5+4 = 15 · 3D 11+10 = 21
    expect(participantStats(RECORRIDO).total).toBe(65);
  });

  it('el desglose por modalidad suma exactamente el total', () => {
    const s = participantStats(RECORRIDO);

    expect(s.byModality.reduce((n, m) => n + m.total, 0)).toBe(s.total);
    expect(s.byModality.reduce((n, m) => n + m.maxPossible, 0)).toBe(s.maxPossible);
  });

  it('desglosa cuánto se sumó en cada modalidad', () => {
    const porModalidad = new Map(
      participantStats(RECORRIDO).byModality.map((m) => [m.modality, m]),
    );

    expect(porModalidad.get('sala')?.total).toBe(29);
    expect(porModalidad.get('campo')?.total).toBe(15);
    expect(porModalidad.get('3d')?.total).toBe(21);
    // 3 flechas × 10 · 3 × 6 · 2 × 11
    expect(porModalidad.get('sala')?.maxPossible).toBe(30);
    expect(porModalidad.get('campo')?.maxPossible).toBe(18);
    expect(porModalidad.get('3d')?.maxPossible).toBe(22);
  });

  it('agrupa los blancos de la misma modalidad en una sola entrada', () => {
    const s = participantStats([
      { index: 1, modality: 'sala', arrows: ['10', '10', '10'] },
      { index: 2, modality: 'sala', arrows: ['9', '9', '9'] },
    ]);

    expect(s.byModality).toHaveLength(1);
    expect(s.byModality[0]?.targets).toBe(2);
    expect(s.byModality[0]?.total).toBe(57);
  });

  it('promedia por flecha y por blanco', () => {
    const s = participantStats(RECORRIDO);

    expect(s.arrowsShot).toBe(8);
    expect(s.targetsCompleted).toBe(3);
    expect(s.averagePerArrow).toBe(8.13); // 65 / 8
    expect(s.averagePerTarget).toBe(21.67); // 65 / 3
  });

  // Comparar blancos de modalidades distintas por el bruto es el mismo error que
  // comparar torneos por el bruto: el de sala tiene más techo. Ver DOMAIN_WA §10.
  it('el mejor y el peor blanco se comparan por PORCENTAJE, no por bruto', () => {
    const s = participantStats([
      { index: 1, modality: 'sala', arrows: ['9', '9', '9'] }, // 27 de 30 → 90 %
      { index: 2, modality: '3d', arrows: ['11', '10'] }, // 21 de 22 → 95.45 %
    ]);

    // El bruto diría que el mejor es el de sala (27 > 21).
    expect(s.bestTarget?.index).toBe(2);
    expect(s.worstTarget?.index).toBe(1);
    expect(s.bestTarget?.pct).toBe(95.45);
  });

  it('a igual porcentaje, el mejor blanco es siempre el mismo', () => {
    // Dos blancos al 100 %: sin criterio de desempate, cuál gana dependería del
    // orden en que la patrulla los recorrió.
    const s = participantStats([
      { index: 3, modality: '3d', arrows: ['11', '11'] },
      { index: 1, modality: 'sala', arrows: ['X', '10', '10'] },
    ]);

    expect(s.bestTarget?.pct).toBe(100);
    // Empatados, el mejor es el de menor número y el peor el de mayor: nunca el
    // mismo blanco, y siempre igual sin importar por dónde arrancó la patrulla.
    expect(s.bestTarget?.index).toBe(1);
    expect(s.worstTarget?.index).toBe(3);
  });

  it('la tabla por modalidad sale en el orden del dominio, no en el del recorrido', () => {
    const s = participantStats([
      { index: 1, modality: '3d', arrows: ['11', '11'] },
      { index: 2, modality: 'sala', arrows: ['10', '10', '10'] },
      { index: 3, modality: 'campo', arrows: ['6', '6', '6'] },
    ]);

    expect(s.byModality.map((m) => m.modality)).toEqual(['sala', 'campo', '3d']);
  });

  it('la evolución respeta el orden del recorrido, no el número de blanco', () => {
    const s = participantStats(RECORRIDO);

    // La patrulla arrancó en el 2: ese es el orden en que tiró.
    expect(s.evolution.map((e) => e.index)).toEqual([2, 3, 1]);
    expect(s.evolution.map((e) => e.total)).toEqual([29, 15, 21]);
    expect(s.evolution.map((e) => e.cumulative)).toEqual([29, 44, 65]);
  });

  it('cuenta inner, dieces y emes con la regla de cada modalidad', () => {
    const s = participantStats([
      { index: 1, modality: 'sala', arrows: ['X', '10', 'M'] },
      { index: 2, modality: '3d', arrows: ['11', '10'] },
    ]);

    // Inner: la X de sala y el 11 del 3D.
    expect(s.innerCount).toBe(2);
    // X sólo existe en sala y aire libre.
    expect(s.xCount).toBe(1);
    // Valen 10: la X, el 10 de sala y el 10 del 3D. El 11 NO.
    expect(s.tenCount).toBe(3);
    expect(s.mCount).toBe(1);
  });

  it('distribuye por token dentro de cada modalidad, incluyendo los que no salieron', () => {
    const s = participantStats([{ index: 1, modality: '3d', arrows: ['11', '11'] }]);
    const d = s.byModality[0]?.distribution;

    expect(d?.['11']).toBe(2);
    // Los tokens del set que no salieron figuran en 0: la distribución es del
    // set de la modalidad, no de lo que casualmente se tiró.
    expect(d?.['10']).toBe(0);
    expect(d?.['8']).toBe(0);
    expect(d?.M).toBe(0);
    // El set de 3D no tiene X.
    expect(d?.X).toBeUndefined();
  });

  it('sin blancos cargados devuelve todo en cero y sin mejor ni peor', () => {
    const s = participantStats([]);

    expect(s.total).toBe(0);
    expect(s.averagePerArrow).toBe(0);
    expect(s.averagePerTarget).toBe(0);
    expect(s.bestTarget).toBeNull();
    expect(s.worstTarget).toBeNull();
    expect(s.byModality).toEqual([]);
    expect(s.pct).toBe(0);
  });

  it('un blanco parcial cuenta sólo las flechas tiradas', () => {
    // El máximo se calcula sobre lo tirado: si no, un recorrido a medias
    // mostraría un porcentaje hundido que no dice nada del arquero.
    const s = participantStats([{ index: 1, modality: 'sala', arrows: ['10'] }]);

    expect(s.maxPossible).toBe(10);
    expect(s.pct).toBe(100);
  });

  // Silenciar un token corrupto puntuándolo 0 mostraría un total equivocado como
  // si fuera correcto. Mejor romper: el dato ya pasó por la validación del server.
  it('un token que no pertenece a la modalidad revienta en vez de valer cero', () => {
    expect(() =>
      participantStats([{ index: 1, modality: 'sala', arrows: ['11', '10', '9'] }]),
    ).toThrowError(DomainError);
  });
});

// ── tournamentStats ──────────────────────────────────────────────────────────

describe('tournamentStats', () => {
  const campo: StatParticipantRollup[] = [
    rollup({
      participantId: 'p1',
      category: 'razo',
      total: 90,
      innerCount: 4,
      tenCount: 6,
      mCount: 1,
    }),
    rollup({
      participantId: 'p2',
      category: 'razo',
      total: 70,
      innerCount: 2,
      tenCount: 3,
      mCount: 3,
    }),
    rollup({
      participantId: 'p3',
      category: 'escuela',
      total: 50,
      innerCount: 1,
      tenCount: 1,
      mCount: 5,
    }),
  ];

  it('acumula inner, dieces y emes de todo el torneo', () => {
    const s = tournamentStats(campo);

    expect(s.totalInner).toBe(7);
    expect(s.totalTens).toBe(10);
    expect(s.totalM).toBe(9);
  });

  it('promedia en general y por categoría, y saca el mejor de cada una', () => {
    const s = tournamentStats(campo);

    expect(s.participants).toBe(3);
    expect(s.averageScore).toBe(70); // (90 + 70 + 50) / 3
    expect(s.bestScore).toBe(90);

    const razo = s.byCategory.find((c) => c.category === 'razo');
    expect(razo?.participants).toBe(2);
    expect(razo?.averageScore).toBe(80);
    expect(razo?.bestScore).toBe(90);

    expect(s.byCategory.find((c) => c.category === 'escuela')?.bestScore).toBe(50);
  });

  it('deja afuera a los ausentes: un cero de alguien que no tiró hunde el promedio', () => {
    const s = tournamentStats([...campo, rollup({ participantId: 'p4', status: 'ausente' })]);

    expect(s.participants).toBe(3);
    expect(s.averageScore).toBe(70);
  });

  it('las categorías salen en el orden del dominio, siempre igual', () => {
    const s = tournamentStats([
      rollup({ participantId: 'p1', category: 'escuela', total: 10 }),
      rollup({ participantId: 'p2', category: 'recurvo', total: 20 }),
      rollup({ participantId: 'p3', category: 'razo', total: 30 }),
    ]);

    expect(s.byCategory.map((c) => c.category)).toEqual(['recurvo', 'razo', 'escuela']);
  });

  it('sin participantes no inventa un mejor puntaje', () => {
    const s = tournamentStats([]);

    expect(s.participants).toBe(0);
    expect(s.averageScore).toBe(0);
    expect(s.bestScore).toBeNull();
    expect(s.byCategory).toEqual([]);
  });
});

// ── patrolProgress ───────────────────────────────────────────────────────────

describe('patrolProgress', () => {
  it('el avance de la patrulla es el del arquero MÁS ATRASADO', () => {
    // Un blanco no está listo hasta que lo cargaron todos.
    const miembros: StatPatrolMember[] = [
      { patrolId: 'x', patrolNumber: 1, targetsCompleted: 5 },
      { patrolId: 'x', patrolNumber: 1, targetsCompleted: 3 },
    ];

    const [p] = patrolProgress(miembros, 12);

    expect(p?.targetsCompleted).toBe(3);
    expect(p?.participants).toBe(2);
    expect(p?.totalTargets).toBe(12);
    expect(p?.pct).toBe(25);
  });

  it('ordena por número de patrulla', () => {
    const miembros: StatPatrolMember[] = [
      { patrolId: 'c', patrolNumber: 3, targetsCompleted: 1 },
      { patrolId: 'a', patrolNumber: 1, targetsCompleted: 1 },
      { patrolId: 'b', patrolNumber: 2, targetsCompleted: 1 },
    ];

    expect(patrolProgress(miembros, 12).map((p) => p.patrolNumber)).toEqual([1, 2, 3]);
  });

  it('con dos patrullas del mismo número desempata por id', () => {
    // No debería pasar —el número es único por torneo— pero si pasa, el orden no
    // puede depender de en qué orden vinieron los participantes de la base.
    const miembros: StatPatrolMember[] = [
      { patrolId: 'z', patrolNumber: 1, targetsCompleted: 1 },
      { patrolId: 'a', patrolNumber: 1, targetsCompleted: 1 },
    ];

    expect(patrolProgress(miembros, 12).map((p) => p.patrolId)).toEqual(['a', 'z']);
  });

  it('sin miembros devuelve una lista vacía', () => {
    expect(patrolProgress([], 12)).toEqual([]);
  });
});

// ── archerCareerStats ────────────────────────────────────────────────────────

describe('archerCareerStats', () => {
  const carrera: ArcherTournamentResult[] = [
    resultado({ tournamentId: 't2', date: '2026-05-01', total: 180, maxPossibleScore: 200 }), // 90 %
    resultado({ tournamentId: 't1', date: '2026-03-01', total: 95, maxPossibleScore: 100 }), // 95 %
    resultado({ tournamentId: 't3', date: '2026-07-01', total: 120, maxPossibleScore: 150 }), // 80 %
  ];

  it('cuenta los torneos y acumula los puntos de liga', () => {
    const s = archerCareerStats(carrera);

    expect(s.tournamentsPlayed).toBe(3);
    expect(s.leaguePoints).toBe(15);
  });

  // El bruto premia al recorrido más largo, no al mejor tiro.
  it('el mejor y el peor torneo se miden por PORCENTAJE, no por bruto', () => {
    const s = archerCareerStats(carrera);

    // El bruto diría que el mejor es t2 (180) y el peor t1 (95).
    expect(s.bestTournamentId).toBe('t1');
    expect(s.bestNormalizedPct).toBe(95);
    expect(s.bestRawScore).toBe(95);

    expect(s.worstTournamentId).toBe('t3');
    expect(s.worstNormalizedPct).toBe(80);
  });

  it('acumula inner, dieces y emes de toda la temporada', () => {
    const s = archerCareerStats([
      resultado({ tournamentId: 't1', innerCount: 3, tenCount: 5, mCount: 1 }),
      resultado({ tournamentId: 't2', innerCount: 2, tenCount: 4, mCount: 2 }),
    ]);

    expect(s.totalInner).toBe(5);
    expect(s.totalTens).toBe(9);
    expect(s.totalM).toBe(3);
  });

  it('la evolución va de la fecha más vieja a la más nueva', () => {
    const s = archerCareerStats(carrera);

    expect(s.evolution.map((e) => e.tournamentId)).toEqual(['t1', 't2', 't3']);
    expect(s.evolution.map((e) => e.normalizedPct)).toEqual([95, 90, 80]);
  });

  it('con la misma fecha desempata por id, para que el orden no cambie entre llamadas', () => {
    const s = archerCareerStats([
      resultado({ tournamentId: 'tb', date: '2026-03-01' }),
      resultado({ tournamentId: 'ta', date: '2026-03-01' }),
    ]);

    expect(s.evolution.map((e) => e.tournamentId)).toEqual(['ta', 'tb']);
  });

  it('sin torneos no inventa un mejor ni un peor', () => {
    const s = archerCareerStats([]);

    expect(s.tournamentsPlayed).toBe(0);
    expect(s.bestTournamentId).toBeNull();
    expect(s.worstTournamentId).toBeNull();
    expect(s.bestNormalizedPct).toBe(0);
    expect(s.worstNormalizedPct).toBe(0);
    expect(s.evolution).toEqual([]);
  });
});
