/**
 * La piel de los botones de las tres aplicaciones (`REF7-4`, `DISENO.md` §4.1 y §4.2).
 *
 * **Vive acá y no en cada app** porque la landing y la puerta `/app` necesitan las mismas
 * variantes que WAFA (más `sobreMonte` y el tamaño `lg`), y las dos copias de antes ya se habían
 * separado: la landing pintaba su «Ingresar» a mano.
 *
 * Es un constructor de clases y no un componente, por la misma razón que `clasesDeTarjeta`: un
 * `<Link>` que navega tiene que poder **verse** como botón sin **ser** un `<button>` anidado en un
 * `<a>`, que es HTML inválido.
 *
 * Lo que cambió respecto de `REF5`:
 * - **Secundario** sobre `--surface` con borde `--line-strong`. El gris relleno se leía como
 *   deshabilitado (`C-1`) y su borde daba 1.3:1 (`A-2`).
 * - **Peligro** escribe con `--danger-ink`: blanco sobre el rojo oscuro daba ≈3:1 (`A-3`).
 * - **Deshabilitado** sin `opacity`: `--surface-2` con `--ink-muted` (≥ 5.7:1). La opacidad bajaba
 *   el texto por debajo de AA y no decía nada (`A-5`); el motivo va escrito al lado.
 * - **Al tocar** baja un pixel en vez de aclararse: con el sol de frente, un cambio de opacidad
 *   no se ve.
 */

import { cn } from './cn.js';

export type VarianteDeBoton = 'primario' | 'secundario' | 'fantasma' | 'peligro' | 'sobreMonte';

/**
 * `sm` es sólo para acciones de fila o de encabezado (44px, el mínimo táctil). `lg` es sólo para
 * la landing y la puerta. Una acción primaria con guantes mide 52.
 */
export type TamañoDeBoton = 'sm' | 'base' | 'lg';

const VARIANTES: Readonly<Record<VarianteDeBoton, string>> = {
  primario:
    'bg-[var(--nock)] text-[var(--nock-ink)] border-transparent hover:shadow-[inset_0_0_0_999px_rgba(255,255,255,.12)]',
  secundario:
    'bg-[var(--surface)] text-[var(--ink)] border-[var(--line-strong)] hover:bg-[var(--surface-2)]',
  fantasma: 'bg-transparent text-[var(--ink)] border-transparent hover:bg-[var(--surface-2)]',
  peligro: 'bg-[var(--danger)] text-[var(--danger-ink)] border-transparent',
  // Sólo sobre la banda `monte` (hero de la landing y panel de la puerta).
  sobreMonte:
    'bg-transparent text-[var(--monte-ink)] border-[var(--monte-muted)] hover:bg-[var(--monte-2)]',
};

const TAMAÑOS: Readonly<Record<TamañoDeBoton, string>> = {
  sm: 'min-h-[44px] px-3.5 text-[15px]',
  base: 'min-h-[52px] px-5 text-base',
  lg: 'min-h-[56px] px-7 text-[17px]',
};

/**
 * Deshabilitado, en un `<button>` y en un enlace con `aria-disabled="true"`. Le gana a la variante
 * por especificidad (la pseudoclase), así que no hace falta sacarle nada.
 */
const DESHABILITADO = [
  'disabled:bg-[var(--surface-2)] disabled:text-[var(--ink-muted)] disabled:border-[var(--line)]',
  'disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0',
  'aria-disabled:bg-[var(--surface-2)] aria-disabled:text-[var(--ink-muted)] aria-disabled:border-[var(--line)]',
  'aria-disabled:cursor-not-allowed aria-disabled:shadow-none aria-disabled:translate-y-0',
].join(' ');

export interface OpcionesDeBoton {
  readonly variante?: VarianteDeBoton | undefined;
  readonly tamaño?: TamañoDeBoton | undefined;
  readonly ancho?: boolean | undefined;
  readonly className?: string | undefined;
}

/** Las clases de un botón, para un `<button>` o para un enlace que se ve como botón. */
export function botonClases({
  variante = 'primario',
  tamaño = 'base',
  ancho,
  className,
}: OpcionesDeBoton = {}): string {
  return cn(
    // `inline-flex`, no el `inline-block` de `<button>`: un `<a>` es `inline` a secas, y ahí
    // `min-h`/`w-full` no hacen nada.
    'inline-flex items-center justify-center gap-2 text-center',
    'rounded-[var(--radius-md)] border font-semibold leading-tight',
    'transition-[background-color,border-color,transform] duration-[80ms] ease-out',
    'active:translate-y-px',
    TAMAÑOS[tamaño],
    VARIANTES[variante],
    DESHABILITADO,
    ancho && 'w-full',
    className,
  );
}

/**
 * Botón de sólo ícono (tema, cerrar sesión, acciones de fila). Lleva siempre `aria-label` con lo
 * que hace: el ícono es decorativo.
 */
export function clasesDeBotonIcono(className?: string): string {
  return cn(
    'min-h-[44px] min-w-[44px] shrink-0 inline-flex items-center justify-center',
    'rounded-[var(--radius-md)] border bg-[var(--surface)] text-[var(--ink)]',
    'hover:bg-[var(--surface-2)] print:hidden',
    'disabled:bg-[var(--surface-2)] disabled:text-[var(--ink-muted)] disabled:cursor-not-allowed',
    className,
  );
}
