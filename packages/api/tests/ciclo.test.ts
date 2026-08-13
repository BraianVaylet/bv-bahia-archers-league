import type { BowCategory } from '@bal/shared';
import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { auditLog, participants, patrols, standings, tournaments } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import { resetEnvCache } from '../src/env.js';
import { decryptPin } from '../src/lib/crypto.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import * as publishService from '../src/services/publishService.js';
import { clearDb, startDb, stopDb, testEnv, testEnvRaw } from './helpers.js';

/**
 * Ciclo completo del torneo (BE-6, BE-7, BE-11, BE-12, BE-13).
 *
 * Crear → iniciar → anotar → firmar → cerrar → publicar → ver en la landing.
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

afterAll(async () => stopDb());
afterEach(() => resetRateLimits());

beforeEach(async () => {
  await clearDb(db);
  await seed(db, testEnv());
});

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
    patch: (p: string, b: unknown) => pedir(p, { method: 'PATCH', body: JSON.stringify(b) }),
    del: (p: string) => pedir(p, { method: 'DELETE' }),
  };
}

async function admin() {
  const c = cliente();
  await c.post('/api/auth/admin/login', { username: 'admin', password: PASSWORD });
  await c.post('/api/auth/admin/password', {
    currentPassword: PASSWORD,
    newPassword: 'un-password-nuevo-largo',
  });
  return c;
}

const TARGETS = [
  { index: 1, modality: '3d', arrows: 2, description: null },
  { index: 2, modality: 'sala', arrows: 3, description: null },
];

/** Torneo creado con 2 razo, listo para iniciar. */
async function torneoNuevo(
  c: ReturnType<typeof cliente>,
  cats: [BowCategory, number][] = [['razo', 2]],
) {
  const s = await c.post('/api/admin/seasons', {
    name: 'Liga 2026',
    startsAt: '2026-01-01',
    endsAt: '2026-12-31',
  });
  const seasonId = ((await s.json()) as { season: { id: string } }).season.id;

  const archerIds: string[] = [];
  let n = 0;
  for (const [category, cantidad] of cats) {
    for (let i = 0; i < cantidad; i++) {
      n++;
      const r = await c.post('/api/admin/archers', {
        firstName: `Nombre${n}`,
        lastName: `Apellido${String(n).padStart(3, '0')}`,
        category,
      });
      archerIds.push(((await r.json()) as { archer: { id: string } }).archer.id);
    }
  }

  const t = await c.post('/api/admin/tournaments', {
    seasonId,
    name: 'Torneo',
    date: '2026-08-08',
    targets: TARGETS,
    archerIds,
  });
  return {
    seasonId,
    archerIds,
    tournamentId: ((await t.json()) as { tournament: { id: string } }).tournament.id,
  };
}

/** Otro torneo en la MISMA temporada, con los mismos arqueros. */
async function otroTorneoEn(
  c: ReturnType<typeof cliente>,
  seasonId: string,
  archerIds: string[],
  extra: Record<string, unknown> = {},
) {
  const t = await c.post('/api/admin/tournaments', {
    seasonId,
    name: 'Segunda fecha',
    date: '2026-09-08',
    targets: TARGETS,
    archerIds,
    ...extra,
  });
  return ((await t.json()) as { tournament: { id: string } }).tournament.id;
}

