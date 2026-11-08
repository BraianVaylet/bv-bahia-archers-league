/**
 * Paso 4 del wizard de creación de torneo: la revisión. Cada sección se puede editar: se vuelve al
 * paso, no se rehace el torneo.
 */

import {
  distribucionDeCategorias,
  distribucionDeModalidades,
  formatearFecha,
  SCORING,
} from '@bal/shared';
import { ChipCategoria, ChipModalidad } from '@bal/ui';
import type { ReactNode } from 'react';
import { clasesDeTarjeta, cn } from '../../components/ui.js';
import { type BorradorTorneo, maximoDelRecorrido } from '../wizard.js';

export function PasoRevision({
  borrador,
  onIrA,
}: {
  readonly borrador: BorradorTorneo;
  readonly onIrA: (paso: number) => void;
}) {
  const seccion = (titulo: string, paso: number, contenido: ReactNode) => (
    <section className={cn(clasesDeTarjeta(), 'flex flex-col gap-2')}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{titulo}</h3>
        {/* Editable: se vuelve al paso, no se rehace el torneo. */}
        <button
          type="button"
          onClick={() => onIrA(paso)}
          className="min-h-[44px] text-sm underline"
        >
          Editar
        </button>
      </div>
      {contenido}
    </section>
  );

  return (
    <div className="flex flex-col gap-3">
      {seccion(
        'Datos',
        1,
        <div className="text-sm text-[var(--ink-muted)]">
          <p>{borrador.name}</p>
          <p>{formatearFecha(borrador.date)}</p>
        </div>,
      )}

      {seccion(
        'Recorrido',
        2,
        <div className="text-sm text-[var(--ink-muted)]">
          <p>
            {borrador.blancos.length} blancos · máximo {maximoDelRecorrido(borrador.blancos)}
          </p>
          {/* De qué está hecho el recorrido, antes de la lista blanco por
              blanco: es lo que se mira para decidir si el torneo es el que se
              quiso armar. */}
          <ul className="pt-1 flex flex-wrap gap-1.5" data-testid="reparto-modalidades">
            {distribucionDeModalidades(borrador.blancos.map((b) => b.modality)).map((m) => (
              <li key={m.modality}>
                <ChipModalidad modality={m.modality} pct={m.pct} compacto />
              </li>
            ))}
          </ul>

          <ol className="pt-1 flex flex-wrap gap-1.5">
            {borrador.blancos.map((b) => (
              <li
                key={b.index}
                className="px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--surface-2)]"
              >
                {b.index}. {SCORING[b.modality].label} ×{b.arrows}
              </li>
            ))}
          </ol>
        </div>,
      )}

      {seccion(
        'Participantes',
        3,
        <div className="text-sm text-[var(--ink-muted)]">
          <p>{borrador.elegidos.length} arqueros</p>
          {/* Con el porcentaje, no sólo el conteo: «6 compuestos» dice poco
              sin saber si son 6 de 8 o 6 de 40. */}
          <ul className="pt-1 flex flex-wrap gap-1.5" data-testid="reparto-categorias">
            {distribucionDeCategorias(borrador.elegidos.map((a) => a.category)).map((c) => (
              <li key={c.category} className="flex items-center gap-1">
                <ChipCategoria category={c.category} compacto />
                <span>
                  {c.count} · {c.pct}%
                </span>
              </li>
            ))}
          </ul>
        </div>,
      )}

      <p className="text-sm text-[var(--ink-muted)]">
        Al confirmar se congela un snapshot de cada arquero, se asignan las estacas, se arman las
        patrullas y se generan las credenciales. El torneo queda sin iniciar y todavía editable.
      </p>
    </div>
  );
}
