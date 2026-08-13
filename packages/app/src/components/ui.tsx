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

import { BotonTema, cn, Footer, Logo, StakeChip } from '@bal/ui';

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
      <div
        className={cn(
          'mx-auto w-full max-w-lg px-4 flex flex-col gap-4',
          conBarraFija ? 'pb-28' : 'pb-8',
        )}
      >
        {children}
      </div>

      {/*
        **El pie va donde no hay barra fija**, y eso no es una lista de
        excepciones: una pantalla que termina en una barra de acción no tiene
        lugar para un pie, y meterlo empujaría el último elemento debajo de la
        barra. Es el mismo problema que `conBarraFija` ya resuelve con el
        `padding`, y que el E2E encontró en Resultados con el último arquero.

        En la práctica esto deja el pie fuera del recorrido y del teclado de
        scoring, que es exactamente donde no se lo quiere.
      */}
      {!conBarraFija && <Footer anchoMaximo="max-w-lg" />}
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
}: {
  readonly titulo?: string;
  readonly onVolver?: () => void;
  /** WAFL vuelve al recorrido, no al inicio. */
  readonly textoVolver?: string;
  /** A la derecha, antes del conmutador. Es donde va el `SyncBadge` de WAFL. */
  readonly children?: ReactNode;
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
      </div>
    </header>
  );
}
