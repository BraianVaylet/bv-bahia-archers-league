/**
 * IndexedDB — **la fuente de verdad del cliente**.
 *
 * La UI de scoring lee de acá, nunca de una respuesta HTTP. Esa es la propiedad
 * que hace que el modo offline no necesite ramas condicionales por toda la
 * aplicación: no hay un "modo offline", hay un solo modo que resulta funcionar
 * sin red.
 *
 * Ver `docs/OFFLINE_SYNC.md` §1 y §3.
 */

import type { Modality } from '@bal/shared';
import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

export const DB_NAME = 'bal-wafl';
export const DB_VERSION = 1;

export interface BundleTarget {
  index: number;
  modality: Modality;
  arrows: number;
  description: string | null;
}

export interface BundleParticipant {
  id: string;
  firstName: string;
  lastName: string;
  category: string;
  stake: string;
  unit: string;
  position: string;
}

export interface StoredBundle {
  tournament: {
    id: string;
    name: string;
    date: string;
    maxPossibleScore: number;
    targets: BundleTarget[];
  };
  patrol: {
    id: string;
    number: number;
    startTargetIndex: number;
    status: string;
    targetsCompleted: number;
  };
  participants: BundleParticipant[];
  fetchedAt: number;
  /** `serverTime - Date.now()` al descargar. Ver `docs/OFFLINE_SYNC.md` §4. */
  clockSkewMs: number;
}

export type SyncState = 'pending' | 'synced' | 'conflict';

export interface StoredScore {
  participantId: string;
  targetIndex: number;
  arrows: string[];
  /** Calculado localmente **sólo para mostrar**. El autoritativo lo da el servidor. */
  total: number;
  innerCount: number;
  xCount: number;
  tenCount: number;
  mCount: number;
  /** Epoch ms, ya corregido por `clockSkewMs`. */
  clientUpdatedAt: number;
  syncState: SyncState;
  error?: string;
}

export interface StoredSignature {
  participantId: string;
  pngDataUrl: string;
  clientUpdatedAt: number;
  syncState: SyncState;
}

export type OutboxOpType = 'score' | 'signature' | 'close';

export interface OutboxOp {
  /** uuid v7: ordenable por tiempo, así el outbox se drena en orden. */
  opId: string;
  type: OutboxOpType;
  payload: Record<string, unknown>;
  clientUpdatedAt: number;
  attempts: number;
  lastAttemptAt: number | null;
  lastError: string | null;
  createdAt: number;
}

interface WaflDB extends DBSchema {
  bundle: { key: 'current'; value: StoredBundle };
  scores: {
    key: [string, number];
    value: StoredScore;
    indexes: { 'by-target': number; 'by-sync': string };
  };
  signatures: { key: string; value: StoredSignature };
  outbox: { key: string; value: OutboxOp; indexes: { 'by-created': number } };
  meta: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<WaflDB>> | undefined;

export function getDb(): Promise<IDBPDatabase<WaflDB>> {
  dbPromise ??= openDB<WaflDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('bundle');

      const scores = db.createObjectStore('scores', {
        keyPath: ['participantId', 'targetIndex'],
      });
      scores.createIndex('by-target', 'targetIndex');
      scores.createIndex('by-sync', 'syncState');

      db.createObjectStore('signatures', { keyPath: 'participantId' });

      const outbox = db.createObjectStore('outbox', { keyPath: 'opId' });
      outbox.createIndex('by-created', 'createdAt');

      db.createObjectStore('meta');
    },
  });

  return dbPromise;
}

/**
 * Cierra la conexión.
 *
 * Hace falta antes de borrar la base: `deleteDatabase` se queda **bloqueado**
 * mientras haya una conexión abierta, sin error y sin timeout.
 */
export async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = undefined;
}

/** Sólo para tests: cierra y borra la base entera. */
export async function deleteDb(): Promise<void> {
  await closeDb();

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

// ── Bundle ───────────────────────────────────────────────────────────────────

export async function saveBundle(bundle: StoredBundle): Promise<void> {
  await (await getDb()).put('bundle', bundle, 'current');
}

export async function readBundle(): Promise<StoredBundle | undefined> {
  return (await getDb()).get('bundle', 'current');
}

// ── Puntajes ─────────────────────────────────────────────────────────────────

export async function readScores(): Promise<StoredScore[]> {
  return (await getDb()).getAll('scores');
}

export async function readScore(
  participantId: string,
  targetIndex: number,
): Promise<StoredScore | undefined> {
  return (await getDb()).get('scores', [participantId, targetIndex]);
}

export async function readSignatures(): Promise<StoredSignature[]> {
  return (await getDb()).getAll('signatures');
}

// ── Outbox ───────────────────────────────────────────────────────────────────

/** Ops pendientes, en el orden en que ocurrieron. */
export async function readOutbox(limite = 50): Promise<OutboxOp[]> {
  const todas = await (await getDb()).getAllFromIndex('outbox', 'by-created');
  return todas.slice(0, limite);
}

export async function countOutbox(): Promise<number> {
  return (await getDb()).count('outbox');
}

export async function removeOp(opId: string): Promise<void> {
  await (await getDb()).delete('outbox', opId);
}

export async function updateOp(op: OutboxOp): Promise<void> {
  await (await getDb()).put('outbox', op);
}

// ── Meta ─────────────────────────────────────────────────────────────────────

export async function readMeta<T>(clave: string): Promise<T | undefined> {
  return (await getDb()).get('meta', clave) as Promise<T | undefined>;
}

export async function writeMeta(clave: string, valor: unknown): Promise<void> {
  await (await getDb()).put('meta', valor, clave);
}

/** Borra todo. Se usa al cerrar sesión o al cambiar de torneo. */
export async function clearAll(): Promise<void> {
  const db = await getDb();
  await Promise.all([
    db.clear('bundle'),
    db.clear('scores'),
    db.clear('signatures'),
    db.clear('outbox'),
    db.clear('meta'),
  ]);
}
