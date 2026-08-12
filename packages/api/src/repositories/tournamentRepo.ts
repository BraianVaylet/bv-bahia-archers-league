/**
 * Acceso a `tournaments`, `patrols` y `participants`.
 *
 * Las funciones que participan de una transacción reciben la `ClientSession`:
 * sin pasarla, la escritura queda **fuera** de la transacción y el rollback no
 * la alcanza. Es el error más fácil de cometer con el driver de Mongo.
 */

import type { Position, TournamentStatus, Unit } from '@bal/shared';
import type { ClientSession, ObjectId } from 'mongodb';
import { participants, patrols, tournaments } from '../db/client.js';
import type { ParticipantDoc, PatrolDoc, TournamentDoc } from '../db/types.js';

// ── Torneos ──────────────────────────────────────────────────────────────────

export async function insert(doc: TournamentDoc, session?: ClientSession): Promise<ObjectId> {
  const { insertedId } = await tournaments().insertOne(doc, session ? { session } : {});
  return insertedId;
}

export function findById(id: ObjectId): Promise<TournamentDoc | null> {
  return tournaments().findOne({ _id: id });
}

export interface ListFilter {
  readonly status?: TournamentStatus;
  readonly seasonId?: ObjectId;
}

export function list(filter: ListFilter = {}): Promise<TournamentDoc[]> {
  const q: Record<string, unknown> = {};
  if (filter.status) q.status = filter.status;
  if (filter.seasonId) q.seasonId = filter.seasonId;

  return tournaments().find(q).sort({ date: -1 }).limit(200).toArray();
}

export async function remove(id: ObjectId, session?: ClientSession): Promise<void> {
  const opts = session ? { session } : {};
  await tournaments().deleteOne({ _id: id }, opts);
  await patrols().deleteMany({ tournamentId: id }, opts);
  await participants().deleteMany({ tournamentId: id }, opts);
}

// ── Patrullas ────────────────────────────────────────────────────────────────

export async function insertPatrols(
  docs: readonly PatrolDoc[],
  session?: ClientSession,
): Promise<void> {
  if (docs.length === 0) return;
  await patrols().insertMany([...docs], session ? { session } : {});
}

export function listPatrols(tournamentId: ObjectId): Promise<PatrolDoc[]> {
  return patrols().find({ tournamentId }).sort({ number: 1 }).toArray();
}

export function findPatrolByUsername(
  tournamentId: ObjectId,
  username: string,
): Promise<PatrolDoc | null> {
  return patrols().findOne({ tournamentId, username });
}

// ── Participantes ────────────────────────────────────────────────────────────

export async function insertParticipants(
  docs: readonly ParticipantDoc[],
  session?: ClientSession,
): Promise<void> {
  if (docs.length === 0) return;
  await participants().insertMany([...docs], session ? { session } : {});
}

export function listParticipants(tournamentId: ObjectId): Promise<ParticipantDoc[]> {
  return participants().find({ tournamentId }).toArray();
}

export function listParticipantsOfPatrol(
  patrolId: ObjectId,
  session?: ClientSession,
): Promise<ParticipantDoc[]> {
  return participants()
    .find({ patrolId }, session ? { session } : {})
    .toArray();
}

/**
 * Reubica a un participante en otra patrulla, unidad y posición.
 *
 * **No toca su snapshot ni sus rollups**: es la misma persona con el mismo
 * puntaje, sentada en otro lado. Ver `docs/FUNCTIONAL.md` §6.6.
 */
export async function reassignParticipant(
  participantId: ObjectId,
  destino: { patrolId: ObjectId; unit: Unit; position: Position },
  session?: ClientSession,
): Promise<void> {
  await participants().updateOne(
    { _id: participantId },
    {
      $set: {
        patrolId: destino.patrolId,
        unit: destino.unit,
        position: destino.position,
        updatedAt: new Date(),
      },
    },
    session ? { session } : {},
  );
}
