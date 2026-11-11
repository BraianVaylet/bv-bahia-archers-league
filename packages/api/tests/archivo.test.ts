import { randomUUID as uuid } from 'node:crypto';
import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, participants, standings, tournaments } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import { resetEnvCache } from '../src/env.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import * as publishService from '../src/services/publishService.js';
import {
  clearDb,
  cliente,
  type EscenarioDeSync,
  escenarioDeSync,
  startDb,
  stopDb,
  testEnv,
  testEnvRaw,
} from './helpers.js';

/**
 * Archivar y desarchivar un torneo publicado (`BE-26`, decisiones 4, 5 y 6 de la Fase 9).
 *
 * Archivar **no cambia el estado**: el torneo sigue publicado, pero deja de sumar al ranking de la
 * temporada y **se oculta de la landing** (listado, detalle, tarjetas e historial de la ficha). Se
 * revierte: desarchivar lo devuelve y el ranking queda como estaba.
 */

let db: Db;

beforeAll(async () => {
  Object.assign(process.env, testEnvRaw());
  resetEnvCache();
  db = await startDb();
}, 120_000);

afterAll(async () => {
  await stopDb();
});

afterEach(() => {
  resetRateLimits();
});

beforeEach(async () => {
  await clearDb(db);
  await seed(db, testEnv());
});

