/**
 * Patrullas y credenciales de un torneo.
 *
 * Mientras el torneo está `sin_iniciar` el admin puede reacomodar arqueros. El
 * validador **avisa pero no bloquea**: el admin conoce el terreno y puede tener
 * motivos para una excepción, y la decisión queda en el audit log.
 *
 * Ver `docs/FUNCTIONAL.md` §6.6.
 */

import { CATEGORY_INFO } from '@bal/shared';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Screen, StakeChip } from '../../components/ui.js';
import { ApiError, api } from '../../lib/apiClient.js';
import {
  type Borrador,
  borradorDe,
  cambiarInicio,
  cuerpoDeDistribucion,
  moverArquero,
  type PatrullaVista,
  problemaDelBorrador,
  textoDeViolacion,
  unidadesDe,
  violacionesDe,
} from '../patrullas.js';

interface Respuesta {
  readonly patrols: PatrullaVista[];
  readonly violations: unknown[];
}

interface Torneo {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly targets: readonly { index: number }[];
}

// ── Credenciales ─────────────────────────────────────────────────────────────

function Credencial({
  patrulla,
  onRegenerado,
}: {
  readonly patrulla: PatrullaVista;
  readonly onRegenerado: () => void;
}) {
  const [regenerando, setRegenerando] = useState(false);

  const regenerar = async () => {
    setRegenerando(true);
    try {
      await api.post(`/admin/patrols/${patrulla.id}/pin/regenerate`);
      onRegenerado();
    } finally {
      setRegenerando(false);
    }
  };

  if (!patrulla.pin) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--surface-2)] px-3 py-2">
      <div>
        <p className="font-mono text-sm">{patrulla.username}</p>
        <p className="font-mono text-lg tracking-widest" data-testid={`pin-${patrulla.number}`}>
          {patrulla.pin}
        </p>
      </div>

      <Button variante="secundario" disabled={regenerando} onClick={() => void regenerar()}>
        Regenerar
      </Button>
    </div>
  );
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

