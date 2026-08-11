/**
 * Estadísticas derivadas.
 *
 * Tres niveles: un participante dentro de un torneo, el torneo completo, y un
 * arquero a lo largo de la temporada.
 *
 * Dos criterios atraviesan todo el módulo:
 *
 *   1. **Nada se compara por el bruto entre configuraciones distintas.** Un
 *      blanco 3D tiene techo 22 y uno de sala 30; un torneo de 14 blancos tiene
 *      más techo que uno de 10. Comparar brutos premia al recorrido más largo,
 *      no al mejor tiro. Mejor y peor —de blanco y de torneo— se miden en
 *      porcentaje.
 *
 *   2. **Los datos llegan ya validados.** El servidor es la autoridad del
 *      scoring y valida al escribir. Si acá aparece un token que no pertenece a
 *      la modalidad, es corrupción de datos: se rompe en vez de puntuarlo 0, que
 *      mostraría un total equivocado con cara de correcto.
 *
 * Ver `docs/DOMAIN_WA.md` §10.
 */

import { SCORING } from './constants.js';
import {
  BOW_CATEGORIES,
  type BowCategory,
  MISS_TOKEN,
  MODALITIES,
  type Modality,
  X_TOKEN,
} from './domain.js';
import { maxTargetScore, tokenValue } from './scoring.js';
import { compareText } from './text.js';

/** Redondeo a dos decimales, el que usa toda la app para mostrar promedios. */
function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Porcentaje sobre un máximo, con dos decimales. 0 si el máximo es 0. */
function porcentaje(total: number, maximo: number): number {
  return maximo > 0 ? redondear((total / maximo) * 100) : 0;
}

// ── Participante en un torneo ────────────────────────────────────────────────

/** Un blanco cargado, tal como quedó en la planilla. */
export interface StatTarget {
  /** Número del blanco en el recorrido. */
  readonly index: number;
  readonly modality: Modality;
  readonly arrows: readonly string[];
}

export interface TargetStat {
  readonly index: number;
  readonly modality: Modality;
  readonly total: number;
  /** Máximo de las flechas efectivamente tiradas. */
  readonly maxPossible: number;
  readonly pct: number;
}

export interface ModalityStat {
  readonly modality: Modality;
  readonly targets: number;
  readonly arrowsShot: number;
  readonly total: number;
  readonly maxPossible: number;
  readonly pct: number;
  /**
   * Conteo de cada token **del set de esta modalidad**, incluidos los que no
   * salieron. La distribución no se agrega entre modalidades: un `6` de campo es
   * el máximo y un `6` de sala es mediocre; sumarlos no significaría nada.
   */
  readonly distribution: Readonly<Record<string, number>>;
}

export interface ParticipantStats {
  readonly targetsCompleted: number;
  readonly arrowsShot: number;
  readonly total: number;
  /** Máximo de lo tirado, no del torneo: un recorrido a medias no rinde de menos. */
  readonly maxPossible: number;
  readonly pct: number;
  readonly averagePerArrow: number;
  readonly averagePerTarget: number;
  /** Medidos en porcentaje del techo de cada blanco. `null` sin blancos. */
  readonly bestTarget: TargetStat | null;
  readonly worstTarget: TargetStat | null;
  readonly innerCount: number;
  readonly xCount: number;
  readonly tenCount: number;
  readonly mCount: number;
  /** En el orden en que se tiró, que es el del recorrido rotado, no el numérico. */
  readonly evolution: readonly {
    readonly index: number;
    readonly total: number;
    readonly cumulative: number;
  }[];
  readonly byModality: readonly ModalityStat[];
}

interface AcumuladorModalidad {
  targets: number;
  arrowsShot: number;
  total: number;
  maxPossible: number;
  /** Los tokens tal cual se tiraron. La distribución se cuenta al final. */
  tokens: string[];
}

function acumuladorNuevo(): AcumuladorModalidad {
  return { targets: 0, arrowsShot: 0, total: 0, maxPossible: 0, tokens: [] };
}

/**
 * Cuenta cada token **del set de la modalidad**, incluidos los que no salieron.
 *
 * Se recorre el set y no los tokens tirados: así el resultado siempre tiene las
 * mismas claves, y una tabla de distribución no cambia de columnas según lo que
 * el arquero haya acertado.
 */
