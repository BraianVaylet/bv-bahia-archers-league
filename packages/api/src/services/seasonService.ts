/**
 * Temporadas.
 *
 * Las rutas llamaban al repositorio directo. Ahora pasan por acá para que cada
 * cambio deje su entrada en el audit log (`REF6-7` / `S-9`): el servicio es el
 * lugar donde se decide qué se registra.
 */

import type { SeasonInput } from '@bal/shared';
import type { ObjectId } from 'mongodb';
import type { AuditAction, SeasonDoc } from '../db/types.js';
import { notFound } from '../lib/errors.js';
import * as auditRepo from '../repositories/auditRepo.js';
import * as seasonRepo from '../repositories/seasonRepo.js';

async function auditar(
  action: AuditAction,
  seasonId: ObjectId,
  actorId: ObjectId,
  ip: string | null,
  meta: Record<string, unknown> = {},
): Promise<void> {
  await auditRepo.record({
    actorType: 'admin',
    actorId,
    action,
    entity: 'season',
    entityId: seasonId,
    meta,
    ip,
  });
}

export async function create(
  input: SeasonInput,
  actorId: ObjectId,
  ip: string | null,
): Promise<SeasonDoc> {
  const doc = await seasonRepo.create(input);
  await auditar('season.create', doc._id, actorId, ip, { name: doc.name });
  return doc;
}

export async function update(
  id: ObjectId,
  input: SeasonInput,
  actorId: ObjectId,
  ip: string | null,
): Promise<SeasonDoc> {
  const doc = await seasonRepo.update(id, input);
  if (!doc) throw notFound();
  await auditar('season.update', id, actorId, ip, { name: doc.name });
  return doc;
}

/** Cerrar y reabrir. Cerrar no borra ni congela nada: es una marca. */
export async function setStatus(
  id: ObjectId,
  status: SeasonDoc['status'],
  actorId: ObjectId,
  ip: string | null,
): Promise<SeasonDoc> {
  const doc = await seasonRepo.setStatus(id, status);
  if (!doc) throw notFound();
  await auditar(status === 'cerrada' ? 'season.close' : 'season.reopen', id, actorId, ip);
  return doc;
}
