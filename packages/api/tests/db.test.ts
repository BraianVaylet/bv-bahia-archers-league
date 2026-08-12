import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getClient, ping, users } from '../src/db/client.js';
import { ensureIndexes, listIndexes } from '../src/db/indexes.js';
import { reconcile } from '../src/db/reconcile.js';
import { ResetForbiddenError, reset } from '../src/db/reset.js';
import { seed } from '../src/db/seed.js';
import {
  COLLECTIONS,
  type ParticipantDoc,
  type ScoreDoc,
  type TournamentDoc,
} from '../src/db/types.js';
import { verifySecret } from '../src/lib/crypto.js';
import { clearDb, startDb, stopDb, testEnv } from './helpers.js';

/**
 * Conexión, índices, seed, reset y reconcile (BE-1).
 *
 * Contra un MongoDB real en modo replica set: las transacciones lo exigen y sin
 * ellas no se puede probar lo que más importa. Ver docs/TESTING.md §4.
 */

let db: Db;

beforeAll(async () => {
  db = await startDb();
}, 120_000);

afterAll(async () => {
  await stopDb();
});

beforeEach(async () => {
  await clearDb(db);
});

describe('conexión', () => {
  it('responde al ping', async () => {
    expect(await ping()).toBe(true);
  });

  it('es un replica set, así que hay transacciones', async () => {
    // Sin esto, crear un torneo y publicar dejan de ser atómicos.
    const session = getClient().startSession();
    try {
      await session.withTransaction(async () => {
        await db.collection('probe').insertOne({ ok: true }, { session });
      });
      expect(await db.collection('probe').countDocuments()).toBe(1);
    } finally {
      await session.endSession();
      await db.collection('probe').drop();
    }
  });
});

