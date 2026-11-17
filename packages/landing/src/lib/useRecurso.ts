/**
 * Carga de un recurso de sólo lectura.
 *
 * Es el hook compartido con la PWA (`@bal/cliente`, `REF6-11` / `C-2`), atado al cliente de la
 * landing. Los tres estados se representan **explícitamente**: sin `cargando`, la primera
 * pintada mostraría «no hay nada» a alguien cuyos datos están en camino.
 */

import {
  type OpcionesDeRecurso,
  type Recurso,
  useRecurso as useRecursoCompartido,
} from '@bal/cliente';
import { cliente } from './api.js';

export type { Recurso };

/**
 * Cada cuánto se vuelve a pedir lo que cambia mientras alguien mira (`FE-41`): el listado de
 * torneos (uno que larga) y el avance de uno en curso. Con la pestaña visible, y apenas se vuelve
 * a ella. No menos: el wifi del club es una sola IP para el rate limit público, que comparte con
 * el ingreso de WAFL.
 */
export const REFRESCO_EN_VIVO_MS = 60_000;

/** Las próximas fechas cambian poco, pero un torneo que larga sale de esa lista. */
export const REFRESCO_LENTO_MS = 5 * 60_000;

export function useRecurso<T>(path: string | null, opciones?: OpcionesDeRecurso): Recurso<T> {
  return useRecursoCompartido<T>(cliente, path, opciones);
}
