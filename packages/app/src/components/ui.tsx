/**
 * Componentes base.
 *
 * **Objetivos táctiles**: 56px en el teclado de scoring, 44px en el resto. Si un
 * componente no llega, se rediseña el componente, no se baja el número.
 * Ver `docs/DESIGN_SYSTEM.md` §5.
 */

import {
  BotonTema,
  botonClases,
  clasesDeBotonIcono,
  clasesDeTarjeta,
  cn,
  IconoAviso,
  IconoSalir,
  IconoVolver,
  Logo,
  type PropsDeEnlace,
  StakeChip,
  type TamañoDeBoton,
  type VarianteDeBoton,
} from '@bal/ui';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IndicadorDeConexion } from './IndicadorDeConexion.js';

// ── Botón ────────────────────────────────────────────────────────────────────

/**
 * `cn`, `StakeChip` y `BotonTema` **se mudaron a `@bal/ui`**: estaban escritos
 * dos veces, uno de ellos carácter por carácter. Se reexportan desde acá para
 * que las veinte pantallas que los importan no tengan que cambiar de origen.
 *
 * `botonClases` también vive allá desde `REF7-4`: la landing y la puerta usan
 * las mismas variantes (más `sobreMonte` y el tamaño `lg`). Ver `@bal/ui/boton`.
 */
export { BotonTema, botonClases, clasesDeBotonIcono, clasesDeTarjeta, cn, Logo, StakeChip };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variante?: VarianteDeBoton;
  readonly tamaño?: TamañoDeBoton;
  readonly ancho?: boolean;
}

/**
 * La navegación es trabajo de `<a>`: un `<Link>` que tiene que **verse** como
 * botón usa `botonClases` directo, sin un `<button>` anidado adentro.
 */
export function Button({ variante = 'primario', tamaño, ancho, className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={botonClases({ variante, tamaño, ancho, className })}
      {...props}
    />
  );
}

/**
 * El `<Link>` del router con la forma que esperan los componentes de `@bal/ui`
 * (`ComponenteDeEnlace`): así navegan sin recargar la página.
 */
export function EnlaceInterno({ href, ...resto }: PropsDeEnlace) {
  return <Link to={href} {...resto} />;
}

// ── Campo de texto ───────────────────────────────────────────────────────────

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label: string;
  readonly error?: string | undefined;
  readonly hint?: string;
}

/**
 * Campo de texto (`REF7-4`, `DISENO.md` §4.3).
 *
 * El borde es `--line-strong`: con `--line` daba 1.3:1, y el borde es lo que
 * dice que ahí se escribe (`A-2`). El error se marca con un borde de 2px —el de
 * 1px más un anillo interior de 1px, para que el campo no salte de tamaño— y el
 * mensaje lleva su ícono: el rojo nunca va solo.
 */
