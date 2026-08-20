/**
 * Componentes base.
 *
 * **Objetivos táctiles**: 56px en el teclado de scoring, 44px en el resto. Si un
 * componente no llega, se rediseña el componente, no se baja el número.
 * Ver `docs/DESIGN_SYSTEM.md` §5.
 */

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

// ── Botón ────────────────────────────────────────────────────────────────────

type Variante = 'primario' | 'secundario' | 'peligro';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-[var(--nock)] text-[var(--nock-ink)] font-semibold',
  secundario: 'bg-[var(--surface-2)] text-[var(--ink)] border',
  peligro: 'bg-[var(--danger)] text-white font-semibold',
};

import { BotonTema, cn, Footer, IconoSalir, Logo, StakeChip } from '@bal/ui';

/**
 * `cn`, `StakeChip` y `BotonTema` **se mudaron a `@bal/ui`**: estaban escritos
 * dos veces, uno de ellos carácter por carácter. Se reexportan desde acá para
 * que las veinte pantallas que los importan no tengan que cambiar de origen.
 */
export { BotonTema, cn, Footer, Logo, StakeChip };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variante?: Variante;
  readonly ancho?: boolean;
}

export function Button({ variante = 'primario', ancho, className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        // 52px de alto: el mínimo de una acción primaria con guantes.
        'min-h-[52px] px-5 rounded-[var(--radius-md)] text-base',
        'transition-opacity duration-100 active:opacity-80',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANTES[variante],
        ancho && 'w-full',
        className,
      )}
      {...props}
    />
  );
}

// ── Campo de texto ───────────────────────────────────────────────────────────

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label: string;
  readonly error?: string | undefined;
  readonly hint?: string;
}

export function Field({ label, error, hint, id, className, ...props }: FieldProps) {
  const inputId = id ?? `campo-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>

      <input
        id={inputId}
        // Nunca menos de 16px: por debajo, iOS hace zoom al enfocar.
        className={cn(
          'min-h-[52px] px-4 text-base rounded-[var(--radius-md)]',
          'bg-[var(--surface)] border',
          error && 'border-[var(--danger)]',
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
        <p id={errorId} role="alert" className="text-sm text-[var(--danger)]">
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
 */
export function Pantalla({ children }: { readonly children: ReactNode }) {
  return <div className="flex flex-col h-dvh overflow-hidden">{children}</div>;
}

// ── Contenedor ───────────────────────────────────────────────────────────────

export interface ScreenProps {
  readonly children: ReactNode;
  /**
   * La pantalla termina en una barra fija abajo.
   *
   * Deja aire suficiente para que la barra **no tape el último elemento**. Sin
   * esto, el botón de la última tarjeta queda debajo de la barra y no se puede
   * tocar: pasaba en Resultados con el último arquero de la patrulla, y lo
   * encontró el E2E. Ver `docs/BITACORA.md`.
   */
  readonly conBarraFija?: boolean;
}

export function Screen({ children, conBarraFija }: ScreenProps) {
  return (
    <>
      {/*
        **Lo único que scrollea.** `flex-1` para ocupar lo que sobra entre el
        header y el pie, y `min-h-0` porque sin eso un hijo flex no se deja
        achicar por debajo de su contenido y el scroll se va al documento —que
        es exactamente lo que se está sacando.
      */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className={cn('mx-auto w-full max-w-lg px-4 flex flex-col gap-4', 'pb-8')}>
          {children}
        </div>
      </div>

      {/*
        **El pie va en todas las pantallas, y donde hay barra de acción va
        compacto.**

        `REF3-2` lo había sacado de esas pantallas por **alto útil**: un pie de
        5 rem debajo de la barra se come el espacio del contenido, y el teclado
        de scoring gana. Sigue siendo cierto — por eso lo que cede es el pie y
        no el teclado.

        La versión compacta es una línea: los dos escudos chicos y el nombre.
        Cuesta unos 34 px contra los ~80 de la completa.
      */}
      {/* `mt-0`: en una columna flex el margen del pie sería un hueco. */}
      <Footer
        anchoMaximo="max-w-lg"
        className="shrink-0 mt-0"
        {...(conBarraFija ? { compacto: true } : {})}
      />
    </>
  );
}

// ── Tema ─────────────────────────────────────────────────────────────────────

/**
 * Header fijo con vuelta atrás, título y conmutador de tema.
 *
 * Estaba repetido literalmente en siete pantallas de WAFA. Extraerlo es lo que
 * permitió agregar el conmutador **una vez** en vez de siete, y es lo que evita
 * que la próxima pieza transversal vuelva a pegarse siete veces.
 */
export function Encabezado({
  titulo,
  onVolver,
  textoVolver = '← Inicio',
  children,
  onCerrarSesion,
}: {
  readonly titulo?: string;
  readonly onVolver?: () => void;
  /** WAFL vuelve al recorrido, no al inicio. */
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
    <header className="sticky top-0 z-10 bg-[var(--bg)] border-b px-4 py-2 flex items-center gap-3 print:hidden">
      {onVolver && (
        <button type="button" onClick={onVolver} className="min-h-[44px] min-w-[44px] text-left">
          {textoVolver}
        </button>
      )}

      {/*
        El logo va **después** de la vuelta atrás, no antes: lo primero que se
        toca en un header es el botón de volver, y en un celular eso es el
        borde izquierdo. La marca no le gana ese lugar a la navegación.

        Decorativo: el título de al lado dice en qué pantalla estás, que es lo
        que hace falta escuchar.
      */}
      <Logo size={24} className="shrink-0" />

      {titulo && <span className="font-semibold">{titulo}</span>}

      <div className="ml-auto flex items-center gap-2">
        {children}
        <BotonTema />

        {onCerrarSesion && (
          <button
            type="button"
            onClick={onCerrarSesion}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="min-h-[44px] min-w-[44px] rounded-[var(--radius-sm)] border
              flex items-center justify-center shrink-0 print:hidden"
          >
            <IconoSalir />
          </button>
        )}
      </div>
    </header>
  );
}
