import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, participants, users } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import type { AuditAction, AuditLogDoc } from '../src/db/types.js';
import { resetEnvCache } from '../src/env.js';
import { resetBloqueos } from '../src/lib/bloqueoDeIngreso.js';
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
 * El audit log de lo que hace el administrador (`REF6-7` / `S-9`).
 *
 * Se auditaban publicar, desbloquear firmas, PIN y sync. No se auditaban borrar un
 * torneo, iniciarlo, volverlo atrás, marcar un pago (es plata), el padrón, las
 * temporadas ni los ingresos del admin. Y el cierre de una patrulla figuraba como
 * `patrol.manual_edit`, el nombre de otra cosa (`C-7`).
 *
 * Cada test comprueba **quién** (el actor), **desde dónde** (la IP) y que el
 * `meta` no copie datos personales.
 */

const IP = '203.0.113.50';
const PASSWORD = 'password-de-test-1234';
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
  resetBloqueos();
});

beforeEach(async () => {
  await clearDb(db);
  await seed(db, testEnv());
});

// ── Ayudas ───────────────────────────────────────────────────────────────────

/** Las entradas de una acción, de la más vieja a la más nueva. */
const entradasDe = (action: AuditAction) =>
  auditLog().find({ action }).sort({ at: 1, _id: 1 }).toArray();

/** La única entrada de esa acción: dos serían tan raras como ninguna. */
async function unica(action: AuditAction): Promise<AuditLogDoc> {
  const encontradas = await entradasDe(action);
  expect(encontradas, `entradas de ${action}`).toHaveLength(1);
  const [una] = encontradas;
  if (!una) throw new Error(`sin entrada de ${action}`);
  return una;
}

async function idDelAdmin(): Promise<ObjectId> {
  const admin = await users().findOne({ username: 'admin' });
  if (!admin) throw new Error('no hay admin');
  return admin._id;
}

/** Lo que toda entrada de una acción del admin debe tener: quién y desde dónde. */
async function comprobarActor(entrada: AuditLogDoc) {
  expect(entrada.actorType).toBe('admin');
  expect(entrada.actorId?.toHexString()).toBe((await idDelAdmin()).toHexString());
  expect(entrada.ip).toBe(IP);
}

const idDe = async (res: Response, clave: string): Promise<string> =>
  ((await res.json()) as Record<string, { id: string }>)[clave]?.id ?? '';

/** Un torneo sin iniciar con cuatro arqueros, y lo necesario para tocarlo. */
async function torneoNuevo(admin: Cliente) {
  const seasonId = await crearTemporada(admin);
  const archerIds = await crearArqueros(admin, [['razo', 4]]);

  const res = await admin.post('/api/admin/tournaments', {
    seasonId,
    name: 'Torneo de prueba',
    date: '2026-08-08',
    targets: recorridoDeReferencia(),
    archerIds,
  });
  const tournamentId = await idDe(res, 'tournament');

  return { seasonId, archerIds, tournamentId };
}

// ── Ingreso ──────────────────────────────────────────────────────────────────

describe('ingreso del administrador', () => {
  it('un ingreso correcto queda registrado, con quién y desde dónde', async () => {
    const c = cliente(IP);
    const res = await c.post('/api/auth/admin/login', { username: 'admin', password: PASSWORD });
    expect(res.status).toBe(200);

    const entrada = await unica('admin.login');
    await comprobarActor(entrada);
    expect(entrada.entity).toBe('user');
    expect(entrada.entityId.toHexString()).toBe((await idDelAdmin()).toHexString());
  });

  /**
   * Un `401` por request llenaría el log con el ruido de cualquier bot: el
   * registro dejaría de servir para lo que está. Los intentos fallidos ya tienen
   * su propio freno (`REF6-6`).
   */
  it('un ingreso fallido no deja entrada', async () => {
    const c = cliente(IP);
    const res = await c.post('/api/auth/admin/login', {
      username: 'admin',
      password: 'incorrecta',
    });
    expect(res.status).toBe(401);

    expect(await entradasDe('admin.login')).toHaveLength(0);
  });
});

// ── Padrón ───────────────────────────────────────────────────────────────────

