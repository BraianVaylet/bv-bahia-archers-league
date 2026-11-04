import type { BowCategory } from '@bal/shared';
import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { auditLog, participants, patrols, scores, tournaments } from '../src/db/client.js';
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

function cliente(ip?: string) {
  const app = createApp();
  let sesion = '';

  const pedir = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers);
    headers.set('cookie', [`bal_csrf=${CSRF}`, sesion].filter(Boolean).join('; '));
    headers.set('x-csrf-token', CSRF);
    if (ip) headers.set('x-forwarded-for', ip);
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

async function lider(e: Escenario, ip?: string) {
  const c = cliente(ip);
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
   *
   * **Desde `REF6-1` es defensa en profundidad.** El camino normal —una op de
   * score sobre un firmado— ya no entra: `SIGNATURE_LOCKED` la corta antes (ver
   * «arquero firmado»). Este control queda para lo que NO pasa por `/sync`: una
   * corrección a mano en la base, un script de mantenimiento, un bug futuro. Por
   * eso el test altera el dato por fuera de `/sync`; si siguiera mandando la op,
   * dejaría de probar el cierre y probaría otra cosa.
   */
  it('cambiar un puntaje después de firmar frena el cierre', async () => {
    const e = await escenario();
    const c = await lider(e);

    await cargarYFirmar(c, e);

    // Se corrige un puntaje YA firmado, por fuera de /sync.
    await scores().updateOne(
      { participantId: new ObjectId(e.participantIds[0] as string), targetIndex: 1 },
      { $set: { arrows: ['11', '11'], total: 22 } },
    );

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

  /**
   * `REF6-7` / `C-7`. El cierre se registraba como `patrol.manual_edit` con
   * `meta: { closed: true }`: buscar quién cerró una patrulla obligaba a saber eso, y
   * se mezclaba con las redistribuciones del admin, que usan el mismo nombre.
   */
  it('el cierre queda registrado como patrol.close, con la patrulla y su IP', async () => {
    const e = await escenario();
    const c = await lider(e, '198.51.100.7');

    await cargarYFirmar(c, e);
    expect((await enviar(c, [opCierre()])).results[0]?.status).toBe('applied');

    const cierres = await auditLog().find({ action: 'patrol.close' }).toArray();
    expect(cierres).toHaveLength(1);
    expect(cierres[0]?.actorType).toBe('patrol');
    expect(cierres[0]?.actorId?.toHexString()).toBe(e.patrolId.toHexString());
    expect(cierres[0]?.entityId.toHexString()).toBe(e.patrolId.toHexString());
    expect(cierres[0]?.ip).toBe('198.51.100.7');

    // Y ya no se confunde con una edición manual del admin.
    expect(await auditLog().countDocuments({ action: 'patrol.manual_edit' })).toBe(0);
  });

  it('un cierre rechazado no deja entrada', async () => {
    const e = await escenario();
    const c = await lider(e);

    // Sin cargar nada: faltan puntajes.
    expect((await enviar(c, [opCierre()])).results[0]?.status).toBe('rejected');

    expect(await auditLog().countDocuments({ action: 'patrol.close' })).toBe(0);
  });
});

// ── Después del cierre ───────────────────────────────────────────────────────

interface RespuestaDeSync {
  results: { status: string; error?: { code: string } }[];
}

async function enviar(c: ReturnType<typeof cliente>, ops: unknown[]): Promise<RespuestaDeSync> {
  return (await (await c.post('/api/wafl/sync', { ops })).json()) as RespuestaDeSync;
}

const opCierre = () => ({
  type: 'close' as const,
  opId: uuid(),
  clientUpdatedAt: new Date().toISOString(),
});

describe('después del cierre', () => {
  /**
   * `REF6-1` / `S-1`. La firma sólo significa algo si lo firmado es lo que se
   * guarda. El control del cierre (`SIGNATURE_MISMATCH`) corre **una vez**, en el
   * cierre; lo que llegue después no lo ve nadie.
   *
   * Se usan ocho arqueros para que haya dos patrullas: con una sola, cerrarla
   * completa el torneo, y el rechazo sería por «torneo no en curso» — un test
   * verde por un motivo que no es el que se quiere probar.
   */
  it('un puntaje que llega con la patrulla cerrada se rechaza y no toca los totales', async () => {
    const e = await escenario([['razo', 8]]);
    const c = await lider(e);

    await cargarYFirmar(c, e);
    expect((await enviar(c, [opCierre()])).results[0]?.status).toBe('applied');

    // La premisa del test: la patrulla cerró, el torneo sigue en curso.
    expect((await patrols().findOne({ _id: e.patrolId }))?.status).toBe('cerrada');

    const id = e.participantIds[0] as string;
    const antes = await participants().findOne({ _id: new ObjectId(id) });
    const puntajesAntes = await scores()
      .find({ participantId: new ObjectId(id) })
      .toArray();

    const res = await enviar(c, [opScore(id, 1, ['11', '11'])]);

    expect(res.results[0]?.status).toBe('rejected');
    expect(res.results[0]?.error?.code).toBe('PATROL_CLOSED');

    const despues = await participants().findOne({ _id: new ObjectId(id) });
    expect(despues?.total).toBe(antes?.total);
    expect(
      await scores()
        .find({ participantId: new ObjectId(id) })
        .toArray(),
    ).toEqual(puntajesAntes);
  });

  it('una firma que llega con la patrulla cerrada se rechaza y deja la firma original', async () => {
    const e = await escenario([['razo', 8]]);
    const c = await lider(e);

    await cargarYFirmar(c, e);
    await enviar(c, [opCierre()]);

    const id = new ObjectId(e.participantIds[0] as string);
    const original = (await participants().findOne({ _id: id }))?.signature;

    // Un PNG distinto: si la op se aplicara, la firma guardada cambiaría.
    const otroPng = `data:image/png;base64,${Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02,
    ]).toString('base64')}`;

    const res = await enviar(c, [
      {
        type: 'signature' as const,
        opId: uuid(),
        clientUpdatedAt: new Date().toISOString(),
        participantId: e.participantIds[0],
        pngDataUrl: otroPng,
      },
    ]);

    expect(res.results[0]?.status).toBe('rejected');
    expect(res.results[0]?.error?.code).toBe('PATROL_CLOSED');
    expect((await participants().findOne({ _id: id }))?.signature).toEqual(original);
  });

  it('un puntaje que viaja en el mismo lote que el cierre, y va después, se rechaza', async () => {
    const e = await escenario([['razo', 8]]);
    const c = await lider(e);

    await cargarYFirmar(c, e);

    const res = await enviar(c, [
      opCierre(),
      opScore(e.participantIds[0] as string, 1, ['11', '11']),
    ]);

    expect(res.results[0]?.status).toBe('applied');
    expect(res.results[1]?.status).toBe('rejected');
    expect(res.results[1]?.error?.code).toBe('PATROL_CLOSED');
  });
});

describe('publicar', () => {
  /**
   * `REF6-1` / `S-1`, defensa en profundidad. `SIGNATURE_MISMATCH` se evalúa una
   * sola vez, en el cierre; lo que pase después no lo mira nadie. Publicar es el
   * último momento antes de que el resultado sea oficial, y lo que se publica
   * tiene que ser lo que se firmó.
   */
  it('se niega a publicar si un puntaje cambió después de firmarse, y dice de quién', async () => {
    const e = await escenario();
    const c = await lider(e);

    await cargarYFirmar(c, e);
    expect((await enviar(c, [opCierre()])).results[0]?.status).toBe('applied');

    // La premisa: con una sola patrulla, el cierre completa el torneo.
    const idTorneo = new ObjectId(e.tournamentId);
    expect((await tournaments().findOne({ _id: idTorneo }))?.status).toBe('completado');

    const id = new ObjectId(e.participantIds[0] as string);
    await scores().updateOne(
      { participantId: id, targetIndex: 1 },
      { $set: { arrows: ['11', '11'], total: 22 } },
    );

    const admin = cliente();
    await admin.post('/api/auth/admin/login', {
      username: 'admin',
      password: 'un-password-nuevo-largo',
    });
    const res = await admin.post(`/api/admin/tournaments/${e.tournamentId}/publish`);

    expect(res.status).toBe(409);
    const cuerpo = (await res.json()) as { error: { code: string; message: string } };
    expect(cuerpo.error.code).toBe('SIGNATURE_MISMATCH');

    const alterado = await participants().findOne({ _id: id });
    expect(cuerpo.error.message).toContain(alterado?.lastName);

    // No quedó publicado.
    expect((await tournaments().findOne({ _id: idTorneo }))?.status).toBe('completado');
  });
});

describe('arquero firmado', () => {
  const opFirma = (participantId: string) => ({
    type: 'signature' as const,
    opId: uuid(),
    clientUpdatedAt: new Date().toISOString(),
    participantId,
    pngDataUrl: PNG,
  });

  /**
   * `REF6-1` / `S-1`. La UI de WAFL ya no deja tocar a un firmado; el servidor
   * es la autoridad (regla 1) y tiene que decir lo mismo. Una app modificada, o
   * un celular con una op vieja en el outbox, no pasan por esa UI.
   */
  it('rechaza un puntaje sobre un arquero que ya firmó, y deja pasar al que no', async () => {
    const e = await escenario();
    const c = await lider(e);
    const [firmado, libre] = e.participantIds as [string, string];

    await enviar(c, [opScore(firmado, 1, ['11', '8']), opScore(libre, 1, ['11', '8'])]);
    await enviar(c, [opFirma(firmado)]);

    const antes = await participants().findOne({ _id: new ObjectId(firmado) });

    const res = await enviar(c, [
      opScore(firmado, 1, ['11', '11']),
      opScore(libre, 1, ['11', '11']),
    ]);

    expect(res.results[0]?.status).toBe('rejected');
    expect(res.results[0]?.error?.code).toBe('SIGNATURE_LOCKED');
    expect((await participants().findOne({ _id: new ObjectId(firmado) }))?.total).toBe(
      antes?.total,
    );

    // La contracara: el control no puede frenar a quien todavía no firmó.
    expect(res.results[1]?.status).toBe('applied');
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
