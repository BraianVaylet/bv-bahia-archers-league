import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { participants, patrols, scores, standings, tournaments } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import { resetEnvCache } from '../src/env.js';
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
 * Edición de un torneo armado y vuelta atrás (REF2-3).
 *
 * Las dos cosas tocan estado que ya existe —patrullas con sus PIN, un torneo
 * que arrancó— así que las guardas viven **en el servidor**, no en el botón que
 * las dispara. Ver `docs/FUNCTIONAL.md` §8.
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

// ── Andamiaje ────────────────────────────────────────────────────────────────

interface TorneoArmado {
  readonly c: Cliente;
  readonly seasonId: string;
  readonly tournamentId: string;
  readonly archerIds: string[];
}

/** Un torneo `sin_iniciar` con doce arqueros repartidos en varias categorías. */
async function torneoArmado(): Promise<TorneoArmado> {
  const c = await adminListo();
  const seasonId = await crearTemporada(c);
  const archerIds = await crearArqueros(c, [
    ['recurvo', 2],
    ['compuesto', 4],
    ['cazador', 2],
    ['razo', 2],
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
  return { c, seasonId, tournamentId: tournament.id, archerIds };
}

// ── Editar participantes ─────────────────────────────────────────────────────

describe('editar los participantes de un torneo sin iniciar', () => {
  it('agrega un arquero y lo deja participando', async () => {
    const { c, tournamentId, archerIds } = await torneoArmado();
    const [nuevo] = await crearArqueros(c, [['tradicional', 1]], 100);

    const res = await c.patch(`/api/admin/tournaments/${tournamentId}`, {
      archerIds: [...archerIds, nuevo],
    });

    expect(res.status).toBe(200);
    expect(await participants().countDocuments()).toBe(archerIds.length + 1);

    const doc = await tournaments().findOne({});
    expect(doc?.participantCount).toBe(archerIds.length + 1);
  });

  /**
   * **Sacar a un arquero lo saca también de su patrulla.**
   *
   * Un participante huérfano —sin patrulla, o en una patrulla que ya no lo
   * lista— es lo que después hace fallar el cierre del circuito con un error
   * que sale lejos de su causa.
   */
  it('quita un arquero del torneo y de su patrulla', async () => {
    const { c, tournamentId, archerIds } = await torneoArmado();
    const quitado = archerIds[0] as string;

    const res = await c.patch(`/api/admin/tournaments/${tournamentId}`, {
      archerIds: archerIds.slice(1),
    });

    expect(res.status).toBe(200);
    expect(await participants().countDocuments()).toBe(archerIds.length - 1);

    const suyo = await participants().findOne({ archerId: { $exists: true } });
    expect(suyo).not.toBeNull();

    // Y no quedó nombrado en ninguna patrulla.
    const todas = await patrols().find({}).toArray();
    const miembros = await participants().find({}).toArray();
    for (const p of miembros) {
      expect(todas.some((q) => q._id.equals(p.patrolId))).toBe(true);
    }
    expect(miembros.some((p) => p.archerId.toHexString() === quitado)).toBe(false);
  });

  it('rechaza inscribir a un arquero archivado', async () => {
    const { c, tournamentId, archerIds } = await torneoArmado();
    const [nuevo] = await crearArqueros(c, [['tradicional', 1]], 200);
    await c.post(`/api/admin/archers/${nuevo}/archive`);

    const res = await c.patch(`/api/admin/tournaments/${tournamentId}`, {
      archerIds: [...archerIds, nuevo],
    });

    expect(res.status).toBe(400);
  });

  it('rechaza un arquero que no existe', async () => {
    const { c, tournamentId, archerIds } = await torneoArmado();

    const res = await c.patch(`/api/admin/tournaments/${tournamentId}`, {
      archerIds: [...archerIds, '0'.repeat(24)],
    });

    expect(res.status).toBe(404);
  });

  /**
   * Con el torneo en marcha las patrullas ya están en el monte, con su PIN y su
   * planilla impresa. Rearmarlas desde el escritorio dejaría al líder mirando
   * una lista que no coincide con la gente que tiene al lado.
   */
  it('NO deja cambiar los participantes de un torneo en proceso', async () => {
    const { c, tournamentId, archerIds } = await torneoArmado();
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);

    const res = await c.patch(`/api/admin/tournaments/${tournamentId}`, {
      archerIds: archerIds.slice(1),
    });

    // 409, igual que TARGET_LOCKED: es un conflicto con el estado actual, no
    // un cuerpo mal formado.
    expect(res.status).toBe(409);
    expect(await participants().countDocuments()).toBe(archerIds.length);
  });
});

// ── Volver a sin_iniciar ─────────────────────────────────────────────────────

describe('volver un torneo en proceso a sin iniciar', () => {
  it('vuelve si no se cargó ni un puntaje', async () => {
    const { c, tournamentId } = await torneoArmado();
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);

    const res = await c.post(`/api/admin/tournaments/${tournamentId}/unstart`);

    expect(res.status).toBe(200);
    const doc = await tournaments().findOne({});
    expect(doc?.status).toBe('sin_iniciar');
    expect(doc?.startedAt).toBeNull();
  });

  /**
   * **Las patrullas y los PIN se conservan.**
   *
   * Si arrancaste por error, volvés, corregís y arrancás de nuevo: la planilla
   * impresa sigue sirviendo. Regenerar los PIN acá obligaría a reimprimir por
   * un error de un toque.
   */
  it('conserva las patrullas y sus credenciales', async () => {
    const { c, tournamentId } = await torneoArmado();
    const antes = await patrols().find({}).toArray();

    await c.post(`/api/admin/tournaments/${tournamentId}/start`);
    await c.post(`/api/admin/tournaments/${tournamentId}/unstart`);

    const despues = await patrols().find({}).toArray();
    expect(despues).toHaveLength(antes.length);

    for (const patrulla of antes) {
      const igual = despues.find((p) => p._id.equals(patrulla._id));
      expect(igual, `desapareció la patrulla ${patrulla.number}`).toBeDefined();
      expect(igual?.username).toBe(patrulla.username);
      expect(igual?.pinEnc).toEqual(patrulla.pinEnc);
    }
  });

  /**
   * **Con un solo puntaje cargado, no vuelve.**
   *
   * La guarda es del servidor, no del botón: el botón se puede pedir dos veces,
   * o desde una pantalla que todavía no se enteró de que alguien anotó.
   */
  it('NO vuelve si alguna patrulla ya cargó un puntaje', async () => {
    const { c, tournamentId } = await torneoArmado();
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);

    const miembro = await participants().findOne({});
    const torneo = await tournaments().findOne({});
    if (!miembro || !torneo) throw new Error('no se armó el torneo');

    await scores().insertOne({
      _id: new ObjectId(),
      tournamentId: torneo._id,
      patrolId: miembro.patrolId,
      participantId: miembro._id,
      targetIndex: 1,
      modality: '3d',
      arrows: ['11', '11'],
      total: 22,
      innerCount: 2,
      xCount: 0,
      tenCount: 0,
      mCount: 0,
      clientUpdatedAt: new Date(),
      appliedAt: new Date(),
      opId: 'op-de-prueba',
    });

    const res = await c.post(`/api/admin/tournaments/${tournamentId}/unstart`);

    expect(res.status).toBe(409);
    expect((await tournaments().findOne({}))?.status).toBe('en_proceso');
  });

  it('un torneo que nunca arrancó no puede volver atrás', async () => {
    const { c, tournamentId } = await torneoArmado();

    const res = await c.post(`/api/admin/tournaments/${tournamentId}/unstart`);
    expect(res.status).toBe(409);
  });

  it('exige sesión de admin', async () => {
    const { tournamentId } = await torneoArmado();
    const res = await cliente().post(`/api/admin/tournaments/${tournamentId}/unstart`);
    expect(res.status).toBe(401);
  });
});

