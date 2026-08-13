/**
 * Listado y detalle de torneos.
 *
 * **Un torneo en proceso muestra las patrullas y el avance, nunca los
 * puntajes.** Es una regla del backend, no de la interfaz —el endpoint público
 * directamente no los manda— pero la pantalla lo dice, para que nadie crea que
 * la página está rota.
 *
 * Ver `docs/FUNCTIONAL.md` §5.3.
 */

import {
  type BowCategory,
  CATEGORY_INFO,
  formatearFecha,
  formatearFechaCorta,
  formatearMonto,
  leaguePointsForPosition,
  type ParteDeModalidad,
  rankByCategory,
  SCORING,
  type TournamentStatus,
} from '@bal/shared';
import { BadgeEstado, ChipModalidad } from '@bal/ui';
import { Link, useParams } from 'react-router-dom';
import { Cargando, Fallo, Screen, StakeChip, TablaScrollable } from '../components/ui.js';
import { useRecurso } from '../lib/useRecurso.js';

interface TorneoResumen {
  readonly id: string;
  readonly name: string;
  readonly date: string;
  readonly status: TournamentStatus;
  readonly targetCount: number;
  readonly participantCount: number;
  readonly modalities?: readonly ParteDeModalidad[];
}

interface Resultado {
  readonly firstName: string;
  readonly lastName: string;
  readonly category: BowCategory;
  readonly total: number;
  readonly normalizedPct: number;
  readonly innerCount: number;
  readonly xCount: number;
  readonly tenCount: number;
  readonly mCount: number;
}

interface TorneoDetalle {
  readonly id: string;
  readonly name: string;
  readonly date: string;
  readonly description: string;
  readonly status: TournamentStatus;
  readonly payment: { readonly required: boolean; readonly amount: number };
  readonly targets: readonly { index: number; modality: keyof typeof SCORING; arrows: number }[];
  readonly maxPossibleScore: number;
  readonly patrols: readonly {
    number: number;
    startTargetIndex: number;
    status: TournamentStatus;
    targetsCompleted: number;
    members: readonly {
      firstName: string;
      lastName: string;
      category: BowCategory;
      stake: string;
    }[];
  }[];
  readonly results?: readonly Resultado[];
}

// ── Listado ──────────────────────────────────────────────────────────────────