/** Recorre el torneo completo con la patrulla y lo deja cerrado. */
async function completarTorneo(tournamentId: string) {
  const todas = await patrols()
    .find({ tournamentId: new ObjectId(tournamentId) })
    .toArray();

  for (const p of todas) {
    const c = cliente();
    await c.post('/api/auth/patrol/login', {
      tournamentId,
      username: p.username,
      pin: decryptPin(p.pinEnc, testEnv().PIN_ENC_KEY),
    });

    const miembros = await participants().find({ patrolId: p._id }).toArray();

    // Puntajes distintos por arquero: si todos tiran igual empatan, y el
    // puesto compartido reparte los mismos puntos a todos. Ver DOMAIN_WA §9.1.
    const ops = miembros.flatMap((m, i) => [
      {
        type: 'score' as const,
        opId: uuid(),
        clientUpdatedAt: new Date().toISOString(),
        participantId: m._id.toHexString(),
        targetIndex: 1,
        arrows: i === 0 ? ['11', '11'] : ['10', '8'],
      },
      {
        type: 'score' as const,
        opId: uuid(),
        clientUpdatedAt: new Date().toISOString(),
        participantId: m._id.toHexString(),
        targetIndex: 2,
        arrows: i === 0 ? ['X', '10', '9'] : ['8', '7', '6'],
      },
    ]);
    await c.post('/api/wafl/sync', { ops });

    await c.post('/api/wafl/sync', {
      ops: miembros.map((m) => ({
        type: 'signature' as const,
        opId: uuid(),
        clientUpdatedAt: new Date().toISOString(),
        participantId: m._id.toHexString(),
        pngDataUrl: PNG,
      })),
    });

    await c.post('/api/wafl/sync', {
      ops: [{ type: 'close' as const, opId: uuid(), clientUpdatedAt: new Date().toISOString() }],
    });
  }
}

// ── BE-6 · Edición y bloqueo de blancos ──────────────────────────────────────

describe('edición del torneo', () => {
  it('permite editar libremente mientras está sin iniciar', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);

    const res = await c.patch(`/api/admin/tournaments/${tournamentId}`, {
      name: 'Nombre nuevo',
      targets: [{ index: 1, modality: 'campo', arrows: 3, description: null }],
    });

    expect(res.status).toBe(200);
    // 1 blanco de campo a 3 flechas × 6 = 18
    expect(
      ((await res.json()) as { tournament: { maxPossibleScore: number } }).tournament
        .maxPossibleScore,
    ).toBe(18);
  });

  it('BLOQUEA editar un blanco que ya tiene puntajes', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);

    // Cargar puntaje en el blanco 1.
    const p = await patrols().findOne({ tournamentId: new ObjectId(tournamentId) });
    const lider = cliente();
    await lider.post('/api/auth/patrol/login', {
      tournamentId,
      username: p?.username,
      pin: decryptPin(p?.pinEnc ?? '', testEnv().PIN_ENC_KEY),
    });
    const m = await participants().findOne({ patrolId: p?._id });
    await lider.post('/api/wafl/sync', {
      ops: [
        {
          type: 'score',
          opId: uuid(),
          clientUpdatedAt: new Date().toISOString(),
          participantId: m?._id.toHexString(),
          targetIndex: 1,
          arrows: ['11', '8'],
        },
      ],
    });

    const res = await c.patch(`/api/admin/tournaments/${tournamentId}`, {
      targets: [
        { index: 1, modality: 'sala', arrows: 3, description: null },
        { index: 2, modality: 'sala', arrows: 3, description: null },
      ],
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as {
      error: { code: string; details?: { targetIndex: number } };
    };
    expect(body.error.code).toBe('TARGET_LOCKED');
    expect(body.error.details?.targetIndex).toBe(1);
  });

  it('permite editar un blanco SIN puntajes con el torneo en proceso', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);

    // Nadie tiró todavía: los dos blancos son editables.
    const res = await c.patch(`/api/admin/tournaments/${tournamentId}`, {
      targets: [
        { index: 1, modality: '3d', arrows: 2, description: null },
        { index: 2, modality: 'campo', arrows: 3, description: null },
      ],
    });
    expect(res.status).toBe(200);
  });

  it('expone qué blancos están bloqueados', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    const res = await c.get(`/api/admin/tournaments/${tournamentId}/locked-targets`);
    expect(((await res.json()) as { lockedTargets: number[] }).lockedTargets).toEqual([]);
  });

  it('no deja eliminar un torneo ya iniciado', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);

    expect((await c.del(`/api/admin/tournaments/${tournamentId}`)).status).toBe(409);
  });
});

// ── BE-7 · Patrullas y credenciales ──────────────────────────────────────────

