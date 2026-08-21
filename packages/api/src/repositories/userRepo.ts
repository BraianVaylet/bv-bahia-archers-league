/**
 * Acceso a `users`.
 *
 * **Ninguna consulta a MongoDB vive fuera de `repositories/`.** Es lo que
 * permite auditar la seguridad de la capa de datos en un solo lugar.
 */

import type { ObjectId } from 'mongodb';
import { users } from '../db/client.js';
import type { UserDoc } from '../db/types.js';

/**
 * Busca por nombre de usuario.
 *
 * El `username` llega ya validado y normalizado por Zod, así que es un `string`
 * y no puede ser `{ $ne: null }`. Ver `docs/SECURITY.md` §6.
 */
export function findByUsername(username: string): Promise<UserDoc | null> {
  return users().findOne({ username });
}

export function findById(id: ObjectId): Promise<UserDoc | null> {
  return users().findOne({ _id: id });
}

/** Registra un login exitoso y limpia el contador de intentos fallidos. */
export async function registerSuccessfulLogin(id: ObjectId): Promise<void> {
  await users().updateOne(
    { _id: id },
    {
      $set: {
        lastLoginAt: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      },
    },
  );
}

/**
 * Suma un intento fallido y, si se llegó al tope, bloquea hasta `lockedUntil`.
 *
 * Se hace en una sola operación atómica: dos intentos simultáneos no pueden
 * pisarse el contador.
 */
export async function registerFailedAttempt(
  id: ObjectId,
  maxAttempts: number,
  lockMs: number,
): Promise<void> {
  const actualizado = await users().findOneAndUpdate(
    { _id: id },
    { $inc: { failedAttempts: 1 }, $set: { updatedAt: new Date() } },
    { returnDocument: 'after' },
  );

  if (actualizado && actualizado.failedAttempts >= maxAttempts) {
    await users().updateOne(
      { _id: id },
      { $set: { lockedUntil: new Date(Date.now() + lockMs), failedAttempts: 0 } },
    );
  }
}

export async function updatePassword(id: ObjectId, passwordHash: string): Promise<void> {
  await users().updateOne(
    { _id: id },
    { $set: { passwordHash, mustChangePassword: false, updatedAt: new Date() } },
  );
}

/**
 * Password nuevo por recuperación, con el código de `ADMIN_INITIAL_PASSWORD`.
 *
 * Hace lo mismo que `updatePassword` y además **levanta el bloqueo**: estar
 * bloqueado por intentos fallidos es justo el escenario previo típico a que
 * alguien busque recuperar la cuenta. Si el reset no lo levantara, el dueño
 * recupera el password y sigue sin poder entrar durante quince minutos.
 */
export async function recoverPassword(id: ObjectId, passwordHash: string): Promise<void> {
  await users().updateOne(
    { _id: id },
    {
      $set: {
        passwordHash,
        mustChangePassword: false,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      },
    },
  );
}
