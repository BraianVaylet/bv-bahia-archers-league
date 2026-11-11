import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/apiClient.js';
import {
  clearAll,
  closeDb,
  countOutbox,
  deleteDb,
  getDb,
  readBundle,
  readOutbox,
  readScore,
  readScores,
  readSignatures,
  type StoredBundle,
  saveBundle,
  updateOp,
} from './db.js';
import { ahoraCorregido, requestClose, uuidv7, writeScore, writeSignature } from './outbox.js';
import {
  configureSync,
  flush,
  getSyncState,
  resetSyncWorker,
  startSyncWorker,
} from './syncWorker.js';
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
      category: 'raso',
      stake: 'azul',
      unit: 'A',
      position: 'izquierda',
    },
    {
      id: P2,
      firstName: 'Ana',
      lastName: 'Gómez',
      category: 'raso',
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

  /**
   * `REF6-4` / `U-3`. Sacar la op del outbox no alcanza: el puntaje local seguía
   * en `pending` con las flechas que **perdieron**, y `sembrarPuntajes` nunca pisa
   * lo que no está `synced`. El celular que perdía el last-write-wins mostraba
   * para siempre un número que no era el del servidor, y el arquero firmaba
   * mirándolo.
   */
  describe('el celular alinea su pantalla con lo que el servidor tiene', () => {
    const vigente = {
      total: 22,
      innerCount: 2,
      xCount: 0,
      tenCount: 0,
      mCount: 0,
      arrows: ['11', '11'],
    };

    const respondiendo = (status: 'superseded' | 'duplicate', score?: typeof vigente) =>
      configureSync({
        post: async (ops) => ({
          results: ops.map((o) => ({
            opId: o.opId as string,
            status,
            ...(score ? { score } : {}),
          })),
          patrol: { status: 'en_curso', targetsCompleted: 0 },
          serverTime: new Date().toISOString(),
        }),
      });

    it.each(['superseded', 'duplicate'] as const)(
      '`%s` deja las flechas y los totales del servidor, ya sincronizados',
      async (status) => {
        await writeScore(P1, 1, ['5', '5']);
        expect((await readScore(P1, 1))?.total).toBe(10);

        respondiendo(status, vigente);
        await flush();

        expect(await readScore(P1, 1)).toMatchObject({
          arrows: ['11', '11'],
          total: 22,
          innerCount: 2,
          syncState: 'synced',
        });
        expect(await countOutbox()).toBe(0);
      },
    );

    // Un rechazo previo marcó el puntaje con su motivo. Si el servidor ya tiene
    // otra cosa y el celular la adopta, el motivo viejo no puede quedarse pegado.
    it('limpia el error que hubiera quedado marcado', async () => {
      await writeScore(P1, 1, ['5', '5']);
      const db = await (await import('./db.js')).getDb();
      const previo = await db.get('scores', [P1, 1]);
      if (!previo) throw new Error('el puntaje tendría que existir: se acaba de escribir');
      await db.put('scores', { ...previo, syncState: 'conflict', error: 'viejo' });

      respondiendo('superseded', vigente);
      await flush();

      const despues = await readScore(P1, 1);
      expect(despues?.syncState).toBe('synced');
      expect(despues?.error).toBeUndefined();
    });

    /**
     * Si el líder volvió a editar el blanco mientras el lote viajaba, esa edición
     * es **más nueva** que lo que el servidor devuelve: pisarla la perdería.
     */
    it('NO pisa una edición más nueva que todavía está en camino', async () => {
      await writeScore(P1, 1, ['5', '5']);

      let llamadas = 0;
      configureSync({
        post: async (ops) => {
          llamadas++;
          if (llamadas === 1) {
            // El líder corrige el blanco mientras el primer lote está en el aire.
            const edicion = await writeScore(P1, 1, ['8', '8']);
            // Si esta edición no entrara, el test no probaría nada.
            expect(edicion.ok).toBe(true);
          }
          return {
            results: ops.map((o) =>
              llamadas === 1
                ? { opId: o.opId as string, status: 'superseded' as const, score: vigente }
                : { opId: o.opId as string, status: 'applied' as const },
            ),
            patrol: { status: 'en_curso', targetsCompleted: 0 },
            serverTime: new Date().toISOString(),
          };
        },
      });

      await flush();

      expect(llamadas).toBe(2);
      expect((await readScore(P1, 1))?.arrows).toEqual(['8', '8']);
    });

    // Un servidor viejo, o un `duplicate` de una firma, no manda `score`.
    it('sin `score` en la respuesta no toca nada y la op igual sale', async () => {
      await writeScore(P1, 1, ['5', '5']);

      respondiendo('duplicate');
      await flush();

      expect((await readScore(P1, 1))?.arrows).toEqual(['5', '5']);
      expect(await countOutbox()).toBe(0);
    });
  });

  /**
   * `REF6-4` / `P-2`. Con señal intermitente un POST puede quedar colgado
   * minutos. Mientras tanto `corriendo` está en `true` y **ningún otro disparador
   * puede vaciar el outbox**, aunque la señal haya vuelto: el evento `online`, el
   * intervalo y el foco llaman a `flush()` y salen de inmediato. Se prueba con el
   * transporte real, no con `configureSync`: el plazo vive ahí.
   */
  describe('el POST de sync tiene plazo', () => {
    const PLAZO_MS = 20_000;

    // Un servidor que no contesta nunca, pero que respeta la cancelación. Devuelve
    // las señales que recibió cada pedido: que se haya cancelado o no es lo que
    // dice si el plazo corrió, sin depender de cuánto tarda IndexedDB.
    const sinRespuesta = () => {
      const señales: AbortSignal[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            const señal = init?.signal;
            if (!señal) return;
            señales.push(señal);
            señal.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      );
      return señales;
    };

    // Un servidor que acepta todo lo que le mandan.
    const aceptandoTodo = () =>
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        const { ops } = JSON.parse(String(init?.body)) as { ops: { opId: string }[] };
        return new Response(
          JSON.stringify({
            results: ops.map((o) => ({ opId: o.opId, status: 'applied' })),
            patrol: { status: 'en_curso', targetsCompleted: 1 },
            serverTime: new Date().toISOString(),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      });

    // `setImmediate` no está falseado: deja correr a `fake-indexeddb` entre vuelta y vuelta.
    const hastaQue = async (condicion: () => boolean | Promise<boolean>) => {
      for (let i = 0; i < 500 && !(await condicion()); i++) {
        await new Promise<void>((r) => setImmediate(r));
      }
    };

    beforeEach(() => {
      // Sólo los temporizadores: `fake-indexeddb` agenda con `setImmediate`.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      // Con la cookie puesta no se pide el token CSRF, que es otro `fetch`.
      // biome-ignore lint/suspicious/noDocumentCookie: `apiClient` lee el token CSRF de `document.cookie`; en jsdom es la única forma de dejarlo puesto.
      document.cookie = 'bal_csrf=token-de-prueba';
    });

    it('si el servidor no contesta en 20 s se corta, y la op se queda para reintentar', async () => {
      const señales = sinRespuesta();
      await writeScore(P1, 1, ['11', '8']);

      const vaciado = flush();
      // El reloj corre recién cuando el pedido ya salió: antes no hay plazo que medir.
      await hastaQue(() => señales.length > 0);
      await vi.advanceTimersByTimeAsync(PLAZO_MS);

      expect(señales[0]?.aborted).toBe(true);
      expect(await vaciado).toBe(false);
      expect(await countOutbox()).toBe(1);
      expect((await readOutbox())[0]?.attempts).toBe(1);
    });

    it('un POST colgado no traba el outbox: cuando vuelve la señal, se vacía', async () => {
      const señales = sinRespuesta();
      await writeScore(P1, 1, ['11', '8']);

      const vaciado = flush();
      await hastaQue(() => señales.length > 0);
      await vi.advanceTimersByTimeAsync(PLAZO_MS);
      await vaciado;

      // Vuelve la señal. El reintento programado tiene que poder entrar: antes del
      // plazo, `corriendo` quedaba en `true` y ningún disparador podía vaciar.
      aceptandoTodo();
      await vi.advanceTimersByTimeAsync(60_000);
      await hastaQue(async () => (await countOutbox()) === 0);

      expect(await countOutbox()).toBe(0);
    });

    it('antes del plazo no corta: un servidor lento pero vivo tiene tiempo', async () => {
      const señales = sinRespuesta();
      await writeScore(P1, 1, ['11', '8']);

      const vaciado = flush();
      await hastaQue(() => señales.length > 0);

      await vi.advanceTimersByTimeAsync(PLAZO_MS - 1_000);
      expect(señales[0]?.aborted).toBe(false);

      await vi.advanceTimersByTimeAsync(2_000);
      expect(señales[0]?.aborted).toBe(true);

      await vaciado;
    });
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
        throw new ApiError(401, 'UNAUTHORIZED', 'Tu sesión venció.');
      },
    });

    await flush();
    // Se conservan para enviarlas después de reautenticar.
    expect(await countOutbox()).toBe(1);
  });

  it('un 500 se reintenta: el servidor puede estar volviendo', async () => {
    await writeScore(P1, 1, ['11', '8']);

    configureSync({
      post: async () => {
        throw new ApiError(500, 'INTERNAL', 'Ocurrió un error inesperado.');
      },
    });

    await flush();
    expect(await countOutbox()).toBe(1);
    expect((await readOutbox())[0]?.attempts).toBe(1);
  });

  /**
   * **El outbox trabado para siempre.**
   *
   * Probando la WAFL en local aparecieron cuatro ops de firma con 32 a 38
   * intentos, todas con «Los datos enviados no son válidos.»: un 400 de Zod.
   * El `catch` del vaciado trataba cualquier rechazo como error de red y lo
   * reintentaba indefinidamente. Un 400 **nunca** va a pasar por reintentarlo,
   * así que el circuito no se podía cerrar nunca.
   *
   * La op sale del outbox —como ya pasaba con `rejected`— pero el dato NO se
   * pierde: queda en `signatures` marcado en conflicto, con el motivo.
   */
  it('un 400 deja de reintentarse y destraba el outbox', async () => {
    await writeSignature(P1, `data:image/png;base64,${'A'.repeat(100)}`);

    configureSync({
      post: async () => {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.');
      },
    });

    await flush();

    expect(await countOutbox()).toBe(0);

    const firma = (await readSignatures()).find((f) => f.participantId === P1);
    expect(firma?.syncState).toBe('conflict');
    expect(getSyncState().lastError).toContain('no son válidos');
  });

  it('con un lote, aísla la op mala y sincroniza las buenas', async () => {
    await writeScore(P1, 1, ['11', '8']);
    await writeSignature(P2, 'data:image/png;base64,rota');

    const ok = (ops: Record<string, unknown>[]) => ({
      results: ops.map((o) => ({
        opId: o.opId as string,
        status: 'applied' as const,
        // El servidor es la autoridad del puntaje: siempre devuelve el total.
        score: { total: 19, innerCount: 1, xCount: 0, tenCount: 0, mCount: 0 },
      })),
      patrol: { status: 'en_curso', targetsCompleted: 0 },
      serverTime: new Date().toISOString(),
    });

    configureSync({
      post: async (ops) => {
        // El servidor rechaza el lote ENTERO por una sola op mala: es lo que
        // hace la validación de Zod sobre el array de ops.
        if (ops.some((o) => o.type === 'signature')) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.');
        }
        return ok(ops);
      },
    });

    await flush();

    // El puntaje bueno no puede quedar rehén de la firma rota.
    expect(await countOutbox()).toBe(0);
    expect((await readScore(P1, 1))?.syncState).toBe('synced');
    expect((await readSignatures()).find((f) => f.participantId === P2)?.syncState).toBe(
      'conflict',
    );
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
  /**
   * `REF6-4`. El mensaje decía «El servidor respondió: …» ante cualquier error
   * guardado, y el último intento puede no haber tenido respuesta: un `Failed to
   * fetch`, o el corte por plazo. «El servidor respondió: El servidor no
   * respondió a tiempo» se contradice a sí mismo, justo en la pantalla del líder
   * que no puede cerrar el circuito.
   */
  it('si el último intento no tuvo respuesta, no dice que el servidor respondió', async () => {
    await writeScore(P1, 1, ['11', '8']);

    const [op] = await readOutbox();
    if (!op) throw new Error('no se encoló nada');
    await updateOp({ ...op, attempts: 1, lastError: 'El servidor no respondió a tiempo.' });

    const r = await requestClose();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain('El servidor no respondió a tiempo.');
      expect(r.message).not.toContain('El servidor respondió');
    }
  });

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
/**
 * **Textos cortos desde `ref-7`** (los de `docs/post/ref-7/DISENO.md` §6, consultado con el autor):
 * la píldora vive en el encabezado de WAFL al lado de «← Blancos», y los largos truncaban la
 * patrulla y el torneo a 390px. Lo que no se pierde: el motivo del error y cuántos quedaron
 * guardados.
 */
