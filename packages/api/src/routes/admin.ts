/**
 * Rutas de administración.
 *
 * Todas exigen sesión de admin y pasan por `csrfProtection`, que se aplica a
 * nivel de app. Ver `docs/TECHNICAL.md` §3.2 y §3.3.
 */

import {
  ArcherInputSchema,
  CreateTournamentSchema,
  MarkPaymentSchema,
  ObjectIdSchema,
  PatrolDistributionSchema,
  SeasonInputSchema,
  UpdateTournamentSchema,
} from '@bal/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { notFound } from '../lib/errors.js';
import { toObjectId } from '../lib/ids.js';
import { currentAdminId, requireAdmin } from '../middleware/auth.js';
import { clientIp } from '../middleware/rateLimit.js';
import { parseJsonBody, parseQuery } from '../middleware/validate.js';
import * as seasonRepo from '../repositories/seasonRepo.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';
import * as archerService from '../services/archerService.js';
import * as patrolAdminService from '../services/patrolAdminService.js';
import * as paymentService from '../services/paymentService.js';
import * as publishService from '../services/publishService.js';
import * as tournamentEditService from '../services/tournamentEditService.js';
import * as tournamentService from '../services/tournamentService.js';
import * as tournamentStateService from '../services/tournamentStateService.js';

const ListArchersQuery = z
  .strictObject({
    archived: z.enum(['true', 'false']).optional(),
    q: z.string().max(60).optional(),
  })
  .transform((v) => ({ archived: v.archived === 'true', query: v.q }));

const ListTournamentsQuery = z.strictObject({
  status: z.enum(['sin_iniciar', 'en_proceso', 'completado', 'publicado']).optional(),
  seasonId: ObjectIdSchema.optional(),
});

