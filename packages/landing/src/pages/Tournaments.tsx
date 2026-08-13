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
  rankByCategory,
  SCORING,
} from '@bal/shared';
import { Link, useParams } from 'react-router-dom';
import { Cargando, Fallo, Screen, StakeChip, TablaScrollable } from '../components/ui.js';
import { useRecurso } from '../lib/useRecurso.js';

interface TorneoResumen {
  readonly id: string;
  readonly name: string;
  readonly date: string;
  readonly status: string;
  readonly targetCount: number;
  readonly participantCount: number;
}

interface Resultado {
  readonly firstName: string;
  readonly lastName: string;
  readonly category: BowCategory;
  readonly total: number;
  readonly normalizedPct: number;
  readonly innerCount: number;
  readonly tenCount: number;
  readonly mCount: number;
}

interface TorneoDetalle {
  readonly id: string;
  readonly name: string;
  readonly date: string;
  readonly description: string;
  readonly status: string;
  readonly targets: readonly { index: number; modality: keyof typeof SCORING; arrows: number }[];
  readonly maxPossibleScore: number;
  readonly patrols: readonly {
    number: number;
    startTargetIndex: number;
    status: string;
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
                  {t.status === 'en_proceso' && ' · en curso ahora'}
                </p>
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
                <th className="py-1 pr-2 font-medium text-right">%</th>
                <th className="py-1 font-medium text-right">Inner</th>
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
                  <td className="py-2 pr-2 text-right tabular-nums">{e.entry.normalizedPct}%</td>
                  <td className="py-2 text-right tabular-nums">{e.entry.innerCount}</td>
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
        <p className="text-[var(--ink-muted)]">
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
                    <StakeChip stake={m.stake} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Recorrido</h2>
        <ol className="flex flex-wrap gap-1.5 text-sm">
          {t.targets.map((b) => (
            <li
              key={b.index}
              className="px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--surface-2)]"
            >
              {b.index}. {SCORING[b.modality].label} ×{b.arrows}
            </li>
          ))}
        </ol>
      </section>
    </Screen>
  );
}
