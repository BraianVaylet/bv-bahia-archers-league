/**
 * La temporada que la landing nombra (`REF7-5`): en el pie y, desde `REF7-6`, en el hero.
 *
 * Es la **activa**. `/api/public/seasons` las devuelve de la más nueva a la más vieja, así que se
 * toma la primera activa. Si no hay ninguna, no se inventa una: quien la muestra la omite.
 */

import { useRecurso } from './useRecurso.js';

export interface Temporada {
  readonly id: string;
  readonly name: string;
  readonly status: 'activa' | 'cerrada';
}

export function temporadaActiva(temporadas: readonly Temporada[]): Temporada | null {
  return temporadas.find((t) => t.status === 'activa') ?? null;
}

/** La temporada activa, o `null` mientras carga, si falla o si no hay ninguna. */
export function useTemporadaActiva(): Temporada | null {
  const temporadas = useRecurso<{ seasons: Temporada[] }>('/seasons');
  return temporadas.estado === 'listo' ? temporadaActiva(temporadas.datos.seasons) : null;
}
