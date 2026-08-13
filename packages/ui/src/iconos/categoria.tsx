/**
 * Iconografía de categorías de arco.
 *
 * Portada de `bv-easy-archery-battle`
 * (`packages/web/src/components/icons/bow.tsx`), **con el mapa reescrito**: las
 * claves no coinciden entre los dos repos.
 *
 * | Allá | Acá |
 * |---|---|
 * | `raso` | `razo` |
 * | `recurvo_olimpico` | `recurvo` |
 * | `recurvo_tradicional` | `tradicional` |
 * | — | `escuela` |
 *
 * `escuela` no existe en el otro repo y se dibujó acá. No es un arco: es una
 * categoría de aprendizaje, así que el glifo no es un arco sino la diana con la
 * flecha todavía afuera.
 */

import type { BowCategory } from '@bal/shared';
import { type Icono, type IconoProps, Svg } from './base.js';

/** Compuesto libre: mira de scope con un solo pin. */
export function IconoCompuesto(p: IconoProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 4.5V12" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Compuesto cazador: anillo de mira con tres pines. */
export function IconoCazador(p: IconoProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8" />
      <path d="M4.5 9H12M4.5 12H12M4.5 15H12" />
      <circle cx="13" cy="9" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="13" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="13" cy="15" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Razo (barebow): flecha con emplumado. */
export function IconoRazo(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M3 21 21 3" />
      <path d="M21 3h-5.5M21 3v5.5" />
      <path d="M6.5 17.5 3 21l3.5-.5" />
    </Svg>
  );
}

/** Recurvo olímpico: arco con estabilizador y visor. */
export function IconoRecurvo(p: IconoProps) {
  return (
    <Svg {...p}>
      <circle cx="8.5" cy="12" r="2.2" />
      <path d="M10.7 12H21" />
      <path d="M7 10.3 3.5 6.8" />
      <path d="M7 13.7 3.5 17.2" />
    </Svg>
  );
}

/** Tradicional: arco con palas recurvadas y cuerda. */
export function IconoTradicional(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M9 3C16 7 16 17 9 21" />
      <path d="M9 3C4 3.5 4.5 7 9.5 7" />
      <path d="M9 21C4 20.5 4.5 17 9.5 17" />
      <path d="M9 3V21" />
    </Svg>
  );
}

/** Longbow: arco largo en D con cuerda recta. */
export function IconoLongbow(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M9 2C17 8 17 16 9 22" />
      <path d="M9 2V22" />
    </Svg>
  );
}

/**
 * Escuela: diana con la flecha todavía en camino.
 *
 * La única categoría que no es senior y la única que no puntúa para el ranking.
 * El glifo no es un arco a propósito: no distingue un tipo de arco, distingue a
 * quien todavía está aprendiendo.
 */
export function IconoEscuela(p: IconoProps) {
  return (
    <Svg {...p}>
      <circle cx="14" cy="12" r="6.5" />
      <circle cx="14" cy="12" r="2" />
      <path d="M2 21 8.5 14.5" />
      <path d="M2 21v-3.5M2 21h3.5" />
    </Svg>
  );
}

export const ICONO_DE_CATEGORIA: Readonly<Record<BowCategory, Icono>> = {
  recurvo: IconoRecurvo,
  compuesto: IconoCompuesto,
  cazador: IconoCazador,
  razo: IconoRazo,
  tradicional: IconoTradicional,
  longbow: IconoLongbow,
  escuela: IconoEscuela,
};