export function PatrolsPage({ onVolver }: { readonly onVolver: () => void }) {
  const { id = '' } = useParams();
  const [torneo, setTorneo] = useState<Torneo>();
  const [patrullas, setPatrullas] = useState<PatrullaVista[]>();
  const [borrador, setBorrador] = useState<Borrador[]>([]);
  const [moviendo, setMoviendo] = useState<string>();
  const [error, setError] = useState<string>();
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([
        api.get<{ tournament: Torneo }>(`/admin/tournaments/${id}`),
        api.get<Respuesta>(`/admin/tournaments/${id}/patrols`),
      ]);
      setTorneo(t.tournament);
      setPatrullas(r.patrols);
      setBorrador(borradorDe(r.patrols));
      setError(undefined);
    } catch {
      setError('No se pudieron cargar las patrullas. Revisá la conexión.');
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const editable = torneo?.status === 'sin_iniciar';
  const violaciones = violacionesDe(borrador);
  const problema = problemaDelBorrador(borrador);

  const guardar = async () => {
    setGuardando(true);
    setError(undefined);

    try {
      const r = await api.put<Respuesta>(
        `/admin/tournaments/${id}/patrols`,
        cuerpoDeDistribucion(borrador),
      );
      setPatrullas(r.patrols);
      setBorrador(borradorDe(r.patrols));
      setGuardado(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar. Revisá la conexión.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex flex-col min-h-dvh">
      <header className="sticky top-0 z-10 bg-[var(--bg)] border-b px-4 py-2 flex items-center gap-3 print:hidden">
        <button type="button" onClick={onVolver} className="min-h-[44px] text-left">
          ← Inicio
        </button>
        <span className="font-semibold">Patrullas</span>
      </header>

      <Screen conBarraFija>
        <h1 className="pt-2 font-[var(--font-display)] text-[var(--text-display)] font-bold">
          {torneo?.name ?? 'Patrullas'}
        </h1>

        {torneo && !editable && (
          <p className="text-sm text-[var(--ink-muted)]">
            El torneo ya arrancó: las patrullas quedaron congeladas. Los líderes tienen el recorrido
            descargado en el celular.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        {guardado && !error && (
          <p role="status" className="text-sm text-[var(--ok)]">
            Patrullas guardadas.
          </p>
        )}

        {/* Avisa pero no bloquea: el admin decide, y queda registrado. */}
        {violaciones.length > 0 && (
          <section
            className="rounded-[var(--radius-lg)] border p-3 flex flex-col gap-1.5 text-[var(--warn)]"
            data-testid="violaciones"
          >
            <p className="font-semibold text-sm">
              Estas patrullas no cumplen el reglamento. Podés guardarlas igual; queda registrado.
            </p>
            <ul className="text-sm flex flex-col gap-1">
              {violaciones.map((v) => (
                <li key={`${v.code}-${v.patrolNumber}`}>{textoDeViolacion(v)}</li>
              ))}
            </ul>
          </section>
        )}

        {patrullas === undefined && !error && <p className="text-[var(--ink-muted)]">Cargando…</p>}

        <div className="flex flex-col gap-3">
          {borrador.map((p) => {
            const original = patrullas?.find((x) => x.number === p.numero);

            return (
              <article
                key={p.numero}
                className="rounded-[var(--radius-lg)] border p-3 flex flex-col gap-3 bg-[var(--surface)]"
                data-testid={`patrulla-${p.numero}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-semibold">Patrulla {p.numero}</h2>
                  <span className="text-sm text-[var(--ink-muted)]">
                    Arranca en el blanco {p.startTargetIndex}
                  </span>
                </div>

                {editable && torneo && (
                  <label className="flex items-center gap-2 text-sm print:hidden">
                    Blanco de inicio
                    <select
                      aria-label={`Blanco de inicio de la patrulla ${p.numero}`}
                      value={p.startTargetIndex}
                      onChange={(e) =>
                        setBorrador(cambiarInicio(borrador, p.numero, Number(e.target.value)))
                      }
                      className="min-h-[44px] px-2 rounded-[var(--radius-sm)] border bg-[var(--surface)]"
                    >
                      {torneo.targets.map((t) => (
                        <option key={t.index} value={t.index}>
                          {t.index}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {p.miembros.length === 0 ? (
                  <p className="text-sm text-[var(--ink-muted)]">
                    Sin arqueros. Su credencial sigue existiendo por si la repartiste en papel.
                  </p>
                ) : (
                  <ol className="flex flex-col gap-2">
                    {unidadesDe(p.miembros).map((u) => (
                      <li key={u.label} className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                          Unidad {u.label}
                          {u.label === 'A' && ' · tira primero'}
                        </span>

                        {u.members.map((m, i) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] bg-[var(--surface-2)] px-3 py-2"
                            data-testid={`miembro-${m.lastName}`}
                          >
                            <div className="min-w-0">
                              <p className="truncate">
                                {m.lastName}, {m.firstName}
                              </p>
                              <p className="text-sm text-[var(--ink-muted)]">
                                {CATEGORY_INFO[m.category].label} ·{' '}
                                {i === 0 ? 'izquierda' : 'derecha'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <StakeChip stake={m.stake} />
                              {editable && (
                                <button
                                  type="button"
                                  onClick={() => setMoviendo(moviendo === m.id ? undefined : m.id)}
                                  aria-label={`Mover a ${m.lastName}`}
                                  className="min-h-[44px] min-w-[44px] rounded-[var(--radius-sm)] border print:hidden"
                                >
                                  ⇄
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* El destino se elige de una lista: arrastrar con guantes
                            en un celular no es una interacción confiable. */}
                        {moviendo && u.members.some((m) => m.id === moviendo) && (
                          <div className="flex flex-wrap gap-1.5 pt-1 print:hidden">
                            {borrador
                              .filter((otra) => otra.numero !== p.numero)
                              .map((otra) => (
                                <Button
                                  key={otra.numero}
                                  variante="secundario"
                                  onClick={() => {
                                    setBorrador(moverArquero(borrador, moviendo, otra.numero));
                                    setMoviendo(undefined);
                                    setGuardado(false);
                                  }}
                                >
                                  A la {otra.numero}
                                </Button>
                              ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                )}

                {original && <Credencial patrulla={original} onRegenerado={() => void cargar()} />}
              </article>
            );
          })}
        </div>
      </Screen>

      {editable && (
        <div className="sticky bottom-0 mt-auto px-4 py-4 bg-[var(--bg)] border-t flex flex-col gap-2 print:hidden">
          {problema && <p className="text-sm text-[var(--danger)] text-center">{problema}</p>}

          <div className="flex gap-2">
            <Button variante="secundario" onClick={() => window.print()}>
              Imprimir
            </Button>
            <Button
              ancho
              disabled={guardando || problema !== undefined}
              onClick={() => void guardar()}
            >
              {guardando ? 'Guardando…' : 'Guardar patrullas'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
