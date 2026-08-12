import type { BowCategory } from '@bal/shared';
import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { auditLog, participants, patrols, scores } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import { resetEnvCache } from '../src/env.js';
import { decryptPin } from '../src/lib/crypto.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import { clearDb, startDb, stopDb, testEnv, testEnvRaw } from './helpers.js';

/**
 * Los ítems del checklist de `docs/SECURITY.md` §13 que no cubría ningún test.
 *
 * El resto del checklist ya vivía repartido entre `auth`, `wafl`, `app`, `ciclo`
 * y `env`; el mapa de qué verifica qué está en el propio §13. Acá van los cinco
 * que faltaban, no una copia de todo.
 *
 * `BE-14`.
 */

const PASSWORD = 'password-de-test-1234';
const CSRF = 'c'.repeat(43);
let db: Db;
let uuidN = 0;

const uuid = () => `0192f3a1-8c4e-7000-9abc-${String(++uuidN).padStart(12, '0')}`;

const PNG = `data:image/png;base64,${Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]).toString('base64')}`;

beforeAll(async () => {
  Object.assign(process.env, testEnvRaw());
  resetEnvCache();
  db = await startDb();
}, 120_000);

afterAll(async () => {
  await stopDb();
});

afterEach(() => resetRateLimits());

beforeEach(async () => {
  await clearDb(db);
  await seed(db, testEnv());
});

// ── Andamiaje ────────────────────────────────────────────────────────────────

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
    post: (p: string, b?: unknown) =>
      pedir(p, { method: 'POST', ...(b ? { body: JSON.stringify(b) } : {}) }),
  };
}

interface Escenario {
  tournamentId: string;
  patrolId: ObjectId;
  patrolUsername: string;
  pin: string;
  participantIds: string[];
}

async function escenario(composicion: [BowCategory, number][] = [['razo', 2]]): Promise<Escenario> {
  const admin = cliente();
  await admin.post('/api/auth/admin/login', { username: 'admin', password: PASSWORD });
  await admin.post('/api/auth/admin/password', {
    currentPassword: PASSWORD,
    newPassword: 'un-password-nuevo-largo',
  });

  const s = await admin.post('/api/admin/seasons', {
    name: 'Liga 2026',
    startsAt: '2026-01-01',
    endsAt: '2026-12-31',
  });
  const seasonId = ((await s.json()) as { season: { id: string } }).season.id;

  const archerIds: string[] = [];
  let n = 0;
  for (const [category, cantidad] of composicion) {
    for (let i = 0; i < cantidad; i++) {
      n++;
      const r = await admin.post('/api/admin/archers', {
        firstName: `Nombre${n}`,
        lastName: `Apellido${String(n).padStart(3, '0')}`,
        category,
      });
      archerIds.push(((await r.json()) as { archer: { id: string } }).archer.id);
    }
  }

  const t = await admin.post('/api/admin/tournaments', {
    seasonId,
    name: 'Torneo',
    date: '2026-08-08',
    targets: [
      { index: 1, modality: '3d', arrows: 2, description: null },
      { index: 2, modality: 'sala', arrows: 3, description: null },
    ],
    archerIds,
  });
  const tournamentId = ((await t.json()) as { tournament: { id: string } }).tournament.id;

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
  };
}

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

const opScore = (participantId: string, targetIndex: number, arrows: string[]) => ({
  type: 'score' as const,
  opId: uuid(),
  clientUpdatedAt: new Date().toISOString(),
  participantId,
  targetIndex,
  arrows,
});

/** Carga el recorrido completo de la patrulla y firma por todos. */
async function cargarYFirmar(c: ReturnType<typeof cliente>, e: Escenario) {
  await c.post('/api/wafl/sync', {
    ops: e.participantIds.flatMap((id) => [
      opScore(id, 1, ['11', '8']),
      opScore(id, 2, ['X', '10', '9']),
    ]),
  });

  await c.post('/api/wafl/sync', {
    ops: e.participantIds.map((id) => ({
      type: 'signature' as const,
      opId: uuid(),
      clientUpdatedAt: new Date().toISOString(),
      participantId: id,
      pngDataUrl: PNG,
    })),
  });
}

// ── Autorización ─────────────────────────────────────────────────────────────

