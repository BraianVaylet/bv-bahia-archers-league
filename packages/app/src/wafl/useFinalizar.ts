/**
 * «Finalizar torneo» en un solo toque (`FE-44`).
 *
 * El cierre exige el outbox vacío (`OFFLINE_SYNC.md` §5.5) y, al terminar de firmar, la última
 * firma recién se encoló: el primer toque **siempre** chocaba. Ahora el toque pide el cierre y, si
 * falta enviar, se queda esperando: cuando el outbox se vacía, lo encola solo. §5.5 no cambia —el
 * `close` nunca se encola con ops pendientes—; cambia que nadie tiene que volver a tocar.
 *
 * Mira el estado del sync worker, no lo maneja: lo empuja con `nudge` y nunca espera la red desde
 * el handler del toque.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { readSignatures } from '../offline/db.js';
import { requestClose } from '../offline/outbox.js';
import { getSyncState, nudge, subscribe } from '../offline/syncWorker.js';

export type Finalizacion =
  /** Nada en curso: el botón dice «Finalizar torneo». */
  | { readonly fase: 'quieto' }
  /** Enviando lo pendiente; al terminar, se finaliza solo. */
  | { readonly fase: 'enviando'; readonly pendientes: number }
  /** El envío falló (sin señal, servidor caído). Se sigue esperando: si vuelve la señal, finaliza. */
  | { readonly fase: 'trabado'; readonly pendientes: number; readonly motivo: string };

export interface OpcionesDeFinalizar {
  readonly participantes: readonly { readonly id: string; readonly lastName: string }[];
  readonly onCerrado: () => void;
  /**
   * El servidor rechazó una firma mientras se enviaba. No se finaliza: la pantalla tiene que volver
   * a leer las firmas para ofrecer firmar otra vez, y mostrar el aviso.
   */
  readonly onFirmaRechazada: (aviso: string) => void;
}

const QUIETO: Finalizacion = { fase: 'quieto' };

export function useFinalizar({ participantes, onCerrado, onFirmaRechazada }: OpcionesDeFinalizar) {
  const [estado, setEstado] = useState<Finalizacion>(QUIETO);

  // Los callbacks de la pantalla cambian en cada render; la espera los lee al momento de usarlos.
  const props = useRef({ participantes, onCerrado, onFirmaRechazada });
  props.current = { participantes, onCerrado, onFirmaRechazada };

  /**
   * Un intento a la vez. Si llega otro pedido mientras corre uno —el outbox se vació justo en el
   * medio—, se repite al terminar: descartarlo dejaría la pantalla esperando un aviso que ya pasó.
   */
  const corriendo = useRef(false);
  const otraVez = useRef(false);

  const intentar = useCallback(async (): Promise<void> => {
    if (corriendo.current) {
      otraVez.current = true;
      return;
    }
    corriendo.current = true;

    try {
      do {
        otraVez.current = false;

        // Una firma rechazada no es una firma: cerrar así sería que el servidor rechace el cierre.
        const rechazadas = (await readSignatures()).filter((f) => f.syncState === 'conflict');
        if (rechazadas.length > 0) {
          const nombres = rechazadas
            .map(
              (f) =>
                props.current.participantes.find((p) => p.id === f.participantId)?.lastName ??
                'un arquero',
            )
            .join(', ');
          setEstado(QUIETO);
          props.current.onFirmaRechazada(
            `No se pudo enviar la firma de ${nombres}. Tiene que volver a firmar para finalizar.`,
          );
          return;
        }

        const r = await requestClose();
        if (r.ok) {
          setEstado(QUIETO);
          nudge();
          props.current.onCerrado();
          return;
        }

        setEstado((previo) =>
          previo.fase === 'trabado'
            ? { ...previo, pendientes: r.pending }
            : { fase: 'enviando', pendientes: r.pending },
        );
      } while (otraVez.current);
    } finally {
      corriendo.current = false;
    }
  }, []);

  /**
   * Los envíos fallidos ya contados. Se toma **al tocar**, antes de empujar el envío: sin señal, el
   * primer intento puede fallar antes de que la espera se suscriba, y si la línea base se tomara
   * ahí, ese fallo quedaría adentro y la pantalla seguiría diciendo «Sincronizando…».
   */
  const fallosVistos = useRef(0);

  const esperando = estado.fase !== 'quieto';

  // Mientras se espera: cada cambio del sync worker puede ser el que vacía el outbox.
  useEffect(() => {
    if (!esperando) return;

    return subscribe((sync) => {
      // Un fallo cuenta una sola vez; si no, después de «Reintentar» cualquier aviso lo trabaría.
      const fallosAntes = fallosVistos.current;
      fallosVistos.current = sync.intentosFallidos;

      if (sync.pending === 0) {
        void intentar();
        return;
      }

      const fallo =
        sync.status === 'offline' || sync.status === 'error' || sync.intentosFallidos > fallosAntes;

      if (!fallo) {
        setEstado((previo) =>
          previo.fase === 'enviando' ? { ...previo, pendientes: sync.pending } : previo,
        );
        return;
      }

      // `requestClose` con pendientes no encola nada: devuelve el motivo, dicho para el líder.
      void requestClose().then((r) => {
        if (r.ok) return; // Inalcanzable con pendientes; si pasara, la próxima vuelta lo resuelve.
        setEstado((previo) =>
          previo.fase === 'quieto'
            ? previo
            : { fase: 'trabado', pendientes: r.pending, motivo: r.message },
        );
      });
    });
  }, [esperando, intentar]);

  /** El toque de «Finalizar torneo». */
  const finalizar = useCallback(() => {
    fallosVistos.current = getSyncState().intentosFallidos;
    void intentar().then(() => nudge());
  }, [intentar]);

  /** El toque de «Reintentar»: vuelve a empujar el envío. La espera sigue. */
  const reintentar = useCallback(() => {
    fallosVistos.current = getSyncState().intentosFallidos;
    setEstado((previo) =>
      previo.fase === 'trabado' ? { fase: 'enviando', pendientes: previo.pendientes } : previo,
    );
    nudge();
  }, []);

  return { estado, finalizar, reintentar };
}
