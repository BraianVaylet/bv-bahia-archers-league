import { randomUUID as uuid } from 'node:crypto';
import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, participants, scores, tournaments } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import { resetEnvCache } from '../src/env.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
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
 * Corrección de puntajes por el admin, contra la planilla de papel (`BE-25`).
 *
 * La planilla de papel es la fuente de verdad y la app es la que registra el ranking: si no
 * coinciden, el admin corrige la app **antes de publicar**. Es el único camino, además del sync de
 * WAFL, que escribe un puntaje, así que sigue las mismas reglas: el servidor deriva los valores de
 * los tokens con la modalidad **de ese blanco** y recalcula los totales; nunca lee un total.
 *
 * Decisiones 2 y 3 de la Fase 9: sólo con el torneo esperando publicación, y la firma del arquero
 * no se borra (queda marcada como corregida después de firmar).
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

/** El líder anota el blanco 1 (3D) de su primer arquero y el torneo queda esperando publicación. */
async function torneoParaCorregir(): Promise<EscenarioDeSync & { pid: string }> {
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

  return { ...e, pid };
}

const ruta = (e: { tournamentId: string }, pid: string, blanco: number) =>
  `/api/admin/tournaments/${e.tournamentId}/participants/${pid}/scores/${blanco}`;

const MOTIVO = 'La planilla dice 10 y 10.';

const rollups = async (pid: string) => {
  const p = await participants().findOne({ _id: new ObjectId(pid) });
  return {
    total: p?.total,
    innerCount: p?.innerCount,
    xCount: p?.xCount,
    tenCount: p?.tenCount,
    mCount: p?.mCount,
    targetsCompleted: p?.targetsCompleted,
    normalizedPct: p?.normalizedPct,
    byModality: p?.byModality,
  };
};

describe('corregir un puntaje', () => {
  it('reemplaza las flechas y recalcula el blanco y los totales del arquero', async () => {
    const e = await torneoParaCorregir();
    const antes = await rollups(e.pid);

    const res = await e.admin.put(ruta(e, e.pid, 1), { arrows: ['10', '10'], reason: MOTIVO });

    expect(res.status).toBe(200);
    const blanco = await scores().findOne({ participantId: new ObjectId(e.pid), targetIndex: 1 });
    expect(blanco?.arrows).toEqual(['10', '10']);
    expect(blanco?.total).toBe(20);
    expect(blanco?.correctedAt).toBeInstanceOf(Date);

    const despues = await rollups(e.pid);
    expect(despues.total).toBe((antes.total ?? 0) + 1);
    expect(despues.targetsCompleted).toBe(antes.targetsCompleted);
    expect(despues.normalizedPct).not.toBe(antes.normalizedPct);
  });

  /** Un blanco que el líder no llegó a anotar también se corrige: está en el papel. */
  it('carga un blanco que en la app quedó vacío, y lo cuenta como completado', async () => {
    const e = await torneoParaCorregir();
    const antes = await rollups(e.pid);

    const res = await e.admin.put(ruta(e, e.pid, 14), { arrows: ['10', '9', 'M'], reason: MOTIVO });

    expect(res.status).toBe(200);
    const despues = await rollups(e.pid);
    expect(despues.total).toBe((antes.total ?? 0) + 19);
    expect(despues.targetsCompleted).toBe((antes.targetsCompleted ?? 0) + 1);
  });

  /** El delta no deja residuos: ida y vuelta, los rollups quedan exactamente como estaban. */
  it('corregir y volver al valor original deja los totales idénticos', async () => {
    const e = await torneoParaCorregir();
    const antes = await rollups(e.pid);

    await e.admin.put(ruta(e, e.pid, 1), { arrows: ['5', 'M'], reason: MOTIVO });
    await e.admin.put(ruta(e, e.pid, 1), { arrows: ['11', '8'], reason: 'Me equivoqué.' });

    expect(await rollups(e.pid)).toEqual(antes);
  });

  it('deja en el audit log quién, qué blanco, las flechas de antes y de después, y por qué', async () => {
    const e = await torneoParaCorregir();

    await e.admin.put(ruta(e, e.pid, 1), { arrows: ['10', '10'], reason: MOTIVO });

    const registro = await auditLog().findOne({ action: 'score.admin_correct' });
    expect(registro?.actorType).toBe('admin');
    expect(registro?.entityId.toHexString()).toBe(e.pid);
    expect(registro?.meta).toMatchObject({
      targetIndex: 1,
      before: ['11', '8'],
      after: ['10', '10'],
      reason: MOTIVO,
    });
  });

  /** Decisión 3: la firma vale la del papel. Se conserva y el audit log dice que fue después. */
  it('no borra la firma del arquero, y anota que se corrigió después de firmar', async () => {
    const e = await torneoParaCorregir();
    await participants().updateOne(
      { _id: new ObjectId(e.pid) },
      {
        $set: {
          signature: {
            pngDataUrl: 'data:image/png;base64,AAAA',
            signedAt: new Date(),
            scorecardHash: 'x',
            unlockedBy: null,
            unlockReason: null,
          },
        },
      },
    );

    const res = await e.admin.put(ruta(e, e.pid, 1), { arrows: ['10', '10'], reason: MOTIVO });

    expect(res.status).toBe(200);
    expect((await participants().findOne({ _id: new ObjectId(e.pid) }))?.signature).not.toBeNull();
    const registro = await auditLog().findOne({ action: 'score.admin_correct' });
    expect(registro?.meta).toMatchObject({ despuesDeFirmar: true });
  });
});

