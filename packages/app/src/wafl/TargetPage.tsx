/**
 * Página de blanco: donde se anota.
 *
 * **Lee de IndexedDB, nunca de una respuesta HTTP.** Cada toque guarda al
 * instante y sigue. No hay botón de guardar y no hay espera de red.
 *
 * Ver `docs/FUNCTIONAL.md` §7.3 y `docs/OFFLINE_SYNC.md` §1.
 */

import type { Modality } from '@bal/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Encabezado, Screen } from '../components/ui.js';
import type { BundleParticipant, BundleTarget, StoredScore } from '../offline/db.js';
import { readScore, readScores } from '../offline/db.js';
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
}

const ETIQUETA_MODALIDAD: Record<Modality, string> = {
  sala: 'Sala 18 m',
  aire_libre: 'Aire libre',
  campo: 'Juego de campo',
  '3d': '3D',
};

export function TargetPage({ target, participants, onContinuar, onVolver }: TargetPageProps) {
  const [scores, setScores] = useState<StoredScore[]>([]);
  const [seleccionado, setSeleccionado] = useState(participants[0]?.id ?? '');
  const [error, setError] = useState<string>();

  // Toda la lectura sale de IndexedDB. Si no hay red, no cambia nada.
  const recargar = useCallback(async () => {
    setScores((await readScores()).filter((s) => s.targetIndex === target.index));
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
      if (!seleccionado) return;

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
          const todos = await readScores();
          const deEsteBlanco = new Map(
            todos.filter((s) => s.targetIndex === target.index).map((s) => [s.participantId, s]),
          );

          const siguiente = participants.find(
            (p) =>
              p.id !== seleccionado && (deEsteBlanco.get(p.id)?.arrows.length ?? 0) < target.arrows,
          );
          if (siguiente) setSeleccionado(siguiente.id);
        }
      });
    },
    [encolar, participants, recargar, seleccionado, target.arrows, target.index],
  );

  const borrarUltima = useCallback(
    (participantId: string) => {
      encolar(async () => {
        const score = await readScore(participantId, target.index);
        if (!score || score.arrows.length === 0) return;

        await writeScore(participantId, target.index, score.arrows.slice(0, -1));
        await recargar();
        nudge();
      });
    },
    [encolar, recargar, target.index],
  );

  const puedeContinuar = faltantes.length === 0;

  return (
    <div className="flex flex-col min-h-dvh">
      <Encabezado onVolver={onVolver} textoVolver="← Blancos">
        <SyncBadge />
      </Encabezado>

      <Screen conBarraFija>
        <div className="flex items-baseline gap-3 pt-2">
          <h1 className="font-[var(--font-display)] text-[var(--text-display)] font-bold">
            Blanco {target.index}
          </h1>
          <p className="text-[var(--ink-muted)]">
            {ETIQUETA_MODALIDAD[target.modality]} · {target.arrows}{' '}
            {target.arrows === 1 ? 'flecha' : 'flechas'}
          </p>
        </div>

        {target.description && <p className="text-[var(--ink-muted)]">{target.description}</p>}

        {error && (
          <p role="alert" className="text-[var(--danger)] text-sm">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {participants.map((p) => {
            const score = porParticipante.get(p.id);
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
                onSelect={() => setSeleccionado(p.id)}
                onBorrarUltima={() => borrarUltima(p.id)}
              />
            );
          })}
        </div>
      </Screen>

      <div className="sticky bottom-0 mt-auto flex flex-col gap-2">
        <ScoreKeypad
          modality={target.modality}
          cargadas={cargadas}
          total={target.arrows}
          onToken={agregarFlecha}
        />

        <div className="px-4 pb-4">
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
    </div>
  );
}
