/**
 * Padrón de arqueros.
 *
 * Ver `docs/FUNCTIONAL.md` §6.4.
 */

import type { ArcherInput, ArcherSelfRegisterInput, BowCategory, Sex } from '@bal/shared';
import { ObjectId } from 'mongodb';
import type { ArcherDoc, ArcherRegistrationStatus, AuditAction } from '../db/types.js';
import { AppError, notFound } from '../lib/errors.js';
import * as archerRepo from '../repositories/archerRepo.js';
import * as auditRepo from '../repositories/auditRepo.js';
import * as standingRepo from '../repositories/standingRepo.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';
import { conTransaccion } from './tournamentService.js';

export interface ArcherView {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly category: BowCategory;
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

/**
 * El padrón anterior a `BE-19` no tiene `sex`, `dni` ni `registrationStatus`: las
 * claves **no existen**, no valen `null`. El tipo dice otra cosa, así que se leen con
 * `??`: sin esto, `sex` desaparecía del JSON y `profileIncomplete` daba `false` —
 * `undefined === null` es falso— justo en los arqueros a los que más les falta.
 */
export const toView = (doc: ArcherDoc, tournamentCount = 0): ArcherView => ({
  id: doc._id.toHexString(),
  firstName: doc.firstName,
  lastName: doc.lastName,
  category: doc.category,
  sex: doc.sex ?? null,
  dni: doc.dni ?? null,
  registrationStatus: doc.registrationStatus ?? 'aprobado',
  // Se deriva de los dos campos en vez de guardarse aparte: dos fuentes para
  // el mismo hecho son dos que pueden decir cosas distintas.
  profileIncomplete: doc.sex == null || doc.dni == null,
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

/**
 * Alta hecha por el admin.
 *
 * El audit log guarda **qué pasó**, no los datos de la persona: nombre y DNI viven
 * en el padrón, que tiene sus propios controles (`docs/SECURITY.md` §11).
 */
export async function create(
  input: ArcherInput,
  actorId: ObjectId,
  ip: string | null,
): Promise<ArcherView> {
  const doc = await archerRepo.create(input);
  await auditarArquero('archer.create', doc._id, actorId, ip, { category: doc.category });
  return toView(doc);
}

async function auditarArquero(
  action: AuditAction,
  archerId: ObjectId,
  actorId: ObjectId,
  ip: string | null,
  meta: Record<string, unknown> = {},
): Promise<void> {
  await auditRepo.record({
    actorType: 'admin',
    actorId,
    action,
    entity: 'archer',
    entityId: archerId,
    meta,
    ip,
  });
}

/** Lo que el alta pública devuelve: lo que el visitante mandó, nunca lo que ya estaba cargado. */
export interface AltaPublica {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly category: BowCategory;
}

const respuestaDeAlta = (
  id: ObjectId,
  datos: Pick<ArcherSelfRegisterInput, 'firstName' | 'lastName' | 'category'>,
): AltaPublica => ({
  id: id.toHexString(),
  firstName: datos.firstName,
  lastName: datos.lastName,
  category: datos.category,
});

/**
 * Autoregistro público (`BE-20`). Nace `pendiente`: no entra al padrón que
 * usa el wizard de torneo hasta que `BE-22` lo aprueba.
 *
 * **No puede ser un oráculo** (`REF6-6` / `S-6`). Un DNI que ya estaba en esa
 * categoría responde exactamente igual que un alta nueva, con un id inventado que
 * no apunta a nadie: un `409` le confirmaría a cualquiera, conociendo un DNI, que
 * esa persona está en el padrón de la liga. El rastro queda en el audit log, para
 * el admin. El campo trampa lleno se trata igual: se descarta en silencio.
 */
export async function registerPublic(input: ArcherSelfRegisterInput): Promise<AltaPublica> {
  const { sitioWeb, ...datos } = input;

  if (sitioWeb) return respuestaDeAlta(new ObjectId(), datos);

  try {
    const doc = await archerRepo.create(datos, 'pendiente');
    return respuestaDeAlta(doc._id, datos);
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== 'ARCHER_DNI_DUPLICATE') throw error;

    await registrarAltaDuplicada(datos);
    return respuestaDeAlta(new ObjectId(), datos);
  }
}

async function registrarAltaDuplicada(
  datos: Omit<ArcherSelfRegisterInput, 'sitioWeb'>,
): Promise<void> {
  const existente = await archerRepo.findByDniAndCategory(datos.dni, datos.category);
  // Si se borró entre el intento y acá, no hay a quién señalar.
  if (!existente) return;

  await auditRepo.record({
    actorType: 'system',
    actorId: null,
    action: 'archer.register_duplicate',
    entity: 'archer',
    entityId: existente._id,
    // Lo que se intentó, para que el admin juzgue. El DNI no se copia al log.
    meta: { category: datos.category, firstName: datos.firstName, lastName: datos.lastName },
  });
}

/**
 * Edición hecha por el admin: completar el padrón viejo o corregir lo que se cargó mal.
 *
 * El `sex` nuevo viaja a las participaciones y a los acumulados de la liga **en la misma
 * transacción**: es lo que decide si el arquero cuenta en Femenino o en Masculino, y un
 * arquero que se completó en el padrón pero sigue afuera del ranking es justo el problema
 * que esto resuelve. Todo lo demás del snapshot (nombre, categoría) no se toca: el
 * torneo muestra lo de ese día (`docs/ARCHITECTURE.md` §5, decisión 2).
 */
export async function update(
  id: ObjectId,
  input: ArcherInput,
  actorId: ObjectId,
  ip: string | null,
): Promise<ArcherView> {
  const doc = await conTransaccion(async (session) => {
    const actualizado = await archerRepo.update(id, input, session);
    if (!actualizado) return null;

    await tournamentRepo.setSexOfArcher(id, actualizado.sex, session);
    await standingRepo.setSexOfArcher(id, actualizado.sex, session);
    return actualizado;
  });
  if (!doc) throw notFound();
  await auditarArquero('archer.update', id, actorId, ip, { category: doc.category });
  return toView(doc);
}

export async function setArchived(
  id: ObjectId,
  archived: boolean,
  actorId: ObjectId,
  ip: string | null,
): Promise<ArcherView> {
  const doc = await archerRepo.setArchived(id, archived);
  if (!doc) throw notFound();
  await auditarArquero(archived ? 'archer.archive' : 'archer.restore', id, actorId, ip);
  return toView(doc);
}

/**
 * Elimina un arquero del padrón.
 *
 * **Sólo si nunca participó de un torneo.** Si participó, su histórico y su
 * lugar en los rankings dependen de que siga existiendo: se archiva, no se
 * borra. Ver `docs/FUNCTIONAL.md` §6.4.
 */
export async function remove(id: ObjectId, actorId: ObjectId, ip: string | null): Promise<void> {
  const existente = await archerRepo.findById(id);
  if (!existente) throw notFound();

  if (await archerRepo.hasParticipated(id)) {
    throw new AppError('ARCHER_IN_USE');
  }

  await archerRepo.remove(id);
  await auditarArquero('archer.delete', id, actorId, ip, { category: existente.category });
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