describe('patrullas y credenciales', () => {
  it('lista las patrullas con su PIN y su composición', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);

    const body = (await (await c.get(`/api/admin/tournaments/${tournamentId}/patrols`)).json()) as {
      patrols: { username: string; pin?: string; members: unknown[] }[];
      violations: unknown[];
    };

    expect(body.patrols[0]?.username).toBe('patrulla1');
    expect(body.patrols[0]?.pin).toMatch(/^\d{6}$/);
    expect(body.patrols[0]?.members).toHaveLength(2);
    expect(body.violations).toEqual([]);
  });

  it('registra en el audit log cada vez que se muestran los PIN', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.get(`/api/admin/tournaments/${tournamentId}/patrols`);

    expect(await auditLog().countDocuments({ action: 'patrol.pin.reveal' })).toBe(1);
  });

  it('NO expone el PIN una vez publicado el torneo', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);
    await completarTorneo(tournamentId);
    await c.post(`/api/admin/tournaments/${tournamentId}/publish`);

    const body = (await (await c.get(`/api/admin/tournaments/${tournamentId}/patrols`)).json()) as {
      patrols: { pin?: string }[];
    };
    expect(body.patrols[0]?.pin).toBeUndefined();
  });

  it('regenerar el PIN invalida la sesión de esa patrulla', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);

    const p = await patrols().findOne({ tournamentId: new ObjectId(tournamentId) });
    const lider = cliente();
    await lider.post('/api/auth/patrol/login', {
      tournamentId,
      username: p?.username,
      pin: decryptPin(p?.pinEnc ?? '', testEnv().PIN_ENC_KEY),
    });
    expect((await lider.get('/api/wafl/bundle')).status).toBe(200);

    const res = await c.post(`/api/admin/patrols/${p?._id.toHexString()}/pin/regenerate`);
    const nuevo = (await res.json()) as { pin: string };
    expect(nuevo.pin).toMatch(/^\d{6}$/);

    // La sesión vieja dejó de servir.
    expect((await lider.get('/api/wafl/bundle')).status).toBe(401);
  });
});

// ── BE-11 · Desbloqueo de firma ──────────────────────────────────────────────

describe('desbloqueo de firma', () => {
  it('permite cerrar cuando un arquero se fue sin firmar', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);

    const p = await patrols().findOne({ tournamentId: new ObjectId(tournamentId) });
    const lider = cliente();
    await lider.post('/api/auth/patrol/login', {
      tournamentId,
      username: p?.username,
      pin: decryptPin(p?.pinEnc ?? '', testEnv().PIN_ENC_KEY),
    });

    const miembros = await participants().find({ patrolId: p?._id }).toArray();
    await lider.post('/api/wafl/sync', {
      ops: miembros.flatMap((m) => [
        {
          type: 'score' as const,
          opId: uuid(),
          clientUpdatedAt: new Date().toISOString(),
          participantId: m._id.toHexString(),
          targetIndex: 1,
          arrows: ['11', '11'],
        },
        {
          type: 'score' as const,
          opId: uuid(),
          clientUpdatedAt: new Date().toISOString(),
          participantId: m._id.toHexString(),
          targetIndex: 2,
          arrows: ['X', '10', '9'],
        },
      ]),
    });

    // Sólo firma el primero.
    await lider.post('/api/wafl/sync', {
      ops: [
        {
          type: 'signature' as const,
          opId: uuid(),
          clientUpdatedAt: new Date().toISOString(),
          participantId: miembros[0]?._id.toHexString(),
          pngDataUrl: PNG,
        },
      ],
    });

    const sinFirmar = miembros[1];
    const desbloqueo = await c.post(
      `/api/admin/participants/${sinFirmar?._id.toHexString()}/signature/unlock`,
      { reason: 'Se fue antes de firmar, avisó al organizador.' },
    );
    expect(desbloqueo.status).toBe(200);

    const cierre = (await (
      await lider.post('/api/wafl/sync', {
        ops: [{ type: 'close', opId: uuid(), clientUpdatedAt: new Date().toISOString() }],
      })
    ).json()) as { results: { status: string }[] };

    expect(cierre.results[0]?.status).toBe('applied');
  });

  it('deja rastro de la excepción: quién y por qué', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    const m = await participants().findOne({ tournamentId: new ObjectId(tournamentId) });

    await c.post(`/api/admin/participants/${m?._id.toHexString()}/signature/unlock`, {
      reason: 'Se fue antes de firmar.',
    });

    const doc = await participants().findOne({ _id: m?._id });
    expect(doc?.signature?.unlockedBy).not.toBeNull();
    expect(doc?.signature?.unlockReason).toBe('Se fue antes de firmar.');

    const entrada = await auditLog().findOne({ action: 'signature.unlock' });
    expect(entrada?.meta.reason).toBe('Se fue antes de firmar.');
  });

  it('exige un motivo', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    const m = await participants().findOne({ tournamentId: new ObjectId(tournamentId) });

    const res = await c.post(`/api/admin/participants/${m?._id.toHexString()}/signature/unlock`, {
      reason: '',
    });
    expect(res.status).toBe(400);
  });

  it('rechaza desbloquear a alguien que ya firmó', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    const m = await participants().findOne({ tournamentId: new ObjectId(tournamentId) });

    await c.post(`/api/admin/participants/${m?._id.toHexString()}/signature/unlock`, {
      reason: 'Primera vez, con motivo.',
    });
    const res = await c.post(`/api/admin/participants/${m?._id.toHexString()}/signature/unlock`, {
      reason: 'Segunda vez, con motivo.',
    });
    expect(res.status).toBe(409);
  });
});