describe('índices', () => {
  it('crea todos los índices de TECHNICAL.md §2', async () => {
    const indices = await listIndexes(db);

    expect(indices[COLLECTIONS.users]).toContain('uk_username');
    expect(indices[COLLECTIONS.sessions]).toEqual(
      expect.arrayContaining(['uk_tokenHash', 'ttl_expiresAt', 'ix_subject']),
    );
    expect(indices[COLLECTIONS.archers]).toEqual(
      expect.arrayContaining(['ix_activos_nombre', 'ix_searchKey', 'ix_category']),
    );
    expect(indices[COLLECTIONS.tournaments]).toEqual(
      expect.arrayContaining(['ix_status_date', 'ix_season_status']),
    );
    expect(indices[COLLECTIONS.patrols]).toEqual(
      expect.arrayContaining(['uk_torneo_numero', 'uk_torneo_usuario']),
    );
    expect(indices[COLLECTIONS.participants]).toEqual(
      expect.arrayContaining(['ix_torneo_patrulla', 'ix_podio_categoria', 'uk_torneo_archer']),
    );
    expect(indices[COLLECTIONS.scores]).toContain('uk_participante_blanco');
    expect(indices[COLLECTIONS.syncOps]).toContain('ttl_expiresAt');
    // `ix_ranking_puntaje` se dio de baja con «mejor de 2»: la landing trae la
    // temporada entera y la ordena en memoria, así que ninguna consulta lo
    // usaba, y el campo que indexaba ya no ordena ningún ranking.
    expect(indices[COLLECTIONS.standings]).toEqual(
      expect.arrayContaining(['ix_ranking_posicion', 'uk_temporada_archer']),
    );
    expect(indices[COLLECTIONS.standings]).not.toContain('ix_ranking_puntaje');
    expect(indices[COLLECTIONS.auditLog]).toEqual(expect.arrayContaining(['ix_at', 'ix_entidad']));
  });

  it('es idempotente: se puede correr en cada arranque', async () => {
    await expect(ensureIndexes(db)).resolves.toBeUndefined();
    await expect(ensureIndexes(db)).resolves.toBeUndefined();
  });

  it('el índice único de patrullas impide dos con el mismo número en un torneo', async () => {
    const tournamentId = new ObjectId();
    const base = {
      tournamentId,
      startTargetIndex: 1,
      pinHash: 'h',
      pinEnc: 'e',
      pinUpdatedAt: new Date(),
      status: 'pendiente' as const,
      failedAttempts: 0,
      lockedUntil: null,
      targetsCompleted: 0,
      closedAt: null,
      manualOverride: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const patrols = db.collection(COLLECTIONS.patrols);
    await patrols.insertOne({ ...base, number: 1, username: 'patrulla1' });

    await expect(patrols.insertOne({ ...base, number: 1, username: 'patrulla9' })).rejects.toThrow(
      /E11000/,
    );
  });

  it('el índice único de scores impide dos puntajes del mismo blanco y participante', async () => {
    const participantId = new ObjectId();
    const base = {
      tournamentId: new ObjectId(),
      patrolId: new ObjectId(),
      participantId,
      modality: '3d' as const,
      arrows: ['11', '8'],
      total: 19,
      innerCount: 1,
      xCount: 0,
      tenCount: 0,
      mCount: 0,
      clientUpdatedAt: new Date(),
      lastOpId: 'op-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const scores = db.collection(COLLECTIONS.scores);
    await scores.insertOne({ ...base, targetIndex: 7 });

    // Es lo que sostiene la idempotencia de la sincronización.
    await expect(scores.insertOne({ ...base, targetIndex: 7 })).rejects.toThrow(/E11000/);
  });
});

describe('seed', () => {
  it('crea el administrador con mustChangePassword', async () => {
    const resultado = await seed(db, testEnv());
    expect(resultado.adminCreated).toBe(true);

    const admin = await users().findOne({ username: 'admin' });
    expect(admin?.mustChangePassword).toBe(true);
    expect(admin?.failedAttempts).toBe(0);
  });

  it('guarda el password hasheado, nunca en claro', async () => {
    await seed(db, testEnv());
    const admin = await users().findOne({ username: 'admin' });

    expect(admin?.passwordHash).not.toBe('password-de-test-1234');
    expect(admin?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await verifySecret(admin?.passwordHash ?? '', 'password-de-test-1234')).toBe(true);
    expect(await verifySecret(admin?.passwordHash ?? '', 'otra-cosa')).toBe(false);
  });

  it('es idempotente y NO pisa un password ya cambiado', async () => {
    await seed(db, testEnv());
    await users().updateOne(
      { username: 'admin' },
      { $set: { passwordHash: 'ya-lo-cambio-el-usuario', mustChangePassword: false } },
    );

    const segunda = await seed(db, testEnv());

    expect(segunda.adminCreated).toBe(false);
    const admin = await users().findOne({ username: 'admin' });
    expect(admin?.passwordHash).toBe('ya-lo-cambio-el-usuario');
    expect(admin?.mustChangePassword).toBe(false);
  });

  it('respeta ADMIN_USERNAME y lo normaliza a minúscula', async () => {
    await seed(db, testEnv({ ADMIN_USERNAME: 'AdminDelClub' }));
    expect(await users().findOne({ username: 'admindelclub' })).not.toBeNull();
  });
});

describe('reset', () => {
  it('vacía todas las colecciones', async () => {
    await seed(db, testEnv());
    expect(await users().countDocuments()).toBe(1);

    await reset(db, testEnv());
    expect(await users().countDocuments()).toBe(0);
  });

  it('FALLA en producción, sin flag para forzarlo', async () => {
    const produccion = testEnv({
      NODE_ENV: 'production',
      SESSION_SECRET: 'b'.repeat(48),
      PIN_ENC_KEY: '2'.repeat(64),
      ADMIN_INITIAL_PASSWORD: 'un-password-largo-de-verdad',
    });

    await expect(reset(db, produccion)).rejects.toThrow(ResetForbiddenError);
  });
});

describe('reconcile', () => {
  async function armarParticipanteDesalineado() {
    const tournamentId = new ObjectId();
    const participantId = new ObjectId();
    const patrolId = new ObjectId();

    await db.collection<TournamentDoc>(COLLECTIONS.tournaments).insertOne({
      _id: tournamentId,
      maxPossibleScore: 100,
    } as TournamentDoc);

    await db.collection<ParticipantDoc>(COLLECTIONS.participants).insertOne({
      _id: participantId,
      tournamentId,
      patrolId,
      archerId: new ObjectId(),
      firstName: 'Juan',
      lastName: 'Pérez',
      category: 'razo',
      stake: 'azul',
      unit: 'A',
      position: 'izquierda',
      // Rollups desalineados a propósito.
      total: 999,
      innerCount: 99,
      xCount: 99,
      tenCount: 99,
      mCount: 99,
      targetsCompleted: 99,
      normalizedPct: 999,
      byModality: { sala: 0, aire_libre: 0, campo: 0, '3d': 0 },
      status: 'activo',
      signature: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ParticipantDoc);

    await db.collection<ScoreDoc>(COLLECTIONS.scores).insertMany([
      {
        tournamentId,
        patrolId,
        participantId,
        targetIndex: 1,
        modality: '3d',
        arrows: ['11', '8'],
        total: 19,
        innerCount: 1,
        xCount: 0,
        tenCount: 0,
        mCount: 0,
        clientUpdatedAt: new Date(),
        lastOpId: 'op-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        tournamentId,
        patrolId,
        participantId,
        targetIndex: 2,
        modality: 'sala',
        arrows: ['X', '10', 'M'],
        total: 20,
        innerCount: 1,
        xCount: 1,
        tenCount: 2,
        mCount: 1,
        clientUpdatedAt: new Date(),
        lastOpId: 'op-2',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as ScoreDoc[]);

    return { participantId, tournamentId };
  }

  it('recalcula los rollups desde los puntajes crudos', async () => {
    const { participantId } = await armarParticipanteDesalineado();

    const resultado = await reconcile(db);
    expect(resultado.participantsChecked).toBe(1);
    expect(resultado.participantsFixed).toBe(1);

    const p = await db
      .collection<ParticipantDoc>(COLLECTIONS.participants)
      .findOne({ _id: participantId });

    expect(p?.total).toBe(39);
    expect(p?.innerCount).toBe(2);
    expect(p?.xCount).toBe(1);
    expect(p?.tenCount).toBe(2);
    expect(p?.mCount).toBe(1);
    expect(p?.targetsCompleted).toBe(2);
    expect(p?.normalizedPct).toBe(39);
    expect(p?.byModality['3d']).toBe(19);
    expect(p?.byModality.sala).toBe(20);
  });

  it('informa qué corrigió, campo por campo', async () => {
    await armarParticipanteDesalineado();
    const resultado = await reconcile(db);

    const total = resultado.details.find((d) => d.campo === 'total');
    expect(total).toMatchObject({ antes: 999, despues: 39 });
  });

  it('no toca nada si los rollups ya están bien', async () => {
    await armarParticipanteDesalineado();
    await reconcile(db);

    const segunda = await reconcile(db);
    expect(segunda.participantsFixed).toBe(0);
    expect(segunda.details).toEqual([]);
  });
});
