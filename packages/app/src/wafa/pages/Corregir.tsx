/**
 * Corregir puntajes contra la planilla de papel (`FE-34`, sobre `BE-25`).
 *
 * La planilla de papel es la fuente de verdad; la app es la que registra el ranking. Con el torneo
 * esperando publicación, el admin elige un arquero, ve su tarjeta blanco por blanco —flechas,
 * subtotal y acumulado, en el orden de la planilla— y corrige el que no coincide.
 *
 * - **El teclado es el del blanco** (`ScoreKeypad` de WAFL): un blanco 3D ofrece `11`, uno de sala
 *   ofrece `X`. Mismo componente, mismos 56px.
 * - **La pantalla no calcula nada que se guarde**: manda tokens y motivo, el servidor recalcula
 *   (regla 1), y la tarjeta se vuelve a pedir para mostrar lo que quedó.
 * - **Esto es WAFA, con red**: acá sí se espera la respuesta del servidor, como al publicar. El
 *   botón dice «Guardando…» y el error se muestra en línea, sin perder lo tipeado.
 *
 * Ver `docs/FUNCTIONAL.md` §6.7.
 */

import { useCarga } from '@bal/cliente';
import { camposEditables, type FilaDeTarjeta, type Modality, SCORING } from '@bal/shared';
import { ChipCategoria, useTituloDePagina } from '@bal/ui';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Cargando } from '../../components/Cargando.js';
import { Button, clasesDeTarjeta, cn, Encabezado, Pantalla, Screen } from '../../components/ui.js';
import { ApiError, conSenal, cuerpo, rpc } from '../../lib/rpc.js';
import { ScoreKeypad } from '../../wafl/ScoreKeypad.js';
import { agregarFlecha, conAcumulado, problemaDeCorreccion, quitarUltima } from '../correccion.js';

interface Tarjeta {
  readonly total: number;
  readonly maxTotal: number;
  readonly rows: readonly FilaDeTarjeta[];
  readonly corrected: readonly number[];
}

/** El blanco que se está corrigiendo y su borrador. */
interface Edicion {
  readonly blanco: number;
  readonly modality: Modality;
  readonly maxFlechas: number;
  readonly flechas: readonly string[];
  readonly motivo: string;
}

