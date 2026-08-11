/**
 * Recalcula los rollups de `participants` desde `scores`.
 *
 * Los rollups se mantienen por delta dentro de la transacción del puntaje, que
 * es lo que hace que podios y estadísticas no recorran flechas. El precio es
 * que un bug o una intervención manual pueden desalinearlos. Esto es la red de
 * seguridad: recomputa la verdad desde los datos crudos.
 *
 * Ver `docs/ARCHITECTURE.md` §5, decisión 3.
 */

import type { Modality } from '@bal/shared';
import type { Db, Filter, ObjectId } from 'mongodb';
import { COLLECTIONS, type ParticipantDoc, type ScoreDoc, type TournamentDoc } from './types.js';

export interface ReconcileResult {
  readonly participantsChecked: number;
  readonly participantsFixed: number;
  readonly details: readonly {
    participantId: string;
    campo: string;
    antes: number;
    despues: number;
  }[];
}

const MODALIDADES_EN_CERO: Record<Modality, number> = {
  sala: 0,
  aire_libre: 0,
  campo: 0,
  '3d': 0,
};

/** Los campos denormalizados que este comando recomputa. */
interface Rollups {
  total: number;
  innerCount: number;
  xCount: number;
  tenCount: number;
  mCount: number;
  targetsCompleted: number;
  byModality: Record<Modality, number>;
}

/**
 * Recalcula y corrige los rollups.
 *
 * @param tournamentId si se omite, recorre todos los torneos.
 */
export async function reconcile(db: Db, tournamentId?: ObjectId): Promise<ReconcileResult> {
  const participants = db.collection<ParticipantDoc>(COLLECTIONS.participants);
  const scores = db.collection<ScoreDoc>(COLLECTIONS.scores);
  const tournaments = db.collection<TournamentDoc>(COLLECTIONS.tournaments);

  const filtro: Filter<ParticipantDoc> = tournamentId ? { tournamentId } : {};
  const todos = await participants.find(filtro).toArray();

  const maximos = new Map<string, number>();
  const details: { participantId: string; campo: string; antes: number; despues: number }[] = [];
  let fixed = 0;

  for (const participante of todos) {
    const propios = await scores.find({ participantId: participante._id }).toArray();

    const calculado: Rollups = {
      total: 0,
      innerCount: 0,
      xCount: 0,
      tenCount: 0,
      mCount: 0,
      targetsCompleted: propios.length,
      byModality: { ...MODALIDADES_EN_CERO },
    };

    for (const s of propios) {
      calculado.total += s.total;
      calculado.innerCount += s.innerCount;
      calculado.xCount += s.xCount;
      calculado.tenCount += s.tenCount;
      calculado.mCount += s.mCount;
      calculado.byModality[s.modality] += s.total;
    }

    const clave = participante.tournamentId.toHexString();
    let maximo = maximos.get(clave);
    if (maximo === undefined) {
      const torneo = await tournaments.findOne({ _id: participante.tournamentId });
      maximo = torneo?.maxPossibleScore ?? 0;
      maximos.set(clave, maximo);
    }

    const normalizedPct = maximo > 0 ? (calculado.total / maximo) * 100 : 0;

    const diferencias: [string, number, number][] = [
      ['total', participante.total, calculado.total],
      ['innerCount', participante.innerCount, calculado.innerCount],
      ['xCount', participante.xCount, calculado.xCount],
      ['tenCount', participante.tenCount, calculado.tenCount],
      ['mCount', participante.mCount, calculado.mCount],
      ['targetsCompleted', participante.targetsCompleted, calculado.targetsCompleted],
      ['normalizedPct', participante.normalizedPct, normalizedPct],
    ].filter(([, antes, despues]) => antes !== despues) as [string, number, number][];

    if (diferencias.length === 0) continue;

    for (const [campo, antes, despues] of diferencias) {
      details.push({ participantId: participante._id.toHexString(), campo, antes, despues });
    }

    await participants.updateOne(
      { _id: participante._id },
      { $set: { ...calculado, normalizedPct, updatedAt: new Date() } },
    );
    fixed++;
  }

  return { participantsChecked: todos.length, participantsFixed: fixed, details };
}
