/**
 * El recorrido como anillo: un arco por blanco, lleno el que ya está cargado (`REF7-4` / `C-5`).
 *
 * Es el `CircuitRing` que `docs/DESIGN_SYSTEM.md` §6.5 llama «el elemento de firma» y que nunca
 * se había implementado. Especificación en `docs/post/ref-7/DISENO.md` §4.9; la geometría sale de
 * `ring()` en `referencia/generador/components.py`.
 *
 * **Siempre con datos reales**, y sólo en sus tres lugares: la tarjeta «En curso» de la landing, el
 * recorrido de WAFL y el seguimiento de patrullas de WAFA. Los anillos decorativos del hero son
 * otra cosa (no portan información y van `aria-hidden`).
 *
 * El anillo **gira para que el blanco de inicio quede arriba**, donde está el triángulo: cada
 * patrulla arranca en un blanco distinto, y lo que importa es cuánto le falta a ella.
 */

import { cn } from './cn.js';

export type TamañoDeAnillo = 36 | 44 | 76 | 120;

export interface AnilloDeRecorridoProps {
  readonly total: number;
  /**
   * Cuántos blancos están cargados, contando desde `inicio` y en orden; o **cuáles** (sus
   * índices), si no se cargaron en orden.
   */
  readonly completados: number | readonly number[];
  /** Índice del blanco de inicio de la patrulla (base 0). */
  readonly inicio?: number;
  readonly tamaño?: TamañoDeAnillo;
  /** «4/6 BLANCOS» en el centro. Sólo tiene lugar a 120px. */
  readonly conEtiqueta?: boolean;
  readonly className?: string;
}

/** Grosor del trazo según el tamaño: §4.9. */
const TRAZO: Readonly<Record<TamañoDeAnillo, number>> = { 36: 5, 44: 6, 76: 8, 120: 10 };

/** Grados de hueco entre un arco y el siguiente. */
const HUECO = 4;

/** Dos decimales alcanzan: más precisión es markup más largo sin diferencia visible. */
const r2 = (n: number) => Math.round(n * 100) / 100;

function arco(centro: number, radio: number, desde: number, hasta: number): string {
  const punto = (grados: number) => {
    const rad = (grados * Math.PI) / 180;
    return `${r2(centro + radio * Math.cos(rad))} ${r2(centro + radio * Math.sin(rad))}`;
  };
  const grande = hasta - desde > 180 ? 1 : 0;
  return `M${punto(desde)} A${r2(radio)} ${r2(radio)} 0 ${grande} 1 ${punto(hasta)}`;
}

/** Los índices de los blancos cargados. */
function indicesCompletos(total: number, completados: number | readonly number[], inicio: number) {
  if (typeof completados !== 'number')
    return new Set(completados.filter((i) => i >= 0 && i < total));

  const cuantos = Math.min(Math.max(completados, 0), total);
  return new Set(Array.from({ length: cuantos }, (_, k) => (inicio + k) % total));
}

export function AnilloDeRecorrido({
  total,
  completados,
  inicio = 0,
  tamaño = 44,
  conEtiqueta,
  className,
}: AnilloDeRecorridoProps) {
  if (total <= 0) return null;

  const trazo = TRAZO[tamaño];
  const centro = tamaño / 2;
  const radio = (tamaño - trazo) / 2 - 2;
  const paso = 360 / total;
  const completos = indicesCompletos(total, completados, ((inicio % total) + total) % total);

  return (
    <div
      role="img"
      aria-label={`${completos.size} de ${total} blancos cargados`}
      className={cn('relative inline-grid place-items-center shrink-0', className)}
    >
      <svg width={tamaño} height={tamaño} viewBox={`0 0 ${tamaño} ${tamaño}`} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => {
          // Lugar en el anillo: el blanco de inicio va arriba (−90°).
          const lugar = (i - inicio + total * 2) % total;
          const desde = -90 + lugar * paso + HUECO / 2;
          const hasta = -90 + (lugar + 1) * paso - HUECO / 2;
          const completo = completos.has(i);

          return (
            <path
              // biome-ignore lint/suspicious/noArrayIndexKey: un segmento por blanco; el índice ES el blanco.
              key={i}
              data-segmento={i}
              data-completo={completo ? '' : undefined}
              d={arco(centro, radio, desde, hasta)}
              strokeWidth={trazo}
              className={cn(
                'fill-none transition-[stroke] duration-[400ms] ease-out',
                completo ? 'stroke-[var(--nock-text)]' : 'stroke-[var(--line)]',
              )}
            />
          );
        })}
        {/* El inicio de la patrulla. */}
        <path d={`M${centro - 5} 0 h10 l-5 6 z`} className="fill-[var(--ink)]" />
      </svg>

      {conEtiqueta ? (
        <div className="absolute text-center leading-none">
          <strong className="block font-display text-[28px] font-bold">
            {completos.size}/{total}
          </strong>
          <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--ink-muted)]">
            blancos
          </span>
        </div>
      ) : null}
    </div>
  );
}
