/**
 * Escrituras del líder de patrulla.
 *
 * **La red nunca está en el camino crítico.** El puntaje se escribe en
 * IndexedDB y se encola una op; que eso llegue al servidor es un problema
 * aparte, que se resuelve cuando se puede.
 *
 * Ver `docs/OFFLINE_SYNC.md` §1 y §5.2.
 */

import { type Modality, validateTargetScore } from '@bal/shared';
import { getDb, type OutboxOp, type OutboxOpType, readBundle, type StoredScore } from './db.js';

/**
 * uuid v7: los primeros 48 bits son el timestamp, así que ordenar por `opId`
 * ordena por momento de creación. Es lo que hace que el outbox se drene en el
 * orden en que ocurrieron las cosas.
 */
export function uuidv7(): string {
  const ms = Date.now();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  bytes[0] = (ms / 2 ** 40) & 0xff;
  bytes[1] = (ms / 2 ** 32) & 0xff;
  bytes[2] = (ms / 2 ** 24) & 0xff;
  bytes[3] = (ms / 2 ** 16) & 0xff;
  bytes[4] = (ms / 2 ** 8) & 0xff;
  bytes[5] = ms & 0xff;

  // Versión 7 y variante RFC 4122.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Reloj corregido por el desfase medido al descargar el bundle. */
export async function ahoraCorregido(): Promise<number> {
  const bundle = await readBundle();
  return Date.now() + (bundle?.clockSkewMs ?? 0);
}

export type WriteResult =
  | { ok: true }
  | {
      ok: false;
      code: 'NO_BUNDLE' | 'TARGET_NOT_FOUND' | 'ARROW_COUNT' | 'INVALID_TOKEN';
      message: string;
    };

function opBase(
  type: OutboxOpType,
  clientUpdatedAt: number,
  payload: Record<string, unknown>,
): OutboxOp {
  return {
    opId: uuidv7(),
    type,
    payload,
    clientUpdatedAt,
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    createdAt: Date.now(),
  };
}

/**
 * Registra el puntaje de un arquero en un blanco.
 *
 * Escribe el puntaje **y** encola la op en **una sola transacción de
 * IndexedDB**: nunca queda un puntaje guardado sin su op, ni al revés.
 *
 * Valida en el cliente antes de encolar: un token inválido no tiene por qué
 * viajar al servidor para que lo rechace.
 */
export async function writeScore(
  participantId: string,
  targetIndex: number,
  arrows: readonly string[],
): Promise<WriteResult> {
  const bundle = await readBundle();
  if (!bundle) {
    return { ok: false, code: 'NO_BUNDLE', message: 'Todavía no se descargó el recorrido.' };
  }

  const blanco = bundle.tournament.targets.find((t) => t.index === targetIndex);
  if (!blanco) {
    return { ok: false, code: 'TARGET_NOT_FOUND', message: 'Ese blanco no es de este torneo.' };
  }

  const validacion = validateTargetScore(blanco.modality as Modality, blanco.arrows, arrows);
  if (!validacion.ok) {
    const { error } = validacion;
    return {
      ok: false,
      code: error.code,
      message:
        error.code === 'ARROW_COUNT'
          ? `Este blanco es de ${error.expected} flechas.`
          : `"${error.token}" no es un puntaje válido acá.`,
    };
  }

  const clientUpdatedAt = Date.now() + bundle.clockSkewMs;
  const computo = validacion.value;

  const score: StoredScore = {
    participantId,
    targetIndex,
    arrows: [...arrows],
    total: computo.total,
    innerCount: computo.innerCount,
    xCount: computo.xCount,
    tenCount: computo.tenCount,
    mCount: computo.mCount,
    clientUpdatedAt,
    syncState: 'pending',
  };

  const db = await getDb();
  const tx = db.transaction(['scores', 'outbox'], 'readwrite');

  await Promise.all([
    tx.objectStore('scores').put(score),
    tx.objectStore('outbox').put(
      opBase('score', clientUpdatedAt, {
        participantId,
        targetIndex,
        arrows: [...arrows],
      }),
    ),
    tx.done,
  ]);

  return { ok: true };
}

/** Guarda la firma de un arquero y la encola. */
export async function writeSignature(
  participantId: string,
  pngDataUrl: string,
): Promise<WriteResult> {
  const bundle = await readBundle();
  if (!bundle) {
    return { ok: false, code: 'NO_BUNDLE', message: 'Todavía no se descargó el recorrido.' };
  }

  const clientUpdatedAt = Date.now() + bundle.clockSkewMs;

  const db = await getDb();
  const tx = db.transaction(['signatures', 'outbox'], 'readwrite');

  await Promise.all([
    tx.objectStore('signatures').put({
      participantId,
      pngDataUrl,
      clientUpdatedAt,
      syncState: 'pending' as const,
    }),
    tx
      .objectStore('outbox')
      .put(opBase('signature', clientUpdatedAt, { participantId, pngDataUrl })),
    tx.done,
  ]);

  return { ok: true };
}

export type CloseResult =
  | { ok: true }
  | { ok: false; code: 'PENDING_OPS'; pending: number; message: string };

/**
 * Encola el cierre del circuito.
 *
 * **Sólo si el outbox está vacío.** Cerrar con puntajes pendientes dejaría al
 * servidor rechazando por datos incompletos y confundiría al líder.
 * Ver `docs/OFFLINE_SYNC.md` §5.5.
 */
export async function requestClose(): Promise<CloseResult> {
  const db = await getDb();
  const pendientes = await db.count('outbox');

  if (pendientes > 0) {
    return {
      ok: false,
      code: 'PENDING_OPS',
      pending: pendientes,
      message: `Faltan sincronizar ${pendientes} cambios. Buscá señal y probá de nuevo.`,
    };
  }

  await db.put('outbox', opBase('close', await ahoraCorregido(), {}));
  return { ok: true };
}