describe('syncLabel', () => {
  const base = { pending: 0, lastSyncAt: null, lastError: null } as const;

  it('al día no dice nada más', () => {
    expect(syncLabel({ ...base, status: 'synced' })).toBe('Al día');
  });

  it('pendientes: cuántos faltan enviar', () => {
    expect(syncLabel({ ...base, status: 'pending', pending: 1 })).toBe('1 por enviar');
    expect(syncLabel({ ...base, status: 'pending', pending: 4 })).toBe('4 por enviar');
  });

  it('con error, DICE el motivo en vez de sólo avisar que lo hay', () => {
    const etiqueta = syncLabel({
      ...base,
      status: 'error',
      lastError: 'Sesión vencida. Entrá de nuevo.',
    });

    expect(etiqueta).toBe('No se pudo enviar · Sesión vencida. Entrá de nuevo.');
  });

  // Sin motivo registrado no se inventa uno.
  it('con error y sin motivo, avisa igual', () => {
    expect(syncLabel({ ...base, status: 'error' })).toBe('No se pudo enviar');
  });

  /** Sin señal no es un error: dice cuántos quedaron guardados, que es lo que tranquiliza. */
  it('sin señal dice cuántos quedaron guardados', () => {
    expect(syncLabel({ ...base, status: 'offline', pending: 3 })).toBe('Sin señal · 3 guardados');
  });
});

