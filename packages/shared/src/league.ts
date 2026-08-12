/**
 * Ranking de liga por temporada.
 *
 * Dos modos, por categoría:
 *   - **por posición**: 5-4-3-2-1 según el podio de cada torneo, acumulado
 *   - **mejor de 2**: el promedio de los DOS mejores porcentajes de la temporada
 *
 * «Mejor de 2» reemplazó a «por mejor puntaje». Un solo porcentaje premia el
 * día bueno; el promedio de los dos mejores premia la regularidad, que es lo
 * que la liga quiere medir. El mejor resultado suelto se sigue guardando
 * —`bestNormalizedPct`— porque es un dato que la landing muestra, pero ya no
 * ordena ningún ranking.
 *
 * Sólo los torneos **publicados** impactan la liga, y hacen falta al menos dos
 * torneos disputados para figurar.
 *
 * Ver `docs/DOMAIN_WA.md` §9.
 */

import { LEAGUE_POINTS_BY_POSITION, MIN_TOURNAMENTS_FOR_RANKING } from './constants.js';
import type { BowCategory } from './domain.js';
import { asignarPosiciones, type Rankable, rankAllByCategory } from './ranking.js';
import { comparePersonName, compareText } from './text.js';

/** Acumulado de un arquero en una temporada, para una categoría. */
export interface ArcherStanding {
  readonly archerId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly category: BowCategory;

  readonly leaguePoints: number;
  readonly tournamentsPlayed: number;
  readonly podiums: { readonly first: number; readonly second: number; readonly third: number };

  /** Mejor porcentaje de la temporada, y el bruto y el torneo que lo produjeron. */
  readonly bestNormalizedPct: number;
  readonly bestRawScore: number;
  readonly bestTournamentId: string | null;

  /**
   * Los dos mejores porcentajes de la temporada, **de mayor a menor**.
   *
   * Se guardan los dos y no sólo su promedio porque el acumulado es
   * incremental: para saber si el torneo que llega desplaza a alguno hay que
   * conocer a los dos que están. El promedio se deriva con `bestTwoAvgPct`, así
   * que no hay dos fuentes de verdad que puedan separarse.
   */
  readonly topTwoPcts: readonly number[];

  readonly totalX: number;
  readonly totalTens: number;
  readonly totalM: number;
}

/** Lo que aporta un torneo publicado al acumulado de la temporada. */
export interface TournamentContribution {
  readonly tournamentId: string;
  readonly maxPossibleScore: number;
  readonly participants: readonly Rankable[];
}

export type StandingsMode = 'position' | 'best_two';

export interface RankedStanding extends ArcherStanding {
  /** 1-based. Compartida ante empate. */
  readonly position: number;
  readonly tied: boolean;
}

export interface SortedStandings {
  readonly ranked: readonly RankedStanding[];
  /** Menos de dos torneos disputados. Se muestran aparte, no se ocultan. */
  readonly notYetEligible: readonly ArcherStanding[];
}

/** Puntos de liga por puesto. Del sexto en adelante, 0. */
export function leaguePointsForPosition(position: number): number {
  if (position < 1) return 0;
  return LEAGUE_POINTS_BY_POSITION[position - 1] ?? 0;
}

/**
 * Porcentaje del máximo posible del torneo, redondeado a dos decimales.
 *
 * Es lo que hace comparables dos torneos multitarget con configuraciones
 * distintas: el bruto premiaría al recorrido más largo, no al mejor tiro.
 */
export function normalizedPct(total: number, maxPossibleScore: number): number {
  if (maxPossibleScore <= 0) return 0;
  return Math.round((total / maxPossibleScore) * 10_000) / 100;
}

/** Cuántos porcentajes entran en el promedio de «mejor de 2». */
const CUANTOS_MEJORES = 2;

/**
 * Promedio de los dos mejores porcentajes de la temporada.
 *
 * Con un solo torneo devuelve ese porcentaje —el arquero no clasifica igual,
 * porque el mínimo son dos— y sin ninguno devuelve 0, no `NaN`.
 */
export function bestTwoAvgPct(standing: ArcherStanding): number {
  const pcts = standing.topTwoPcts;
  if (pcts.length === 0) return 0;

  const suma = pcts.reduce((a, b) => a + b, 0);
  return Math.round((suma / pcts.length) * 100) / 100;
}

/** Mete un porcentaje entre los mejores, descartando el peor si sobra. */
function mejoresCon(pcts: readonly number[], nuevo: number): number[] {
  return [...pcts, nuevo].sort((a, b) => b - a).slice(0, CUANTOS_MEJORES);
}

/** `true` si el arquero tiene los torneos mínimos para figurar en los rankings. */
export function eligibleForRanking(standing: ArcherStanding): boolean {
  return standing.tournamentsPlayed >= MIN_TOURNAMENTS_FOR_RANKING;
}

