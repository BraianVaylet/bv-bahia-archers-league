/**
 * Componentes del sitio público.
 *
 * Deliberadamente pocos: la landing es de lectura y no comparte el bundle de la
 * PWA. Duplicar tres primitivas pesa menos que arrastrar toda la biblioteca de
 * administración a una página que sólo muestra tablas.
 *
 * Ver `docs/ARCHITECTURE.md` §3.
 */

import cba from '@bal/shared/assets/cba.webp';
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
          **Los logos, en una sola línea que no se parte.**

          Antes el header era un solo `flex-wrap` con logo, nombre, los dos
          enlaces y el conmutador de tema: a 320 px se partía en tres renglones
          y la marca terminaba abajo de la navegación.

          Ahora son dos filas fijas. La de arriba es identidad —los dos escudos
          a la izquierda, el nombre a la derecha— y no envuelve nunca; la de
          abajo es navegación. Meter todo en una sola fila entraba justo en el
          papel y no en un celular real.
        */}
        <div className="flex items-center gap-2 min-h-[44px]">
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Inicio">
            {/*
              El escudo del CBA va primero: es el club que sostiene la liga.

              Sobre placa blanca literal, no un token. Es un PNG de tinta
              oscura con fondo transparente —el único asset del proyecto que
              depende del fondo— y sobre el tema oscuro desaparece. Misma
              decisión que en el pie, de `REF3-2`.
            */}
            <span className="shrink-0 rounded-[var(--radius-sm)] bg-white p-1 flex items-center">
              <img src={cba} alt="Círculo Bahiense de Arquería" width={22} height={22} />
            </span>
            <Logo size={26} className="shrink-0" />
          </Link>

          {/* A la derecha, y `truncate` porque el nombre es lo único elástico. */}
          <span className="ml-auto font-[var(--font-display)] font-bold truncate">
            Liga Bahiense
          </span>
          <BotonTema className="shrink-0" />
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
