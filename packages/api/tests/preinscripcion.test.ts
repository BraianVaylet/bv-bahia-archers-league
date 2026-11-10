import type { Db } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, tournaments } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import { resetEnvCache } from '../src/env.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import {
  adminListo,
  type Cliente,
  clearDb,
  cliente,
  crearArqueros,
  crearTemporada,
  recorridoDeReferencia,
  startDb,
  stopDb,
  testEnv,
  testEnvRaw,
} from './helpers.js';

/**
 * El link de pre-inscripción de un torneo (`BE-27`).
 *
 * Un formulario o una planilla externa donde los arqueros se anotan antes de la fecha. Lo carga el
 * admin y la landing lo muestra como botón. Ver `docs/SECURITY.md` §16.
 */

const FORMULARIO = 'https://forms.gle/AbCdEf123';

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

async function crearTorneo(extra: Record<string, unknown> = {}) {
  const c = await adminListo();
  const seasonId = await crearTemporada(c);
  const archerIds = await crearArqueros(c, [
    ['recurvo', 2],
    ['compuesto', 2],
  ]);

  const res = await c.post('/api/admin/tournaments', {
    seasonId,
    name: '3ª fecha',
    date: '2026-12-05',
    targets: recorridoDeReferencia(),
    archerIds,
    ...extra,
  });
  const { tournament } = (await res.json()) as { tournament: { id: string } };
  return { c, id: tournament.id };
}

const detalleAdmin = async (c: Cliente, id: string) =>
  (
    (await (await c.get(`/api/admin/tournaments/${id}`)).json()) as {
      tournament: { registrationUrl: string | null };
    }
  ).tournament;

const detallePublico = async (id: string) =>
  (
    (await (await cliente().get(`/api/public/tournaments/${id}`)).json()) as {
      tournament: { registrationUrl: string | null };
    }
  ).tournament;

describe('link de pre-inscripción', () => {
  it('se carga al crear el torneo y WAFA lo ve', async () => {
    const { c, id } = await crearTorneo({ registrationUrl: FORMULARIO });

    expect((await detalleAdmin(c, id)).registrationUrl).toBe(FORMULARIO);
  });

  it('sin cargarlo, el torneo lo tiene en null', async () => {
    const { c, id } = await crearTorneo();

    expect((await detalleAdmin(c, id)).registrationUrl).toBeNull();
  });

  it('la landing lo recibe en el detalle público', async () => {
    const { c, id } = await crearTorneo({ registrationUrl: FORMULARIO });
    await c.post(`/api/admin/tournaments/${id}/start`);

    expect((await detallePublico(id)).registrationUrl).toBe(FORMULARIO);
  });

  /** Los torneos creados antes de `BE-27` no tienen la clave: se leen como «sin link». */
  it('un torneo viejo, sin la clave, se lee como null en WAFA y en la landing', async () => {
    const { c, id } = await crearTorneo();
    await tournaments().updateOne({}, { $unset: { registrationUrl: '' } });
    await c.post(`/api/admin/tournaments/${id}/start`);

    expect((await detalleAdmin(c, id)).registrationUrl).toBeNull();
    expect((await detallePublico(id)).registrationUrl).toBeNull();
  });

  it('se edita con el torneo sin iniciar, y queda en el audit log', async () => {
    const { c, id } = await crearTorneo();

    const res = await c.patch(`/api/admin/tournaments/${id}`, { registrationUrl: FORMULARIO });

    expect(res.status).toBe(200);
    expect((await detalleAdmin(c, id)).registrationUrl).toBe(FORMULARIO);
    const registro = await auditLog().findOne({ action: 'tournament.update' });
    expect(registro?.meta).toEqual({ campos: ['registrationUrl'] });
  });

  it('se edita con el torneo en proceso (decisión 1)', async () => {
    const { c, id } = await crearTorneo();
    await c.post(`/api/admin/tournaments/${id}/start`);

    const res = await c.patch(`/api/admin/tournaments/${id}`, { registrationUrl: FORMULARIO });

    expect(res.status).toBe(200);
    expect((await detalleAdmin(c, id)).registrationUrl).toBe(FORMULARIO);
  });

  it('null lo borra: el formulario cerró', async () => {
    const { c, id } = await crearTorneo({ registrationUrl: FORMULARIO });

    await c.patch(`/api/admin/tournaments/${id}`, { registrationUrl: null });

    expect((await detalleAdmin(c, id)).registrationUrl).toBeNull();
  });

  it('esperando publicación ya no se edita', async () => {
    const { c, id } = await crearTorneo();
    await tournaments().updateOne({}, { $set: { status: 'completado' } });

    const res = await c.patch(`/api/admin/tournaments/${id}`, { registrationUrl: FORMULARIO });

    expect(res.status).toBe(409);
  });

  it('un javascript: se rechaza antes de llegar a la base', async () => {
    const { c, id } = await crearTorneo();

    const res = await c.patch(`/api/admin/tournaments/${id}`, {
      registrationUrl: 'javascript:alert(document.cookie)',
    });

    expect(res.status).toBe(400);
    expect((await tournaments().findOne({}))?.registrationUrl ?? null).toBeNull();
  });
});
