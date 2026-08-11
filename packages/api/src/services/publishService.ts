/**
 * Publicar y despublicar un torneo.
 *
 * Publicar es lo que aplica los resultados a la liga. Ocurre en **una
 * transacción**: si el cálculo del ranking falla, el torneo no puede quedar
 * marcado como publicado.
 *
 * Ver `docs/ARCHITECTURE.md` §6.5.
 */

import {
  type ArcherStanding,
  applyTournamentToStandings,
  type Rankable,
  type TournamentContribution,
} from '@bal/shared';
import type { ClientSession, ObjectId } from 'mongodb';
import { getClient } from '../db/client.js';
import type { ParticipantDoc, TournamentDoc } from '../db/types.js';
import { AppError, notFound } from '../lib/errors.js';
import * as auditRepo from '../repositories/auditRepo.js';
import * as standingRepo from '../repositories/standingRepo.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';
import { transition } from './tournamentStateService.js';

const aRankable = (p: ParticipantDoc): Rankable => ({
  participantId: p._id.toHexString(),
  archerId: p.archerId.toHexString(),
  firstName: p.firstName,
  lastName: p.lastName,
  category: p.category,
  stake: p.stake,
  total: p.total,
  innerCount: p.innerCount,
  tenCount: p.tenCount,
  mCount: p.mCount,
  status: p.status,
});

const aContribucion = (
  torneo: TournamentDoc,
  miembros: readonly ParticipantDoc[],
): TournamentContribution => ({
  tournamentId: torneo._id.toHexString(),
  maxPossibleScore: torneo.maxPossibleScore,
  participants: miembros.map(aRankable),
});

/**
 * Recalcula el acumulado de la temporada desde **cero**, sobre todos los
 * torneos publicados.
 *
 * Recalcular en vez de sumar el delta hace que publicar sea **idempotente** y
 * que despublicar sea exacto: no hay forma de que un doble click aplique los
 * puntos dos veces, ni de que revertir deje residuos.
 */
async function recalcularTemporada(
  publicados: readonly TournamentDoc[],
): Promise<ArcherStanding[]> {
  // En orden cronológico: `bestNormalizedPct` se queda con el mejor, pero
  // `bestTournamentId` tiene que apuntar al primero que lo logró.
  const enOrden = [...publicados].sort((a, b) => a.date.getTime() - b.date.getTime());

  let acumulado: ArcherStanding[] = [];
  for (const torneo of enOrden) {
    const miembros = await tournamentRepo.listParticipants(torneo._id);
    acumulado = applyTournamentToStandings(acumulado, aContribucion(torneo, miembros));
  }

  return acumulado.filter((s) => s.tournamentsPlayed > 0);
}

async function conTransaccion<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = getClient().startSession();
  try {
    let resultado!: T;
    await session.withTransaction(async () => {
      resultado = await fn(session);
    });
    return resultado;
  } finally {
    await session.endSession();
  }
}

export interface PublishResult {
  readonly tournamentId: string;
  readonly status: string;
  readonly standingsUpdated: number;
}

/**
 * `completado` → `publicado`.
 *
 * @throws {AppError} `INVALID_STATE_TRANSITION` si el torneo no está completado.
 */
export async function publish(tournamentId: ObjectId, actorId: ObjectId): Promise<PublishResult> {
  const torneo = await tournamentRepo.findById(tournamentId);
  if (!torneo) throw notFound();

  if (torneo.status !== 'completado') {
    throw new AppError('INVALID_STATE_TRANSITION', {
      message: 'Sólo se puede publicar un torneo completado.',
      details: { status: torneo.status },
    });
  }

  return conTransaccion(async (session) => {
    const actualizado = await transition(
      tournamentId,
      'publicado',
      { publishedAt: new Date(), publishedBy: actorId },
      session,
    );

    const publicados = (await tournamentRepo.list({ seasonId: torneo.seasonId })).filter(
      (t) => t.status === 'publicado' || t._id.equals(tournamentId),
    );

    const acumulado = await recalcularTemporada(publicados);
    await standingRepo.replaceSeason(torneo.seasonId, acumulado, session);

    await auditRepo.record(
      {
        actorType: 'admin',
        actorId,
        action: 'tournament.publish',
        entity: 'tournament',
        entityId: tournamentId,
        meta: { standings: acumulado.length },
      },
      session,
    );

    return {
      tournamentId: tournamentId.toHexString(),
      status: actualizado.status,
      standingsUpdated: acumulado.length,
    };
  });
}

/**
 * `publicado` → `completado`. Escape de emergencia ante un error grave.
 *
 * Revierte el impacto en la liga recalculando la temporada **sin** este torneo.
 * Queda en el audit log.
 */
export async function unpublish(
  tournamentId: ObjectId,
  actorId: ObjectId,
  reason: string,
): Promise<PublishResult> {
  const torneo = await tournamentRepo.findById(tournamentId);
  if (!torneo) throw notFound();

  if (torneo.status !== 'publicado') {
    throw new AppError('INVALID_STATE_TRANSITION', {
      message: 'Ese torneo no está publicado.',
    });
  }

  return conTransaccion(async (session) => {
    const actualizado = await transition(
      tournamentId,
      'completado',
      { publishedAt: null, publishedBy: null },
      session,
    );

    const publicados = (await tournamentRepo.list({ seasonId: torneo.seasonId })).filter(
      (t) => t.status === 'publicado' && !t._id.equals(tournamentId),
    );

    const acumulado = await recalcularTemporada(publicados);
    await standingRepo.replaceSeason(torneo.seasonId, acumulado, session);

    await auditRepo.record(
      {
        actorType: 'admin',
        actorId,
        action: 'tournament.unpublish',
        entity: 'tournament',
        entityId: tournamentId,
        meta: { reason, standings: acumulado.length },
      },
      session,
    );

    return {
      tournamentId: tournamentId.toHexString(),
      status: actualizado.status,
      standingsUpdated: acumulado.length,
    };
  });
}
