/**
 * Escrituras del líder de patrulla.
 *
 * **La red nunca está en el camino crítico.** El puntaje se escribe en
 * IndexedDB y se encola una op; que eso llegue al servidor es un problema
 * aparte, que se resuelve cuando se puede.
 *
 * Ver `docs/OFFLINE_SYNC.md` §1 y §5.2.
 */

import {
  isValidToken,
  MISS_TOKEN,
  type Modality,
  SCORING,
  tokenValue,
  validateTargetScore,
  X_TOKEN,
} from '@bal/shared';
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
 * Registra las flechas de un arquero en un blanco.
 *
 * **La carga es incremental**: el líder toca una flecha por vez, así que un
 * blanco a medio cargar es un estado legítimo. Se guarda en IndexedDB siempre,
 * para que nada se pierda si se apaga el celular a mitad del blanco.
 *
 * **La op se encola sólo cuando el blanco está completo.** Un blanco a medias
 * todavía no es un puntaje, y el servidor lo rechazaría con `ARROW_COUNT`.
 *
 * Cuando está completo, el puntaje y la op se escriben en **una sola
 * transacción de IndexedDB**: nunca queda un puntaje sin su op, ni al revés.
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

  const modality = blanco.modality as Modality;

  if (arrows.length > blanco.arrows) {
    return {
      ok: false,
      code: 'ARROW_COUNT',
      message: `Este blanco es de ${blanco.arrows} ${blanco.arrows === 1 ? 'flecha' : 'flechas'}.`,
    };
  }

  // Cada token se valida contra la modalidad DE ESTE BLANCO, aunque el blanco
  // todavía esté a medias.
  const invalido = arrows.find((token) => !isValidToken(modality, token));
  if (invalido !== undefined) {
    return {
      ok: false,
      code: 'INVALID_TOKEN',
      message: `"${invalido}" no es un puntaje válido acá.`,
    };
  }

  const completo = arrows.length === blanco.arrows;
  const clientUpdatedAt = Date.now() + bundle.clockSkewMs;

  // Con el blanco completo, el cómputo sale de la función del dominio —la misma
  // que usa el servidor—. A medias se suman los tokens cargados, sólo para
  // mostrar el parcial en pantalla.
  const computo = completo
    ? computoCompleto(modality, blanco.arrows, arrows)
    : computoParcial(modality, arrows);

  const score: StoredScore = {
    participantId,
    targetIndex,
    arrows: [...arrows],
    ...computo,
    clientUpdatedAt,
    syncState: completo ? 'pending' : 'synced',
  };

  const db = await getDb();
  const tx = db.transaction(['scores', 'outbox'], 'readwrite');

  const escrituras: Promise<unknown>[] = [tx.objectStore('scores').put(score)];

  if (completo) {
    escrituras.push(
      tx.objectStore('outbox').put(
        opBase('score', clientUpdatedAt, {
          participantId,
          targetIndex,
          arrows: [...arrows],
        }),
      ),
    );
  }

  await Promise.all([...escrituras, tx.done]);

  return { ok: true };
}

type Computo = Pick<StoredScore, 'total' | 'innerCount' | 'xCount' | 'tenCount' | 'mCount'>;

function computoCompleto(
  modality: Modality,
  arrowsPerTarget: number,
  arrows: readonly string[],
): Computo {
  const r = validateTargetScore(modality, arrowsPerTarget, arrows);
  if (!r.ok) {
    // Inalcanzable: la cantidad y los tokens ya se validaron arriba.
    return computoParcial(modality, arrows);
  }

  const { total, innerCount, xCount, tenCount, mCount } = r.value;
  return { total, innerCount, xCount, tenCount, mCount };
}

/** Parcial: sólo para mostrar el acumulado mientras se carga. */
function computoParcial(modality: Modality, arrows: readonly string[]): Computo {
  const cfg = SCORING[modality];
  let total = 0;
  let innerCount = 0;
  let xCount = 0;
  let tenCount = 0;
  let mCount = 0;

  for (const token of arrows) {
    const valor = tokenValue(modality, token);
    total += valor;
    if (token === cfg.innerToken) innerCount++;
    if (cfg.hasX && token === X_TOKEN) xCount++;
    if (valor === 10) tenCount++;
    if (token === MISS_TOKEN) mCount++;
  }

  return { total, innerCount, xCount, tenCount, mCount };
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
