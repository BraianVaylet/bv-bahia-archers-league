/**
 * Acceso a `archers`.
 *
 * Ninguna consulta a MongoDB vive fuera de `repositories/`.
 */

import type { ArcherInput } from '@bal/shared';
import type { ObjectId } from 'mongodb';
import { archers, participants } from '../db/client.js';
import type { ArcherDoc } from '../db/types.js';
import { searchKey } from '../lib/crypto.js';

export interface ListOptions {
  readonly archived?: boolean;
  /** Texto libre. Se normaliza igual que `searchKey` antes de buscar. */
  readonly query?: string;
}

export function list(options: ListOptions = {}): Promise<ArcherDoc[]> {
  const filtro: Record<string, unknown> = {
    archivedAt: options.archived ? { $ne: null } : null,
  };

  if (options.query) {
    // `escapeRegExp` no hace falta porque se escapan todos los metacaracteres:
    // el término viene del usuario y una regex maliciosa es un vector de ReDoS.
    const termino = searchKey(options.query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filtro.searchKey = { $regex: termino };
  }

  return archers().find(filtro).sort({ lastName: 1, firstName: 1 }).limit(500).toArray();
}

export function findById(id: ObjectId): Promise<ArcherDoc | null> {
  return archers().findOne({ _id: id });
}

export function findManyByIds(ids: readonly ObjectId[]): Promise<ArcherDoc[]> {
  return archers()
    .find({ _id: { $in: [...ids] } })
    .toArray();
}

export async function create(input: ArcherInput): Promise<ArcherDoc> {
  const ahora = new Date();
  const doc = {
    firstName: input.firstName,
    lastName: input.lastName,
    category: input.category,
    searchKey: searchKey(input.lastName, input.firstName),
    archivedAt: null,
    createdAt: ahora,
    updatedAt: ahora,
  } as ArcherDoc;

  const { insertedId } = await archers().insertOne(doc);
  return { ...doc, _id: insertedId };
}

export async function update(id: ObjectId, input: ArcherInput): Promise<ArcherDoc | null> {
  return archers().findOneAndUpdate(
    { _id: id },
    {
      $set: {
        firstName: input.firstName,
        lastName: input.lastName,
        category: input.category,
        searchKey: searchKey(input.lastName, input.firstName),
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' },
  );
}

export async function setArchived(id: ObjectId, archived: boolean): Promise<ArcherDoc | null> {
  return archers().findOneAndUpdate(
    { _id: id },
    { $set: { archivedAt: archived ? new Date() : null, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
}

export async function remove(id: ObjectId): Promise<boolean> {
  const r = await archers().deleteOne({ _id: id });
  return r.deletedCount === 1;
}

/**
 * `true` si el arquero participó de algún torneo.
 *
 * Es lo que impide borrarlo: su histórico y su lugar en los rankings dependen
 * de que siga existiendo. Ver `docs/FUNCTIONAL.md` §6.4.
 */
export async function hasParticipated(id: ObjectId): Promise<boolean> {
  return (await participants().countDocuments({ archerId: id }, { limit: 1 })) > 0;
}

/**
 * De los ids dados, cuáles participaron de algún torneo.
 *
 * Una sola consulta para todo el padrón: preguntar uno por uno sería una
 * consulta por arquero cada vez que se abre la pantalla.
 */
export async function participatedIds(ids: readonly ObjectId[]): Promise<ObjectId[]> {
  if (ids.length === 0) return [];
  return participants().distinct('archerId', { archerId: { $in: [...ids] } });
}
