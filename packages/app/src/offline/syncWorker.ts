/**
 * Vaciado del outbox.
 *
 * Corre **de fondo**. La UI nunca lo espera: `nudge()` no se llama con `await`
 * desde un handler. Ver `docs/OFFLINE_SYNC.md` §5.3 y §12.
 */

import { ApiError, request } from '../lib/apiClient.js';
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
  /**
   * En `applied`, los totales que recalculó el servidor. En `superseded` y
   * `duplicate` (de un score), lo que el servidor tiene hoy en esa celda, con
   * sus `arrows`: es lo que permite alinear la pantalla con el servidor.
   */
  score?: {
    total: number;
    innerCount: number;
    xCount: number;
    tenCount: number;
    mCount: number;
    arrows?: string[];
  };
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
 * Cuánto se espera la respuesta de `/wafl/sync` antes de cortar y reintentar.
 *
 * `REF6-4` / `P-2`. Con señal intermitente un POST puede quedar colgado minutos, y
 * mientras `flush` espera `corriendo` está en `true`: el evento `online`, el
 * intervalo y el foco llaman a `flush()` y salen de inmediato, así que **nada más
 * puede vaciar el outbox** aunque la señal ya haya vuelto. Un lote de 50 ops tarda
 * unos segundos con señal buena; 20 s es holgado para eso y corto para la espera.
 */
const SYNC_TIMEOUT_MS = 20_000;

/**
 * Manda el lote con plazo. Cubre el pedido entero, token CSRF incluido.
 *
 * Es un `setTimeout` propio y no `AbortSignal.timeout`: este último no se puede
 * controlar con relojes falsos, y ese plazo es justo lo que hay que probar. El
 * error que sale no es un `ApiError`, así que `esReintentable` lo trata como lo
 * que es: no hay nada que el servidor haya dicho, se reintenta.
 */
