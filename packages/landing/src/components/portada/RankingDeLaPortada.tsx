/**
 * El ranking en la portada (`REF7-6`, `DISENO.md` §5.1-4): pestañas por categoría y el top 5 de la
 * vista «General». Las pestañas de sexo (`FE-28`) quedan para la página `/ranking` completa.
 *
 * **Sin oro, plata ni bronce**: el amarillo y el naranja son colores de estaca, semántica
 * reservada (regla 8). Las posiciones 1 a 3 van en un círculo sobre `--nock-soft`.
 */

import { type BowCategory, CATEGORY_INFO } from '@bal/shared';
import { COLOR_DE_CATEGORIA, cn, ICONO_DE_CATEGORIA, RotuloDeSeccion } from '@bal/ui';
import { type CSSProperties, useState } from 'react';
import { formatearPuntos } from '../../lib/portada.js';
import type { Recurso } from '../../lib/useRecurso.js';
import { Cargando, EnlaceInterno, Fallo } from '../ui.js';
import { CONTENEDOR, TituloDeSeccion } from './Secciones.js';

interface Entrada {
  readonly archerId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly tournamentsPlayed: number;
  readonly bestNAvgPct: number;
  readonly position?: number;
}

export interface RankingDeTemporada {
  readonly categories: readonly {
    readonly category: BowCategory;
    readonly general: { readonly ranked: readonly Entrada[] };
  }[];
}

const TOP = 5;

function TablaDelTop({ entradas }: { readonly entradas: readonly Entrada[] }) {
  return (
    <table className="w-full border-collapse text-[15px]">
      <thead>
        <tr className="border-b font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
          <th scope="col" className="w-14 pb-2 px-3 text-left font-semibold">
            #
          </th>
          <th scope="col" className="pb-2 px-3 text-left font-semibold">
            Arquero
          </th>
          <th scope="col" className="pb-2 px-3 text-left font-semibold">
            Fechas
          </th>
          <th scope="col" className="pb-2 px-3 text-right font-semibold">
            Puntos
          </th>
        </tr>
      </thead>
      <tbody>
        {entradas.map((e) => {
          const podio = e.position !== undefined && e.position <= 3;
          return (
            <tr key={e.archerId} className="h-14 border-b">
              <td className="px-3 font-display text-lg font-bold">
                <span
                  className={cn(
                    'inline-flex size-8 items-center justify-center rounded-full',
                    podio ? 'bg-[var(--nock-soft)]' : null,
                  )}
                >
                  {e.position}
                </span>
              </td>
              <td className="px-3">
                <EnlaceInterno
                  href={`/arqueros/${e.archerId}`}
                  className="inline-flex items-center min-h-[44px] font-semibold hover:underline"
                >
                  {e.lastName}, {e.firstName}
                </EnlaceInterno>
              </td>
              <td className="px-3 font-mono text-mono">{e.tournamentsPlayed}</td>
              <td className="px-3 text-right font-mono font-semibold">
                {formatearPuntos(e.bestNAvgPct)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function RankingDeLaPortada({
  ranking,
  sinTemporada,
}: {
  readonly ranking: Recurso<RankingDeTemporada>;
  /** Las temporadas cargaron y ninguna está activa: no hay ranking que pedir. */
  readonly sinTemporada: boolean;
}) {
  const categorias =
    ranking.estado === 'listo'
      ? ranking.datos.categories.filter((c) => c.general.ranked.length > 0)
      : [];
  const [elegida, setElegida] = useState<BowCategory | null>(null);
  const actual = categorias.find((c) => c.category === elegida) ?? categorias[0];
  const vacio = sinTemporada || (ranking.estado === 'listo' && categorias.length === 0);

  return (
    <section
      data-testid="seccion-ranking"
      aria-labelledby="ranking"
      className={`${CONTENEDOR} pt-12 pb-12`}
    >
      <RotuloDeSeccion
        titulo="Ranking de la liga"
        accion={{ texto: 'Ranking completo', href: '/ranking' }}
        enlace={EnlaceInterno}
        nivel={false}
      />
      <TituloDeSeccion id="ranking">Quién va adelante</TituloDeSeccion>

      {vacio ? (
        <p className="text-[var(--ink-muted)]">
          Todavía no hay resultados publicados esta temporada.
        </p>
      ) : null}
      {!vacio && ranking.estado === 'cargando' ? <Cargando /> : null}
      {ranking.estado === 'error' ? <Fallo mensaje={ranking.mensaje} /> : null}

      {actual ? (
        <div className="grid gap-4 min-[760px]:grid-cols-[320px_1fr] min-[760px]:gap-8 items-start">
          {/* Cambian la tabla de al lado, no navegan: botones con `aria-pressed`. */}
          <fieldset className="min-w-0 m-0 p-0 border-0 flex gap-1 overflow-x-auto min-[760px]:flex-col">
            <legend className="sr-only">Categorías</legend>
            {categorias.map((c) => {
              const Icono = ICONO_DE_CATEGORIA[c.category];
              const color = COLOR_DE_CATEGORIA[c.category];
              const activa = c.category === actual.category;
              return (
                <button
                  key={c.category}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => setElegida(c.category)}
                  className={cn(
                    'min-h-12 shrink-0 px-3 flex items-center justify-between gap-3 rounded-[var(--radius-md)] text-[var(--ink)] whitespace-nowrap',
                    activa ? 'bg-[var(--nock-soft)] font-semibold' : 'hover:bg-[var(--surface-2)]',
                  )}
                >
                  <span
                    data-chip="categoria"
                    style={
                      { '--chip': color.claro, '--chip-oscuro': color.oscuro } as CSSProperties
                    }
                    className="inline-flex items-center gap-2"
                  >
                    <Icono size={18} className="shrink-0 text-[color:var(--chip-actual)]" />
                    <span className="text-[var(--ink)]">{CATEGORY_INFO[c.category].label}</span>
                  </span>
                  <span className="hidden min-[760px]:inline font-mono text-mono text-[var(--ink-muted)]">
                    {c.general.ranked.length}
                  </span>
                </button>
              );
            })}
          </fieldset>

          <TablaDelTop entradas={actual.general.ranked.slice(0, TOP)} />
        </div>
      ) : null}
    </section>
  );
}
