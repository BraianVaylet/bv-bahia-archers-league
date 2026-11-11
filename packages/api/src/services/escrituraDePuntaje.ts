/**
 * Escribir el puntaje de un participante en un blanco, con el delta de sus rollups (`BE-25`).
 *
 * **Un solo camino para los dos que escriben puntajes**: el sync de WAFL (`syncService`) y la
 * corrección del admin contra la planilla de papel (`correccionService`). Si cada uno armara el
 * documento y el delta a su manera, un arreglo en uno no llegaría al otro, y los rollups del
 * participante —de los que salen podios y ranking— terminarían sumando distinto según quién anotó.
 *
 * No valida ni autoriza: eso es de quien llama. Recibe el cómputo **ya derivado por el servidor**
 * (`validateTargetScore`): nunca un total que haya mandado un cliente.
 */

import type { Modality } from '@bal/shared';
import { type ClientSession, ObjectId } from 'mongodb';
import type { ParticipantDoc, ScoreDoc, TargetDoc, TournamentDoc } from '../db/types.js';
import * as scoreRepo from '../repositories/scoreRepo.js';

type Computo = Pick<ScoreDoc, 'total' | 'innerCount' | 'xCount' | 'tenCount' | 'mCount'>;

const MODALIDADES_EN_CERO: Record<Modality, number> = {
  sala: 0,
  aire_libre: 0,
  campo: 0,
  '3d': 0,
};

/**
 * Lo que cambia en los rollups del participante al guardar un blanco.
 *
 * Es la diferencia contra lo que había: editar un blanco no debe sumar dos
 * veces, y sólo un blanco nuevo suma uno a `targetsCompleted`.
 */
function deltaDeRollup(computo: Computo, previo: ScoreDoc | null, modality: Modality) {
  const diferencia = (campo: keyof Computo) => computo[campo] - (previo?.[campo] ?? 0);

  return {
    total: diferencia('total'),
    innerCount: diferencia('innerCount'),
    xCount: diferencia('xCount'),
    tenCount: diferencia('tenCount'),
    mCount: diferencia('mCount'),
    targetsCompleted: previo ? 0 : 1,
    byModality: { ...MODALIDADES_EN_CERO, [modality]: diferencia('total') },
  };
}

export interface EscrituraDePuntaje {
  readonly torneo: TournamentDoc;
  readonly participante: ParticipantDoc;
  readonly blanco: TargetDoc;
  readonly arrows: readonly string[];
  readonly computo: Computo;
  /** Lo que había en ese blanco, o `null` si es la primera vez. */
  readonly existente: ScoreDoc | null;
  readonly clientUpdatedAt: Date;
  readonly lastOpId: string;
  /** Sólo en una corrección del admin (`BE-25`). */
  readonly correccion?: { readonly correctedBy: ObjectId; readonly correctedAt: Date };
}

/** Guarda el puntaje y aplica el delta a los rollups del participante, en la `session` dada. */
export async function escribirPuntaje(
  e: EscrituraDePuntaje,
  session: ClientSession,
): Promise<void> {
  const ahora = new Date();
  const doc: ScoreDoc = {
    _id: e.existente?._id ?? new ObjectId(),
    tournamentId: e.torneo._id,
    patrolId: e.participante.patrolId,
    participantId: e.participante._id,
    targetIndex: e.blanco.index,
    modality: e.blanco.modality,
    arrows: [...e.arrows],
    total: e.computo.total,
    innerCount: e.computo.innerCount,
    xCount: e.computo.xCount,
    tenCount: e.computo.tenCount,
    mCount: e.computo.mCount,
    clientUpdatedAt: e.clientUpdatedAt,
    lastOpId: e.lastOpId,
    createdAt: e.existente?.createdAt ?? ahora,
    updatedAt: ahora,
    // Una corrección anterior queda marcada aunque la siga otra: lo que importa es si el admin
    // tocó este blanco alguna vez.
    ...(e.correccion
      ? { correctedBy: e.correccion.correctedBy, correctedAt: e.correccion.correctedAt }
      : e.existente?.correctedAt
        ? { correctedBy: e.existente.correctedBy ?? null, correctedAt: e.existente.correctedAt }
        : {}),
  };

  await scoreRepo.upsertScore(doc, session);

  await scoreRepo.applyRollupDelta(
    e.participante._id,
    e.participante.total,
    deltaDeRollup(e.computo, e.existente, e.blanco.modality),
    e.torneo.maxPossibleScore,
    session,
  );
}
