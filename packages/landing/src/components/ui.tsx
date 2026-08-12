/**
 * Componentes del sitio público.
 *
 * Deliberadamente pocos: la landing es de lectura y no comparte el bundle de la
 * PWA. Duplicar tres primitivas pesa menos que arrastrar toda la biblioteca de
 * administración a una página que sólo muestra tablas.
 *
 * Ver `docs/ARCHITECTURE.md` §3.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function cn(...clases: (string | false | undefined | null)[]): string {
  return clases.filter(Boolean).join(' ');
}

export function Screen({ children }: { readonly children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl px-4 pb-12 flex flex-col gap-6">{children}</div>;
}

export function Encabezado() {
  return (
    <header className="border-b">
      <nav className="mx-auto w-full max-w-3xl px-4 py-3 flex items-center gap-4 flex-wrap">
        <Link
          to="/"
          className="font-[var(--font-display)] font-bold min-h-[44px] flex items-center"
        >
          Liga Bahiense
        </Link>
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

/**
 * El color de estaca **nunca** va solo: lleva siempre el nombre escrito.
 * Ver `docs/DESIGN_SYSTEM.md` §2.2.
 */
const ESTACAS: Record<string, { color: string; label: string }> = {
  roja: { color: 'var(--stake-roja)', label: 'Roja' },
  azul: { color: 'var(--stake-azul)', label: 'Azul' },
  amarilla: { color: 'var(--stake-amarilla)', label: 'Amarilla' },
};

export function StakeChip({ stake }: { readonly stake: string }) {
  const info = ESTACAS[stake];
  if (!info) return null;

  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-[var(--surface-2)] text-xs">
      <span
        aria-hidden="true"
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: info.color }}
      />
      <span>Estaca {info.label}</span>
    </span>
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

/** Tabla que scrollea sola. La página nunca scrollea de costado. */
export function TablaScrollable({ children }: { readonly children: ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  );
}