describe('padrón de arqueros', () => {
  it('crear, editar, archivar, restaurar y eliminar dejan su entrada', async () => {
    const admin = await adminListo(IP);

    const res = await admin.post('/api/admin/archers', {
      firstName: 'Ana',
      lastName: 'Lopez',
      category: 'razo',
      sex: 'femenino',
      dni: '30111222',
    });
    const archerId = await idDe(res, 'archer');

    await admin.patch(`/api/admin/archers/${archerId}`, {
      firstName: 'Ana María',
      lastName: 'Lopez',
      category: 'compuesto',
      sex: 'femenino',
      dni: '30111222',
    });
    // Cada endpoint deja la suya, no la de al lado: se mira después de cada uno.
    await admin.post(`/api/admin/archers/${archerId}/archive`);
    expect(await entradasDe('archer.archive')).toHaveLength(1);
    expect(await entradasDe('archer.restore')).toHaveLength(0);
    await admin.post(`/api/admin/archers/${archerId}/restore`);
    expect((await admin.del(`/api/admin/archers/${archerId}`)).status).toBe(200);

    for (const accion of [
      'archer.create',
      'archer.update',
      'archer.archive',
      'archer.restore',
      'archer.delete',
    ] as const) {
      const entrada = await unica(accion);
      await comprobarActor(entrada);
      expect(entrada.entity).toBe('archer');
      expect(entrada.entityId.toHexString()).toBe(archerId);
    }
  });

  /**
   * El log guarda **qué pasó**, no los datos de las personas: nombres y DNI viven en
   * el padrón, que tiene sus propios controles (`SECURITY.md` §11). Copiarlos al log
   * los dejaría vivos después de borrar al arquero.
   */
  it('el meta no copia nombre ni DNI', async () => {
    const admin = await adminListo(IP);
    await admin.post('/api/admin/archers', {
      firstName: 'Ana',
      lastName: 'Lopez',
      category: 'razo',
      sex: 'femenino',
      dni: '30111222',
    });

    const entrada = await unica('archer.create');
    const texto = JSON.stringify(entrada.meta);
    expect(texto).not.toContain('Ana');
    expect(texto).not.toContain('Lopez');
    expect(texto).not.toContain('30111222');
    expect(entrada.meta).toEqual({ category: 'razo' });
  });

  it('lo que falla no deja entrada: eliminar un arquero que no existe', async () => {
    const admin = await adminListo(IP);

    const res = await admin.del(`/api/admin/archers/${new ObjectId().toHexString()}`);
    expect(res.status).toBe(404);

    expect(await entradasDe('archer.delete')).toHaveLength(0);
  });

  it('lo que falla no deja entrada: eliminar un arquero que ya participó', async () => {
    const admin = await adminListo(IP);
    const { archerIds } = await torneoNuevo(admin);

    const res = await admin.del(`/api/admin/archers/${archerIds[0]}`);
    expect(res.status).toBe(409);

    expect(await entradasDe('archer.delete')).toHaveLength(0);
  });
});

// ── Temporadas ───────────────────────────────────────────────────────────────

describe('temporadas', () => {
  it('crear, editar, cerrar y reabrir dejan su entrada', async () => {
    const admin = await adminListo(IP);
    const seasonId = await crearTemporada(admin);

    await admin.patch(`/api/admin/seasons/${seasonId}`, {
      name: 'Liga 2026 (corregida)',
      startsAt: '2026-01-01',
      endsAt: '2026-12-31',
    });
    await admin.post(`/api/admin/seasons/${seasonId}/archive`);
    expect(await entradasDe('season.close')).toHaveLength(1);
    expect(await entradasDe('season.reopen')).toHaveLength(0);
    await admin.post(`/api/admin/seasons/${seasonId}/restore`);

    for (const accion of [
      'season.create',
      'season.update',
      'season.close',
      'season.reopen',
    ] as const) {
      const entrada = await unica(accion);
      await comprobarActor(entrada);
      expect(entrada.entity).toBe('season');
      expect(entrada.entityId.toHexString()).toBe(seasonId);
    }
  });

  it('lo que falla no deja entrada: cerrar una temporada que no existe', async () => {
    const admin = await adminListo(IP);

    const res = await admin.post(`/api/admin/seasons/${new ObjectId().toHexString()}/archive`);
    expect(res.status).toBe(404);

    expect(await entradasDe('season.close')).toHaveLength(0);
  });
});

