import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAll,
  closeDb,
  countOutbox,
  deleteDb,
  readBundle,
  readOutbox,
  readScore,
  readScores,
  type StoredBundle,
  saveBundle,
  updateOp,
} from './db.js';
import { requestClose, uuidv7, writeScore, writeSignature } from './outbox.js';
import { configureSync, flush, getSyncState, resetSyncWorker } from './syncWorker.js';
import { syncLabel } from './useSyncStatus.js';

/**
 * Capa offline (FE-2).
 *
 * El principio: la red NUNCA está en el camino crítico de anotar un puntaje.
 * Los escenarios obligatorios están en docs/OFFLINE_SYNC.md §10.
 */

const P1 = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const P2 = 'aaaaaaaaaaaaaaaaaaaaaaa2';

const bundle = (overrides: Partial<StoredBundle> = {}): StoredBundle => ({
  tournament: {
    id: 't1',
    name: 'Torneo',
    date: '2026-08-08',
    maxPossibleScore: 52,
    targets: [
      { index: 1, modality: '3d', arrows: 2, description: null },
      { index: 2, modality: 'sala', arrows: 3, description: null },
    ],
  },
  patrol: { id: 'p1', number: 1, startTargetIndex: 1, status: 'en_curso', targetsCompleted: 0 },
  participants: [
    {
      id: P1,
      firstName: 'Juan',
      lastName: 'Pérez',
      category: 'razo',
      stake: 'azul',
      unit: 'A',
      position: 'izquierda',
    },
    {
      id: P2,
      firstName: 'Ana',
      lastName: 'Gómez',
      category: 'razo',
      stake: 'azul',
      unit: 'A',
      position: 'derecha',
    },
  ],
  fetchedAt: Date.now(),
  clockSkewMs: 0,
  ...overrides,
});

