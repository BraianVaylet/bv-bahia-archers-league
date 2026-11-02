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
import { apagarOrdenadamente, PLAZO_DE_APAGADO_MS } from './lib/apagado.js';
import { log } from './lib/logger.js';

async function main(): Promise<void> {
  // `env()` valida la configuración y falla ruidosamente si algo no cierra.
  // Es deliberado que ocurra antes de abrir el puerto: un servidor de producción
  // que levanta con un secreto de desarrollo es peor que uno que no levanta.
  const cfg = env();

  const db = await connect();
  await ensureIndexes(db);
  await seed(db, cfg);

  const app = createApp();

  const server = serve({ fetch: app.fetch, port: cfg.PORT }, (info) => {
    log.info('servidor.escuchando', { puerto: info.port, entorno: cfg.NODE_ENV });
  });

  /** Deja de aceptar conexiones y resuelve cuando terminó el último request en vuelo. */
  const cerrarServidor = () =>
    new Promise<void>((resolver, rechazar) => {
      server.close((error) => (error ? rechazar(error) : resolver()));
    });

  let apagando = false;

  const apagar = async (señal: string) => {
    // Una segunda señal es alguien que ya no quiere esperar.
    if (apagando) {
      log.warn('apagado.forzado', { señal });
      process.exit(1);
    }
    apagando = true;

    log.info('apagado.inicio', { señal, plazoMs: PLAZO_DE_APAGADO_MS });
    const resultado = await apagarOrdenadamente({
      cerrarServidor,
      desconectar: disconnect,
      plazoMs: PLAZO_DE_APAGADO_MS,
    });
    log.info('apagado.fin', { resultado });
    process.exit(0);
  };

  process.on('SIGTERM', () => void apagar('SIGTERM'));
  process.on('SIGINT', () => void apagar('SIGINT'));
}

main().catch((error: unknown) => {
  log.error('servidor.no_arranco', { error });
  process.exit(1);
});
