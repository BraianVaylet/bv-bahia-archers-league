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

/** Tabla que scrollea sola. La página nunca scrollea de costado. */
export function TablaScrollable({ children }: { readonly children: ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  );
}
