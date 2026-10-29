/**
 * Tarjeta de puntajes de un arquero: flecha por flecha, blanco por blanco.
 *
 * Es la vista que se abre desde los resultados de un torneo publicado. Lógica
 * pura, sin I/O: el backend le pasa lo que leyó y serializa lo que devuelve.
 *
 * **El servidor es la autoridad.** El valor de cada flecha y el total de cada
 * blanco se derivan de los tokens y de la modalidad **del blanco**; esta función
 * ni siquiera recibe un total guardado, así que no tiene cómo confiar en uno.
 *
 * Ver `docs/DOMAIN_WA.md` §1 y §2.
 */

import type { Modality } from './domain.js';
import { maxTargetScore, sortArrowsDescending, type TargetLike, tokenValue } from './scoring.js';

/** Un blanco del recorrido, tal como está guardado en el torneo. */
export interface BlancoDelRecorrido extends TargetLike {
  readonly index: number;
}

/** Lo único que se necesita de un puntaje guardado: dónde cayó y qué flechas son. */
export interface PuntajeGuardado {
  readonly targetIndex: number;
  readonly arrows: readonly string[];
}

export interface FlechaDeTarjeta {
  readonly token: string;
  /** Lo que vale el token en la modalidad del blanco. */
  readonly value: number;
}

export interface FilaDeTarjeta {
  readonly index: number;
  readonly modality: Modality;
  /**
   * Las flechas, de mayor a menor. `null` si el arquero no tiene puntaje en el
   * blanco: no es lo mismo que un blanco tirado todo a `M`, que vale cero pero
   * se tiró.
   */
  readonly arrows: readonly FlechaDeTarjeta[] | null;
  /** Suma de los valores de las flechas. Cero si no hay puntaje. */
  readonly total: number;
  /** Puntaje máximo posible del blanco. */
  readonly maxTotal: number;
}

export interface TarjetaDePuntajes {
  readonly rows: readonly FilaDeTarjeta[];
  /** Suma de los blancos. */
  readonly total: number;
  /** Máximo del recorrido entero, se haya tirado o no cada blanco. */
  readonly maxTotal: number;
}

function armarFila(
  blanco: BlancoDelRecorrido,
  puntaje: PuntajeGuardado | undefined,
): FilaDeTarjeta {
  const arrows = puntaje
    ? sortArrowsDescending(blanco.modality, puntaje.arrows).map((token) => ({
        token,
        value: tokenValue(blanco.modality, token),
      }))
    : null;

  return {
    index: blanco.index,
    modality: blanco.modality,
    arrows,
    total: (arrows ?? []).reduce((acc, f) => acc + f.value, 0),
    maxTotal: maxTargetScore(blanco.modality, blanco.arrows),
  };
}

/**
 * Arma la tarjeta de un arquero.
 *
 * @param targets El recorrido del torneo. Define qué filas hay y en qué orden.
 * @param scores Los puntajes guardados del arquero. Uno de un blanco que no está
 *   en el recorrido se ignora: la tarjeta es del recorrido.
 * @throws {DomainError} `INVALID_TOKEN` si una flecha no pertenece a la
 *   modalidad del blanco. No debería pasar —se valida al escribir—; si pasa,
 *   mejor que el dato roto se note a que se muestre un cero inventado.
 */
export function armarTarjetaDePuntajes(
  targets: readonly BlancoDelRecorrido[],
  scores: readonly PuntajeGuardado[],
): TarjetaDePuntajes {
  const rows = [...targets]
    .sort((a, b) => a.index - b.index)
    .map((b) =>
      armarFila(
        b,
        scores.find((s) => s.targetIndex === b.index),
      ),
    );

  return {
    rows,
    total: rows.reduce((acc, f) => acc + f.total, 0),
    maxTotal: rows.reduce((acc, f) => acc + f.maxTotal, 0),
  };
}
