/**
 * Ranking de liga por temporada.
 *
 * Un solo modo, por categoría: **mejor de N** — el promedio de los N mejores
 * porcentajes de la temporada. `N` (`bestN`) lo decide quien llama, nunca una
 * constante de este módulo: en producción viene de `LEAGUE_BEST_N` (`BE-18`).
 *
 * El ranking «por posición» (puntos 5-4-3-2-1 por puesto en cada torneo) y los
 * acumulados `leaguePoints`/`podiums` que lo sostenían se retiraron el
 * 2026-10-24. Ver `docs/BITACORA.md`, esa fecha.
 *
 * Sólo los torneos **publicados** impactan la liga, y hacen falta al menos
 * `bestN` torneos disputados para figurar — el mismo número que hacen falta
 * marcas para que el promedio de «mejor de N» tenga sentido.
 *
 * Ver `docs/DOMAIN_WA.md` §9.
 */

import type { BowCategory, Sex } from './domain.js';
import { asignarPosiciones, type Rankable, rankAllByCategory } from './ranking.js';
import { comparePersonName, compareText } from './text.js';

/** Acumulado de un arquero en una temporada, para una categoría. */
export interface ArcherStanding {
  readonly archerId: string;
  /** Ausente en el padrón viejo (`docs/DOMAIN_WA.md` §9). No rankea sin esto, pero sigue en el general. */
  readonly sex?: Sex;
  readonly firstName: string;
  readonly lastName: string;
  readonly category: BowCategory;

  readonly tournamentsPlayed: number;

  /** Mejor porcentaje de la temporada, y el bruto y el torneo que lo produjeron. */
  readonly bestNormalizedPct: number;
  readonly bestRawScore: number;
  readonly bestTournamentId: string | null;

