/**
 * La temporada que la landing nombra (`REF7-5`): en el pie y, desde `REF7-6`, en el hero y en el
 * ranking de la portada.
 *
 * Es la **activa**. `/api/public/seasons` las devuelve de la más nueva a la más vieja, así que se
 * toma la primera activa. Si no hay ninguna, no se inventa una: quien la muestra la omite.
 *
 * **Se pide una sola vez.** El pie y la portada necesitan las temporadas, y `useRecurso` no
 * deduplica: `App` las pide y las comparte con `ProveedorDeTemporadas`. Una pantalla montada sola
 * (los tests, por ejemplo) no tiene proveedor y las pide por su cuenta.
 */

import { createContext, type ReactNode, useContext } from 'react';
import { type Recurso, useRecurso } from './useRecurso.js';

export interface Temporada {
  readonly id: string;
  readonly name: string;
  readonly status: 'activa' | 'cerrada';
  readonly startsAt?: string;
}

type RecursoDeTemporadas = Recurso<{ seasons: Temporada[] }>;

export function temporadaActiva(temporadas: readonly Temporada[]): Temporada | null {
  return temporadas.find((t) => t.status === 'activa') ?? null;
}

const Contexto = createContext<RecursoDeTemporadas | null>(null);

export function ProveedorDeTemporadas({ children }: { readonly children: ReactNode }) {
  const temporadas = useRecurso<{ seasons: Temporada[] }>('/seasons');
  return <Contexto.Provider value={temporadas}>{children}</Contexto.Provider>;
}

/** Las temporadas del proveedor; sin proveedor, las pide esta pantalla. */
export function useTemporadas(): RecursoDeTemporadas {
  const compartidas = useContext(Contexto);
  const propias = useRecurso<{ seasons: Temporada[] }>(compartidas ? null : '/seasons');
  return compartidas ?? propias;
}

/** La temporada activa, o `null` mientras carga, si falla o si no hay ninguna. */
export function useTemporadaActiva(): Temporada | null {
  const temporadas = useTemporadas();
  return temporadas.estado === 'listo' ? temporadaActiva(temporadas.datos.seasons) : null;
}
