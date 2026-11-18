import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, participants, patrols, tournaments } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import { resetEnvCache } from '../src/env.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import {
  adminListo,
  type Cliente,
  clearDb,
  crearArqueros,
  crearTemporada,
  recorridoDeReferencia,
  startDb,
  stopDb,
  testEnv,
  testEnvRaw,
} from './helpers.js';

/**
 * Editar los participantes **sin rearmar** las patrullas (`BE-31`, decisión 5 de la Fase 10).
 *
 * Devolución de la prueba 1: «cuando se agrega un nuevo arquero al torneo y se quiere ajustar las
 * patrullas, que queden con la posición editada por el admin, que no se vuelvan a desordenar».
 * Antes, cambiar los participantes volvía a correr `buildPatrols` desde cero: patrullas nuevas,
 * PIN nuevos (aunque estuvieran impresos) y los ajustes del admin perdidos. Ahora usa
 * `incorporarArqueros` (`SH-12`). El rearmado completo pasa a ser una acción explícita.
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

interface TorneoArmado {
  readonly c: Cliente;
  readonly tournamentId: string;
  readonly archerIds: string[];
}

async function torneoArmado(): Promise<TorneoArmado> {
  const c = await adminListo();
  const seasonId = await crearTemporada(c);
  const archerIds = await crearArqueros(c, [
    ['recurvo', 2],
    ['compuesto', 4],
    ['cazador', 2],
    ['raso', 2],
    ['longbow', 2],
  ]);
  const res = await c.post('/api/admin/tournaments', {
    seasonId,
    name: '3ª fecha',
    date: '2026-08-08',
    targets: recorridoDeReferencia(),
    archerIds,
  });
  const { tournament } = (await res.json()) as { tournament: { id: string } };
  return { c, tournamentId: tournament.id, archerIds };
}

/** Dónde está cada arquero: patrulla (por id, que es lo que lleva el PIN), unidad y posición. */
async function ubicaciones(): Promise<Map<string, string>> {
  const todos = await participants().find().toArray();
  return new Map(
    todos.map((p) => [
      p.archerId.toHexString(),
      `${p.patrolId.toHexString()}/${p.unit}/${p.position}`,
    ]),
  );
}

/** Las patrullas con su PIN, para ver que nada se regeneró. */
async function credenciales(): Promise<Map<string, string>> {
  const todas = await patrols().find().toArray();
  return new Map(todas.map((p) => [p._id.toHexString(), `${p.number}/${p.pinHash}`]));
}