  /**
   * Los `bestN` mejores porcentajes de la temporada, **de mayor a menor**.
   *
   * Se guardan todos y no sólo su promedio porque el acumulado es
   * incremental: para saber si el torneo que llega desplaza a alguno hay que
   * conocer a los que están. El promedio se deriva con `bestNAvgPct`, así que
   * no hay dos fuentes de verdad que puedan separarse.
   */
  readonly topNPcts: readonly number[];

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

export interface RankedStanding extends ArcherStanding {
  /** 1-based. Compartida ante empate. */
  readonly position: number;
  readonly tied: boolean;
}

export interface SortedStandings {
  readonly ranked: readonly RankedStanding[];
  /** Menos de `bestN` torneos disputados. Se muestran aparte, no se ocultan. */
  readonly notYetEligible: readonly ArcherStanding[];
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

/**
 * Promedio de los porcentajes guardados en `topNPcts`.
 *
 * No recibe `bestN`: promedia lo que haya, sea cuanto sea. El tope de cuántos
 * entran ahí lo pone `applyTournamentToStandings`, no esta función — las dos
 * fuentes de la cuenta quedarían separadas si cada una tuviera su propio N.
 *
 * Sin ningún porcentaje guardado devuelve 0, no `NaN`.
 */
export function bestNAvgPct(standing: ArcherStanding): number {
  const pcts = standing.topNPcts;
  if (pcts.length === 0) return 0;

  const suma = pcts.reduce((a, b) => a + b, 0);
  return Math.round((suma / pcts.length) * 100) / 100;
}

/** Mete un porcentaje entre los `bestN` mejores, descartando el peor si sobra. */
function mejoresCon(pcts: readonly number[], nuevo: number, bestN: number): number[] {
  return [...pcts, nuevo].sort((a, b) => b - a).slice(0, bestN);
}

/** `true` si el arquero tiene al menos `bestN` torneos jugados. */
export function eligibleForRanking(standing: ArcherStanding, bestN: number): boolean {
  return standing.tournamentsPlayed >= bestN;
}

function nuevoStanding(p: Rankable): ArcherStanding {
  return {
    archerId: p.archerId,
    // `exactOptionalPropertyTypes`: si no hay sexo, la clave ni se escribe —
    // `sex: undefined` es un valor distinto de «ausente» con esta opción.
    ...(p.sex ? { sex: p.sex } : {}),
    firstName: p.firstName,
    lastName: p.lastName,
    category: p.category,
    tournamentsPlayed: 0,
    bestNormalizedPct: 0,
    bestRawScore: 0,
    bestTournamentId: null,
    topNPcts: [],
    totalX: 0,
    totalTens: 0,
    totalM: 0,
  };
}

/**
 * Aplica un torneo publicado al acumulado de la temporada.
 *
 * Función pura: devuelve un acumulado nuevo, no muta el recibido. Los arqueros
 * que no participaron de este torneo pasan intactos.
 *
 * `bestN` es cuántos porcentajes se guardan en `topNPcts` — el mismo número
 * que después exige `eligibleForRanking` para figurar en el ranking.
 */
export function applyTournamentToStandings(
  previous: readonly ArcherStanding[],
  tournament: TournamentContribution,
  bestN: number,
): ArcherStanding[] {
  // Clave por arquero Y categoría: un arquero podría cambiar de categoría entre
  // temporadas, y cada categoría tiene su propio ranking.
  const clave = (archerId: string, category: BowCategory) => `${archerId}::${category}`;

  const acumulado = new Map<string, ArcherStanding>(
    previous.map((s) => [clave(s.archerId, s.category), s]),
  );

  for (const { entry } of rankAllByCategory(tournament.participants)) {
    const k = clave(entry.archerId, entry.category);
    const actual = acumulado.get(k) ?? nuevoStanding(entry);

    const pct = normalizedPct(entry.total, tournament.maxPossibleScore);
    const mejora = pct > actual.bestNormalizedPct;

    acumulado.set(k, {
      ...actual,
      // El snapshot del torneo es el dato más reciente del arquero. `sex` es
      // la excepción: un snapshot viejo sin el campo no puede desconocer lo
      // que un snapshot más nuevo ya había informado. Con `exactOptionalPropertyTypes`,
      // la clave se omite del todo en vez de escribirse como `undefined`.
      firstName: entry.firstName,
      lastName: entry.lastName,
      ...((entry.sex ?? actual.sex) ? { sex: entry.sex ?? actual.sex } : {}),
      tournamentsPlayed: actual.tournamentsPlayed + 1,
      bestNormalizedPct: mejora ? pct : actual.bestNormalizedPct,
      bestRawScore: mejora ? entry.total : actual.bestRawScore,
      bestTournamentId: mejora ? tournament.tournamentId : actual.bestTournamentId,
      topNPcts: mejoresCon(actual.topNPcts, pct, bestN),
      totalX: actual.totalX + entry.innerCount,
      totalTens: actual.totalTens + entry.tenCount,
      totalM: actual.totalM + entry.mCount,
    });
  }

  return [...acumulado.values()];
}

function compararPorMejorDeN(a: ArcherStanding, b: ArcherStanding): number {
  return bestNAvgPct(b) - bestNAvgPct(a) || b.totalX - a.totalX || a.totalM - b.totalM;
}

/**
 * Ordena el ranking de una temporada y separa a los que todavía no clasifican.
 *
 * A los que les faltan torneos **no se los oculta**: van en `notYetEligible`,
 * para que nadie crea que se perdió su resultado. Ver `docs/FUNCTIONAL.md` §5.2.
 */
export function sortStandings(
  standings: readonly ArcherStanding[],
  bestN: number,
): SortedStandings {
  const elegibles = standings.filter((s) => eligibleForRanking(s, bestN));
  const restantes = standings.filter((s) => !eligibleForRanking(s, bestN));

  const desempatar = (a: ArcherStanding, b: ArcherStanding) =>
    compararPorMejorDeN(a, b) || comparePersonName(a, b) || compareText(a.archerId, b.archerId);

  const ordenados = [...elegibles].sort(desempatar);

  return {
    ranked: asignarPosiciones(ordenados, compararPorMejorDeN).map(({ position, tied, entry }) => ({
      ...entry,
      position,
      tied,
    })),
    notYetEligible: [...restantes].sort(desempatar),
  };
}

/** Las tres vistas del ranking de liga: General, Femenino y Masculino. */
export interface StandingsPorSexo {
  readonly general: SortedStandings;
  readonly femenino: SortedStandings;
  readonly masculino: SortedStandings;
}

/**
 * Las tres vistas, cada una ordenada sobre **su propia pool**.
 *
 * No es `sortStandings` una vez y después filtrar el resultado: el puesto
 * compartido y el salto de posición dependen de contra quién se compite, así
 * que cada vista se arma filtrando el acumulado **antes** de ordenar. Una
 * arquera que es cuarta en el general puede ser primera en el femenino.
 *
 * Un arquero sin `sex` (padrón viejo, `docs/DOMAIN_WA.md` §9) entra al general
 * igual que cualquiera, y no entra a ninguna de las dos vistas por sexo — no
 * se le inventa un valor.
 */
export function sortStandingsByGender(
  standings: readonly ArcherStanding[],
  bestN: number,
): StandingsPorSexo {
  return {
    general: sortStandings(standings, bestN),
    femenino: sortStandings(
      standings.filter((s) => s.sex === 'femenino'),
      bestN,
    ),
    masculino: sortStandings(
      standings.filter((s) => s.sex === 'masculino'),
      bestN,
    ),
  };
}
