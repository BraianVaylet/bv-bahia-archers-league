/**
 * Fila de un arquero en la página de blanco.
 *
 * Las flechas se muestran **de mayor a menor**, que es la notación de planilla.
 * El orden de carga no importa: el total es el mismo.
 * Ver `docs/DOMAIN_WA.md` §2.
 */

import { type Modality, sortArrowsDescending } from '@bal/shared';
import { memo } from 'react';
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

function ArrowRowBase({
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

  // A tira primero (`DOMAIN_WA.md`): es lo que el líder tiene que saber al llamar a cada unidad.
  const orden = unit === 'B' ? 2 : 1;
  // El próximo casillero a cargar, sólo en la unidad elegida y si todavía se puede cargar.
  const siguiente = seleccionado && !firmado && !completo ? arrows.length : -1;

  return (
    <div
      className={cn(
        // `UnitCard` (`REF7-10`, `DISENO.md` §4.13). La activa lleva 2px de borde en el verde que se
        // lee, con un pixel menos de relleno para que la tarjeta no salte al elegirla.
        'grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 rounded-[var(--radius-lg)] bg-[var(--surface)]',
        seleccionado
          ? 'border-2 border-[var(--nock-text)] px-[15px] py-[11px]'
          : 'border px-4 py-3',
      )}
      data-testid={`fila-${lastName}`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={seleccionado}
        className="col-span-2 grid grid-cols-[1fr_auto] items-center gap-3 text-left min-h-[44px]"
      >
        <span className="flex flex-col gap-1 min-w-0">
          <span className="text-h3 truncate">
            {lastName}, {firstName}
          </span>
          <span className="flex flex-wrap items-center gap-2 font-mono text-mono text-[var(--ink-muted)]">
            <span className="uppercase">
              Unidad {unit} · tira {orden}º
            </span>
            <StakeChip stake={stake} compacto />
          </span>
        </span>

        {/* El total a la vista (`F-3`). Cambia solo al cargar: se anuncia sin robar el foco. */}
        <span className="flex flex-col items-end">
          <span
            aria-live="polite"
            className="font-display text-[36px] font-bold leading-none tabular-nums"
          >
            {arrows.length > 0 ? total : '—'}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--ink-muted)]">
            Total
          </span>
        </span>
      </button>

      <div className="col-span-2 flex items-center justify-between gap-2">
        {/*
          Una sola fila siempre: los casilleros miden 48px y se angostan si no entran (seis flechas de
          aire libre a 360px). No se tocan, así que no tienen mínimo táctil; bajar de renglón
          empujaba el teclado fuera de la pantalla.
        */}
        <div className="flex flex-1 min-w-0 gap-1.5">
          {Array.from({ length: arrowsPerTarget }, (_, i) => {
            const token = ordenadas[i];
            return (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: las casillas son posicionales
                key={`flecha-${i}`}
                data-casillero
                {...(i === siguiente ? { 'data-siguiente': '' } : {})}
                className={cn(
                  'h-12 flex-1 basis-0 min-w-0 max-w-12 grid place-items-center rounded-[var(--radius-md)] font-mono text-base font-semibold',
                  token
                    ? 'bg-[var(--surface-2)] border'
                    : i === siguiente
                      ? 'border-2 border-[var(--nock-text)]'
                      : 'border border-dashed border-[var(--line-strong)] text-[var(--ink-muted)]',
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
            className="min-h-[44px] min-w-[44px] px-3 rounded-[var(--radius-md)] text-sm text-[var(--ink-muted)] border border-[var(--line-strong)] hover:bg-[var(--surface-2)]"
          >
            Borrar
          </button>
        )}
      </div>

      {completo && <span className="sr-only">Puntaje completo</span>}

      {/* Un control que desaparece sin explicación parece un bug de la app. */}
      {firmado && (
        <p className="col-span-2 text-sm text-[var(--ink-muted)]">
          {lastName} ya firmó: el puntaje quedó cerrado. Para corregirlo, el admin tiene que
          desbloquear la firma.
        </p>
      )}
    </div>
  );
}

function filaIgual(a: ArrowRowProps, b: ArrowRowProps): boolean {
  return (
    a.firstName === b.firstName &&
    a.lastName === b.lastName &&
    a.stake === b.stake &&
    a.unit === b.unit &&
    a.modality === b.modality &&
    a.total === b.total &&
    a.arrowsPerTarget === b.arrowsPerTarget &&
    a.seleccionado === b.seleccionado &&
    a.firmado === b.firmado &&
    a.onSelect === b.onSelect &&
    a.onBorrarUltima === b.onBorrarUltima &&
    a.arrows.length === b.arrows.length &&
    a.arrows.every((flecha, i) => flecha === b.arrows[i])
  );
}

export const ArrowRow = memo(ArrowRowBase, filaIgual);
