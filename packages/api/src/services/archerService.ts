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
  /**
   * `true` si participó de algún torneo, y por lo tanto **no se puede borrar**.
   *
   * Va en la lista para que la interfaz pueda explicarlo *antes* de que el admin
   * intente borrarlo, en vez de después. Ver `docs/FUNCTIONAL.md` §6.4.
   */
  readonly participated: boolean;

  /** En cuántos torneos distintos participó. Es de dónde sale `participated`. */
  readonly tournamentCount: number;
}

export const toView = (doc: ArcherDoc, tournamentCount = 0): ArcherView => ({
  id: doc._id.toHexString(),
  firstName: doc.firstName,
  lastName: doc.lastName,
  category: doc.category,
  archived: doc.archivedAt !== null,
  // Se deriva del conteo en vez de guardarse aparte: dos fuentes para el mismo
  // hecho son dos que pueden decir cosas distintas.
  participated: tournamentCount > 0,
  tournamentCount,
});

export async function list(options: archerRepo.ListOptions): Promise<ArcherView[]> {
  const docs = await archerRepo.list(options);
  const torneos = await archerRepo.tournamentCounts(docs.map((d) => d._id));

  return docs.map((d) => toView(d, torneos.get(d._id.toHexString()) ?? 0));
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
