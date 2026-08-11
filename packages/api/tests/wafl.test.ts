import type { BowCategory } from '@bal/shared';
import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { participants, patrols, scores, syncOps, tournaments } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import { resetEnvCache } from '../src/env.js';
import { decryptPin } from '../src/lib/crypto.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import { clearDb, startDb, stopDb, testEnv, testEnvRaw } from './helpers.js';

/**
 * Login de patrulla, bundle y sincronización (BE-8, BE-9, BE-10).
 *
 * BE-10 es la tarea más crítica del backend: si la sincronización pierde o
 * duplica un puntaje, el torneo queda mal. Ver docs/OFFLINE_SYNC.md §6.
 */

const PASSWORD = 'password-de-test-1234';
const CSRF = 'c'.repeat(43);
let db: Db;
let uuidN = 0;

const uuid = () => `0192f3a1-8c4e-7000-9abc-${String(++uuidN).padStart(12, '0')}`;

beforeAll(async () => {
  Object.assign(process.env, testEnvRaw());
  resetEnvCache();
  db = await startDb();
}, 120_000);

afterAll(async () => {
  await stopDb();
});

afterEach(() => resetRateLimits());

// ── Cliente ──────────────────────────────────────────────────────────────────

function cliente() {
  const app = createApp();
  let sesion = '';

  const pedir = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers);
    headers.set('cookie', [`bal_csrf=${CSRF}`, sesion].filter(Boolean).join('; '));
    headers.set('x-csrf-token', CSRF);
    if (init.body) headers.set('content-type', 'application/json');

    const res = await app.request(`http://localhost${path}`, { ...init, headers });
    const set = res.headers.get('set-cookie');
    if (set?.includes('bal_session=')) sesion = set.split(';')[0] ?? '';
    return res;
  };

  return {
    get: (p: string) => pedir(p),
    post: (p: string, body?: unknown) =>
      pedir(p, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) }),
  };
}

// ── Escenario ────────────────────────────────────────────────────────────────

interface Escenario {
  tournamentId: string;
  patrolId: ObjectId;
  patrolUsername: string;
  pin: string;
  participantIds: string[];
  targetCount: number;
}

/** Torneo iniciado, con una patrulla lista para anotar. */
async function escenario(
  composicion: [BowCategory, number][] = [['razo', 2]],
  targets = [
    { index: 1, modality: '3d', arrows: 2, description: null },
    { index: 2, modality: 'sala', arrows: 3, description: null },
  ],
): Promise<Escenario> {
  const admin = cliente();
  await admin.post('/api/auth/admin/login', { username: 'admin', password: PASSWORD });
  await admin.post('/api/auth/admin/password', {
    currentPassword: PASSWORD,
    newPassword: 'un-password-nuevo-largo',
  });

  const seasonRes = await admin.post('/api/admin/seasons', {
    name: 'Liga 2026',
    startsAt: '2026-01-01',
    endsAt: '2026-12-31',
  });
  const seasonId = ((await seasonRes.json()) as { season: { id: string } }).season.id;

  const archerIds: string[] = [];
  let n = 0;
  for (const [category, cantidad] of composicion) {
    for (let i = 0; i < cantidad; i++) {
      n++;
      const res = await admin.post('/api/admin/archers', {
        firstName: `Nombre${n}`,
        lastName: `Apellido${String(n).padStart(3, '0')}`,
        category,
      });
      archerIds.push(((await res.json()) as { archer: { id: string } }).archer.id);
    }
  }

  const tRes = await admin.post('/api/admin/tournaments', {
    seasonId,
    name: 'Torneo',
    date: '2026-08-08',
    targets,
    archerIds,
  });
  const tournamentId = ((await tRes.json()) as { tournament: { id: string } }).tournament.id;

  await admin.post(`/api/admin/tournaments/${tournamentId}/start`);

  const patrulla = await patrols().findOne({ tournamentId: new ObjectId(tournamentId) });
  if (!patrulla) throw new Error('no se armó ninguna patrulla');

  const miembros = await participants().find({ patrolId: patrulla._id }).toArray();

  return {
    tournamentId,
    patrolId: patrulla._id,
    patrolUsername: patrulla.username,
    pin: decryptPin(patrulla.pinEnc, testEnv().PIN_ENC_KEY),
    participantIds: miembros.map((m) => m._id.toHexString()),
    targetCount: targets.length,
  };
}

