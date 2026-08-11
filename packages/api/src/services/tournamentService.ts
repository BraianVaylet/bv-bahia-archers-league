/**
 * Creación de torneos.
 *
 * Todo el armado ocurre en **una transacción**: si algo falla a mitad de camino,
 * no puede quedar un torneo con participantes y sin patrullas, ni un torneo
 * huérfano. Ver `docs/ARCHITECTURE.md` §6.1.
 */

import {
  buildPatrols,
  type CreateTournamentInput,
  DEFAULT_STAKE_MAP,
  maxPossibleScore,
  type ParticipantInput,
  type PatrolPlan,
  type PatrolWarning,
  type StakeMap,
} from '@bal/shared';
import { type ClientSession, ObjectId } from 'mongodb';
import { getClient } from '../db/client.js';
import type { ArcherDoc, ParticipantDoc, PatrolDoc, TargetDoc } from '../db/types.js';
import { env } from '../env.js';
import { encryptPin, generatePin, hashSecret } from '../lib/crypto.js';
import { AppError, notFound } from '../lib/errors.js';
import { toObjectId } from '../lib/ids.js';
import * as archerRepo from '../repositories/archerRepo.js';
import * as auditRepo from '../repositories/auditRepo.js';
import * as seasonRepo from '../repositories/seasonRepo.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';

const MODALIDADES_EN_CERO = { sala: 0, aire_libre: 0, campo: 0, '3d': 0 } as const;

export interface CreatedTournament {
  readonly id: string;
  readonly maxPossibleScore: number;
  readonly patrolCount: number;
  readonly participantCount: number;
  readonly warnings: readonly PatrolWarning[];
  readonly requiresManualReview: boolean;
  /** Arqueros que el armado no pudo ubicar sin violar una restricción dura. */
  readonly unassigned: readonly { id: string; firstName: string; lastName: string }[];
}

/**
 * Crea un torneo completo: participantes con su snapshot, patrullas armadas y
 * credenciales generadas.
 *
 * @throws {AppError} `NOT_FOUND` si la temporada o algún arquero no existe.
 * @throws {AppError} `VALIDATION_ERROR` si se intenta inscribir a un archivado.
 */
export async function createTournament(
  input: CreateTournamentInput,
  actorId: ObjectId,
): Promise<CreatedTournament> {
  const season = await seasonRepo.findById(toObjectId(input.seasonId));
  if (!season) throw notFound();

  const archerIds = input.archerIds.map(toObjectId);
  const arqueros = await archerRepo.findManyByIds(archerIds);

  if (arqueros.length !== archerIds.length) {
    throw new AppError('NOT_FOUND', { message: 'Alguno de los arqueros no existe.' });
  }

  const archivados = arqueros.filter((a) => a.archivedAt !== null);
  if (archivados.length > 0) {
    throw new AppError('VALIDATION_ERROR', {
      message: 'No se puede inscribir a un arquero archivado.',
      details: { archerIds: archivados.map((a) => a._id.toHexString()) },
    });
  }

  const targets: TargetDoc[] = input.targets.map((t) => ({
    index: t.index,
    modality: t.modality,
    arrows: t.arrows,
    description: t.description,
  }));

  const stakeMap: StakeMap = input.stakeMap ?? DEFAULT_STAKE_MAP;
  const maximo = maxPossibleScore(targets);

  // El armado corre ANTES de abrir la transacción: es puro y determinista, y si
  // la transacción se reintenta no tiene sentido recalcularlo.
  const plan = buildPatrols(aParticipantInput(arqueros), stakeMap, targets.length);
  const asignados = arqueros.length - plan.unassigned.length;

  const ahora = new Date();
  const tournamentId = new ObjectId();
  const { patrolDocs, participantDocs } = await materializar(plan, tournamentId, ahora);

  await conTransaccion(async (session) => {
    await tournamentRepo.insert(
      {
        _id: tournamentId,
        seasonId: season._id,
        name: input.name,
        date: input.date,
        description: input.description,
        status: 'sin_iniciar',
        targets,
        maxPossibleScore: maximo,
        stakeMap: {
          roja: [...stakeMap.roja],
          azul: [...stakeMap.azul],
          amarilla: [...stakeMap.amarilla],
        },
        distances: input.distances ? { ...input.distances } : null,
        patrolCount: plan.patrols.length,
        participantCount: asignados,
        createdAt: ahora,
        startedAt: null,
        completedAt: null,
        publishedAt: null,
        publishedBy: null,
      },
      session,
    );

    await tournamentRepo.insertPatrols(patrolDocs, session);
    await tournamentRepo.insertParticipants(participantDocs, session);

    await auditRepo.record(
      {
        actorType: 'admin',
        actorId,
        action: 'tournament.create',
        entity: 'tournament',
        entityId: tournamentId,
        meta: {
          name: input.name,
          targets: targets.length,
          participants: participantDocs.length,
          requiresManualReview: plan.requiresManualReview,
        },
      },
      session,
    );
  });

  return {
    id: tournamentId.toHexString(),
    maxPossibleScore: maximo,
    patrolCount: plan.patrols.length,
    participantCount: asignados,
    warnings: plan.warnings,
    requiresManualReview: plan.requiresManualReview,
    unassigned: plan.unassigned.map((a) => ({
      id: a.archerId,
      firstName: a.firstName,
      lastName: a.lastName,
    })),
  };
}

