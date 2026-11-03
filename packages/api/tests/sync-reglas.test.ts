import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getDb, participants, scores, syncOps } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import { resetEnvCache } from '../src/env.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import {
  clearDb,
  type EscenarioDeSync,
  escenarioDeSync,
  startDb,
  stopDb,
  testEnv,
  testEnvRaw,
} from './helpers.js';

/**
 * Reglas de la sincronización que la prueba de mutación encontró sin vigilar (`REF6-14` / `T-7`).
 *
 * La primera corrida de Stryker sobre `syncService` dejó con vida mutantes en dos lugares que
 * importan: **quién puede firmar a quién** y **quién gana cuando dos celulares cargan la misma
 * celda**. El código estaba bien; lo que faltaba era un test que se enterara si dejaba de estarlo.
 */

const PNG = `data:image/png;base64,${Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]).toString('base64')}`;

beforeAll(async () => {
  Object.assign(process.env, testEnvRaw());
  resetEnvCache();
  await startDb();
}, 120_000);

afterAll(async () => {
  await stopDb();
});

afterEach(() => resetRateLimits());

beforeEach(async () => {
  await clearDb(getDb());
  await seed(getDb(), testEnv());
});

interface Respuesta {
  results: { opId: string; status: string; error?: { code: string } }[];
}

const sincronizar = async (e: EscenarioDeSync, ops: unknown[]): Promise<Respuesta> =>
  (await (await e.lider.post('/api/wafl/sync', { ops })).json()) as Respuesta;

const idOp = (n: number) => `0192f3a1-8c4e-7000-9abc-${String(n).padStart(12, '0')}`;
const AHORA = '2026-08-08T12:00:00.000Z';

const firma = (participantId: string, n: number) => ({
  type: 'signature' as const,
  opId: idOp(n),
  clientUpdatedAt: AHORA,
  participantId,
  pngDataUrl: PNG,
});

const puntaje = (participantId: string, n: number, arrows: string[], t = AHORA) => ({
  type: 'score' as const,
  opId: idOp(n),
  clientUpdatedAt: t,
  participantId,
  targetIndex: 1,
  arrows,
});

const celda = (participantId: string) =>
  scores().findOne({ participantId: new ObjectId(participantId), targetIndex: 1 });

describe('quién puede firmar a quién', () => {
  it('un arquero de otra patrulla no se firma, y no queda firmado', async () => {
    const e = await escenarioDeSync();
    const ajeno = e.participantIds[0] as string;
    // El arquero pasa a ser de otra patrulla: para esta sesión es ajeno.
    await participants().updateOne(
      { _id: new ObjectId(ajeno) },
      { $set: { patrolId: new ObjectId() } },
    );

    const res = await sincronizar(e, [firma(ajeno, 1)]);

    expect(res.results[0]).toMatchObject({ status: 'rejected', error: { code: 'FORBIDDEN' } });
    const doc = await participants().findOne({ _id: new ObjectId(ajeno) });
    expect(doc?.signature).toBeNull();
  });

  it('un arquero que no existe tampoco: se rechaza, no se rompe', async () => {
    const e = await escenarioDeSync();

    const res = await sincronizar(e, [firma(new ObjectId().toHexString(), 1)]);

    expect(res.results[0]).toMatchObject({ status: 'rejected', error: { code: 'FORBIDDEN' } });
  });

  it('lo mismo para un puntaje de un arquero que no existe', async () => {
    const e = await escenarioDeSync();

    const res = await sincronizar(e, [puntaje(new ObjectId().toHexString(), 1, ['11', '8'])]);

    expect(res.results[0]).toMatchObject({ status: 'rejected', error: { code: 'FORBIDDEN' } });
  });

  it('el propio arquero sí se firma', async () => {
    const e = await escenarioDeSync();

    const res = await sincronizar(e, [firma(e.participantIds[0] as string, 1)]);

    expect(res.results[0]?.status).toBe('applied');
  });
});

describe('dos celulares cargan la misma celda: gana el último, y a igualdad el opId mayor', () => {
  it('con la misma hora, el opId mayor gana aunque llegue después', async () => {
    const e = await escenarioDeSync();
    const id = e.participantIds[0] as string;

    await sincronizar(e, [puntaje(id, 1, ['11', '8'])]);
    const res = await sincronizar(e, [puntaje(id, 2, ['5', '5'])]);

    expect(res.results[0]?.status).toBe('applied');
    expect((await celda(id))?.arrows).toEqual(['5', '5']);
  });

  it('con la misma hora, el opId menor pierde aunque llegue después', async () => {
    const e = await escenarioDeSync();
    const id = e.participantIds[0] as string;

    await sincronizar(e, [puntaje(id, 2, ['5', '5'])]);
    const res = await sincronizar(e, [puntaje(id, 1, ['11', '8'])]);

    expect(res.results[0]?.status).toBe('superseded');
    expect((await celda(id))?.arrows).toEqual(['5', '5']);
  });

  it('una hora más nueva gana, tenga el opId que tenga', async () => {
    const e = await escenarioDeSync();
    const id = e.participantIds[0] as string;

    await sincronizar(e, [puntaje(id, 9, ['11', '8'], '2026-08-08T12:00:00.000Z')]);
    const res = await sincronizar(e, [puntaje(id, 1, ['5', '5'], '2026-08-08T12:00:01.000Z')]);

    expect(res.results[0]?.status).toBe('applied');
    expect((await celda(id))?.arrows).toEqual(['5', '5']);
  });

  it('una hora más vieja pierde, tenga el opId que tenga', async () => {
    const e = await escenarioDeSync();
    const id = e.participantIds[0] as string;

    await sincronizar(e, [puntaje(id, 1, ['11', '8'], '2026-08-08T12:00:01.000Z')]);
    const res = await sincronizar(e, [puntaje(id, 9, ['5', '5'], '2026-08-08T12:00:00.000Z')]);

    expect(res.results[0]?.status).toBe('superseded');
    expect((await celda(id))?.arrows).toEqual(['11', '8']);
  });
});

describe('reprocesar una op que ya se había aplicado', () => {
  // `B-4`: el proceso muere después del commit y antes de confirmar la marca. A los 30 s el reintento
  // la reprocesa. Aplicar de nuevo el mismo puntaje no puede cambiar nada, y para eso el desempate
  // tiene que decir «ya está» cuando el opId es el mismo que el guardado.
  it('queda superseded y el puntaje no cambia', async () => {
    const e = await escenarioDeSync();
    const id = e.participantIds[0] as string;
    const op = puntaje(id, 1, ['11', '8']);
    await sincronizar(e, [op]);
    const antes = await celda(id);

    // Se simula la muerte: la marca vuelve a quedar en proceso, hace más de 30 s.
    await syncOps().updateOne(
      { _id: op.opId },
      { $set: { result: 'processing', appliedAt: new Date(Date.now() - 31_000) } },
    );
    const res = await sincronizar(e, [op]);

    expect(res.results[0]?.status).toBe('superseded');
    expect((await celda(id))?.arrows).toEqual(['11', '8']);
    expect((await celda(id))?.updatedAt).toEqual(antes?.updatedAt);
  });
});
