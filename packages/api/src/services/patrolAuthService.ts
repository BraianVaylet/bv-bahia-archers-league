/**
 * Login del líder de patrulla.
 *
 * La credencial sólo vale mientras el torneo está `en_proceso`, y sólo puede
 * escribir sobre su propia patrulla. Ver `docs/SECURITY.md` §3.2 y §4.
 */

import type { PatrolLoginInput } from '@bal/shared';
import type { Context } from 'hono';
import type { ObjectId } from 'mongodb';
import {
  errorDeBloqueo,
  liberar,
  type PoliticaDeBloqueo,
  reservarIntento,
} from '../lib/bloqueoDeIngreso.js';
import { getDummyHash, verifySecret } from '../lib/crypto.js';
import { AppError } from '../lib/errors.js';
import { toObjectId } from '../lib/ids.js';
import { ipDelCliente } from '../lib/ip.js';
import { startSession } from '../lib/session.js';
import * as patrolRepo from '../repositories/patrolRepo.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';

/**
 * El bloqueo de una IP contra una patrulla: cinco intentos, y después 5 minutos que
 * se duplican con cada bloqueo seguido hasta 20. El techo es corto a propósito: un
 * líder trabado en el monte es un torneo parado. Ver `lib/bloqueoDeIngreso.ts`.
 */
export const POLITICA_PATRULLA: PoliticaDeBloqueo = {
  intentos: 5,
  baseMs: 5 * 60_000,
  techoMs: 20 * 60_000,
  olvidoMs: 60 * 60_000,
};

/**
 * El tope por patrulla, sumando todas las IPs, persistido en la base. A cinco volvía
 * a ser lo de antes —el usuario de cada patrulla es público— y sin él, un PIN de seis
 * dígitos probado desde muchas IPs no tiene techo. Ver `authService`.
 */
const MAX_INTENTOS_POR_CUENTA = 30;
const BLOQUEO_MS = 5 * 60_000;

export interface PatrolSessionInfo {
  readonly id: string;
  readonly number: number;
  readonly username: string;
  readonly tournamentId: string;
  readonly startTargetIndex: number;
  readonly status: string;
}

/** Mismo error para todo: no se puede distinguir qué falló. */
const credencialesInvalidas = () =>
  new AppError('UNAUTHORIZED', { message: 'Usuario, PIN o torneo incorrectos.' });

export async function loginPatrol(c: Context, input: PatrolLoginInput): Promise<PatrolSessionInfo> {
  const tournamentId = toObjectId(input.tournamentId);

  // El id canónico y no el texto que mandó el cliente: el mismo torneo en
  // mayúsculas o minúsculas es el mismo torneo, y no puede dar un cupo nuevo.
  const clave = `patrol:${tournamentId.toHexString()}:${input.username}:${ipDelCliente(c) ?? 'desconocida'}`;
  const espera = reservarIntento(clave, POLITICA_PATRULLA);
  if (espera !== null) {
    throw errorDeBloqueo(espera, 'Demasiados intentos. Esperá un momento.');
  }

  const torneo = await tournamentRepo.findById(tournamentId);
  const patrulla = torneo ? await patrolRepo.findByUsername(tournamentId, input.username) : null;

  if (patrulla?.lockedUntil && patrulla.lockedUntil > new Date()) {
    const segundos = Math.ceil((patrulla.lockedUntil.getTime() - Date.now()) / 1000);
    throw new AppError('RATE_LIMITED', {
      message: 'Demasiados intentos. Esperá un momento.',
      headers: { 'Retry-After': String(segundos) },
    });
  }

  // Se compara siempre, exista la patrulla o no: sin esto el tiempo de
  // respuesta revela qué usuarios existen. Ver docs/SECURITY.md §3.1.
  const hash = patrulla?.pinHash ?? (await getDummyHash());
  const coincide = await verifySecret(hash, input.pin);

  if (!patrulla || !coincide) {
    if (patrulla) {
      await patrolRepo.registerFailedAttempt(patrulla._id, MAX_INTENTOS_POR_CUENTA, BLOQUEO_MS);
    }
    throw credencialesInvalidas();
  }

  // La credencial sólo vale durante el torneo. Antes de iniciar no hay nada que
  // anotar; después de completado los puntajes ya están cerrados.
  if (torneo?.status !== 'en_proceso') {
    throw new AppError('INVALID_STATE_TRANSITION', {
      message:
        torneo?.status === 'sin_iniciar'
          ? 'El torneo todavía no arrancó.'
          : 'El torneo ya está cerrado.',
    });
  }

  liberar(clave);
  await patrolRepo.registerSuccessfulLogin(patrulla._id);
  if (patrulla.status === 'pendiente') {
    await patrolRepo.setStatus(patrulla._id, 'en_curso');
  }

  await startSession(c, { type: 'patrol', id: patrulla._id, tournamentId });

  return {
    id: patrulla._id.toHexString(),
    number: patrulla.number,
    username: patrulla.username,
    tournamentId: tournamentId.toHexString(),
    startTargetIndex: patrulla.startTargetIndex,
    status: patrulla.status === 'pendiente' ? 'en_curso' : patrulla.status,
  };
}

/** Id de la patrulla de la sesión. */
export function patrolIdOf(subject: { type: string; id: ObjectId }): ObjectId {
  if (subject.type !== 'patrol') throw new AppError('FORBIDDEN');
  return subject.id;
}

export const PATROL_LOCK_POLICY = {
  maxAttempts: MAX_INTENTOS_POR_CUENTA,
  lockMs: BLOQUEO_MS,
} as const;
