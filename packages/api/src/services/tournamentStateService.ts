/**
 * Máquina de estados del torneo.
 *
 * ```
 * sin_iniciar → en_proceso → completado → publicado
 * ```
 *
 * Toda transición que no esté en la tabla se rechaza con
 * `INVALID_STATE_TRANSITION`. Ver `docs/FUNCTIONAL.md` §8.
 */

import type { TournamentStatus } from '@bal/shared';
import type { ClientSession, ObjectId } from 'mongodb';
import { tournaments } from '../db/client.js';
import type { TournamentDoc } from '../db/types.js';
import { AppError, notFound } from '../lib/errors.js';

/** Transiciones permitidas. Lo que no está acá, no se puede. */
const TRANSICIONES: Readonly<Record<TournamentStatus, readonly TournamentStatus[]>> = {
  sin_iniciar: ['en_proceso'],
  en_proceso: ['completado'],
  completado: ['publicado'],
  // `publicado` sólo vuelve atrás con un despublicar explícito del admin.
  publicado: ['completado'],
};

export function canTransition(desde: TournamentStatus, hasta: TournamentStatus): boolean {
  return TRANSICIONES[desde].includes(hasta);
}

/**
 * Cambia el estado del torneo.
 *
 * El `updateOne` filtra **también por el estado actual**: si otra request lo
 * cambió entre la lectura y la escritura, no se pisa. Es lo que evita que dos
 * clicks simultáneos en "publicar" apliquen los puntos de liga dos veces.
 */
export async function transition(
  tournamentId: ObjectId,
  hasta: TournamentStatus,
  extra: Partial<TournamentDoc> = {},
  session?: ClientSession,
): Promise<TournamentDoc> {
  const doc = await tournaments().findOne({ _id: tournamentId });
  if (!doc) throw notFound();

  if (doc.status === hasta) {
    throw new AppError('INVALID_STATE_TRANSITION', {
      message: `El torneo ya está en estado "${hasta}".`,
    });
  }

  if (!canTransition(doc.status, hasta)) {
    throw new AppError('INVALID_STATE_TRANSITION', {
      message: `No se puede pasar de "${doc.status}" a "${hasta}".`,
      details: { from: doc.status, to: hasta },
    });
  }

  const actualizado = await tournaments().findOneAndUpdate(
    { _id: tournamentId, status: doc.status },
    { $set: { status: hasta, ...extra } },
    { returnDocument: 'after', ...(session ? { session } : {}) },
  );

  if (!actualizado) {
    throw new AppError('INVALID_STATE_TRANSITION', {
      message: 'El torneo cambió de estado mientras se procesaba la solicitud.',
    });
  }

  return actualizado;
}

/** `sin_iniciar` → `en_proceso`. A partir de acá las patrullas quedan congeladas. */
export async function start(tournamentId: ObjectId): Promise<TournamentDoc> {
  return transition(tournamentId, 'en_proceso', { startedAt: new Date() });
}
