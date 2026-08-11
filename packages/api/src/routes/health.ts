/**
 * Healthcheck. Lo consulta Railway. Ver `docs/CONFIG.md` §7.
 */

import { Hono } from 'hono';
import { ping } from '../db/client.js';

export const APP_VERSION = process.env.npm_package_version ?? '0.1.0';

const arranque = Date.now();

export const health = new Hono().get('/', async (c) => {
  const dbOk = await ping();

  return c.json({
    status: dbOk ? 'ok' : 'degraded',
    version: APP_VERSION,
    db: dbOk ? 'ok' : 'degraded',
    uptime: Math.floor((Date.now() - arranque) / 1000),
  });
});
