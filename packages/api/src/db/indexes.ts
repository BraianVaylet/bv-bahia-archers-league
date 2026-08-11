/**
 * Índices de MongoDB.
 *
 * Espejo de `docs/TECHNICAL.md` §2. Se crean de forma **idempotente** al
 * arrancar: `createIndex` sobre un índice que ya existe con la misma definición
 * es un no-op.
 *
 * Regla: ninguna consulta de las rutas públicas puede hacer `COLLSCAN`.
 */

import type { Db } from 'mongodb';
import { COLLECTIONS } from './types.js';

/** Crea todos los índices. Idempotente: se puede correr en cada arranque. */
export async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db
      .collection(COLLECTIONS.users)
      .createIndexes([{ key: { username: 1 }, unique: true, name: 'uk_username' }]),

    db.collection(COLLECTIONS.sessions).createIndexes([
      { key: { tokenHash: 1 }, unique: true, name: 'uk_tokenHash' },
      // TTL: Mongo borra las sesiones vencidas sin trabajo de la aplicación.
      { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: 'ttl_expiresAt' },
      { key: { subjectType: 1, subjectId: 1 }, name: 'ix_subject' },
    ]),

    db
      .collection(COLLECTIONS.seasons)
      .createIndexes([{ key: { status: 1, startsAt: -1 }, name: 'ix_status_startsAt' }]),

    db.collection(COLLECTIONS.archers).createIndexes([
      { key: { archivedAt: 1, lastName: 1, firstName: 1 }, name: 'ix_activos_nombre' },
      { key: { searchKey: 1 }, name: 'ix_searchKey' },
      { key: { category: 1 }, name: 'ix_category' },
    ]),

    db.collection(COLLECTIONS.tournaments).createIndexes([
      { key: { status: 1, date: -1 }, name: 'ix_status_date' },
      { key: { seasonId: 1, status: 1 }, name: 'ix_season_status' },
      { key: { date: -1 }, name: 'ix_date' },
    ]),

    db.collection(COLLECTIONS.patrols).createIndexes([
      { key: { tournamentId: 1, number: 1 }, unique: true, name: 'uk_torneo_numero' },
      { key: { tournamentId: 1, username: 1 }, unique: true, name: 'uk_torneo_usuario' },
      { key: { tournamentId: 1, status: 1 }, name: 'ix_torneo_estado' },
    ]),

    db.collection(COLLECTIONS.participants).createIndexes([
      { key: { tournamentId: 1, patrolId: 1 }, name: 'ix_torneo_patrulla' },
      // Resuelve los podios por categoría con un solo recorrido de índice.
      { key: { tournamentId: 1, category: 1, total: -1 }, name: 'ix_podio_categoria' },
      { key: { archerId: 1 }, name: 'ix_archer' },
      { key: { tournamentId: 1, archerId: 1 }, unique: true, name: 'uk_torneo_archer' },
    ]),

    db.collection(COLLECTIONS.scores).createIndexes([
      { key: { participantId: 1, targetIndex: 1 }, unique: true, name: 'uk_participante_blanco' },
      { key: { tournamentId: 1, targetIndex: 1 }, name: 'ix_torneo_blanco' },
      { key: { patrolId: 1 }, name: 'ix_patrulla' },
    ]),

    db.collection(COLLECTIONS.syncOps).createIndexes([
      { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: 'ttl_expiresAt' },
      { key: { patrolId: 1, appliedAt: -1 }, name: 'ix_patrulla_fecha' },
    ]),

    db.collection(COLLECTIONS.standings).createIndexes([
      // Los dos modos de ranking de la landing, cada uno con su índice.
      { key: { seasonId: 1, category: 1, leaguePoints: -1 }, name: 'ix_ranking_posicion' },
      { key: { seasonId: 1, category: 1, bestNormalizedPct: -1 }, name: 'ix_ranking_puntaje' },
      { key: { seasonId: 1, archerId: 1, category: 1 }, unique: true, name: 'uk_temporada_archer' },
      { key: { archerId: 1 }, name: 'ix_archer' },
    ]),

    db.collection(COLLECTIONS.auditLog).createIndexes([
      { key: { at: -1 }, name: 'ix_at' },
      { key: { entity: 1, entityId: 1, at: -1 }, name: 'ix_entidad' },
    ]),
  ]);
}

/** Nombres de los índices existentes, por colección. Se usa en tests y diagnóstico. */
export async function listIndexes(db: Db): Promise<Record<string, string[]>> {
  const resultado: Record<string, string[]> = {};

  for (const nombre of Object.values(COLLECTIONS)) {
    const indices = await db.collection(nombre).indexes();
    resultado[nombre] = indices.map((i) => i.name ?? '').filter(Boolean);
  }

  return resultado;
}