// ── REF6-9 · Las ramas que nadie probaba ─────────────────────────────────────

/**
 * `REF6-9` / `T-1`. La cobertura de ramas de `offline/` estaba en 76 %, bajo el 85 %
 * que `TESTING.md` §8 exige, y **nadie lo sabía porque el CI no medía**. Es la capa
 * donde viven `U-3` y `P-2`. Lo que sigue son los caminos que ningún test recorría,
 * y cada uno es un comportamiento, no una línea: qué pasa sin recorrido descargado,
 * qué pasa con la red caída *mientras* se aísla la op culpable, qué dispara el worker.
 */
describe('sin recorrido descargado', () => {
  // El líder abre la app, nunca descargó el recorrido, y toca un blanco. No hay
  // contra qué validar ni de qué torneo es: no se escribe nada y se le dice por qué.
  it('un puntaje no se guarda ni se encola', async () => {
    await deleteDb();

    const r = await writeScore(P1, 1, ['11', '8']);

    expect(r).toMatchObject({ ok: false, code: 'NO_BUNDLE' });
    expect(await countOutbox()).toBe(0);
    expect(await readScore(P1, 1)).toBeUndefined();
  });

  it('una firma tampoco', async () => {
    await deleteDb();

    const r = await writeSignature(P1, 'data:image/png;base64,AAA');

    expect(r).toMatchObject({ ok: false, code: 'NO_BUNDLE' });
    expect(await countOutbox()).toBe(0);
    expect(await readSignatures()).toEqual([]);
  });

  it('el reloj corregido es el del dispositivo, sin desfase que aplicar', async () => {
    await deleteDb();

    const antes = Date.now();
    const ahora = await ahoraCorregido();

    expect(ahora).toBeGreaterThanOrEqual(antes);
    expect(ahora).toBeLessThanOrEqual(Date.now());
  });
});

