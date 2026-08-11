/**
 * Componentes base.
 *
 * **Objetivos táctiles**: 56px en el teclado de scoring, 44px en el resto. Si un
 * componente no llega, se rediseña el componente, no se baja el número.
 * Ver `docs/DESIGN_SYSTEM.md` §5.
 */

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function cn(...clases: (string | false | undefined | null)[]): string {
  return clases.filter(Boolean).join(' ');
}

// ── Botón ────────────────────────────────────────────────────────────────────

type Variante = 'primario' | 'secundario' | 'peligro';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-[var(--nock)] text-[var(--nock-ink)] font-semibold',
  secundario: 'bg-[var(--surface-2)] text-[var(--ink)] border',
  peligro: 'bg-[var(--danger)] text-white font-semibold',
};

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

// ── Chip de estaca ───────────────────────────────────────────────────────────

const ESTACAS: Record<string, { color: string; label: string }> = {
  roja: { color: 'var(--stake-roja)', label: 'Roja' },
  azul: { color: 'var(--stake-azul)', label: 'Azul' },
  amarilla: { color: 'var(--stake-amarilla)', label: 'Amarilla' },
};

/**
 * El color **nunca** va solo: lleva siempre el nombre escrito.
 * Un daltónico lee "Azul"; el resto ve el color. Ninguno depende del otro.
 * Ver `docs/DESIGN_SYSTEM.md` §2.2.
 */
export function StakeChip({ stake }: { readonly stake: string }) {
  const info = ESTACAS[stake];
  if (!info) return null;

  return (
    <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-[var(--surface-2)] text-sm">
      <span
        aria-hidden="true"
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: info.color }}
      />
      <span>Estaca {info.label}</span>
    </span>
  );
}

// ── Contenedor ───────────────────────────────────────────────────────────────

export function Screen({ children }: { readonly children: ReactNode }) {
  return <div className="mx-auto w-full max-w-lg px-4 pb-8 flex flex-col gap-4">{children}</div>;
}
