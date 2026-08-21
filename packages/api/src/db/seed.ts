/**
 * Siembra los datos mínimos para operar: el administrador inicial.
 *
 * **Idempotente: si el admin ya existe, no lo toca.** Nunca pisa un password
 * que el usuario ya cambió, ni siquiera si cambió `ADMIN_INITIAL_PASSWORD`.
 *
 * Esto último fue distinto por un tiempo: el arranque reseteaba el password
 * cuando la variable cambiaba. Era **inútil el día del torneo** —exigía un
 * redeploy— y con la recuperación por interfaz pasó a ser dañino: rotar el
 * código de recuperación habría borrado el password del admin en el próximo
 * deploy, sin que nadie lo pidiera.
 *
 * La recuperación vive ahora en `POST /api/auth/admin/recover`, que compara
 * contra el valor **vigente** de la variable y no necesita reiniciar nada.
 *
 * Ver `docs/SECURITY.md` §3.1 y `docs/CONFIG.md` §7.1.
 */

import type { Db } from 'mongodb';
import { type Env, env as loadEnv } from '../env.js';
import { hashSecret } from '../lib/crypto.js';
import { COLLECTIONS, type UserDoc } from './types.js';

export interface SeedResult {
  readonly adminCreated: boolean;
  readonly adminUsername: string;
}

/**
 * Crea el administrador inicial con `mustChangePassword: true`.
 *
 * El password sale de `ADMIN_INITIAL_PASSWORD`, **nunca del código**. En
 * producción el arranque ya falló si no estaba, si era el valor de desarrollo o
 * si tenía menos de 12 caracteres: ver `env.ts`.
 */
export async function seed(db: Db, env: Env = loadEnv()): Promise<SeedResult> {
  const users = db.collection<UserDoc>(COLLECTIONS.users);
  const username = env.ADMIN_USERNAME.toLowerCase();

  const existente = await users.findOne({ username });
  if (existente) {
    return { adminCreated: false, adminUsername: username };
  }

  const ahora = new Date();
  await users.insertOne({
    username,
    passwordHash: await hashSecret(env.ADMIN_INITIAL_PASSWORD),
    // Obliga a cambiarlo en el primer login: el password del deploy no puede
    // quedar como password permanente.
    mustChangePassword: true,
    lastLoginAt: null,
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: ahora,
    updatedAt: ahora,
  } as UserDoc);

  return { adminCreated: true, adminUsername: username };
}