// ── BE-12 · Publicar ─────────────────────────────────────────────────────────

describe('publicar', () => {
  it('rechaza publicar un torneo que no está completado', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);

    const res = await c.post(`/api/admin/tournaments/${tournamentId}/publish`);
    expect(res.status).toBe(409);
  });

  it('el torneo pasa a completado solo cuando cierran todas las patrullas', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);
    await completarTorneo(tournamentId);

    expect((await tournaments().findOne({ _id: new ObjectId(tournamentId) }))?.status).toBe(
      'completado',
    );
  });

  it('publica y materializa el ranking de la temporada', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);
    await completarTorneo(tournamentId);

    const res = await c.post(`/api/admin/tournaments/${tournamentId}/publish`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; standingsUpdated: number };
    expect(body.status).toBe('publicado');
    expect(body.standingsUpdated).toBe(2);

    const acumulado = await standings().find({}).toArray();
    // Los dos son razo: el primero se lleva 5, el segundo 4.
    expect(acumulado.map((s) => s.leaguePoints).sort((a, b) => b - a)).toEqual([5, 4]);
    expect(acumulado[0]?.tournamentsPlayed).toBe(1);
  });

  it('con empate reparte los mismos puntos a los dos', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);

    // Los dos tiran exactamente lo mismo.
    const p = await patrols().findOne({ tournamentId: new ObjectId(tournamentId) });
    const lider = cliente();
    await lider.post('/api/auth/patrol/login', {
      tournamentId,
      username: p?.username,
      pin: decryptPin(p?.pinEnc ?? '', testEnv().PIN_ENC_KEY),
    });
    const miembros = await participants().find({ patrolId: p?._id }).toArray();

    await lider.post('/api/wafl/sync', {
      ops: miembros.flatMap((m) => [
        {
          type: 'score' as const,
          opId: uuid(),
          clientUpdatedAt: new Date().toISOString(),
          participantId: m._id.toHexString(),
          targetIndex: 1,
          arrows: ['11', '11'],
        },
        {
          type: 'score' as const,
          opId: uuid(),
          clientUpdatedAt: new Date().toISOString(),
          participantId: m._id.toHexString(),
          targetIndex: 2,
          arrows: ['X', '10', '9'],
        },
      ]),
    });
    await lider.post('/api/wafl/sync', {
      ops: miembros.map((m) => ({
        type: 'signature' as const,
        opId: uuid(),
        clientUpdatedAt: new Date().toISOString(),
        participantId: m._id.toHexString(),
        pngDataUrl: PNG,
      })),
    });
    await lider.post('/api/wafl/sync', {
      ops: [{ type: 'close' as const, opId: uuid(), clientUpdatedAt: new Date().toISOString() }],
    });

    await c.post(`/api/admin/tournaments/${tournamentId}/publish`);

    // Puesto compartido: los dos primeros se llevan 5 cada uno.
    const acumulado = await standings().find({}).toArray();
    expect(acumulado.map((s) => s.leaguePoints)).toEqual([5, 5]);
    expect(acumulado.every((s) => s.podiums.first === 1)).toBe(true);
  });

  // Recalcular desde cero en vez de sumar el delta es lo que lo hace idempotente.
  it('publicar dos veces NO duplica los puntos', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);
    await completarTorneo(tournamentId);

    await c.post(`/api/admin/tournaments/${tournamentId}/publish`);
    const segunda = await c.post(`/api/admin/tournaments/${tournamentId}/publish`);

    expect(segunda.status).toBe(409);
    const acumulado = await standings().find({}).toArray();
    expect(acumulado.map((s) => s.leaguePoints).sort((a, b) => b - a)).toEqual([5, 4]);
  });

  it('despublicar revierte el impacto en la liga', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);
    await completarTorneo(tournamentId);
    await c.post(`/api/admin/tournaments/${tournamentId}/publish`);

    expect(await standings().countDocuments()).toBe(2);

    const res = await c.post(`/api/admin/tournaments/${tournamentId}/unpublish`, {
      reason: 'Se cargó mal un puntaje.',
    });
    expect(res.status).toBe(200);

    expect(await standings().countDocuments()).toBe(0);
    expect((await tournaments().findOne({ _id: new ObjectId(tournamentId) }))?.status).toBe(
      'completado',
    );
  });

  it('despublicar exige motivo y queda en el audit log', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);
    await completarTorneo(tournamentId);
    await c.post(`/api/admin/tournaments/${tournamentId}/publish`);

    expect(
      (await c.post(`/api/admin/tournaments/${tournamentId}/unpublish`, { reason: '' })).status,
    ).toBe(400);

    await c.post(`/api/admin/tournaments/${tournamentId}/unpublish`, {
      reason: 'Se cargó mal un puntaje.',
    });
    expect((await auditLog().findOne({ action: 'tournament.unpublish' }))?.meta.reason).toBe(
      'Se cargó mal un puntaje.',
    );
  });
});

