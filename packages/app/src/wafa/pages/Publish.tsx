/**
 * Revisar y publicar un torneo.
 *
 * **Publicar es lo que aplica los resultados a la liga.** Por eso la pantalla
 * muestra primero qué va a pasar —podios y puntos— y recién después ofrece el
 * botón, con una confirmación aparte.
 *
 * Ver `docs/FUNCTIONAL.md` §6.7.
 */

import type { TournamentStatus } from '@bal/shared';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Button,
  clasesDeTarjeta,
  cn,
  Encabezado,
  Pantalla,
  Screen,
  StakeChip,
} from '../../components/ui.js';
import { ApiError, api } from '../../lib/apiClient.js';
import {
  avisosDePublicacion,
  podiosConPuntos,
  puntosQueSeAplicarian,
  type ResultadoParticipante,
  sePuedePublicar,
} from '../torneo.js';

interface Torneo {
  readonly id: string;
  readonly name: string;
  readonly status: TournamentStatus;
}

// ── Despublicar ──────────────────────────────────────────────────────────────

function Despublicar({ id, onHecho }: { readonly id: string; readonly onHecho: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string>();

  const despublicar = async () => {
    try {
      await api.post(`/admin/tournaments/${id}/unpublish`, { reason: motivo.trim() });
      setAbierto(false);
      onHecho();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo despublicar.');
    }
  };

  if (!abierto) {
    return (
      <Button variante="secundario" ancho onClick={() => setAbierto(true)}>
        Despublicar
      </Button>
    );
  }

  return (
    <div className={cn(clasesDeTarjeta({ nivel: 'transparente' }), 'flex flex-col gap-2')}>
      {/* Se dice exactamente qué revierte, no un "¿estás seguro?" genérico. */}
      <p className="text-sm text-[var(--warn)]">
        Despublicar saca este torneo de la liga: los puntos que sumó cada arquero se recalculan
        <strong> sin él</strong>, y los resultados dejan de verse en la página pública. Los puntajes
        cargados no se borran, y se puede volver a publicar.
      </p>

      <label className="text-sm" htmlFor="motivo-despublicar">
        Por qué lo despublicás
      </label>
      <textarea
        id="motivo-despublicar"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={2}
        className="px-3 py-2 text-base rounded-[var(--radius-md)] bg-[var(--surface)] border"
      />

      {error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button variante="secundario" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
        <Button
          ancho
          variante="peligro"
          disabled={motivo.trim().length < 5}
          onClick={() => void despublicar()}
        >
          Despublicar
        </Button>
      </div>
    </div>
  );
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

export function PublishPage({ onVolver }: { readonly onVolver: () => void }) {
  const { id = '' } = useParams();
  const [torneo, setTorneo] = useState<Torneo>();
  const [participantes, setParticipantes] = useState<ResultadoParticipante[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState<string>();

  const cargar = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([
        api.get<{ tournament: Torneo }>(`/admin/tournaments/${id}`),
        api.get<{ participants: ResultadoParticipante[] }>(`/admin/tournaments/${id}/results`),
      ]);
      setTorneo(t.tournament);
      setParticipantes(r.participants);
      setError(undefined);
    } catch {
      setError('No se pudieron cargar los resultados. Revisá la conexión.');
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const publicar = async () => {
    setPublicando(true);
    try {
      await api.post(`/admin/tournaments/${id}/publish`);
      setConfirmando(false);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo publicar. Revisá la conexión.');
    } finally {
      setPublicando(false);
    }
  };

  const podios = podiosConPuntos(participantes);
  const puntos = puntosQueSeAplicarian(participantes);
  const avisos = torneo ? avisosDePublicacion(torneo.status, participantes) : [];
  const publicado = torneo?.status === 'publicado';

  return (
    <Pantalla>
      <Encabezado titulo={publicado ? 'Resultados' : 'Publicar'} onVolver={onVolver} />

      <Screen conBarraFija>
        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        {torneo && (
          <div className="pt-2">
            <h1 className="font-[var(--font-display)] text-[var(--text-display)] font-bold">
              {torneo.name}
            </h1>
            {publicado && (
              <p className="text-[var(--ok)]">
                Publicado. Los resultados ya están en la página pública y aplicados a la liga.
              </p>
            )}
          </div>
        )}

        {avisos.map((a) => (
          <p
            key={a.mensaje}
            role={a.nivel === 'error' ? 'alert' : 'status'}
            className={cn(
              'text-sm rounded-[var(--radius-md)] border p-3',
              a.nivel === 'error' ? 'text-[var(--danger)]' : 'text-[var(--warn)]',
            )}
          >
            {a.mensaje}
          </p>
        ))}

        {/* Los podios primero: es lo que el admin tiene que revisar. */}
        {podios.map((p) => (
          <section
            key={p.category}
            className="flex flex-col gap-2"
            data-testid={`podio-${p.category}`}
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              {p.label}
            </h2>

            <ol className="flex flex-col gap-1.5">
              {p.filas.map((f) => (
                <li
                  key={f.participante.id}
                  className="rounded-[var(--radius-md)] border px-3 py-2 bg-[var(--surface)] flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-[var(--font-display)] font-bold tabular-nums w-6 shrink-0">
                      {f.position}
                    </span>
                    <span className="min-w-0 truncate">
                      {f.participante.lastName}, {f.participante.firstName}
                      {/* El empate se dice: dos primeros no es un error de carga. */}
                      {f.tied && <span className="text-[var(--ink-muted)]"> · empatado</span>}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <StakeChip stake={f.participante.stake} />
                    <span className="tabular-nums font-medium">{f.participante.total}</span>
                    {f.leaguePoints > 0 && (
                      <span className="text-sm text-[var(--ink-muted)] tabular-nums">
                        +{f.leaguePoints}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}

        {podios.length === 0 && !error && (
          <p className="text-[var(--ink-muted)]">Todavía no hay resultados para mostrar.</p>
        )}

        {!publicado && puntos.length > 0 && (
          <p className="text-sm text-[var(--ink-muted)]" data-testid="resumen-puntos">
            Al publicar, {puntos.length}{' '}
            {puntos.length === 1 ? 'arquero suma puntos' : 'arqueros suman puntos'} de liga en esta
            temporada.
          </p>
        )}
      </Screen>

      <div className="shrink-0 px-4 py-4 bg-[var(--bg)] border-t flex flex-col gap-2">
        {publicado ? (
          <Despublicar id={id} onHecho={() => void cargar()} />
        ) : confirmando ? (
          <>
            <p className="text-sm text-center">
              Se aplican los resultados a la liga y quedan visibles en la página pública. Se puede
              deshacer despublicando.
            </p>
            <div className="flex gap-2">
              <Button variante="secundario" onClick={() => setConfirmando(false)}>
                Cancelar
              </Button>
              <Button ancho disabled={publicando} onClick={() => void publicar()}>
                {publicando ? 'Publicando…' : 'Sí, publicar'}
              </Button>
            </div>
          </>
        ) : (
          <Button
            ancho
            disabled={!sePuedePublicar(avisos) || participantes.length === 0}
            onClick={() => setConfirmando(true)}
          >
            Publicar
          </Button>
        )}
      </div>
    </Pantalla>
  );
}
