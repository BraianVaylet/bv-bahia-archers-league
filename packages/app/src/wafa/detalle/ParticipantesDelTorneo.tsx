/**
 * Cuántos blancos lleva cada participante, en un torneo ya iniciado.
 */

import { ChipCategoria } from '@bal/ui';
import type { ResultadoParticipante } from '../torneo.js';

export function ParticipantesDelTorneo({
  participantes,
  totalBlancos,
}: {
  readonly participantes: readonly ResultadoParticipante[];
  readonly totalBlancos: number;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
        Participantes
      </h2>

      <ul className="flex flex-col gap-1.5">
        {participantes.map((p) => (
          <li
            key={p.id}
            className="rounded-[var(--radius-md)] border px-3 py-2 bg-[var(--surface)] flex items-baseline justify-between gap-2"
            data-testid={`participante-${p.lastName}`}
          >
            <span className="min-w-0 truncate">
              {p.lastName}, {p.firstName} <ChipCategoria category={p.category} compacto />
            </span>
            <span className="tabular-nums font-medium shrink-0">
              {p.targetsCompleted}/{totalBlancos}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
