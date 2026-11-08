import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb, scores, syncOps } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import type { SyncOpDoc } from '../src/db/types.js';
import { resetEnvCache } from '../src/env.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import * as scoreRepo from '../src/repositories/scoreRepo.js';
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
 * La marca de dedup de una op de sincronización (`REF6-13` / `B-4`).
 *
 * Antes la op se marcaba `applied` **antes** de aplicarla. Si el proceso moría entre la marca y el
 * commit, el reintento del cliente recibía `duplicate` y el puntaje se perdía en silencio: justo lo
 * que la sincronización existe para no hacer. Ahora la marca nace `processing`, con la hora, y:
 *
 * - termina `applied` o `rejected` cuando la transacción termina;
 * - una op que sigue `processing` pasados 30 s se **reprocesa** (el proceso murió);
 * - una op `processing` reciente es de otro request que sigue vivo: **no se contesta**, y el cliente
 *   —que trata una op ausente de la respuesta como «reintentar más tarde»— la vuelve a mandar.
 *
 * Contestar `duplicate` a una op en proceso la sacaría del outbox del celular antes de que se sepa
 * si llegó a aplicarse.
 */

let uuidN = 0;
const uuid = () => `0192f3a1-8c4e-7000-9abc-${String(++uuidN).padStart(12, '0')}`;

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

const opScore = (participantId: string, targetIndex: number, arrows: string[]) => ({
  type: 'score' as const,
  opId: uuid(),
  clientUpdatedAt: new Date().toISOString(),
  participantId,
  targetIndex,
  arrows,
});

interface Respuesta {
  results: { opId: string; status: string }[];
  patrol: { targetsCompleted: number };
}

const sincronizar = async (e: EscenarioDeSync, ops: unknown[]): Promise<Respuesta> =>
  (await (await e.lider.post('/api/wafl/sync', { ops })).json()) as Respuesta;

const hace = (segundos: number) => new Date(Date.now() - segundos * 1000);

/** Una marca que dejó un proceso que murió (o que sigue vivo) a mitad de una op. */
async function marcaEnProceso(opId: string, patrolId: ObjectId, haceSegundos: number) {
  await syncOps().insertOne({
    _id: opId,
    patrolId,
    type: 'score',
    appliedAt: hace(haceSegundos),
    result: 'processing',
    expiresAt: new Date(Date.now() + 86_400_000),
  } as SyncOpDoc);
}

const puntaje = (participantId: string, targetIndex: number) =>
  scores().findOne({ participantId: new ObjectId(participantId), targetIndex });

describe('la marca de la op', () => {
  it('nace en proceso, con la hora', async () => {
    const e = await escenarioDeSync();
    const antes = Date.now();

    expect(await scoreRepo.claimOp('op-1', e.patrolId, 'score')).toBe(true);

    const marca = await scoreRepo.findOp('op-1');
    expect(marca?.result).toBe('processing');
    expect(marca?.appliedAt.getTime()).toBeGreaterThanOrEqual(antes);
  });

  it('termina aplicada cuando la transacción termina', async () => {
    const e = await escenarioDeSync();
    const op = opScore(e.participantIds[0] as string, 1, ['11', '8']);

    await sincronizar(e, [op]);

    expect((await scoreRepo.findOp(op.opId))?.result).toBe('applied');
  });

  it('termina rechazada si el servidor la rechazó', async () => {
    const e = await escenarioDeSync();
    const op = opScore(e.participantIds[0] as string, 1, ['99', '99']);

    const res = await sincronizar(e, [op]);

    expect(res.results[0]?.status).toBe('rejected');
    expect((await scoreRepo.findOp(op.opId))?.result).toBe('rejected');
  });

  it('una op terminada, reenviada, sigue siendo duplicada', async () => {
    const e = await escenarioDeSync();
    const op = opScore(e.participantIds[0] as string, 1, ['11', '8']);
    await sincronizar(e, [op]);

    const reenvio = await sincronizar(e, [op]);

    expect(reenvio.results[0]?.status).toBe('duplicate');
  });
});

