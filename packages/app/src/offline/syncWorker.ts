/**
 * Vaciado del outbox.
 *
 * Corre **de fondo**. La UI nunca lo espera: `nudge()` no se llama con `await`
 * desde un handler. Ver `docs/OFFLINE_SYNC.md` §5.3 y §12.
 */

import { api } from '../lib/apiClient.js';
import {
  countOutbox,
  getDb,
  type OutboxOp,
  readBundle,
  readOutbox,
  removeOp,
  saveBundle,
  updateOp,
  writeMeta,
} from './db.js';

export type SyncStatus = 'synced' | 'pending' | 'offline' | 'error';

export interface SyncState {
  readonly status: SyncStatus;
  readonly pending: number;
  readonly lastSyncAt: number | null;
  readonly lastError: string | null;
}

type Listener = (estado: SyncState) => void;

const LOTE = 50;
const INTERVALO_MS = 30_000;
const BACKOFF_MAX_MS = 60_000;

let estado: SyncState = { status: 'synced', pending: 0, lastSyncAt: null, lastError: null };
let listeners: Listener[] = [];
let corriendo = false;
let reintentoEn: ReturnType<typeof setTimeout> | undefined;
let intervalo: ReturnType<typeof setInterval> | undefined;

export function getSyncState(): SyncState {
  return estado;
}

