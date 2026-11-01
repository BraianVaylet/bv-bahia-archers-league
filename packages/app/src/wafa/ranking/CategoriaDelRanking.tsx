/**
 * El ranking de una categoría en la vista elegida: los que llegaron al mínimo de torneos y los que
 * todavía no.
 */

import { CATEGORY_INFO, medallaDe } from '@bal/shared';
import { clasesDeTarjeta, cn } from '../../components/ui.js';
import type { CategoriaRankeada, Vista } from './tipos.js';

/** El emoji nunca va solo: lleva su nombre. Ver `docs/DESIGN_SYSTEM.md` §10. */
function Medalla({ puesto }: { readonly puesto?: number | undefined }) {
  const medalla = medallaDe(puesto);
  if (!medalla) return null;

  return (
    <span role="img" aria-label={medalla.nombre}>
      {medalla.emoji}
    </span>
  );
}

export function CategoriaDelRanking({
  c,
  vista,
  bestN,
}: {
  readonly c: CategoriaRankeada;
  readonly vista: Vista;
  /** Cuántos torneos hacen falta para figurar: lo manda el servidor. */
  readonly bestN: number;
}) {
  return (
    <section key={c.category} className="flex flex-col gap-2" data-testid={`cat-${c.category}`}>
      <h2 className="font-semibold">{CATEGORY_INFO[c.category].label}</h2>

      {c[vista].ranked.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)]">
          Nadie llegó todavía al mínimo de torneos en esta categoría.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {c[vista].ranked.map((e) => (
            <li
              key={e.archerId}
              className={cn(clasesDeTarjeta(), 'flex items-center justify-between gap-3')}
              data-testid={`fila-${e.lastName}`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="tabular-nums font-semibold w-8 shrink-0">
                  {e.position}
                  {e.tied && <span className="text-[var(--ink-muted)]">=</span>}
                </span>
                <Medalla puesto={e.position} />
                <span className="truncate">
                  {e.lastName}, {e.firstName}
                </span>
              </span>

              <span className="text-sm tabular-nums shrink-0 text-right font-semibold">
                {e.bestNAvgPct}%
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* No se ocultan: esconderlos haría creer que se perdió su resultado. */}
      {c[vista].notYetEligible.length > 0 && (
        <details className="text-sm">
          <summary className="min-h-[44px] flex items-center cursor-pointer text-[var(--ink-muted)]">
            {c[vista].notYetEligible.length} con menos de {bestN} torneos
          </summary>
          <ul className="flex flex-col gap-1 pb-2">
            {c[vista].notYetEligible.map((e) => (
              <li key={e.archerId} data-testid={`pendiente-${e.lastName}`}>
                {e.lastName}, {e.firstName}{' '}
                <span className="text-[var(--ink-muted)]">
                  — {e.tournamentsPlayed} {e.tournamentsPlayed === 1 ? 'torneo' : 'torneos'}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