// ── Torneo ───────────────────────────────────────────────────────────────────

describe('torneo', () => {
  it('iniciar y volver atrás dejan su entrada', async () => {
    const admin = await adminListo(IP);
    const { tournamentId } = await torneoNuevo(admin);

    expect((await admin.post(`/api/admin/tournaments/${tournamentId}/start`)).status).toBe(200);
    expect((await admin.post(`/api/admin/tournaments/${tournamentId}/unstart`)).status).toBe(200);

    for (const accion of ['tournament.start', 'tournament.unstart'] as const) {
      const entrada = await unica(accion);
      await comprobarActor(entrada);
      expect(entrada.entity).toBe('tournament');
      expect(entrada.entityId.toHexString()).toBe(tournamentId);
    }
  });

  it('borrar un torneo deja su entrada, con el nombre: el documento ya no existe', async () => {
    const admin = await adminListo(IP);
    const { tournamentId } = await torneoNuevo(admin);

    expect((await admin.del(`/api/admin/tournaments/${tournamentId}`)).status).toBe(200);

    const entrada = await unica('tournament.delete');
    await comprobarActor(entrada);
    expect(entrada.entityId.toHexString()).toBe(tournamentId);
    expect(entrada.meta).toMatchObject({ name: 'Torneo de prueba' });
  });

  it('lo que falla no deja entrada: iniciar dos veces, borrar uno que ya arrancó', async () => {
    const admin = await adminListo(IP);
    const { tournamentId } = await torneoNuevo(admin);
    await admin.post(`/api/admin/tournaments/${tournamentId}/start`);

    expect((await admin.post(`/api/admin/tournaments/${tournamentId}/start`)).status).toBe(409);
    expect((await admin.del(`/api/admin/tournaments/${tournamentId}`)).status).toBe(409);

    expect(await entradasDe('tournament.start')).toHaveLength(1);
    expect(await entradasDe('tournament.delete')).toHaveLength(0);
  });

  it('lo que falla no deja entrada: volver atrás un torneo que no arrancó', async () => {
    const admin = await adminListo(IP);
    const { tournamentId } = await torneoNuevo(admin);

    // Sin iniciar no hay a dónde volver: la transición no existe.
    const res = await admin.post(`/api/admin/tournaments/${tournamentId}/unstart`);
    expect(res.ok).toBe(false);

    expect(await entradasDe('tournament.unstart')).toHaveLength(0);
  });
});

// ── Pagos ────────────────────────────────────────────────────────────────────

describe('pagos', () => {
  it('marcar y desmarcar un pago dejan su entrada, con el estado resultante', async () => {
    const admin = await adminListo(IP);
    const { tournamentId } = await torneoNuevo(admin);
    const participante = await participants().findOne({ tournamentId: new ObjectId(tournamentId) });
    if (!participante) throw new Error('el torneo no tiene participantes');
    const id = participante._id.toHexString();

    await admin.post(`/api/admin/participants/${id}/payment`, { paid: true });
    await admin.post(`/api/admin/participants/${id}/payment`, { paid: false });

    const entradas = await entradasDe('payment.set');
    expect(entradas).toHaveLength(2);
    for (const entrada of entradas) {
      await comprobarActor(entrada);
      expect(entrada.entity).toBe('participant');
      expect(entrada.entityId.toHexString()).toBe(id);
    }
    // Es plata: queda **qué** se dejó marcado, y en qué torneo.
    expect(entradas.map((e) => e.meta)).toEqual([
      { paid: true, tournamentId },
      { paid: false, tournamentId },
    ]);
  });

  it('lo que falla no deja entrada: un participante que no existe', async () => {
    const admin = await adminListo(IP);

    const res = await admin.post(
      `/api/admin/participants/${new ObjectId().toHexString()}/payment`,
      {
        paid: true,
      },
    );
    expect(res.status).toBe(404);

    expect(await entradasDe('payment.set')).toHaveLength(0);
  });
});
