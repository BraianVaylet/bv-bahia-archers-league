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
  type PlannedMember,
  type StakeMap,
  type Unit,
} from '@bal/shared';
import { type ClientSession, ObjectId } from 'mongodb';
import { iniciarSesion } from '../db/sesion.js';
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
        registrationUrl: input.registrationUrl ?? null,
        status: 'sin_iniciar',
        payment: { ...input.payment },
        targets,
        maxPossibleScore: maximo,
        stakeMap: {
          roja: [...stakeMap.roja],
          azul: [...stakeMap.azul],
          amarilla: [...stakeMap.amarilla],
          naranja: [...stakeMap.naranja],
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

export function aParticipantInput(arqueros: readonly ArcherDoc[]): ParticipantInput[] {
  return arqueros.map((a) => ({
    archerId: a._id.toHexString(),
    firstName: a.firstName,
    lastName: a.lastName,
    category: a.category,
    // `exactOptionalPropertyTypes`: sin sexo cargado, la clave se omite en vez
    // de escribirse como `undefined`.
    ...(a.sex ? { sex: a.sex } : {}),
  }));
}

/**
 * El documento de una patrulla nueva, con su usuario y un PIN propio. El PIN se guarda
 * **hasheado** (para verificarlo en el login) y **cifrado** (para que el admin pueda volver a
 * mostrarlo). Ver `docs/SECURITY.md` §9.
 *
 * Lo usan el armado inicial y la redistribución cuando el admin crea una (`BE-30`): es **un solo
 * lugar** donde se generan credenciales de patrulla.
 */
export async function patrullaNueva(
  tournamentId: ObjectId,
  numero: number,
  startTargetIndex: number,
  ahora: Date,
): Promise<PatrolDoc> {
  const pin = generatePin(6);
  return {
    _id: new ObjectId(),
    tournamentId,
    number: numero,
    startTargetIndex,
    username: `patrulla${numero}`,
    pinHash: await hashSecret(pin),
    pinEnc: encryptPin(pin, env().PIN_ENC_KEY),
    pinUpdatedAt: ahora,
    status: 'pendiente',
    failedAttempts: 0,
    lockedUntil: null,
    targetsCompleted: 0,
    closedAt: null,
    manualOverride: false,
    createdAt: ahora,
    updatedAt: ahora,
  };
}

/**
 * Convierte el plan del dominio en documentos, generando las credenciales (`patrullaNueva`).
 *
 * Corre fuera de la transacción a propósito: hashear seis PIN con argon2id
 * tarda cientos de milisegundos y mantener la transacción abierta ese tiempo
 * sostiene locks sin necesidad.
 */
export async function materializar(
  plan: PatrolPlan,
  tournamentId: ObjectId,
  ahora: Date,
): Promise<{ patrolDocs: PatrolDoc[]; participantDocs: ParticipantDoc[] }> {
  const patrolDocs: PatrolDoc[] = [];
  const participantDocs: ParticipantDoc[] = [];

  for (const patrulla of plan.patrols) {
    const doc = await patrullaNueva(
      tournamentId,
      patrulla.number,
      patrulla.startTargetIndex,
      ahora,
    );
    const patrolId = doc._id;
    patrolDocs.push(doc);

    for (const unidad of patrulla.units) {
      for (const miembro of unidad.members) {
        participantDocs.push(
          participanteNuevo(miembro, unidad.label, tournamentId, patrolId, ahora),
        );
      }
    }
  }

  return { patrolDocs, participantDocs };
}

/**
 * El documento de un participante recién inscripto, en su patrulla, unidad y posición. Lo usan el
 * armado (`materializar`) y la incorporación sin rearmar (`BE-31`): un solo lugar decide cómo
 * arranca un participante (totales en cero, sin pagar, sin firma).
 */
export function participanteNuevo(
  miembro: PlannedMember,
  unit: Unit,
  tournamentId: ObjectId,
  patrolId: ObjectId,
  ahora: Date,
): ParticipantDoc {
  return {
    _id: new ObjectId(),
    tournamentId,
    patrolId,
    archerId: new ObjectId(miembro.archerId),
    // Snapshot congelado: el histórico no cambia si el arquero se edita
    // o se archiva después. Ver docs/ARCHITECTURE.md §5, decisión 2.
    firstName: miembro.firstName,
    lastName: miembro.lastName,
    category: miembro.category,
    sex: miembro.sex ?? null,
    stake: miembro.stake,
    unit,
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
    paid: false,
    signature: null,
    createdAt: ahora,
    updatedAt: ahora,
  };
}

/** Ejecuta el callback dentro de una transacción. */
export async function conTransaccion<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = iniciarSesion();
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
