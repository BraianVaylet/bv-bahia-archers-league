/**
 * Fila de un arquero en la página de blanco.
 *
 * Las flechas se muestran **de mayor a menor**, que es la notación de planilla.
 * El orden de carga no importa: el total es el mismo.
 * Ver `docs/DOMAIN_WA.md` §2.
 */

import { type Modality, sortArrowsDescending } from '@bal/shared';
import { cn, StakeChip } from '../components/ui.js';

export interface ArrowRowProps {
  readonly firstName: string;
  readonly lastName: string;
  readonly stake: string;
  readonly unit: string;
  readonly modality: Modality;
  readonly arrows: readonly string[];
  readonly total: number;
  readonly arrowsPerTarget: number;
  readonly seleccionado: boolean;
  readonly onSelect: () => void;
  readonly onBorrarUltima: () => void;
  /**
   * El arquero ya firmó: el puntaje queda congelado.
   *
   * La firma guarda un hash del puntaje del momento. Editarlo después hace que
   * el servidor rechace el cierre con `SIGNATURE_MISMATCH`, un error que sale
   * al final del recorrido y lejos de su causa.
   */
  readonly firmado?: boolean;
}

export function ArrowRow({
  firstName,
  lastName,
  stake,
  unit,
  modality,
  arrows,
  total,
  arrowsPerTarget,
  seleccionado,
  onSelect,
  onBorrarUltima,
  firmado,
}: ArrowRowProps) {
  const ordenadas = sortArrowsDescending(modality, arrows);
  const completo = arrows.length >= arrowsPerTarget;

  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] border p-3 flex flex-col gap-2',
        seleccionado
          ? 'bg-[var(--surface)] border-[var(--nock)] border-2'
          : 'bg-[var(--surface-2)]',
      )}
      data-testid={`fila-${lastName}`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={seleccionado}
        className="flex items-baseline justify-between gap-3 text-left min-h-[44px]"
      >
        <span className="flex flex-col">
          <span className="font-semibold">
            {lastName}, {firstName}
          </span>
          <span className="text-sm text-[var(--ink-muted)]">Unidad {unit}</span>
        </span>

        <span className="font-[var(--font-display)] text-2xl font-bold tabular-nums">
          {arrows.length > 0 ? total : '—'}
        </span>
      </button>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {Array.from({ length: arrowsPerTarget }, (_, i) => {
            const token = ordenadas[i];
            return (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: las casillas son posicionales
                key={`flecha-${i}`}
                className={cn(
                  'min-w-[36px] h-9 px-2 grid place-items-center rounded-[var(--radius-sm)] text-base font-medium tabular-nums',
                  token
                    ? 'bg-[var(--surface)] border'
                    : 'border border-dashed text-[var(--ink-muted)]',
                )}
              >
                {token ?? ''}
              </span>
            );
          })}
        </div>

        {arrows.length > 0 && !firmado && (
          <button
            type="button"
            onClick={onBorrarUltima}
            aria-label={`Borrar la última de ${lastName}`}
            className="min-h-[44px] min-w-[44px] px-3 rounded-[var(--radius-md)] text-sm text-[var(--ink-muted)] border"
          >
            Borrar
          </button>
        )}
      </div>

      <StakeChip stake={stake} />
      {completo && <span className="sr-only">Puntaje completo</span>}

      {/* Un control que desaparece sin explicación parece un bug de la app. */}
      {firmado && (
        <p className="text-sm text-[var(--ink-muted)]">
          {lastName} ya firmó: el puntaje quedó cerrado. Para corregirlo, el admin tiene que
          desbloquear la firma.
        </p>
      )}
    </div>
  );
}
