/**
 * Cuánto tarda un lote de sincronización según la latencia a la base.
 *
 * **A demanda**, no en CI: `pnpm --filter @bal/api bench:sync`. El tiempo depende
 * de la máquina y un umbral de reloj en un test sería inestable. La guarda
 * determinista es `tests/sync-viajes.test.ts`, que cuenta comandos; esto mide lo
 * que ese conteo multiplica: cada comando es una ida y vuelta, en serie.
 *
 * Cómo inyecta la latencia: un proxy TCP entre la API y el `mongod` en memoria que
 * demora cada chunk en las dos direcciones, y la API conectada con
 * `directConnection` para que no se saltee el proxy descubriendo el replica set.
 * El armado del torneo corre sin retardo; sólo se demora el lote medido.
 *
 * Qué mirar: `TECHNICAL.md` §5 fija «batch de 20 ops p95 < 400 ms». Con Railway y
 * Atlas en la misma región el RTT es de unos pocos ms; en regiones distintas, de
 * decenas.
 */

import net from 'node:net';
import type { Hono } from 'hono';
import type { CommandStartedEvent } from 'mongodb';
import { ObjectId } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const PASSWORD = 'bench-password-inicial-largo';
const PASSWORD_NUEVO = 'bench-password-nuevo-largo';

// El entorno se arma ANTES de importar nada de `src`: `env()` lo cachea al primer uso.
Object.assign(process.env, {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost:27017',
  MONGODB_DB: 'bal_bench',
  SESSION_SECRET: 'b'.repeat(48),
  PIN_ENC_KEY: '2'.repeat(64),
  ADMIN_USERNAME: 'admin',
  ADMIN_INITIAL_PASSWORD: PASSWORD,
  RATE_LIMIT_SYNC: '100000',
  RATE_LIMIT_LOGIN: '100000',
});

const { createApp } = await import('../src/app.js');
const { connect, disconnect, getClient, participants, patrols } = await import(
  '../src/db/client.js'
);
const { ensureIndexes } = await import('../src/db/indexes.js');
const { seed } = await import('../src/db/seed.js');
const { env } = await import('../src/env.js');
const { decryptPin } = await import('../src/lib/crypto.js');

// ── Proxy con retardo ────────────────────────────────────────────────────────

interface Retardo {
  /** Milisegundos que se demora cada chunk, en cada dirección. */
  ms: number;
}

interface Pendiente {
  readonly vence: number;
  readonly hacia: net.Socket;
  readonly chunk: Buffer;
}

function proxyConRetardo(
  destino: number,
  retardo: Retardo,
): Promise<{ puerto: number; cerrar(): void }> {
  /**
   * Una cola única y un bombeo por `setImmediate`, no un `setTimeout` por chunk.
   *
   * En Windows los temporizadores de Node tienen granularidad de ~15,6 ms: con un
   * RTT de 2 ms cada mitad es `setTimeout(…, 1)`, que dispara a ~15 ms, y el
   * benchmark medía 37 ms por comando en vez de 3. La demora tiene que ser la que se
   * pidió o no sirve para medir. Como el retardo es el mismo para todos los chunks,
   * una cola FIFO los saca en el orden en que entraron, en las dos direcciones.
   */
  const cola: Pendiente[] = [];
  let bombeando = false;

  const bombear = () => {
    const ahora = performance.now();
    while (cola.length > 0 && (cola[0] as Pendiente).vence <= ahora) {
      const { hacia, chunk } = cola.shift() as Pendiente;
      hacia.write(chunk);
    }
    if (cola.length > 0) setImmediate(bombear);
    else bombeando = false;
  };

  const demorar = (hacia: net.Socket, chunk: Buffer) => {
    if (retardo.ms <= 0 && cola.length === 0) {
      hacia.write(chunk);
      return;
    }
    cola.push({ vence: performance.now() + retardo.ms, hacia, chunk });
    if (!bombeando) {
      bombeando = true;
      setImmediate(bombear);
    }
  };

  return new Promise((resolver) => {
    const servidor = net.createServer((cliente) => {
      const upstream = net.connect(destino, '127.0.0.1');

      // Sin esto, Nagle más el ACK demorado de TCP le suman ~40 ms a cada mensaje
      // chico que cruza el proxy. El driver de MongoDB lo activa en sus propios
      // sockets; el proxy tiene que hacer lo mismo.
      cliente.setNoDelay(true);
      upstream.setNoDelay(true);

      cliente.on('data', (chunk) => demorar(upstream, chunk));
      upstream.on('data', (chunk) => demorar(cliente, chunk));

      for (const socket of [cliente, upstream]) {
        socket.on('error', () => undefined);
        socket.on('close', () => {
          cliente.destroy();
          upstream.destroy();
        });
      }
    });

    servidor.listen(0, '127.0.0.1', () => {
      const { port } = servidor.address() as net.AddressInfo;
      resolver({ puerto: port, cerrar: () => servidor.close() });
    });
  });
}

