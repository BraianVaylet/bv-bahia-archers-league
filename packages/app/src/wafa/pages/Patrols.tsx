/**
 * Patrullas y credenciales de un torneo.
 *
 * Mientras el torneo está `sin_iniciar` el admin puede reacomodar arqueros. El
 * validador **avisa pero no bloquea**: el admin conoce el terreno y puede tener
 * motivos para una excepción, y la decisión queda en el audit log.
 *
 * Ver `docs/FUNCTIONAL.md` §6.6.
 */

import {
  ChipCategoria,
  type Icono,
  IconoBajar,
  IconoEliminar,
  IconoMover,
  IconoSubir,
} from '@bal/ui';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BotonCopiar } from '../../components/BotonCopiar.js';
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
  type Borrador,
  borradorDe,
  cambiarInicio,
  cuerpoDeDistribucion,
  eliminarPatrulla,
  moverArquero,
  moverEnPatrulla,
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

      <div className="flex items-start gap-2 shrink-0">
        {/* Seis dígitos se transcriben mal, y un PIN mal transcripto es un
            líder que no entra con el torneo ya empezado. */}
        <BotonCopiar valor={patrulla.pin} queEs={`el PIN de la patrulla ${patrulla.number}`} />

        <Button variante="secundario" disabled={regenerando} onClick={() => void regenerar()}>
          Regenerar
        </Button>
      </div>
    </div>
  );
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

/** Índice de un arquero dentro de su patrulla, para saber si está en un extremo. */
function indiceEnPatrulla(p: Borrador, participantId: string): number {
  return p.miembros.findIndex((m) => m.id === participantId);
}

/**
 * Botón de sólo ícono de una fila de arquero.
 *
 * El ícono va `aria-hidden` y el nombre lo pone `aria-label`: un símbolo sin
 * nombre no dice nada en un lector de pantalla, y anunciarlo *además* del
 * `aria-label` diría dos cosas.
 */
function BotonDeFila({
  icono: Icono,
  etiqueta,
  onClick,
  disabled,
}: {
  readonly icono: Icono;
  readonly etiqueta: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={etiqueta}
      className="min-h-[44px] min-w-[44px] rounded-[var(--radius-sm)] border print:hidden
        flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Icono />
    </button>
  );
}