describe('las ops que no son un puntaje', () => {
  const PNG = `data:image/png;base64,${Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]).toString('base64')}`;

  // Una firma no se puede volver a aplicar sin consecuencias (rechazaría por «ya firmado» y el
  // líder vería un conflicto que no existe), así que su marca se confirma en la misma transacción
  // y no en el lote: no queda en proceso, ni un instante, después del commit.
  it('una firma aplicada queda confirmada con su transacción', async () => {
    const e = await escenarioDeSync();
    const op = {
      type: 'signature' as const,
      opId: uuid(),
      clientUpdatedAt: new Date().toISOString(),
      participantId: e.participantIds[0] as string,
      pngDataUrl: PNG,
    };

    const res = await sincronizar(e, [op]);

    expect(res.results[0]?.status).toBe('applied');
    expect((await scoreRepo.findOp(op.opId))?.result).toBe('applied');
  });
});

describe('una op abandonada a mitad de camino', () => {
  it('pasados 30 s en proceso, el reintento la aplica: el puntaje no se pierde', async () => {
    const e = await escenarioDeSync();
    const op = opScore(e.participantIds[0] as string, 1, ['11', '8']);
    await marcaEnProceso(op.opId, e.patrolId, 31);

    const res = await sincronizar(e, [op]);

    expect(res.results).toEqual([expect.objectContaining({ opId: op.opId, status: 'applied' })]);
    expect((await puntaje(e.participantIds[0] as string, 1))?.arrows).toEqual(['11', '8']);
    expect((await scoreRepo.findOp(op.opId))?.result).toBe('applied');
  });

  it('antes de los 30 s es de otro request que sigue vivo: no se aplica ni se contesta', async () => {
    const e = await escenarioDeSync();
    const op = opScore(e.participantIds[0] as string, 1, ['11', '8']);
    await marcaEnProceso(op.opId, e.patrolId, 5);

    const res = await sincronizar(e, [op]);

    // Ausente de la respuesta: el cliente la deja en el outbox y reintenta. `duplicate` la sacaría.
    expect(res.results).toEqual([]);
    expect(await puntaje(e.participantIds[0] as string, 1)).toBeNull();
    expect((await scoreRepo.findOp(op.opId))?.result).toBe('processing');
  });

  // La hora renovada es lo que cierra la carrera: sin ella, un segundo reintento vería la marca
  // todavía vencida y retomaría la misma op.
  it('retomar una op vencida le renueva la hora: un segundo reintento ya no la puede retomar', async () => {
    const e = await escenarioDeSync();
    await marcaEnProceso('op-vencida', e.patrolId, 31);

    expect(await scoreRepo.retomarOp('op-vencida', e.patrolId)).toBe(true);
    expect(await scoreRepo.retomarOp('op-vencida', e.patrolId)).toBe(false);

    const marca = await scoreRepo.findOp('op-vencida');
    expect(Date.now() - (marca?.appliedAt.getTime() ?? 0)).toBeLessThan(5_000);
  });

  it('el reintento de una en proceso reciente no gasta la marca: sigue valiendo 30 s desde el origen', async () => {
    const e = await escenarioDeSync();
    const op = opScore(e.participantIds[0] as string, 1, ['11', '8']);
    await marcaEnProceso(op.opId, e.patrolId, 5);
    const antes = (await scoreRepo.findOp(op.opId))?.appliedAt.getTime();

    await sincronizar(e, [op]);

    expect((await scoreRepo.findOp(op.opId))?.appliedAt.getTime()).toBe(antes);
  });

  it('una op en proceso de OTRA patrulla no se retoma, ni vencida', async () => {
    const e = await escenarioDeSync();
    const op = opScore(e.participantIds[0] as string, 1, ['11', '8']);
    await marcaEnProceso(op.opId, new ObjectId(), 120);

    const res = await sincronizar(e, [op]);

    expect(res.results).toEqual([]);
    expect(await puntaje(e.participantIds[0] as string, 1)).toBeNull();
    expect((await scoreRepo.findOp(op.opId))?.result).toBe('processing');
  });

  it('en un lote, la op en proceso no frena a las demás', async () => {
    const e = await escenarioDeSync();
    const [a, b, c] = e.participantIds as [string, string, string];
    const enProceso = opScore(a, 1, ['11', '8']);
    const buena1 = opScore(b, 1, ['11', '8']);
    const buena2 = opScore(c, 1, ['11', '8']);
    await marcaEnProceso(enProceso.opId, e.patrolId, 5);

    const res = await sincronizar(e, [buena1, enProceso, buena2]);

    expect(res.results.map((r) => [r.opId, r.status])).toEqual([
      [buena1.opId, 'applied'],
      [buena2.opId, 'applied'],
    ]);
    expect(await puntaje(b, 1)).not.toBeNull();
    expect(await puntaje(c, 1)).not.toBeNull();
    expect(await puntaje(a, 1)).toBeNull();
  });

  // Dos celulares (o dos reintentos) retomando la misma op vencida: la transacción de una sola.
  it('dos reintentos simultáneos de una op vencida la aplican una sola vez', async () => {
    const e = await escenarioDeSync();
    const op = opScore(e.participantIds[0] as string, 1, ['11', '8']);
    await marcaEnProceso(op.opId, e.patrolId, 31);

    const [r1, r2] = await Promise.all([sincronizar(e, [op]), sincronizar(e, [op])]);

    const aplicadas = [...r1.results, ...r2.results].filter((r) => r.status === 'applied');
    expect(aplicadas).toHaveLength(1);
    expect(
      await scores().countDocuments({ participantId: new ObjectId(e.participantIds[0] as string) }),
    ).toBe(1);
  });
});