export function Field({ label, error, hint, id, className, ...props }: FieldProps) {
  const inputId = id ?? `campo-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold">
        {label}
      </label>

      <input
        id={inputId}
        // Nunca menos de 16px: por debajo, iOS hace zoom al enfocar.
        className={cn(
          'min-h-[52px] px-4 text-base rounded-[var(--radius-md)]',
          'bg-[var(--surface)] text-[var(--ink)] border placeholder:text-[var(--ink-muted)]',
          error
            ? 'border-[var(--danger)] ring-1 ring-inset ring-[var(--danger)]'
            : 'border-[var(--line-strong)]',
          className,
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(errorId, hintId) || undefined}
        {...props}
      />

      {hint && (
        <p id={hintId} className="text-sm text-[var(--ink-muted)]">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 text-sm text-[var(--danger)]"
        >
          <IconoAviso size={16} className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * La cáscara de una pantalla: **alto exacto de la ventana**, no mínimo.
 *
 * `min-h-dvh` dejaba que la página creciera y que el header y el pie se fueran
 * con el scroll. Con `h-dvh` y `overflow-hidden`, lo único que scrollea es el
 * medio: el header queda arriba y la barra de acción —o el pie— abajo, sin
 * moverse.
 *
 * **Es `dvh` y no `vh` a propósito.** En un celular, `vh` mide la ventana con
 * la barra del navegador retraída, así que una pantalla de `100vh` queda más
 * alta que lo que se ve y esconde justo la barra de abajo, que es donde está el
 * botón de continuar.
 *
 * Estaba escrito igual en doce pantallas. Extraerlo es lo que permite corregir
 * el alto **una vez** en lugar de doce — la misma razón por la que `REF-4`
 * extrajo `Encabezado`.
 *
 * **Menos la barra de ambiente.** En desarrollo, `IndicadorDeAmbiente` ocupa una franja arriba de
 * todo; con `h-dvh` entero el documento scrolleaba esa franja y la barra de abajo quedaba
 * cortada. `--reserva-aviso-de-ambiente` vale cero en producción (`@bal/ui/tokens.css`).
 */
export function Pantalla({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex flex-col h-[calc(100dvh_-_var(--reserva-aviso-de-ambiente))] overflow-hidden">
      {children}
    </div>
  );
}

// ── Contenedor ───────────────────────────────────────────────────────────────

export interface ScreenProps {
  readonly children: ReactNode;
}

/**
 * El medio de una pantalla de la PWA: lo único que scrollea.
 *
 * **Sin pie** desde `REF7-4` (decisión 5 de `docs/post/ref-7/INFORME.md`). En
 * WAFL el pie compacto quedaba entre la lista de arqueros y el teclado de
 * scoring, justo donde no sobra alto (`F-1`); en WAFA no aportaba nada que el
 * encabezado no tenga (`W-2`). Los escudos siguen en el login y en la landing.
 */
export function Screen({ children }: ScreenProps) {
  return (
    // `flex-1` para ocupar lo que sobra debajo del header, y `min-h-0` porque
    // sin eso un hijo flex no se deja achicar por debajo de su contenido y el
    // scroll se va al documento.
    <div data-scroll-principal className="flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-lg px-4 pb-8 flex flex-col gap-4">{children}</div>
    </div>
  );
}

// ── Tema ─────────────────────────────────────────────────────────────────────

/**
 * El encabezado de la PWA (`REF7-4`, `DISENO.md` §4.12): 60px, fijo arriba.
 *
 * Estaba repetido literalmente en siete pantallas de WAFA. Extraerlo es lo que
 * permitió agregar el conmutador **una vez** en vez de siete, y es lo que evita
 * que la próxima pieza transversal vuelva a pegarse siete veces.
 *
 * A la izquierda, **o** la vuelta atrás (flecha y texto) **o** el logo: lo
 * primero que se toca en un header es el borde izquierdo, y la marca no le gana
 * ese lugar a la navegación. El título va en dos líneas: el contexto chico
 * arriba («ADMINISTRACIÓN», «PATRULLA 1») y la pantalla abajo.
 */
export function Encabezado({
  titulo,
  contexto,
  onVolver,
  textoVolver = 'Inicio',
  children,
  onCerrarSesion,
}: {
  readonly titulo?: string;
  /** La primera línea del título, en mono y mayúsculas: dónde estás. */
  readonly contexto?: string;
  readonly onVolver?: () => void;
  /** A dónde vuelve. WAFL vuelve al recorrido («Blancos»), no al inicio. */
  readonly textoVolver?: string;
  /** A la derecha, antes del conmutador. Es donde va el `SyncBadge` de WAFL. */
  readonly children?: ReactNode;
  /**
   * Cerrar sesión, a mano.
   *
   * **No cierra: abre la confirmación**, que sigue siendo de dos toques. Es la
   * única salida de la app y en WAFL borra los datos locales, así que un ícono
   * en el header —donde el pulgar pasa todo el tiempo— no puede ser el disparo
   * final. Ver `CerrarSesion`.
   */
  readonly onCerrarSesion?: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 h-[60px] shrink-0 bg-[var(--bg)] border-b pl-4 pr-3 flex items-center gap-3 print:hidden">
      {onVolver ? (
        <button
          type="button"
          onClick={onVolver}
          className="min-h-[44px] min-w-[44px] pr-2 shrink-0 inline-flex items-center gap-1 font-semibold"
        >
          <IconoVolver />
          {textoVolver}
        </button>
      ) : (
        // Decorativo: el título de al lado dice en qué pantalla estás, que es
        // lo que hace falta escuchar.
        <Logo size={28} className="shrink-0" />
      )}

      {titulo || contexto ? (
        <div className="flex flex-col min-w-0 leading-tight">
          {contexto ? (
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--ink-muted)] truncate">
              {contexto}
            </span>
          ) : null}
          {titulo ? (
            <span data-titulo-de-pagina className="font-semibold truncate">
              {titulo}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="ml-auto flex items-center gap-2 shrink-0">
        {children}

        {/*
          El estado de la red, para las pantallas que no traen su propio
          indicador.

          WAFL pasa su `SyncBadge` por `children`, que dice lo mismo y además
          cuántos cambios quedan sin enviar: ahí este punto sobraría y podría
          contradecirlo. WAFA no traía nada, y es la app que **sí** depende de
          la red — puede leer de la caché, pero no crear ni editar.
        */}
        {children ? null : <IndicadorDeConexion />}

        <BotonTema />

        {onCerrarSesion ? (
          <button
            type="button"
            onClick={onCerrarSesion}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className={clasesDeBotonIcono()}
          >
            <IconoSalir />
          </button>
        ) : null}
      </div>
    </header>
  );
}