// ── Recaudación de la temporada ──────────────────────────────────────────────

describe('recaudación de la temporada', () => {
  it('suma lo recaudado en todos sus torneos', async () => {
    const c = await adminListo();
    const seasonId = await crearTemporada(c);
    const archerIds = await crearArqueros(c, [
      ['recurvo', 2],
      ['compuesto', 2],
    ]);

    for (const nombre of ['1ª fecha', '2ª fecha']) {
      await c.post('/api/admin/tournaments', {
        seasonId,
        name: nombre,
        date: '2026-08-08',
        targets: recorridoDeReferencia(),
        archerIds,
        payment: { required: true, amount: 15000 },
      });
    }

    // Un pago en cada torneo: 2 × 15000.
    for (const miembro of await participants().find({}).limit(1).toArray()) {
      await c.post(`/api/admin/participants/${miembro._id.toHexString()}/payment`, { paid: true });
    }
    const otro = await participants()
      .find({ tournamentId: { $ne: (await participants().findOne({}))?.tournamentId } })
      .limit(1)
      .toArray();
    for (const miembro of otro) {
      await c.post(`/api/admin/participants/${miembro._id.toHexString()}/payment`, { paid: true });
    }

    const res = await c.get(`/api/admin/seasons/${seasonId}/collection`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      collected: number;
      tournaments: { id: string; name: string; collected: number; paidCount: number }[];
    };

    expect(body.tournaments).toHaveLength(2);
    expect(body.collected).toBe(30000);
    expect(body.collected).toBe(body.tournaments.reduce((n, t) => n + t.collected, 0));
  });

  it('una temporada sin torneos recauda cero', async () => {
    const c = await adminListo();
    const seasonId = await crearTemporada(c);

    const res = await c.get(`/api/admin/seasons/${seasonId}/collection`);
    const body = (await res.json()) as { collected: number; tournaments: unknown[] };

    expect(body.collected).toBe(0);
    expect(body.tournaments).toHaveLength(0);
  });

  it('exige sesión de admin', async () => {
    const c = await adminListo();
    const seasonId = await crearTemporada(c);
    expect((await cliente().get(`/api/admin/seasons/${seasonId}/collection`)).status).toBe(401);
  });
});

