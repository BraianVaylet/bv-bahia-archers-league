/**
 * El podio de una categoría: lo que el admin revisa antes de publicar.
 */

import { StakeChip } from '../../components/ui.js';
import type { podios } from '../torneo.js';

export function PodioDeCategoria({ p }: { readonly p: ReturnType<typeof podios>[number] }) {
  return (
    <section key={p.category} className="flex flex-col gap-2" data-testid={`podio-${p.category}`}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
        {p.label}
      </h2>

      <ol className="flex flex-col gap-1.5">
        {p.filas.map((f) => (
          <li
            key={f.participante.id}
            className="rounded-[var(--radius-md)] border px-3 py-2 bg-[var(--surface)] flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-display font-bold tabular-nums w-6 shrink-0">{f.position}</span>
              <span className="min-w-0 truncate">
                {f.participante.lastName}, {f.participante.firstName}
                {/* El empate se dice: dos primeros no es un error de carga. */}
                {f.tied && <span className="text-[var(--ink-muted)]"> · empatado</span>}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <StakeChip stake={f.participante.stake} />
              <span className="tabular-nums font-medium">{f.participante.total}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
