/**
 * Componentes del sitio público.
 *
 * Deliberadamente pocos: la landing es de lectura y no comparte el bundle de la
 * PWA. Duplicar tres primitivas pesa menos que arrastrar toda la biblioteca de
 * administración a una página que sólo muestra tablas.
 *
 * Ver `docs/ARCHITECTURE.md` §3.
 */

import {
  BotonTema,
  botonClases,
  clasesDeTarjeta,
  cn,
  enlaceEntreApps,
  Logo,
  type PropsDeEnlace,
  StakeChip,
} from '@bal/ui';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

/**
 * `cn`, `StakeChip` y `BotonTema` **se mudaron a `@bal/ui`**.
 *
 * El comentario de arriba sigue valiendo —la landing no comparte bundle con la
 * PWA— pero la copia ahora la hace el bundler a partir de una sola fuente, no
 * una persona a mano. Lo que se duplicaba se había ido separando: el chip de
 * estaca tenía dos tamaños distintos sin que nadie lo hubiera decidido.
 */
export { BotonTema, clasesDeTarjeta, cn, StakeChip };

/**
 * El `<Link>` del router con la forma que esperan los componentes de `@bal/ui`
 * (`ComponenteDeEnlace`): así navegan sin recargar la página.
 */
export function EnlaceInterno({ href, ...resto }: PropsDeEnlace) {
  return <Link to={href} {...resto} />;
}

/**
 * A dónde lleva «Ingresar»: la PWA, que es otro build. En producción es `/app/`; con `pnpm dev`,
 * el Vite de la PWA en su puerto.
 */
export const A_LA_APP = enlaceEntreApps('app', import.meta.env.DEV, window.location.href);

/** El contenedor de cada página: hasta 1200px, que es el ancho del encabezado y del pie. */
export function Screen({ children }: { readonly children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-12 flex flex-col gap-6">{children}</div>
  );
}

const SECCIONES = [
  { texto: 'Inicio', to: '/', end: true },
  { texto: 'Ranking', to: '/ranking', end: false },
  { texto: 'Torneos', to: '/torneos', end: false },
  { texto: 'Sumate', to: '/alta', end: false },
] as const;

/** La sección activa: en tinta, a 600, con una barra verde pegada al borde del encabezado. */
const SECCION_ACTIVA =
  'text-[var(--ink)] font-semibold after:absolute after:inset-x-3 after:-bottom-2.5 after:h-[3px] after:rounded-t-[3px] after:bg-[var(--nock-text)]';
const SECCION =
  'text-[var(--ink-muted)] font-medium hover:text-[var(--ink)] hover:bg-[var(--surface-2)]';

/**
 * El encabezado del sitio (`REF7-5`, `DISENO.md` §4.16): **una fila**, fija arriba.
 *
 * Antes eran dos filas —la marca arriba y los enlaces de 14px abajo— sin decir en qué página
 * estabas, y ocupaban ~108px (`L-3`). Ahora la sección activa lleva `aria-current="page"` (lo pone
 * `NavLink`) y se marca con una barra.
 *
 * **«Ingresar» vive acá, siempre visible** (`L-4`, decisión 2). Es la única puerta a la PWA —quién
 * sos lo pregunta la app, no la landing (`FUNCTIONAL.md` §5.1)— y un botón verde gigante en el
 * medio de la portada le hablaba al que menos lo necesita: el líder ya tiene la PWA instalada.
 *
 * Debajo de 760px la navegación se esconde y quedan marca, tema e «Ingresar»: las secciones se
 * recorren con el scroll de la portada y desde el pie.
 */
export function Encabezado() {
  return (
    <header className="sticky top-0 z-20 border-b bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] backdrop-blur-[8px] print:hidden">
      <div className="mx-auto w-full max-w-[1200px] h-16 px-4 flex items-center gap-3 min-[760px]:gap-6">
        {/* El logo acompaña al nombre, no lo reemplaza: un ícono solo no dice de qué liga se
            trata, ni se lee en un lector de pantalla. Debajo de 360px el nombre no entra junto a
            «Ingresar» (y la página scrolleaba de costado a 320): ahí queda sólo para el lector de
            pantalla, y el título de cada página dice de qué sitio se trata. */}
        <Link to="/" className="flex items-center gap-2.5 min-h-[44px] min-w-0 text-[var(--ink)]">
          <Logo size={32} className="shrink-0" />
          <span className="font-display text-[15px] font-bold leading-[1.05] tracking-[-0.01em] max-[359px]:sr-only">
            Liga Bahiense
            <small className="hidden min-[760px]:block font-sans [font-stretch:100%] [font-variation-settings:normal] text-xs font-medium tracking-normal text-[var(--ink-muted)]">
              de Arquería
            </small>
          </span>
        </Link>

        <nav aria-label="Secciones" className="hidden min-[760px]:flex gap-1">
          {SECCIONES.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              end={s.end}
              className={({ isActive }) =>
                cn(
                  'relative inline-flex items-center min-h-[44px] px-3 rounded-[var(--radius-sm)]',
                  isActive ? SECCION_ACTIVA : SECCION,
                )
              }
            >
              {s.texto}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <BotonTema />
          <a href={A_LA_APP} className={botonClases({ variante: 'secundario', tamaño: 'sm' })}>
            Ingresar
          </a>
        </div>
      </div>
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

export function Dato({
  etiqueta,
  valor,
  detalle,
}: {
  readonly etiqueta: string;
  readonly valor: string | number;
  /**
   * El dato de al lado, en chico y abajo.
   *
   * Antes esto iba metido dentro del valor —`89.39% (295)`— y quedaban dos
   * números peleando el mismo renglón: el que ordena el ranking y el puntaje
   * bruto. En un celular a 320 px eso además se parte.
   */
  readonly detalle?: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--surface-2)] px-3 py-2">
      <dt className="text-xs text-[var(--ink-muted)]">{etiqueta}</dt>
      <dd className="text-lg font-semibold tabular-nums">
        {valor}
        {detalle && (
          <span className="block text-xs font-normal text-[var(--ink-muted)]">{detalle}</span>
        )}
      </dd>
    </div>
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
      <tr className="border-b text-left font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">
        {children}
      </tr>
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
        'border-b sm:h-14',
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
