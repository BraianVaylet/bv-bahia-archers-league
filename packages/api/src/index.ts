/**
 * Punto de entrada del backend.
 *
 * Ver `docs/ARCHITECTURE.md` §3 y `docs/CONFIG.md` §7.
 */

import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { connect, disconnect } from './db/client.js';
import { ensureIndexes } from './db/indexes.js';
import { seed } from './db/seed.js';
import { env } from './env.js';

async function main(): Promise<void> {
  // `env()` valida la configuración y falla ruidosamente si algo no cierra.
  // Es deliberado que ocurra antes de abrir el puerto: un servidor de producción
  // que levanta con un secreto de desarrollo es peor que uno que no levanta.
  const cfg = env();

  const db = await connect();
  await ensureIndexes(db);
  const siembra = await seed(db, cfg);

  /*
    El reset se anuncia en el log del arranque.

    Es donde mira el operador que acaba de cambiar la variable en Railway, y es
    la confirmación de que el cambio surtió efecto: sin esto tendría que
    probar el login para saber si funcionó.

    También es la señal si el reset ocurre **sin que nadie lo pidiera** —una
    variable mal copiada en un redeploy— porque el password del admin habría
    cambiado sin aviso.
  */
  if (siembra.adminReset) {
    console.warn(
      `ADMIN_INITIAL_PASSWORD cambió: el password de «${siembra.adminUsername}» quedó reseteado ` +
        'y se va a exigir uno nuevo en el próximo ingreso.',
    );
  }

  const app = createApp();

  const server = serve({ fetch: app.fetch, port: cfg.PORT }, (info) => {
    console.info(`@bal/api escuchando en :${info.port} (${cfg.NODE_ENV})`);
  });

  const apagar = async (señal: string) => {
    console.info(`${señal} recibida, cerrando.`);
    server.close();
    await disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => void apagar('SIGTERM'));
  process.on('SIGINT', () => void apagar('SIGINT'));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
