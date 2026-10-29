/**
 * Ranking de la liga, por categoría.
 *
 * Un solo modo desde el 2026-10-24: «mejor de N», el promedio de los N mejores
 * porcentajes de la temporada. `N` (`bestN`) lo manda el servidor
 * (`LEAGUE_BEST_N`) — nunca se escribe un «2» a fuego en esta pantalla. El
 * porcentaje es lo comparable entre torneos: cada recorrido multitarget tiene
 * un máximo distinto. El ranking «por posición» (puntos 5-4-3-2-1) se retiró
 * ese mismo día.
 *
 * Ver `docs/FUNCTIONAL.md` §5.2 · `docs/DOMAIN_WA.md` §9.
 */

import { type BowCategory, CATEGORY_INFO, medallaDe } from '@bal/shared';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Cabecera,
  Cargando,
  Celda,
  Cuerpo,
  clasesDeTarjeta,
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
  readonly tournamentsPlayed: number;
  readonly bestNormalizedPct: number;
  /** Promedio de los `bestN` mejores porcentajes. Lo deriva el servidor. */
  readonly bestNAvgPct: number;
  readonly position?: number;
  readonly tied?: boolean;
}

interface VistaDeRanking {
  readonly ranked: readonly Entrada[];
  readonly notYetEligible: readonly Entrada[];
}

interface CategoriaRankeada {
  readonly category: BowCategory;
  readonly general: VistaDeRanking;
  readonly femenino: VistaDeRanking;
  readonly masculino: VistaDeRanking;
}

const VISTAS = [
  { key: 'general', label: 'General' },
  { key: 'femenino', label: 'Femenino' },
  { key: 'masculino', label: 'Masculino' },
] as const;

type Vista = (typeof VISTAS)[number]['key'];

/**
 * Una sola tira de pestañas **arriba de todas las categorías**, no una por
 * tarjeta: elegís la vista una vez y se aplica a las ocho. Cada vista está
 * rankeada por separado desde el servidor (`BE-21`) — no es el general
 * filtrado, así que el puesto 1 de Femenino es realmente el puesto 1 de esa
 * pool, no "el primero del general que da la casualidad que es mujer".
 */
