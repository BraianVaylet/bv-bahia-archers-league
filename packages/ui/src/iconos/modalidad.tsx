/**
 * Iconografía de modalidades.
 *
 * Portada de `bv-easy-archery-battle`
 * (`packages/web/src/components/icons/modality.tsx`). Las cuatro claves son las
 * mismas en los dos repos, así que el mapa entra tal cual.
 *
 * Los glifos evocan **el escenario**, no el puntaje: es lo que hay que
 * reconocer de un vistazo al mirar el recorrido.
 */

import type { Modality } from '@bal/shared';
import { type Icono, type IconoProps, Svg } from './base.js';

/** Sala: diana concéntrica de tiro bajo techo. */
export function IconoSala(p: IconoProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Aire libre: sol sobre el horizonte. */
export function IconoAireLibre(p: IconoProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="11" r="4" />
      <path d="M12 2.5V4M12 18v1.5M4.2 11H2.7M21.3 11h-1.5M6.4 5.4 5.3 4.3M18.7 4.3l-1.1 1.1" />
      <path d="M3 20.5h18" />
    </Svg>
  );
}

/** Juego de campo: terreno con pinos. */
export function IconoCampo(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M8 3 4 10h2.5L3 16h10L9.5 10H12L8 3Z" />
      <path d="M8 16v4" />
      <path d="M16 8l-2.5 4.5H15L13 17h6l-2-4.5h1.5L16 8Z" />
      <path d="M16 17v3" />
    </Svg>
  );
}

/** 3D: silueta de animal. */
export function Icono3D(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M5 4l2 3M9 4L7 7" />
      <path d="M7 7c-1.5 0-2.5 1.2-2.5 2.7 0 1.3 1 2.3 2.3 2.3" />
      <path d="M7 12v4.5a1.5 1.5 0 0 0 1.5 1.5h.5" />
      <path d="M7 9.5h7.5c2.2 0 3.5 1.4 3.5 3.4V18" />
      <path d="M11 18v-3" />
      <path d="M18 18v-3" />
    </Svg>
  );
}

export const ICONO_DE_MODALIDAD: Readonly<Record<Modality, Icono>> = {
  sala: IconoSala,
  aire_libre: IconoAireLibre,
  campo: IconoCampo,
  '3d': Icono3D,
};
