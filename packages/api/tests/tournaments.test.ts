import type { BowCategory } from '@bal/shared';
import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { archers, auditLog, participants, patrols, tournaments } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import { resetEnvCache } from '../src/env.js';
import { decryptPin, verifySecret } from '../src/lib/crypto.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import { clearDb, startDb, stopDb, testEnv, testEnvRaw } from './helpers.js';

/**
 * Padrón, temporadas y creación de torneos (BE-4 y BE-5).
 *
 * Contra MongoDB real en modo replica set: la creación de torneo es
 * transaccional y sin transacciones no se puede probar el rollback.
 */

const PASSWORD = 'password-de-test-1234';
const CSRF = 'c'.repeat(43);
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
  vi.restoreAllMocks();
});

// ── Cliente autenticado ──────────────────────────────────────────────────────

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
    patch: (p: string, body: unknown) => pedir(p, { method: 'PATCH', body: JSON.stringify(body) }),
    del: (p: string) => pedir(p, { method: 'DELETE' }),
  };
}

/** Admin con el password ya cambiado, para poder usar las rutas protegidas. */
async function adminListo() {
  const c = cliente();
  await c.post('/api/auth/admin/login', { username: 'admin', password: PASSWORD });
  await c.post('/api/auth/admin/password', {
    currentPassword: PASSWORD,
    newPassword: 'un-password-nuevo-largo',
  });
  return c;
}

beforeEach(async () => {
  await clearDb(db);
  await seed(db, testEnv());
});

// ── Datos de prueba ──────────────────────────────────────────────────────────

const crearArqueros = async (c: ReturnType<typeof cliente>, defs: [BowCategory, number][]) => {
  const ids: string[] = [];
  let n = 0;
  for (const [category, cantidad] of defs) {
    for (let i = 0; i < cantidad; i++) {
      n++;
      const res = await c.post('/api/admin/archers', {
        firstName: `Nombre${n}`,
        lastName: `Apellido${String(n).padStart(3, '0')}`,
        category,
      });
      const body = (await res.json()) as { archer: { id: string } };
      ids.push(body.archer.id);
    }
  }
  return ids;
};

const crearTemporada = async (c: ReturnType<typeof cliente>) => {
  const res = await c.post('/api/admin/seasons', {
    name: 'Liga Bahiense 2026',
    startsAt: '2026-01-01',
    endsAt: '2026-12-31',
  });
  return ((await res.json()) as { season: { id: string } }).season.id;
};

/** Recorrido de referencia del brief: 14 blancos, máximo 330. */
const recorridoDeReferencia = () => [
  ...Array.from({ length: 6 }, (_, i) => ({
    index: i + 1,
    modality: '3d',
    arrows: 2,
    description: null,
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    index: i + 7,
    modality: 'campo',
    arrows: 3,
    description: null,
  })),
  { index: 13, modality: 'aire_libre', arrows: 6, description: null },
  { index: 14, modality: 'sala', arrows: 3, description: null },
];

// ── BE-4 · Padrón ────────────────────────────────────────────────────────────

