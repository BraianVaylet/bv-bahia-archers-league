/**
 * Acceso a `scores`, `participants` y `syncOps`.
 */

import type { ClientSession, ObjectId } from 'mongodb';
import { participants, scores, syncOps } from '../db/client.js';
import type { ParticipantDoc, ScoreDoc, SyncOpDoc, SyncOpResult, SyncOpType } from '../db/types.js';
import { sha256 } from '../lib/crypto.js';
import { esClaveDuplicada } from '../lib/errors.js';

// ── Puntajes ─────────────────────────────────────────────────────────────────

export function findScore(
  participantId: ObjectId,
  targetIndex: number,
  session?: ClientSession,
): Promise<ScoreDoc | null> {
  return scores().findOne({ participantId, targetIndex }, session ? { session } : {});
}

export function listScoresOfPatrol(
  patrolId: ObjectId,
  session?: ClientSession,
): Promise<ScoreDoc[]> {
  return scores()
    .find({ patrolId }, session ? { session } : {})
    .toArray();
}

/** Todos los puntajes de un arquero en un torneo: uno por blanco tirado. */
export function listScoresOfParticipant(participantId: ObjectId): Promise<ScoreDoc[]> {
  return scores().find({ participantId }).sort({ targetIndex: 1 }).toArray();
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

/**
 * Cuántos puntajes tiene el torneo entero.
 *
 * Sin `limit`: el número se le muestra al admin para explicarle por qué no
 * puede volver atrás, y «ya hay puntajes» dice menos que «ya hay 3 puntajes».
 */
export async function countScoresOfTournament(tournamentId: ObjectId): Promise<number> {
  return scores().countDocuments({ tournamentId });
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
 *
 * **Una sola escritura.** `normalizedPct` sale del total que quien llama ya leyó
 * dentro de esta misma transacción (`totalPrevio`) más el delta, en vez de releer
 * el documento para calcularlo: era un comando más por op, y cada comando es una
 * ida y vuelta a la base (`REF6-5`). Es seguro: dos transacciones que tocan al
 * mismo arquero modifican el mismo documento, y la segunda en commitear recibe un
 * `WriteConflict` y se reintenta entera, releyendo el total.
 */
export async function applyRollupDelta(
  participantId: ObjectId,
  totalPrevio: number,
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

  const set: Record<string, number | Date> = { updatedAt: new Date() };
  if (maxPossibleScore > 0) {
    set.normalizedPct = Math.round(((totalPrevio + delta.total) / maxPossibleScore) * 10_000) / 100;
  }

  await participants().updateOne({ _id: participantId }, { $inc: inc, $set: set }, { session });
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
): Promise<boolean> {
  try {
    await syncOps().insertOne({
      _id: opId,
      patrolId,
      type,
      appliedAt: new Date(),
      // `processing`, no `applied`: todavía no se aplicó nada (`REF6-13` / `B-4`).
      result: 'processing',
      expiresAt: new Date(Date.now() + RETENCION_DIAS * 86_400_000),
    } as SyncOpDoc);
    return true;
  } catch (error) {
    if (esClaveDuplicada(error)) return false;
    throw error;
  }
}

/**
 * Cuánto puede estar una op en `processing` antes de darla por abandonada (`REF6-13` / `B-4`).
 *
 * Una op tarda segundos, no medio minuto: si pasó este tiempo, el proceso que la marcó murió.
 */
export const PLAZO_DE_REPROCESO_MS = 30_000;

/**
 * Toma una op que quedó en `processing` hace más del plazo, para reprocesarla.
 *
 * Es **atómico**: renueva la hora en el mismo comando que la busca, así que dos reintentos
 * simultáneos no la toman los dos. Sólo la retoma la patrulla que la marcó: el `opId` de otra no.
 *
 * @returns `true` si la op es ahora de quien llama.
 */
export async function retomarOp(opId: string, patrolId: ObjectId): Promise<boolean> {
  const retomada = await syncOps().findOneAndUpdate(
    {
      _id: opId,
      patrolId,
      result: 'processing',
      appliedAt: { $lt: new Date(Date.now() - PLAZO_DE_REPROCESO_MS) },
    },
    { $set: { appliedAt: new Date() } },
  );
  return retomada !== null;
}

/**
 * Deja registrado cómo terminó la op, para responder igual ante un reenvío.
 *
 * Con `session`, forma parte de la transacción: la marca y el efecto de la op se confirman o se
 * revierten juntos.
 */
export async function markOpResult(
  opId: string,
  result: SyncOpResult,
  session?: ClientSession,
): Promise<void> {
  await syncOps().updateOne({ _id: opId }, { $set: { result } }, session ? { session } : {});
}

/**
 * Confirma como aplicadas las ops de un lote, **en un solo comando**.
 *
 * Hacerlo op por op sumaba una ida y vuelta a la base por cada score (`REF6-5`). Un score
 * aplicado cuya marca sigue en `processing` es inocuo: pasado el plazo se reprocesa, y volver a
 * aplicar el mismo puntaje no cambia nada.
 */
export async function confirmarOps(opIds: readonly string[]): Promise<void> {
  if (opIds.length === 0) return;
  await syncOps().updateMany(
    { _id: { $in: [...opIds] }, result: 'processing' },
    { $set: { result: 'applied' } },
  );
}

/** Suelta la marca para que un reintento pueda volver a entrar. */
export async function releaseOp(opId: string): Promise<void> {
  await syncOps().deleteOne({ _id: opId });
}

export function findOp(opId: string): Promise<SyncOpDoc | null> {
  return syncOps().findOne({ _id: opId });
}