// ── Cliente HTTP mínimo contra la app, sin red ───────────────────────────────

const CSRF = 'c'.repeat(43);

function clienteDe(app: Hono) {
  let sesion = '';

  const post = async (ruta: string, cuerpo?: unknown): Promise<Response> => {
    const headers = new Headers({
      cookie: [`bal_csrf=${CSRF}`, sesion].filter(Boolean).join('; '),
      'x-csrf-token': CSRF,
    });
    if (cuerpo !== undefined) headers.set('content-type', 'application/json');

    const res = await app.request(`http://localhost${ruta}`, {
      method: 'POST',
      headers,
      ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}),
    });
    const set = res.headers.get('set-cookie');
    if (set?.includes('bal_session=')) sesion = set.split(';')[0] ?? '';
    return res;
  };

  return { post };
}

const jsonDe = async <T>(res: Response): Promise<T> => (await res.json()) as T;

// ── Escenario: un torneo con el recorrido más largo y una patrulla de 4 ──────

const TARGETS = Array.from({ length: 60 }, (_, i) => ({
  index: i + 1,
  modality: '3d',
  arrows: 2,
  description: null,
}));

async function prepararEscenario(app: Hono) {
  const admin = clienteDe(app);
  await admin.post('/api/auth/admin/login', { username: 'admin', password: PASSWORD });
  await admin.post('/api/auth/admin/password', {
    currentPassword: PASSWORD,
    newPassword: PASSWORD_NUEVO,
  });

  const temporada = await jsonDe<{ season: { id: string } }>(
    await admin.post('/api/admin/seasons', {
      name: 'Bench',
      startsAt: '2026-01-01',
      endsAt: '2026-12-31',
    }),
  );

  const archerIds: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const r = await jsonDe<{ archer: { id: string } }>(
      await admin.post('/api/admin/archers', {
        firstName: `Nombre${i}`,
        lastName: `Apellido${i}`,
        category: 'razo',
      }),
    );
    archerIds.push(r.archer.id);
  }

  const torneo = await jsonDe<{ tournament: { id: string } }>(
    await admin.post('/api/admin/tournaments', {
      seasonId: temporada.season.id,
      name: 'Bench',
      date: '2026-08-08',
      targets: TARGETS,
      archerIds,
    }),
  );
  await admin.post(`/api/admin/tournaments/${torneo.tournament.id}/start`);

  const patrulla = await patrols().findOne({ tournamentId: new ObjectId(torneo.tournament.id) });
  if (!patrulla) throw new Error('no se armó ninguna patrulla');
  const miembros = await participants().find({ patrolId: patrulla._id }).toArray();

  const lider = clienteDe(app);
  const login = await lider.post('/api/auth/patrol/login', {
    tournamentId: torneo.tournament.id,
    username: patrulla.username,
    pin: decryptPin(patrulla.pinEnc, env().PIN_ENC_KEY),
  });
  if (login.status !== 200) throw new Error(`login de patrulla falló: ${login.status}`);

  return { lider, participantIds: miembros.map((m) => m._id.toHexString()) };
}

// ── Medición ─────────────────────────────────────────────────────────────────

