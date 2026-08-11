/**
 * Datos que WAFL necesita para funcionar sin señal.
 *
 * El bundle se descarga **una sola vez**, al entrar. A partir de ahí la app
 * completa el recorrido sin red. Ver `docs/OFFLINE_SYNC.md` §5.1.
 */

import type { ObjectId } from 'mongodb';
import type { TargetDoc } from '../db/types.js';
import { notFound } from '../lib/errors.js';
import * as patrolRepo from '../repositories/patrolRepo.js';
import * as scoreRepo from '../repositories/scoreRepo.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';

export interface WaflBundle {
  readonly tournament: {
    id: string;
    name: string;
    date: Date;
    maxPossibleScore: number;
    /** Ordenados **desde el blanco de inicio de esta patrulla**. */
    targets: readonly TargetDoc[];
  };
  readonly patrol: {
    id: string;
    number: number;
    startTargetIndex: number;
    status: string;
    targetsCompleted: number;
  };
  readonly participants: readonly {
    id: string;
    firstName: string;
    lastName: string;
    category: string;
    stake: string;
    unit: string;
    position: string;
  }[];
  readonly scores: readonly {
    participantId: string;
    targetIndex: number;
    arrows: string[];
    total: number;
  }[];
  readonly signatures: readonly { participantId: string; signedAt: Date }[];
  /** Permite al cliente corregir el desfase de su reloj. Ver `OFFLINE_SYNC.md` §4. */
  readonly serverTime: string;
}

/**
 * Rota el recorrido para que empiece en el blanco de inicio de la patrulla.
 *
 * Si arranca en el 10 de un recorrido de 14, ve `10, 11, 12, 13, 14, 1, …, 9`.
 * Ver `docs/FUNCTIONAL.md` §7.2.
 */
export function ordenarDesde(targets: readonly TargetDoc[], startTargetIndex: number): TargetDoc[] {
  const ordenados = [...targets].sort((a, b) => a.index - b.index);
  const desde = ordenados.findIndex((t) => t.index === startTargetIndex);
  if (desde <= 0) return ordenados;

  return [...ordenados.slice(desde), ...ordenados.slice(0, desde)];
}

export async function getBundle(patrolId: ObjectId, tournamentId: ObjectId): Promise<WaflBundle> {
  const [torneo, patrulla] = await Promise.all([
    tournamentRepo.findById(tournamentId),
    patrolRepo.findById(patrolId),
  ]);

  if (!torneo || !patrulla || !patrulla.tournamentId.equals(tournamentId)) {
    throw notFound();
  }

  const [miembros, puntajes] = await Promise.all([
    tournamentRepo.listParticipantsOfPatrol(patrolId),
    scoreRepo.listScoresOfPatrol(patrolId),
  ]);

  return {
    tournament: {
      id: torneo._id.toHexString(),
      name: torneo.name,
      date: torneo.date,
      maxPossibleScore: torneo.maxPossibleScore,
      targets: ordenarDesde(torneo.targets, patrulla.startTargetIndex),
    },
    patrol: {
      id: patrulla._id.toHexString(),
      number: patrulla.number,
      startTargetIndex: patrulla.startTargetIndex,
      status: patrulla.status,
      targetsCompleted: patrulla.targetsCompleted,
    },
    participants: miembros.map((m) => ({
      id: m._id.toHexString(),
      firstName: m.firstName,
      lastName: m.lastName,
      category: m.category,
      stake: m.stake,
      unit: m.unit,
      position: m.position,
    })),
    scores: puntajes.map((s) => ({
      participantId: s.participantId.toHexString(),
      targetIndex: s.targetIndex,
      arrows: s.arrows,
      total: s.total,
    })),
    signatures: miembros
      .filter((m) => m.signature !== null)
      .map((m) => ({
        participantId: m._id.toHexString(),
        // biome-ignore lint/style/noNonNullAssertion: el filter garantiza que existe
        signedAt: m.signature!.signedAt,
      })),
    serverTime: new Date().toISOString(),
  };
}
