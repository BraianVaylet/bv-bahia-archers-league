/**
 * Autenticación de administrador.
 *
 * Ver `docs/SECURITY.md` §3.1 y §8.
 */

import type { AdminLoginInput, ChangePasswordInput } from '@bal/shared';
import type { Context } from 'hono';
import { env } from '../env.js';
import { getDummyHash, hashSecret, verifySecret } from '../lib/crypto.js';
import { AppError } from '../lib/errors.js';
import { endAllSessionsFor, startSession } from '../lib/session.js';
import * as userRepo from '../repositories/userRepo.js';

export interface AdminSessionInfo {
  readonly id: string;
  readonly username: string;
  readonly mustChangePassword: boolean;
}

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60_000;

/** Mismo error para usuario inexistente y password incorrecto: no se puede enumerar. */
const credencialesInvalidas = () =>
  new AppError('UNAUTHORIZED', { message: 'Usuario o password incorrectos.' });

/**
 * Verifica las credenciales del admin y abre la sesión.
 *
 * **Timing-safe**: si el usuario no existe se compara igual contra un hash de
 * referencia. Sin eso, un login contra una cuenta inexistente responde en
 * microsegundos y uno contra una real tarda lo que tarda argon2id, y esa
 * diferencia permite enumerar cuentas midiendo el tiempo.
 */
export async function loginAdmin(c: Context, input: AdminLoginInput): Promise<AdminSessionInfo> {
  const user = await userRepo.findByUsername(input.username);

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const segundos = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
    throw new AppError('RATE_LIMITED', {
      message: 'Demasiados intentos fallidos. Probá de nuevo en un rato.',
      headers: { 'Retry-After': String(segundos) },
    });
  }

  const hash = user?.passwordHash ?? (await getDummyHash());
  const coincide = await verifySecret(hash, input.password);

  if (!user || !coincide) {
    if (user) await userRepo.registerFailedAttempt(user._id, MAX_INTENTOS, BLOQUEO_MS);
    throw credencialesInvalidas();
  }

  await userRepo.registerSuccessfulLogin(user._id);
  await startSession(c, { type: 'admin', id: user._id });

  return {
    id: user._id.toHexString(),
    username: user.username,
    mustChangePassword: user.mustChangePassword,
  };
}

/**
 * Cambia el password del admin.
 *
 * Invalida **todas** las demás sesiones: si el motivo del cambio es que el
 * password se filtró, dejar vivas las sesiones abiertas no arregla nada.
 */
export async function changeAdminPassword(
  c: Context,
  userId: import('mongodb').ObjectId,
  input: ChangePasswordInput,
): Promise<void> {
  const user = await userRepo.findById(userId);
  if (!user) throw new AppError('UNAUTHORIZED');

  if (!(await verifySecret(user.passwordHash, input.currentPassword))) {
    throw new AppError('UNAUTHORIZED', { message: 'El password actual no es correcto.' });
  }

  await userRepo.updatePassword(userId, await hashSecret(input.newPassword));
  await endAllSessionsFor('admin', userId);

  // La sesión actual también se invalidó, así que se abre una nueva: el usuario
  // acaba de demostrar que conoce el password.
  await startSession(c, { type: 'admin', id: userId });
}

/** Datos del admin de la sesión, para `GET /api/auth/me`. */
export async function getAdminInfo(
  userId: import('mongodb').ObjectId,
): Promise<AdminSessionInfo | null> {
  const user = await userRepo.findById(userId);
  if (!user) return null;

  return {
    id: user._id.toHexString(),
    username: user.username,
    mustChangePassword: user.mustChangePassword,
  };
}

/** Configuración del bloqueo, expuesta para los tests. */
export const LOCK_POLICY = { maxAttempts: MAX_INTENTOS, lockMs: BLOQUEO_MS } as const;

/** Ventana de rate limit del login, en milisegundos. */
export const loginWindowMs = (): number => env().RATE_LIMIT_LOGIN_WINDOW_MIN * 60_000;
