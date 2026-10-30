/**
 * Healthcheck. Lo consulta Railway. Ver `docs/CONFIG.md` §7.
 */

import { Hono } from 'hono';
import { ping } from '../db/client.js';

export const APP_VERSION = process.env.npm_package_version ?? '0.1.0';

const arranque = Date.now();

export const health = new Hono().get('/', async (c) => {
  const desde = performance.now();
  const dbOk = await ping();
  const dbMs = Math.round(performance.now() - desde);

  return c.json({
    status: dbOk ? 'ok' : 'degraded',
    version: APP_VERSION,
    db: dbOk ? 'ok' : 'degraded',
    // Cuánto tardó el `ping` a la base: es el costo de cada viaje, y la
    // sincronización hace varios por cada puntaje. Con Railway y Atlas en la misma
    // región son unos pocos ms; en regiones distintas, decenas. Ver `CONFIG.md` §7.
    // La primera consulta tras un arranque en frío incluye abrir la conexión.
    dbMs: dbOk ? dbMs : null,
    uptime: Math.floor((Date.now() - arranque) / 1000),
  });
});
