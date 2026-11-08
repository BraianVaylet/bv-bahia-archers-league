/**
 * Los datos de la pantalla de un torneo (`REF6-11` / `C-1`, `C-2`).
 *
 * Eran cuatro pedidos, un `useState` por cada uno, una carga a mano con un `try/catch`
 * y un `useRef` para que el refresco no se pisara solo. Todo eso es lo que hace
 * `useCarga`: acá sólo se dice **qué** se pide.
 */

import { useCarga } from '@bal/cliente';
import type { SCORING, TournamentStatus } from '@bal/shared';
import { conSenal, cuerpo, rpc } from '../../lib/rpc.js';
import type { PatrullaSeguimiento, ResultadoParticipante } from '../torneo.js';

export interface Torneo {
  readonly id: string;
  readonly name: string;
  readonly date: string;
  readonly status: TournamentStatus;
  readonly targets: readonly { index: number; modality: keyof typeof SCORING; arrows: number }[];
  readonly maxPossibleScore: number;
  readonly participantCount: number;
}

interface DatosDelTorneo {
  readonly torneo: Torneo;
  readonly patrullas: PatrullaSeguimiento[];
  readonly participantes: ResultadoParticipante[];
  readonly bloqueados: number[];
}

const SIN_PATRULLAS: PatrullaSeguimiento[] = [];
const SIN_PARTICIPANTES: ResultadoParticipante[] = [];
const SIN_BLOQUEOS: number[] = [];

export function useTorneo(id: string) {
  const carga = useCarga(
    async (signal): Promise<DatosDelTorneo> => {
      // Sin `?pins=1`: el seguimiento no necesita los PIN, y pedirlos los descifraba y los
      // registraba en el audit log en cada vuelta.
      const param = { id };
      const [t, p, r, b] = await Promise.all([
        cuerpo(rpc.admin.tournaments[':id'].$get({ param }, conSenal(signal))),
        cuerpo(rpc.admin.tournaments[':id'].patrols.$get({ param, query: {} }, conSenal(signal))),
        cuerpo(rpc.admin.tournaments[':id'].results.$get({ param }, conSenal(signal))),
        cuerpo(rpc.admin.tournaments[':id']['locked-targets'].$get({ param }, conSenal(signal))),
      ]);

      return {
        torneo: t.tournament,
        patrullas: p.patrols,
        participantes: r.participants,
        bloqueados: b.lockedTargets,
      };
    },
    [id],
    { mensajeDeError: 'No se pudo cargar el torneo. Revisá la conexión.' },
  );

  return {
    torneo: carga.datos?.torneo,
    patrullas: carga.datos?.patrullas ?? SIN_PATRULLAS,
    participantes: carga.datos?.participantes ?? SIN_PARTICIPANTES,
    bloqueados: carga.datos?.bloqueados ?? SIN_BLOQUEOS,
    error: carga.error,
    recargar: carga.recargar,
  };
}
