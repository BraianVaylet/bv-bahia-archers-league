/**
 * Gráfico de dona.
 *
 * **SVG puro, sin dependencias.** Una librería de gráficos para dos donas de
 * cuatro y siete porciones costaría más que toda la landing, que tiene 120 KB
 * de presupuesto.
 *
 * **Dona y no torta**: el agujero del medio deja lugar al total, que es el dato
 * que contesta «¿de qué tamaño era este torneo?» sin tener que sumar las
 * porciones a ojo.
 *
 * **La leyenda no es opcional.** Un color sin nombre no dice nada —ni a quien
 * no distingue dos verdes, ni a quien no conoce el código de colores del
 * proyecto—, así que cada porción figura escrita con su nombre y su
 * porcentaje. El dibujo acelera la lectura de algo que ya está en texto.
 * Ver `docs/DESIGN_SYSTEM.md` §10.
 */

import type { CSSProperties } from 'react';
import { cn } from './cn.js';

/** Par claro/oscuro, igual que en `@bal/shared/paleta`. */
export interface ColorDeParte {
  readonly claro: string;
  readonly oscuro: string;
}

export interface ParteDeTorta {
  readonly clave: string;
  readonly etiqueta: string;
  /** Entero. Las partes suman 100: lo garantiza `repartirPorcentajes`. */
  readonly pct: number;
  readonly count: number;
  readonly color: ColorDeParte;
}

export interface GraficoDeTortaProps {
  readonly titulo: string;
  readonly partes: readonly ParteDeTorta[];
  /** Qué se cuenta: «blancos», «arqueros». Va en el centro y en la descripción. */
  readonly unidad: string;
  readonly className?: string;
}

/**
 * Radio y grosor en el espacio del `viewBox`. El SVG escala solo.
 *
 * El trazo es grueso —26 de 100— para que una porción del 7% siga siendo un
 * bloque visible y no una línea.
 */
const RADIO = 37;
const GROSOR = 26;
const VUELTA = 2 * Math.PI * RADIO;

export function GraficoDeTorta({ titulo, partes, unidad, className }: GraficoDeTortaProps) {
  // Sin partes no hay nada que dibujar, y una dona vacía parece un error.
  if (partes.length === 0) return null;

  const total = partes.reduce((n, p) => n + p.count, 0);

  const descripcion = `${titulo}: ${partes
    .map((p) => `${p.etiqueta} ${p.pct}%`)
    .join(', ')}. ${total} ${unidad} en total.`;

  let acumulado = 0;

  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <h3 className="font-semibold">{titulo}</h3>

      <div className="flex items-center gap-4 flex-wrap">
        <svg
          viewBox="0 0 100 100"
          className="w-32 h-32 shrink-0 -rotate-90"
          role="img"
          aria-label={descripcion}
          data-testid={`torta-${titulo.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {/* El anillo de fondo tapa el hueco que dejan los redondeos. */}
          <circle
            cx="50"
            cy="50"
            r={RADIO}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth={GROSOR}
          />

          {partes.map((p) => {
            const largo = (p.pct / 100) * VUELTA;
            const offset = -(acumulado / 100) * VUELTA;
            acumulado += p.pct;

            return (
              <circle
                key={p.clave}
                // `data-chip` engancha la regla de `tokens.css` que elige entre
                // el color claro y el oscuro según el tema. Resolverlo en
                // JavaScript dejaría un frame con el color anterior al conmutar.
                data-chip="torta"
                style={
                  { '--chip': p.color.claro, '--chip-oscuro': p.color.oscuro } as CSSProperties
                }
                cx="50"
                cy="50"
                r={RADIO}
                fill="none"
                stroke="var(--chip-actual)"
                strokeWidth={GROSOR}
                strokeDasharray={`${largo} ${VUELTA - largo}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </svg>

        <ul className="flex flex-col gap-1 text-sm min-w-0">
          {partes.map((p) => (
            <li key={p.clave} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                data-chip="torta"
                style={
                  { '--chip': p.color.claro, '--chip-oscuro': p.color.oscuro } as CSSProperties
                }
                className="w-3 h-3 rounded-full shrink-0 bg-[var(--chip-actual)]"
              />
              <span className="truncate">{p.etiqueta}</span>
              <span className="ml-auto tabular-nums font-medium">{p.pct}%</span>
              <span className="tabular-nums text-[var(--ink-muted)]">({p.count})</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
