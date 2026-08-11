/**
 * Acceso a `sessions`.
 *
 * En la base sólo vive `sha256(token)`. El token en claro existe únicamente en
 * la cookie del navegador: una filtración de la base no permite suplantar
 * sesiones. Ver `docs/SECURITY.md` §8.
 */

import type { ObjectId } from 'mongodb';
import { sessions } from '../db/client.js';
import type { SessionDoc, SubjectType } from '../db/types.js';

export interface CreateSessionInput {
  readonly tokenHash: string;
  readonly subjectType: SubjectType;
  readonly subjectId: ObjectId;
  readonly tournamentId: ObjectId | null;
  readonly expiresAt: Date;
  readonly ip: string | null;
  readonly userAgent: string | null;
}

export async function create(input: CreateSessionInput): Promise<void> {
  await sessions().insertOne({ ...input, createdAt: new Date() } as SessionDoc);
}

/**
 * Busca una sesión vigente por el hash de su token.
 *
 * El filtro por `expiresAt` es necesario aunque exista el índice TTL: Mongo
 * borra los documentos vencidos cada ~60 segundos, así que entre el vencimiento
 * y el barrido la sesión todavía existe en la colección.
 */
export function findValidByTokenHash(tokenHash: string): Promise<SessionDoc | null> {
  return sessions().findOne({ tokenHash, expiresAt: { $gt: new Date() } });
}

export async function deleteByTokenHash(tokenHash: string): Promise<void> {
  await sessions().deleteOne({ tokenHash });
}

/** Invalida todas las sesiones de un sujeto. Se usa al cambiar password o PIN. */
export async function deleteAllForSubject(
  subjectType: SubjectType,
  subjectId: ObjectId,
): Promise<number> {
  const r = await sessions().deleteMany({ subjectType, subjectId });
  return r.deletedCount;
}
