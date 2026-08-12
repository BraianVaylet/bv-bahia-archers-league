/**
 * Ranking de la liga, por categoría.
 *
 * Dos modos: por **puntos** acumulados en los podios, y por **mejor
 * porcentaje** de la temporada. El porcentaje es lo comparable entre torneos:
 * cada recorrido multitarget tiene un máximo distinto.
 *
 * Ver `docs/FUNCTIONAL.md` §5.2 · `docs/DOMAIN_WA.md` §9.
 */

import { type BowCategory, CATEGORY_INFO, MIN_TOURNAMENTS_FOR_RANKING } from '@bal/shared';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Cargando, cn, Fallo, Screen, TablaScrollable } from '../components/ui.js';
import { useRecurso } from '../lib/useRecurso.js';

interface Temporada {
  readonly id: string;
  readonly name: string;
  readonly status: string;
}

interface Entrada {
  readonly archerId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly leaguePoints: number;
  readonly tournamentsPlayed: number;
  readonly bestNormalizedPct: number;
  readonly bestRawScore: number;
  readonly position?: number;
  readonly tied?: boolean;
}

interface CategoriaRankeada {
  readonly category: BowCategory;
  readonly ranked: readonly Entrada[];
  readonly notYetEligible: readonly Entrada[];
}

type Modo = 'position' | 'score';

function FilaDeArquero({ entrada, modo }: { readonly entrada: Entrada; readonly modo: Modo }) {
  return (
    <tr className="border-b" data-testid={`fila-${entrada.lastName}`}>
      <td className="py-2 pr-2 tabular-nums w-10">
        {entrada.position}
        {entrada.tied && <span className="text-[var(--ink-muted)]">=</span>}
      </td>
      <td className="py-2 pr-2">
        <Link to={`/arqueros/${entrada.archerId}`} className="underline">
          {entrada.lastName}, {entrada.firstName}
        </Link>
      </td>
      <td
        className={cn('py-2 pr-2 text-right tabular-nums', modo === 'position' && 'font-semibold')}
      >
        {entrada.leaguePoints}
      </td>
      <td className={cn('py-2 text-right tabular-nums', modo === 'score' && 'font-semibold')}>
        {entrada.bestNormalizedPct}%
        <span className="text-[var(--ink-muted)]"> ({entrada.bestRawScore})</span>
      </td>
    </tr>
  );
}

export function RankingPage() {
  const [params, setParams] = useSearchParams();
  const [modo, setModo] = useState<Modo>('position');

  const temporadas = useRecurso<{ seasons: Temporada[] }>('/seasons');
  const elegida =
    params.get('temporada') ??
    (temporadas.estado === 'listo' ? (temporadas.datos.seasons[0]?.id ?? null) : null);

  const ranking = useRecurso<{ categories: CategoriaRankeada[] }>(
    elegida ? `/rankings?seasonId=${elegida}&mode=${modo}` : null,
  );

  return (
    <Screen>
      <div className="pt-6">
        <h1 className="font-[var(--font-display)] text-[var(--text-display)] font-bold">Ranking</h1>
      </div>

      {temporadas.estado === 'listo' && temporadas.datos.seasons.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm">
            Temporada
            <select
              aria-label="Temporada"
              value={elegida ?? ''}
              onChange={(e) => setParams({ temporada: e.target.value })}
              className="min-h-[44px] px-3 rounded-[var(--radius-md)] border bg-[var(--surface)]"
            >
              {temporadas.datos.seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="flex items-center gap-2 text-sm">
            <legend className="sr-only">Modo del ranking</legend>
            {(['position', 'score'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={modo === m}
                onClick={() => setModo(m)}
                className={cn(
                  'min-h-[44px] px-3 rounded-[var(--radius-md)] border',
                  modo === m
                    ? 'bg-[var(--nock)] text-[var(--nock-ink)] font-semibold'
                    : 'bg-[var(--surface)]',
                )}
              >
                {m === 'position' ? 'Por puntos' : 'Por mejor puntaje'}
              </button>
            ))}
          </fieldset>
        </div>
      )}

      {temporadas.estado === 'listo' && temporadas.datos.seasons.length === 0 && (
        <p className="text-[var(--ink-muted)]">Todavía no hay temporadas cargadas.</p>
      )}

      {ranking.estado === 'cargando' && elegida && <Cargando />}
      {ranking.estado === 'error' && <Fallo mensaje={ranking.mensaje} />}

      {ranking.estado === 'listo' &&
        ranking.datos.categories.map((c) => (
          <section
            key={c.category}
            className="flex flex-col gap-2"
            data-testid={`cat-${c.category}`}
          >
            <h2 className="font-semibold">{CATEGORY_INFO[c.category].label}</h2>

            {c.ranked.length === 0 ? (
              <p className="text-sm text-[var(--ink-muted)]">
                Nadie llegó todavía al mínimo de torneos en esta categoría.
              </p>
            ) : (
              <TablaScrollable>
                <thead>
                  <tr className="border-b text-left text-[var(--ink-muted)]">
                    <th className="py-1 pr-2 font-medium">#</th>
                    <th className="py-1 pr-2 font-medium">Arquero</th>
                    <th className="py-1 pr-2 font-medium text-right">Puntos</th>
                    <th className="py-1 font-medium text-right">Mejor</th>
                  </tr>
                </thead>
                <tbody>
                  {c.ranked.map((e) => (
                    <FilaDeArquero key={e.archerId} entrada={e} modo={modo} />
                  ))}
                </tbody>
              </TablaScrollable>
            )}

            {/* No se ocultan: esconderlos haría creer que se perdió su resultado. */}
            {c.notYetEligible.length > 0 && (
              <details className="text-sm">
                <summary className="min-h-[44px] flex items-center cursor-pointer text-[var(--ink-muted)]">
                  {c.notYetEligible.length} con menos de {MIN_TOURNAMENTS_FOR_RANKING} torneos
                </summary>
                <p className="pb-2 text-[var(--ink-muted)]">
                  Para figurar en el ranking hacen falta al menos {MIN_TOURNAMENTS_FOR_RANKING}{' '}
                  torneos disputados. Sus resultados están cargados y cuentan apenas lleguen.
                </p>
                <ul className="flex flex-col gap-1">
                  {c.notYetEligible.map((e) => (
                    <li key={e.archerId} data-testid={`pendiente-${e.lastName}`}>
                      <Link to={`/arqueros/${e.archerId}`} className="underline">
                        {e.lastName}, {e.firstName}
                      </Link>{' '}
                      <span className="text-[var(--ink-muted)]">
                        — {e.tournamentsPlayed} {e.tournamentsPlayed === 1 ? 'torneo' : 'torneos'}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        ))}

      {ranking.estado === 'listo' && ranking.datos.categories.length === 0 && (
        <p className="text-[var(--ink-muted)]">
          Esta temporada todavía no tiene torneos publicados.
        </p>
      )}
    </Screen>
  );
}
