/**
 * Iconografía de acciones.
 *
 * **Estos no vienen de ningún lado.** El brief pide reutilizar «también las que
 * se usan en botones y otros componentes» de `bv-easy-archery-battle`, y ese
 * repo no tiene ninguna: sus únicos íconos son los de modalidad y los de
 * categoría. Así que se dibujaron acá, con el mismo trazo, para que la familia
 * cierre.
 *
 * Reemplazan a los glifos de texto que había repartidos por WAFA:
 * `↑ ↓ ✕ ⇄ ☀ ☾ 🔒 ✎ ↺ 🗄 🗑`. Un glifo tipográfico depende de la fuente del
 * sistema —el candado y el archivador se ven distinto en cada Android— y no se
 * puede alinear con el texto de al lado.
 */

import { type IconoProps, Svg } from './base.js';

/** Subir en una lista ordenable. */
export function IconoSubir(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </Svg>
  );
}

/** Bajar en una lista ordenable. */
export function IconoBajar(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </Svg>
  );
}

/** Quitar de una lista. No es eliminar: sale de acá y sigue existiendo. */
export function IconoQuitar(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  );
}

/** Mover de una patrulla a otra. */
export function IconoMover(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M4 8h13" />
      <path d="m14 5 3 3-3 3" />
      <path d="M20 16H7" />
      <path d="m10 13-3 3 3 3" />
    </Svg>
  );
}

/** Tema claro. */
export function IconoSol(p: IconoProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  );
}

/** Tema oscuro. */
export function IconoLuna(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.7 6.7 0 0 0 10.5 10.5Z" />
    </Svg>
  );
}

/** Blanco bloqueado: ya tiene puntajes y no se edita. */
export function IconoCandado(p: IconoProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="10.5" width="16" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </Svg>
  );
}

/** Editar. */
export function IconoEditar(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="M14.5 6.5 17.5 9.5" />
    </Svg>
  );
}

/** Restaurar algo archivado. */
export function IconoRestaurar(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </Svg>
  );
}

/** Archivar: deja de aparecer, pero conserva todo. */
export function IconoArchivar(p: IconoProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </Svg>
  );
}

/** Eliminar de verdad. */
export function IconoEliminar(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  );
}

/** Compartir. */
export function IconoCompartir(p: IconoProps) {
  return (
    <Svg {...p}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
    </Svg>
  );
}

/** Un aviso que se despliega al tocarlo. */
export function IconoAviso(p: IconoProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Agregar. */
export function IconoAgregar(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

/** Hecho. */
export function IconoTilde(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="m4 12.5 5.5 5.5L20 7" />
    </Svg>
  );
}

/**
 * Cerrar sesión: una puerta con una flecha que sale.
 *
 * La flecha apunta **hacia afuera**. Con la flecha hacia adentro el mismo dibujo
 * significa entrar, y es el error clásico de este ícono.
 */
export function IconoSalir(p: IconoProps) {
  return (
    <Svg {...p}>
      <path d="M14 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8" />
      <path d="M17 8.5 20.5 12 17 15.5" />
      <path d="M20.5 12H10" />
    </Svg>
  );
}

/** Copiar: dos hojas superpuestas. */
export function IconoCopiar(p: IconoProps) {
  return (
    <Svg {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
    </Svg>
  );
}