export function subscribe(listener: Listener): () => void {
  listeners.push(listener);
  listener(estado);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function emitir(cambios: Partial<SyncState>): void {
  estado = { ...estado, ...cambios };
  for (const l of listeners) l(estado);
}

async function refrescarPendientes(): Promise<number> {
  const pending = await countOutbox();
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

  emitir({
    pending,
    status:
      estado.status === 'error'
        ? 'error'
        : offline
          ? 'offline'
          : pending > 0
            ? 'pending'
            : 'synced',
  });

  return pending;
}

/** Backoff exponencial con jitter. */
function esperaDe(intentos: number): number {
  const base = Math.min(2 ** intentos * 1000, BACKOFF_MAX_MS);
  return base * (0.5 + Math.random() * 0.5);
}

interface OpResult {
  opId: string;
  status: 'applied' | 'duplicate' | 'superseded' | 'rejected';
  score?: { total: number; innerCount: number; xCount: number; tenCount: number; mCount: number };
  error?: { code: string; message: string };
}

interface SyncResponse {
  results: OpResult[];
  patrol: { status: string; targetsCompleted: number };
  serverTime: string;
}

/** Convierte una op del outbox al formato del contrato de `/sync`. */
function aPayload(op: OutboxOp): Record<string, unknown> {
  return {
    type: op.type,
    opId: op.opId,
    clientUpdatedAt: new Date(op.clientUpdatedAt).toISOString(),
    ...op.payload,
  };
}

export interface SyncDeps {
  readonly post: (ops: Record<string, unknown>[]) => Promise<SyncResponse>;
}

/**
 * Lo que hace de verdad: mandar el lote a `/wafl/sync`.
 *
 * Es el **valor por defecto**, no algo que haya que configurar. Cuando había que
 * llamar a `configureSync` para que el worker funcionara, los tests lo hacían y
 * la aplicación no: el outbox se llenaba y no salía nunca. Ver `BITACORA.md`,
 * entrada de `TEST-1`.
 */
const DEPS_REALES: SyncDeps = {
  post: (ops) => api.post<SyncResponse>('/wafl/sync', { ops }),
};

let deps: SyncDeps = DEPS_REALES;

/** Reemplaza el transporte. Sólo para tests. */
export function configureSync(nuevas: SyncDeps): void {
  deps = nuevas;
}

/**
 * Vacía el outbox.
 *
 * @returns `true` si quedó vacío.
 */
export async function flush(): Promise<boolean> {
  if (corriendo) return false;
  corriendo = true;

  try {
    for (;;) {
      const lote = await readOutbox(LOTE);
      if (lote.length === 0) {
        await writeMeta('lastSyncAt', Date.now());
        emitir({ status: 'synced', pending: 0, lastSyncAt: Date.now(), lastError: null });
        return true;
      }

      let respuesta: SyncResponse;
      try {
        respuesta = await deps.post(lote.map(aPayload));
      } catch (error) {
        // Error de red: se reintenta indefinidamente. Es el caso normal en el
        // monte, y NUNCA se descartan las ops.
        await marcarIntentos(lote, error);
        programarReintento(lote);
        await refrescarPendientes();
        return false;
      }

      const cortar = await aplicarResultados(lote, respuesta);
      if (cortar) {
        await refrescarPendientes();
        return false;
      }

      await sincronizarReloj(respuesta.serverTime);
    }
  } finally {
    corriendo = false;
  }
}

async function aplicarResultados(lote: OutboxOp[], respuesta: SyncResponse): Promise<boolean> {
  const db = await getDb();
  const porId = new Map(respuesta.results.map((r) => [r.opId, r]));
  let hayConflicto = false;

  for (const op of lote) {
    const resultado = porId.get(op.opId);
    if (!resultado) continue;

    if (resultado.status === 'rejected') {
      // No se reintenta: el servidor ya dijo que no. Se marca para que el
      // líder vea qué pasó y con qué arquero.
      hayConflicto = true;
      const participantId = op.payload.participantId as string | undefined;
      const targetIndex = op.payload.targetIndex as number | undefined;

      if (participantId !== undefined && targetIndex !== undefined) {
        const score = await db.get('scores', [participantId, targetIndex]);
        if (score) {
          await db.put('scores', {
            ...score,
            syncState: 'conflict',
            error: resultado.error?.message ?? 'La sincronización rechazó este puntaje.',
          });
        }
      }

      await removeOp(op.opId);
      emitir({
        status: 'error',
        lastError: resultado.error?.message ?? 'Error de sincronización.',
      });
      continue;
    }

    // `applied`, `duplicate` y `superseded` se resuelven igual: la op ya no
    // tiene nada que hacer en el outbox.
    if (resultado.status === 'applied' && resultado.score) {
      const participantId = op.payload.participantId as string | undefined;
      const targetIndex = op.payload.targetIndex as number | undefined;

      if (participantId !== undefined && targetIndex !== undefined) {
        const score = await db.get('scores', [participantId, targetIndex]);
        if (score) {
          // Gana el total del servidor: es la autoridad.
          await db.put('scores', { ...score, ...resultado.score, syncState: 'synced' });
        }
      }
    }

    await removeOp(op.opId);
  }

  return hayConflicto;
}

async function marcarIntentos(lote: OutboxOp[], error: unknown): Promise<void> {
  const mensaje = error instanceof Error ? error.message : String(error);
  for (const op of lote) {
    await updateOp({
      ...op,
      attempts: op.attempts + 1,
      lastAttemptAt: Date.now(),
      lastError: mensaje,
    });
  }
}

function programarReintento(lote: OutboxOp[]): void {
  const intentos = Math.max(...lote.map((o) => o.attempts), 0);
  clearTimeout(reintentoEn);
  reintentoEn = setTimeout(() => void flush(), esperaDe(intentos));
}

/** Recalcula el desfase de reloj con cada respuesta del servidor. */
async function sincronizarReloj(serverTime: string): Promise<void> {
  const bundle = await readBundle();
  if (!bundle) return;

  const clockSkewMs = new Date(serverTime).getTime() - Date.now();
  await saveBundle({ ...bundle, clockSkewMs });
}

/**
 * Pide una sincronización.
 *
 * **No se espera con `await` desde la UI.** El puntaje ya está guardado; esto
 * es de fondo.
 */
export function nudge(): void {
  void flush();
}

/** Arranca los disparadores. Devuelve la función para detenerlos. */
export function startSyncWorker(): () => void {
  const alVolverLaSeñal = () => {
    emitir({ status: 'pending' });
    nudge();
  };
  const alRecuperarFoco = () => {
    if (document.visibilityState === 'visible') nudge();
  };

  window.addEventListener('online', alVolverLaSeñal);
  window.addEventListener('offline', () => emitir({ status: 'offline' }));
  document.addEventListener('visibilitychange', alRecuperarFoco);

  intervalo = setInterval(() => {
    void refrescarPendientes().then((p) => {
      if (p > 0) nudge();
    });
  }, INTERVALO_MS);

  void refrescarPendientes();

  return () => {
    window.removeEventListener('online', alVolverLaSeñal);
    document.removeEventListener('visibilitychange', alRecuperarFoco);
    clearInterval(intervalo);
    clearTimeout(reintentoEn);
  };
}

/** Sólo para tests. */
export function resetSyncWorker(): void {
  estado = { status: 'synced', pending: 0, lastSyncAt: null, lastError: null };
  listeners = [];
  corriendo = false;
  clearTimeout(reintentoEn);
  clearInterval(intervalo);
  deps = DEPS_REALES;
}

export { refrescarPendientes as refreshPending };