export function PatrolsPage({ onVolver }: { readonly onVolver: () => void }) {
  const { id = '' } = useParams();
  const [torneo, setTorneo] = useState<Torneo>();
  const [patrullas, setPatrullas] = useState<PatrullaVista[]>();
  const [borrador, setBorrador] = useState<Borrador[]>([]);
  const [moviendo, setMoviendo] = useState<string>();
  const [error, setError] = useState<string>();
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  /**
   * Hay cambios que el servidor todavía no tiene.
   *
   * Es lo que deshabilita **Imprimir**: la planilla en papel es la única fuente
   * de verdad en el monte, y no puede decir algo distinto de lo que la app va a
   * mandar. Cualquier edición lo prende; guardar y recargar lo apagan.
   */
  const [sinGuardar, setSinGuardar] = useState(false);

  /** Toda edición del borrador pasa por acá, para que ninguna se olvide de marcarlo. */
  const editar = (siguiente: Borrador[]) => {
    setBorrador(siguiente);
    setSinGuardar(true);
    setGuardado(false);
  };

  const cargar = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([
        api.get<{ tournament: Torneo }>(`/admin/tournaments/${id}`),
        api.get<Respuesta>(`/admin/tournaments/${id}/patrols`),
      ]);
      setTorneo(t.tournament);
      setPatrullas(r.patrols);
      setBorrador(borradorDe(r.patrols));
      setSinGuardar(false);
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
      setSinGuardar(false);
      setGuardado(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar. Revisá la conexión.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Pantalla>
      <Encabezado titulo="Patrullas" onVolver={onVolver} />

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

        {/* Avisa pero no bloquea: el admin decide, y queda registrado. */}
        {violaciones.length > 0 && (
          <section
            className={cn(clasesDeTarjeta(), 'flex flex-col gap-1.5 text-[var(--warn)]')}
            data-testid="violaciones"
          >
            <p className="font-semibold text-sm">
              Estas patrullas no cumplen el reglamento. Podés guardarlas igual; queda registrado.
            </p>
            <ul className="text-sm flex flex-col gap-1">
              {/* El texto como clave: no todas las violaciones tienen una sola
                  patrulla, y `DUPLICATE_START` puede aparecer varias veces. */}
              {violaciones.map((v) => {
                const texto = textoDeViolacion(v);
                return <li key={texto}>{texto}</li>;
              })}
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
                className={cn(clasesDeTarjeta(), 'flex flex-col gap-3')}
                data-testid={`patrulla-${p.numero}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-semibold">Patrulla {p.numero}</h2>

                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-[var(--ink-muted)]">
                      Arranca en el blanco {p.startTargetIndex}
                    </span>

                    {/*
                      Eliminar, **sólo cuando quedó vacía**. Con gente adentro
                      sacaría arqueros del torneo sin decirlo: primero se los
                      mueve. Eliminarla renumera a las que siguen, porque el
                      usuario del líder es `patrulla${'{'}number{'}'}` y una
                      numeración con huecos deja un usuario que no existe.
                    */}
                    {editable && p.miembros.length === 0 && (
                      <BotonDeFila
                        icono={IconoEliminar}
                        etiqueta={`Eliminar la patrulla ${p.numero}`}
                        onClick={() => editar(eliminarPatrulla(borrador, p.numero))}
                      />
                    )}
                  </span>
                </div>

                {editable && p.miembros.length === 0 && (
                  <p className="text-sm text-[var(--warn)]" data-testid="patrulla-vacia">
                    Sin arqueros. Movele alguien o eliminala: así no se puede guardar.
                  </p>
                )}

                {editable && torneo && (
                  <label className="flex items-center gap-2 text-sm print:hidden">
                    Blanco de inicio
                    <select
                      aria-label={`Blanco de inicio de la patrulla ${p.numero}`}
                      value={p.startTargetIndex}
                      onChange={(e) =>
                        editar(cambiarInicio(borrador, p.numero, Number(e.target.value)))
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
                            /*
                              **Tres renglones, no una fila.**

                              Estaba todo en una: nombre y categoría a la
                              izquierda, estaca y tres botones a la derecha. En
                              360px de ancho el nombre se cortaba y los botones
                              quedaban pegados contra el borde.

                              Ahora cada renglón responde una pregunta: quién
                              es, con qué tira, y qué se puede hacer con él.
                            */
                            className="flex flex-col gap-1.5 rounded-[var(--radius-md)] bg-[var(--surface-2)] px-3 py-2"
                            data-testid={`miembro-${m.lastName}`}
                          >
                            {/* 1 · Quién es. Completo: en una planilla impresa
                                el apellido solo no alcanza para desempatar. */}
                            <p className="font-medium">
                              {m.lastName}, {m.firstName}
                            </p>

                            {/* 2 · Con qué tira: categoría y estaca. Las dos
                                deciden desde dónde y contra quién compite. */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <ChipCategoria category={m.category} compacto />
                              <StakeChip stake={m.stake} compacto />
                            </div>

                            {/* 3 · Dónde se para, y qué se puede hacer.
                                El lado sale del ORDEN dentro de la unidad, no de
                                un dato guardado: es lo mismo que hace el
                                servidor al recibir la distribución. */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-[var(--ink-muted)]">
                                {i === 0 ? 'Izquierda' : 'Derecha'}
                              </span>

                              {editable && (
                                <div className="flex items-center gap-2 shrink-0 print:hidden">
                                  {/*
                                    Subir y bajar **dentro** de la patrulla. No es
                                    cosmético: los dos primeros son la unidad `A`
                                    y la `A` tira primero, así que esto decide el
                                    orden de tiro.

                                    Deshabilitados en los extremos: un botón que
                                    parece activo y no hace nada es peor que uno
                                    apagado. Ver `DESIGN_SYSTEM.md` §10.
                                  */}
                                  <BotonDeFila
                                    icono={IconoSubir}
                                    etiqueta={`Subir a ${m.lastName}`}
                                    disabled={indiceEnPatrulla(p, m.id) === 0}
                                    onClick={() =>
                                      editar(moverEnPatrulla(borrador, m.id, 'arriba'))
                                    }
                                  />
                                  <BotonDeFila
                                    icono={IconoBajar}
                                    etiqueta={`Bajar a ${m.lastName}`}
                                    disabled={indiceEnPatrulla(p, m.id) === p.miembros.length - 1}
                                    onClick={() => editar(moverEnPatrulla(borrador, m.id, 'abajo'))}
                                  />
                                  <BotonDeFila
                                    icono={IconoMover}
                                    etiqueta={`Mover a ${m.lastName} a otra patrulla`}
                                    onClick={() =>
                                      setMoviendo(moviendo === m.id ? undefined : m.id)
                                    }
                                  />
                                </div>
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
                                    editar(moverArquero(borrador, moviendo, otra.numero));
                                    setMoviendo(undefined);
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
        <div
          className="shrink-0 px-4 py-4 bg-[var(--bg)] border-t flex flex-col gap-2 print:hidden"
          data-testid="barra-acciones"
        >
          {problema && <p className="text-sm text-[var(--danger)] text-center">{problema}</p>}

          {/* El aviso va acá y no arriba de todo: con cinco patrullas en
              pantalla, el admin no llega a ver una confirmación que quedó fuera
              de cuadro, y vuelve a apretar Guardar. */}
          {guardado && !error && (
            <p role="status" className="text-sm text-[var(--ok)] text-center">
              Patrullas guardadas.
            </p>
          )}

          {sinGuardar && (
            <p className="text-sm text-[var(--ink-muted)] text-center">
              Guardá los cambios antes de imprimir: la planilla tiene que decir lo mismo que la app.
            </p>
          )}

          <div className="flex gap-2">
            <Button variante="secundario" disabled={sinGuardar} onClick={() => window.print()}>
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

          {guardado && !error && (
            <Button variante="secundario" ancho onClick={onVolver}>
              Volver al inicio
            </Button>
          )}
        </div>
      )}
    </Pantalla>
  );
}
