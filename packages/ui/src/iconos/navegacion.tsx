/**
 * Iconografía de navegación y de las pantallas nuevas de `ref-7` (`REF7-3` / `C-6`).
 *
 * Mismo `Svg` base que los de acción: 24px de grilla, trazo de 1.8, puntas redondas y
 * `currentColor`. Los trazos salen de `docs/post/ref-7/DISENO.md` §4.18.
 *
 * Reemplazan a los caracteres sueltos ("←", "→", "›") que había en enlaces y botones: un glifo
 * tipográfico depende de la fuente del sistema y no se alinea con el texto de al lado.
 */

import { type IconoProps, Svg } from './base.js';

/** Avanzar dentro de una fila o una lista: el final de un enlace o de una `RoleCard`. */
export function IconoChevron(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

/** Ir a otra página: "Ver todas", "Ranking completo", el pie de una `TournamentCard`. */
export function IconoFlecha(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </Svg>
  );
}

/** Volver a la pantalla anterior, siempre con el texto al lado ("Blancos", "Inicio"). */
export function IconoVolver(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </Svg>
  );
}

/** Cambios por enviar en `SyncBadge`. */
export function IconoSincronizar(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
      <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
      <path d="M4 4v4h4M20 20v-4h-4" />
    </Svg>
  );
}

/** Sin señal: lo anotado queda guardado en el celular. */
export function IconoSinSenal(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M3 3l18 18" />
      <path d="M8.5 6.3A6 6 0 0 1 17.7 10H18a4 4 0 0 1 2.3 7.3" />
      <path d="M16 19H7a5 5 0 0 1-2.2-9.5" />
    </Svg>
  );
}

/** La app del administrador, en la puerta `/app`. */
export function IconoPanel(p: IconoProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </Svg>
  );
}

/** Ranking de la liga. */
export function IconoPodio(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M3 20h18" />
      <path d="M5 20v-6h4.5v6" />
      <path d="M9.5 20V8h5v12" />
      <path d="M14.5 20v-9H19v9" />
    </Svg>
  );
}

/** El padrón de arqueros. */
export function IconoArqueros(p: IconoProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
    </Svg>
  );
}

/** Temporadas y fechas. */
export function IconoCalendario(p: IconoProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </Svg>
  );
}

/** Dónde se tira la fecha. */
export function IconoLugar(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </Svg>
  );
}

/** Instalar la PWA en el celular. */
export function IconoInstalar(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M12 4v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 20h14" />
    </Svg>
  );
}