describe('mensajes en singular', () => {
  it('un blanco de una flecha dice «flecha», no «flechas»', async () => {
    await saveBundle(
      bundle({
        tournament: {
          ...bundle().tournament,
          targets: [{ index: 1, modality: '3d', arrows: 1, description: null }],
        },
      }),
    );

    const r = await writeScore(P1, 1, ['11', '8']);

    expect(r).toMatchObject({ ok: false, code: 'ARROW_COUNT' });
    expect(r.ok ? '' : r.message).toBe('Este blanco es de 1 flecha.');
  });

  it('sin señal, un solo cambio guardado, y ninguno', () => {
    const base = { lastSyncAt: null, lastError: null, status: 'offline' } as const;

    expect(syncLabel({ ...base, pending: 1 })).toBe('Sin señal · 1 guardado');
    expect(syncLabel({ ...base, pending: 0 })).toBe('Sin señal');
  });
});

describe('aislar la op culpable con la red caída', () => {
  const respuestaOk = (ops: Record<string, unknown>[]) => ({
    results: ops.map((o) => ({
      opId: o.opId as string,
      status: 'applied' as const,
      score: { total: 19, innerCount: 1, xCount: 0, tenCount: 0, mCount: 0 },
    })),
    patrol: { status: 'en_curso', targetsCompleted: 0 },
    serverTime: new Date().toISOString(),
  });

  /**
   * El servidor rechaza el lote entero por una op mala, y al reenviar de a una la red
   * se cae justo con otra. Esa op **no era la culpable**: se queda en el outbox para
   * el próximo intento. Descartarla por un corte de señal sería perder trabajo por
   * una suposición, que es lo único que el outbox no puede hacer.
   */
  it('una op que falla por la red durante el aislamiento no se descarta', async () => {
    await writeScore(P1, 1, ['11', '8']);
    await writeScore(P2, 1, ['10', '8']);
    await writeSignature(P1, 'data:image/png;base64,rota');

    let vez = 0;
    configureSync({
      post: async (ops) => {
        vez++;
        // 1.º: el lote entero, rechazado por la firma rota.
        if (vez === 1)
          throw new ApiError(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.');
        // Al reenviar de a una: el puntaje de P1 se cae por la red, el de P2 pasa y la
        // firma sigue siendo rechazada.
        const [op] = ops;
        if (op?.type === 'score' && op.participantId === P1) throw new TypeError('Failed to fetch');
        if (op?.type === 'signature') {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.');
        }
        return respuestaOk(ops);
      },
    });

    await flush();

    const quedan = await readOutbox();
    // Sólo el puntaje de P1 sigue: con un intento anotado, para el backoff.
    expect(quedan).toHaveLength(1);
    expect(quedan[0]?.type).toBe('score');
    expect(quedan[0]?.payload.participantId).toBe(P1);
    expect(quedan[0]?.attempts).toBeGreaterThan(0);

    expect((await readScore(P2, 1))?.syncState).toBe('synced');
    expect((await readSignatures()).find((f) => f.participantId === P1)?.syncState).toBe(
      'conflict',
    );
  });

  // `fetch` puede tirar cualquier cosa, no sólo un `Error`.
  it('un error que no es un Error igual queda registrado como motivo', async () => {
    await writeScore(P1, 1, ['11', '8']);

    configureSync({
      post: async () => {
        throw 'sin señal';
      },
    });

    await flush();

    expect(await countOutbox()).toBe(1);
    expect((await readOutbox())[0]?.lastError).toBe('sin señal');
  });
});

describe('lo que el servidor contesta sobre ops que no son de un puntaje', () => {
  // Lo que el servidor contesta, sin atarse al tipo interno del worker.
  type Respuesta = Awaited<ReturnType<Parameters<typeof configureSync>[0]['post']>>;
  const ok = (ops: Record<string, unknown>[], extra: Record<string, unknown>) =>
    ({
      results: ops.map((o) => ({ opId: o.opId as string, ...extra })),
      patrol: { status: 'en_curso', targetsCompleted: 0 },
      serverTime: new Date().toISOString(),
    }) as unknown as Respuesta;

  // Un cierre no tiene arquero ni blanco: rechazado, no hay dónde dejar la marca de
  // conflicto, y eso no puede romper el resto del lote.
  it('un cierre rechazado sale del outbox y avisa, sin buscar un puntaje', async () => {
    await requestClose();
    configureSync({
      post: async (ops) =>
        ok(ops, {
          status: 'rejected',
          error: { code: 'SIGNATURES_MISSING', message: 'Faltan firmas.' },
        }),
    });
    // `requestClose` exige el outbox vacío para encolar: ya quedó encolado.
    await flush();

    expect(await countOutbox()).toBe(0);
    expect(getSyncState().status).toBe('error');
    expect(getSyncState().lastError).toBe('Faltan firmas.');
  });

  it('una firma aplicada con puntaje en la respuesta no toca ningún puntaje', async () => {
    // Un puntaje ya sincronizado, que no está en el outbox.
    await writeScore(P2, 1, ['10', '8']);
    configureSync({
      post: async (ops) =>
        ok(ops, {
          status: 'applied',
          score: { total: 18, innerCount: 0, xCount: 0, tenCount: 1, mCount: 0 },
        }),
    });
    await flush();
    const antes = await readScore(P2, 1);

    // Ahora una firma, y el servidor contesta con un `score` que no le corresponde.
    await writeSignature(P1, 'data:image/png;base64,AAA');
    configureSync({
      post: async (ops) =>
        ok(ops, {
          status: 'applied',
          score: { total: 999, innerCount: 9, xCount: 9, tenCount: 9, mCount: 9 },
        }),
    });
    await flush();

    expect(await countOutbox()).toBe(0);
    expect(await readScore(P2, 1)).toEqual(antes);
    expect((await readScores()).every((p) => p.total !== 999)).toBe(true);
  });

  it('un `duplicate` de una firma con flechas en la respuesta no inventa un puntaje', async () => {
    await writeSignature(P1, 'data:image/png;base64,AAA');

    configureSync({
      post: async (ops) =>
        ok(ops, {
          status: 'duplicate',
          score: {
            arrows: ['5', '5'],
            total: 10,
            innerCount: 0,
            xCount: 0,
            tenCount: 0,
            mCount: 0,
          },
        }),
    });
    await flush();

    expect(await countOutbox()).toBe(0);
    expect(await readScores()).toEqual([]);
  });

  // El líder pudo haber borrado el dato local (cerrar sesión en otra pestaña): el
  // total del servidor no puede resucitar un puntaje que ya no está.
  it('un puntaje aplicado cuya fila local ya no existe no se vuelve a crear', async () => {
    await writeScore(P1, 1, ['11', '8']);
    const db = await getDb();
    await db.delete('scores', [P1, 1]);

    configureSync({
      post: async (ops) =>
        ok(ops, {
          status: 'applied',
          score: { total: 19, innerCount: 1, xCount: 0, tenCount: 0, mCount: 0 },
        }),
    });
    await flush();

    expect(await readScore(P1, 1)).toBeUndefined();
    expect(await countOutbox()).toBe(0);
  });

  // Sin recorrido guardado no hay desfase de reloj que recalcular, y no se inventa uno.
  it('sin recorrido descargado, sincronizar no crea uno', async () => {
    await writeScore(P1, 1, ['11', '8']);
    await (await getDb()).delete('bundle', 'current');

    configureSync({
      post: async (ops) =>
        ok(ops, {
          status: 'applied',
          score: { total: 19, innerCount: 1, xCount: 0, tenCount: 0, mCount: 0 },
        }),
    });
    await flush();

    expect(await readBundle()).toBeUndefined();
  });
});

describe('los disparadores del worker', () => {
  let detener: () => void = () => {};
  const llamadas: number[] = [];

  beforeEach(() => {
    llamadas.length = 0;
    configureSync({
      post: async (ops) => {
        llamadas.push(ops.length);
        return {
          results: ops.map((o) => ({
            opId: o.opId as string,
            status: 'applied' as const,
            score: { total: 19, innerCount: 1, xCount: 0, tenCount: 0, mCount: 0 },
          })),
          patrol: { status: 'en_curso', targetsCompleted: 0 },
          serverTime: new Date().toISOString(),
        };
      },
    });
    detener = startSyncWorker();
  });

  afterEach(() => {
    detener();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('al volver la señal pasa a «pendiente» y vacía el outbox', async () => {
    await writeScore(P1, 1, ['11', '8']);

    window.dispatchEvent(new Event('online'));

    await vi.waitFor(() => expect(llamadas).toEqual([1]));
    expect(await countOutbox()).toBe(0);
  });

  it('al perder la señal lo dice, sin tocar el outbox', async () => {
    await writeScore(P1, 1, ['11', '8']);

    window.dispatchEvent(new Event('offline'));

    expect(getSyncState().status).toBe('offline');
    expect(llamadas).toEqual([]);
    expect(await countOutbox()).toBe(1);
  });

  it('al recuperar el foco sincroniza, y con la pestaña oculta no', async () => {
    await writeScore(P1, 1, ['11', '8']);

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 20));
    expect(llamadas).toEqual([]);

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(llamadas).toEqual([1]));
  });

  it('una vez detenido, la señal ya no dispara nada', async () => {
    detener();
    await writeScore(P1, 1, ['11', '8']);

    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 20));

    expect(llamadas).toEqual([]);
  });
});