interface Medida {
  readonly rtt: number;
  readonly ops: number;
  readonly comandos: number;
  readonly ms: number;
}

const CONFIGURACIONES = [
  // Sin latencia agregada: lo que cuesta procesar, por separado de lo que cuesta viajar.
  { rtt: 0, ops: 20, repeticiones: 3 },
  // El presupuesto de TECHNICAL.md §5: 20 ops, misma región.
  { rtt: 2, ops: 20, repeticiones: 3 },
  { rtt: 30, ops: 50, repeticiones: 1 },
  { rtt: 120, ops: 50, repeticiones: 1 },
];

async function main(): Promise<void> {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const retardo: Retardo = { ms: 0 };
  const destino = Number(new URL(replSet.getUri()).port);
  const proxy = await proxyConRetardo(destino, retardo);

  try {
    const db = await connect({
      uri: `mongodb://127.0.0.1:${proxy.puerto}/?directConnection=true`,
      dbName: 'bal_bench',
      monitorCommands: true,
    });
    await ensureIndexes(db);
    await seed(db, env());

    const app = createApp();
    const { lider, participantIds } = await prepararEscenario(app);

    // Celdas (arquero × blanco) que no se repiten entre mediciones.
    const celdas = TARGETS.flatMap((t) => participantIds.map((id) => ({ id, indice: t.index })));
    let cursor = 0;

    const medidas: Medida[] = [];
    for (const { rtt, ops, repeticiones } of CONFIGURACIONES) {
      for (let r = 0; r < repeticiones; r++) {
        const lote = celdas.slice(cursor, cursor + ops).map(({ id, indice }) => ({
          type: 'score',
          opId: crypto.randomUUID(),
          clientUpdatedAt: new Date().toISOString(),
          participantId: id,
          targetIndex: indice,
          arrows: ['11', '8'],
        }));
        cursor += ops;

        let comandos = 0;
        const contar = (_: CommandStartedEvent) => {
          comandos++;
        };
        getClient().on('commandStarted', contar);

        // El retardo es de ida y de vuelta: el RTT es el doble.
        retardo.ms = rtt / 2;
        const t0 = performance.now();
        const res = await lider.post('/api/wafl/sync', { ops: lote });
        const ms = performance.now() - t0;
        retardo.ms = 0;
        getClient().off('commandStarted', contar);

        const cuerpo = await jsonDe<{ results: { status: string }[] }>(res);
        if (!cuerpo.results.every((x) => x.status === 'applied')) {
          throw new Error(
            `el lote no se aplicó entero: ${JSON.stringify(cuerpo.results.slice(0, 3))}`,
          );
        }
        medidas.push({ rtt, ops, comandos, ms });
      }
    }

    imprimir(medidas);
  } finally {
    await disconnect();
    proxy.cerrar();
    await replSet.stop();
  }
}

function imprimir(medidas: Medida[]): void {
  const peor = (valores: number[]) => Math.max(...valores);

  console.info('\nSincronización · lote de ops de score contra MongoDB con latencia inyectada\n');
  console.info('RTT a la base | ops | comandos | tiempo del lote | por op');
  console.info('--------------|-----|----------|-----------------|---------');

  const grupos = new Map<string, Medida[]>();
  for (const m of medidas)
    grupos.set(`${m.rtt}/${m.ops}`, [...(grupos.get(`${m.rtt}/${m.ops}`) ?? []), m]);

  for (const grupo of grupos.values()) {
    const primero = grupo[0];
    if (!primero) continue;
    const tiempo = peor(grupo.map((m) => m.ms));
    const etiqueta = grupo.length > 1 ? `peor de ${grupo.length}` : '1 lote';
    console.info(
      `${String(primero.rtt).padStart(9)} ms | ${String(primero.ops).padStart(3)} | ${String(primero.comandos).padStart(8)} | ${tiempo.toFixed(0).padStart(11)} ms (${etiqueta}) | ${(tiempo / primero.ops).toFixed(1)} ms`,
    );
  }

  console.info('\nPresupuesto (docs/TECHNICAL.md §5): lote de 20 ops, p95 < 400 ms, misma región.');
}

await main();
