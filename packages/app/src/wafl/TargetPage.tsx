/**
 * Página de blanco: donde se anota.
 *
 * **Lee de IndexedDB, nunca de una respuesta HTTP.** Cada toque guarda al
 * instante y sigue. No hay botón de guardar y no hay espera de red.
 *
 * Ver `docs/FUNCTIONAL.md` §7.3 y `docs/OFFLINE_SYNC.md` §1.
 */

import { ChipModalidad, useTituloDePagina } from '@bal/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Encabezado, Pantalla, Screen } from '../components/ui.js';
import { useWakeLock } from '../lib/useWakeLock.js';
import type { BundleParticipant, BundleTarget, StoredScore } from '../offline/db.js';
import { readScore, readScoresDeBlanco, readSignatures } from '../offline/db.js';
import { writeScore } from '../offline/outbox.js';
import { nudge } from '../offline/syncWorker.js';
import { ArrowRow } from './ArrowRow.js';
import { ScoreKeypad } from './ScoreKeypad.js';
import { SyncBadge } from './SyncBadge.js';

export interface TargetPageProps {
  readonly target: BundleTarget;
  readonly participants: readonly BundleParticipant[];
  readonly onContinuar: () => void;
  readonly onVolver: () => void;
  /** Sólo para mostrar (`REF7-10`): la primera línea del encabezado, «Patrulla 1». */
  readonly patrulla?: number;
  /** Sólo para mostrar: el nombre del torneo, como título del encabezado. */
  readonly torneo?: string;
  /** Sólo para mostrar: cuántos blancos tiene el recorrido, para «1 de 6». */
  readonly totalDeBlancos?: number;
}

const NADA = () => {};

