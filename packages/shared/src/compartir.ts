/**
 * El ranking, como texto para mandar por WhatsApp o por mail.
 *
 * **Es una función pura y por eso vive acá**: lo que se comparte es el ranking,
 * no una captura de la pantalla, y lo que dice tiene que ser exactamente lo que
 * está publicado. Armarlo en el componente lo dejaría sin test y a merced de
 * cómo esté maquetada la tabla ese día.
 *
 * El texto **dice de qué modo es**. Compartir «el ranking» sin aclarar si es
 * por puntos o mejor de 2 es mandar una lista de números sin unidad: los dos
 * modos ordenan distinto y dan podios distintos.
 */

import { CATEGORY_INFO } from './constants.js';
import type { BowCategory } from './domain.js';
import type { StandingsMode } from './league.js';
import { ETIQUETA_DE_MODO, medallaDe } from './podio.js';

export interface LineaDeRanking {
  readonly position: number;
  readonly firstName: string;
  readonly lastName: string;
  /** Puntos de liga, o el promedio de los dos mejores según el modo. */
  readonly valor: number;
}

export interface CategoriaParaCompartir {
  readonly category: BowCategory;
  readonly ranked: readonly LineaDeRanking[];
}

export interface RankingParaCompartir {
  readonly temporada: string;
  readonly modo: StandingsMode;
  readonly categorias: readonly CategoriaParaCompartir[];
  /** Cuántos puestos por categoría. El podio y poco más. */
  readonly tope?: number;
}

/** Cuántos puestos entran por categoría si no se dice otra cosa. */
export const TOPE_AL_COMPARTIR = 5;

/**
 * Arma el texto.
 *
 * Sin markdown ni tablas: se pega en WhatsApp, donde una tabla se desarma. Cada
 * renglón se lee solo.
 */
export function textoDeRanking({
  temporada,
  modo,
  categorias,
  tope = TOPE_AL_COMPARTIR,
}: RankingParaCompartir): string {
  const partes: string[] = [`🏹 ${temporada} — ${ETIQUETA_DE_MODO[modo]}`];

  const unidad = modo === 'position' ? 'pts' : '%';

  for (const c of categorias) {
    // Una categoría sin nadie rankeado no se menciona: sumaría un título vacío
    // a un mensaje que se lee en un celular.
    if (c.ranked.length === 0) continue;

    partes.push('', CATEGORY_INFO[c.category].label);

    for (const linea of c.ranked.slice(0, tope)) {
      const medalla = medallaDe(linea.position);
      const marca = medalla ? `${medalla.emoji} ` : `${linea.position}º `;

      partes.push(`${marca}${linea.lastName}, ${linea.firstName} — ${linea.valor} ${unidad}`);
    }
  }

  // Nadie rankeado en ninguna categoría: se dice, en vez de mandar un título
  // suelto que parece un error.
  if (partes.length === 1) {
    partes.push('', 'Todavía no hay nadie rankeado en esta temporada.');
  }

  return partes.join('\n');
}
