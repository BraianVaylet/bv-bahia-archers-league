/**
 * Una tarjeta de rol de la puerta `/app` (`REF7-7` / `P-1`). Es el `RoleCard` de
 * `docs/post/ref-7/DISENO.md` §4.15; sólo la usa la puerta, por eso no vive en `@bal/ui`.
 *
 * Dice **qué hace cada app**, que es lo que la puerta vieja no decía: quien entraba por primera vez
 * veía dos botones y tenía que adivinar. La de líder es la principal (borde de 2px) y avisa que
 * funciona sin señal, que es lo que la distingue el día del torneo.
 *
 * **El título va primero en el DOM**, así el nombre accesible empieza por él:
 * `getByRole('link', { name: 'Soy líder de patrulla' })` (Playwright busca por subcadena) sigue
 * encontrándola.
 */

import { cn, type Icono, IconoChevron } from '@bal/ui';
import { Link } from 'react-router-dom';

export function TarjetaDeRol({
  a,
  titulo,
  descripcion,
  icono: IconoDelRol,
  etiqueta,
  principal,
}: {
  readonly a: string;
  readonly titulo: string;
  readonly descripcion: string;
  readonly icono: Icono;
  /** Sólo la principal: «Funciona sin señal». */
  readonly etiqueta?: string;
  readonly principal?: boolean;
}) {
  return (
    <Link
      to={a}
      className={cn(
        'grid grid-cols-[56px_1fr_24px] items-center gap-4 min-h-[96px] rounded-[var(--radius-lg)]',
        'bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-2)]',
        'transition-[background-color,border-color] duration-[120ms] ease-out',
        // Con 2px de borde, un pixel menos de relleno: las dos tarjetas miden lo mismo.
        principal
          ? 'border-2 border-[var(--nock-text)] p-[15px]'
          : 'border border-[var(--line-strong)] p-4',
      )}
    >
      {/* El orden visual pone el ícono primero; el del DOM, el título (ver arriba). */}
      <span className="col-start-2 row-start-1 min-w-0">
        <span className="block text-lg font-bold leading-[1.3]">{titulo}</span>
        <span className="mt-0.5 block text-sm text-[var(--ink-muted)]">{descripcion}</span>
        {etiqueta ? (
          <span className="mt-1.5 block font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--nock-text)]">
            {etiqueta}
          </span>
        ) : null}
      </span>
      <span className="col-start-1 row-start-1 size-14 grid place-items-center rounded-[var(--radius-md)] bg-[var(--monte)] text-[var(--monte-accent)]">
        <IconoDelRol size={28} />
      </span>
      <IconoChevron className="col-start-3 row-start-1 text-[var(--ink-muted)]" />
    </Link>
  );
}