function distribucionDe(modality: Modality, tokens: readonly string[]): Record<string, number> {
  const distribution: Record<string, number> = {};

  for (const token of SCORING[modality].scoringSet) {
    distribution[token] = tokens.filter((t) => t === token).length;
  }

  return distribution;
}

/** Los conteos de desempate y de fallo de un puñado de flechas. */
interface Conteos {
  readonly innerCount: number;
  readonly xCount: number;
  readonly tenCount: number;
  readonly mCount: number;
}

const CONTEOS_EN_CERO: Conteos = { innerCount: 0, xCount: 0, tenCount: 0, mCount: 0 };

function sumarConteos(a: Conteos, b: Conteos): Conteos {
  return {
    innerCount: a.innerCount + b.innerCount,
    xCount: a.xCount + b.xCount,
    tenCount: a.tenCount + b.tenCount,
    mCount: a.mCount + b.mCount,
  };
}

/** Un blanco ya resuelto: su puntaje y lo que aporta a los conteos. */
interface BlancoComputado {
  readonly stat: TargetStat;
  readonly conteos: Conteos;
}

/**
 * Resuelve un blanco.
 *
 * @throws {DomainError} `INVALID_TOKEN` si un token no pertenece a la modalidad.
 */
function computarBlanco(target: StatTarget): BlancoComputado {
  const cfg = SCORING[target.modality];
  let total = 0;
  let innerCount = 0;
  let xCount = 0;
  let tenCount = 0;
  let mCount = 0;

  for (const token of target.arrows) {
    // Lanza si el token no pertenece a la modalidad: ver la cabecera del módulo.
    const valor = tokenValue(target.modality, token);

    total += valor;
    // El `11` del 3D vale más que 10 y no cuenta como diez; la `X` de sala vale
    // 10 y sí cuenta. Por eso se mira el valor y no el token.
    if (valor === 10) tenCount++;
    if (token === cfg.innerToken) innerCount++;
    if (cfg.hasX && token === X_TOKEN) xCount++;
    if (token === MISS_TOKEN) mCount++;
  }

  const maxPossible = maxTargetScore(target.modality, target.arrows.length);

  return {
    stat: {
      index: target.index,
      modality: target.modality,
      total,
      maxPossible,
      pct: porcentaje(total, maxPossible),
    },
    conteos: { innerCount, xCount, tenCount, mCount },
  };
}

/**
 * Mejor y peor blanco, medidos en porcentaje del techo de cada uno.
 *
 * A igual porcentaje, el mejor es el de menor número y el peor el de mayor: sin
 * ese criterio, cuál gana dependería de por dónde arrancó la patrulla.
 */
function mejorYPeor(blancos: readonly TargetStat[]): {
  best: TargetStat | null;
  worst: TargetStat | null;
} {
  const mejorQue = (a: TargetStat, b: TargetStat) =>
    a.pct > b.pct || (a.pct === b.pct && a.index < b.index);

  let best: TargetStat | null = null;
  let worst: TargetStat | null = null;

  for (const blanco of blancos) {
    if (best === null || mejorQue(blanco, best)) best = blanco;
    if (worst === null || mejorQue(worst, blanco)) worst = blanco;
  }

  return { best, worst };
}

/**
 * Estadísticas de un participante a partir de sus blancos cargados.
 *
 * @throws {DomainError} `INVALID_TOKEN` si un token no pertenece a su modalidad.
 */