// ── BE-13 · Endpoints públicos ───────────────────────────────────────────────

describe('endpoints públicos', () => {
  it('no exigen sesión', async () => {
    expect((await cliente().get('/api/public/tournaments')).status).toBe(200);
  });

  it('un torneo en proceso muestra patrullas pero NINGÚN puntaje', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);

    const body = (await (
      await cliente().get(`/api/public/tournaments/${tournamentId}`)
    ).json()) as { tournament: { patrols: unknown[]; results?: unknown } };

    expect(body.tournament.patrols).toHaveLength(1);
    expect(body.tournament.results).toBeUndefined();
  });

  /**
   * El usuario de cada patrulla, para la botonera de WAFL (REF-6).
   *
   * **No expone nada nuevo.** El `username` es `patrulla${number}` y el
   * `number` ya venía en esta misma respuesta: se agrega para que el cliente no
   * tenga que repetir la regla de nombrado, no porque antes fuera secreto. El
   * PIN sigue siendo el único factor, y el rate limit lo protege.
   */
  it('expone el usuario de cada patrulla, que ya se derivaba del número', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c, [['razo', 4]]);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);

    const body = (await (
      await cliente().get(`/api/public/tournaments/${tournamentId}`)
    ).json()) as { tournament: { patrols: { number: number; username: string }[] } };

    for (const p of body.tournament.patrols) {
      expect(p.username).toBe(`patrulla${p.number}`);
    }
  });

  // El PIN es el único factor. Que se filtre hace inútil todo lo demás.
  it('NUNCA expone el PIN de una patrulla', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);

    const crudo = await (await cliente().get(`/api/public/tournaments/${tournamentId}`)).text();

    expect(crudo).not.toMatch(/"pin"/i);
    expect(crudo).not.toMatch(/pinHash|pinEnc/);
  });

  it('un torneo sin iniciar no es visible desde afuera', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);

    expect((await cliente().get(`/api/public/tournaments/${tournamentId}`)).status).toBe(404);
  });

  // El admin sí tiene que poder mirar los puntajes de un torneo completado: es
  // lo que está por aplicar a la liga.
  it('el admin ve los resultados con sus rollups y el número de patrulla', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);

    const body = (await (await c.get(`/api/admin/tournaments/${tournamentId}/results`)).json()) as {
      maxPossibleScore: number;
      participants: {
        lastName: string;
        patrolNumber: number;
        total: number;
        signed: boolean;
        signatureUnlocked: boolean;
      }[];
    };

    expect(body.maxPossibleScore).toBeGreaterThan(0);
    expect(body.participants.length).toBeGreaterThan(0);
    expect(body.participants[0]?.patrolNumber).toBe(1);
    expect(body.participants[0]?.signed).toBe(false);
    expect(body.participants[0]?.signatureUnlocked).toBe(false);
  });

  it('una firma desbloqueada se marca como tal: el podio se mira distinto', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);

    const antes = (await (
      await c.get(`/api/admin/tournaments/${tournamentId}/results`)
    ).json()) as { participants: { id: string }[] };
    const participantId = antes.participants[0]?.id as string;

    await c.post(`/api/admin/participants/${participantId}/signature/unlock`, {
      reason: 'Se fue antes de firmar.',
    });

    const despues = (await (
      await c.get(`/api/admin/tournaments/${tournamentId}/results`)
    ).json()) as { participants: { id: string; signed: boolean; signatureUnlocked: boolean }[] };

    const quien = despues.participants.find((p) => p.id === participantId);
    expect(quien?.signed).toBe(true);
    expect(quien?.signatureUnlocked).toBe(true);
  });

  it('sin sesión de admin no se ven los resultados', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);

    expect((await cliente().get(`/api/admin/tournaments/${tournamentId}/results`)).status).toBe(
      401,
    );
  });

  it('un torneo completado pero SIN publicar tampoco expone resultados', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);
    await completarTorneo(tournamentId);

    expect((await cliente().get(`/api/public/tournaments/${tournamentId}`)).status).toBe(404);
  });

  it('un torneo publicado sí expone los resultados', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);
    await completarTorneo(tournamentId);
    await c.post(`/api/admin/tournaments/${tournamentId}/publish`);

    const body = (await (
      await cliente().get(`/api/public/tournaments/${tournamentId}`)
    ).json()) as { tournament: { results: { total: number }[] } };

    expect(body.tournament.results).toHaveLength(2);
    // Primero: 3D 11+11 = 22 · sala X+10+9 = 29 → 51
    // Segundo: 3D 10+8 = 18 · sala 8+7+6 = 21 → 39
    expect(body.tournament.results.map((r) => r.total).sort((a, b) => b - a)).toEqual([51, 39]);
  });

  it('el ranking separa a los que todavía no clasifican', async () => {
    const c = await admin();
    const { seasonId, tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);
    await completarTorneo(tournamentId);
    await c.post(`/api/admin/tournaments/${tournamentId}/publish`);

    const body = (await (
      await cliente().get(`/api/public/rankings?seasonId=${seasonId}`)
    ).json()) as {
      categories: { category: string; ranked: unknown[]; notYetEligible: unknown[] }[];
    };

    // Con un solo torneo nadie clasifica todavía: hacen falta 2.
    expect(body.categories[0]?.ranked).toHaveLength(0);
    expect(body.categories[0]?.notYetEligible).toHaveLength(2);
  });

  it('las respuestas públicas llevan cabeceras de caché', async () => {
    const res = await cliente().get('/api/public/tournaments');
    expect(res.headers.get('cache-control')).toContain('max-age');
    expect(res.headers.get('etag')).toBeTruthy();
  });
});