/**
 * Deja la ficha pública del arquero en pie.
 *
 * La ficha existe cuando hay acumulados, y los acumulados los crea `publish`,
 * que exige el circuito cerrado con todas las firmas. Ese camino completo está
 * cubierto en `ciclo.test.ts`; acá se finge el resultado porque lo que se
 * prueba es **de dónde sale la serie**, no cómo se publica.
 */
async function conAcumulados(seasonId: string, archerId: string) {
  await standings().insertOne({
    _id: new ObjectId(),
    seasonId: new ObjectId(seasonId),
    category: 'recurvo',
    archerId: new ObjectId(archerId),
    firstName: 'Nombre1',
    lastName: 'Apellido001',
    leaguePoints: 5,
    tournamentsPlayed: 2,
    podiums: { first: 1, second: 0, third: 0 },
    bestNormalizedPct: 80,
    bestRawScore: 150,
    bestTournamentId: null,
    topTwoPcts: [80, 60],
    totalX: 0,
    totalTens: 0,
    totalM: 0,
    updatedAt: new Date(),
  });
}

// ── Historial del arquero ────────────────────────────────────────────────────

describe('historial del arquero para el gráfico de evolución', () => {
  /**
   * **La serie no está guardada en ningún lado.**
   *
   * `StandingDoc` acumula los dos mejores porcentajes y el mejor suelto, no la
   * secuencia. Se deriva de `participants`, que tiene el `normalizedPct` de
   * cada participación y ya está indexado por arquero (`ix_archer`). Sin
   * migración y sin tocar lo publicado.
   */
  it('devuelve un punto por torneo publicado, en orden', async () => {
    const c = await adminListo();
    const seasonId = await crearTemporada(c);
    const archerIds = await crearArqueros(c, [
      ['recurvo', 2],
      ['compuesto', 2],
    ]);

    const torneos: string[] = [];
    for (const [i, nombre] of ['1ª fecha', '2ª fecha'].entries()) {
      const res = await c.post('/api/admin/tournaments', {
        seasonId,
        name: nombre,
        date: `2026-0${i + 3}-08`,
        targets: recorridoDeReferencia(),
        archerIds,
      });
      torneos.push(((await res.json()) as { tournament: { id: string } }).tournament.id);
    }

    // Se publican los dos, con un puntaje distinto en cada uno.
    for (const [i, id] of torneos.entries()) {
      await tournaments().updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'publicado', publishedAt: new Date() } },
      );
      await participants().updateMany(
        { tournamentId: new ObjectId(id) },
        { $set: { normalizedPct: 60 + i * 20, total: 100 + i * 50 } },
      );
    }

    const arquero = archerIds[0] as string;
    await conAcumulados(seasonId, arquero);

    const res = await c.get(`/api/public/archers/${arquero}`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      archer: { history?: { tournamentId: string; name: string; normalizedPct: number }[] };
    };

    expect(body.archer.history).toHaveLength(2);
    expect(body.archer.history?.map((h) => h.name)).toEqual(['1ª fecha', '2ª fecha']);
    expect(body.archer.history?.map((h) => h.normalizedPct)).toEqual([60, 80]);
  });

  /**
   * Un torneo sin publicar **no aparece**: es un endpoint público y los
   * resultados no son oficiales hasta que el admin los publica.
   */
  it('no incluye torneos sin publicar', async () => {
    const c = await adminListo();
    const seasonId = await crearTemporada(c);
    const archerIds = await crearArqueros(c, [
      ['recurvo', 2],
      ['compuesto', 2],
    ]);

    const res1 = await c.post('/api/admin/tournaments', {
      seasonId,
      name: 'publicado',
      date: '2026-03-08',
      targets: recorridoDeReferencia(),
      archerIds,
    });
    const publicado = ((await res1.json()) as { tournament: { id: string } }).tournament.id;

    await c.post('/api/admin/tournaments', {
      seasonId,
      name: 'en preparación',
      date: '2026-04-08',
      targets: recorridoDeReferencia(),
      archerIds,
    });

    await tournaments().updateOne(
      { _id: new ObjectId(publicado) },
      { $set: { status: 'publicado', publishedAt: new Date() } },
    );

    await conAcumulados(seasonId, archerIds[0] as string);

    const res = await c.get(`/api/public/archers/${archerIds[0]}`);
    const body = (await res.json()) as { archer: { history?: { name: string }[] } };

    expect(body.archer.history?.map((h) => h.name)).toEqual(['publicado']);
  });
});

