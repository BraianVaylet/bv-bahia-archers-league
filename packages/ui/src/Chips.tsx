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
  ESTADO_DE_TORNEO,
  type Modality,
  SCORING,
  type TournamentStatus,
} from '@bal/shared';
import type { CSSProperties } from 'react';
import { cn } from './cn.js';
import { ICONO_DE_CATEGORIA } from './iconos/categoria.js';
import { ICONO_DE_MODALIDAD } from './iconos/modalidad.js';
import { COLOR_DE_CATEGORIA, COLOR_DE_MODALIDAD } from './paleta.js';

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
export function ChipModalidad({
  modality,
  compacto,
  pct,
}: ChipProps & {
  readonly modality: Modality;
  /**
   * Qué proporción del recorrido ocupa.
   *
   * Va **dentro del mismo chip** y no en un renglón aparte: el número y aquello
   * de lo que habla tienen que poder leerse de un vistazo. Separados, hay que
   * emparejarlos con la vista.
   */
  readonly pct?: number;
}) {
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
      {pct !== undefined && <span className="font-semibold tabular-nums">{pct}%</span>}
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
  readonly publico?: boolean | undefined;
  /** Sobre la banda `monte` (la tarjeta flotante del hero de la landing). */
  readonly sobreMonte?: boolean | undefined;
}

/**
 * Estado del torneo: **un punto de color y el texto**, en una píldora con borde
 * (`REF7-4`, `DISENO.md` §4.5).
 *
 * Hasta `REF7-4` era una píldora rellena con el color del estado, que pesaba
 * más que el nombre del torneo (`C-2`), y escribía en `--bg` encima: sobre el
 * verde de «completado» daba 2.59:1 (`A-4`). Ahora el color va al punto y el
 * texto a la tinta. «En curso» late, y el latido se apaga con
 * `prefers-reduced-motion` (bloque global de `tokens.css`).
 *
 * Devuelve `null` cuando el estado **no se muestra en público** y se pidió la
 * versión pública: un torneo sin iniciar no es noticia para el visitante.
 */
export function BadgeEstado({ status, publico, compacto, sobreMonte }: BadgeEstadoProps) {
  const info = ESTADO_DE_TORNEO[status];
  const texto = publico ? info.publico : info.label;
  if (!texto) return null;

  const enVivo = status === 'en_proceso';
  // El color sigue saliendo del catálogo (`paleta.test.ts` lo exige); sólo sobre
  // monte el punto vivo pasa al chartreuse pleno, que es el que se ve ahí.
  const color = sobreMonte && enVivo ? 'var(--monte-accent)' : info.color;

  return (
    <span
      data-testid="estado-torneo"
      data-estado={status}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border font-semibold whitespace-nowrap',
        compacto ? 'h-6 pl-2 pr-2.5 text-xs' : 'h-7 pl-2.5 pr-3 text-[13px]',
        sobreMonte
          ? 'bg-[var(--monte-2)] border-[var(--monte-line)] text-[var(--monte-ink)]'
          : 'bg-[var(--surface)] text-[var(--ink)]',
      )}
    >
      <span
        data-punto
        aria-hidden="true"
        style={{ '--st': color } as CSSProperties}
        className={cn('size-2 shrink-0 rounded-full bg-[var(--st)]', enVivo && 'animate-pulso')}
      />
      {texto}
    </span>
  );
}