// ── REF-2 · Ranking «mejor de 2» ─────────────────────────────────────────────

/**
 * El ranking de la liga promedia los DOS mejores porcentajes de la temporada.
 *
 * Reemplaza al modo «por mejor puntaje»: un porcentaje suelto premia el día
 * bueno; el promedio de los dos mejores premia la regularidad.
 */
describe('ranking mejor de 2', () => {
  /** Deja dos torneos publicados en la misma temporada. */
  async function dosTorneosPublicados(c: ReturnType<typeof cliente>) {
    const { seasonId, archerIds, tournamentId } = await torneoNuevo(c);

    for (const id of [tournamentId, await otroTorneoEn(c, seasonId, archerIds)]) {
      await c.post(`/api/admin/tournaments/${id}/start`);
      await completarTorneo(id);
      await c.post(`/api/admin/tournaments/${id}/publish`);
    }

    return seasonId;
  }

  it('rechaza el modo `score`, que ya no existe', async () => {
    const c = await admin();
    const { seasonId } = await torneoNuevo(c);

    const res = await cliente().get(`/api/public/rankings?seasonId=${seasonId}&mode=score`);
    expect(res.status).toBe(400);
  });

  it('acepta el modo `best_two`', async () => {
    const c = await admin();
    const { seasonId } = await torneoNuevo(c);

    const res = await cliente().get(`/api/public/rankings?seasonId=${seasonId}&mode=best_two`);
    expect(res.status).toBe(200);
  });

  it('guarda los dos mejores porcentajes al publicar', async () => {
    const seasonId = await dosTorneosPublicados(await admin());

    const doc = await standings().findOne({ seasonId: new ObjectId(seasonId) });
    expect(doc?.topTwoPcts).toHaveLength(2);
    expect(doc?.tournamentsPlayed).toBe(2);
  });

  /**
   * Los acumulados escritos ANTES de «mejor de 2» no tienen `topTwoPcts`, y
   * ninguna publicación futura los toca si nadie vuelve a publicar esa
   * temporada. `db:reconcile` es lo que los alcanza.
   */
  it('`reconcile` recalcula los acumulados que quedaron con la forma vieja', async () => {
    const seasonId = await dosTorneosPublicados(await admin());

    // Se simula el documento viejo: sin el campo.
    await standings().updateMany({}, { $unset: { topTwoPcts: '' } });
    expect((await standings().findOne({}))?.topTwoPcts).toBeUndefined();

    const resultado = await publishService.reconcileStandings();

    expect(resultado.seasons).toBe(1);
    expect(resultado.standings).toBeGreaterThan(0);

    const doc = await standings().findOne({ seasonId: new ObjectId(seasonId) });
    expect(doc?.topTwoPcts).toHaveLength(2);
  });

  it('el ranking público expone el promedio de los dos mejores', async () => {
    const seasonId = await dosTorneosPublicados(await admin());

    const res = (await (
      await cliente().get(`/api/public/rankings?seasonId=${seasonId}&mode=best_two`)
    ).json()) as {
      categories: { ranked: { bestTwoAvgPct: number; topTwoPcts: number[] }[] }[];
    };

    const primero = res.categories[0]?.ranked[0];
    if (!primero) throw new Error('el ranking vino vacío');

    // Los dos torneos son idénticos, así que los dos porcentajes coinciden. Lo
    // que se verifica es que el valor sea el promedio de los dos que están
    // guardados, no un número suelto.
    const [a, b] = primero.topTwoPcts as [number, number];
    expect(primero.bestTwoAvgPct).toBe(Math.round(((a + b) / 2) * 100) / 100);
  });
});

