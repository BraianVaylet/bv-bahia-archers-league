/**
 * El ranking, como texto para mandar por WhatsApp o por mail.
 *
 * **Es una función pura y por eso vive acá**: lo que se comparte es el ranking,
 * no una captura de la pantalla, y lo que dice tiene que ser exactamente lo que
 * está publicado. Armarlo en el componente lo dejaría sin test y a merced de
 * cómo esté maquetada la tabla ese día.
 *
 * El texto **dice el `bestN` vigente**. Compartir «el ranking» sin aclarar si
 * es mejor de 2 o de 3 es mandar un promedio sin decir sobre cuántos torneos
 * se calculó.
 */

import { CATEGORY_INFO } from './constants.js';
import type { BowCategory } from './domain.js';
import { etiquetaDeMejorDeN, medallaDe } from './podio.js';

export interface LineaDeRanking {
  readonly position: number;
  readonly firstName: string;
  readonly lastName: string;
  /** El promedio de «mejor de N», en porcentaje. */
  readonly valor: number;
}

export interface CategoriaParaCompartir {
  readonly category: BowCategory;
  readonly ranked: readonly LineaDeRanking[];
}

export interface RankingParaCompartir {
  readonly temporada: string;
  /** El `N` vigente de `LEAGUE_BEST_N`, para que el encabezado lo diga. */
  readonly bestN: number;
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
  bestN,
  categorias,
  tope = TOPE_AL_COMPARTIR,
}: RankingParaCompartir): string {
  const partes: string[] = [`🏹 ${temporada} — ${etiquetaDeMejorDeN(bestN)}`];

  for (const c of categorias) {
    // Una categoría sin nadie rankeado no se menciona: sumaría un título vacío
    // a un mensaje que se lee en un celular.
    if (c.ranked.length === 0) continue;

    partes.push('', CATEGORY_INFO[c.category].label);

    for (const linea of c.ranked.slice(0, tope)) {
      const medalla = medallaDe(linea.position);
      const marca = medalla ? `${medalla.emoji} ` : `${linea.position}º `;

      partes.push(`${marca}${linea.lastName}, ${linea.firstName} — ${linea.valor} %`);
    }
  }

  // Nadie rankeado en ninguna categoría: se dice, en vez de mandar un título
  // suelto que parece un error.
  if (partes.length === 1) {
    partes.push('', 'Todavía no hay nadie rankeado en esta temporada.');
  }

  return partes.join('\n');
}
