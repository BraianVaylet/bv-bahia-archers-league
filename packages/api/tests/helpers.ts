/**
 * Infraestructura de tests de integración.
 *
 * Levanta un MongoDB real en memoria **en modo replica set**: las transacciones
 * multi-documento lo exigen, y sin ellas no se puede probar lo que más importa
 * (crear torneo, aplicar un puntaje con sus rollups, publicar).
 *
 * Ver `docs/TESTING.md` §4.
 */

import type { BowCategory } from '@bal/shared';
import type { Db } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
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

// ── Cliente y datos de prueba ────────────────────────────────────────────────

/**
 * Estaban escritos dentro de `tournaments.test.ts`.
 *
 * Se movieron acá al empezar `REF2-3`: el segundo archivo que los necesita es
 * el momento de moverlos, no el tercero.
 */

const PASSWORD = 'password-de-test-1234';
const CSRF = 'c'.repeat(43);

export function cliente() {
  const app = createApp();
  let sesion = '';

  const pedir = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers);
    headers.set('cookie', [`bal_csrf=${CSRF}`, sesion].filter(Boolean).join('; '));
    headers.set('x-csrf-token', CSRF);
    if (init.body) headers.set('content-type', 'application/json');

    const res = await app.request(`http://localhost${path}`, { ...init, headers });
    const set = res.headers.get('set-cookie');
    if (set?.includes('bal_session=')) sesion = set.split(';')[0] ?? '';
    return res;
  };

  return {
    get: (p: string) => pedir(p),
    post: (p: string, body?: unknown) =>
      pedir(p, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) }),
    patch: (p: string, body: unknown) => pedir(p, { method: 'PATCH', body: JSON.stringify(body) }),
    put: (p: string, body: unknown) => pedir(p, { method: 'PUT', body: JSON.stringify(body) }),
    del: (p: string) => pedir(p, { method: 'DELETE' }),
  };
}

export type Cliente = ReturnType<typeof cliente>;

/** Admin con el password ya cambiado, para poder usar las rutas protegidas. */
export async function adminListo(): Promise<Cliente> {
  const c = cliente();
  await c.post('/api/auth/admin/login', { username: 'admin', password: PASSWORD });
  await c.post('/api/auth/admin/password', {
    currentPassword: PASSWORD,
    newPassword: 'un-password-nuevo-largo',
  });
  return c;
}

export async function crearArqueros(
  c: Cliente,
  defs: [BowCategory, number][],
  desde = 0,
): Promise<string[]> {
  const ids: string[] = [];
  let n = desde;
  for (const [category, cantidad] of defs) {
    for (let i = 0; i < cantidad; i++) {
      n++;
      const res = await c.post('/api/admin/archers', {
        firstName: `Nombre${n}`,
        lastName: `Apellido${String(n).padStart(3, '0')}`,
        category,
      });
      const body = (await res.json()) as { archer: { id: string } };
      ids.push(body.archer.id);
    }
  }
  return ids;
}

export async function crearTemporada(c: Cliente): Promise<string> {
  const res = await c.post('/api/admin/seasons', {
    name: 'Liga Bahiense 2026',
    startsAt: '2026-01-01',
    endsAt: '2026-12-31',
  });
  return ((await res.json()) as { season: { id: string } }).season.id;
}

/** Recorrido de referencia del brief: 14 blancos, máximo 330. */
export const recorridoDeReferencia = () => [
  ...Array.from({ length: 6 }, (_, i) => ({
    index: i + 1,
    modality: '3d',
    arrows: 2,
    description: null,
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    index: i + 7,
    modality: 'campo',
    arrows: 3,
    description: null,
  })),
  { index: 13, modality: 'aire_libre', arrows: 6, description: null },
  { index: 14, modality: 'sala', arrows: 3, description: null },
];
