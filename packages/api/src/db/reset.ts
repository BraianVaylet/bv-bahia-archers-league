/**
 * Vacía la base. **Sólo desarrollo y tests.**
 *
 * Ver `docs/CONFIG.md` §4.5.
 */

import type { Db } from 'mongodb';
import { type Env, env as loadEnv } from '../env.js';
import { COLLECTIONS } from './types.js';

export class ResetForbiddenError extends Error {
  readonly code = 'RESET_FORBIDDEN';

  constructor() {
    super('db:reset está deshabilitado en producción.');
    this.name = 'ResetForbiddenError';
  }
}

/**
 * Borra el contenido de todas las colecciones conocidas.
 *
 * @throws {ResetForbiddenError} si `NODE_ENV=production`. No hay flag para
 *   forzarlo: si alguna vez hace falta vaciar producción, se hace a mano y con
 *   backup, no con un comando que se puede tipear por accidente.
 */
export async function reset(db: Db, env: Env = loadEnv()): Promise<void> {
  if (env.isProduction) {
    throw new ResetForbiddenError();
  }

  await Promise.all(
    Object.values(COLLECTIONS).map((nombre) => db.collection(nombre).deleteMany({})),
  );
}