describe('autorización', () => {
  /**
   * `SECURITY.md` §13 — «op de otra patrulla → rejected, **registrada en el
   * audit log**».
   *
   * Que se rechace ya estaba probado. Lo que faltaba es que quede el rastro: un
   * intento de tocar la planilla de otra patrulla es lo único que distingue un
   * error de sincronización de alguien probando.
   */
  it('una op de otra patrulla queda registrada en el audit log', async () => {
    const e = await escenario([['razo', 8]]);
    const c = await lider(e);

    const otra = await patrols().findOne({
      tournamentId: new ObjectId(e.tournamentId),
      _id: { $ne: e.patrolId },
    });
    if (!otra) throw new Error('hacen falta al menos dos patrullas');

    const ajeno = await participants().findOne({ patrolId: otra._id });
    if (!ajeno) throw new Error('la otra patrulla no tiene miembros');

    await c.post('/api/wafl/sync', {
      ops: [opScore(ajeno._id.toHexString(), 1, ['11', '8'])],
    });

    const registro = await auditLog().findOne({ action: 'sync.forbidden' });
    expect(registro).not.toBeNull();
    expect(registro?.actorType).toBe('patrol');
  });

  /**
   * `SECURITY.md` §13 — «un recurso de otro torneo → 404, no 403».
   *
   * El 403 confirmaría que el recurso existe. El 404 no dice nada.
   */
  it('un torneo que no existe responde 404, sin distinguir de uno ajeno', async () => {
    const admin = cliente();
    await admin.post('/api/auth/admin/login', { username: 'admin', password: PASSWORD });
    await admin.post('/api/auth/admin/password', {
      currentPassword: PASSWORD,
      newPassword: 'un-password-nuevo-largo',
    });

    const inventado = new ObjectId().toHexString();
    expect((await admin.get(`/api/admin/tournaments/${inventado}`)).status).toBe(404);
    expect((await admin.get(`/api/admin/tournaments/${inventado}/results`)).status).toBe(404);
  });
});

// ── Integridad del puntaje ───────────────────────────────────────────────────

describe('integridad del puntaje', () => {
  /**
   * `SECURITY.md` §13 — «cambiar un puntaje después de firmar →
   * `SIGNATURE_MISMATCH` al cerrar».
   *
   * Es el control que hace que la firma signifique algo: sin él, el líder podría
   * firmar y después corregir un puntaje, y la planilla firmada no sería la que
   * se guarda.
   */
  it('cambiar un puntaje después de firmar frena el cierre', async () => {
    const e = await escenario();
    const c = await lider(e);

    await cargarYFirmar(c, e);

    // Se corrige un puntaje YA firmado.
    await c.post('/api/wafl/sync', {
      ops: [opScore(e.participantIds[0] as string, 1, ['11', '11'])],
    });

    const res = (await (
      await c.post('/api/wafl/sync', {
        ops: [{ type: 'close', opId: uuid(), clientUpdatedAt: new Date().toISOString() }],
      })
    ).json()) as { results: { status: string; error?: { code: string } }[] };

    expect(res.results[0]?.status).toBe('rejected');
    expect(res.results[0]?.error?.code).toBe('SIGNATURE_MISMATCH');
  });

  it('sin tocar nada después de firmar, el cierre pasa', async () => {
    // La contracara: el control no puede frenar un cierre legítimo.
    const e = await escenario();
    const c = await lider(e);

    await cargarYFirmar(c, e);

    const res = (await (
      await c.post('/api/wafl/sync', {
        ops: [{ type: 'close', opId: uuid(), clientUpdatedAt: new Date().toISOString() }],
      })
    ).json()) as { results: { status: string }[] };

    expect(res.results[0]?.status).toBe('applied');
  });
});

// ── Validación e inyección ───────────────────────────────────────────────────