export function TournamentsPage() {
  const torneos = useRecurso<{ tournaments: TorneoResumen[] }>('/tournaments');

  return (
    <Screen>
      <div className="pt-6">
        <h1 className="font-[var(--font-display)] text-[var(--text-display)] font-bold">Torneos</h1>
      </div>

      {torneos.estado === 'cargando' && <Cargando />}
      {torneos.estado === 'error' && <Fallo mensaje={torneos.mensaje} />}

      {torneos.estado === 'listo' && torneos.datos.tournaments.length === 0 && (
        <p className="text-[var(--ink-muted)]">Todavía no hay torneos publicados.</p>
      )}

      <ul className="flex flex-col gap-2">
        {torneos.estado === 'listo' &&
          torneos.datos.tournaments.map((t) => (
            <li key={t.id}>
              <Link
                to={`/torneos/${t.id}`}
                className="block rounded-[var(--radius-lg)] border p-4 bg-[var(--surface)]"
                data-testid={`torneo-${t.id}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-sm text-[var(--ink-muted)] tabular-nums">
                    {formatearFechaCorta(t.date)}
                  </span>
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  {t.targetCount} blancos · {t.participantCount} arqueros
                </p>

                {/* De qué está hecho el recorrido, y en qué estado está. Los
                    dos con su palabra al lado del color. */}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <EstadoChip status={t.status} />
                  {t.modalities?.map((m) => (
                    <ChipModalidad key={m.modality} modality={m.modality} pct={m.pct} compacto />
                  ))}
                </div>
              </Link>
            </li>
          ))}
      </ul>
    </Screen>
  );
}

// ── Detalle ──────────────────────────────────────────────────────────────────

function Podios({ resultados }: { readonly resultados: readonly Resultado[] }) {
  // El mismo `rankByCategory` que usa el servidor al publicar: la landing no
  // reordena por su cuenta ni inventa un criterio de desempate.
  const conId = resultados.map((r, i) => ({
    ...r,
    participantId: String(i),
    archerId: String(i),
    stake: 'azul' as const,
  }));
  const porCategoria = rankByCategory(conId);

  return (
    <>
      {Object.entries(porCategoria).map(([category, entradas]) => (
        <section key={category} className="flex flex-col gap-2" data-testid={`podio-${category}`}>
          <h2 className="font-semibold">{CATEGORY_INFO[category as BowCategory].label}</h2>

          <TablaScrollable>
            <thead>
              <tr className="border-b text-left text-[var(--ink-muted)]">
                <th className="py-1 pr-2 font-medium">#</th>
                <th className="py-1 pr-2 font-medium">Arquero</th>
                <th className="py-1 pr-2 font-medium text-right">Puntaje</th>
                <th className="py-1 pr-2 font-medium text-right">X</th>
                <th className="py-1 pr-2 font-medium text-right">10</th>
                <th className="py-1 pr-2 font-medium text-right">M</th>
                <th className="py-1 pr-2 font-medium text-right">%</th>
                <th className="py-1 font-medium text-right">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {(entradas ?? []).map((e) => (
                <tr key={e.entry.participantId} className="border-b">
                  <td className="py-2 pr-2 tabular-nums w-10">
                    {e.position}
                    {e.tied && <span className="text-[var(--ink-muted)]">=</span>}
                  </td>
                  <td className="py-2 pr-2">
                    {e.entry.lastName}, {e.entry.firstName}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums font-semibold">
                    {e.entry.total}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{e.entry.xCount}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{e.entry.tenCount}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{e.entry.mCount}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{e.entry.normalizedPct}%</td>
                  {/* Lo que este torneo le suma a la liga. El mismo cálculo que
                      corre el servidor al publicar, no una copia del criterio. */}
                  <td className="py-2 text-right tabular-nums font-semibold">
                    {leaguePointsForPosition(e.position)}
                  </td>
                </tr>
              ))}
            </tbody>
          </TablaScrollable>
        </section>
      ))}
    </>
  );
}

export function TournamentPage() {
  const { id = '' } = useParams();
  const torneo = useRecurso<{ tournament: TorneoDetalle }>(`/tournaments/${id}`);

  if (torneo.estado === 'cargando') {
    return (
      <Screen>
        <Cargando />
      </Screen>
    );
  }

  if (torneo.estado === 'error') {
    return (
      <Screen>
        <Fallo mensaje={torneo.mensaje} />
        <Link to="/torneos" className="underline">
          Volver a los torneos
        </Link>
      </Screen>
    );
  }

  const t = torneo.datos.tournament;
  const enProceso = t.status !== 'publicado';

  return (
    <Screen>
      <div className="pt-6">
        <h1 className="font-[var(--font-display)] text-[var(--text-display)] font-bold">
          {t.name}
        </h1>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <EstadoChip status={t.status} />

          {/* Con `?.`: una respuesta vieja en caché sin el campo no puede dejar
              la ficha en blanco. Es una página pública. */}
          {t.payment?.required && (
            <span
              className="text-sm px-2.5 h-7 rounded-full bg-[var(--surface-2)] flex items-center"
              data-testid="inscripcion"
            >
              Inscripción {formatearMonto(t.payment.amount)}
            </span>
          )}
        </div>

        <p className="pt-2 text-[var(--ink-muted)]">
          {formatearFecha(t.date)} · {t.targets.length} blancos · máximo {t.maxPossibleScore}
        </p>
        {t.description && <p className="pt-2">{t.description}</p>}
      </div>

      {enProceso && (
        <p
          className="rounded-[var(--radius-md)] border p-3 text-sm text-[var(--warn)]"
          data-testid="aviso-en-curso"
        >
          El torneo se está corriendo ahora. Los puntajes se publican cuando termina y el admin los
          revisa.
        </p>
      )}

      {t.results && <Podios resultados={t.results} />}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Patrullas</h2>

        <ul className="flex flex-col gap-2">
          {t.patrols.map((p) => (
            <li
              key={p.number}
              className="rounded-[var(--radius-lg)] border p-3 bg-[var(--surface)]"
              data-testid={`patrulla-${p.number}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">Patrulla {p.number}</span>
                <span className="text-sm text-[var(--ink-muted)] tabular-nums">
                  {p.targetsCompleted} de {t.targets.length} blancos
                </span>
              </div>

              <ul className="pt-1 flex flex-col gap-1 text-sm">
                {p.members.map((m) => (
                  <li key={`${m.lastName}-${m.firstName}`} className="flex items-center gap-2">
                    <span className="min-w-0 truncate">
                      {m.lastName}, {m.firstName}
                    </span>
                    <span className="text-[var(--ink-muted)]">
                      {CATEGORY_INFO[m.category].label}
                    </span>
                    <StakeChip stake={m.stake} compacto />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <DiagramaDelRecorrido targets={t.targets} />
    </Screen>
  );
}

// ── Piezas de la ficha del torneo ────────────────────────────────────────────

/**
 * El estado del torneo, resaltado.
 *
 * **El color no va solo**: la etiqueta dice el estado con palabras. Un chip
 * verde y uno amarillo son el mismo chip para quien no distingue los dos.
 * Ver `docs/DESIGN_SYSTEM.md` §10.
 *
 * El texto y el color salen ahora de `ESTADO_DE_TORNEO`, en `@bal/shared`.
 * Estaban acá, con dos de los cuatro estados nada más, y otra vez en WAFA con
 * palabras distintas. `BadgeEstado` devuelve `null` para los estados que no se
 * muestran en público, que es lo que hacía este `if (!info)`.
 */
function EstadoChip({ status }: { readonly status: TournamentStatus }) {
  return <BadgeEstado status={status} publico />;
}

/**
 * El recorrido, como cajas encadenadas.
 *
 * Cada caja es un blanco con su número, su modalidad y sus flechas; la línea
 * entre cajas es el camino. La lista suelta que había antes no dejaba ver que
 * el recorrido **es una secuencia**, que es justo lo que hay que caminar.
 *
 * Las cajas van en grilla y no en una fila: catorce blancos en línea obligarían
 * a scrollear de costado, y la página nunca scrollea de costado.
 */
function DiagramaDelRecorrido({
  targets,
}: {
  readonly targets: readonly { index: number; modality: keyof typeof SCORING; arrows: number }[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">Recorrido</h2>

      <ol className="flex flex-wrap items-stretch gap-y-3" data-testid="diagrama-recorrido">
        {targets.map((b, i) => (
          <li key={b.index} className="flex items-stretch">
            <div className="w-24 rounded-[var(--radius-md)] border bg-[var(--surface)] p-2 text-center">
              <p className="font-[var(--font-display)] text-xl font-bold tabular-nums leading-none">
                {b.index}
              </p>
              <p className="pt-1 text-xs text-[var(--ink-muted)] leading-tight">
                {SCORING[b.modality].label}
              </p>
              <p className="text-xs text-[var(--ink-muted)] tabular-nums">
                {b.arrows} {b.arrows === 1 ? 'flecha' : 'flechas'}
              </p>
            </div>

            {/* El camino entre blancos. Decorativo: la secuencia ya la da el
                orden de la lista, que es lo que lee un lector de pantalla. */}
            {i < targets.length - 1 && (
              <span
                aria-hidden="true"
                className="w-4 self-center border-t-2 border-dashed border-[var(--ink-muted)] opacity-50"
              />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