// ── El agujero que destapó el /security-review ───────────────────────────────

describe('una sesión de patrulla no sobrevive a la vuelta atrás', () => {
  /**
   * **Lo encontró el `/security-review` de esta misma tanda, y lo había
   * introducido yo.**
   *
   * `syncService.sync` nunca miró el estado del torneo: la autorización de
   * `/wafl/sync` sale de la sesión de patrulla y nada más. Antes eso no era
   * alcanzable, porque un torneo sólo iba para adelante y `sin_iniciar` nunca
   * convivía con sesiones vivas. **La transición nueva crea esa combinación**:
   * el líder que entró antes del `unstart` seguía pudiendo anotar sobre un
   * torneo que dice no haber empezado.
   *
   * Se rechaza op por op y no con un error del batch: un 4xx dejaría al outbox
   * del cliente reintentando, y el contrato de `/sync` es responder 200 siempre
   * con el resultado individual de cada op. Ver `docs/OFFLINE_SYNC.md` §6.
   */
  it('no acepta puntajes de un torneo que volvió a sin iniciar', async () => {
    const { c, tournamentId } = await torneoArmado();
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);

    const patrulla = await patrols().findOne({});
    if (!patrulla) throw new Error('no se armó ninguna patrulla');
    const miembro = await participants().findOne({ patrolId: patrulla._id });
    if (!miembro) throw new Error('la patrulla no tiene miembros');

    // El líder entra con el torneo en curso, y todavía no anota nada.
    const { decryptPin } = await import('../src/lib/crypto.js');
    const l = cliente();
    const entro = await l.post('/api/auth/patrol/login', {
      tournamentId,
      username: patrulla.username,
      pin: decryptPin(patrulla.pinEnc, testEnv().PIN_ENC_KEY),
    });
    expect(entro.status).toBe(200);

    // El admin se da cuenta del error y vuelve atrás.
    expect((await c.post(`/api/admin/tournaments/${tournamentId}/unstart`)).status).toBe(200);

    // Y el líder, con la sesión todavía viva, intenta sincronizar.
    const res = await l.post('/api/wafl/sync', {
      ops: [
        {
          type: 'score',
          opId: '0'.repeat(8) + '-0000-7000-8000-' + '0'.repeat(12),
          clientUpdatedAt: new Date().toISOString(),
          participantId: miembro._id.toHexString(),
          targetIndex: 1,
          arrows: ['11', '11'],
        },
      ],
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: { status: string }[] };
    expect(body.results[0]?.status).toBe('rejected');

    // Y sobre todo: no se escribió nada.
    expect(await scores().countDocuments()).toBe(0);
  });

  /**
   * **Rearmar participantes borra también sus puntajes.**
   *
   * `deleteMany` sacaba patrullas y participantes y dejaba los `scores`
   * colgando: documentos que apuntan a participantes que ya no existen. Eso
   * después hace que `blancosBloqueados` marque blancos bloqueados de un torneo
   * cuyos arqueros fueron eliminados, y que `countScoresOfTournament` impida
   * volver atrás para siempre.
   *
   * Con la guarda de arriba este estado ya no se alcanza. Se borra igual: una
   * operación que deja huérfanos es incorrecta aunque hoy nadie pueda llegar.
   */
  it('rearmar los participantes no deja puntajes huérfanos', async () => {
    const { c, tournamentId, archerIds } = await torneoArmado();

    const miembro = await participants().findOne({});
    const torneo = await tournaments().findOne({});
    if (!miembro || !torneo) throw new Error('no se armó el torneo');

    await scores().insertOne({
      _id: new ObjectId(),
      tournamentId: torneo._id,
      patrolId: miembro.patrolId,
      participantId: miembro._id,
      targetIndex: 1,
      modality: '3d',
      arrows: ['11', '11'],
      total: 22,
      innerCount: 2,
      xCount: 0,
      tenCount: 0,
      mCount: 0,
      clientUpdatedAt: new Date(),
      appliedAt: new Date(),
      opId: 'op-huerfana',
    });

    await c.patch(`/api/admin/tournaments/${tournamentId}`, {
      archerIds: archerIds.slice(1),
    });

    expect(await scores().countDocuments({ tournamentId: torneo._id })).toBe(0);
  });
});