/** Cliente autenticado como líder de patrulla. */
async function lider(e: Escenario) {
  const c = cliente();
  const res = await c.post('/api/auth/patrol/login', {
    tournamentId: e.tournamentId,
    username: e.patrolUsername,
    pin: e.pin,
  });
  if (res.status !== 200) throw new Error(`login de patrulla falló: ${res.status}`);
  return c;
}

const opScore = (participantId: string, targetIndex: number, arrows: string[], overrides = {}) => ({
  type: 'score' as const,
  opId: uuid(),
  clientUpdatedAt: new Date().toISOString(),
  participantId,
  targetIndex,
  arrows,
  ...overrides,
});

beforeEach(async () => {
  await clearDb(db);
  await seed(db, testEnv());
});

// ── BE-8 · Login de patrulla ─────────────────────────────────────────────────

describe('login de patrulla', () => {
  it('acepta usuario y PIN correctos', async () => {
    const e = await escenario();
    const c = cliente();

    const res = await c.post('/api/auth/patrol/login', {
      tournamentId: e.tournamentId,
      username: e.patrolUsername,
      pin: e.pin,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { patrol: { username: string; startTargetIndex: number } };
    expect(body.patrol.username).toBe(e.patrolUsername);
  });

  it('rechaza un PIN incorrecto', async () => {
    const e = await escenario();
    const res = await cliente().post('/api/auth/patrol/login', {
      tournamentId: e.tournamentId,
      username: e.patrolUsername,
      pin: '000000',
    });
    expect(res.status).toBe(401);
  });

  it('NO funciona con el torneo sin iniciar', async () => {
    // Antes de arrancar no hay nada que anotar.
    const e = await escenario();
    await tournaments().updateOne(
      { _id: new ObjectId(e.tournamentId) },
      { $set: { status: 'sin_iniciar' } },
    );

    const res = await cliente().post('/api/auth/patrol/login', {
      tournamentId: e.tournamentId,
      username: e.patrolUsername,
      pin: e.pin,
    });
    expect(res.status).toBe(409);
  });

  it('NO funciona con el torneo completado', async () => {
    const e = await escenario();
    await tournaments().updateOne(
      { _id: new ObjectId(e.tournamentId) },
      { $set: { status: 'completado' } },
    );

    const res = await cliente().post('/api/auth/patrol/login', {
      tournamentId: e.tournamentId,
      username: e.patrolUsername,
      pin: e.pin,
    });
    expect(res.status).toBe(409);
  });

  it('bloquea tras 5 intentos y rechaza el 6º aun con el PIN correcto', async () => {
    const e = await escenario();
    const c = cliente();

    for (let i = 0; i < 5; i++) {
      await c.post('/api/auth/patrol/login', {
        tournamentId: e.tournamentId,
        username: e.patrolUsername,
        pin: '000000',
      });
    }

    const res = await c.post('/api/auth/patrol/login', {
      tournamentId: e.tournamentId,
      username: e.patrolUsername,
      pin: e.pin,
    });
    expect(res.status).toBe(429);
  });

  it('una sesión de patrulla no puede tocar rutas de admin', async () => {
    const e = await escenario();
    const c = await lider(e);
    expect((await c.get('/api/admin/archers')).status).toBe(401);
  });
});

// ── BE-9 · Bundle ────────────────────────────────────────────────────────────

describe('bundle', () => {
  it('exige sesión de patrulla', async () => {
    expect((await cliente().get('/api/wafl/bundle')).status).toBe(401);
  });

  it('trae todo lo necesario para el recorrido completo', async () => {
    const e = await escenario();
    const c = await lider(e);

    const body = (await (await c.get('/api/wafl/bundle')).json()) as {
      tournament: { targets: { index: number }[]; maxPossibleScore: number };
      participants: unknown[];
      serverTime: string;
    };

    expect(body.tournament.targets).toHaveLength(2);
    expect(body.participants).toHaveLength(2);
    // 3D(2)×11 + sala(3)×10 = 52
    expect(body.tournament.maxPossibleScore).toBe(52);
    expect(body.serverTime).toBeTruthy();
  });

  it('ordena los blancos desde el de inicio de la patrulla', async () => {
    const targets = Array.from({ length: 6 }, (_, i) => ({
      index: i + 1,
      modality: 'sala',
      arrows: 3,
      description: null,
    }));
    const e = await escenario([['razo', 8]], targets);

    // La patrulla 2 arranca en un blanco distinto del 1.
    const segunda = await patrols().findOne({
      tournamentId: new ObjectId(e.tournamentId),
      number: 2,
    });
    if (!segunda) return;

    const c = cliente();
    await c.post('/api/auth/patrol/login', {
      tournamentId: e.tournamentId,
      username: segunda.username,
      pin: decryptPin(segunda.pinEnc, testEnv().PIN_ENC_KEY),
    });

    const body = (await (await c.get('/api/wafl/bundle')).json()) as {
      tournament: { targets: { index: number }[] };
      patrol: { startTargetIndex: number };
    };

    expect(body.tournament.targets[0]?.index).toBe(body.patrol.startTargetIndex);
    expect(body.tournament.targets).toHaveLength(6);
    // Están los 6, sin repetir.
    expect(new Set(body.tournament.targets.map((t) => t.index)).size).toBe(6);
  });
});

// ── BE-10 · Sincronización ───────────────────────────────────────────────────

describe('sincronización', () => {
  it('aplica un puntaje y devuelve los totales calculados por el SERVIDOR', async () => {
    const e = await escenario();
    const c = await lider(e);

    const res = await c.post('/api/wafl/sync', {
      ops: [opScore(e.participantIds[0] as string, 1, ['11', '8'])],
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: { status: string; score?: { total: number; innerCount: number } }[];
    };

    expect(body.results[0]?.status).toBe('applied');
    expect(body.results[0]?.score?.total).toBe(19);
    expect(body.results[0]?.score?.innerCount).toBe(1);
  });

  it('IGNORA cualquier total que mande el cliente', async () => {
    const e = await escenario();
    const c = await lider(e);

    await c.post('/api/wafl/sync', {
      ops: [
        // `total` ni siquiera está en el schema, pero aunque llegara se descarta:
        // el servidor deriva el valor de cada token.
        opScore(e.participantIds[0] as string, 1, ['5', '5']),
      ],
    });

    const doc = await scores().findOne({});
    expect(doc?.total).toBe(10);
  });

  it('actualiza los rollups del participante', async () => {
    const e = await escenario();
    const c = await lider(e);

    await c.post('/api/wafl/sync', {
      ops: [opScore(e.participantIds[0] as string, 1, ['11', '11'])],
    });

    const p = await participants().findOne({ _id: new ObjectId(e.participantIds[0]) });
    expect(p?.total).toBe(22);
    expect(p?.innerCount).toBe(2);
    expect(p?.targetsCompleted).toBe(1);
    expect(p?.byModality['3d']).toBe(22);
    // 22 / 52 = 42.31%
    expect(p?.normalizedPct).toBeCloseTo(42.31, 1);
  });

  describe('idempotencia', () => {
    it('el mismo batch enviado dos veces no duplica nada', async () => {
      const e = await escenario();
      const c = await lider(e);
      const ops = [opScore(e.participantIds[0] as string, 1, ['11', '8'])];

      const primera = (await (await c.post('/api/wafl/sync', { ops })).json()) as {
        results: { status: string }[];
      };
      const segunda = (await (await c.post('/api/wafl/sync', { ops })).json()) as {
        results: { status: string }[];
      };

      expect(primera.results[0]?.status).toBe('applied');
      expect(segunda.results[0]?.status).toBe('duplicate');

      expect(await scores().countDocuments()).toBe(1);
      const p = await participants().findOne({ _id: new ObjectId(e.participantIds[0]) });
      expect(p?.total).toBe(19);
    });

    it('registra la op para que el TTL la limpie después', async () => {
      const e = await escenario();
      const c = await lider(e);
      const op = opScore(e.participantIds[0] as string, 1, ['11', '8']);

      await c.post('/api/wafl/sync', { ops: [op] });

      const registro = await syncOps().findOne({ _id: op.opId });
      expect(registro?.result).toBe('applied');
      expect(registro?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('editar un puntaje', () => {
    it('recalcula el rollup por delta, sin sumar dos veces', async () => {
      const e = await escenario();
      const c = await lider(e);
      const pid = e.participantIds[0] as string;

      await c.post('/api/wafl/sync', { ops: [opScore(pid, 1, ['11', '11'])] });
      await c.post('/api/wafl/sync', { ops: [opScore(pid, 1, ['5', '5'])] });

      const p = await participants().findOne({ _id: new ObjectId(pid) });
      expect(p?.total).toBe(10);
      expect(p?.innerCount).toBe(0);
      // Sigue siendo UN blanco completado, no dos.
      expect(p?.targetsCompleted).toBe(1);
      expect(await scores().countDocuments()).toBe(1);
    });
  });

  describe('last-write-wins', () => {
    it('una op más vieja NO pisa a una más nueva', async () => {
      const e = await escenario();
      const c = await lider(e);
      const pid = e.participantIds[0] as string;

      const nueva = opScore(pid, 1, ['11', '11'], {
        clientUpdatedAt: new Date('2026-08-10T15:00:00Z').toISOString(),
      });
      const vieja = opScore(pid, 1, ['5', '5'], {
        clientUpdatedAt: new Date('2026-08-10T14:00:00Z').toISOString(),
      });

      await c.post('/api/wafl/sync', { ops: [nueva] });
      const res = (await (await c.post('/api/wafl/sync', { ops: [vieja] })).json()) as {
        results: { status: string; score?: { total: number } }[];
      };

      expect(res.results[0]?.status).toBe('superseded');
      expect(res.results[0]?.score?.total).toBe(22);
      expect((await scores().findOne({}))?.total).toBe(22);
    });

    it('una op más nueva sí pisa a la anterior', async () => {
      const e = await escenario();
      const c = await lider(e);
      const pid = e.participantIds[0] as string;

      await c.post('/api/wafl/sync', {
        ops: [
          opScore(pid, 1, ['5', '5'], {
            clientUpdatedAt: new Date('2026-08-10T14:00:00Z').toISOString(),
          }),
        ],
      });
      const res = (await (
        await c.post('/api/wafl/sync', {
          ops: [
            opScore(pid, 1, ['11', '11'], {
              clientUpdatedAt: new Date('2026-08-10T15:00:00Z').toISOString(),
            }),
          ],
        })
      ).json()) as { results: { status: string }[] };

      expect(res.results[0]?.status).toBe('applied');
      expect((await scores().findOne({}))?.total).toBe(22);
    });
  });

  describe('autorización por operación', () => {
    // Es lo que impide el IDOR entre patrullas.
    it('rechaza una op de un participante de OTRA patrulla', async () => {
      const e = await escenario([['razo', 8]]);
      const c = await lider(e);

      const otraPatrulla = await patrols().findOne({
        tournamentId: new ObjectId(e.tournamentId),
        _id: { $ne: e.patrolId },
      });
      if (!otraPatrulla) throw new Error('hacen falta al menos dos patrullas');

      const ajeno = await participants().findOne({ patrolId: otraPatrulla._id });
      if (!ajeno) throw new Error('la otra patrulla no tiene miembros');

      const res = (await (
        await c.post('/api/wafl/sync', {
          ops: [opScore(ajeno._id.toHexString(), 1, ['11', '8'])],
        })
      ).json()) as { results: { status: string; error?: { code: string } }[] };

      expect(res.results[0]?.status).toBe('rejected');
      expect(res.results[0]?.error?.code).toBe('FORBIDDEN');
      expect(await scores().countDocuments()).toBe(0);
    });

    it('en un batch MIXTO aplica las propias y rechaza las ajenas', async () => {
      const e = await escenario([['razo', 8]]);
      const c = await lider(e);

      const otraPatrulla = await patrols().findOne({
        tournamentId: new ObjectId(e.tournamentId),
        _id: { $ne: e.patrolId },
      });
      const ajeno = await participants().findOne({ patrolId: otraPatrulla?._id });

      const res = (await (
        await c.post('/api/wafl/sync', {
          ops: [
            opScore(e.participantIds[0] as string, 1, ['11', '8']),
            opScore(ajeno?._id.toHexString() as string, 1, ['11', '11']),
          ],
        })
      ).json()) as { results: { status: string }[] };

      expect(res.results[0]?.status).toBe('applied');
      expect(res.results[1]?.status).toBe('rejected');
      expect(await scores().countDocuments()).toBe(1);
    });
  });

  describe('validación contra la modalidad DEL BLANCO', () => {
    it('rechaza un 11 en un blanco de sala', async () => {
      const e = await escenario();
      const c = await lider(e);

      // El blanco 2 es de sala: el 11 no existe ahí.
      const res = (await (
        await c.post('/api/wafl/sync', {
          ops: [opScore(e.participantIds[0] as string, 2, ['11', '10', '9'])],
        })
      ).json()) as { results: { status: string; error?: { code: string } }[] };

      expect(res.results[0]?.status).toBe('rejected');
      expect(res.results[0]?.error?.code).toBe('INVALID_TOKEN');
    });

    it('rechaza una X en un blanco 3D', async () => {
      const e = await escenario();
      const c = await lider(e);

      const res = (await (
        await c.post('/api/wafl/sync', {
          ops: [opScore(e.participantIds[0] as string, 1, ['X', '10'])],
        })
      ).json()) as { results: { status: string; error?: { code: string } }[] };

      expect(res.results[0]?.error?.code).toBe('INVALID_TOKEN');
    });

    it('rechaza la cantidad de flechas equivocada', async () => {
      const e = await escenario();
      const c = await lider(e);

      const res = (await (
        await c.post('/api/wafl/sync', {
          ops: [opScore(e.participantIds[0] as string, 1, ['11', '10', '8'])],
        })
      ).json()) as { results: { status: string; error?: { code: string } }[] };

      expect(res.results[0]?.error?.code).toBe('ARROW_COUNT');
    });

    it('rechaza un blanco que no existe en el torneo', async () => {
      // El torneo tiene 2 blancos. El 5 pasa el schema pero no existe acá.
      const e = await escenario();
      const c = await lider(e);

      const res = (await (
        await c.post('/api/wafl/sync', {
          ops: [opScore(e.participantIds[0] as string, 5, ['11', '8'])],
        })
      ).json()) as { results: { status: string; error?: { code: string } }[] };

      expect(res.results[0]?.status).toBe('rejected');
      expect(res.results[0]?.error?.code).toBe('NOT_FOUND');
    });

    it('un índice de blanco fuera del rango permitido lo frena el schema', async () => {
      const e = await escenario();
      const c = await lider(e);

      const res = await c.post('/api/wafl/sync', {
        ops: [opScore(e.participantIds[0] as string, 999, ['11', '8'])],
      });
      expect(res.status).toBe(400);
    });
  });

  describe('el batch nunca falla entero', () => {
    // Un close rechazado no puede hacer que se pierdan 40 puntajes válidos.
    it('una op inválida no impide que se apliquen las válidas', async () => {
      const e = await escenario();
      const c = await lider(e);
      const pid = e.participantIds[0] as string;

      const res = await c.post('/api/wafl/sync', {
        ops: [
          opScore(pid, 1, ['11', '8']),
          opScore(pid, 2, ['11', '10', '9']), // inválida: 11 en sala
          { type: 'close' as const, opId: uuid(), clientUpdatedAt: new Date().toISOString() },
        ],
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { results: { status: string }[] };

      expect(body.results[0]?.status).toBe('applied');
      expect(body.results[1]?.status).toBe('rejected');
      expect(body.results[2]?.status).toBe('rejected');
      expect(await scores().countDocuments()).toBe(1);
    });

    it('acepta un batch de 200 ops sin caer en rate limit', async () => {
      // Una patrulla que vuelve de tres horas sin señal manda cientos de golpe.
      const e = await escenario();
      const c = await lider(e);

      const ops = Array.from({ length: 200 }, () =>
        opScore(e.participantIds[0] as string, 1, ['11', '8']),
      );

      const res = await c.post('/api/wafl/sync', { ops });
      expect(res.status).toBe(200);
    });
  });

  describe('cierre del circuito', () => {
    it('rechaza el cierre si faltan puntajes', async () => {
      const e = await escenario();
      const c = await lider(e);

      const res = (await (
        await c.post('/api/wafl/sync', {
          ops: [
            { type: 'close' as const, opId: uuid(), clientUpdatedAt: new Date().toISOString() },
          ],
        })
      ).json()) as { results: { status: string; error?: { code: string } }[] };

      expect(res.results[0]?.status).toBe('rejected');
      expect(res.results[0]?.error?.code).toBe('VALIDATION_ERROR');
    });

    it('rechaza el cierre si faltan firmas', async () => {
      const e = await escenario();
      const c = await lider(e);

      // Todos los puntajes, ninguna firma.
      const ops = e.participantIds.flatMap((pid) => [
        opScore(pid, 1, ['11', '8']),
        opScore(pid, 2, ['X', '10', '9']),
      ]);
      await c.post('/api/wafl/sync', { ops });

      const res = (await (
        await c.post('/api/wafl/sync', {
          ops: [
            { type: 'close' as const, opId: uuid(), clientUpdatedAt: new Date().toISOString() },
          ],
        })
      ).json()) as { results: { status: string; error?: { code: string } }[] };

      expect(res.results[0]?.error?.code).toBe('SIGNATURES_MISSING');
      expect((await patrols().findOne({ _id: e.patrolId }))?.status).not.toBe('cerrada');
    });
  });

  describe('firmas', () => {
    const PNG_REAL = `data:image/png;base64,${Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]).toString('base64')}`;

    it('acepta un PNG real', async () => {
      const e = await escenario();
      const c = await lider(e);

      const res = (await (
        await c.post('/api/wafl/sync', {
          ops: [
            {
              type: 'signature' as const,
              opId: uuid(),
              clientUpdatedAt: new Date().toISOString(),
              participantId: e.participantIds[0],
              pngDataUrl: PNG_REAL,
            },
          ],
        })
      ).json()) as { results: { status: string }[] };

      expect(res.results[0]?.status).toBe('applied');
      const p = await participants().findOne({ _id: new ObjectId(e.participantIds[0]) });
      expect(p?.signature?.scorecardHash).toBeTruthy();
    });

    // El prefijo `data:image/png;base64,` es texto que el cliente elige:
    // se comprueban los magic bytes del formato.
    it('rechaza algo que dice ser PNG pero no lo es', async () => {
      const e = await escenario();
      const c = await lider(e);

      const res = (await (
        await c.post('/api/wafl/sync', {
          ops: [
            {
              type: 'signature' as const,
              opId: uuid(),
              clientUpdatedAt: new Date().toISOString(),
              participantId: e.participantIds[0],
              pngDataUrl: `data:image/png;base64,${Buffer.from('<script>alert(1)</script>').toString('base64')}`,
            },
          ],
        })
      ).json()) as { results: { status: string; error?: { code: string } }[] };

      expect(res.results[0]?.status).toBe('rejected');
      expect(res.results[0]?.error?.code).toBe('VALIDATION_ERROR');
    });
  });
});