beforeEach(async () => {
  resetSyncWorker();
  // Base limpia por test: ninguno comparte estado con otro.
  await deleteDb();
  await saveBundle(bundle());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ── uuid v7 ──────────────────────────────────────────────────────────────────

describe('uuidv7', () => {
  it('genera identificadores con formato de UUID', () => {
    expect(uuidv7()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('es ordenable por tiempo: eso hace que el outbox se drene en orden', async () => {
    const primero = uuidv7();
    await new Promise((r) => setTimeout(r, 5));
    const segundo = uuidv7();
    expect(primero < segundo).toBe(true);
  });

  // Los primeros 48 bits son el timestamp. Sin eso el orden lexicográfico no
  // coincide con el orden temporal y el outbox se drena desordenado.
  it('los primeros 48 bits codifican el momento de creación', () => {
    const antes = Date.now();
    const hex = uuidv7().replace(/-/g, '').slice(0, 12);
    const codificado = Number.parseInt(hex, 16);

    expect(codificado).toBeGreaterThanOrEqual(antes - 1000);
    expect(codificado).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('no repite', () => {
    const generados = new Set(Array.from({ length: 500 }, uuidv7));
    expect(generados.size).toBe(500);
  });
});

// ── Escritura ────────────────────────────────────────────────────────────────

describe('writeScore', () => {
  it('guarda el puntaje con el total calculado localmente', async () => {
    expect(await writeScore(P1, 1, ['11', '8'])).toEqual({ ok: true });

    const score = await readScore(P1, 1);
    expect(score?.total).toBe(19);
    expect(score?.innerCount).toBe(1);
    expect(score?.syncState).toBe('pending');
  });

  // La transacción de IndexedDB garantiza que nunca queda un puntaje sin su op.
  it('escribe el puntaje Y encola la op en la misma transacción', async () => {
    await writeScore(P1, 1, ['11', '8']);

    expect(await readScore(P1, 1)).toBeDefined();
    expect(await countOutbox()).toBe(1);

    const [op] = await readOutbox();
    expect(op?.type).toBe('score');
    expect(op?.payload.participantId).toBe(P1);
  });

  it('rechaza un token inválido EN EL CLIENTE, sin encolar nada', async () => {
    // El blanco 1 es 3D: la X no existe ahí.
    const r = await writeScore(P1, 1, ['X', '10']);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_TOKEN');
    expect(await countOutbox()).toBe(0);
    expect(await readScore(P1, 1)).toBeUndefined();
  });

  // Un blanco a medias es un estado legítimo: la carga es incremental.
  it('acepta un blanco a medio cargar, sin encolar la op todavía', async () => {
    expect(await writeScore(P1, 2, ['X', '10'])).toEqual({ ok: true });

    expect((await readScore(P1, 2))?.total).toBe(20);
    // Todavía no es un puntaje: el servidor lo rechazaría con ARROW_COUNT.
    expect(await countOutbox()).toBe(0);
  });

  it('encola la op recién cuando el blanco está completo', async () => {
    await writeScore(P1, 2, ['X', '10']);
    expect(await countOutbox()).toBe(0);

    await writeScore(P1, 2, ['X', '10', '9']);
    expect(await countOutbox()).toBe(1);
  });

  it('rechaza más flechas de las que pide el blanco', async () => {
    const r = await writeScore(P1, 1, ['11', '10', '8']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ARROW_COUNT');
  });

  it('rechaza un blanco que no es del torneo', async () => {
    const r = await writeScore(P1, 9, ['11', '8']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('TARGET_NOT_FOUND');
  });

  it('corrige el reloj con el desfase medido al descargar el bundle', async () => {
    await saveBundle(bundle({ clockSkewMs: 60_000 }));
    const antes = Date.now();

    await writeScore(P1, 1, ['11', '8']);

    const score = await readScore(P1, 1);
    expect(score?.clientUpdatedAt).toBeGreaterThanOrEqual(antes + 59_000);
  });

  it('editar un puntaje lo reemplaza, no lo duplica', async () => {
    await writeScore(P1, 1, ['11', '8']);
    await writeScore(P1, 1, ['5', '5']);

    expect((await readScores()).filter((s) => s.targetIndex === 1)).toHaveLength(1);
    expect((await readScore(P1, 1))?.total).toBe(10);
    // Dos ops: el servidor resuelve cuál gana por LWW.
    expect(await countOutbox()).toBe(2);
  });
});

// ── Escenario 1 · sin señal todo el recorrido ────────────────────────────────

describe('escenario: sin señal todo el recorrido', () => {
  it('permite cargar el recorrido completo con navigator.onLine en false', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    for (const pid of [P1, P2]) {
      expect(await writeScore(pid, 1, ['11', '11'])).toEqual({ ok: true });
      expect(await writeScore(pid, 2, ['X', '10', '9'])).toEqual({ ok: true });
    }

    expect(await readScores()).toHaveLength(4);
    expect(await countOutbox()).toBe(4);
  });
});

// ── Escenario 3 · se cierra el navegador ─────────────────────────────────────

describe('escenario: se cierra la app a mitad', () => {
  it('al reabrir, los datos y el outbox siguen ahí', async () => {
    await writeScore(P1, 1, ['11', '8']);
    await writeScore(P2, 1, ['10', '5']);

    // Simula cerrar la app y volver a abrirla.
    await closeDb();

    expect(await readScores()).toHaveLength(2);
    expect(await countOutbox()).toBe(2);
    expect(await readBundle()).toBeDefined();
  });
});

// ── Sincronización ───────────────────────────────────────────────────────────

describe('flush', () => {
  it('vacía el outbox y aplica los totales del SERVIDOR', async () => {
    await writeScore(P1, 1, ['11', '8']);

    // El cliente calculó 19. El servidor responde otra cosa a propósito: es la
    // autoridad, así que su valor tiene que ganar.
    configureSync({
      post: async (ops) => ({
        results: ops.map((o) => ({
          opId: o.opId as string,
          status: 'applied' as const,
          score: { total: 777, innerCount: 5, xCount: 4, tenCount: 3, mCount: 2 },
        })),
        patrol: { status: 'en_curso', targetsCompleted: 1 },
        serverTime: new Date().toISOString(),
      }),
    });

    expect((await readScore(P1, 1))?.total).toBe(19);

    expect(await flush()).toBe(true);
    expect(await countOutbox()).toBe(0);

    const score = await readScore(P1, 1);
    expect(score?.syncState).toBe('synced');
    expect(score?.total).toBe(777);
    expect(score?.innerCount).toBe(5);
    expect(getSyncState().status).toBe('synced');
  });

  it('trata `duplicate` y `superseded` como resueltas: salen del outbox', async () => {
    await writeScore(P1, 1, ['11', '8']);
    await writeScore(P2, 1, ['10', '5']);

    configureSync({
      post: async (ops) => ({
        results: ops.map((o, i) => ({
          opId: o.opId as string,
          status: (i === 0 ? 'duplicate' : 'superseded') as 'duplicate' | 'superseded',
        })),
        patrol: { status: 'en_curso', targetsCompleted: 0 },
        serverTime: new Date().toISOString(),
      }),
    });

    await flush();
    expect(await countOutbox()).toBe(0);
  });

  // Es el antipatrón número uno de docs/OFFLINE_SYNC.md §12.
  it('un error de red NO descarta las ops', async () => {
    await writeScore(P1, 1, ['11', '8']);

    configureSync({
      post: async () => {
        throw new TypeError('Failed to fetch');
      },
    });

    expect(await flush()).toBe(false);
    expect(await countOutbox()).toBe(1);

    const [op] = await readOutbox();
    expect(op?.attempts).toBe(1);
    expect(op?.lastError).toContain('Failed to fetch');
  });

  it('un 401 tampoco descarta las ops', async () => {
    await writeScore(P1, 1, ['11', '8']);

    configureSync({
      post: async () => {
        throw new Error('401 Unauthorized');
      },
    });

    await flush();
    // Se conservan para enviarlas después de reautenticar.
    expect(await countOutbox()).toBe(1);
  });

  it('una op rechazada sale del outbox y marca el puntaje en conflicto', async () => {
    await writeScore(P1, 1, ['11', '8']);

    configureSync({
      post: async (ops) => ({
        results: ops.map((o) => ({
          opId: o.opId as string,
          status: 'rejected' as const,
          error: { code: 'FORBIDDEN', message: 'Ese arquero no es de tu patrulla.' },
        })),
        patrol: { status: 'en_curso', targetsCompleted: 0 },
        serverTime: new Date().toISOString(),
      }),
    });

    await flush();

    expect(await countOutbox()).toBe(0);
    const score = await readScore(P1, 1);
    expect(score?.syncState).toBe('conflict');
    expect(score?.error).toContain('no es de tu patrulla');
    expect(getSyncState().status).toBe('error');
  });

  it('recalcula el desfase de reloj con la respuesta del servidor', async () => {
    await writeScore(P1, 1, ['11', '8']);

    const futuro = new Date(Date.now() + 120_000).toISOString();
    configureSync({
      post: async (ops) => ({
        results: ops.map((o) => ({ opId: o.opId as string, status: 'applied' as const })),
        patrol: { status: 'en_curso', targetsCompleted: 1 },
        serverTime: futuro,
      }),
    });

    await flush();
    expect((await readBundle())?.clockSkewMs).toBeGreaterThan(100_000);
  });

  it('manda las ops en el orden en que ocurrieron', async () => {
    await writeScore(P1, 1, ['11', '8']);
    await new Promise((r) => setTimeout(r, 5));
    await writeScore(P1, 2, ['X', '10', '9']);

    const enviadas: number[] = [];
    configureSync({
      post: async (ops) => {
        for (const o of ops) enviadas.push(o.targetIndex as number);
        return {
          results: ops.map((o) => ({ opId: o.opId as string, status: 'applied' as const })),
          patrol: { status: 'en_curso', targetsCompleted: 1 },
          serverTime: new Date().toISOString(),
        };
      },
    });

    await flush();
    expect(enviadas).toEqual([1, 2]);
  });
});

// ── Firmas y cierre ──────────────────────────────────────────────────────────

describe('firma', () => {
  it('guarda la firma y la encola', async () => {
    expect(await writeSignature(P1, 'data:image/png;base64,AAA')).toEqual({ ok: true });
    expect(await countOutbox()).toBe(1);

    const [op] = await readOutbox();
    expect(op?.type).toBe('signature');
  });
});

describe('requestClose', () => {
  // Cerrar con puntajes pendientes dejaría al servidor rechazando por datos
  // incompletos. Ver docs/OFFLINE_SYNC.md §5.5.
  it('BLOQUEA el cierre si hay ops pendientes', async () => {
    await writeScore(P1, 1, ['11', '8']);

    const r = await requestClose();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('PENDING_OPS');
      expect(r.pending).toBe(1);
    }
    // No se encoló ningún cierre.
    expect((await readOutbox()).filter((o) => o.type === 'close')).toHaveLength(0);
  });

  /**
   * Cuando el servidor viene rechazando, el mensaje **dice qué pasó**.
   *
   * «Buscá señal» es el consejo correcto sin conexión y es un consejo inútil
   * cuando el servidor contesta y rechaza: manda al líder a caminar buscando
   * antena por un problema que no está en la antena. El motivo ya se guardaba
   * en cada op del outbox; lo que faltaba era mostrarlo.
   */
  it('con un error del servidor, el mensaje lo dice en vez de culpar a la señal', async () => {
    await writeScore(P1, 1, ['11', '8']);

    const [op] = await readOutbox();
    if (!op) throw new Error('no se encoló nada');
    await updateOp({ ...op, attempts: 3, lastError: 'Sesión vencida.' });

    const r = await requestClose();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain('Sesión vencida.');
      expect(r.message).not.toContain('Buscá señal');
    }
  });

  // Sin motivo guardado, no hubo respuesta del servidor: ahí SÍ es la señal.
  it('sin error registrado sigue diciendo que busque señal', async () => {
    await writeScore(P1, 1, ['11', '8']);

    const r = await requestClose();
    if (!r.ok) expect(r.message).toContain('Buscá señal');
  });

  // Lo que nunca cambia: los puntajes están guardados y se dice.
  it('en los dos casos aclara que lo cargado está a salvo', async () => {
    await writeScore(P1, 1, ['11', '8']);

    const sinMotivo = await requestClose();
    if (!sinMotivo.ok) expect(sinMotivo.message).toMatch(/guardad/i);

    const [op] = await readOutbox();
    if (op) await updateOp({ ...op, lastError: 'Error 500.' });

    const conMotivo = await requestClose();
    if (!conMotivo.ok) expect(conMotivo.message).toMatch(/guardad/i);
  });
  it('encola el cierre con el outbox vacío', async () => {
    expect(await requestClose()).toEqual({ ok: true });

    const [op] = await readOutbox();
    expect(op?.type).toBe('close');
  });
});

// ── Limpieza ─────────────────────────────────────────────────────────────────

describe('clearAll', () => {
  it('borra todo al cerrar sesión', async () => {
    await writeScore(P1, 1, ['11', '8']);
    await clearAll();

    expect(await readBundle()).toBeUndefined();
    expect(await readScores()).toEqual([]);
    expect(await countOutbox()).toBe(0);
  });
});

// ── El indicador dice QUÉ pasó ───────────────────────────────────────────────

/**
 * «Hay un problema con la sincronización» no le sirve a nadie.
 *
 * El motivo ya viajaba en `lastError` del estado y el badge lo ignoraba. Con el
 * motivo a la vista, el líder puede decidir: si dice «Sesión vencida», vuelve a
 * entrar; si dice que no hay conexión, camina.
 */
describe('syncLabel', () => {
  const base = { pending: 0, lastSyncAt: null, lastError: null } as const;

  it('sincronizado no dice nada más', () => {
    expect(syncLabel({ ...base, status: 'synced' })).toBe('Sincronizado');
  });

  it('pendientes en singular y en plural', () => {
    expect(syncLabel({ ...base, status: 'pending', pending: 1 })).toMatch(/1 cambio sin/);
    expect(syncLabel({ ...base, status: 'pending', pending: 4 })).toMatch(/4 cambios sin/);
  });

  it('con error, DICE el motivo en vez de sólo avisar que lo hay', () => {
    const etiqueta = syncLabel({
      ...base,
      status: 'error',
      lastError: 'Sesión vencida. Entrá de nuevo.',
    });

    expect(etiqueta).toContain('Sesión vencida. Entrá de nuevo.');
  });

  // Sin motivo registrado no se inventa uno.
  it('con error y sin motivo, avisa igual', () => {
    expect(syncLabel({ ...base, status: 'error' })).toMatch(/problema/i);
  });

  it('sin conexión aclara que lo cargado está en el celular', () => {
    expect(syncLabel({ ...base, status: 'offline', pending: 3 })).toMatch(/en el celular/);
  });
});
