/**
 * Ranking de la liga, por categoría.
 *
 * Dos modos: por **puntos** acumulados en los podios, y **mejor de 2** — el
 * promedio de los dos mejores porcentajes de la temporada. El porcentaje es lo
 * comparable entre torneos: cada recorrido multitarget tiene un máximo distinto.
 * Y el promedio de dos premia la regularidad, no un día bueno.
 *
 * Ver `docs/FUNCTIONAL.md` §5.2 · `docs/DOMAIN_WA.md` §9.
 */

import {
  type BowCategory,
  CATEGORY_INFO,
  ETIQUETA_DE_MODO,
  LEAGUE_POINTS_BY_POSITION,
  MIN_TOURNAMENTS_FOR_RANKING,
  medallaDe,
} from '@bal/shared';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Cabecera,
  Cargando,
  Celda,
  Cuerpo,
  cn,
  Fallo,
  Fila,
  Screen,
  Tabla,
} from '../components/ui.js';
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
  /** Promedio de los dos mejores porcentajes. Lo deriva el servidor. */
  readonly bestTwoAvgPct: number;
  readonly position?: number;
  readonly tied?: boolean;
}

interface CategoriaRankeada {
  readonly category: BowCategory;
  readonly ranked: readonly Entrada[];
  readonly notYetEligible: readonly Entrada[];
}

/**
 * La medalla del podio.
 *
 * El emoji lleva su nombre como `aria-label`: un símbolo suelto no dice nada en
 * un lector de pantalla, y el número del puesto va al lado igual.
 * Ver `docs/DESIGN_SYSTEM.md` §10.
 */
function Medalla({ puesto }: { readonly puesto?: number | undefined }) {
  const medalla = medallaDe(puesto);
  if (!medalla) return null;

  return (
    <span role="img" aria-label={medalla.nombre}>
      {medalla.emoji}
    </span>
  );
}

type Modo = 'position' | 'best_two';