function Pestañas({
  vista,
  onElegir,
}: {
  readonly vista: Vista;
  readonly onElegir: (v: Vista) => void;
}) {
  return (
    <div role="tablist" aria-label="Ver ranking" className="flex gap-2">
      {VISTAS.map((v) => (
        <button
          key={v.key}
          type="button"
          role="tab"
          aria-selected={vista === v.key}
          onClick={() => onElegir(v.key)}
          className={cn(
            'flex-1 min-h-[44px] rounded-[var(--radius-md)] border',
            vista === v.key
              ? 'bg-[var(--nock)] text-[var(--nock-ink)] font-semibold'
              : 'bg-[var(--surface)]',
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
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

function FilaDeArquero({ entrada }: { readonly entrada: Entrada }) {
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
        <Link
          to={`/arqueros/${entrada.archerId}`}
          className="underline min-h-[44px] inline-flex items-center"
        >
          {entrada.lastName}, {entrada.firstName}
        </Link>
      </Celda>
      <Celda etiqueta="Mejor de N" enLinea className="text-right tabular-nums font-semibold">
        {entrada.bestNAvgPct}%
      </Celda>
      {/*
        El mejor suelto es el récord personal de la temporada, aunque ya no
        ordene el ranking.
      */}
      <Celda etiqueta="Mejor" enLinea className="text-right tabular-nums text-[var(--ink-muted)]">
        {entrada.bestNormalizedPct}%
      </Celda>
    </Fila>
  );
}

export function RankingPage() {
  const [params, setParams] = useSearchParams();
  const [vista, setVista] = useState<Vista>('general');

  const temporadas = useRecurso<{ seasons: Temporada[] }>('/seasons');
  const elegida =
    params.get('temporada') ??
    (temporadas.estado === 'listo' ? (temporadas.datos.seasons[0]?.id ?? null) : null);

  const ranking = useRecurso<{ bestN: number; categories: CategoriaRankeada[] }>(
    elegida ? `/rankings?seasonId=${elegida}` : null,
  );
  const bestN = ranking.estado === 'listo' ? ranking.datos.bestN : 2;

  return (
    <Screen>
      <div className="pt-6">
        <h1 className="font-[var(--font-display)] text-[var(--text-display)] font-bold">Ranking</h1>
      </div>

      {temporadas.estado === 'listo' && temporadas.datos.seasons.length > 0 && (
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
      )}

      {temporadas.estado === 'listo' && temporadas.datos.seasons.length === 0 && (
        <p className="text-[var(--ink-muted)]">Todavía no hay temporadas cargadas.</p>
      )}

      {ranking.estado === 'cargando' && elegida && <Cargando />}
      {ranking.estado === 'error' && <Fallo mensaje={ranking.mensaje} />}

      {ranking.estado === 'listo' && ranking.datos.categories.length > 0 && (
        <Pestañas vista={vista} onElegir={setVista} />
      )}

      {/*
        La explicación va **abierta**, no plegada: la primera vez que alguien
        ve este ranking necesita saber qué significan los números, no
        descubrir que hay una explicación escondida. Ver `docs/DOMAIN_WA.md` §9.1.
      */}
      {ranking.estado === 'listo' && ranking.datos.categories.length > 0 && (
        <section
          className={cn(
            clasesDeTarjeta({ nivel: 'transparente' }),
            'text-sm flex flex-col gap-2 text-[var(--ink-muted)]',
          )}
          data-testid="como-se-calcula-mejor-de-n"
        >
          <p>
            Es el <strong>promedio de los {bestN} mejores porcentajes</strong> que sacaste en la
            temporada. El porcentaje de un torneo es tu puntaje sobre el máximo posible de ese
            torneo, así que se pueden comparar fechas con recorridos distintos.
          </p>

          <p>
            Hacen falta al menos {bestN} {bestN === 1 ? 'torneo' : 'torneos'} para entrar: con menos
            no hay {bestN === 1 ? '' : 'suficientes porcentajes que '}promediar.
          </p>
        </section>
      )}

      {ranking.estado === 'listo' &&
        ranking.datos.categories.map((c) => (
          <section
            key={c.category}
            /*
              Cada categoría, dentro de su tarjeta.

              Sueltas y una debajo de la otra, ocho categorías se leen como una
              sola lista larga y el título de cada una se pierde entre las
              tablas. Con borde, se ve dónde empieza y dónde termina cada una —
              y sobre todo las vacías, que sin tarjeta parecen un renglón
              huérfano de la categoría de arriba.
            */
            className={cn(clasesDeTarjeta(), 'flex flex-col gap-2')}
            data-testid={`cat-${c.category}`}
          >
            <h2 className="font-semibold">{CATEGORY_INFO[c.category].label}</h2>

            {c[vista].ranked.length === 0 ? (
              <p className="text-sm text-[var(--ink-muted)]">
                Nadie llegó todavía al mínimo de torneos en esta categoría.
              </p>
            ) : (
              <Tabla>
                <Cabecera>
                  <th className="py-1 pr-2 font-medium">#</th>
                  <th className="py-1 pr-2 font-medium">Arquero</th>
                  <th className="py-1 pr-2 font-medium text-right">Mejor de N</th>
                  <th className="py-1 font-medium text-right">Mejor</th>
                </Cabecera>
                <Cuerpo>
                  {c[vista].ranked.map((e) => (
                    <FilaDeArquero key={e.archerId} entrada={e} />
                  ))}
                </Cuerpo>
              </Tabla>
            )}

            {/* No se ocultan: esconderlos haría creer que se perdió su resultado. */}
            {c[vista].notYetEligible.length > 0 && (
              <details className="text-sm">
                <summary className="min-h-[44px] flex items-center cursor-pointer text-[var(--ink-muted)]">
                  {c[vista].notYetEligible.length} con menos de {bestN} torneos
                </summary>
                <p className="pb-2 text-[var(--ink-muted)]">
                  Para figurar en el ranking hacen falta al menos {bestN} torneos disputados. Sus
                  resultados están cargados y cuentan apenas lleguen.
                </p>
                <ul className="flex flex-col gap-1">
                  {c[vista].notYetEligible.map((e) => (
                    <li key={e.archerId} data-testid={`pendiente-${e.lastName}`}>
                      <Link
                        to={`/arqueros/${e.archerId}`}
                        className="underline min-h-[44px] inline-flex items-center"
                      >
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
