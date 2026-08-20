/**
 * La tarjeta: el contenedor de contenido de las tres aplicaciones.
 *
 * **Estaba escrita a mano 29 veces en 18 archivos.** `rounded-[…] border p-3
 * bg-[var(--surface)]`, copiada de pantalla en pantalla, con derivas: unas con
 * `p-3` y otras con `p-4`, unas sobre `--surface` y otras sobre `--surface-2`,
 * sin que la diferencia significara nada.
 *
 * Por eso la densidad y la jerarquía estaban desparejas: no divergieron por
 * decisión, divergieron porque cada pantalla resolvió lo mismo por su cuenta.
 * Es la misma historia de `cn`, `StakeChip` y `Screen` antes de `REF2-1`.
 *
 * **Es un constructor de clases, no un componente.** En el código real las
 * tarjetas son `div`, `li`, `section`, `article` y `form`: un componente sólo
 * serviría para 7 de las 29, y tener dos formas de hacer lo mismo es
 * exactamente lo que esto viene a corregir.
 *
 * El layout de adentro —el `flex flex-col gap-2`— cambia en cada pantalla y no
 * hay una forma correcta: sigue siendo de quien la usa.
 *
 * Elevación **por borde y fondo, nunca por sombra** — `DESIGN_SYSTEM.md` §4:
 * las sombras se disuelven bajo el sol, y la única real está reservada para el
 * teclado de scoring.
 */

import { cn } from './cn.js';

/**
 * Cuánto aire adentro. `amplia` es para tarjetas que son toda la pantalla.
 *
 * **`ninguna` no es un caso raro: es una necesidad.** `cn` concatena y no
 * resuelve conflictos de Tailwind, así que una tarjeta que trae su propio
 * `px-4 py-3` terminaría con ese Y con `p-3` en el mismo atributo, y quién gana
 * lo decide el orden del CSS, no el del string. Poder no emitir relleno es lo
 * que evita esa pelea.
 */
export type DensidadDeTarjeta = 'normal' | 'amplia' | 'ninguna';

/**
 * Qué tan adentro está.
 *
 * `base` es una tarjeta sobre el fondo de la página. `anidada` es una tarjeta
 * **dentro** de otra: usa `--surface-2` para que el borde no sea lo único que
 * las separe. `transparente` deja ver el fondo de la página — es lo que usan
 * los avisos, que se apoyan en el color del texto y no en el del recipiente.
 */
export type NivelDeTarjeta = 'base' | 'anidada' | 'transparente';

export interface OpcionesDeTarjeta {
  readonly densidad?: DensidadDeTarjeta;
  readonly nivel?: NivelDeTarjeta;
}

const RELLENO: Readonly<Record<DensidadDeTarjeta, string>> = {
  normal: 'p-3',
  amplia: 'p-4',
  ninguna: '',
};

const FONDO: Readonly<Record<NivelDeTarjeta, string>> = {
  base: 'bg-[var(--surface)]',
  anidada: 'bg-[var(--surface-2)]',
  transparente: '',
};

/**
 * Las clases de una tarjeta, para los casos en que el elemento **no** puede ser
 * un `div`.
 *
 * En el código real las tarjetas son `li` en las listas, `article` en los
 * resultados y `a` cuando son un enlace entero. Un componente polimórfico con
 * `as` resolvería eso a costa de tipos que nadie va a querer leer; devolver las
 * clases es más chico y no miente sobre lo que hace.
 */
export function clasesDeTarjeta({ densidad = 'normal', nivel = 'base' }: OpcionesDeTarjeta = {}) {
  return cn('rounded-[var(--radius-lg)] border', RELLENO[densidad], FONDO[nivel]);
}
