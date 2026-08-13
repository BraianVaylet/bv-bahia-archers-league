/**
 * Cómo se nombra y se colorea el estado de un torneo.
 *
 * **Estaba escrito en tres lugares, con tres textos distintos**: la ficha del
 * torneo en WAFA decía «Completado, sin publicar», el listado decía otra cosa,
 * y la landing directamente no nombraba ese estado. Ponerle un color a cada uno
 * por separado habría fabricado una cuarta versión.
 *
 * El texto del admin y el del público **son distintos a propósito**: al
 * administrador le importa qué le falta hacer —«Completado, sin publicar»— y al
 * visitante le importa qué está mirando —«Resultados oficiales»—. Lo que no
 * puede diferir es el color.
 *
 * Ver `docs/DESIGN_SYSTEM.md` §2 y `docs/FUNCTIONAL.md` §8.
 */

import type { TournamentStatus } from './domain.js';

export interface EstadoDeTorneoInfo {
  readonly key: TournamentStatus;
  /** Lo que ve el administrador en la ficha. */
  readonly label: string;
  /** Título del grupo en un listado. */
  readonly plural: string;
  /** Qué decir cuando no hay ninguno. */
  readonly vacio: string;
  /**
   * Lo que ve el visitante en la landing. `null` cuando ese estado **no se
   * muestra en público**: un torneo que todavía no arrancó no es noticia.
   */
  readonly publico: string | null;
  /**
   * Token de color, de los que ya existen en `tokens.css`.
   *
   * **No se inventa un color nuevo por estado.** Los cuatro estados son una
   * escala de avance y los tokens semánticos ya la expresan: neutro lo que no
   * empezó, atención lo que está pasando, acento lo que espera una acción, y
   * conforme lo que quedó cerrado.
   */
  readonly color: string;
}

export const ESTADO_DE_TORNEO: Readonly<Record<TournamentStatus, EstadoDeTorneoInfo>> = {
  sin_iniciar: {
    key: 'sin_iniciar',
    label: 'Sin iniciar',
    plural: 'Sin iniciar',
    vacio: 'No hay torneos preparados.',
    publico: null,
    color: 'var(--ink-muted)',
  },
  en_proceso: {
    key: 'en_proceso',
    label: 'En proceso',
    plural: 'En proceso',
    vacio: 'No hay ningún torneo corriendo.',
    publico: 'En curso ahora',
    color: 'var(--warn)',
  },
  completado: {
    key: 'completado',
    label: 'Completado, sin publicar',
    plural: 'Completados, sin publicar',
    vacio: 'No hay torneos esperando publicación.',
    publico: null,
    color: 'var(--nock)',
  },
  publicado: {
    key: 'publicado',
    label: 'Publicado',
    plural: 'Publicados',
    vacio: 'Todavía no se publicó ningún torneo.',
    publico: 'Resultados oficiales',
    color: 'var(--ok)',
  },
};
