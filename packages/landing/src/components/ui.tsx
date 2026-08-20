/**
 * Componentes del sitio público.
 *
 * Deliberadamente pocos: la landing es de lectura y no comparte el bundle de la
 * PWA. Duplicar tres primitivas pesa menos que arrastrar toda la biblioteca de
 * administración a una página que sólo muestra tablas.
 *
 * Ver `docs/ARCHITECTURE.md` §3.
 */

import { BotonTema, clasesDeTarjeta, cn, Logo, StakeChip } from '@bal/ui';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * `cn`, `StakeChip` y `BotonTema` **se mudaron a `@bal/ui`**.
 *
 * El comentario de arriba sigue valiendo —la landing no comparte bundle con la
 * PWA— pero la copia ahora la hace el bundler a partir de una sola fuente, no
 * una persona a mano. Lo que se duplicaba se había ido separando: el chip de
 * estaca tenía dos tamaños distintos sin que nadie lo hubiera decidido.
 */
export { BotonTema, clasesDeTarjeta, cn, StakeChip };

export function Screen({ children }: { readonly children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl px-4 pb-12 flex flex-col gap-6">{children}</div>;
}

export function Encabezado() {
  return (
    <header className="border-b">
      <nav className="mx-auto w-full max-w-3xl px-4 py-2 flex flex-col gap-1">
        {/*
          **En el header va sólo el logo de la liga.**

          El del CBA vive en el pie, junto al de la liga. Tenerlo también acá
          arriba duplicaba la marca del club en la misma pantalla y comía el
          ancho que la navegación necesita en un celular.

          Dos filas fijas: identidad arriba —que no envuelve nunca— y
          navegación abajo. Antes era un solo `flex-wrap` con todo, y a 320 px
          se partía en tres renglones dejando la marca abajo de los enlaces.
        */}
        <div className="flex items-center gap-2 min-h-[44px]">
          <Link
            to="/"
            className="font-[var(--font-display)] font-bold flex items-center gap-2 min-w-0"
          >
            {/* El logo acompaña al nombre, no lo reemplaza: un ícono solo no dice
                de qué liga se trata, ni se lee en un lector de pantalla. */}
            <Logo size={26} className="shrink-0" />
            <span className="truncate">Liga Bahiense</span>
          </Link>

          <BotonTema className="ml-auto shrink-0" />
        </div>

        <div className="flex gap-4 text-sm">
          <Link to="/ranking" className="min-h-[44px] flex items-center">
            Ranking
          </Link>
          <Link to="/torneos" className="min-h-[44px] flex items-center">
            Torneos
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function Cargando() {
  return (
    <p className="text-[var(--ink-muted)]" role="status">
      Cargando…
    </p>
  );
}

export function Fallo({ mensaje }: { readonly mensaje: string }) {
  return (
    <p role="alert" className="text-[var(--danger)]">
      {mensaje}
    </p>
  );
}

/**
 * Tabla en escritorio, **tarjetas en el celular**.
 *
 * Antes esto era `TablaScrollable`: un `overflow-x-auto` alrededor de la tabla.
 * La página no desbordaba —el scroll quedaba adentro del contenedor— pero para
 * el que sostiene el celular era lo mismo: **para ver el puntaje había que
 * arrastrar de costado**. El podio tiene ocho columnas; a 360 px el nombre solo
 * come media pantalla.
 *
 * `DESIGN_SYSTEM.md` §7 lo dice sin matices: *«ancho mínimo 360 px, cero scroll
 * horizontal, en ninguna pantalla»*.
 *
 * **Un solo DOM, no dos.** Renderizar una tabla y además una lista de tarjetas
 * duplicaría cada `data-testid` y cada nombre para un lector de pantalla. Acá
 * la misma tabla cambia de forma con CSS, y se conservan los roles explícitos
 * para que `display: block` no le saque la semántica de tabla.
 *
 * La landing es la única superficie que también se ve en escritorio, así que
 * desde `sm` vuelve a ser una tabla, que es lo correcto ahí.
 */
export function Tabla({ children }: { readonly children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noRedundantRoles: en `max-sm` la tabla pasa a `display: block` y el navegador le saca la semántica de tabla al árbol de accesibilidad. El rol deja de ser redundante justo ahí.
    <table role="table" className="w-full text-sm border-collapse max-sm:block">
      {children}
    </table>
  );
}

/** La cabecera no existe en modo tarjeta: cada celda lleva su etiqueta al lado. */
export function Cabecera({ children }: { readonly children: ReactNode }) {
  return (
    <thead className="max-sm:hidden">
      <tr className="border-b text-left text-[var(--ink-muted)]">{children}</tr>
    </thead>
  );
}

export function Cuerpo({ children }: { readonly children: ReactNode }) {
  return <tbody className="max-sm:block">{children}</tbody>;
}

export interface FilaProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly 'data-testid'?: string;
}

/** En el celular cada fila es una tarjeta; desde `sm`, una fila de tabla. */
export function Fila({ children, className, ...resto }: FilaProps) {
  return (
    <tr
      // biome-ignore lint/a11y/noRedundantRoles: en `max-sm` la tabla pasa a `display: block` y el navegador le saca la semántica de tabla al árbol de accesibilidad. El rol deja de ser redundante justo ahí.
      role="row"
      className={cn(
        'border-b',
        'max-sm:block max-sm:rounded-[var(--radius-lg)] max-sm:border',
        'max-sm:bg-[var(--surface)] max-sm:p-3 max-sm:mb-2',
        className,
      )}
      {...resto}
    >
      {children}
    </tr>
  );
}

export interface CeldaProps {
  readonly children: ReactNode;
  /**
   * El nombre de la columna. En modo tarjeta se pinta a la izquierda del valor
   * con `::before`, porque la cabecera no está.
   *
   * Sin esto, un `19` suelto en una tarjeta no se sabe si es el puntaje, los
   * dieces o el porcentaje.
   */
  readonly etiqueta?: string;
  /**
   * En modo tarjeta, esta celda fluye **en línea** con las vecinas en vez de
   * ocupar su propio renglón.
   *
   * Es para las cifras chicas —`X`, `10`, `M`, `%`— que en renglones separados
   * hacen una tarjeta de seis líneas para mostrar cinco dígitos. Con veinte
   * arqueros por categoría eso es un scroll que no termina más.
   *
   * El dato que encabeza —el puntaje— se queda en su renglón: es el que se
   * busca, y compartir línea lo volvería uno más.
   */
  readonly enLinea?: boolean;
  readonly className?: string;
}

export function Celda({ children, etiqueta, enLinea, className }: CeldaProps) {
  return (
    <td
      // biome-ignore lint/a11y/noRedundantRoles: en `max-sm` la tabla pasa a `display: block` y el navegador le saca la semántica de tabla al árbol de accesibilidad. El rol deja de ser redundante justo ahí.
      role="cell"
      data-etiqueta={etiqueta}
      className={cn(
        'py-2 pr-2',
        // En tarjeta: etiqueta a la izquierda, valor a la derecha.
        'max-sm:items-baseline max-sm:gap-1.5 max-sm:py-0.5 max-sm:text-left',
        enLinea
          ? 'max-sm:inline-flex max-sm:w-auto max-sm:pr-4'
          : 'max-sm:flex max-sm:justify-between max-sm:gap-3 max-sm:pr-0',
        etiqueta &&
          'max-sm:before:content-[attr(data-etiqueta)] max-sm:before:text-[var(--ink-muted)]',
        className,
      )}
    >
      {children}
    </td>
  );
}