function nuevoStanding(p: Rankable): ArcherStanding {
  return {
    archerId: p.archerId,
    firstName: p.firstName,
    lastName: p.lastName,
    category: p.category,
    leaguePoints: 0,
    tournamentsPlayed: 0,
    podiums: { first: 0, second: 0, third: 0 },
    bestNormalizedPct: 0,
    bestRawScore: 0,
    bestTournamentId: null,
    topTwoPcts: [],
    totalX: 0,
    totalTens: 0,
    totalM: 0,
  };
}

function sumarPodio(
  podiums: ArcherStanding['podiums'],
  position: number,
): ArcherStanding['podiums'] {
  return {
    first: podiums.first + (position === 1 ? 1 : 0),
    second: podiums.second + (position === 2 ? 1 : 0),
    third: podiums.third + (position === 3 ? 1 : 0),
  };
}

/**
 * Aplica un torneo publicado al acumulado de la temporada.
 *
 * Función pura: devuelve un acumulado nuevo, no muta el recibido. Los arqueros
 * que no participaron de este torneo pasan intactos.
 *
 * El puesto compartido reparte los puntos **de esa posición a todos los
 * empatados**: dos primeros se llevan 5 cada uno, y el siguiente queda tercero
 * con 3. Ver `docs/DOMAIN_WA.md` §9.1.
 */
export function applyTournamentToStandings(
  previous: readonly ArcherStanding[],
  tournament: TournamentContribution,
): ArcherStanding[] {
  // Clave por arquero Y categoría: un arquero podría cambiar de categoría entre
  // temporadas, y cada categoría tiene su propio ranking.
  const clave = (archerId: string, category: BowCategory) => `${archerId}::${category}`;

  const acumulado = new Map<string, ArcherStanding>(
    previous.map((s) => [clave(s.archerId, s.category), s]),
  );

  for (const { position, entry } of rankAllByCategory(tournament.participants)) {
    const k = clave(entry.archerId, entry.category);
    const actual = acumulado.get(k) ?? nuevoStanding(entry);

    const pct = normalizedPct(entry.total, tournament.maxPossibleScore);
    const mejora = pct > actual.bestNormalizedPct;

    acumulado.set(k, {
      ...actual,
      // El snapshot del torneo es el dato más reciente del arquero.
      firstName: entry.firstName,
      lastName: entry.lastName,
      leaguePoints: actual.leaguePoints + leaguePointsForPosition(position),
      tournamentsPlayed: actual.tournamentsPlayed + 1,
      podiums: sumarPodio(actual.podiums, position),
      bestNormalizedPct: mejora ? pct : actual.bestNormalizedPct,
      bestRawScore: mejora ? entry.total : actual.bestRawScore,
      bestTournamentId: mejora ? tournament.tournamentId : actual.bestTournamentId,
      topTwoPcts: mejoresCon(actual.topTwoPcts, pct),
      totalX: actual.totalX + entry.innerCount,
      totalTens: actual.totalTens + entry.tenCount,
      totalM: actual.totalM + entry.mCount,
    });
  }

  return [...acumulado.values()];
}

function compararPorPosicion(a: ArcherStanding, b: ArcherStanding): number {
  return (
    b.leaguePoints - a.leaguePoints ||
    b.podiums.first - a.podiums.first ||
    b.podiums.second - a.podiums.second ||
    b.bestNormalizedPct - a.bestNormalizedPct
  );
}

function compararPorMejorDeDos(a: ArcherStanding, b: ArcherStanding): number {
  return bestTwoAvgPct(b) - bestTwoAvgPct(a) || b.totalX - a.totalX || a.totalM - b.totalM;
}

/**
 * Ordena el ranking de una temporada y separa a los que todavía no clasifican.
 *
 * A los que les faltan torneos **no se los oculta**: van en `notYetEligible`,
 * para que nadie crea que se perdió su resultado. Ver `docs/FUNCTIONAL.md` §5.2.
 */
export function sortStandings(
  standings: readonly ArcherStanding[],
  mode: StandingsMode,
): SortedStandings {
  const comparar = mode === 'position' ? compararPorPosicion : compararPorMejorDeDos;

  const elegibles = standings.filter(eligibleForRanking);
  const restantes = standings.filter((s) => !eligibleForRanking(s));

  const desempatar = (a: ArcherStanding, b: ArcherStanding) =>
    comparar(a, b) || comparePersonName(a, b) || compareText(a.archerId, b.archerId);

  const ordenados = [...elegibles].sort(desempatar);

  return {
    ranked: asignarPosiciones(ordenados, comparar).map(({ position, tied, entry }) => ({
      ...entry,
      position,
      tied,
    })),
    notYetEligible: [...restantes].sort(desempatar),
  };
}