export function TargetPage({
  target,
  participants,
  onContinuar,
  onVolver,
  patrulla,
  torneo,
  totalDeBlancos,
}: TargetPageProps) {
  useTituloDePagina(`Blanco ${target.index}`);
  // La pantalla no se apaga entre flecha y flecha. Sólo acá: ver `useWakeLock` y su test de alcance.
  useWakeLock();
  const [scores, setScores] = useState<StoredScore[]>([]);
  const [firmados, setFirmados] = useState<ReadonlySet<string>>(new Set());
  const [seleccionado, setSeleccionado] = useState(participants[0]?.id ?? '');
  const [error, setError] = useState<string>();

  // Toda la lectura sale de IndexedDB. Si no hay red, no cambia nada.
  const recargar = useCallback(async () => {
    const [deEsteBlanco, firmas] = await Promise.all([
      readScoresDeBlanco(target.index),
      readSignatures(),
    ]);
    setScores(deEsteBlanco);
    // Si no cambió quién firmó, se conserva el mismo `Set`: uno nuevo en cada lectura cambiaría la
    // identidad de los callbacks de todas las filas y las repintaría (`REF6-14` / `P-7`).
    setFirmados((previo) => {
      const ahora = new Set(firmas.map((f) => f.participantId));
      return ahora.size === previo.size && [...ahora].every((id) => previo.has(id))
        ? previo
        : ahora;
    });
  }, [target.index]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const porParticipante = useMemo(() => new Map(scores.map((s) => [s.participantId, s])), [scores]);

  const faltantes = participants.filter(
    (p) => (porParticipante.get(p.id)?.arrows.length ?? 0) < target.arrows,
  );

  const actual = porParticipante.get(seleccionado);
  const cargadas = actual?.arrows.length ?? 0;

  /**
   * Cola de escrituras.
   *
   * Dos toques rápidos —que es exactamente cómo se anota con guantes— se
   * disparan antes de que React re-renderice, así que leer las flechas del
   * estado daría un valor obsoleto y el segundo toque pisaría al primero.
   * Cada escritura se encadena y lee de IndexedDB, que es la fuente de verdad.
   */
  const cola = useRef<Promise<unknown>>(Promise.resolve());

  const encolar = useCallback(<T,>(fn: () => Promise<T>): void => {
    cola.current = cola.current.then(fn, fn);
  }, []);

  const agregarFlecha = useCallback(
    (token: string) => {
      // Firmado no se toca: la firma guarda un hash del puntaje del momento, y
      // editarlo después hace que el servidor rechace el cierre.
      if (!seleccionado || firmados.has(seleccionado)) return;

      encolar(async () => {
        // Se lee de la base, no del estado de React: es lo que hace que dos
        // toques seguidos no se pisen.
        const previo = await readScore(seleccionado, target.index);
        const siguientes = [...(previo?.arrows ?? []), token];
        if (siguientes.length > target.arrows) return;

        const r = await writeScore(seleccionado, target.index, siguientes);
        if (!r.ok) {
          setError(r.message);
          return;
        }

        setError(undefined);
        await recargar();

        // De fondo. El puntaje ya está guardado.
        nudge();

        // Al completar un arquero, pasa solo al siguiente que falte.
        if (siguientes.length === target.arrows) {
          const deEsteBlanco = new Map(
            (await readScoresDeBlanco(target.index)).map((s) => [s.participantId, s]),
          );

          const siguiente = participants.find(
            (p) =>
              p.id !== seleccionado && (deEsteBlanco.get(p.id)?.arrows.length ?? 0) < target.arrows,
          );
          if (siguiente) setSeleccionado(siguiente.id);
        }
      });
    },
    [encolar, firmados, participants, recargar, seleccionado, target.arrows, target.index],
  );

  const borrarUltima = useCallback(
    (participantId: string) => {
      if (firmados.has(participantId)) return;

      encolar(async () => {
        const score = await readScore(participantId, target.index);
        if (!score || score.arrows.length === 0) return;

        await writeScore(participantId, target.index, score.arrows.slice(0, -1));
        await recargar();
        nudge();
      });
    },
    [encolar, firmados, recargar, target.index],
  );

  /**
   * Los callbacks de cada fila, **estables** entre renders (`REF6-14` / `P-7`).
   *
   * Una función nueva por render hace que `ArrowRow` (que es `memo`) se repinte siempre. Sólo
   * cambian cuando cambia `borrarUltima`, es decir, el blanco o los firmados.
   */
  const accionesDe = useMemo(
    () =>
      new Map(
        participants.map((p) => [
          p.id,
          { seleccionar: () => setSeleccionado(p.id), borrar: () => borrarUltima(p.id) },
        ]),
      ),
    [participants, borrarUltima],
  );

  const puedeContinuar = faltantes.length === 0;

  // «2 flechas · Jabalí · 1 de 6» (`F-2`): lo que hay que leer al llegar al puesto.
  const linea = [
    `${target.arrows} ${target.arrows === 1 ? 'flecha' : 'flechas'}`,
    target.description,
    totalDeBlancos ? `${target.index} de ${totalDeBlancos}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pantalla>
      <Encabezado
        onVolver={onVolver}
        textoVolver="Blancos"
        {...(patrulla === undefined ? {} : { contexto: `Patrulla ${patrulla}` })}
        {...(torneo === undefined ? {} : { titulo: torneo })}
      >
        <SyncBadge />
      </Encabezado>

      <Screen>
        {/*
          El encabezado del blanco (`REF7-10` / `F-2`, `DISENO.md` §5.5): el número grande, que es lo
          primero que hay que leer, y al lado la modalidad en su chip y la línea. El «Blanco» va sólo
          para el lector de pantalla: el número solo no dice qué es.
        */}
        <div className="flex items-center gap-4 pt-3">
          {/*
            El título real va para el lector de pantalla («Blanco 1»); a la vista, el número grande.
            Un número solo no dice qué es, y «Blanco» en 56px no entra al lado de la modalidad.
          */}
          <h1 className="sr-only">Blanco {target.index}</h1>
          <span
            aria-hidden="true"
            data-numero-del-blanco
            className="font-display text-score font-extrabold leading-none"
          >
            {target.index}
          </span>
          <div className="flex flex-col items-start gap-1 min-w-0">
            <ChipModalidad modality={target.modality} />
            <p className="text-sm text-[var(--ink-muted)]">{linea}</p>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-[var(--danger)] text-sm">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {participants.map((p) => {
            const score = porParticipante.get(p.id);
            const acciones = accionesDe.get(p.id);
            return (
              <ArrowRow
                key={p.id}
                firstName={p.firstName}
                lastName={p.lastName}
                stake={p.stake}
                unit={p.unit}
                modality={target.modality}
                arrows={score?.arrows ?? []}
                total={score?.total ?? 0}
                arrowsPerTarget={target.arrows}
                seleccionado={p.id === seleccionado}
                onSelect={acciones?.seleccionar ?? NADA}
                onBorrarUltima={acciones?.borrar ?? NADA}
                firmado={firmados.has(p.id)}
              />
            );
          })}
        </div>
      </Screen>

      {/*
        El panel del teclado (`DISENO.md` §4.14): superficie, sombra `--shadow-dock` y «Continuar»
        adentro, debajo de la grilla. Antes el botón flotaba aparte, con doble margen.
      */}
      <div
        data-panel-teclado
        className="shrink-0 flex flex-col gap-2 px-3 pt-2 pb-3 rounded-t-[var(--radius-lg)] border-t bg-[var(--surface)] shadow-[var(--shadow-dock)]"
      >
        <ScoreKeypad
          modality={target.modality}
          bloqueado={firmados.has(seleccionado)}
          cargadas={cargadas}
          total={target.arrows}
          onToken={agregarFlecha}
        />

        <div>
          <Button ancho disabled={!puedeContinuar} onClick={onContinuar}>
            Continuar
          </Button>

          {!puedeContinuar && (
            <p className="pt-2 text-sm text-[var(--ink-muted)] text-center">
              {/* Se dice QUIÉN falta, no sólo que falta alguien. */}
              Falta cargar: {faltantes.map((p) => p.lastName).join(', ')}
            </p>
          )}
        </div>
      </div>
    </Pantalla>
  );
}