export const admin = new Hono()
  .use('*', requireAdmin())

  // ── Arqueros ───────────────────────────────────────────────────────────────

  .get('/archers', async (c) => {
    const { archived, query } = parseQuery(c, ListArchersQuery);
    return c.json({ archers: await archerService.list({ archived, ...(query ? { query } : {}) }) });
  })

  .post('/archers', async (c) => {
    const input = await parseJsonBody(c, ArcherInputSchema);
    return c.json({ archer: await archerService.create(input) }, 201);
  })

  .patch('/archers/:id', async (c) => {
    const input = await parseJsonBody(c, ArcherInputSchema);
    return c.json({ archer: await archerService.update(toObjectId(c.req.param('id')), input) });
  })

  .post('/archers/:id/archive', async (c) => {
    return c.json({ archer: await archerService.setArchived(toObjectId(c.req.param('id')), true) });
  })

  .post('/archers/:id/restore', async (c) => {
    return c.json({
      archer: await archerService.setArchived(toObjectId(c.req.param('id')), false),
    });
  })

  .delete('/archers/:id', async (c) => {
    await archerService.remove(toObjectId(c.req.param('id')));
    return c.json({ ok: true });
  })

  // ── Temporadas ─────────────────────────────────────────────────────────────

  .get('/seasons', async (c) => {
    const docs = await seasonRepo.list();
    return c.json({
      seasons: docs.map((s) => ({
        id: s._id.toHexString(),
        name: s.name,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        status: s.status,
      })),
    });
  })

  .post('/seasons', async (c) => {
    const input = await parseJsonBody(c, SeasonInputSchema);
    const doc = await seasonRepo.create(input);
    return c.json({ season: { id: doc._id.toHexString(), name: doc.name } }, 201);
  })

  .patch('/seasons/:id', async (c) => {
    const input = await parseJsonBody(c, SeasonInputSchema);
    const doc = await seasonRepo.update(toObjectId(c.req.param('id')), input);
    if (!doc) throw notFound();
    return c.json({ season: { id: doc._id.toHexString(), name: doc.name } });
  })

  // ── Torneos ────────────────────────────────────────────────────────────────

  .post('/tournaments', async (c) => {
    const input = await parseJsonBody(c, CreateTournamentSchema);
    const creado = await tournamentService.createTournament(input, currentAdminId(c));
    return c.json({ tournament: creado }, 201);
  })

  .get('/tournaments', async (c) => {
    const q = parseQuery(c, ListTournamentsQuery);
    const docs = await tournamentRepo.list({
      ...(q.status ? { status: q.status } : {}),
      ...(q.seasonId ? { seasonId: toObjectId(q.seasonId) } : {}),
    });

    return c.json({
      tournaments: docs.map((t) => ({
        id: t._id.toHexString(),
        name: t.name,
        date: t.date,
        status: t.status,
        targetCount: t.targets.length,
        patrolCount: t.patrolCount,
        participantCount: t.participantCount,
        maxPossibleScore: t.maxPossibleScore,
      })),
    });
  })

  .post('/tournaments/:id/start', async (c) => {
    const doc = await tournamentStateService.start(toObjectId(c.req.param('id')));
    return c.json({ tournament: { id: doc._id.toHexString(), status: doc.status } });
  })

  .patch('/tournaments/:id', async (c) => {
    const input = await parseJsonBody(c, UpdateTournamentSchema);
    const doc = await tournamentEditService.updateTournament(
      toObjectId(c.req.param('id')),
      input,
      currentAdminId(c),
    );
    return c.json({
      tournament: { id: doc._id.toHexString(), maxPossibleScore: doc.maxPossibleScore },
    });
  })

  .delete('/tournaments/:id', async (c) => {
    await tournamentEditService.removeTournament(toObjectId(c.req.param('id')));
    return c.json({ ok: true });
  })

  .post('/tournaments/:id/publish', async (c) => {
    return c.json(await publishService.publish(toObjectId(c.req.param('id')), currentAdminId(c)));
  })

  .post('/tournaments/:id/unpublish', async (c) => {
    const { reason } = await parseJsonBody(
      c,
      z.strictObject({ reason: z.string().trim().min(5).max(500) }),
    );
    return c.json(
      await publishService.unpublish(toObjectId(c.req.param('id')), currentAdminId(c), reason),
    );
  })

  .get('/tournaments/:id/patrols', async (c) => {
    const id = toObjectId(c.req.param('id'));
    const [patrols, violations] = await Promise.all([
      patrolAdminService.listPatrols(id, currentAdminId(c), clientIp(c)),
      patrolAdminService.validateCurrentDistribution(id),
    ]);
    return c.json({ patrols, violations });
  })

  /**
   * Redistribución manual. **Avisa pero no bloquea**: la respuesta trae las
   * violaciones que el admin acaba de aceptar. Ver `FUNCTIONAL.md` §6.6.
   */
  .put('/tournaments/:id/patrols', async (c) => {
    const id = toObjectId(c.req.param('id'));
    const input = await parseJsonBody(c, PatrolDistributionSchema);

    await patrolAdminService.redistribute(id, input, currentAdminId(c), clientIp(c));

    const [patrols, violations] = await Promise.all([
      patrolAdminService.listPatrols(id, currentAdminId(c), clientIp(c)),
      patrolAdminService.validateCurrentDistribution(id),
    ]);
    return c.json({ patrols, violations });
  })

  /**
   * Resultados con los rollups de cada participante.
   *
   * Es lo que le falta a WAFA para seguir un torneo en curso y para previsualizar
   * los podios **antes** de publicar. A diferencia del endpoint público, acá sí se
   * ven los puntajes de un torneo `completado`: el admin tiene que poder revisar
   * lo que está por aplicar a la liga.
   */
  .get('/tournaments/:id/results', async (c) => {
    const id = toObjectId(c.req.param('id'));
    const doc = await tournamentRepo.findById(id);
    if (!doc) throw notFound();

    const [miembros, patrullas] = await Promise.all([
      tournamentRepo.listParticipants(id),
      tournamentRepo.listPatrols(id),
    ]);
    const numeroDePatrulla = new Map(patrullas.map((p) => [p._id.toHexString(), p.number]));

    return c.json({
      maxPossibleScore: doc.maxPossibleScore,
      participants: miembros.map((m) => ({
        id: m._id.toHexString(),
        archerId: m.archerId.toHexString(),
        firstName: m.firstName,
        lastName: m.lastName,
        category: m.category,
        stake: m.stake,
        patrolNumber: numeroDePatrulla.get(m.patrolId.toHexString()) ?? 0,
        total: m.total,
        normalizedPct: m.normalizedPct,
        innerCount: m.innerCount,
        tenCount: m.tenCount,
        mCount: m.mCount,
        targetsCompleted: m.targetsCompleted,
        status: m.status,
        signed: m.signature !== null,
        // Que la firma haya sido desbloqueada no se oculta: el podio se mira
        // distinto si alguien no firmó de puño y letra.
        signatureUnlocked: m.signature?.unlockedBy != null,
      })),
    });
  })

  /**
   * Estado de los pagos, con la recaudación derivada.
   *
   * Va bajo `/admin` y no en el endpoint público: quién pagó y quién no es
   * información del club, no del ranking.
   */
  .get('/tournaments/:id/payments', async (c) => {
    return c.json(await paymentService.summary(toObjectId(c.req.param('id'))));
  })

  .post('/participants/:id/payment', async (c) => {
    const { paid } = await parseJsonBody(c, MarkPaymentSchema);
    return c.json(await paymentService.setPaid(toObjectId(c.req.param('id')), paid));
  })

  .get('/tournaments/:id/locked-targets', async (c) => {
    const doc = await tournamentRepo.findById(toObjectId(c.req.param('id')));
    if (!doc) throw notFound();
    return c.json({ lockedTargets: await tournamentEditService.blancosBloqueados(doc) });
  })

  .post('/patrols/:id/pin/regenerate', async (c) => {
    return c.json(
      await patrolAdminService.regeneratePin(toObjectId(c.req.param('id')), currentAdminId(c)),
    );
  })

  .post('/participants/:id/signature/unlock', async (c) => {
    const { reason } = await parseJsonBody(
      c,
      z.strictObject({ reason: z.string().trim().min(5).max(500) }),
    );
    await patrolAdminService.unlockSignature(
      toObjectId(c.req.param('id')),
      reason,
      currentAdminId(c),
      clientIp(c),
    );
    return c.json({ ok: true });
  })

  .get('/tournaments/:id', async (c) => {
    const doc = await tournamentRepo.findById(toObjectId(c.req.param('id')));
    if (!doc) throw notFound();

    return c.json({
      tournament: {
        id: doc._id.toHexString(),
        seasonId: doc.seasonId.toHexString(),
        name: doc.name,
        date: doc.date,
        description: doc.description,
        status: doc.status,
        payment: doc.payment,
        targets: doc.targets,
        maxPossibleScore: doc.maxPossibleScore,
        stakeMap: doc.stakeMap,
        patrolCount: doc.patrolCount,
        participantCount: doc.participantCount,
      },
    });
  });