// ── Auxiliares ───────────────────────────────────────────────────────────────

function aParticipantInput(arqueros: readonly ArcherDoc[]): ParticipantInput[] {
  return arqueros.map((a) => ({
    archerId: a._id.toHexString(),
    firstName: a.firstName,
    lastName: a.lastName,
    category: a.category,
  }));
}

/**
 * Convierte el plan del dominio en documentos, generando las credenciales.
 *
 * El PIN se guarda **hasheado** (para verificarlo en el login) y **cifrado**
 * (para que el admin pueda volver a mostrarlo). Ver `docs/SECURITY.md` §9.
 *
 * Corre fuera de la transacción a propósito: hashear seis PIN con argon2id
 * tarda cientos de milisegundos y mantener la transacción abierta ese tiempo
 * sostiene locks sin necesidad.
 */
async function materializar(
  plan: PatrolPlan,
  tournamentId: ObjectId,
  ahora: Date,
): Promise<{ patrolDocs: PatrolDoc[]; participantDocs: ParticipantDoc[] }> {
  const cfg = env();
  const patrolDocs: PatrolDoc[] = [];
  const participantDocs: ParticipantDoc[] = [];

  for (const patrulla of plan.patrols) {
    const patrolId = new ObjectId();
    const pin = generatePin(6);

    patrolDocs.push({
      _id: patrolId,
      tournamentId,
      number: patrulla.number,
      startTargetIndex: patrulla.startTargetIndex,
      username: `patrulla${patrulla.number}`,
      pinHash: await hashSecret(pin),
      pinEnc: encryptPin(pin, cfg.PIN_ENC_KEY),
      pinUpdatedAt: ahora,
      status: 'pendiente',
      failedAttempts: 0,
      lockedUntil: null,
      targetsCompleted: 0,
      closedAt: null,
      manualOverride: false,
      createdAt: ahora,
      updatedAt: ahora,
    });

    for (const unidad of patrulla.units) {
      for (const miembro of unidad.members) {
        participantDocs.push({
          _id: new ObjectId(),
          tournamentId,
          patrolId,
          archerId: new ObjectId(miembro.archerId),
          // Snapshot congelado: el histórico no cambia si el arquero se edita
          // o se archiva después. Ver docs/ARCHITECTURE.md §5, decisión 2.
          firstName: miembro.firstName,
          lastName: miembro.lastName,
          category: miembro.category,
          stake: miembro.stake,
          unit: unidad.label,
          position: miembro.position,
          total: 0,
          innerCount: 0,
          xCount: 0,
          tenCount: 0,
          mCount: 0,
          targetsCompleted: 0,
          normalizedPct: 0,
          byModality: { ...MODALIDADES_EN_CERO },
          status: 'activo',
          signature: null,
          createdAt: ahora,
          updatedAt: ahora,
        });
      }
    }
  }

  return { patrolDocs, participantDocs };
}

/** Ejecuta el callback dentro de una transacción. */
export async function conTransaccion<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
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