describe('el intervalo del worker', () => {
  afterEach(() => vi.useRealTimers());

  // Es la red de seguridad: si ningún evento avisó (el navegador no siempre manda
  // `online`), cada 30 s se mira el outbox y, si hay algo, se intenta.
  it('cada 30 s sincroniza lo pendiente, y si no hay nada no manda nada', async () => {
    const llamadas: number[] = [];
    configureSync({
      post: async (ops) => {
        llamadas.push(ops.length);
        return {
          results: ops.map((o) => ({
            opId: o.opId as string,
            status: 'applied' as const,
            score: { total: 19, innerCount: 1, xCount: 0, tenCount: 0, mCount: 0 },
          })),
          patrol: { status: 'en_curso', targetsCompleted: 0 },
          serverTime: new Date().toISOString(),
        };
      },
    });

    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    const detener = startSyncWorker();

    // Con el outbox vacío no hay request.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(llamadas).toEqual([]);

    await writeScore(P1, 1, ['11', '8']);
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.waitFor(() => expect(llamadas).toEqual([1]));

    detener();
  });
});

// ── El servidor que no devuelve el resultado de una op ───────────────────────

/**
 * `flush()` volvía a leer el outbox después de cada respuesta. Una op sin resultado en
 * la respuesta se saltaba (`continue`) sin sacarla, sin contar un intento y sin marcar
 * nada, así que la vuelta siguiente la leía de nuevo y la mandaba de nuevo, **sin
 * pausa ni backoff**. Un servidor que cumple el contrato devuelve un resultado por op
 * y esto no pasa; pasa con un desfase de versiones —la PWA se actualiza con `prompt`,
 * así que hay celulares con el cliente viejo durante días—, o con un proxy que altere
 * la respuesta.
 *
 * Lo único que frenaba el bucle era el 429 del rate limit (300 por minuto y por IP),
 * y el wifi del club es una sola IP: un celular así dejaba sin cuota a las demás
 * patrullas. Ahora una op sin resultado es un intento fallido, como un corte de red:
 * se anota, se corta la vuelta y se reintenta con backoff. **Nunca se descarta**: el
 * puntaje es del líder, y que el servidor no lo haya contestado no lo vuelve basura.
 */
