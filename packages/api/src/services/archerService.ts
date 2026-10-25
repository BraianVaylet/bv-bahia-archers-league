/**
 * Padrón de arqueros.
 *
 * Ver `docs/FUNCTIONAL.md` §6.4.
 */

import type { ArcherInput, ArcherSelfRegisterInput, Sex } from '@bal/shared';
import type { ObjectId } from 'mongodb';
import type { ArcherDoc, ArcherRegistrationStatus } from '../db/types.js';
import { AppError, notFound } from '../lib/errors.js';
import * as archerRepo from '../repositories/archerRepo.js';
import * as auditRepo from '../repositories/auditRepo.js';

export interface ArcherView {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly category: string;
  readonly sex: Sex | null;
  readonly dni: string | null;
  readonly registrationStatus: ArcherRegistrationStatus;
  /** `true` si falta `sex` o `dni` (padrón viejo). WAFA lo señala sin que nadie adivine. */
  readonly profileIncomplete: boolean;
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
  sex: doc.sex,
  dni: doc.dni,
  registrationStatus: doc.registrationStatus,
  // Se deriva de los dos campos en vez de guardarse aparte: dos fuentes para
  // el mismo hecho son dos que pueden decir cosas distintas.
  profileIncomplete: doc.sex === null || doc.dni === null,
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

/**
 * Autoregistro público (`BE-20`). Nace `pendiente`: no entra al padrón que
 * usa el wizard de torneo hasta que `BE-22` lo aprueba.
 */
export async function registerPublic(input: ArcherSelfRegisterInput): Promise<ArcherView> {
  return toView(await archerRepo.create(input, 'pendiente'));
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

/** `BE-22`: `pendiente` → `aprobado`. Queda disponible de inmediato para el wizard de torneo. */
export async function approveArcher(id: ObjectId, actorId: ObjectId): Promise<ArcherView> {
  const doc = await archerRepo.approve(id);
  if (!doc) throw notFound();

  await auditRepo.record({
    actorType: 'admin',
    actorId,
    action: 'archer.approve',
    entity: 'archer',
    entityId: id,
    meta: { firstName: doc.firstName, lastName: doc.lastName },
  });

  return toView(doc);
}

/**
 * `BE-22`: rechaza un alta pendiente, borrándola del padrón.
 *
 * Reusa la misma guarda que `remove`: un `pendiente` nunca pudo haber
 * participado de un torneo, así que esto no debería poder pasar — pero se
 * verifica igual, para no convertir el rechazo en un borrado silencioso si
 * alguna vez pasara.
 */
export async function rejectArcher(id: ObjectId, actorId: ObjectId): Promise<void> {
  const doc = await archerRepo.findById(id);
  if (!doc) throw notFound();

  if (await archerRepo.hasParticipated(id)) {
    throw new AppError('ARCHER_IN_USE');
  }

  await archerRepo.remove(id);

  await auditRepo.record({
    actorType: 'admin',
    actorId,
    action: 'archer.reject',
    entity: 'archer',
    entityId: id,
    meta: { firstName: doc.firstName, lastName: doc.lastName },
  });
}
