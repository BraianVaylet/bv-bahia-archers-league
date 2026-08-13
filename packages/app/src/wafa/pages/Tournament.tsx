/**
 * Detalle y seguimiento de un torneo.
 *
 * La pantalla cambia según el estado. En proceso es una **pantalla de mirar**:
 * el admin sigue el avance desde el club mientras las patrullas caminan.
 *
 * Ver `docs/FUNCTIONAL.md` §6.7.
 */

import { formatearFecha, type SCORING, type TournamentStatus } from '@bal/shared';
import { BadgeEstado, ChipCategoria, ChipModalidad, IconoCandado } from '@bal/ui';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, cn, Encabezado, Field, Screen } from '../../components/ui.js';
import { ApiError, api } from '../../lib/apiClient.js';
import {
  type AvanceDePatrulla,
  avanceDePatrullas,
  motivoDeBloqueo,
  type PatrullaSeguimiento,
  type ResultadoParticipante,
} from '../torneo.js';

interface Torneo {
  readonly id: string;
  readonly name: string;
  readonly date: string;
  readonly status: TournamentStatus;
  readonly targets: readonly { index: number; modality: keyof typeof SCORING; arrows: number }[];
  readonly maxPossibleScore: number;
  readonly participantCount: number;
}

// ── Desbloqueo de firma ──────────────────────────────────────────────────────