describe('lo que la corrección no acepta', () => {
  /** Regla 1: el servidor es la autoridad del puntaje. Un total en el body no se lee: se rechaza. */
  it('un total en el body se rechaza', async () => {
    const e = await torneoParaCorregir();

    const res = await e.admin.put(ruta(e, e.pid, 1), {
      arrows: ['10', '10'],
      reason: MOTIVO,
      total: 999,
    });

    expect(res.status).toBe(400);
  });

  /**
   * La modalidad es **del blanco**: un `11` vale en el 3D y no en el de sala del mismo torneo, y
   * una `X` al revés.
   */
  it.each([
    [1, ['X', '10'], 'INVALID_TOKEN'],
    [14, ['11', '10', '9'], 'INVALID_TOKEN'],
    [1, ['10', '10', '10'], 'ARROW_COUNT'],
  ])('en el blanco %i, %j se rechaza con %s', async (blanco, arrows, code) => {
    const e = await torneoParaCorregir();

    const res = await e.admin.put(ruta(e, e.pid, blanco), { arrows, reason: MOTIVO });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(code);
  });

  it('sin motivo se rechaza: el audit log tiene que poder explicar la corrección', async () => {
    const e = await torneoParaCorregir();

    const res = await e.admin.put(ruta(e, e.pid, 1), { arrows: ['10', '10'] });

    expect(res.status).toBe(400);
  });

  /** Decisión 2: en proceso el líder sigue anotando; publicado, primero se despublica. */
  it.each(['en_proceso', 'publicado', 'sin_iniciar'] as const)(
    'con el torneo %s responde FIELD_NOT_EDITABLE y no toca nada',
    async (status) => {
      const e = await torneoParaCorregir();
      await tournaments().updateOne({}, { $set: { status } });
      const antes = await rollups(e.pid);

      const res = await e.admin.put(ruta(e, e.pid, 1), { arrows: ['10', '10'], reason: MOTIVO });

      expect(res.status).toBe(409);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
        'FIELD_NOT_EDITABLE',
      );
      expect(await rollups(e.pid)).toEqual(antes);
    },
  );

  /** El id existe, pero es de otro torneo: no se puede corregir desde la ruta de éste. */
  it('un participante de otro torneo da 404, sin tocarlo', async () => {
    const e = await torneoParaCorregir();
    const original = await participants().findOne({ _id: new ObjectId(e.pid) });
    if (!original) throw new Error('sin participante');
    const ajeno = { ...original, _id: new ObjectId(), tournamentId: new ObjectId() };
    await participants().insertOne(ajeno);

    const res = await e.admin.put(ruta(e, ajeno._id.toHexString(), 1), {
      arrows: ['10', '10'],
      reason: MOTIVO,
    });

    expect(res.status).toBe(404);
    expect(await scores().countDocuments({ participantId: ajeno._id })).toBe(0);
  });

  it('un participante que no existe da 404', async () => {
    const e = await torneoParaCorregir();

    const res = await e.admin.put(ruta(e, new ObjectId().toHexString(), 1), {
      arrows: ['10', '10'],
      reason: MOTIVO,
    });

    expect(res.status).toBe(404);
  });

  it('un blanco que no existe en el recorrido da 404', async () => {
    const e = await torneoParaCorregir();

    const res = await e.admin.put(ruta(e, e.pid, 15), { arrows: ['10', '10'], reason: MOTIVO });

    expect(res.status).toBe(404);
  });

  it('un arquero ausente no tiene puntajes que corregir', async () => {
    const e = await torneoParaCorregir();
    await participants().updateOne({ _id: new ObjectId(e.pid) }, { $set: { status: 'ausente' } });

    const res = await e.admin.put(ruta(e, e.pid, 1), { arrows: ['10', '10'], reason: MOTIVO });

    expect(res.status).toBe(409);
  });

  it('sin sesión de admin no corrige nada', async () => {
    const e = await torneoParaCorregir();
    const antes = await rollups(e.pid);

    const res = await cliente().put(ruta(e, e.pid, 1), { arrows: ['10', '10'], reason: MOTIVO });

    expect(res.status).not.toBe(200);
    expect(await rollups(e.pid)).toEqual(antes);
  });
});

/**
 * La tarjeta de un arquero para el admin: lo que FE-34 pone al lado de la planilla de papel. A
 * diferencia de la pública, se ve en cualquier estado del torneo.
 */
describe('tarjeta de puntajes para el admin', () => {
  const tarjeta = (e: EscenarioDeSync & { pid: string }) =>
    e.admin.get(`/api/admin/tournaments/${e.tournamentId}/participants/${e.pid}/scorecard`);

  it('trae cada blanco con sus flechas aunque el torneo no esté publicado', async () => {
    const e = await torneoParaCorregir();

    const res = await tarjeta(e);

    expect(res.status).toBe(200);
    const { scorecard } = (await res.json()) as {
      scorecard: { rows: { targetIndex: number; arrows: { token: string }[] }[] };
    };
    expect(scorecard.rows).toHaveLength(14);
    expect(scorecard.rows[0]?.arrows.map((a) => a.token)).toEqual(['11', '8']);
  });

  it('marca los blancos que el admin corrigió', async () => {
    const e = await torneoParaCorregir();
    await e.admin.put(ruta(e, e.pid, 1), { arrows: ['10', '10'], reason: MOTIVO });

    const { scorecard } = (await (await tarjeta(e)).json()) as {
      scorecard: { corrected: number[] };
    };
    expect(scorecard.corrected).toEqual([1]);
  });

  it('sin sesión de admin no se ve', async () => {
    const e = await torneoParaCorregir();

    const res = await cliente().get(
      `/api/admin/tournaments/${e.tournamentId}/participants/${e.pid}/scorecard`,
    );

    expect(res.status).toBe(401);
  });
});
