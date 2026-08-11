/**
 * Acceso a `scores`, `participants` y `syncOps`.
 */

import type { ClientSession, ObjectId } from 'mongodb';
import { participants, scores, syncOps } from '../db/client.js';
import type { ParticipantDoc, ScoreDoc, SyncOpDoc, SyncOpResult, SyncOpType } from '../db/types.js';
import { sha256 } from '../lib/crypto.js';

// ── Puntajes ─────────────────────────────────────────────────────────────────

export function findScore(
  participantId: ObjectId,
  targetIndex: number,
  session?: ClientSession,
): Promise<ScoreDoc | null> {
  return scores().findOne({ participantId, targetIndex }, session ? { session } : {});
}

export function listScoresOfPatrol(patrolId: ObjectId): Promise<ScoreDoc[]> {
  return scores().find({ patrolId }).toArray();
}

export async function upsertScore(doc: ScoreDoc, session: ClientSession): Promise<void> {
  await scores().replaceOne(
    { participantId: doc.participantId, targetIndex: doc.targetIndex },
    doc,
    { upsert: true, session },
  );
}

export async function countScoresOfTarget(
  tournamentId: ObjectId,
  targetIndex: number,
): Promise<number> {
  return scores().countDocuments({ tournamentId, targetIndex }, { limit: 1 });
}

// ── Participantes ────────────────────────────────────────────────────────────

export function findParticipant(
  id: ObjectId,
  session?: ClientSession,
): Promise<ParticipantDoc | null> {
  return participants().findOne({ _id: id }, session ? { session } : {});
}

/**
 * Aplica el delta a los rollups del participante.
 *
 * Se hace **por delta y en la misma transacción que el puntaje**: es lo que
 * permite que podios y estadísticas no tengan que recorrer flechas.
 * Ver `docs/ARCHITECTURE.md` §5, decisión 3.
 */
export async function applyRollupDelta(
  participantId: ObjectId,
  delta: {
    total: number;
    innerCount: number;
    xCount: number;
    tenCount: number;
    mCount: number;
    targetsCompleted: number;
    byModality: Record<string, number>;
  },
  maxPossibleScore: number,
  session: ClientSession,
): Promise<void> {
  const inc: Record<string, number> = {
    total: delta.total,
    innerCount: delta.innerCount,
    xCount: delta.xCount,
    tenCount: delta.tenCount,
    mCount: delta.mCount,
    targetsCompleted: delta.targetsCompleted,
  };

  for (const [modalidad, valor] of Object.entries(delta.byModality)) {
    if (valor !== 0) inc[`byModality.${modalidad}`] = valor;
  }

  const doc = await participants().findOneAndUpdate(
    { _id: participantId },
    { $inc: inc, $set: { updatedAt: new Date() } },
    { returnDocument: 'after', session },
  );

  if (doc && maxPossibleScore > 0) {
    await participants().updateOne(
      { _id: participantId },
      { $set: { normalizedPct: Math.round((doc.total / maxPossibleScore) * 10_000) / 100 } },
      { session },
    );
  }
}

/**
 * Hash del scorecard de un participante al momento de llamarlo.
 *
 * Vive acá, y no en el servicio, porque lo usan **dos** caminos: firmar desde
 * WAFL y desbloquear desde WAFA. Dos implementaciones que tuvieran que dar el
 * mismo resultado serían un bug esperando a pasar.
 *
 * Ver `docs/SECURITY.md` §7.
 */
export async function scorecardHashOf(participante: ParticipantDoc): Promise<string> {
  const propios = (await scores().find({ participantId: participante._id }).toArray())
    .sort((a, b) => a.targetIndex - b.targetIndex)
    .map((s) => ({ t: s.targetIndex, a: s.arrows, total: s.total }));

  return sha256(
    JSON.stringify({
      participantId: participante._id.toHexString(),
      scores: propios,
      total: participante.total,
    }),
  );
}

export async function setSignature(
  participantId: ObjectId,
  signature: ParticipantDoc['signature'],
  session: ClientSession,
): Promise<void> {
  await participants().updateOne(
    { _id: participantId },
    { $set: { signature, updatedAt: new Date() } },
    { session },
  );
}

// ── Idempotencia ─────────────────────────────────────────────────────────────

/** Días que se conserva el registro de una op antes de que el TTL la borre. */
const RETENCION_DIAS = 7;

/**
 * Registra la operación.
 *
 * @returns `false` si el `opId` ya estaba registrado — es decir, si es un
 *   reenvío. **Deduplicar es un insert que falla con `E11000`**, sin `findOne`
 *   previo: el índice único hace el trabajo y no hay ventana de carrera.
 */
export async function claimOp(
  opId: string,
  patrolId: ObjectId,
  type: SyncOpType,
  result: SyncOpResult,
): Promise<boolean> {
  try {
    await syncOps().insertOne({
      _id: opId,
      patrolId,
      type,
      appliedAt: new Date(),
      result,
      expiresAt: new Date(Date.now() + RETENCION_DIAS * 86_400_000),
    } as SyncOpDoc);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('E11000')) return false;
    throw error;
  }
}

/** Deja registrado cómo terminó la op, para responder igual ante un reenvío. */
export async function markOpResult(opId: string, result: SyncOpResult): Promise<void> {
  await syncOps().updateOne({ _id: opId }, { $set: { result } });
}

/** Suelta la marca para que un reintento pueda volver a entrar. */
export async function releaseOp(opId: string): Promise<void> {
  await syncOps().deleteOne({ _id: opId });
}

export function findOp(opId: string): Promise<SyncOpDoc | null> {
  return syncOps().findOne({ _id: opId });
}
