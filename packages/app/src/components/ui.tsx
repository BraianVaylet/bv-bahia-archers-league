/**
 * Componentes base.
 *
 * **Objetivos táctiles**: 56px en el teclado de scoring, 44px en el resto. Si un
 * componente no llega, se rediseña el componente, no se baja el número.
 * Ver `docs/DESIGN_SYSTEM.md` §5.
 */

import { alternarTema, COLOR_DE_BARRA, resolverTema, TEMA_KEY, type Tema } from '@bal/shared';
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useState,
} from 'react';

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
    <div
      className={cn(
        'mx-auto w-full max-w-lg px-4 flex flex-col gap-4',
        conBarraFija ? 'pb-28' : 'pb-8',
      )}
    >
      {children}
    </div>
  );
}

// ── Tema ─────────────────────────────────────────────────────────────────────

/**
 * Lee el tema inicial de `localStorage`, cayendo en la preferencia del sistema.
 *
 * Se calcula **al construir el estado**, no en un efecto: el script anti-FOUC
 * de `index.html` ya pintó el documento con este mismo criterio, y arrancar con
 * otro valor haría exactamente el parpadeo que ese script evita.
 */
/**
 * `matchMedia` puede no existir: navegadores viejos, y jsdom sin configurar.
 *
 * **La consulta está aislada acá a propósito.** Antes se llamaba dentro del
 * `try` de `temaInicial` *y de nuevo en su `catch`*: cuando `matchMedia`
 * faltaba, el `catch` volvía a tirar y el error salía sin atrapar. Como el
 * conmutador vive en el header, eso no dejaba sin botón — **rompía la pantalla
 * entera**. Un camino de respaldo que repite la llamada que falló no es un
 * respaldo.
 */
function prefiereOscuro(): boolean {
  try {
    return matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function temaInicial(): Tema {
  try {
    return resolverTema(localStorage.getItem(TEMA_KEY), prefiereOscuro());
  } catch {
    // Sin `localStorage` —modo privado de algunos navegadores— se sigue el
    // sistema. No poder recordar la elección no es motivo para ignorarla.
    return resolverTema(null, prefiereOscuro());
  }
}

const NOMBRE: Record<Tema, string> = { light: 'claro', dark: 'oscuro' };

/**
 * Conmutador de tema claro/oscuro.
 *
 * Va en el header de las tres apps. El ícono **nunca va solo**: lleva
 * `aria-label` que dice a qué tema cambia. Ver `docs/DESIGN_SYSTEM.md` §10.
 */
export function BotonTema({ className }: { readonly className?: string }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', COLOR_DE_BARRA[tema]);

    try {
      localStorage.setItem(TEMA_KEY, tema);
    } catch {
      /* Sin `localStorage` el tema vale para esta sesión y nada más. */
    }
  }, [tema]);

  const siguiente = alternarTema(tema);

  return (
    <button
      type="button"
      onClick={() => setTema(siguiente)}
      aria-label={`Cambiar a tema ${NOMBRE[siguiente]}`}
      className={cn(
        'min-h-[44px] min-w-[44px] rounded-[var(--radius-sm)] border',
        'flex items-center justify-center shrink-0 print:hidden',
        className,
      )}
    >
      <span aria-hidden="true">{tema === 'dark' ? '☀' : '☾'}</span>
    </button>
  );
}

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
      {titulo && <span className="font-semibold">{titulo}</span>}

      <div className="ml-auto flex items-center gap-2">
        {children}
        <BotonTema />
      </div>
    </header>
  );
}
