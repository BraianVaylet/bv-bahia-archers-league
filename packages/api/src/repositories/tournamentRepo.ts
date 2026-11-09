/**
 * Acceso a `tournaments`, `patrols` y `participants`.
 *
 * Las funciones que participan de una transacción reciben la `ClientSession`:
 * sin pasarla, la escritura queda **fuera** de la transacción y el rollback no
 * la alcanza. Es el error más fácil de cometer con el driver de Mongo.
 */

import type { Position, Sex, TournamentStatus, Unit } from '@bal/shared';
import type { ClientSession, ObjectId } from 'mongodb';
import { participants, patrols, scores, tournaments } from '../db/client.js';
import type { ParticipantDoc, PatrolDoc, TournamentDoc } from '../db/types.js';

// ── Torneos ──────────────────────────────────────────────────────────────────

export async function insert(doc: TournamentDoc, session?: ClientSession): Promise<ObjectId> {
  const { insertedId } = await tournaments().insertOne(doc, session ? { session } : {});
  return insertedId;
}

/**
 * Actualiza el torneo **sólo si todavía está en `status`**, y devuelve el resultado.
 *
 * La guarda va en el filtro y no en un `findOne` previo: entre leer y escribir otro
 * request puede haber cambiado el estado (dos clicks seguidos en «publicar»), y la
 * comprobación y la escritura tienen que ser una sola operación atómica.
 *
 * @returns el documento nuevo, o `null` si el estado ya no era `status`.
 */
export function updateIfStatus(
  id: ObjectId,
  status: TournamentDoc['status'],
  cambios: Partial<TournamentDoc>,
  session?: ClientSession,
): Promise<TournamentDoc | null> {
  return tournaments().findOneAndUpdate(
    { _id: id, status },
    { $set: cambios },
    { returnDocument: 'after', ...(session ? { session } : {}) },
  );
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

/** Lo que el listado público lee de cada torneo. Los blancos hacen falta: de ellos salen la cantidad y las modalidades. */
export type TorneoParaListar = Pick<
  TournamentDoc,
  '_id' | 'name' | 'date' | 'status' | 'targets' | 'participantCount'
>;

/**
 * Los torneos que se ven desde afuera: publicados y en proceso, el más nuevo primero (`REF6-13` / `P-6`).
 *
 * **El filtro va en la consulta, no después**: antes se traían los 200 más nuevos de *cualquier*
 * estado y recién entonces se descartaban los que no eran públicos, así que 200 torneos recientes
 * sin publicar dejaban afuera a los publicados. Usa `ix_status_date`. La proyección deja afuera lo
 * que el listado no muestra (`stakeMap`, `payment`, `description`…).
 */
export function listPublicos(): Promise<TorneoParaListar[]> {
  return tournaments()
    .find(
      { status: { $in: ['publicado', 'en_proceso'] } },
      { projection: { name: 1, date: 1, status: 1, targets: 1, participantCount: 1 } },
    )
    .sort({ date: -1 })
    .limit(200)
    .toArray() as Promise<TorneoParaListar[]>;
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

/**
 * Lleva el `sex` del padrón a todas las participaciones del arquero.
 *
 * La única excepción al snapshot congelado (`docs/ARCHITECTURE.md` §5, decisión 2):
 * el sexo no es algo que «pasó ese día» sino la pool en la que se rankea, y es de
 * acá de donde `db:reconcile` lo vuelve a leer. Sin esto, completarlo en el padrón
 * no movería el ranking, o lo movería hasta el próximo recálculo.
 *
 * El `$ne` deja afuera lo que ya coincide: editar el nombre no escribe nada acá.
 */
export async function setSexOfArcher(
  archerId: ObjectId,
  sex: Sex | null,
  session: ClientSession,
): Promise<void> {
  await participants().updateMany({ archerId, sex: { $ne: sex } }, { $set: { sex } }, { session });
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