function DesbloquearFirma({
  participante,
  onHecho,
}: {
  readonly participante: ResultadoParticipante;
  readonly onHecho: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string>();

  const desbloquear = async () => {
    try {
      await api.post(`/admin/participants/${participante.id}/signature/unlock`, {
        reason: motivo.trim(),
      });
      setAbierto(false);
      setMotivo('');
      onHecho();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo desbloquear.');
    }
  };

  if (!abierto) {
    return (
      <Button variante="secundario" onClick={() => setAbierto(true)}>
        Desbloquear firma
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border p-3">
      {/* El motivo es obligatorio y queda en el audit log: desbloquear una firma
          es saltarse el control que valida el puntaje. */}
      <label className="text-sm" htmlFor={`motivo-${participante.id}`}>
        Por qué {participante.lastName} no firma
      </label>
      <textarea
        id={`motivo-${participante.id}`}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={2}
        className="px-3 py-2 text-base rounded-[var(--radius-md)] bg-[var(--surface)] border"
        placeholder="Se fue antes de cerrar el circuito."
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
          onClick={() => void desbloquear()}
        >
          Desbloquear
        </Button>
      </div>
    </div>
  );
}

// ── Seguimiento ──────────────────────────────────────────────────────────────

function TarjetaDePatrulla({
  avance,
  puedeDesbloquear,
  onCambio,
}: {
  readonly avance: AvanceDePatrulla;
  readonly puedeDesbloquear: boolean;
  readonly onCambio: () => void;
}) {
  return (
    <article
      className="rounded-[var(--radius-lg)] border p-3 flex flex-col gap-2 bg-[var(--surface)]"
      data-testid={`avance-${avance.number}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">Patrulla {avance.number}</span>
        <span className="text-sm tabular-nums text-[var(--ink-muted)]">
          {avance.targetsCompleted} de {avance.totalTargets} blancos
        </span>
      </div>

      <div
        className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden"
        role="progressbar"
        aria-label={`Avance de la patrulla ${avance.number}`}
        aria-valuenow={avance.pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-[var(--nock)]" style={{ width: `${avance.pct}%` }} />
      </div>

      {avance.sinFirmar.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[var(--ink-muted)]">
            Falta la firma de {avance.sinFirmar.map((m) => m.lastName).join(', ')}.
          </p>

          {puedeDesbloquear &&
            avance.sinFirmar.map((m) => (
              <DesbloquearFirma key={m.id} participante={m} onHecho={onCambio} />
            ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--ok)]">Todos firmaron.</p>
      )}
    </article>
  );
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

export function TournamentPage({ onVolver }: { readonly onVolver: () => void }) {
  const { id = '' } = useParams();
  const [torneo, setTorneo] = useState<Torneo>();
  const [patrullas, setPatrullas] = useState<PatrullaSeguimiento[]>([]);
  const [participantes, setParticipantes] = useState<ResultadoParticipante[]>([]);
  const [bloqueados, setBloqueados] = useState<number[]>([]);
  const [error, setError] = useState<string>();
  const [iniciando, setIniciando] = useState(false);
  const [confirmandoInicio, setConfirmandoInicio] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  /**
   * Borrar pide dos toques.
   *
   * No hay `confirm()` —bloquea el hilo y en un celular sale del contexto— ni
   * modal: el segundo toque sobre el mismo botón, con el texto cambiado, dice
   * lo mismo y no tapa la pantalla.
   */
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [editando, setEditando] = useState<Torneo>();

  const cargar = useCallback(async () => {
    try {
      const [t, p, r, b] = await Promise.all([
        api.get<{ tournament: Torneo }>(`/admin/tournaments/${id}`),
        api.get<{ patrols: PatrullaSeguimiento[] }>(`/admin/tournaments/${id}/patrols`),
        api.get<{ participants: ResultadoParticipante[] }>(`/admin/tournaments/${id}/results`),
        api.get<{ lockedTargets: number[] }>(`/admin/tournaments/${id}/locked-targets`),
      ]);
      setTorneo(t.tournament);
      setPatrullas(p.patrols);
      setParticipantes(r.participants);
      setBloqueados(b.lockedTargets);
      setError(undefined);
    } catch {
      setError('No se pudo cargar el torneo. Revisá la conexión.');
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /**
   * Volver a `sin_iniciar`.
   *
   * La guarda —que no haya ni un puntaje— **es del servidor**. Acá no se
   * adivina: se pide y se muestra lo que conteste. Una pantalla que decide sola
   * puede estar mirando datos de hace un minuto.
   */
  const volverAtras = async () => {
    setIniciando(true);
    try {
      await api.post(`/admin/tournaments/${id}/unstart`);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo volver atrás.');
    } finally {
      setIniciando(false);
    }
  };

  const iniciar = async () => {
    setIniciando(true);
    try {
      await api.post(`/admin/tournaments/${id}/start`);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar el torneo.');
    } finally {
      setIniciando(false);
    }
  };

  const guardarDatos = async () => {
    if (!editando) return;
    try {
      await api.patch(`/admin/tournaments/${id}`, {
        name: editando.name.trim(),
        date: editando.date.slice(0, 10),
      });
      setEditando(undefined);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron guardar los cambios.');
    }
  };

  const eliminar = async () => {
    if (!confirmandoBorrado) {
      setConfirmandoBorrado(true);
      return;
    }

    setEliminando(true);
    try {
      await api.del(`/admin/tournaments/${id}`);
      onVolver();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el torneo.');
      setConfirmandoBorrado(false);
    } finally {
      setEliminando(false);
    }
  };

  const avances = torneo ? avanceDePatrullas(patrullas, participantes, torneo.targets.length) : [];

  return (
    <div className="flex flex-col min-h-dvh">
      <Encabezado titulo="Torneo" onVolver={onVolver} />

      <Screen>
        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        {torneo === undefined && !error && <p className="text-[var(--ink-muted)]">Cargando…</p>}

        {torneo && (
          <>
            <div className="pt-2">
              <h1 className="font-[var(--font-display)] text-[var(--text-display)] font-bold">
                {torneo.name}
              </h1>
              <p className="text-[var(--ink-muted)]" data-testid="estado">
                <BadgeEstado status={torneo.status} compacto /> · {formatearFecha(torneo.date)} ·{' '}
                {torneo.participantCount} arqueros · máximo {torneo.maxPossibleScore}
              </p>
            </div>

            <nav className="flex flex-col gap-2">
              <Link to={`/wafa/torneos/${id}/patrullas`}>
                <Button variante="secundario" ancho>
                  Patrullas y credenciales
                </Button>
              </Link>

              <Link to={`/wafa/torneos/${id}/pagos`}>
                <Button variante="secundario" ancho>
                  Arqueros y pagos
                </Button>
              </Link>

              {/*
                Iniciar pide confirmación. No es una formalidad: a partir de acá
                las patrullas quedan congeladas y los líderes bajan el recorrido
                al celular. Dos toques sobre el mismo botón, sin `confirm()` ni
                modal — igual que eliminar, que es la otra acción de ida.
              */}
              {torneo.status === 'sin_iniciar' && (
                <div className="flex flex-col gap-2">
                  {confirmandoInicio && (
                    <p className="text-sm text-[var(--warn)]" role="status">
                      A partir de acá las patrullas quedan congeladas y los líderes bajan el
                      recorrido. ¿Iniciar el torneo?
                    </p>
                  )}
                  <Button
                    ancho
                    disabled={iniciando}
                    onClick={() =>
                      confirmandoInicio ? void iniciar() : setConfirmandoInicio(true)
                    }
                  >
                    {iniciando
                      ? 'Iniciando…'
                      : confirmandoInicio
                        ? 'Sí, iniciar'
                        : 'Iniciar torneo'}
                  </Button>
                </div>
              )}

              {/*
                Y la vuelta atrás, para el arranque por error. El servidor la
                rechaza si ya hay un puntaje: acá no se esconde el botón por las
                dudas, se muestra el motivo cuando dice que no.
              */}
              {torneo.status === 'en_proceso' && (
                <Button
                  variante="secundario"
                  ancho
                  disabled={iniciando}
                  onClick={() => void volverAtras()}
                >
                  {iniciando ? 'Volviendo…' : 'Volver a sin iniciar'}
                </Button>
              )}

              {(torneo.status === 'completado' || torneo.status === 'publicado') && (
                <Link to={`/wafa/torneos/${id}/publicar`}>
                  <Button ancho>
                    {torneo.status === 'publicado' ? 'Ver resultados' : 'Revisar y publicar'}
                  </Button>
                </Link>
              )}

              {/* Sólo mientras nadie tiró. Una vez iniciado, el recorrido está
                  descargado en los celulares de los líderes y cambiarlo dejaría
                  la app y el papel diciendo cosas distintas. */}
              {torneo.status === 'sin_iniciar' && (
                <div className="flex gap-2 pt-2">
                  <Button
                    variante="secundario"
                    className="flex-1"
                    onClick={() => setEditando(editando ? undefined : { ...torneo })}
                  >
                    {editando ? 'Cancelar edición' : 'Editar'}
                  </Button>

                  <Button
                    variante="peligro"
                    disabled={eliminando}
                    onClick={() => void eliminar()}
                    className="flex-1"
                  >
                    {confirmandoBorrado ? 'Confirmar borrado' : 'Eliminar'}
                  </Button>
                </div>
              )}

              {confirmandoBorrado && (
                <p role="status" className="text-sm text-[var(--danger)]">
                  Se van a borrar el torneo, sus patrullas y sus credenciales. Tocá de nuevo para
                  confirmar.
                </p>
              )}

              {/* Sólo nombre, fecha y descripción. El recorrido tiene sus
                  propias reglas —un blanco con puntajes está bloqueado— y se
                  edita desde su pantalla, no de refilón acá. */}
              {editando && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void guardarDatos();
                  }}
                  className="flex flex-col gap-3 rounded-[var(--radius-lg)] border p-3 bg-[var(--surface)]"
                  data-testid="editar-torneo"
                >
                  <Field
                    label="Nombre"
                    value={editando.name}
                    onChange={(e) => setEditando({ ...editando, name: e.target.value })}
                    required
                  />
                  <Field
                    label="Fecha"
                    type="date"
                    value={editando.date.slice(0, 10)}
                    onChange={(e) => setEditando({ ...editando, date: e.target.value })}
                    required
                  />

                  <Button type="submit" ancho disabled={editando.name.trim().length < 3}>
                    Guardar cambios
                  </Button>
                </form>
              )}
            </nav>

            {torneo.status !== 'sin_iniciar' && (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  Avance
                </h2>

                {avances.map((a) => (
                  <TarjetaDePatrulla
                    key={a.number}
                    avance={a}
                    puedeDesbloquear={torneo.status === 'en_proceso'}
                    onCambio={() => void cargar()}
                  />
                ))}
              </section>
            )}

            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                Recorrido
              </h2>

              <ul className="flex flex-col gap-1.5">
                {torneo.targets.map((t) => {
                  const bloqueo = motivoDeBloqueo(t.index, bloqueados, torneo.status);

                  return (
                    <li
                      key={t.index}
                      className={cn(
                        'rounded-[var(--radius-md)] border px-3 py-2 bg-[var(--surface)]',
                        bloqueo && 'opacity-70',
                      )}
                      data-testid={`blanco-${t.index}`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="flex items-center gap-2">
                          {t.index}.
                          <ChipModalidad modality={t.modality} compacto />
                        </span>
                        <span className="text-sm text-[var(--ink-muted)] tabular-nums">
                          {t.arrows} flechas
                        </span>
                      </div>

                      {/* Un blanco bloqueado dice POR QUÉ: si no, parece un error. */}
                      {bloqueo && (
                        <p className="text-sm text-[var(--ink-muted)]">
                          <IconoCandado size={14} className="inline-block mr-1 align-[-2px]" />
                          {bloqueo}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {participantes.length > 0 && torneo.status !== 'sin_iniciar' && (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  Participantes
                </h2>

                <ul className="flex flex-col gap-1.5">
                  {participantes.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-[var(--radius-md)] border px-3 py-2 bg-[var(--surface)] flex items-baseline justify-between gap-2"
                      data-testid={`participante-${p.lastName}`}
                    >
                      <span className="min-w-0 truncate">
                        {p.lastName}, {p.firstName} <ChipCategoria category={p.category} compacto />
                      </span>
                      <span className="tabular-nums font-medium shrink-0">
                        {p.targetsCompleted}/{torneo.targets.length}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </Screen>
    </div>
  );
}
