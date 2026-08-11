/**
 * Gestión de patrullas desde WAFA.
 *
 * Incluye la lectura del PIN, que es el tradeoff documentado en
 * `docs/SECURITY.md` §9: se guarda cifrado además de hasheado para que el admin
 * pueda volver a mostrarlo, y **cada visualización queda en el audit log**.
 */

import { validatePatrols } from '@bal/shared';
import type { ObjectId } from 'mongodb';
import { env } from '../env.js';
import { decryptPin, encryptPin, generatePin, hashSecret } from '../lib/crypto.js';
import { AppError, notFound } from '../lib/errors.js';
import { endAllSessionsFor } from '../lib/session.js';
import * as auditRepo from '../repositories/auditRepo.js';
import * as patrolRepo from '../repositories/patrolRepo.js';
import * as scoreRepo from '../repositories/scoreRepo.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';

export interface PatrolView {
  readonly id: string;
  readonly number: number;
  readonly startTargetIndex: number;
  readonly username: string;
  readonly status: string;
  readonly targetsCompleted: number;
  readonly members: readonly {
    id: string;
    firstName: string;
    lastName: string;
    category: string;
    stake: string;
    unit: string;
    position: string;
    signed: boolean;
  }[];
  /** Sólo presente si el torneo todavía no se publicó. */
  readonly pin?: string;
}

/**
 * Lista las patrullas con su composición y, si corresponde, su PIN.
 *
 * El PIN se descifra **sólo** mientras el torneo no está publicado, y la lectura
 * queda registrada. Una vez publicado, la credencial ya no sirve para nada y no
 * hay motivo para exponerla.
 */
export async function listPatrols(
  tournamentId: ObjectId,
  actorId: ObjectId,
  ip: string | null,
): Promise<PatrolView[]> {
  const torneo = await tournamentRepo.findById(tournamentId);
  if (!torneo) throw notFound();

  const mostrarPin = torneo.status !== 'publicado';
  const [patrullas, miembros] = await Promise.all([
    patrolRepo.listByTournament(tournamentId),
    tournamentRepo.listParticipants(tournamentId),
  ]);

  if (mostrarPin && patrullas.length > 0) {
    await auditRepo.record({
      actorType: 'admin',
      actorId,
      action: 'patrol.pin.reveal',
      entity: 'tournament',
      entityId: tournamentId,
      meta: { patrols: patrullas.length },
      ip,
    });
  }

  const cfg = env();

  return patrullas.map((p) => ({
    id: p._id.toHexString(),
    number: p.number,
    startTargetIndex: p.startTargetIndex,
    username: p.username,
    status: p.status,
    targetsCompleted: p.targetsCompleted,
    members: miembros
      .filter((m) => m.patrolId.equals(p._id))
      .map((m) => ({
        id: m._id.toHexString(),
        firstName: m.firstName,
        lastName: m.lastName,
        category: m.category,
        stake: m.stake,
        unit: m.unit,
        position: m.position,
        signed: m.signature !== null,
      })),
    ...(mostrarPin ? { pin: decryptPin(p.pinEnc, cfg.PIN_ENC_KEY) } : {}),
  }));
}

/**
 * Genera un PIN nuevo e **invalida las sesiones activas** de esa patrulla.
 *
 * Si el motivo del cambio es que el PIN se filtró, dejar viva la sesión abierta
 * no arregla nada.
 */
export async function regeneratePin(
  patrolId: ObjectId,
  actorId: ObjectId,
): Promise<{ username: string; pin: string }> {
  const patrulla = await patrolRepo.findById(patrolId);
  if (!patrulla) throw notFound();

  const cfg = env();
  const pin = generatePin(6);

  await patrolRepo.setStatus(patrolId, patrulla.status, {
    pinHash: await hashSecret(pin),
    pinEnc: encryptPin(pin, cfg.PIN_ENC_KEY),
    pinUpdatedAt: new Date(),
    failedAttempts: 0,
    lockedUntil: null,
  });

  await endAllSessionsFor('patrol', patrolId);

  await auditRepo.record({
    actorType: 'admin',
    actorId,
    action: 'patrol.pin.regenerate',
    entity: 'patrol',
    entityId: patrolId,
    meta: { number: patrulla.number },
  });

  return { username: patrulla.username, pin };
}

/**
 * Desbloquea la firma de un participante.
 *
 * Es el escape para el caso real de que un arquero se vaya antes de firmar.
 * **No se oculta**: queda `unlockedBy`, `unlockReason` y una entrada en el audit
 * log, y el detalle del torneo lo muestra. Ver `docs/SECURITY.md` §7.
 */
export async function unlockSignature(
  participantId: ObjectId,
  reason: string,
  actorId: ObjectId,
  ip: string | null,
): Promise<void> {
  const participante = await scoreRepo.findParticipant(participantId);
  if (!participante) throw notFound();

  if (participante.signature !== null) {
    throw new AppError('INVALID_STATE_TRANSITION', {
      message: 'Ese arquero ya firmó.',
    });
  }

  // El hash se calcula igual que en una firma real: el desbloqueo autoriza
  // cerrar sin el trazo, pero NO renuncia a detectar que el puntaje cambie
  // después. Si cambia, el cierre lo sigue frenando con SIGNATURE_MISMATCH.
  const scorecardHash = await scoreRepo.scorecardHashOf(participante);

  const session = (await import('../db/client.js')).getClient().startSession();
  try {
    await session.withTransaction(async () => {
      await scoreRepo.setSignature(
        participantId,
        {
          // Sin trazo: nadie firmó. Lo que queda registrado es la excepción.
          pngDataUrl: '',
          signedAt: new Date(),
          scorecardHash,
          unlockedBy: actorId,
          unlockReason: reason,
        },
        session,
      );

      await auditRepo.record(
        {
          actorType: 'admin',
          actorId,
          action: 'signature.unlock',
          entity: 'participant',
          entityId: participantId,
          meta: { reason, archer: `${participante.lastName}, ${participante.firstName}` },
          ip,
        },
        session,
      );
    });
  } finally {
    await session.endSession();
  }
}

/** Verifica las restricciones `H1`..`H4` sobre la distribución actual. */
export async function validateCurrentDistribution(tournamentId: ObjectId) {
  const [patrullas, miembros] = await Promise.all([
    patrolRepo.listByTournament(tournamentId),
    tournamentRepo.listParticipants(tournamentId),
  ]);

  const planned = patrullas.map((p) => {
    const propios = miembros.filter((m) => m.patrolId.equals(p._id));
    const unidades = ['A', 'B'] as const;

    return {
      number: p.number,
      startTargetIndex: p.startTargetIndex,
      units: unidades
        .filter((u) => propios.some((m) => m.unit === u))
        .map((u) => {
          const deLaUnidad = propios.filter((m) => m.unit === u);
          return {
            label: u,
            // biome-ignore lint/style/noNonNullAssertion: el filter garantiza al menos uno
            category: deLaUnidad[0]!.category,
            // biome-ignore lint/style/noNonNullAssertion: idem
            stake: deLaUnidad[0]!.stake,
            members: deLaUnidad.map((m) => ({
              archerId: m.archerId.toHexString(),
              firstName: m.firstName,
              lastName: m.lastName,
              category: m.category,
              stake: m.stake,
              position: m.position,
            })),
          };
        }),
    };
  });

  return validatePatrols(planned);
}