describe('arqueros', () => {
  it('exige sesión de admin', async () => {
    expect((await cliente().get('/api/admin/archers')).status).toBe(401);
  });

  it('crea y lista', async () => {
    const c = await adminListo();
    const res = await c.post('/api/admin/archers', {
      firstName: 'Juan',
      lastName: 'Pérez',
      category: 'razo',
    });
    expect(res.status).toBe(201);

    const lista = (await (await c.get('/api/admin/archers')).json()) as {
      archers: { firstName: string }[];
    };
    expect(lista.archers).toHaveLength(1);
    expect(lista.archers[0]?.firstName).toBe('Juan');
  });

  it('busca sin depender de acentos ni mayúsculas', async () => {
    const c = await adminListo();
    await c.post('/api/admin/archers', {
      firstName: 'Ángel',
      lastName: 'Gómez',
      category: 'razo',
    });

    const res = (await (await c.get('/api/admin/archers?q=gomez')).json()) as {
      archers: unknown[];
    };
    expect(res.archers).toHaveLength(1);
  });

  it('un término de búsqueda con metacaracteres no rompe ni escanea de más', async () => {
    // Sin escapar, `.*` haría match con todo y `(a+)+$` sería un ReDoS.
    const c = await adminListo();
    await c.post('/api/admin/archers', {
      firstName: 'Juan',
      lastName: 'Pérez',
      category: 'razo',
    });

    const res = (await (await c.get('/api/admin/archers?q=.*')).json()) as { archers: unknown[] };
    expect(res.archers).toHaveLength(0);
  });

  it('archiva y restaura', async () => {
    const c = await adminListo();
    const [id] = await crearArqueros(c, [['razo', 1]]);

    await c.post(`/api/admin/archers/${id}/archive`);
    expect(
      ((await (await c.get('/api/admin/archers')).json()) as { archers: unknown[] }).archers,
    ).toHaveLength(0);
    expect(
      ((await (await c.get('/api/admin/archers?archived=true')).json()) as { archers: unknown[] })
        .archers,
    ).toHaveLength(1);

    await c.post(`/api/admin/archers/${id}/restore`);
    expect(
      ((await (await c.get('/api/admin/archers')).json()) as { archers: unknown[] }).archers,
    ).toHaveLength(1);
  });

  it('elimina un arquero que nunca participó', async () => {
    const c = await adminListo();
    const [id] = await crearArqueros(c, [['razo', 1]]);

    expect((await c.del(`/api/admin/archers/${id}`)).status).toBe(200);
    expect(await archers().countDocuments()).toBe(0);
  });

  it('NO elimina un arquero que participó de un torneo', async () => {
    const c = await adminListo();
    const seasonId = await crearTemporada(c);
    const ids = await crearArqueros(c, [['razo', 2]]);

    await c.post('/api/admin/tournaments', {
      seasonId,
      name: 'Torneo de prueba',
      date: '2026-08-08',
      targets: [{ index: 1, modality: 'sala', arrows: 3, description: null }],
      archerIds: ids,
    });

    const res = await c.del(`/api/admin/archers/${ids[0]}`);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('ARCHER_IN_USE');
    expect(await archers().countDocuments()).toBe(2);
  });

  it('un id malformado devuelve 404, no 500', async () => {
    const c = await adminListo();
    expect((await c.del('/api/admin/archers/no-es-un-id')).status).toBe(404);
  });

  it('rechaza una categoría inventada', async () => {
    const c = await adminListo();
    const res = await c.post('/api/admin/archers', {
      firstName: 'Juan',
      lastName: 'Pérez',
      category: 'ballesta',
    });
    expect(res.status).toBe(400);
  });
});

// ── BE-5 · Creación de torneo ────────────────────────────────────────────────

