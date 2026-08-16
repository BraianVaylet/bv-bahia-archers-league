/**
 * Home de WAFA.
 *
 * Los torneos van agrupados por estado, con **el que está en proceso arriba**:
 * si hay un torneo corriendo, es lo único que le importa al admin en ese momento.
 *
 * Ver `docs/FUNCTIONAL.md` §6.2.
 */

import {
  ESTADO_DE_TORNEO,
  formatearFecha,
  type ParteDeModalidad,
  type TournamentStatus,
} from '@bal/shared';
import { ChipModalidad } from '@bal/ui';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Encabezado, Pantalla, Screen } from '../../components/ui.js';
import { api } from '../../lib/apiClient.js';

export interface TournamentRow {
  readonly id: string;
  readonly name: string;
  readonly date: string;
  readonly status: TournamentStatus;
  readonly targetCount: number;
  readonly patrolCount: number;
  readonly participantCount: number;
  readonly maxPossibleScore: number;
  /** Qué proporción del recorrido es de cada modalidad. La calcula el servidor. */
  readonly modalities?: readonly ParteDeModalidad[];
}

/**
 * Orden de los grupos: primero lo que está pasando ahora.
 *
 * El texto de cada uno sale de `ESTADO_DE_TORNEO`, no de una copia local: estos
 * títulos estaban escritos acá y otra vez en la ficha del torneo, con palabras
 * distintas para el mismo estado.
 */
const ORDEN: readonly TournamentStatus[] = ['en_proceso', 'sin_iniciar', 'completado', 'publicado'];

function TarjetaTorneo({ torneo }: { readonly torneo: TournamentRow }) {
  return (
    <Link
      to={`/wafa/torneos/${torneo.id}`}
      className="block min-h-[44px] rounded-[var(--radius-lg)] border p-3 bg-[var(--surface)]"
      data-testid={`torneo-${torneo.id}`}
    >
      {/* Tres renglones, uno por pregunta: cuál es, cuándo es, qué tan grande.
          Apretados en dos, el nombre y la fecha competían por el ancho y en un
          celular el nombre largo se cortaba. */}
      <p className="font-semibold">{torneo.name}</p>

      <p className="text-sm text-[var(--ink-muted)] tabular-nums">{formatearFecha(torneo.date)}</p>

      <p className="text-sm text-[var(--ink-muted)]">
        {torneo.targetCount} blancos · {torneo.participantCount} arqueros · {torneo.patrolCount}{' '}
        patrullas
      </p>

      {/* Renglón nuevo: de qué está hecho el recorrido. Con el ícono y el
          nombre al lado del porcentaje, no sólo el color. */}
      {torneo.modalities && torneo.modalities.length > 0 && (
        <p className="mt-1.5 flex flex-wrap gap-1.5" data-testid="modalidades">
          {torneo.modalities.map((m) => (
            <ChipModalidad key={m.modality} modality={m.modality} pct={m.pct} compacto />
          ))}
        </p>
      )}
    </Link>
  );
}

export function HomePage({ onSalir }: { readonly onSalir: () => void }) {
  const [torneos, setTorneos] = useState<TournamentRow[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    api
      .get<{ tournaments: TournamentRow[] }>('/admin/tournaments')
      .then((r) => setTorneos(r.tournaments))
      .catch(() => setError('No se pudieron cargar los torneos. Revisá la conexión.'));
  }, []);

  return (
    <Pantalla>
      <Encabezado titulo="WAFA">
        <button type="button" onClick={onSalir} className="min-h-[44px] px-2 text-sm">
          Salir
        </button>
      </Encabezado>

      <Screen>
        <nav className="pt-4 flex flex-col gap-2">
          <Link to="/wafa/torneos/nuevo">
            <Button ancho>Crear torneo</Button>
          </Link>
          <div className="flex gap-2">
            <Link to="/wafa/arqueros" className="flex-1">
              <Button variante="secundario" ancho>
                Arqueros
              </Button>
            </Link>
            <Link to="/wafa/temporadas" className="flex-1">
              <Button variante="secundario" ancho>
                Temporadas
              </Button>
            </Link>
          </div>

          <Link to="/wafa/ranking">
            <Button variante="secundario" ancho>
              Ranking de la liga
            </Button>
          </Link>
        </nav>

        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        {torneos === undefined && !error && <p className="text-[var(--ink-muted)]">Cargando…</p>}

        {torneos?.length === 0 && (
          <p className="text-[var(--ink-muted)]">Todavía no hay torneos. Empezá creando uno.</p>
        )}

        {torneos !== undefined &&
          torneos.length > 0 &&
          ORDEN.map((status) => {
            const info = ESTADO_DE_TORNEO[status];
            const delGrupo = torneos.filter((t) => t.status === status);

            return (
              <section key={status} className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  {info.plural}
                </h2>

                {delGrupo.length === 0 ? (
                  <p className="text-sm text-[var(--ink-muted)]">{info.vacio}</p>
                ) : (
                  delGrupo.map((t) => <TarjetaTorneo key={t.id} torneo={t} />)
                )}
              </section>
            );
          })}
      </Screen>
    </Pantalla>
  );
}
