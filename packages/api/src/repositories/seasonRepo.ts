/**
 * Acceso a `seasons`.
 */

import type { SeasonInput } from '@bal/shared';
import type { ObjectId } from 'mongodb';
import { seasons, tournaments } from '../db/client.js';
import type { SeasonDoc } from '../db/types.js';

export function list(): Promise<SeasonDoc[]> {
  return seasons().find({}).sort({ startsAt: -1 }).toArray();
}

export function findById(id: ObjectId): Promise<SeasonDoc | null> {
  return seasons().findOne({ _id: id });
}

export async function create(input: SeasonInput): Promise<SeasonDoc> {
  const ahora = new Date();
  const doc = {
    name: input.name,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: 'activa',
    createdAt: ahora,
    updatedAt: ahora,
  } as SeasonDoc;

  const { insertedId } = await seasons().insertOne(doc);
  return { ...doc, _id: insertedId };
}

export async function update(id: ObjectId, input: SeasonInput): Promise<SeasonDoc | null> {
  return seasons().findOneAndUpdate(
    { _id: id },
    { $set: { ...input, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
}

/**
 * Abre o cierra la temporada.
 *
 * Cerrar **no borra ni congela nada**: los torneos publicados siguen contando
 * para su ranking. Es una marca para que el admin sepa cuál es la temporada en
 * curso cuando hay varias, que es el caso normal a fin de año.
 */
export async function setStatus(
  id: ObjectId,
  status: SeasonDoc['status'],
): Promise<SeasonDoc | null> {
  return seasons().findOneAndUpdate(
    { _id: id },
    { $set: { status, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
}

export async function hasTournaments(id: ObjectId): Promise<boolean> {
  return (await tournaments().countDocuments({ seasonId: id }, { limit: 1 })) > 0;
}
