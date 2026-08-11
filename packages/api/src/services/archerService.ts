/**
 * Padrón de arqueros.
 *
 * Ver `docs/FUNCTIONAL.md` §6.4.
 */

import type { ArcherInput } from '@bal/shared';
import type { ObjectId } from 'mongodb';
import type { ArcherDoc } from '../db/types.js';
import { AppError, notFound } from '../lib/errors.js';
import * as archerRepo from '../repositories/archerRepo.js';

export interface ArcherView {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly category: string;
  readonly archived: boolean;
}

export const toView = (doc: ArcherDoc): ArcherView => ({
  id: doc._id.toHexString(),
  firstName: doc.firstName,
  lastName: doc.lastName,
  category: doc.category,
  archived: doc.archivedAt !== null,
});

export async function list(options: archerRepo.ListOptions): Promise<ArcherView[]> {
  return (await archerRepo.list(options)).map(toView);
}

export async function create(input: ArcherInput): Promise<ArcherView> {
  return toView(await archerRepo.create(input));
}

export async function update(id: ObjectId, input: ArcherInput): Promise<ArcherView> {
  const doc = await archerRepo.update(id, input);
  if (!doc) throw notFound();
  return toView(doc);
}

export async function setArchived(id: ObjectId, archived: boolean): Promise<ArcherView> {
  const doc = await archerRepo.setArchived(id, archived);
  if (!doc) throw notFound();
  return toView(doc);
}

/**
 * Elimina un arquero del padrón.
 *
 * **Sólo si nunca participó de un torneo.** Si participó, su histórico y su
 * lugar en los rankings dependen de que siga existiendo: se archiva, no se
 * borra. Ver `docs/FUNCTIONAL.md` §6.4.
 */
export async function remove(id: ObjectId): Promise<void> {
  if (!(await archerRepo.findById(id))) throw notFound();

  if (await archerRepo.hasParticipated(id)) {
    throw new AppError('ARCHER_IN_USE');
  }

  await archerRepo.remove(id);
}
