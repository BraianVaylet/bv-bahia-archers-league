/**
 * Evolución del arquero a lo largo de la temporada.
 *
 * Portado de `bv-easy-archery-battle`
 * (`packages/web/src/components/EvolutionChart.tsx`), con los tokens de este
 * proyecto y midiendo **porcentaje normalizado**, no puntaje bruto: cada torneo
 * tiene un máximo distinto, así que los puntajes de dos fechas no se pueden
 * comparar entre sí. Ver `docs/DOMAIN_WA.md` §8.
 *
 * **SVG puro, sin dependencias.** Una librería de gráficos para una línea de
 * cinco puntos costaría más que toda la landing, que tiene 120 KB de
 * presupuesto.
 *
 * **Accesible**: el SVG es una imagen con su descripción completa en el
 * `aria-label` — quien no lo ve, escucha la serie entera. El detalle numérico
 * también está escrito al lado de cada punto, así que no depende de pasar el
 * mouse, que en un celular no existe.
 */

const ANCHO = 320;
const ALTO = 150;
const PAD = { arriba: 16, derecha: 10, abajo: 24, izquierda: 10 };
const INTERNO_ANCHO = ANCHO - PAD.izquierda - PAD.derecha;
const INTERNO_ALTO = ALTO - PAD.arriba - PAD.abajo;

export interface PuntoDeEvolucion {
  /** Nombre del torneo, para la descripción. */
  readonly name: string;
  /** Porcentaje del máximo posible de ESE torneo. */
  readonly normalizedPct: number;
}

export interface GraficoDeEvolucionProps {
  readonly puntos: readonly PuntoDeEvolucion[];
}

export function GraficoDeEvolucion({ puntos }: GraficoDeEvolucionProps) {
  // Con un solo torneo no hay evolución que mostrar: una línea de un punto es
  // un punto. El número ya está en la ficha.
  if (puntos.length < 2) return null;

  const n = puntos.length;
  // Siempre sobre 100: es un porcentaje, y escalar al máximo de la serie haría
  // que una temporada floja se viera igual de buena que una excelente.
  const x = (i: number) => PAD.izquierda + (INTERNO_ANCHO * i) / (n - 1);
  const y = (v: number) => PAD.arriba + INTERNO_ALTO * (1 - Math.min(100, Math.max(0, v)) / 100);

  const coords = puntos.map((p, i) => ({ ...p, cx: x(i), cy: y(p.normalizedPct), seq: i + 1 }));
  const linea = coords.map((c) => `${c.cx},${c.cy}`).join(' ');
  const area = `${PAD.izquierda},${PAD.arriba + INTERNO_ALTO} ${linea} ${
    PAD.izquierda + INTERNO_ANCHO
  },${PAD.arriba + INTERNO_ALTO}`;

  const descripcion = `Evolución del porcentaje por torneo: ${puntos
    .map((p) => `${p.name}: ${p.normalizedPct}%`)
    .join(', ')}.`;

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      className="h-auto w-full"
      role="img"
      aria-label={descripcion}
      preserveAspectRatio="xMidYMid meet"
      data-testid="grafico-evolucion"
    >
      <line
        x1={PAD.izquierda}
        y1={PAD.arriba + INTERNO_ALTO}
        x2={PAD.izquierda + INTERNO_ANCHO}
        y2={PAD.arriba + INTERNO_ALTO}
        stroke="var(--line)"
        strokeWidth={1}
      />

      <polygon points={area} fill="var(--nock)" opacity={0.15} />

      <polyline
        points={linea}
        fill="none"
        stroke="var(--nock)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {coords.map((c) => (
        <g key={c.seq}>
          <circle cx={c.cx} cy={c.cy} r={3.5} fill="var(--nock)" />
          <text
            x={c.cx}
            y={c.cy - 8}
            textAnchor="middle"
            fill="var(--ink)"
            className="text-[9px] tabular-nums"
          >
            {c.normalizedPct}%
          </text>
          <text
            x={c.cx}
            y={ALTO - 7}
            textAnchor="middle"
            fill="var(--ink-muted)"
            className="text-[9px] tabular-nums"
          >
            {c.seq}
          </text>
        </g>
      ))}
    </svg>
  );
}