export function participantStats(targets: readonly StatTarget[]): ParticipantStats {
  const porModalidad = new Map<Modality, AcumuladorModalidad>();
  const evolution: { index: number; total: number; cumulative: number }[] = [];
  const porBlanco: TargetStat[] = [];

  let conteos = CONTEOS_EN_CERO;
  let total = 0;
  let maxPossible = 0;
  let arrowsShot = 0;

  for (const target of targets) {
    const { stat, conteos: delBlanco } = computarBlanco(target);
    const acumulador = porModalidad.get(target.modality) ?? acumuladorNuevo();

    conteos = sumarConteos(conteos, delBlanco);
    total += stat.total;
    maxPossible += stat.maxPossible;
    arrowsShot += target.arrows.length;

    acumulador.targets++;
    acumulador.arrowsShot += target.arrows.length;
    acumulador.total += stat.total;
    acumulador.maxPossible += stat.maxPossible;
    acumulador.tokens.push(...target.arrows);
    porModalidad.set(target.modality, acumulador);

    evolution.push({ index: target.index, total: stat.total, cumulative: total });
    porBlanco.push(stat);
  }

  const { best, worst } = mejorYPeor(porBlanco);

  return {
    targetsCompleted: targets.length,
    arrowsShot,
    total,
    maxPossible,
    pct: porcentaje(total, maxPossible),
    averagePerArrow: arrowsShot > 0 ? redondear(total / arrowsShot) : 0,
    averagePerTarget: targets.length > 0 ? redondear(total / targets.length) : 0,
    bestTarget: best,
    worstTarget: worst,
    ...conteos,
    evolution,
    // En el orden del dominio, no en el de aparición: la tabla no se reordena
    // sola según en qué blanco arrancó cada patrulla.
    byModality: [...porModalidad.entries()]
      .sort(([a], [b]) => MODALITIES.indexOf(a) - MODALITIES.indexOf(b))
      .map(([modality, a]) => ({
        modality,
        targets: a.targets,
        arrowsShot: a.arrowsShot,
        total: a.total,
        maxPossible: a.maxPossible,
        pct: porcentaje(a.total, a.maxPossible),
        distribution: distribucionDe(modality, a.tokens),
      })),
  };
}

// ── Torneo ───────────────────────────────────────────────────────────────────

/** Rollup denormalizado de un participante. No se recorren las flechas. */
export interface StatParticipantRollup {
  readonly participantId: string;
  readonly category: BowCategory;
  readonly total: number;
  readonly innerCount: number;
  readonly tenCount: number;
  readonly mCount: number;
  readonly targetsCompleted: number;
  /** Un `ausente` no tiró: no entra en ninguna agregación. */
  readonly status?: 'activo' | 'ausente';
}

export interface CategoryStat {
  readonly category: BowCategory;
  readonly participants: number;
  readonly averageScore: number;
  readonly bestScore: number;
}

export interface TournamentStats {
  readonly participants: number;
  readonly totalInner: number;
  readonly totalTens: number;
  readonly totalM: number;
  readonly averageScore: number;
  /** `null` si no hay participantes: no se inventa un cero. */
  readonly bestScore: number | null;
  readonly byCategory: readonly CategoryStat[];
}

/**
 * Agregados del torneo desde los rollups.
 *
 * Los ausentes quedan afuera: su cero hundiría el promedio del torneo sin que
 * nadie haya tirado mal.
 */
export function tournamentStats(participants: readonly StatParticipantRollup[]): TournamentStats {
  const activos = participants.filter((p) => p.status !== 'ausente');

  let totalInner = 0;
  let totalTens = 0;
  let totalM = 0;
  let suma = 0;
  let bestScore: number | null = null;

  for (const p of activos) {
    totalInner += p.innerCount;
    totalTens += p.tenCount;
    totalM += p.mCount;
    suma += p.total;
    if (bestScore === null || p.total > bestScore) bestScore = p.total;
  }

  const byCategory: CategoryStat[] = [];
  for (const category of BOW_CATEGORIES) {
    const grupo = activos.filter((p) => p.category === category);
    if (grupo.length === 0) continue;

    const sumaGrupo = grupo.reduce((n, p) => n + p.total, 0);
    byCategory.push({
      category,
      participants: grupo.length,
      averageScore: redondear(sumaGrupo / grupo.length),
      bestScore: Math.max(...grupo.map((p) => p.total)),
    });
  }

  return {
    participants: activos.length,
    totalInner,
    totalTens,
    totalM,
    averageScore: activos.length > 0 ? redondear(suma / activos.length) : 0,
    bestScore,
    byCategory,
  };
}

// ── Avance por patrulla ──────────────────────────────────────────────────────

export interface StatPatrolMember {
  readonly patrolId: string;
  readonly patrolNumber: number;
  readonly targetsCompleted: number;
}

export interface PatrolProgress {
  readonly patrolId: string;
  readonly patrolNumber: number;
  readonly participants: number;
  /** El del arquero más atrasado. */
  readonly targetsCompleted: number;
  readonly totalTargets: number;
  readonly pct: number;
}

