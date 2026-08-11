/**
 * Ranking dentro de un torneo.
 *
 * Todos los participantes recorren los **mismos blancos** —sólo cambia el orden
 * de inicio— así que los totales del torneo son directamente comparables entre
 * sí. La normalización de `league.ts` hace falta sólo al comparar **entre**
 * torneos distintos.
 *
 * Ver `docs/DOMAIN_WA.md` §8.
 */

import { BOW_CATEGORIES, type BowCategory, STAKES, type Stake } from './domain.js';
import { comparePersonName, compareText } from './text.js';

/** Lo mínimo que hace falta de un participante para rankearlo. */
export interface Rankable {
  readonly participantId: string;
  readonly archerId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly category: BowCategory;
  readonly stake: Stake;
  readonly total: number;
  /** `X` + `X6` + `11`, según los blancos tirados. */
  readonly innerCount: number;
  /** Flechas que valen 10. La `X` entra. Ver `docs/DOMAIN_WA.md` §8. */
  readonly tenCount: number;
  readonly mCount: number;
  /** Un participante `ausente` no puntúa ni entra al podio. */
  readonly status?: 'activo' | 'ausente';
}

export interface RankedEntry<T extends Rankable> {
  /** 1-based. Compartida ante empate: 1, 2, 2, 4. */
  readonly position: number;
  /** `true` si comparte posición con al menos otro. */
  readonly tied: boolean;
  readonly entry: T;
}

/**
 * Compara dos participantes por los cuatro criterios del reglamento.
 * Devuelve 0 si empatan en los cuatro: eso es lo que produce el puesto compartido.
 */
export function compareForRanking(a: Rankable, b: Rankable): number {
  return (
    b.total - a.total ||
    b.innerCount - a.innerCount ||
    b.tenCount - a.tenCount ||
    // Menos M es mejor: acá el orden se invierte.
    a.mCount - b.mCount
  );
}

/** Desempate de presentación. No afecta la posición, sólo el orden de la lista. */
function compararParaMostrar(a: Rankable, b: Rankable): number {
  return (
    compareForRanking(a, b) ||
    comparePersonName(a, b) ||
    compareText(a.participantId, b.participantId)
  );
}

/**
 * Ordena y asigna posiciones, con puesto compartido ante empate.
 *
 * Los participantes `ausente` quedan afuera: no puntúan ni entran al podio.
 * No muta el array recibido.
 */
export function rankParticipants<T extends Rankable>(participants: readonly T[]): RankedEntry<T>[] {
  const ordenados = participants
    .filter((p) => p.status !== 'ausente')
    .slice()
    .sort(compararParaMostrar);

  return asignarPosiciones(ordenados, compareForRanking);
}

/**
 * Asigna posiciones a una lista **ya ordenada**, con puesto compartido.
 *
 * Quien empata con el anterior hereda su posición; quien no, toma `índice + 1`.
 * Eso es lo que produce el salto del reglamento: 1, 2, 2, 4.
 */
export function asignarPosiciones<T>(
  ordenados: readonly T[],
  empatan: (a: T, b: T) => number,
): { position: number; tied: boolean; entry: T }[] {
  let entryPrevio: T | undefined;
  let posicionPrevia = 0;

  const conPosicion = ordenados.map((entry, i) => {
    const position =
      entryPrevio !== undefined && empatan(entryPrevio, entry) === 0 ? posicionPrevia : i + 1;
    entryPrevio = entry;
    posicionPrevia = position;
    return { position, entry };
  });

  // Comparar con los vecinos en vez de contar por posición: la lista está
  // ordenada, así que los que comparten puesto son siempre contiguos.
  return conPosicion.map((e, i) => ({
    ...e,
    tied:
      conPosicion[i - 1]?.position === e.position || conPosicion[i + 1]?.position === e.position,
  }));
}

function agrupar<T extends Rankable, K extends string>(
  participants: readonly T[],
  claves: readonly K[],
  clave: (p: T) => K,
): Partial<Record<K, RankedEntry<T>[]>> {
  const resultado: Partial<Record<K, RankedEntry<T>[]>> = {};

  for (const k of claves) {
    const delGrupo = participants.filter((p) => clave(p) === k);
    if (delGrupo.length > 0) resultado[k] = rankParticipants(delGrupo);
  }

  return resultado;
}

/**
 * Podio por categoría. Sólo aparecen las categorías con participantes.
 * `escuela` se rankea como una más.
 */
export function rankByCategory<T extends Rankable>(
  participants: readonly T[],
): Partial<Record<BowCategory, RankedEntry<T>[]>> {
  return agrupar(participants, BOW_CATEGORIES, (p) => p.category);
}

/** Podio por estaca. Sólo aparecen las estacas con participantes. */
export function rankByStake<T extends Rankable>(
  participants: readonly T[],
): Partial<Record<Stake, RankedEntry<T>[]>> {
  return agrupar(participants, STAKES, (p) => p.stake);
}

/**
 * Todas las entradas rankeadas por categoría, en una sola lista.
 *
 * Cada participante trae la posición **de su categoría**, que es la que reparte
 * los puntos de liga. Ver `docs/DOMAIN_WA.md` §9.1.
 */
export function rankAllByCategory<T extends Rankable>(
  participants: readonly T[],
): RankedEntry<T>[] {
  return BOW_CATEGORIES.flatMap((categoria) => {
    const delGrupo = participants.filter((p) => p.category === categoria);
    return delGrupo.length > 0 ? rankParticipants(delGrupo) : [];
  });
}