export function CorregirPage({ onVolver }: { readonly onVolver: () => void }) {
  useTituloDePagina('Corregir puntajes');
  const { id = '' } = useParams();

  const datos = useCarga(
    async (signal) => {
      const param = { id };
      const [t, r] = await Promise.all([
        cuerpo(rpc.admin.tournaments[':id'].$get({ param }, conSenal(signal))),
        cuerpo(rpc.admin.tournaments[':id'].results.$get({ param }, conSenal(signal))),
      ]);
      return {
        torneo: t.tournament,
        participantes: r.participants,
      };
    },
    [id],
    { mensajeDeError: 'No se pudo cargar el torneo. Revisá la conexión.' },
  );

  const [elegido, setElegido] = useState<string>();
  const tarjeta = useCarga(
    async (signal): Promise<Tarjeta | undefined> => {
      if (!elegido) return undefined;
      const r = await cuerpo(
        rpc.admin.tournaments[':id'].participants[':participantId'].scorecard.$get(
          { param: { id, participantId: elegido } },
          conSenal(signal),
        ),
      );
      return r.scorecard;
    },
    [id, elegido],
    { mensajeDeError: 'No se pudo cargar la tarjeta del arquero.' },
  );

  const [edicion, setEdicion] = useState<Edicion>();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string>();
  const [hecho, setHecho] = useState<string>();

  const torneo = datos.datos?.torneo;
  // Decisión 2 de la Fase 9: sólo esperando publicación. La tabla es la de `SH-11`.
  const sePuedeCorregir = torneo ? camposEditables(torneo.status).has('scores') : false;

  const abrir = (fila: FilaDeTarjeta) => {
    const blanco = torneo?.targets.find((t) => t.index === fila.index);
    if (!blanco) return;
    setError(undefined);
    setHecho(undefined);
    setEdicion({
      blanco: fila.index,
      modality: blanco.modality,
      maxFlechas: blanco.arrows,
      // Arranca vacío: se tipea lo que dice el papel, no se edita lo que dice la app.
      flechas: [],
      motivo: '',
    });
  };

  const guardar = async () => {
    if (!edicion || !elegido) return;
    setGuardando(true);
    setError(undefined);
    try {
      await rpc.admin.tournaments[':id'].participants[':participantId'].scores[':targetIndex'].$put(
        {
          param: { id, participantId: elegido, targetIndex: String(edicion.blanco) },
          json: { arrows: [...edicion.flechas], reason: edicion.motivo.trim() },
        },
      );
      setHecho(`Blanco ${edicion.blanco} corregido.`);
      setEdicion(undefined);
      await tarjeta.recargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar. Revisá la conexión.');
    } finally {
      setGuardando(false);
    }
  };

  const problema = edicion
    ? problemaDeCorreccion(edicion.flechas, edicion.maxFlechas, edicion.motivo)
    : undefined;

  return (
    <Pantalla>
      <Encabezado contexto="Administración" titulo="Corregir puntajes" onVolver={onVolver} />

      <Screen>
        {datos.error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {datos.error}
          </p>
        )}

        {datos.datos === undefined && !datos.error && (
          <Cargando forma="detalle" texto="Cargando el torneo…" />
        )}

        {torneo && (
          <div className="pt-2 flex flex-col gap-1">
            <h1 className="font-display text-display font-bold">{torneo.name}</h1>
            {sePuedeCorregir ? (
              <p className="text-sm text-[var(--ink-muted)]">
                La planilla de papel manda. Si la app no coincide, corregí el blanco acá antes de
                publicar: el servidor recalcula todo.
              </p>
            ) : (
              <p className="text-sm text-[var(--warn)]" role="status">
                Los puntajes sólo se corrigen con el torneo esperando publicación. Acá se ven, pero
                no se tocan.
              </p>
            )}
          </div>
        )}

        {/* Elegir arquero: por apellido, como está escrito en la planilla. */}
        <ul className="flex flex-col gap-1.5" aria-label="Arqueros">
          {[...(datos.datos?.participantes ?? [])]
            .filter((p) => p.status === 'activo')
            .sort((a, b) => a.lastName.localeCompare(b.lastName, 'es'))
            .map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={elegido === p.id}
                  onClick={() => {
                    setElegido(p.id);
                    setEdicion(undefined);
                    setHecho(undefined);
                  }}
                  className={cn(
                    'w-full min-h-[44px] px-3 flex items-center gap-3 rounded-[var(--radius-md)] border text-left',
                    elegido === p.id && 'border-[var(--nock-text)] bg-[var(--surface-2)]',
                  )}
                >
                  <span className="flex-1">
                    {p.lastName}, {p.firstName}
                  </span>
                  <span className="text-sm text-[var(--ink-muted)]">Patrulla {p.patrolNumber}</span>
                  <ChipCategoria category={p.category} compacto />
                </button>
              </li>
            ))}
        </ul>

        {tarjeta.error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {tarjeta.error}
          </p>
        )}

        {hecho && (
          <p role="status" className="text-sm text-[var(--ok)]">
            {hecho}
          </p>
        )}

        {elegido !== undefined && tarjeta.datos === undefined && !tarjeta.error && (
          <Cargando forma="detalle" texto="Cargando la tarjeta del arquero…" />
        )}

        {tarjeta.datos && (
          <section aria-label="Tarjeta del arquero" className="flex flex-col gap-2">
            <p className="text-sm text-[var(--ink-muted)]">
              Total {tarjeta.datos.total} de {tarjeta.datos.maxTotal}
            </p>
            {/* Los nombres de las columnas, como en la planilla. Para el lector de pantalla, cada
                número lleva el suyo adentro de la fila. */}
            <div
              aria-hidden="true"
              className="flex items-center gap-3 px-4 font-mono text-[11px] uppercase text-[var(--ink-muted)]"
            >
              <span className="w-14 shrink-0">Blanco</span>
              <span className="flex-1">Flechas</span>
              <span className="w-10 text-right">Pts</span>
              <span className="w-12 text-right">Acum.</span>
            </div>
            <ol className="flex flex-col gap-1.5">
              {conAcumulado(tarjeta.datos.rows).map(({ fila, acumulado }) => {
                const corregido = tarjeta.datos?.corrected.includes(fila.index) ?? false;
                const abierta = edicion?.blanco === fila.index;
                return (
                  <li
                    key={fila.index}
                    data-testid={`fila-${fila.index}`}
                    className={cn(clasesDeTarjeta(), 'flex flex-col gap-2')}
                  >
                    <div className="flex items-center gap-3">
                      {/* El número y, debajo, la modalidad: en una columna, para que a 360px las
                          flechas no se partan en varias líneas. */}
                      <span className="flex w-14 shrink-0 flex-col">
                        <span className="font-mono text-sm">#{fila.index}</span>
                        <span className="text-xs text-[var(--ink-muted)]">
                          {SCORING[fila.modality].label}
                        </span>
                      </span>
                      <span className="flex-1 font-mono whitespace-nowrap">
                        {fila.arrows === null
                          ? 'Sin puntaje'
                          : fila.arrows.map((a) => a.token).join(' · ')}
                      </span>
                      <span className="font-mono w-10 text-right">
                        <span className="sr-only">Puntos del blanco: </span>
                        {fila.arrows === null ? '—' : fila.total}
                      </span>
                      <span className="font-mono w-12 text-right text-[var(--ink-muted)]">
                        <span className="sr-only">Acumulado: </span>
                        {acumulado ?? '—'}
                      </span>
                    </div>
                    {(corregido || (sePuedeCorregir && !abierta)) && (
                      <div className="flex items-center justify-between gap-2">
                        {corregido ? (
                          <span className="text-sm text-[var(--ink-muted)]">Corregido</span>
                        ) : (
                          <span />
                        )}
                        {sePuedeCorregir && !abierta && (
                          <Button variante="secundario" onClick={() => abrir(fila)}>
                            Corregir #{fila.index}
                          </Button>
                        )}
                      </div>
                    )}

                    {abierta && edicion && (
                      <div className="flex flex-col gap-3 pt-2 border-t">
                        <p className="text-sm">
                          Tocá las flechas como están en la planilla:{' '}
                          <span className="font-mono">
                            {edicion.flechas.length > 0 ? edicion.flechas.join(' · ') : '—'}
                          </span>
                        </p>
                        <ScoreKeypad
                          modality={edicion.modality}
                          cargadas={edicion.flechas.length}
                          total={edicion.maxFlechas}
                          onToken={(token) =>
                            setEdicion({
                              ...edicion,
                              flechas: agregarFlecha(edicion.flechas, token, edicion.maxFlechas),
                            })
                          }
                        />
                        <Button
                          variante="secundario"
                          disabled={edicion.flechas.length === 0}
                          onClick={() =>
                            setEdicion({ ...edicion, flechas: quitarUltima(edicion.flechas) })
                          }
                        >
                          Borrar la última
                        </Button>

                        <label className="text-sm" htmlFor="motivo-correccion">
                          Por qué se corrige
                        </label>
                        <textarea
                          id="motivo-correccion"
                          value={edicion.motivo}
                          onChange={(e) => setEdicion({ ...edicion, motivo: e.target.value })}
                          rows={2}
                          className="px-3 py-2 text-base rounded-[var(--radius-md)] bg-[var(--surface)] border"
                        />
                        {problema && <p className="text-sm text-[var(--ink-muted)]">{problema}</p>}
                        {error && (
                          <p role="alert" className="text-sm text-[var(--danger)]">
                            {error}
                          </p>
                        )}

                        <div className="flex gap-2">
                          <Button variante="secundario" onClick={() => setEdicion(undefined)}>
                            Cancelar
                          </Button>
                          <Button
                            ancho
                            ocupado={guardando}
                            disabled={problema !== undefined}
                            onClick={() => void guardar()}
                          >
                            {guardando ? 'Guardando…' : 'Guardar corrección'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </Screen>
    </Pantalla>
  );
}
