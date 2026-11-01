/**
 * Carga de un recurso de sólo lectura.
 *
 * Es el hook compartido con la PWA (`@bal/cliente`, `REF6-11` / `C-2`), atado al cliente de la
 * landing. Los tres estados se representan **explícitamente**: sin `cargando`, la primera
 * pintada mostraría «no hay nada» a alguien cuyos datos están en camino.
 */

import { type Recurso, useRecurso as useRecursoCompartido } from '@bal/cliente';
import { cliente } from './api.js';

export type { Recurso };

export function useRecurso<T>(path: string | null): Recurso<T> {
  return useRecursoCompartido<T>(cliente, path);
}