describe('un servidor que no devuelve el resultado de una op', () => {
  type Respuesta = Awaited<ReturnType<Parameters<typeof configureSync>[0]['post']>>;

  const respuesta = (results: Record<string, unknown>[]) =>
    ({
      results,
      patrol: { status: 'en_curso', targetsCompleted: 0 },
      serverTime: new Date().toISOString(),
    }) as unknown as Respuesta;

  const aplicada = (opId: unknown) => ({
    opId,
    status: 'applied',
    score: { total: 19, innerCount: 1, xCount: 0, tenCount: 0, mCount: 0 },
  });

  /**
   * Un servidor de mentira con un tope: si el cliente insiste más de `TOPE` veces,
   * contesta 429, como haría el rate limit real. Sin el tope, el bucle de antes no
   * terminaría nunca y el test colgaría en vez de fallar.
   */
  const TOPE = 5;
  let pedidos: number;
  const servidor = (cuando: (n: number, ops: Record<string, unknown>[]) => Respuesta) =>
    configureSync({
      post: async (ops) => {
        pedidos++;
        if (pedidos > TOPE) throw new ApiError(429, 'RATE_LIMITED', 'Demasiados pedidos.');
        return cuando(pedidos, ops);
      },
    });

  beforeEach(() => {
    pedidos = 0;
    // Sólo los temporizadores: `fake-indexeddb` agenda con `setImmediate`. El
    // reintento con backoff queda armado y no se dispara solo.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => vi.useRealTimers());

  it('no la reenvía sin pausa: un solo pedido, y la op sigue ahí con un intento', async () => {
    await writeScore(P1, 1, ['11', '8']);
    servidor(() => respuesta([]));

    expect(await flush()).toBe(false);

    expect(pedidos).toBe(1);
    const [op] = await readOutbox();
    expect(op?.attempts).toBe(1);
    // El motivo queda a la vista: es lo que lee `requestClose` para explicarle al líder
    // por qué falta sincronizar.
    expect(op?.lastError).toMatch(/no devolvió/i);
    expect((await readScore(P1, 1))?.syncState).toBe('pending');
  });

  it('con un lote parcial, la op con resultado sale y la omitida se queda', async () => {
    await writeScore(P1, 1, ['11', '8']);
    await writeScore(P2, 1, ['10', '8']);
    // Se contesta por **arquero**, no por posición: dos puntajes escritos en el mismo
    // milisegundo empatan en el uuid v7 y el orden en el outbox no está garantizado.
    servidor((_, ops) =>
      respuesta(ops.filter((o) => o.participantId === P1).map((o) => aplicada(o.opId))),
    );

    expect(await flush()).toBe(false);

    expect(pedidos).toBe(1);
    const quedan = await readOutbox();
    expect(quedan).toHaveLength(1);
    expect(quedan[0]?.payload.participantId).toBe(P2);
    expect(quedan[0]?.attempts).toBe(1);
    expect((await readScore(P1, 1))?.syncState).toBe('synced');
  });

  // No se abandona: con backoff, se vuelve a intentar, y si ahora el servidor contesta,
  // la op sale.
  it('reintenta con backoff, y cuando el servidor contesta la op sale', async () => {
    await writeScore(P1, 1, ['11', '8']);
    servidor((n, ops) => (n === 1 ? respuesta([]) : respuesta(ops.map((o) => aplicada(o.opId)))));

    await flush();
    expect(pedidos).toBe(1);

    // El reintento corre solo, después de la espera.
    await vi.advanceTimersByTimeAsync(60_000);
    for (let i = 0; i < 500 && pedidos < 2; i++) await new Promise<void>((r) => setImmediate(r));
    for (let i = 0; i < 500 && (await countOutbox()) > 0; i++) {
      await new Promise<void>((r) => setImmediate(r));
    }

    expect(pedidos).toBe(2);
    expect(await countOutbox()).toBe(0);
    expect((await readScore(P1, 1))?.syncState).toBe('synced');
  });

  it('por más veces que pase, la op no se descarta', async () => {
    await writeScore(P1, 1, ['11', '8']);
    servidor(() => respuesta([]));

    await flush();
    await flush();
    await flush();

    expect(pedidos).toBe(3);
    const [op] = await readOutbox();
    expect(op?.attempts).toBe(3);
    expect(await countOutbox()).toBe(1);
  });

  // Aislando la op culpable de un lote rechazado, una que el servidor no contesta
  // tampoco puede quedar sin anotar: es la misma situación en otro camino.
  it('al aislar un lote rechazado, la op sin resultado también cuenta un intento', async () => {
    await writeScore(P1, 1, ['11', '8']);
    await writeScore(P2, 1, ['10', '8']);

    servidor((n, ops) => {
      if (n === 1)
        throw new ApiError(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.');
      // Una por una: la de P1 sin resultado, la de P2 aplicada.
      const [op] = ops;
      return op?.participantId === P1 ? respuesta([]) : respuesta([aplicada(op?.opId)]);
    });

    await flush();

    const quedan = await readOutbox();
    expect(quedan).toHaveLength(1);
    expect(quedan[0]?.payload.participantId).toBe(P1);
    expect(quedan[0]?.attempts).toBe(1);
    expect(quedan[0]?.lastError).toMatch(/no devolvió/i);
  });
});
