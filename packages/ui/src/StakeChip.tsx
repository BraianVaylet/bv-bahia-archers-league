/**
 * Estaca: color y nombre, siempre juntos.
 *
 * El color **nunca** va solo: lleva siempre el nombre escrito. Un daltónico lee
 * «Azul»; el resto ve el color. Ninguno depende del otro.
 *
 * Es la única pieza de la interfaz que usa rojo, azul y amarillo. Ver la regla
 * 8 de `CLAUDE.md` y `docs/DESIGN_SYSTEM.md` §2.2.
 */

import type { Stake } from '@bal/shared';
import { cn } from './cn.js';

const ESTACAS: Readonly<Record<Stake, { readonly color: string; readonly label: string }>> = {
  roja: { color: 'var(--stake-roja)', label: 'Roja' },
  azul: { color: 'var(--stake-azul)', label: 'Azul' },
  amarilla: { color: 'var(--stake-amarilla)', label: 'Amarilla' },
};

export interface StakeChipProps {
  readonly stake: string;
  /**
   * Para tablas densas.
   *
   * Las dos copias que había diferían **sólo en esto**: la landing lo usaba a
   * `h-6/text-xs` dentro de tablas y la PWA a `h-7/text-sm` donde hay que
   * tocarlo. Es una diferencia real, así que queda como prop en vez de
   * elegir un tamaño y empeorar una de las dos pantallas.
   */
  readonly compacto?: boolean;
}

export function StakeChip({ stake, compacto }: StakeChipProps) {
  const info = ESTACAS[stake as Stake];
  if (!info) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)]',
        compacto ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-sm',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('rounded-full shrink-0', compacto ? 'w-2.5 h-2.5' : 'w-3 h-3')}
        style={{ backgroundColor: info.color }}
      />
      <span>Estaca {info.label}</span>
    </span>
  );
}