describe('creación de torneo', () => {
  it('crea el torneo, los participantes y las patrullas', async () => {
    const c = await adminListo();
    const seasonId = await crearTemporada(c);
    const ids = await crearArqueros(c, [
      ['recurvo', 2],
      ['compuesto', 4],
      ['cazador', 3],
      ['razo', 4],
      ['tradicional', 2],
      ['longbow', 1],
      ['escuela', 4],
    ]);
    expect(ids).toHaveLength(20);

    const res = await c.post('/api/admin/tournaments', {
      seasonId,
      name: '3ª fecha — Liga Bahiense',
      date: '2026-08-08',
      targets: recorridoDeReferencia(),
      archerIds: ids,
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      tournament: {
        id: string;
        maxPossibleScore: number;
        patrolCount: number;
        participantCount: number;
        requiresManualReview: boolean;
      };
    };

    // 6×3D(2)×11 + 6×campo(3)×6 + aire libre(6)×10 + sala(3)×10 = 330
    expect(body.tournament.maxPossibleScore).toBe(330);
    expect(body.tournament.participantCount).toBe(20);
    expect(body.tournament.requiresManualReview).toBe(false);

    expect(await participants().countDocuments()).toBe(20);
    expect(await patrols().countDocuments()).toBe(body.tournament.patrolCount);
  });

  it('el torneo arranca en sin_iniciar', async () => {
    const c = await adminListo();
    const seasonId = await crearTemporada(c);
    const ids = await crearArqueros(c, [['razo', 4]]);

    await c.post('/api/admin/tournaments', {
      seasonId,
      name: 'Torneo',
      date: '2026-08-08',
      targets: recorridoDeReferencia(),
      archerIds: ids,
    });

    expect((await tournaments().findOne({}))?.status).toBe('sin_iniciar');
  });

  describe('snapshot del participante', () => {
    it('congela nombre y categoría: editar el arquero después NO cambia el histórico', async () => {
      const c = await adminListo();
      const seasonId = await crearTemporada(c);
      const ids = await crearArqueros(c, [['razo', 2]]);

      await c.post('/api/admin/tournaments', {
        seasonId,
        name: 'Torneo',
        date: '2026-08-08',
        targets: [{ index: 1, modality: 'sala', arrows: 3, description: null }],
        archerIds: ids,
      });

      await c.patch(`/api/admin/archers/${ids[0]}`, {
        firstName: 'CambiadoDespues',
        lastName: 'CambiadoDespues',
        category: 'compuesto',
      });

      const p = await participants().findOne({ archerId: new ObjectId(ids[0]) });
      expect(p?.firstName).toBe('Nombre1');
      expect(p?.category).toBe('razo');
    });
  });

  describe('credenciales de patrulla', () => {
    it('genera usuario patrullaN y un PIN de 6 dígitos', async () => {
      const c = await adminListo();
      const seasonId = await crearTemporada(c);
      const ids = await crearArqueros(c, [['razo', 8]]);

      await c.post('/api/admin/tournaments', {
        seasonId,
        name: 'Torneo',
        date: '2026-08-08',
        targets: recorridoDeReferencia(),
        archerIds: ids,
      });

      const todas = await patrols().find({}).sort({ number: 1 }).toArray();
      expect(todas.length).toBeGreaterThan(0);

      for (const p of todas) {
        expect(p.username).toBe(`patrulla${p.number}`);

        const pin = decryptPin(p.pinEnc, testEnv().PIN_ENC_KEY);
        expect(pin).toMatch(/^\d{6}$/);
        // El hash verifica el mismo PIN que devuelve el descifrado.
        expect(await verifySecret(p.pinHash, pin)).toBe(true);
      }
    });

    it('el PIN no se guarda en claro en ningún campo', async () => {
      const c = await adminListo();
      const seasonId = await crearTemporada(c);
      const ids = await crearArqueros(c, [['razo', 4]]);

      await c.post('/api/admin/tournaments', {
        seasonId,
        name: 'Torneo',
        date: '2026-08-08',
        targets: recorridoDeReferencia(),
        archerIds: ids,
      });

      const p = await patrols().findOne({});
      const pin = decryptPin(p?.pinEnc ?? '', testEnv().PIN_ENC_KEY);

      expect(JSON.stringify(p)).not.toContain(pin);
      expect(p?.pinHash).toMatch(/^\$argon2id\$/);
    });

    it('dos patrullas no comparten PIN por casualidad del generador', async () => {
      const c = await adminListo();
      const seasonId = await crearTemporada(c);
      const ids = await crearArqueros(c, [['razo', 16]]);

      await c.post('/api/admin/tournaments', {
        seasonId,
        name: 'Torneo',
        date: '2026-08-08',
        targets: recorridoDeReferencia(),
        archerIds: ids,
      });

      const pins = (await patrols().find({}).toArray()).map((p) =>
        decryptPin(p.pinEnc, testEnv().PIN_ENC_KEY),
      );
      // Con 4 patrullas y 10^6 combinaciones, repetir sería sospechoso.
      expect(new Set(pins).size).toBe(pins.length);
    });
  });

  describe('rollback', () => {
    // Sin transacción quedaría un torneo con participantes y sin patrullas.
    it('si falla la inserción de participantes NO queda nada a medias', async () => {
      const c = await adminListo();
      const seasonId = await crearTemporada(c);
      const ids = await crearArqueros(c, [['razo', 4]]);

      const repo = await import('../src/repositories/tournamentRepo.js');
      vi.spyOn(repo, 'insertParticipants').mockRejectedValueOnce(
        new Error('fallo simulado al insertar participantes'),
      );

      const res = await c.post('/api/admin/tournaments', {
        seasonId,
        name: 'Torneo que falla',
        date: '2026-08-08',
        targets: recorridoDeReferencia(),
        archerIds: ids,
      });

      expect(res.status).toBe(500);
      expect(await tournaments().countDocuments()).toBe(0);
      expect(await patrols().countDocuments()).toBe(0);
      expect(await participants().countDocuments()).toBe(0);
    });
  });

  describe('validación', () => {
    it('rechaza una temporada inexistente', async () => {
      const c = await adminListo();
      const ids = await crearArqueros(c, [['razo', 2]]);

      const res = await c.post('/api/admin/tournaments', {
        seasonId: new ObjectId().toHexString(),
        name: 'Torneo',
        date: '2026-08-08',
        targets: [{ index: 1, modality: 'sala', arrows: 3, description: null }],
        archerIds: ids,
      });
      expect(res.status).toBe(404);
    });

    it('rechaza un arquero inexistente', async () => {
      const c = await adminListo();
      const seasonId = await crearTemporada(c);
      const ids = await crearArqueros(c, [['razo', 2]]);

      const res = await c.post('/api/admin/tournaments', {
        seasonId,
        name: 'Torneo',
        date: '2026-08-08',
        targets: [{ index: 1, modality: 'sala', arrows: 3, description: null }],
        archerIds: [...ids, new ObjectId().toHexString()],
      });
      expect(res.status).toBe(404);
    });

    it('rechaza inscribir a un arquero archivado', async () => {
      const c = await adminListo();
      const seasonId = await crearTemporada(c);
      const ids = await crearArqueros(c, [['razo', 2]]);
      await c.post(`/api/admin/archers/${ids[0]}/archive`);

      const res = await c.post('/api/admin/tournaments', {
        seasonId,
        name: 'Torneo',
        date: '2026-08-08',
        targets: [{ index: 1, modality: 'sala', arrows: 3, description: null }],
        archerIds: ids,
      });

      expect(res.status).toBe(400);
      expect(await tournaments().countDocuments()).toBe(0);
    });

    it('rechaza blancos con índices no contiguos', async () => {
      const c = await adminListo();
      const seasonId = await crearTemporada(c);
      const ids = await crearArqueros(c, [['razo', 2]]);

      const res = await c.post('/api/admin/tournaments', {
        seasonId,
        name: 'Torneo',
        date: '2026-08-08',
        targets: [
          { index: 1, modality: 'sala', arrows: 3, description: null },
          { index: 3, modality: 'sala', arrows: 3, description: null },
        ],
        archerIds: ids,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('restricción de escuela (H3)', () => {
    it('con todos de escuela no arma patrullas y avisa', async () => {
      const c = await adminListo();
      const seasonId = await crearTemporada(c);
      const ids = await crearArqueros(c, [['escuela', 4]]);

      const res = await c.post('/api/admin/tournaments', {
        seasonId,
        name: 'Torneo',
        date: '2026-08-08',
        targets: recorridoDeReferencia(),
        archerIds: ids,
      });

      const body = (await res.json()) as {
        tournament: {
          patrolCount: number;
          requiresManualReview: boolean;
          warnings: { code: string }[];
          unassigned: unknown[];
        };
      };

      expect(body.tournament.patrolCount).toBe(0);
      expect(body.tournament.requiresManualReview).toBe(true);
      expect(body.tournament.warnings[0]?.code).toBe('ESCUELA_SIN_SENIOR');
      expect(body.tournament.unassigned).toHaveLength(4);
      // Nadie se pierde en silencio: los 4 vienen listados.
    });

    it('ninguna patrulla generada queda 100% escuela', async () => {
      const c = await adminListo();
      const seasonId = await crearTemporada(c);
      const ids = await crearArqueros(c, [
        ['escuela', 4],
        ['compuesto', 4],
      ]);

      await c.post('/api/admin/tournaments', {
        seasonId,
        name: 'Torneo',
        date: '2026-08-08',
        targets: recorridoDeReferencia(),
        archerIds: ids,
      });

      for (const patrulla of await patrols().find({}).toArray()) {
        const miembros = await participants().find({ patrolId: patrulla._id }).toArray();
        expect(miembros.every((m) => m.category === 'escuela')).toBe(false);
      }
    });
  });

  it('registra la creación en el audit log, sin datos sensibles', async () => {
    const c = await adminListo();
    const seasonId = await crearTemporada(c);
    const ids = await crearArqueros(c, [['razo', 4]]);

    await c.post('/api/admin/tournaments', {
      seasonId,
      name: 'Torneo',
      date: '2026-08-08',
      targets: recorridoDeReferencia(),
      archerIds: ids,
    });

    const entrada = await auditLog().findOne({ action: 'tournament.create' });
    expect(entrada).not.toBeNull();
    expect(entrada?.actorType).toBe('admin');

    const serializado = JSON.stringify(entrada);
    expect(serializado).not.toMatch(/pin/i);
    expect(serializado).not.toMatch(/argon2/);
  });
});
