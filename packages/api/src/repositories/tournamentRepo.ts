/**
 * Acceso a `tournaments`, `patrols` y `participants`.
 *
 * Las funciones que participan de una transacción reciben la `ClientSession`:
 * sin pasarla, la escritura queda **fuera** de la transacción y el rollback no
 * la alcanza. Es el error más fácil de cometer con el driver de Mongo.
 */

import type { Position, TournamentStatus, Unit } from '@bal/shared';
import type { ClientSession, ObjectId } from 'mongodb';
import { participants, patrols, scores, tournaments } from '../db/client.js';
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
 * Marca o desmarca el pago de la inscripción.
 *
 * **Sólo el booleano.** El monto es del torneo; acá no se guarda ninguno.
 */
export function setParticipantPaid(
  participantId: ObjectId,
  paid: boolean,
): Promise<ParticipantDoc | null> {
  return participants().findOneAndUpdate(
    { _id: participantId },
    { $set: { paid, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
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

/**
 * Todas las participaciones de un arquero, de la más vieja a la más nueva.
 *
 * Resuelto por el índice `ix_archer`. Es de donde sale la serie del gráfico de
 * evolución: `StandingDoc` guarda los dos mejores porcentajes y el mejor
 * suelto, **no la secuencia**, así que la serie se deriva de acá en vez de
 * agregar un campo nuevo y tener que recalcular lo ya publicado.
 */
export function listParticipationsOfArcher(archerId: ObjectId): Promise<ParticipantDoc[]> {
  return participants().find({ archerId }).limit(200).toArray();
}

/** Varios torneos de una, para no consultar de a uno en un bucle. */
export function findManyByIds(ids: readonly ObjectId[]): Promise<TournamentDoc[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return tournaments()
    .find({ _id: { $in: [...ids] } })
    .toArray();
}

/**
 * Borra el reparto entero de un torneo: patrullas, participantes y puntajes.
 *
 * Los tres juntos y en una sola función porque **se borran juntos o no se
 * borran**: un puntaje cuyo participante ya no existe hace que el torneo marque
 * blancos bloqueados de arqueros que no están y que no pueda volver a
 * `sin_iniciar` nunca más.
 *
 * La usa el rearmado de participantes. La transacción la pone quien llama.
 */
export async function clearDistribution(
  tournamentId: ObjectId,
  session?: ClientSession,
): Promise<void> {
  const opts = session ? { session } : {};
  await patrols().deleteMany({ tournamentId }, opts);
  await participants().deleteMany({ tournamentId }, opts);
  await scores().deleteMany({ tournamentId }, opts);
}
