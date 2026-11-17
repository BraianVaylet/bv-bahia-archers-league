/**
 * Página de blanco: donde se anota.
 *
 * **Lee de IndexedDB, nunca de una respuesta HTTP.** Cada toque guarda al
 * instante y sigue. No hay botón de guardar y no hay espera de red.
 *
 * Ver `docs/FUNCTIONAL.md` §7.3 y `docs/OFFLINE_SYNC.md` §1.
 */

import { type Modality, tokenValue } from '@bal/shared';
import { ChipModalidad, useTituloDePagina } from '@bal/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Encabezado, Pantalla, Screen } from '../components/ui.js';
import { useWakeLock } from '../lib/useWakeLock.js';
import type { BundleParticipant, BundleTarget } from '../offline/db.js';
import { readScore, readScoresDeBlanco, readSignatures } from '../offline/db.js';
import { writeScore } from '../offline/outbox.js';
import { nudge } from '../offline/syncWorker.js';
import { ArrowRow } from './ArrowRow.js';
import { aplicarBorrado, aplicarToque, type EstadoDeAnotacion } from './anotacion.js';
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
const SIN_FLECHAS: readonly string[] = [];

/**
 * El acumulado que se ve mientras se anota: la suma de los valores de la modalidad, como el
 * parcial que guarda `writeScore`. Sólo para mostrar; el total oficial lo deriva el servidor.
 */