async function postConPlazo(ops: Record<string, unknown>[]): Promise<SyncResponse> {
  const control = new AbortController();
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  const vencido = new Promise<never>((_resolve, reject) => {
    temporizador = setTimeout(() => {
      control.abort();
      reject(new Error('El servidor no respondió a tiempo.'));
    }, SYNC_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      request<SyncResponse>('/wafl/sync', {
        method: 'POST',
        body: { ops },
        signal: control.signal,
      }),
      vencido,
    ]);
  } finally {
    clearTimeout(temporizador);
  }
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
  post: postConPlazo,
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
        if (esReintentable(error)) {
          // Error de red: se reintenta indefinidamente. Es el caso normal en el
          // monte, y NUNCA se descartan las ops.
          await marcarIntentos(lote, error);
          programarReintento(lote);
          await refrescarPendientes();
          return false;
        }

        // El servidor entendió el pedido y dijo que no. Reintentar no lo va a
        // cambiar: hay que sacar la op del medio o el outbox queda trabado.
        await aislarIrrecuperables(lote, error);
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

/** La celda (arquero + blanco) a la que se refiere una op de score. */
function celdaDe(op: OutboxOp): { participantId: string; targetIndex: number } | undefined {
  const participantId = op.payload.participantId as string | undefined;
  const targetIndex = op.payload.targetIndex as number | undefined;
  return participantId !== undefined && targetIndex !== undefined
    ? { participantId, targetIndex }
    : undefined;
}

/**
 * Lo que el celular hace con una op que el servidor **no** rechazó.
 *
 * `applied`, `duplicate` y `superseded` se resuelven igual en el outbox —la op ya
 * no tiene nada que hacer ahí—, pero no en la pantalla:
 *
 * - `applied`: gana el total del servidor, que es la autoridad.
 * - `superseded` y `duplicate`: sacar la op no alcanza. El puntaje local seguía en
 *   `pending` con las flechas que perdieron (o que quizás nunca llegaron), y
 *   `sembrarPuntajes` no pisa lo que no está `synced`. Se alinea con lo que el
 *   servidor tiene. Sin `score` en la respuesta (un `duplicate` de una firma, o
 *   un servidor viejo) no hay con qué alinear y no se toca nada.
 */
async function reflejarResultado(op: OutboxOp, resultado: OpResult): Promise<void> {
  const { score } = resultado;
  if (!score) return;

  if (resultado.status === 'applied') {
    const celda = celdaDe(op);
    if (!celda) return;

    const db = await getDb();
    const local = await db.get('scores', [celda.participantId, celda.targetIndex]);
    if (local) await db.put('scores', { ...local, ...score, syncState: 'synced' });
    return;
  }

  if (score.arrows) await alinearConServidor(op, { ...score, arrows: score.arrows });
}

async function aplicarResultados(lote: OutboxOp[], respuesta: SyncResponse): Promise<boolean> {
  const porId = new Map(respuesta.results.map((r) => [r.opId, r]));
  let hayConflicto = false;

  for (const op of lote) {
    const resultado = porId.get(op.opId);
    if (!resultado) continue;

    if (resultado.status === 'rejected') {
      // No se reintenta: el servidor ya dijo que no. Se marca para que el
      // líder vea qué pasó y con qué arquero.
      hayConflicto = true;
      const motivo = resultado.error?.message ?? 'La sincronización rechazó este cambio.';

      await marcarConflicto(op, motivo);
      await removeOp(op.opId);
      emitir({ status: 'error', lastError: motivo });
      continue;
    }

    await reflejarResultado(op, resultado);
    await removeOp(op.opId);
  }

  return hayConflicto;
}

/**
 * Deja el puntaje local igual al del servidor, ya sincronizado.
 *
 * `REF6-4` / `U-3`. Dos celulares con la misma credencial pueden cargar el mismo
 * blanco; gana el `clientUpdatedAt` más reciente. El que pierde se quedaba
 * mostrando —y haciendo firmar— un número que no es el que el servidor guardó.
 * Lo mismo cuando se perdió la respuesta y el reenvío vuelve como `duplicate`.
 *
 * **No pisa una edición más nueva que todavía está en camino.** Si hay otra op de
 * score para la misma celda en el outbox, el líder volvió a tocar el blanco
 * mientras el lote viajaba: esa edición es más nueva que lo que el servidor
 * devuelve, y se resuelve sola cuando le toque.
 */
async function alinearConServidor(
  op: OutboxOp,
  vigente: NonNullable<OpResult['score']> & { arrows: string[] },
): Promise<void> {
  // Una firma no tiene blanco, así que no tiene celda: `celdaDe` la descarta sola.
  const celda = celdaDe(op);
  if (!celda) return;
  const { participantId, targetIndex } = celda;

  const hayOtraEnCamino = (await readOutbox()).some(
    (o) =>
      o.opId !== op.opId &&
      o.type === 'score' &&
      o.payload.participantId === participantId &&
      o.payload.targetIndex === targetIndex,
  );
  if (hayOtraEnCamino) return;

  const db = await getDb();
  const local = await db.get('scores', [participantId, targetIndex]);

  await db.put('scores', {
    participantId,
    targetIndex,
    arrows: vigente.arrows,
    total: vigente.total,
    innerCount: vigente.innerCount,
    xCount: vigente.xCount,
    tenCount: vigente.tenCount,
    mCount: vigente.mCount,
    // Sin `error`: un rechazo anterior no puede quedar pegado a un puntaje que ya
    // coincide con el del servidor.
    clientUpdatedAt: local?.clientUpdatedAt ?? Date.now(),
    syncState: 'synced',
  });
}

/**
 * ¿Tiene sentido volver a mandar esto?
 *
 * **Sí por defecto.** Sin conexión, con el servidor caído o con la sesión
 * vencida, la op se reintenta para siempre: es trabajo del líder y no se tira.
 *
 * **No cuando el servidor contestó que el pedido está mal.** Un 400 de
 * validación va a dar 400 las mil veces siguientes, y mientras tanto tapa el
 * outbox y el circuito no se puede cerrar. Pasó de verdad: cuatro firmas con
 * 38 intentos cada una, todas con «Los datos enviados no son válidos.».
 */
function esReintentable(error: unknown): boolean {
  // Sin `status` no se sabe qué pasó —típicamente el `TypeError` de `fetch`
  // sin red—. Ante la duda, se reintenta: nunca se pierde trabajo por una
  // suposición.
  if (!(error instanceof ApiError)) return true;

  const { status } = error;

  // 401 y 403 se arreglan volviendo a entrar; la op tiene que estar ahí cuando
  // eso pase. `docs/OFFLINE_SYNC.md` §5.4.
  if (status === 401 || status === 403) return true;
  // Timeout y rate limit son transitorios por definición.
  if (status === 408 || status === 429) return true;

  return status >= 500;
}

/**
 * Saca del outbox lo que el servidor nunca va a aceptar.
 *
 * El servidor rechaza **el lote entero** —la validación corre sobre el array
 * completo—, así que una sola op mala arrastra a las buenas. Se reenvía op por
 * op para separar la culpable: el puntaje de un arquero no puede quedar rehén
 * de la firma rota de otro.
 *
 * El dato **no se pierde**: sale la op, pero el puntaje o la firma quedan en
 * IndexedDB marcados en conflicto, con el motivo a la vista.
 */
async function aislarIrrecuperables(lote: OutboxOp[], error: unknown): Promise<void> {
  if (lote.length === 1) {
    const [op] = lote;
    if (op) await descartarIrrecuperable(op, error);
    return;
  }

  for (const op of lote) {
    try {
      await aplicarResultados([op], await deps.post([aPayload(op)]));
    } catch (e) {
      if (esReintentable(e)) {
        // Esta no era la culpable; se queda para el próximo intento.
        await marcarIntentos([op], e);
      } else {
        await descartarIrrecuperable(op, e);
      }
    }
  }
}

async function descartarIrrecuperable(op: OutboxOp, error: unknown): Promise<void> {
  const mensaje = error instanceof Error ? error.message : String(error);
  await marcarConflicto(op, mensaje);
  await removeOp(op.opId);
  emitir({ status: 'error', lastError: mensaje });
}

/** Deja la marca donde el líder la va a ver: sobre el puntaje o la firma. */
async function marcarConflicto(op: OutboxOp, mensaje: string): Promise<void> {
  const db = await getDb();
  const participantId = op.payload.participantId as string | undefined;
  if (participantId === undefined) return;

  if (op.type === 'signature') {
    const firma = await db.get('signatures', participantId);
    if (firma) await db.put('signatures', { ...firma, syncState: 'conflict' });
    return;
  }

  const targetIndex = op.payload.targetIndex as number | undefined;
  if (targetIndex === undefined) return;

  const score = await db.get('scores', [participantId, targetIndex]);
  if (score) await db.put('scores', { ...score, syncState: 'conflict', error: mensaje });
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
