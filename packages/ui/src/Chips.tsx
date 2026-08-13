/**
 * Chips de categoría, modalidad y estado.
 *
 * **Las tres reglas que los gobiernan** (ver `paleta.ts` en `@bal/shared`):
 *
 * 1. El color nunca va solo: ícono y texto van siempre.
 * 2. Categoría y modalidad se distinguen por **forma**: píldora y rectángulo.
 *    Por eso pueden compartir familia de color sin confundirse.
 * 3. Fondo teñido y texto fuerte, no bloque saturado. Los bloques saturados son
 *    de las estacas.
 */

import {
  type BowCategory,
  CATEGORY_INFO,
  COLOR_DE_CATEGORIA,
  COLOR_DE_MODALIDAD,
  ESTADO_DE_TORNEO,
  type Modality,
  SCORING,
  type TournamentStatus,
} from '@bal/shared';
import type { CSSProperties } from 'react';
import { cn } from './cn.js';
import { ICONO_DE_CATEGORIA } from './iconos/categoria.js';
import { ICONO_DE_MODALIDAD } from './iconos/modalidad.js';

/**
 * El color se resuelve **en CSS, no en JavaScript**.
 *
 * Se emiten las dos variantes como variables y el tema elige con una consulta
 * de medios. Leer el tema en React para elegir el hex obligaría a re-renderizar
 * al conmutarlo, y dejaría un frame con el color anterior.
 */
function estiloDeColor(par: { readonly claro: string; readonly oscuro: string }) {
  return { '--chip': par.claro, '--chip-oscuro': par.oscuro } as CSSProperties;
}

const BASE = 'inline-flex items-center gap-1.5 text-[color:var(--chip-actual)]';

export interface ChipProps {
  readonly compacto?: boolean;
}

/** Categoría de arco. Píldora. */
export function ChipCategoria({
  category,
  compacto,
}: ChipProps & { readonly category: BowCategory }) {
  const Icono = ICONO_DE_CATEGORIA[category];

  return (
    <span
      data-chip="categoria"
      style={estiloDeColor(COLOR_DE_CATEGORIA[category])}
      className={cn(
        BASE,
        'rounded-full bg-[var(--surface-2)]',
        compacto ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-sm',
      )}
    >
      <Icono size={compacto ? 14 : 16} />
      <span>{CATEGORY_INFO[category].label}</span>
    </span>
  );
}

/** Modalidad del blanco. Rectángulo. */
export function ChipModalidad({ modality, compacto }: ChipProps & { readonly modality: Modality }) {
  const Icono = ICONO_DE_MODALIDAD[modality];

  return (
    <span
      data-chip="modalidad"
      style={estiloDeColor(COLOR_DE_MODALIDAD[modality])}
      className={cn(
        BASE,
        'rounded-[var(--radius-sm)] bg-[var(--surface-2)]',
        compacto ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-sm',
      )}
    >
      <Icono size={compacto ? 14 : 16} />
      <span>{SCORING[modality].label}</span>
    </span>
  );
}

export interface BadgeEstadoProps extends ChipProps {
  readonly status: TournamentStatus;
  /**
   * Usa el texto del público en vez del de administración.
   *
   * Son distintos a propósito: al admin le importa qué le falta hacer, al
   * visitante qué está mirando. Ver `ESTADO_DE_TORNEO`.
   */
  readonly publico?: boolean;
}

/**
 * Estado del torneo.
 *
 * Devuelve `null` cuando el estado **no se muestra en público** y se pidió la
 * versión pública: un torneo sin iniciar no es noticia para el visitante.
 */
export function BadgeEstado({ status, publico, compacto }: BadgeEstadoProps) {
  const info = ESTADO_DE_TORNEO[status];
  const texto = publico ? info.publico : info.label;
  if (!texto) return null;

  return (
    <span
      data-estado={status}
      style={{ backgroundColor: info.color }}
      className={cn(
        'inline-flex items-center rounded-full font-medium text-[var(--bg)]',
        compacto ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-sm',
      )}
    >
      {texto}
    </span>
  );
}
