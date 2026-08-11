/**
 * Infraestructura de tests de integración.
 *
 * Levanta un MongoDB real en memoria **en modo replica set**: las transacciones
 * multi-documento lo exigen, y sin ellas no se puede probar lo que más importa
 * (crear torneo, aplicar un puntaje con sus rollups, publicar).
 *
 * Ver `docs/TESTING.md` §4.
 */

import type { Db } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connect, disconnect } from '../src/db/client.js';
import { ensureIndexes } from '../src/db/indexes.js';
import { reset } from '../src/db/reset.js';
import type { Env } from '../src/env.js';
import { loadEnv } from '../src/env.js';

let replSet: MongoMemoryReplSet | undefined;

/** Variables de entorno válidas para tests. Se pueden sobrescribir por caso. */
export function testEnvRaw(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://localhost:27017',
    MONGODB_DB: 'bal_test',
    SESSION_SECRET: 'a'.repeat(48),
    PIN_ENC_KEY: '1'.repeat(64),
    ADMIN_USERNAME: 'admin',
    ADMIN_INITIAL_PASSWORD: 'password-de-test-1234',
    ...overrides,
  };
}

export function testEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv(testEnvRaw(overrides));
}

/** Arranca el replica set y conecta. Devuelve la base lista con sus índices. */
export async function startDb(): Promise<Db> {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const db = await connect({ uri: replSet.getUri(), dbName: 'bal_test' });
  await ensureIndexes(db);
  return db;
}

export async function stopDb(): Promise<void> {
  await disconnect();
  await replSet?.stop();
  replSet = undefined;
}

/** Vacía la base entre tests. Ningún test comparte estado con otro. */
export async function clearDb(db: Db): Promise<void> {
  await reset(db, testEnv());
}