/** Un torneo publicado: el líder anota un blanco, el torneo se completa y el admin publica. */
async function torneoPublicado(): Promise<EscenarioDeSync & { pid: string; archerId: string }> {
  const e = await escenarioDeSync();
  const [pid] = e.participantIds;
  if (!pid) throw new Error('sin participantes');

  await e.lider.post('/api/wafl/sync', {
    ops: [
      {
        type: 'score',
        opId: uuid(),
        clientUpdatedAt: new Date().toISOString(),
        participantId: pid,
        targetIndex: 1,
        arrows: ['11', '8'],
      },
    ],
  });
  await tournaments().updateOne({}, { $set: { status: 'completado' } });
  const pub = await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/publish`);
  if (pub.status !== 200) throw new Error(`publicar falló: ${pub.status}`);

  const p = await participants().findOne({ _id: new ObjectId(pid) });
  return { ...e, pid, archerId: p?.archerId.toHexString() ?? '' };
}

const MOTIVO = { reason: 'Fecha suspendida por lluvia a mitad de recorrido.' };

const rankingDeTemporada = () =>
  standings()
    .find({}, { projection: { _id: 0, updatedAt: 0 } })
    .sort({ archerId: 1, category: 1 })
    .toArray();

describe('archivar un torneo publicado', () => {
  it('lo saca del ranking de la temporada, sin despublicarlo', async () => {
    const e = await torneoPublicado();
    expect(await standings().countDocuments()).toBeGreaterThan(0);

    const res = await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/archive`, MOTIVO);

    expect(res.status).toBe(200);
    const torneo = await tournaments().findOne({});
    expect(torneo?.status).toBe('publicado');
    expect(torneo?.archivedAt).toBeInstanceOf(Date);
    // Era el único torneo de la temporada: nadie tiene torneos jugados que sumen.
    expect(await standings().countDocuments()).toBe(0);
  });

  it('desarchivar deja el ranking exactamente como estaba', async () => {
    const e = await torneoPublicado();
    const antes = await rankingDeTemporada();

    await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/archive`, MOTIVO);
    const res = await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/unarchive`, MOTIVO);

    expect(res.status).toBe(200);
    expect((await tournaments().findOne({}))?.archivedAt ?? null).toBeNull();
    expect(await rankingDeTemporada()).toEqual(antes);
  });

  /** `db:reconcile` recalcula todas las temporadas: no puede volver a meter un archivado. */
  it('reconciliar el ranking respeta el archivo', async () => {
    const e = await torneoPublicado();
    await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/archive`, MOTIVO);

    await publishService.reconcileStandings();

    expect(await standings().countDocuments()).toBe(0);
  });

  it('queda en el audit log, con el motivo', async () => {
    const e = await torneoPublicado();

    await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/archive`, MOTIVO);
    await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/unarchive`, MOTIVO);

    const acciones = (await auditLog().find({ entity: 'tournament' }).toArray()).map(
      (r) => r.action,
    );
    expect(acciones).toEqual(
      expect.arrayContaining(['tournament.archive', 'tournament.unarchive']),
    );
    expect((await auditLog().findOne({ action: 'tournament.archive' }))?.meta).toMatchObject(
      MOTIVO,
    );
  });

  /** Decisión 6: sólo un publicado. Los demás todavía no suman al ranking. */
  it.each(['sin_iniciar', 'en_proceso', 'completado'] as const)(
    'un torneo %s no se archiva',
    async (status) => {
      const e = await torneoPublicado();
      await tournaments().updateOne({}, { $set: { status } });

      const res = await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/archive`, MOTIVO);

      expect(res.status).toBe(409);
    },
  );

  it('no se archiva dos veces, ni se desarchiva lo que no está archivado', async () => {
    const e = await torneoPublicado();

    expect(
      (await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/unarchive`, MOTIVO)).status,
    ).toBe(409);
    await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/archive`, MOTIVO);
    expect(
      (await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/archive`, MOTIVO)).status,
    ).toBe(409);
  });

  it('sin motivo no se archiva', async () => {
    const e = await torneoPublicado();

    const res = await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/archive`, {});

    expect(res.status).toBe(400);
  });

  /** Un `completado` archivado no tiene sentido: despublicar lo desarchiva en la misma operación. */
  it('despublicar un archivado lo desarchiva', async () => {
    const e = await torneoPublicado();
    await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/archive`, MOTIVO);

    const res = await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/unpublish`, MOTIVO);

    expect(res.status).toBe(200);
    const torneo = await tournaments().findOne({});
    expect(torneo?.status).toBe('completado');
    expect(torneo?.archivedAt ?? null).toBeNull();
  });

  it('WAFA lo sigue viendo, marcado como archivado', async () => {
    const e = await torneoPublicado();
    await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/archive`, MOTIVO);

    const detalle = (await (
      await e.admin.get(`/api/admin/tournaments/${e.tournamentId}`)
    ).json()) as {
      tournament: { archived: boolean };
    };
    const listado = (await (await e.admin.get('/api/admin/tournaments')).json()) as {
      tournaments: { id: string; archived: boolean }[];
    };

    expect(detalle.tournament.archived).toBe(true);
    expect(listado.tournaments.find((t) => t.id === e.tournamentId)?.archived).toBe(true);
  });

  it('sin sesión de admin no se archiva', async () => {
    const e = await torneoPublicado();

    const res = await cliente().post(`/api/admin/tournaments/${e.tournamentId}/archive`, MOTIVO);

    expect(res.status).not.toBe(200);
    expect((await tournaments().findOne({}))?.archivedAt ?? null).toBeNull();
  });
});

/** Decisión 5: un archivado se oculta de la landing, en todos los lugares donde se veía. */
describe('un torneo archivado, desde la landing', () => {
  const publico = cliente;

  it('no aparece en el listado', async () => {
    const e = await torneoPublicado();
    await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/archive`, MOTIVO);

    const { tournaments: lista } = (await (
      await publico().get('/api/public/tournaments')
    ).json()) as {
      tournaments: { id: string }[];
    };
    expect(lista.map((t) => t.id)).not.toContain(e.tournamentId);
  });

  it('su detalle y sus tarjetas de puntaje dan 404', async () => {
    const e = await torneoPublicado();
    await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/archive`, MOTIVO);

    expect((await publico().get(`/api/public/tournaments/${e.tournamentId}`)).status).toBe(404);
    expect(
      (await publico().get(`/api/public/tournaments/${e.tournamentId}/participants/${e.pid}`))
        .status,
    ).toBe(404);
  });

  /**
   * La ficha existe mientras el arquero tenga algún torneo que sume. Para que el historial tenga
   * que filtrar, el arquero conserva su lugar en el ranking —como si tuviera otro torneo en la
   * temporada—: si no, la ficha daría 404 antes de llegar al historial y el test no probaría nada.
   */
  it('no figura en el historial de la ficha del arquero', async () => {
    const e = await torneoPublicado();
    const ficha = async () =>
      (await (await publico().get(`/api/public/archers/${e.archerId}`)).json()) as {
        archer: { history: { tournamentId: string }[] };
      };
    expect((await ficha()).archer.history.map((h) => h.tournamentId)).toContain(e.tournamentId);
    const suLugar = await standings().findOne({ archerId: new ObjectId(e.archerId) });
    if (!suLugar) throw new Error('el arquero tendría que estar en el ranking');

    await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/archive`, MOTIVO);
    await standings().insertOne(suLugar);

    expect((await ficha()).archer.history.map((h) => h.tournamentId)).not.toContain(e.tournamentId);
  });

  it('desarchivado, vuelve a verse', async () => {
    const e = await torneoPublicado();
    await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/archive`, MOTIVO);
    await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/unarchive`, MOTIVO);

    expect((await publico().get(`/api/public/tournaments/${e.tournamentId}`)).status).toBe(200);
  });
});
