/**
 * Rutas de WAFL.
 *
 * Todas exigen sesión de patrulla. La autorización fina —que el participante
 * sea de **esta** patrulla— se verifica op por op en `syncService`, no acá:
 * un batch puede traer 200 y cualquiera podría apuntar a un ajeno.
 *
 * Ver `docs/TECHNICAL.md` §3.5 y `docs/SECURITY.md` §4.
 */

import { SyncBatchSchema } from '@bal/shared';
import { Hono } from 'hono';
import { AppError } from '../lib/errors.js';
import { currentSubject, requirePatrol } from '../middleware/auth.js';
import { parseJsonBody } from '../middleware/validate.js';
import * as syncService from '../services/syncService.js';
import * as waflService from '../services/waflService.js';

/** La sesión de patrulla siempre trae su torneo; si no, algo se corrompió. */
function contexto(c: Parameters<typeof currentSubject>[0]) {
  const subject = currentSubject(c);
  if (subject.type !== 'patrol' || !subject.tournamentId) {
    throw new AppError('UNAUTHORIZED');
  }
  return { patrolId: subject.id, tournamentId: subject.tournamentId };
}

export const wafl = new Hono()
  .use('*', requirePatrol())

  /** Todo lo necesario para el recorrido completo. Se llama una vez, al entrar. */
  .get('/bundle', async (c) => {
    const { patrolId, tournamentId } = contexto(c);
    return c.json(await waflService.getBundle(patrolId, tournamentId));
  })

  /** Estado server-side, para reconciliar tras cambiar de dispositivo. */
  .get('/state', async (c) => {
    const { patrolId, tournamentId } = contexto(c);
    const bundle = await waflService.getBundle(patrolId, tournamentId);
    return c.json({
      patrol: bundle.patrol,
      scores: bundle.scores,
      signatures: bundle.signatures,
      serverTime: bundle.serverTime,
    });
  })

  /**
   * Batch de operaciones del outbox.
   *
   * Responde **200 siempre**, con el resultado individual de cada op: un
   * `close` rechazado no puede hacer que se pierdan 40 puntajes válidos del
   * mismo batch. Ver `docs/OFFLINE_SYNC.md` §6.
   */
  .post('/sync', async (c) => {
    const { patrolId, tournamentId } = contexto(c);
    const batch = await parseJsonBody(c, SyncBatchSchema);
    return c.json(await syncService.sync(batch, patrolId, tournamentId));
  });
