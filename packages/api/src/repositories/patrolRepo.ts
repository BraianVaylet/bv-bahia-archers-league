/**
 * Acceso a `patrols`.
 */

import type { PatrolStatus } from '@bal/shared';
import type { ClientSession, ObjectId } from 'mongodb';
import { patrols } from '../db/client.js';
import type { PatrolDoc } from '../db/types.js';

export function findById(id: ObjectId): Promise<PatrolDoc | null> {
  return patrols().findOne({ _id: id });
}

export function findByUsername(
  tournamentId: ObjectId,
  username: string,
): Promise<PatrolDoc | null> {
  return patrols().findOne({ tournamentId, username });
}

export function listByTournament(tournamentId: ObjectId): Promise<PatrolDoc[]> {
  return patrols().find({ tournamentId }).sort({ number: 1 }).toArray();
}

export async function registerSuccessfulLogin(id: ObjectId): Promise<void> {
  await patrols().updateOne(
    { _id: id },
    { $set: { failedAttempts: 0, lockedUntil: null, updatedAt: new Date() } },
  );
}

/** Suma un intento fallido y bloquea al llegar al tope. Atómico. */
export async function registerFailedAttempt(
  id: ObjectId,
  maxAttempts: number,
  lockMs: number,
): Promise<void> {
  const doc = await patrols().findOneAndUpdate(
    { _id: id },
    { $inc: { failedAttempts: 1 }, $set: { updatedAt: new Date() } },
    { returnDocument: 'after' },
  );

  if (doc && doc.failedAttempts >= maxAttempts) {
    await patrols().updateOne(
      { _id: id },
      { $set: { lockedUntil: new Date(Date.now() + lockMs), failedAttempts: 0 } },
    );
  }
}

export async function setStatus(
  id: ObjectId,
  status: PatrolStatus,
  extra: Partial<PatrolDoc> = {},
  session?: ClientSession,
): Promise<void> {
  await patrols().updateOne(
    { _id: id },
    { $set: { status, ...extra, updatedAt: new Date() } },
    session ? { session } : {},
  );
}

export async function setTargetsCompleted(
  id: ObjectId,
  targetsCompleted: number,
  session?: ClientSession,
): Promise<void> {
  await patrols().updateOne(
    { _id: id },
    { $set: { targetsCompleted, updatedAt: new Date() } },
    session ? { session } : {},
  );
}

/** Cantidad de patrullas del torneo que todavía no cerraron su circuito. */
export async function countOpen(tournamentId: ObjectId, session?: ClientSession): Promise<number> {
  return patrols().countDocuments(
    { tournamentId, status: { $ne: 'cerrada' } },
    session ? { session } : {},
  );
}