function FilaDeArquero({ entrada, modo }: { readonly entrada: Entrada; readonly modo: Modo }) {
  return (
    <Fila data-testid={`fila-${entrada.lastName}`}>
      {/*
        Puesto y nombre encabezan la tarjeta y van sin etiqueta: son lo que
        identifica la fila, no un dato más.
      */}
      <Celda className="tabular-nums w-16 max-sm:w-auto max-sm:justify-start">
        <span className="inline-flex items-center gap-1">
          {/* El número SIEMPRE va: la medalla lo acompaña, no lo reemplaza. */}
          {entrada.position}
          {entrada.tied && <span className="text-[var(--ink-muted)]">=</span>}
          <Medalla puesto={entrada.position} />
        </span>
      </Celda>
      <Celda className="max-sm:justify-start max-sm:pb-1">
        <Link to={`/arqueros/${entrada.archerId}`} className="underline">
          {entrada.lastName}, {entrada.firstName}
        </Link>
      </Celda>
      <Celda
        etiqueta="Puntos"
        enLinea
        className={cn('text-right tabular-nums', modo === 'position' && 'font-semibold')}
      >
        {entrada.leaguePoints}
      </Celda>
      <Celda
        etiqueta="Mejor de 2"
        enLinea
        className={cn('text-right tabular-nums', modo === 'best_two' && 'font-semibold')}
      >
        {entrada.bestTwoAvgPct}%
      </Celda>
      {/*
        El mejor suelto sale de la celda de «Mejor de 2» y pasa a ser su propia
        columna. Iba entre paréntesis dentro de la misma celda —«81.2% (mejor
        84.5%)»— y era la celda más ancha de la tabla: dos números que compiten
        por el mismo renglón. Sigue estando porque es el récord personal de la
        temporada, aunque ya no ordene el ranking.
      */}
      <Celda etiqueta="Mejor" enLinea className="text-right tabular-nums text-[var(--ink-muted)]">
        {entrada.bestNormalizedPct}%
      </Celda>
    </Fila>
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
            {(['position', 'best_two'] as const).map((m) => (
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
                {ETIQUETA_DE_MODO[m]}
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

      {/*
        **La explicación sigue al modo elegido.**

        Antes estaba detrás de un `<details>` que no dependía del modo: con
        «Mejor de 2» elegido, lo único que se ofrecía explicar era el reparto de
        puntos del podio, que en ese modo no ordena nada. La columna que se está
        mirando quedaba sin explicar, y la que se explicaba no estaba en pantalla.

        Y va **abierta**, no plegada: la primera vez que alguien ve este ranking
        necesita saber qué significan los números, no descubrir que hay una
        explicación escondida. Ver `docs/DOMAIN_WA.md` §9.1.
      */}
      {ranking.estado === 'listo' && ranking.datos.categories.length > 0 && (
        <section
          className="text-sm rounded-[var(--radius-lg)] border p-3 flex flex-col gap-2 text-[var(--ink-muted)]"
          data-testid={modo === 'position' ? 'puntos-por-puesto' : 'como-se-calcula-mejor-de-2'}
        >
          {modo === 'position' ? (
            <>
              <p>
                En cada torneo, y <strong>por categoría</strong>, el podio reparte:
              </p>
              <ul className="flex flex-wrap gap-2">
                {LEAGUE_POINTS_BY_POSITION.map((puntos, i) => (
                  <li
                    key={puntos}
                    className="h-8 px-3 rounded-full bg-[var(--surface-2)] flex items-center gap-1.5"
                  >
                    <Medalla puesto={i + 1} />
                    <span>
                      {i + 1}º: {puntos} {puntos === 1 ? 'punto' : 'puntos'}
                    </span>
                  </li>
                ))}
              </ul>
              <p>
                Del sexto en adelante, cero. Si dos empatan, <strong>los dos</strong> se llevan los
                puntos de ese puesto.
              </p>
            </>
          ) : (
            <>
              <p>
                Es el <strong>promedio de los dos mejores porcentajes</strong> que sacaste en la
                temporada. El porcentaje de un torneo es tu puntaje sobre el máximo posible de ese
                torneo, así que se pueden comparar fechas con recorridos distintos.
              </p>

              {/* Un ejemplo concreto: el promedio de dos porcentajes se
                  entiende en un renglón y se explica mal en un párrafo. */}
              <p className="rounded-[var(--radius-md)] bg-[var(--surface-2)] p-2.5">
                Tiraste tres fechas y sacaste <strong>78%</strong>, <strong>85%</strong> y{' '}
                <strong>81%</strong>. Se toman las dos mejores —85 y 81— y el ranking te muestra{' '}
                <strong>83%</strong>. La de 78 no resta.
              </p>

              <p>
                Hacen falta al menos {MIN_TOURNAMENTS_FOR_RANKING} torneos para entrar: con uno solo
                no hay dos que promediar.
              </p>
            </>
          )}
        </section>
      )}

      {ranking.estado === 'listo' &&
        ranking.datos.categories.map((c) => (
          <section
            key={c.category}
            /*
              Cada categoría, dentro de su tarjeta.
              
              Sueltas y una debajo de la otra, siete categorías se leen como una
              sola lista larga y el título de cada una se pierde entre las
              tablas. Con borde, se ve dónde empieza y dónde termina cada una —
              y sobre todo las vacías, que sin tarjeta parecen un renglón
              huérfano de la categoría de arriba.
            */
            className="flex flex-col gap-2 rounded-[var(--radius-lg)] border p-3 bg-[var(--surface)]"
            data-testid={`cat-${c.category}`}
          >
            <h2 className="font-semibold">{CATEGORY_INFO[c.category].label}</h2>

            {c.ranked.length === 0 ? (
              <p className="text-sm text-[var(--ink-muted)]">
                Nadie llegó todavía al mínimo de torneos en esta categoría.
              </p>
            ) : (
              <Tabla>
                <Cabecera>
                  <th className="py-1 pr-2 font-medium">#</th>
                  <th className="py-1 pr-2 font-medium">Arquero</th>
                  <th className="py-1 pr-2 font-medium text-right">Puntos</th>
                  <th className="py-1 pr-2 font-medium text-right">Mejor de 2</th>
                  <th className="py-1 font-medium text-right">Mejor</th>
                </Cabecera>
                <Cuerpo>
                  {c.ranked.map((e) => (
                    <FilaDeArquero key={e.archerId} entrada={e} modo={modo} />
                  ))}
                </Cuerpo>
              </Tabla>
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