describe('una línea por lote', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const lineasDeLote = () =>
    vi
      .mocked(console.info)
      .mock.calls.map(([l]) => JSON.parse(String(l)) as Record<string, unknown>)
      .filter((l) => l.evento === 'sync.lote');

  it('dice cuántas ops trae, cuánto tarda y cuántas se rechazan', async () => {
    const e = await escenarioDeSync();
    const [a, b, c, d] = e.participantIds as [string, string, string, string];
    const repetida = opScore(a, 1, ['11', '8']);
    await sincronizar(e, [repetida]);
    vi.mocked(console.info).mockClear();

    // Cantidades distintas a propósito (2 / 1 / 1): si dos categorías se cruzan, el test lo ve.
    await sincronizar(e, [
      opScore(b, 1, ['11', '8']),
      opScore(d, 1, ['11', '8']),
      opScore(c, 1, ['99', '99']),
      repetida,
    ]);

    const [linea] = lineasDeLote();
    expect(lineasDeLote()).toHaveLength(1);
    expect(linea).toMatchObject({
      evento: 'sync.lote',
      nivel: 'info',
      patrolId: e.patrolId.toHexString(),
      ops: 4,
      aplicadas: 2,
      rechazadas: 1,
      duplicadas: 1,
      reemplazadas: 0,
      enProceso: 0,
      codigosDeRechazo: { INVALID_TOKEN: 1 },
    });
    expect(typeof linea?.duracionMs).toBe('number');
  });

  it('cuenta las ops que quedaron en proceso en otro request', async () => {
    const e = await escenarioDeSync();
    const op = opScore(e.participantIds[0] as string, 1, ['11', '8']);
    await marcaEnProceso(op.opId, e.patrolId, 5);

    await sincronizar(e, [op]);

    expect(lineasDeLote()[0]).toMatchObject({ ops: 1, enProceso: 1, aplicadas: 0 });
  });

  it('no escribe la línea de un torneo que no está en curso: ahí no se procesó nada', async () => {
    const e = await escenarioDeSync();
    await e.admin.post(`/api/admin/tournaments/${e.tournamentId}/unstart`);

    await sincronizar(e, [opScore(e.participantIds[0] as string, 1, ['11', '8'])]);

    expect(lineasDeLote()).toHaveLength(0);
  });
});