// ── REF-2 · Pago de inscripción ──────────────────────────────────────────────

/**
 * Monto único por torneo. La recaudación se DERIVA de los pagos, y el monto lo
 * lee el servidor del torneo: nunca se acepta del cliente. Ver SECURITY.md §2.
 */
describe('pago de inscripción', () => {
  const conPago = { payment: { required: true, amount: 15_000 } };

  /** Torneo iniciado que cobra inscripción, con sus participantes. */
  async function torneoConPago(c: ReturnType<typeof cliente>) {
    const { seasonId, archerIds } = await torneoNuevo(c);
    const id = await otroTorneoEn(c, seasonId, archerIds, conPago);
    await c.post(`/api/admin/tournaments/${id}/start`);

    const miembros = await participants()
      .find({ tournamentId: new ObjectId(id) })
      .toArray();

    return { id, miembros, seasonId, archerIds };
  }

  it('un torneo nuevo es gratuito si no se declara el pago', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);

    const res = (await (await c.get(`/api/admin/tournaments/${tournamentId}`)).json()) as {
      tournament: { payment: { required: boolean; amount: number } };
    };
    expect(res.tournament.payment).toEqual({ required: false, amount: 0 });
  });

  it('guarda el monto declarado al crear el torneo', async () => {
    const c = await admin();
    const { id } = await torneoConPago(c);

    const res = (await (await c.get(`/api/admin/tournaments/${id}`)).json()) as {
      tournament: { payment: { amount: number } };
    };
    expect(res.tournament.payment.amount).toBe(15_000);
  });

  it('rechaza cobrar inscripción con monto cero', async () => {
    const c = await admin();
    const { seasonId, archerIds } = await torneoNuevo(c);

    const t = await c.post('/api/admin/tournaments', {
      seasonId,
      name: 'Sin monto',
      date: '2026-10-08',
      targets: TARGETS,
      archerIds,
      payment: { required: true, amount: 0 },
    });
    expect(t.status).toBe(400);
  });

  it('marca a un arquero como pagado y lo deja registrado', async () => {
    const c = await admin();
    const { miembros } = await torneoConPago(c);
    const uno = miembros[0]?._id;

    const res = await c.post(`/api/admin/participants/${uno?.toHexString()}/payment`, {
      paid: true,
    });

    expect(res.status).toBe(200);
    expect((await participants().findOne({ _id: uno }))?.paid).toBe(true);
  });

  it('se puede desmarcar: cobrar de más también se corrige', async () => {
    const c = await admin();
    const { miembros } = await torneoConPago(c);
    const ruta = `/api/admin/participants/${miembros[0]?._id.toHexString()}/payment`;

    await c.post(ruta, { paid: true });
    await c.post(ruta, { paid: false });

    expect((await participants().findOne({ _id: miembros[0]?._id }))?.paid).toBe(false);
  });

  // El monto es del torneo. Aceptarlo del cliente sería dejar que cada quien
  // decida cuánto pagó.
  it('RECHAZA un monto mandado por el cliente', async () => {
    const c = await admin();
    const { miembros } = await torneoConPago(c);

    const res = await c.post(`/api/admin/participants/${miembros[0]?._id.toHexString()}/payment`, {
      paid: true,
      amount: 1,
    });

    expect(res.status).toBe(400);
  });

  it('la recaudación es cantidad de pagos × monto', async () => {
    const c = await admin();
    const { id, miembros } = await torneoConPago(c);

    await c.post(`/api/admin/participants/${miembros[0]?._id.toHexString()}/payment`, {
      paid: true,
    });

    const res = (await (await c.get(`/api/admin/tournaments/${id}/payments`)).json()) as {
      payment: { required: boolean; amount: number };
      paidCount: number;
      collected: number;
      participants: { id: string; paid: boolean }[];
    };

    expect(res.paidCount).toBe(1);
    expect(res.collected).toBe(15_000);
    expect(res.participants).toHaveLength(miembros.length);
    expect(res.participants.filter((p) => p.paid)).toHaveLength(1);
  });

  it('un torneo gratuito recauda cero aunque se marquen pagos', async () => {
    const c = await admin();
    const { tournamentId } = await torneoNuevo(c);
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);

    const miembro = await participants().findOne({ tournamentId: new ObjectId(tournamentId) });
    await c.post(`/api/admin/participants/${miembro?._id.toHexString()}/payment`, { paid: true });

    const res = (await (await c.get(`/api/admin/tournaments/${tournamentId}/payments`)).json()) as {
      collected: number;
    };

    expect(res.collected).toBe(0);
  });

  it('los pagos NO son públicos', async () => {
    const c = await admin();
    const { id } = await torneoConPago(c);

    expect((await cliente().get(`/api/admin/tournaments/${id}/payments`)).status).toBe(401);
  });
});