/**
 * Avance de cada patrulla del torneo.
 *
 * El avance es el del arquero **más atrasado**: un blanco no está listo hasta
 * que lo cargaron todos. Es lo mismo que muestra WAFL en el circuito.
 */
export function patrolProgress(
  members: readonly StatPatrolMember[],
  totalTargets: number,
): PatrolProgress[] {
  const porPatrulla = new Map<string, StatPatrolMember[]>();

  for (const m of members) {
    const grupo = porPatrulla.get(m.patrolId) ?? [];
    grupo.push(m);
    porPatrulla.set(m.patrolId, grupo);
  }

  return [...porPatrulla.values()]
    .map((grupo) => {
      const primero = grupo[0] as StatPatrolMember;
      const completados = Math.min(...grupo.map((m) => m.targetsCompleted));

      return {
        patrolId: primero.patrolId,
        patrolNumber: primero.patrolNumber,
        participants: grupo.length,
        targetsCompleted: completados,
        totalTargets,
        pct: porcentaje(completados, totalTargets),
      };
    })
    .sort((a, b) => a.patrolNumber - b.patrolNumber || compareText(a.patrolId, b.patrolId));
}

// ── Arquero en la temporada ──────────────────────────────────────────────────

/** Lo que dejó un torneo publicado en la ficha del arquero. */
export interface ArcherTournamentResult {
  readonly tournamentId: string;
  readonly tournamentName: string;
  /** ISO `YYYY-MM-DD`. Ordena la evolución. */
  readonly date: string;
  readonly category: BowCategory;
  readonly total: number;
  readonly maxPossibleScore: number;
  readonly position: number;
  readonly leaguePoints: number;
  readonly innerCount: number;
  readonly tenCount: number;
  readonly mCount: number;
}

export interface CareerEntry extends ArcherTournamentResult {
  readonly normalizedPct: number;
}

export interface ArcherCareerStats {
  readonly tournamentsPlayed: number;
  readonly leaguePoints: number;
  readonly bestNormalizedPct: number;
  readonly bestRawScore: number;
  readonly bestTournamentId: string | null;
  readonly worstNormalizedPct: number;
  readonly worstRawScore: number;
  readonly worstTournamentId: string | null;
  readonly totalInner: number;
  readonly totalTens: number;
  readonly totalM: number;
  /** De la fecha más vieja a la más nueva. */
  readonly evolution: readonly CareerEntry[];
}

/**
 * Ficha histórica de un arquero.
 *
 * Mejor y peor se miden en **porcentaje**: el bruto premiaría al torneo con el
 * recorrido más largo. Ver `docs/DOMAIN_WA.md` §9.2.
 */
export function archerCareerStats(results: readonly ArcherTournamentResult[]): ArcherCareerStats {
  const entradas: CareerEntry[] = results
    .map((r) => ({ ...r, normalizedPct: porcentaje(r.total, r.maxPossibleScore) }))
    // Desempate por id: dos torneos el mismo día no pueden cambiar de orden
    // entre dos llamadas con los mismos datos.
    .sort((a, b) => compareText(a.date, b.date) || compareText(a.tournamentId, b.tournamentId));

  let mejor: CareerEntry | null = null;
  let peor: CareerEntry | null = null;
  let leaguePoints = 0;
  let totalInner = 0;
  let totalTens = 0;
  let totalM = 0;

  for (const e of entradas) {
    leaguePoints += e.leaguePoints;
    totalInner += e.innerCount;
    totalTens += e.tenCount;
    totalM += e.mCount;

    if (mejor === null || e.normalizedPct > mejor.normalizedPct) mejor = e;
    if (peor === null || e.normalizedPct < peor.normalizedPct) peor = e;
  }

  return {
    tournamentsPlayed: entradas.length,
    leaguePoints,
    bestNormalizedPct: mejor?.normalizedPct ?? 0,
    bestRawScore: mejor?.total ?? 0,
    bestTournamentId: mejor?.tournamentId ?? null,
    worstNormalizedPct: peor?.normalizedPct ?? 0,
    worstRawScore: peor?.total ?? 0,
    worstTournamentId: peor?.tournamentId ?? null,
    totalInner,
    totalTens,
    totalM,
    evolution: entradas,
  };
}