const totalParcial = (modality: Modality, flechas: readonly string[]) =>
  flechas.reduce((n, token) => n + tokenValue(modality, token), 0);

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
  const [firmados, setFirmados] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string>();
  /** Si la primera lectura de IndexedDB ya terminó. Antes, los totales no son «cero»: son «no sé». */
  const [leido, setLeido] = useState(false);

  /**
   * **Lo que se ve sale del toque, no de releer la base** (`FE-45`).
   *
   * Antes cada toque esperaba 4-5 operaciones de IndexedDB para pintarse, y el paso al siguiente
   * arquero ocurría al final de esa cadena: los toques del medio iban al arquero ya completo y se
   * descartaban sin decir nada. Ahora el toque actualiza la pantalla y decide a quién va en el
   * mismo instante; la escritura sigue en la cola, IndexedDB sigue siendo la fuente de verdad, y
   * cuando la cola se vacía la pantalla se vuelve a leer de ahí.
   *
   * El `ref` es lo que leen los toques: dos toques seguidos llegan antes de que React repinte, y
   * con el estado del render el segundo vería las flechas de antes del primero.
   */
  const [vista, setVista] = useState<EstadoDeAnotacion>(() => ({
    flechas: new Map(),
    seleccionado: participants[0]?.id ?? '',
  }));
  const vistaRef = useRef(vista);
  const mostrar = useCallback((siguiente: EstadoDeAnotacion) => {
    vistaRef.current = siguiente;
    setVista(siguiente);
  }, []);

  /** Escrituras encoladas que todavía no terminaron. Con alguna en camino, la base está atrasada. */
  const enCamino = useRef(0);
  /**
   * Sube con cada toque o borrado. Una lectura que empezó antes del último toque está vieja aunque
   * termine después: la lectura inicial, lanzada al abrir el blanco, podía llegar **después** de la
   * relectura que sigue al primer toque y borrar esa flecha de la pantalla. Lo encontró un test
   * intermitente (`FE-44`).
   */
  const version = useRef(0);

  // Toda la lectura sale de IndexedDB. Si no hay red, no cambia nada.
  const recargar = useCallback(async () => {
    const desde = version.current;
    const [deEsteBlanco, firmas] = await Promise.all([
      readScoresDeBlanco(target.index),
      readSignatures(),
    ]);
    // Si no cambió quién firmó, se conserva el mismo `Set`: uno nuevo en cada lectura cambiaría la
    // identidad de los callbacks de todas las filas y las repintaría (`REF6-14` / `P-7`).
    setFirmados((previo) => {
      const ahora = new Set(firmas.map((f) => f.participantId));
      return ahora.size === previo.size && [...ahora].every((id) => previo.has(id))
        ? previo
        : ahora;
    });

    // Un toque llegó mientras se leía: lo leído no lo tiene. Lo trae la lectura de cuando la
    // cola se vacíe; pisar ahora borraría de la pantalla una flecha que ya se tocó.
    // Y si hubo un toque después de empezar a leer, esta lectura ya no es la última.
    if (enCamino.current > 0 || version.current !== desde) return;
    mostrar({
      ...vistaRef.current,
      flechas: new Map(deEsteBlanco.map((s) => [s.participantId, s.arrows])),
    });
    setLeido(true);
  }, [mostrar, target.index]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const { flechas, seleccionado } = vista;
  const cuantasDe = (id: string) => flechas.get(id)?.length ?? 0;

  const faltantes = participants.filter((p) => cuantasDe(p.id) < target.arrows);
  const cargadas = cuantasDe(seleccionado);

  /**
   * Cola de escrituras.
   *
   * Cada escritura se encadena y lee de IndexedDB, que es la fuente de verdad: dos toques
   * seguidos no se pisan. Al vaciarse, la pantalla se relee de la base.
   */
  const cola = useRef<Promise<unknown>>(Promise.resolve());

  const encolar = useCallback(
    (fn: () => Promise<void>): void => {
      enCamino.current++;
      version.current++;
      const correr = async () => {
        try {
          await fn();
        } finally {
          enCamino.current--;
          if (enCamino.current === 0) await recargar();
        }
      };
      cola.current = cola.current.then(correr, correr);
    },
    [recargar],
  );

  const contexto = useMemo(
    () => ({
      participantes: participants.map((p) => p.id),
      flechasPorBlanco: target.arrows,
      firmados,
    }),
    [participants, target.arrows, firmados],
  );

  const agregarFlecha = useCallback(
    (token: string) => {
      // Firmado no se toca (`aplicarToque` lo rechaza): la firma guarda un hash del puntaje del
      // momento, y editarlo después hace que el servidor rechace el cierre. Completo, tampoco: el
      // teclado ya lo dice («Ya cargaste las N flechas»).
      const r = aplicarToque(vistaRef.current, token, contexto);
      if (!r.ok) return;
      mostrar(r.estado);

      const { destinatario } = r;
      encolar(async () => {
        // Se lee de la base, no de la pantalla: es la fuente de verdad.
        const previo = await readScore(destinatario, target.index);
        const siguientes = [...(previo?.arrows ?? []), token];

        // La base tenía flechas que la pantalla no había visto. No se escribe y **se dice**: un
        // toque que desaparece sin aviso es justo lo que no puede pasar.
        if (siguientes.length > target.arrows) {
          const quien = participants.find((p) => p.id === destinatario);
          setError(
            `${quien?.lastName ?? 'Ese arquero'} ya tiene las ${target.arrows} flechas de este blanco.`,
          );
          return;
        }

        const w = await writeScore(destinatario, target.index, siguientes);
        if (!w.ok) {
          setError(w.message);
          return;
        }

        setError(undefined);
        // De fondo, y sólo si hay algo que mandar: un blanco a medias no encola nada.
        if (siguientes.length === target.arrows) nudge();
      });
    },
    [contexto, encolar, mostrar, participants, target.arrows, target.index],
  );

  const borrarUltima = useCallback(
    (participantId: string) => {
      if (firmados.has(participantId)) return;
      if ((vistaRef.current.flechas.get(participantId)?.length ?? 0) === 0) return;
      mostrar(aplicarBorrado(vistaRef.current, participantId));

      encolar(async () => {
        const score = await readScore(participantId, target.index);
        if (!score || score.arrows.length === 0) return;

        await writeScore(participantId, target.index, score.arrows.slice(0, -1));
        nudge();
      });
    },
    [encolar, firmados, mostrar, target.index],
  );

  const seleccionar = useCallback(
    (participantId: string) => mostrar({ ...vistaRef.current, seleccionado: participantId }),
    [mostrar],
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
          { seleccionar: () => seleccionar(p.id), borrar: () => borrarUltima(p.id) },
        ]),
      ),
    [participants, borrarUltima, seleccionar],
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
            const deEste = flechas.get(p.id) ?? SIN_FLECHAS;
            const acciones = accionesDe.get(p.id);
            return (
              <ArrowRow
                key={p.id}
                firstName={p.firstName}
                lastName={p.lastName}
                stake={p.stake}
                unit={p.unit}
                modality={target.modality}
                arrows={deEste}
                total={totalParcial(target.modality, deEste)}
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
        // Mientras se leen los puntajes guardados, lo que muestra la pantalla todavía no es real.
        aria-busy={!leido}
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
