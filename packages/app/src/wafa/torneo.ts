/**
 * Seguimiento y publicación de un torneo.
 *
 * El podio y los puntos de liga se calculan con **las mismas funciones que usa
 * el servidor al publicar** (`rankByCategory`, `leaguePointsForPosition`), así
 * que la vista previa no es una estimación: es lo que va a quedar aplicado.
 *
 * Ver `docs/FUNCTIONAL.md` §6.7 · `docs/DOMAIN_WA.md` §9.
 */

import {
  type BowCategory,
  CATEGORY_INFO,
  leaguePointsForPosition,
  type Rankable,
  type RankedEntry,
  rankByCategory,
  type TournamentStatus,
} from '@bal/shared';

export interface ResultadoParticipante extends Rankable {
  readonly id: string;
  readonly patrolNumber: number;
  readonly normalizedPct: number;
  readonly targetsCompleted: number;
  readonly signed: boolean;
  /** La firma se desbloqueó: nadie firmó de puño y letra. */
  readonly signatureUnlocked: boolean;
}

export interface PatrullaSeguimiento {
  readonly number: number;
  readonly status: string;
  readonly targetsCompleted: number;
  readonly members: readonly { readonly id: string; readonly lastName: string }[];
}

// ── Seguimiento ──────────────────────────────────────────────────────────────

export interface AvanceDePatrulla {
  readonly number: number;
  readonly status: string;
  readonly targetsCompleted: number;
  readonly totalTargets: number;
  readonly pct: number;
  /** Quiénes de la patrulla todavía no firmaron. */
  readonly sinFirmar: readonly ResultadoParticipante[];
}

/**
 * Avance de cada patrulla, con quiénes faltan firmar.
 *
 * El avance viene del servidor —lo actualiza la sincronización— y no se
 * recalcula acá: WAFA lee, no deriva el estado del torneo.
 */
export function avanceDePatrullas(
  patrullas: readonly PatrullaSeguimiento[],
  participantes: readonly ResultadoParticipante[],
  totalTargets: number,
): AvanceDePatrulla[] {
  return [...patrullas]
    .sort((a, b) => a.number - b.number)
    .map((p) => ({
      number: p.number,
      status: p.status,
      targetsCompleted: p.targetsCompleted,
      totalTargets,
      pct: totalTargets > 0 ? Math.round((p.targetsCompleted / totalTargets) * 100) : 0,
      sinFirmar: participantes.filter((m) => m.patrolNumber === p.number && !m.signed),
    }));
}

/** Motivo por el que un blanco no se puede editar, o `undefined` si se puede. */
export function motivoDeBloqueo(
  targetIndex: number,
  bloqueados: readonly number[],
  status: TournamentStatus,
): string | undefined {
  if (status === 'publicado' || status === 'completado') {
    return 'El torneo ya terminó: el recorrido no se toca.';
  }
  if (bloqueados.includes(targetIndex)) {
    return 'Ya tiene puntajes cargados. Editarlo cambiaría resultados que alguien ya firmó.';
  }
  return undefined;
}

// ── Podio y puntos de liga ───────────────────────────────────────────────────

export interface FilaDePodio {
  readonly position: number;
  readonly tied: boolean;
  readonly leaguePoints: number;
  readonly participante: ResultadoParticipante;
}

export interface PodioDeCategoria {
  readonly category: BowCategory;
  readonly label: string;
  readonly filas: readonly FilaDePodio[];
}

/**
 * Podios por categoría con los puntos de liga que se aplicarían.
 *
 * Los ausentes ya los deja afuera `rankByCategory`. El puesto compartido reparte
 * los puntos **de esa posición a todos los empatados**: dos primeros se llevan 5
 * cada uno, y el siguiente queda tercero con 3.
 */
export function podiosConPuntos(
  participantes: readonly ResultadoParticipante[],
): PodioDeCategoria[] {
  const porCategoria = rankByCategory(participantes);

  return Object.entries(porCategoria)
    .filter(([, entradas]) => entradas !== undefined && entradas.length > 0)
    .map(([category, entradas]) => ({
      category: category as BowCategory,
      label: CATEGORY_INFO[category as BowCategory].label,
      filas: (entradas as RankedEntry<ResultadoParticipante>[]).map((e) => ({
        position: e.position,
        tied: e.tied,
        leaguePoints: leaguePointsForPosition(e.position),
        participante: e.entry,
      })),
    }));
}

/** Cuántos puntos de liga sumaría cada arquero. Sólo los que suman algo. */
export function puntosQueSeAplicarian(
  participantes: readonly ResultadoParticipante[],
): { readonly participante: ResultadoParticipante; readonly puntos: number }[] {
  return podiosConPuntos(participantes)
    .flatMap((p) => p.filas)
    .filter((f) => f.leaguePoints > 0)
    .map((f) => ({ participante: f.participante, puntos: f.leaguePoints }));
}

// ── Guardas de publicación ───────────────────────────────────────────────────

export interface AvisoDePublicacion {
  readonly nivel: 'error' | 'aviso';
  readonly mensaje: string;
}

/**
 * Lo que hay que mirar antes de publicar.
 *
 * Un `error` lo rechazaría el servidor igual. Un `aviso` no frena: son cosas que
 * el admin tiene que **ver** antes de aplicar los resultados a la liga, no
 * motivos para impedirlo.
 */
export function avisosDePublicacion(
  status: TournamentStatus,
  participantes: readonly ResultadoParticipante[],
): AvisoDePublicacion[] {
  const avisos: AvisoDePublicacion[] = [];

  if (status !== 'completado') {
    avisos.push({
      nivel: 'error',
      mensaje: 'Sólo se puede publicar un torneo completado, con todas las patrullas cerradas.',
    });
  }

  const desbloqueadas = participantes.filter((p) => p.signatureUnlocked);
  if (desbloqueadas.length > 0) {
    const nombres = desbloqueadas.map((p) => `${p.lastName}, ${p.firstName}`).join(' · ');
    avisos.push({
      nivel: 'aviso',
      mensaje: `Hay firmas desbloqueadas por vos: ${nombres}. Sus puntajes entran igual a la liga.`,
    });
  }

  const ausentes = participantes.filter((p) => p.status === 'ausente');
  if (ausentes.length > 0) {
    avisos.push({
      nivel: 'aviso',
      mensaje: `${ausentes.length} ${ausentes.length === 1 ? 'arquero figura' : 'arqueros figuran'} como ausente: no entran al podio ni suman puntos.`,
    });
  }

  return avisos;
}

/** `true` si se puede intentar publicar. Los avisos no frenan; los errores sí. */
export function sePuedePublicar(avisos: readonly AvisoDePublicacion[]): boolean {
  return !avisos.some((a) => a.nivel === 'error');
}