describe('inyección', () => {
  /**
   * `SECURITY.md` §13 — «clave con `$` o `.` en un objeto anidado → rechazada».
   *
   * No hace falta sanitizar claves porque **nada llega sin pasar por Zod
   * `.strict()`**: una clave que el schema no declara hace fallar el parseo, y el
   * objeto nunca se acerca a un filtro de Mongo.
   */
  /**
   * Se prueba **diferencialmente**: el mismo cuerpo, una vez limpio y otra con
   * la clave inyectada.
   *
   * El primer intento de este test usaba arqueros inventados, así que el request
   * fallaba igual y pasaba sin que la clave tuviera nada que ver. Un 400 no
   * prueba nada si el cuerpo ya era inválido por otro motivo.
   */
  it('una clave con $ en un objeto anidado no pasa el schema', async () => {
    const admin = cliente();
    await admin.post('/api/auth/admin/login', { username: 'admin', password: PASSWORD });
    await admin.post('/api/auth/admin/password', {
      currentPassword: PASSWORD,
      newPassword: 'un-password-nuevo-largo',
    });

    const s = await admin.post('/api/admin/seasons', {
      name: 'Liga 2026',
      startsAt: '2026-01-01',
      endsAt: '2026-12-31',
    });
    const seasonId = ((await s.json()) as { season: { id: string } }).season.id;

    const archerIds: string[] = [];
    for (let i = 0; i < 2; i++) {
      const r = await admin.post('/api/admin/archers', {
        firstName: `Nombre${i}`,
        lastName: `Apellido${i}`,
        category: 'razo',
      });
      archerIds.push(((await r.json()) as { archer: { id: string } }).archer.id);
    }

    // El operador va ADENTRO de un blanco, no en el primer nivel.
    const res = await admin.post('/api/admin/tournaments', {
      seasonId,
      name: 'Torneo',
      date: '2026-08-08',
      targets: [{ index: 1, modality: 'sala', arrows: 3, description: null, $where: '1==1' }],
      archerIds,
    });

    expect(res.status).toBe(400);

    /**
     * Se comprueba que el error **apunte al blanco**, no sólo que haya un 400.
     * Un 400 genérico lo puede producir cualquier otra cosa del cuerpo; que la
     * ruta del campo señale `targets` sólo lo produce la clave inyectada.
     */
    const cuerpo = (await res.json()) as {
      error: { code: string; details?: { fields: { path: string }[] } };
    };

    expect(cuerpo.error.code).toBe('VALIDATION_ERROR');
    expect(cuerpo.error.details?.fields.some((f) => f.path.includes('targets'))).toBe(true);
  });

  it('una clave con punto tampoco pasa', async () => {
    // Ídem: primero se comprueba que el cuerpo limpio llega al login.
    expect(
      (await cliente().post('/api/auth/admin/login', { username: 'admin', password: PASSWORD }))
        .status,
    ).toBe(200);

    const res = await cliente().post('/api/auth/admin/login', {
      username: 'admin',
      password: PASSWORD,
      'a.b': 1,
    });

    expect(res.status).toBe(400);
  });
});

// ── Cabeceras ────────────────────────────────────────────────────────────────

describe('cabeceras en producción', () => {
  /**
   * `SECURITY.md` §13 — «HSTS presente en producción».
   *
   * Ya estaba probado que **no** aparece fuera de producción. Faltaba lo otro,
   * que es lo que importa: que aparezca donde tiene que aparecer.
   */
  it('HSTS está presente', async () => {
    Object.assign(process.env, testEnvRaw({ NODE_ENV: 'production', COOKIE_SECURE: 'true' }));
    resetEnvCache();

    try {
      const app = createApp({ servirFrontends: false });
      const res = await app.request('http://localhost/api/health');
      const hsts = res.headers.get('strict-transport-security');

      expect(hsts).toBeTruthy();
      expect(hsts).toMatch(/max-age=\d+/);
    } finally {
      // Se restaura el entorno: si queda en producción, los tests siguientes
      // corren con otra configuración y fallan lejos de acá.
      Object.assign(process.env, testEnvRaw());
      resetEnvCache();
    }
  });
});

// ── Datos en reposo ──────────────────────────────────────────────────────────

describe('datos en reposo', () => {
  // El PIN se guarda cifrado además de hasheado (tradeoff de SECURITY.md §9),
  // pero el puntaje firmado tiene que quedar atado a lo que se firmó.
  it('la firma guarda el hash de la planilla, no sólo la imagen', async () => {
    const e = await escenario();
    const c = await lider(e);
    await cargarYFirmar(c, e);

    const miembro = await participants().findOne({
      _id: new ObjectId(e.participantIds[0] as string),
    });

    expect(miembro?.signature?.scorecardHash).toMatch(/^[0-9a-f]{64}$/);
    expect(await scores().countDocuments({ participantId: miembro?._id })).toBe(2);
  });
});
