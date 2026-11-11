/**
 * Rutas de administración.
 *
 * Todas exigen sesión de admin y pasan por `csrfProtection`, que se aplica a
 * nivel de app. Ver `docs/TECHNICAL.md` §3.2 y §3.3.
 */

import {
  ArcherInputSchema,
  CreateTournamentSchema,
  MAX_TARGETS,
  MarkPaymentSchema,
  ObjectIdSchema,
  PatrolDistributionSchema,
  ScoreCorrectionSchema,
  SeasonInputSchema,
  UpdateTournamentSchema,
} from '@bal/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { validationError } from '../lib/errors.js';
import { toObjectId } from '../lib/ids.js';
import { ipDelCliente } from '../lib/ip.js';
import { currentAdminId, requireAdmin } from '../middleware/auth.js';
import { bodyValidado, consultaValidada } from '../middleware/validate.js';
import * as archerService from '../services/archerService.js';
import * as correccionService from '../services/correccionService.js';
import * as patrolAdminService from '../services/patrolAdminService.js';
import * as paymentService from '../services/paymentService.js';
import * as publishService from '../services/publishService.js';
import * as seasonService from '../services/seasonService.js';
import * as tournamentEditService from '../services/tournamentEditService.js';
import * as tournamentQueryService from '../services/tournamentQueryService.js';
import * as tournamentService from '../services/tournamentService.js';
import * as tournamentStateService from '../services/tournamentStateService.js';

const ListArchersQuery = z
  .strictObject({
    archived: z.enum(['true', 'false']).optional(),
    q: z.string().max(60).optional(),
    // Sin esto, `archerService.list` excluye `pendiente` por defecto. `BE-22`
    // pide `pendiente` explícito para su cola de aprobación.
    status: z.enum(['pendiente', 'aprobado']).optional(),
  })
  .transform((v) => ({ archived: v.archived === 'true', query: v.q, status: v.status }));

/**
 * Los PIN se piden con `?pins=1` y con nada más: un valor distinto o un parámetro
 * desconocido es un `400`, no un «no» silencioso (`REF6-7` / `S-7`).
 */
const ListPatrolsQuery = z
  .strictObject({ pins: z.literal('1').optional() })
  .transform((v) => ({ conPins: v.pins === '1' }));

const ListTournamentsQuery = z.strictObject({
  status: z.enum(['sin_iniciar', 'en_proceso', 'completado', 'publicado']).optional(),
  seasonId: ObjectIdSchema.optional(),
});

/** El motivo de despublicar o de desbloquear una firma: queda en la auditoría, así que no puede ser un «ok». */
const MotivoSchema = z.strictObject({ reason: z.string().trim().min(5).max(500) });

/** El número de blanco que viene en la ruta: un entero del recorrido, no cualquier string. */
const IndiceDeBlanco = z.coerce.number().int().min(1).max(MAX_TARGETS);

