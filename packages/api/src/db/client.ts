/**
 * Conexión a MongoDB.
 *
 * El pool vive a nivel de módulo y se reutiliza: abrir una conexión por request
 * es el error de performance más caro que se puede cometer con este driver.
 *
 * Ver `docs/ARCHITECTURE.md` §3 y `docs/TECHNICAL.md` §5.
 */

import { type Db, MongoClient } from 'mongodb';
import { env } from '../env.js';
import {
  type ArcherDoc,
  type AuditLogDoc,
  COLLECTIONS,
  type ParticipantDoc,
  type PatrolDoc,
  type ScoreDoc,
  type SeasonDoc,
  type SessionDoc,
  type StandingDoc,
  type SyncOpDoc,
  type TournamentDoc,
  type UserDoc,
} from './types.js';

let client: MongoClient | undefined;
let db: Db | undefined;

export interface ConnectOptions {
  readonly uri?: string;
  readonly dbName?: string;
}

/** Abre la conexión si hace falta. Idempotente. */
export async function connect(options: ConnectOptions = {}): Promise<Db> {
  if (db) return db;

  const cfg = options.uri ? undefined : env();
  const uri = options.uri ?? cfg?.MONGODB_URI ?? '';
  const dbName = options.dbName ?? cfg?.MONGODB_DB ?? 'bal';

  client = new MongoClient(uri, {
    // El torneo no puede quedar esperando a una base que no responde: mejor
    // fallar rápido y que el reintento del outbox se encargue.
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 10_000,
    retryWrites: true,
    retryReads: true,
  });

  await client.connect();
  db = client.db(dbName);
  return db;
}

/** Base ya conectada. Lanza si todavía no se llamó a `connect`. */
export function getDb(): Db {
  if (!db) {
    throw new Error('MongoDB no está conectado. Llamá a connect() antes.');
  }
  return db;
}

export async function disconnect(): Promise<void> {
  await client?.close();
  client = undefined;
  db = undefined;
}

/** Cliente conectado. Hace falta para abrir sesiones de transacción. */
export function getClient(): MongoClient {
  if (!client) {
    throw new Error('MongoDB no está conectado. Llamá a connect() antes.');
  }
  return client;
}

/** `true` si la base responde. Lo usa el healthcheck. */
export async function ping(): Promise<boolean> {
  try {
    await getDb().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

// ── Accesores tipados ────────────────────────────────────────────────────────
// Es el único lugar donde se nombran las colecciones. Ninguna consulta vive
// fuera de `repositories/`.

export const users = () => getDb().collection<UserDoc>(COLLECTIONS.users);
export const sessions = () => getDb().collection<SessionDoc>(COLLECTIONS.sessions);
export const seasons = () => getDb().collection<SeasonDoc>(COLLECTIONS.seasons);
export const archers = () => getDb().collection<ArcherDoc>(COLLECTIONS.archers);
export const tournaments = () => getDb().collection<TournamentDoc>(COLLECTIONS.tournaments);
export const patrols = () => getDb().collection<PatrolDoc>(COLLECTIONS.patrols);
export const participants = () => getDb().collection<ParticipantDoc>(COLLECTIONS.participants);
export const scores = () => getDb().collection<ScoreDoc>(COLLECTIONS.scores);
export const syncOps = () => getDb().collection<SyncOpDoc>(COLLECTIONS.syncOps);
export const standings = () => getDb().collection<StandingDoc>(COLLECTIONS.standings);
export const auditLog = () => getDb().collection<AuditLogDoc>(COLLECTIONS.auditLog);
