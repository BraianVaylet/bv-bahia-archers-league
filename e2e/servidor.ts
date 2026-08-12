/**
 * Levanta el stack completo para los E2E.
 *
 * Un solo proceso: MongoDB efímero en modo replica set —las transacciones lo
 * exigen— más la API sirviendo los dos frontends construidos, igual que en
 * producción. **Un solo origen**, que es lo que hace que las cookies y el
 * service worker se comporten como el día del torneo.
 *
 * Se usa `mongodb-memory-server` y no Docker para que el E2E corra igual en la
 * máquina de cualquiera y en el runner de CI.
 *
 * Ver `docs/TESTING.md` §6.
 */

import { serve } from '@hono/node-server';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const PUERTO = Number(process.env.E2E_PORT ?? 8788);

async function main(): Promise<void> {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

  // La configuración se arma acá y no en un `.env`: un E2E que depende de un
  // archivo que alguien tiene que crear a mano no corre en CI.
  Object.assign(process.env, {
    NODE_ENV: 'production',
    PORT: String(PUERTO),
    MONGODB_URI: replSet.getUri(),
    MONGODB_DB: 'bal_e2e',
    SESSION_SECRET: 'e'.repeat(48),
    PIN_ENC_KEY: 'e'.repeat(64),
    ADMIN_USERNAME: 'admin',
    ADMIN_INITIAL_PASSWORD: process.env.E2E_ADMIN_PASSWORD ?? 'password-inicial-e2e',
    // Sin esto, los cientos de operaciones de una patrulla que vuelve del monte
    // chocarían con el límite mientras el test las manda de golpe.
    RATE_LIMIT_SYNC: '10000',
    RATE_LIMIT_PUBLIC: '10000',
    RATE_LIMIT_LOGIN: '100',
  });

  // Los módulos se importan DESPUÉS de sembrar el entorno: `env()` lo cachea al
  // primer uso, y con los imports arriba tomaría los valores de antes.
  const { createApp } = await import('../packages/api/dist/app.js');
  const { connect, disconnect } = await import('../packages/api/dist/db/client.js');
  const { ensureIndexes } = await import('../packages/api/dist/db/indexes.js');
  const { seed } = await import('../packages/api/dist/db/seed.js');
  const { env } = await import('../packages/api/dist/env.js');

  const db = await connect();
  await ensureIndexes(db);
  await seed(db, env());

  const app = createApp({ servirFrontends: true });
  const server = serve({ fetch: app.fetch, port: PUERTO }, () => {
    console.info(`stack de E2E en http://localhost:${PUERTO}`);
  });

  const apagar = async () => {
    server.close();
    await disconnect();
    await replSet.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => void apagar());
  process.on('SIGINT', () => void apagar());
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