export const admin = new Hono()
  .use('*', requireAdmin())

  // ── Arqueros ───────────────────────────────────────────────────────────────

  .get('/archers', consultaValidada(ListArchersQuery), async (c) => {
    const { archived, query, status } = c.req.valid('query');
    return c.json({
      archers: await archerService.list({
        archived,
        ...(query ? { query } : {}),
        ...(status ? { status } : {}),
      }),
    });
  })

  .post('/archers', bodyValidado(ArcherInputSchema), async (c) => {
    const input = c.req.valid('json');
    return c.json(
      { archer: await archerService.create(input, currentAdminId(c), ipDelCliente(c)) },
      201,
    );
  })

  .patch('/archers/:id', bodyValidado(ArcherInputSchema), async (c) => {
    const input = c.req.valid('json');
    return c.json({
      archer: await archerService.update(
        toObjectId(c.req.param('id')),
        input,
        currentAdminId(c),
        ipDelCliente(c),
      ),
    });
  })

  .post('/archers/:id/archive', async (c) => {
    return c.json({
      archer: await archerService.setArchived(
        toObjectId(c.req.param('id')),
        true,
        currentAdminId(c),
        ipDelCliente(c),
      ),
    });
  })

  .post('/archers/:id/restore', async (c) => {
    return c.json({
      archer: await archerService.setArchived(
        toObjectId(c.req.param('id')),
        false,
        currentAdminId(c),
        ipDelCliente(c),
      ),
    });
  })

  .post('/archers/:id/approve', async (c) => {
    return c.json({
      archer: await archerService.approveArcher(toObjectId(c.req.param('id')), currentAdminId(c)),
    });
  })

  .post('/archers/:id/reject', async (c) => {
    await archerService.rejectArcher(toObjectId(c.req.param('id')), currentAdminId(c));
    return c.json({ ok: true });
  })

  .delete('/archers/:id', async (c) => {
    await archerService.remove(toObjectId(c.req.param('id')), currentAdminId(c), ipDelCliente(c));
    return c.json({ ok: true });
  })

  // ── Temporadas ─────────────────────────────────────────────────────────────

  .get('/seasons', async (c) => c.json({ seasons: await seasonService.listar() }))

  .post('/seasons', bodyValidado(SeasonInputSchema), async (c) => {
    const input = c.req.valid('json');
    const doc = await seasonService.create(input, currentAdminId(c), ipDelCliente(c));
    return c.json({ season: { id: doc._id.toHexString(), name: doc.name } }, 201);
  })

  .patch('/seasons/:id', bodyValidado(SeasonInputSchema), async (c) => {
    const input = c.req.valid('json');
    const doc = await seasonService.update(
      toObjectId(c.req.param('id')),
      input,
      currentAdminId(c),
      ipDelCliente(c),
    );
    return c.json({ season: { id: doc._id.toHexString(), name: doc.name } });
  })

  /**
   * Cerrar y reabrir una temporada.
   *
   * Cerrar **no borra ni congela nada**: es una marca para saber cuál está en
   * curso cuando hay varias, que es el caso normal a fin de año.
   */
  .post('/seasons/:id/archive', async (c) => {
    const doc = await seasonService.setStatus(
      toObjectId(c.req.param('id')),
      'cerrada',
      currentAdminId(c),
      ipDelCliente(c),
    );
    return c.json({ season: { id: doc._id.toHexString(), status: doc.status } });
  })

  .post('/seasons/:id/restore', async (c) => {
    const doc = await seasonService.setStatus(
      toObjectId(c.req.param('id')),
      'activa',
      currentAdminId(c),
      ipDelCliente(c),
    );
    return c.json({ season: { id: doc._id.toHexString(), status: doc.status } });
  })

  // ── Torneos ────────────────────────────────────────────────────────────────

  .post('/tournaments', bodyValidado(CreateTournamentSchema), async (c) => {
    const input = c.req.valid('json');
    const creado = await tournamentService.createTournament(input, currentAdminId(c));
    return c.json({ tournament: creado }, 201);
  })

  .get('/tournaments', consultaValidada(ListTournamentsQuery), async (c) => {
    const q = c.req.valid('query');
    return c.json(
      await tournamentQueryService.listadoAdmin({
        ...(q.status ? { status: q.status } : {}),
        ...(q.seasonId ? { seasonId: toObjectId(q.seasonId) } : {}),
      }),
    );
  })
  .post('/tournaments/:id/start', async (c) => {
    const doc = await tournamentStateService.start(
      toObjectId(c.req.param('id')),
      currentAdminId(c),
      ipDelCliente(c),
    );
    return c.json({ tournament: { id: doc._id.toHexString(), status: doc.status } });
  })

  .patch('/tournaments/:id', bodyValidado(UpdateTournamentSchema), async (c) => {
    const input = c.req.valid('json');
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
    await tournamentEditService.removeTournament(
      toObjectId(c.req.param('id')),
      currentAdminId(c),
      ipDelCliente(c),
    );
    return c.json({ ok: true });
  })

  /**
   * Vuelve un torneo `en_proceso` a `sin_iniciar`.
   *
   * La guarda —que no haya un solo puntaje cargado— vive en el servicio, no en
   * el botón: el botón se puede tocar dos veces, o desde una pantalla que
   * todavía no se enteró de que alguien anotó.
   */
  .post('/tournaments/:id/unstart', async (c) => {
    const doc = await tournamentStateService.unstart(
      toObjectId(c.req.param('id')),
      currentAdminId(c),
      ipDelCliente(c),
    );
    return c.json({ tournament: { id: doc._id.toHexString(), status: doc.status } });
  })

  .post('/tournaments/:id/publish', async (c) => {
    return c.json(await publishService.publish(toObjectId(c.req.param('id')), currentAdminId(c)));
  })

  .post('/tournaments/:id/unpublish', bodyValidado(MotivoSchema), async (c) => {
    const { reason } = c.req.valid('json');
    return c.json(
      await publishService.unpublish(toObjectId(c.req.param('id')), currentAdminId(c), reason),
    );
  })

  /**
   * Archivar / desarchivar un torneo publicado (`BE-26`): deja de sumar al ranking y se oculta de
   * la landing, sin despublicarlo. Con motivo, como despublicar: queda en el audit log.
   */
  .post('/tournaments/:id/archive', bodyValidado(MotivoSchema), async (c) => {
    const { reason } = c.req.valid('json');
    return c.json(
      await publishService.archive(toObjectId(c.req.param('id')), currentAdminId(c), reason),
    );
  })
  .post('/tournaments/:id/unarchive', bodyValidado(MotivoSchema), async (c) => {
    const { reason } = c.req.valid('json');
    return c.json(
      await publishService.unarchive(toObjectId(c.req.param('id')), currentAdminId(c), reason),
    );
  })

  .get('/tournaments/:id/patrols', consultaValidada(ListPatrolsQuery), async (c) => {
    const id = toObjectId(c.req.param('id'));
    const { conPins } = c.req.valid('query');
    const [patrols, violations] = await Promise.all([
      patrolAdminService.listPatrols(id, currentAdminId(c), ipDelCliente(c), conPins),
      patrolAdminService.validateCurrentDistribution(id),
    ]);
    return c.json({ patrols, violations });
  })

  /**
   * Redistribución manual. **Avisa pero no bloquea**: la respuesta trae las
   * violaciones que el admin acaba de aceptar. Ver `FUNCTIONAL.md` §6.6.
   */
  .put('/tournaments/:id/patrols', bodyValidado(PatrolDistributionSchema), async (c) => {
    const id = toObjectId(c.req.param('id'));
    const input = c.req.valid('json');

    await patrolAdminService.redistribute(id, input, currentAdminId(c), ipDelCliente(c));

    // Guardar se hace desde la pantalla de credenciales, que muestra los PIN: acá sí.
    const [patrols, violations] = await Promise.all([
      patrolAdminService.listPatrols(id, currentAdminId(c), ipDelCliente(c), true),
      patrolAdminService.validateCurrentDistribution(id),
    ]);
    return c.json({ patrols, violations });
  })

  /** Resultados con los rollups de cada participante. Ver `tournamentQueryService`. */
  .get('/tournaments/:id/results', async (c) =>
    c.json(await tournamentQueryService.resultadosAdmin(toObjectId(c.req.param('id')))),
  )
  /**
   * Estado de los pagos, con la recaudación derivada.
   *
   * Va bajo `/admin` y no en el endpoint público: quién pagó y quién no es
   * información del club, no del ranking.
   */
  /** Lo recaudado en toda la temporada, torneo por torneo. */
  .get('/seasons/:id/collection', async (c) => {
    return c.json(await paymentService.seasonCollection(toObjectId(c.req.param('id'))));
  })

  .get('/tournaments/:id/payments', async (c) => {
    return c.json(await paymentService.summary(toObjectId(c.req.param('id'))));
  })

  .post('/participants/:id/payment', bodyValidado(MarkPaymentSchema), async (c) => {
    const { paid } = c.req.valid('json');
    return c.json(
      await paymentService.setPaid(
        toObjectId(c.req.param('id')),
        paid,
        currentAdminId(c),
        ipDelCliente(c),
      ),
    );
  })

  .get('/tournaments/:id/locked-targets', async (c) =>
    c.json(await tournamentQueryService.blancosBloqueados(toObjectId(c.req.param('id')))),
  )

  /**
   * La tarjeta de un arquero, flecha por flecha, en cualquier estado del torneo (`BE-25`). Es lo
   * que la pantalla de corrección pone al lado de la planilla de papel.
   */
  .get('/tournaments/:id/participants/:participantId/scorecard', async (c) =>
    c.json({
      scorecard: await correccionService.tarjetaParaAdmin(
        toObjectId(c.req.param('id')),
        toObjectId(c.req.param('participantId')),
      ),
    }),
  )

  /**
   * Corregir las flechas de un arquero en un blanco, contra la planilla de papel (`BE-25`).
   *
   * Sólo tokens y motivo (`ScoreCorrectionSchema`, `.strict()`): un `total` en el body se
   * rechaza, no se ignora. Sólo con el torneo esperando publicación; lo exige el servicio.
   */
  .put(
    '/tournaments/:id/participants/:participantId/scores/:targetIndex',
    bodyValidado(ScoreCorrectionSchema),
    async (c) => {
      const blanco = IndiceDeBlanco.safeParse(c.req.param('targetIndex'));
      if (!blanco.success) throw validationError({ targetIndex: 'Blanco inválido.' });

      return c.json(
        await correccionService.corregirPuntaje(
          toObjectId(c.req.param('id')),
          toObjectId(c.req.param('participantId')),
          blanco.data,
          c.req.valid('json'),
          currentAdminId(c),
        ),
      );
    },
  )
  .post('/patrols/:id/pin/regenerate', async (c) => {
    return c.json(
      await patrolAdminService.regeneratePin(toObjectId(c.req.param('id')), currentAdminId(c)),
    );
  })

  .post('/participants/:id/signature/unlock', bodyValidado(MotivoSchema), async (c) => {
    const { reason } = c.req.valid('json');
    await patrolAdminService.unlockSignature(
      toObjectId(c.req.param('id')),
      reason,
      currentAdminId(c),
      ipDelCliente(c),
    );
    return c.json({ ok: true });
  })

  .get('/tournaments/:id', async (c) =>
    c.json(await tournamentQueryService.detalleAdmin(toObjectId(c.req.param('id')))),
  );