describe('editar participantes no rearma las patrullas', () => {
  it('agregar un arquero no mueve a nadie ni cambia ningún PIN', async () => {
    const { c, tournamentId, archerIds } = await torneoArmado();
    const antes = await ubicaciones();
    const pins = await credenciales();
    const [nuevo] = await crearArqueros(c, [['recurvo', 1]], 100);

    const res = await c.patch(`/api/admin/tournaments/${tournamentId}`, {
      archerIds: [...archerIds, nuevo],
    });
    expect(res.status).toBe(200);

    const despues = await ubicaciones();
    for (const [archerId, donde] of antes) expect(despues.get(archerId)).toBe(donde);
    expect(despues.has(nuevo as string)).toBe(true);
    const ahora = await credenciales();
    for (const [id, pin] of pins) expect(ahora.get(id)).toBe(pin);
  });

  it('quitar un arquero no mueve a nadie de otra unidad ni cambia ningún PIN', async () => {
    const { c, tournamentId, archerIds } = await torneoArmado();
    const antes = await ubicaciones();
    const pins = await credenciales();
    const quitado = archerIds[0] as string;
    const suUnidad = antes.get(quitado)?.split('/').slice(0, 2).join('/');

    const res = await c.patch(`/api/admin/tournaments/${tournamentId}`, {
      archerIds: archerIds.slice(1),
    });
    expect(res.status).toBe(200);

    const despues = await ubicaciones();
    expect(despues.has(quitado)).toBe(false);
    for (const [archerId, donde] of antes) {
      if (archerId === quitado) continue;
      // Su compañero de unidad pasa a la izquierda: es una posición derivada del orden.
      if (donde.startsWith(`${suUnidad}/`)) continue;
      expect(despues.get(archerId)).toBe(donde);
    }
    const ahora = await credenciales();
    for (const [id, pin] of pins) expect(ahora.get(id)).toBe(pin);
  });

  it('respeta lo que el admin ajustó a mano', async () => {
    const { c, tournamentId, archerIds } = await torneoArmado();

    // El admin junta a dos patrullas de la manera que quiere (vía la redistribución).
    const todas = await patrols().find().sort({ number: 1 }).toArray();
    const miembros = await participants().find().toArray();
    const cuerpo = {
      patrols: todas.map((p) => {
        const ids = miembros
          .filter((m) => m.patrolId.equals(p._id))
          .sort((a, b) => (a.unit + a.position).localeCompare(b.unit + b.position))
          .map((m) => m._id.toHexString())
          .reverse();
        return {
          id: p._id.toHexString(),
          number: p.number,
          startTargetIndex: p.startTargetIndex,
          units: [
            { label: 'A', members: ids.slice(0, 2) },
            ...(ids.length > 2 ? [{ label: 'B', members: ids.slice(2) }] : []),
          ],
        };
      }),
    };
    expect((await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, cuerpo)).status).toBe(
      200,
    );
    const ajustado = await ubicaciones();
    const [nuevo] = await crearArqueros(c, [['raso', 1]], 100);

    await c.patch(`/api/admin/tournaments/${tournamentId}`, {
      archerIds: [...archerIds, nuevo],
    });

    const despues = await ubicaciones();
    for (const [archerId, donde] of ajustado) expect(despues.get(archerId)).toBe(donde);
  });

  it('si el nuevo no entra en ninguna, abre una patrulla con usuario y PIN propios', async () => {
    const { c, tournamentId, archerIds } = await torneoArmado();
    const antes = await patrols().countDocuments();
    // Una categoría que no está: va como unidad propia, y si todas están completas, abre otra.
    const nuevos = await crearArqueros(c, [['tradicional', 6]], 100);

    const res = await c.patch(`/api/admin/tournaments/${tournamentId}`, {
      archerIds: [...archerIds, ...nuevos],
    });
    expect(res.status).toBe(200);

    const todas = await patrols().find().sort({ number: 1 }).toArray();
    expect(todas.length).toBeGreaterThan(antes);
    const numeros = todas.map((p) => p.number);
    expect(numeros).toEqual(numeros.map((_, i) => i + 1));
    for (const p of todas) {
      expect(p.username).toBe(`patrulla${p.number}`);
      expect(p.pinHash).toBeTruthy();
    }
    expect((await tournaments().findOne({}))?.patrolCount).toBe(todas.length);
    // Nadie quedó sin patrulla.
    const ids = new Set(todas.map((p) => p._id.toHexString()));
    for (const m of await participants().find().toArray()) {
      expect(ids.has(m.patrolId.toHexString())).toBe(true);
    }
  });

  it('queda en la auditoría cuántos entraron y cuántos salieron', async () => {
    const { c, tournamentId, archerIds } = await torneoArmado();
    const [nuevo] = await crearArqueros(c, [['recurvo', 1]], 100);

    await c.patch(`/api/admin/tournaments/${tournamentId}`, {
      archerIds: [...archerIds.slice(1), nuevo],
    });

    const registro = await auditLog().findOne({ action: 'tournament.participants_edit' });
    expect(registro?.meta).toMatchObject({ added: 1, removed: 1 });
  });
});

describe('rearmar las patrullas, como acción explícita', () => {
  it('POST /patrols/rebuild arma todo de nuevo, con PIN nuevos, y conserva los pagos', async () => {
    const { c, tournamentId } = await torneoArmado();
    const pinsAntes = new Set((await patrols().find().toArray()).map((p) => p.pinHash));
    const pago = (await participants().findOne({}))?.archerId as ObjectId;
    await participants().updateOne({ archerId: pago }, { $set: { paid: true } });

    const res = await c.post(`/api/admin/tournaments/${tournamentId}/patrols/rebuild`);
    expect(res.status).toBe(200);

    const despues = await patrols().find().toArray();
    expect(despues.some((p) => pinsAntes.has(p.pinHash))).toBe(false);
    expect((await participants().findOne({ archerId: pago }))?.paid).toBe(true);
    expect(await auditLog().findOne({ action: 'patrol.rebuild' })).not.toBeNull();
  });

  it('con el torneo en marcha no se puede', async () => {
    const { c, tournamentId } = await torneoArmado();
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);

    const res = await c.post(`/api/admin/tournaments/${tournamentId}/patrols/rebuild`);
    expect(res.status).toBe(409);
  });

  it('exige sesión de admin', async () => {
    const { tournamentId } = await torneoArmado();
    const { cliente } = await import('./helpers.js');

    const res = await cliente().post(`/api/admin/tournaments/${tournamentId}/patrols/rebuild`);
    expect(res.status).toBe(401);
  });

  it('un id que no es de un torneo da 404', async () => {
    const { c } = await torneoArmado();

    const res = await c.post(
      `/api/admin/tournaments/${new ObjectId().toHexString()}/patrols/rebuild`,
    );
    expect(res.status).toBe(404);
  });
});
