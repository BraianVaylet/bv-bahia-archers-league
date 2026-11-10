/**
 * El ranking de una categoría en la vista elegida: los que llegaron al mínimo de torneos y los que
 * todavía no.
 */

import { CATEGORY_INFO } from '@bal/shared';
import { clasesDeTarjeta, cn } from '../../components/ui.js';
import type { CategoriaRankeada, Vista } from './tipos.js';

/** El emoji nunca va solo: lleva su nombre. Ver `docs/DESIGN_SYSTEM.md` §10. */
/**
 * El puesto en un círculo `--nock-soft` del 1 al 3 (`REF7-9`, como la landing en `REF7-8`). Antes
 * llevaba una medalla emoji: el oro y el bronce son el amarillo y el naranja de las estacas
 * (regla 8) y la dirección visual evita los emoji.
 */
function Puesto({
  puesto,
  empate,
}: {
  readonly puesto?: number | undefined;
  readonly empate?: boolean;
}) {
  const podio = puesto !== undefined && puesto <= 3;
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      <span
        {...(podio ? { 'data-podio': '' } : {})}
        className={cn(
          'inline-flex size-8 items-center justify-center rounded-full font-display font-bold',
          podio ? 'bg-[var(--nock-soft)]' : null,
        )}
      >
        {puesto}
      </span>
      {empate ? <span className="text-[var(--ink-muted)]">=</span> : null}
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
      <h2 className="text-h3">{CATEGORY_INFO[c.category].label}</h2>

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
                <Puesto puesto={e.position} empate={e.tied === true} />
                <span className="truncate">
                  {e.lastName}, {e.firstName}
                </span>
              </span>

              <span className="text-sm font-mono shrink-0 text-right font-semibold">
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
