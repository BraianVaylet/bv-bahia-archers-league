/**
 * De qué está hecho un recorrido: una barra apilada y su leyenda (`REF7-4` / `C-3`). Es el
 * `ModalityBar` de `docs/post/ref-7/DISENO.md` §4.6.
 *
 * Reemplaza a la fila de `ChipModalidad` con porcentaje en las tarjetas de torneo: dos a cuatro
 * chips en fila eran ruido, y no se podían comparar dos torneos de un vistazo. Una barra de 8px de
 * alto sí: el largo de cada tramo **es** la proporción. `ChipModalidad` sigue para un blanco suelto.
 *
 * El color nunca va solo: la barra entera tiene su `aria-label` en palabras y la leyenda lleva el
 * ícono, el nombre y el porcentaje de cada modalidad.
 */

import { type Modality, SCORING } from '@bal/shared';
import type { CSSProperties } from 'react';
import { cn } from './cn.js';
import { ICONO_DE_MODALIDAD } from './iconos/modalidad.js';
import { COLOR_DE_MODALIDAD } from './paleta.js';

export interface ParteDeLaBarra {
  readonly modality: Modality;
  readonly pct: number;
}

export interface BarraDeModalidadesProps {
  /**
   * Ordenadas de mayor a menor, como las devuelve `distribucionDeModalidades`. Los porcentajes ya
   * suman cien: los reparte `repartirPorcentajes`, no esto.
   */
  readonly modalidades: readonly ParteDeLaBarra[];
  readonly className?: string;
}

/** El mismo mecanismo que los chips: dos variantes como variables y el tema elige en CSS. */
function colorDe(modality: Modality, pct?: number): CSSProperties {
  const par = COLOR_DE_MODALIDAD[modality];
  return {
    '--chip': par.claro,
    '--chip-oscuro': par.oscuro,
    ...(pct === undefined ? {} : { flexGrow: pct, flexBasis: 0 }),
  } as CSSProperties;
}

export function BarraDeModalidades({ modalidades, className }: BarraDeModalidadesProps) {
  if (modalidades.length === 0) return null;

  const descripcion = modalidades.map((m) => `${SCORING[m.modality].label} ${m.pct}%`).join(', ');

  return (
    <div data-testid="modalidades" className={cn('flex flex-col gap-2', className)}>
      <div
        role="img"
        aria-label={`Distribución de modalidades: ${descripcion}`}
        className="flex gap-0.5 h-2 rounded-[var(--radius-full)] overflow-hidden"
      >
        {modalidades.map((m) => (
          <span
            key={m.modality}
            data-tramo
            data-chip="modalidad"
            style={colorDe(m.modality, m.pct)}
            className="bg-[var(--chip-actual)]"
          />
        ))}
      </div>

      {/* La leyenda repite en texto lo que la barra dice en largo: se oculta para el lector de
          pantalla, que ya escuchó la descripción completa en el `aria-label`. */}
      <ul
        data-leyenda
        aria-hidden="true"
        className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[var(--ink-muted)]"
      >
        {modalidades.map((m) => {
          const Icono = ICONO_DE_MODALIDAD[m.modality];
          return (
            <li
              key={m.modality}
              data-chip="modalidad"
              style={colorDe(m.modality)}
              className="inline-flex items-center gap-1"
            >
              <Icono size={14} className="shrink-0 text-[color:var(--chip-actual)]" />
              {SCORING[m.modality].label}{' '}
              <b className="font-semibold text-[var(--ink)]">{m.pct}%</b>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
