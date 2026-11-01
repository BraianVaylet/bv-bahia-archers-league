/**
 * El avance de una patrulla en el seguimiento del torneo.
 */

import { clasesDeTarjeta, cn } from '../../components/ui.js';
import type { AvanceDePatrulla } from '../torneo.js';
import { DesbloquearFirma } from './DesbloquearFirma.js';

export function TarjetaDePatrulla({
  avance,
  puedeDesbloquear,
  onCambio,
}: {
  readonly avance: AvanceDePatrulla;
  readonly puedeDesbloquear: boolean;
  readonly onCambio: () => void;
}) {
  return (
    <article
      className={cn(clasesDeTarjeta(), 'flex flex-col gap-2')}
      data-testid={`avance-${avance.number}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">Patrulla {avance.number}</span>
        <span className="text-sm tabular-nums text-[var(--ink-muted)]">
          {avance.targetsCompleted} de {avance.totalTargets} blancos
        </span>
      </div>

      <div
        className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden"
        role="progressbar"
        aria-label={`Avance de la patrulla ${avance.number}`}
        aria-valuenow={avance.pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-[var(--nock)]" style={{ width: `${avance.pct}%` }} />
      </div>

      {avance.sinFirmar.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[var(--ink-muted)]">
            Falta la firma de {avance.sinFirmar.map((m) => m.lastName).join(', ')}.
          </p>

          {puedeDesbloquear &&
            avance.sinFirmar.map((m) => (
              <DesbloquearFirma key={m.id} participante={m} onHecho={onCambio} />
            ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--ok)]">Todos firmaron.</p>
      )}
    </article>
  );
}
