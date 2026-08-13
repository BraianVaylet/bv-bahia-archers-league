/**
 * Componentes del sitio público.
 *
 * Deliberadamente pocos: la landing es de lectura y no comparte el bundle de la
 * PWA. Duplicar tres primitivas pesa menos que arrastrar toda la biblioteca de
 * administración a una página que sólo muestra tablas.
 *
 * Ver `docs/ARCHITECTURE.md` §3.
 */

import { BotonTema, cn, Logo, StakeChip } from '@bal/ui';
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
export { BotonTema, cn, StakeChip };

export function Screen({ children }: { readonly children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl px-4 pb-12 flex flex-col gap-6">{children}</div>;
}

export function Encabezado() {
  return (
    <header className="border-b">
      <nav className="mx-auto w-full max-w-3xl px-4 py-3 flex items-center gap-4 flex-wrap">
        <Link
          to="/"
          className="font-[var(--font-display)] font-bold min-h-[44px] flex items-center gap-2"
        >
          {/* El logo acompaña al nombre, no lo reemplaza: un ícono solo no dice
              de qué liga se trata, ni se lee en un lector de pantalla. */}
          <Logo size={28} className="shrink-0" />
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
        <BotonTema className="ml-auto" />
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

/** Tabla que scrollea sola. La página nunca scrollea de costado. */
export function TablaScrollable({ children }: { readonly children: ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  );
}
