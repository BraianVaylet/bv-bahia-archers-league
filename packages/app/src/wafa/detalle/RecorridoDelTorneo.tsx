/**
 * El recorrido de un torneo: sus blancos, y por qué alguno está bloqueado.
 */

import { ChipModalidad, IconoCandado } from '@bal/ui';
import { cn } from '../../components/ui.js';
import { motivoDeBloqueo } from '../torneo.js';
import type { Torneo } from './useTorneo.js';

export function RecorridoDelTorneo({
  torneo,
  bloqueados,
}: {
  readonly torneo: Torneo;
  readonly bloqueados: readonly number[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
        Recorrido
      </h2>

      <ul className="flex flex-col gap-1.5">
        {torneo.targets.map((t) => {
          const bloqueo = motivoDeBloqueo(t.index, [...bloqueados], torneo.status);

          return (
            <li
              key={t.index}
              className={cn(
                'rounded-[var(--radius-md)] border px-3 py-2 bg-[var(--surface)]',
                bloqueo && 'opacity-70',
              )}
              data-testid={`blanco-${t.index}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-2">
                  {t.index}.
                  <ChipModalidad modality={t.modality} compacto />
                </span>
                <span className="text-sm text-[var(--ink-muted)] tabular-nums">
                  {t.arrows} flechas
                </span>
              </div>

              {/* Un blanco bloqueado dice POR QUÉ: si no, parece un error. */}
              {bloqueo && (
                <p className="text-sm text-[var(--ink-muted)]">
                  <IconoCandado size={14} className="inline-block mr-1 align-[-2px]" />
                  {bloqueo}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
