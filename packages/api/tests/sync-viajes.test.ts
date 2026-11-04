import type { CommandStartedEvent } from 'mongodb';
import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getClient, participants, patrols } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import { resetEnvCache } from '../src/env.js';
import { decryptPin } from '../src/lib/crypto.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import {
  adminListo,
  clearDb,
  cliente,
  crearArqueros,
  crearTemporada,
  recorridoDeReferencia,
  startDb,
  stopDb,
  testEnv,
  testEnvRaw,
} from './helpers.js';

/**
 * Cuántos viajes a la base cuesta sincronizar (`REF6-5` / `P-1`).
 *
 * Cada comando que el driver manda es una ida y vuelta, **en serie**: con Railway
 * y Atlas en regiones distintas, cada una cuesta decenas de milisegundos, y la
 * patrulla que vuelve del monte con tres horas de puntajes manda el lote entero
 * de una vez. Lo que se mide acá no es tiempo —depende de la máquina— sino
 * **cantidad de comandos**, que es lo que el tiempo multiplica por la latencia.
 * El tiempo con latencia inyectada se mide aparte, a demanda: `bench/sync.ts`.
 *
 * Ver `docs/TECHNICAL.md` §5 y `docs/CONFIG.md` §7.
 */

let uuidN = 0;
const uuid = () => `0192f3a1-8c4e-7000-9abc-${String(++uuidN).padStart(12, '0')}`;

beforeAll(async () => {
  Object.assign(process.env, testEnvRaw());
  resetEnvCache();
  await startDb({ monitorCommands: true });
}, 120_000);

afterAll(async () => {
  await stopDb();
});

afterEach(() => resetRateLimits());

beforeEach(async () => {
  await clearDb((await import('../src/db/client.js')).getDb());
  await seed((await import('../src/db/client.js')).getDb(), testEnv());
});

// ── Andamiaje ────────────────────────────────────────────────────────────────

/** Fichas válidas por modalidad, para armar puntajes sin pensar en cada una. */
const FICHAS: Record<string, string[]> = {
  '3d': ['11', '8'],
  campo: ['6', '5', '4'],
  aire_libre: ['X', '10', '9', '8', '7', '6'],
  sala: ['X', '10', '9'],
};

const TARGETS = recorridoDeReferencia();

interface Escenario {
  readonly lider: ReturnType<typeof cliente>;
  readonly participantIds: string[];
  readonly patrolId: ObjectId;
}

/** Un torneo de 14 blancos con una patrulla de 4, iniciado y con el líder adentro. */
async function escenario(): Promise<Escenario> {
  const admin = await adminListo();
  const seasonId = await crearTemporada(admin);
  const archerIds = await crearArqueros(admin, [['razo', 4]]);

  const res = await admin.post('/api/admin/tournaments', {
    seasonId,
    name: 'Torneo',
    date: '2026-08-08',
    targets: TARGETS,
    archerIds,
  });
  const tournamentId = ((await res.json()) as { tournament: { id: string } }).tournament.id;
  await admin.post(`/api/admin/tournaments/${tournamentId}/start`);

  const patrulla = await patrols().findOne({ tournamentId: new ObjectId(tournamentId) });
  if (!patrulla) throw new Error('no se armó ninguna patrulla');
  const miembros = await participants().find({ patrolId: patrulla._id }).toArray();

  const lider = cliente();
  const login = await lider.post('/api/auth/patrol/login', {
    tournamentId,
    username: patrulla.username,
    pin: decryptPin(patrulla.pinEnc, testEnv().PIN_ENC_KEY),
  });
  if (login.status !== 200) throw new Error(`login de patrulla falló: ${login.status}`);

  return {
    lider,
    participantIds: miembros.map((m) => m._id.toHexString()),
    patrolId: patrulla._id,
  };
}

const opScore = (participantId: string, targetIndex: number, arrows: string[]) => ({
  type: 'score' as const,
  opId: uuid(),
  clientUpdatedAt: new Date().toISOString(),
  participantId,
  targetIndex,
  arrows,
});

/**
 * `cantidad` celdas (arquero × blanco) del recorrido a partir de la `desde`, con
 * fichas válidas. Celdas distintas no se pisan: se pueden mandar lotes seguidos
 * al mismo escenario sin que uno compita con otro.
 */
function opsDeScore(e: Escenario, cantidad: number, desde = 0) {
  const todas = TARGETS.flatMap((blanco) =>
    e.participantIds.map((participantId) =>
      opScore(participantId, blanco.index, FICHAS[blanco.modality] ?? []),
    ),
  );
  return todas.slice(desde, desde + cantidad);
}

interface RespuestaDeSync {
  results: { status: string }[];
  patrol: { targetsCompleted: number };
}

const sincronizar = async (e: Escenario, ops: unknown[]): Promise<RespuestaDeSync> =>
  (await (await e.lider.post('/api/wafl/sync', { ops })).json()) as RespuestaDeSync;

/** Los comandos que el driver manda mientras corre `fn`, en orden. */
async function comandosDe(fn: () => Promise<unknown>): Promise<string[]> {
  const nombres: string[] = [];
  const alEmpezar = (evento: CommandStartedEvent) => {
    nombres.push(evento.commandName);
  };

  getClient().on('commandStarted', alEmpezar);
  try {
    await fn();
  } finally {
    getClient().off('commandStarted', alEmpezar);
  }
  return nombres;
}

const resumen = (nombres: string[]) =>
  Object.entries(
    nombres.reduce<Record<string, number>>((acc, n) => {
      acc[n] = (acc[n] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([nombre, veces]) => `${nombre}×${veces}`)
    .join(' ');

// ── Los viajes ───────────────────────────────────────────────────────────────

describe('viajes a la base por lote de sincronización', () => {
  /**
   * Por op de score aplicada: dedup (1), participante (1), puntaje vigente (1),
   * escritura del puntaje (1), rollups (1) y commit (1) — **6**. Y por lote, lo
   * que no depende de cuántas ops traiga: el torneo, la patrulla, el recálculo
   * del avance (en su propia transacción corta) y la patrulla de nuevo para
   * responder. Desde `REF6-13` / `B-4` también **un** `updateMany` que confirma las
   * ops aplicadas: la marca de dedup nace `processing` y se confirma por lote, no
   * por op, justamente para no volver a pagar un viaje por cada score.
   *
   * Antes el avance de la patrulla se recalculaba **dentro de cada op**: dos
   * listas y un `updateOne` (3 comandos) por cada score, y los rollups usaban
   * dos comandos en vez de uno. 10 por op.
   */
  const POR_OP = 6;
  const POR_LOTE = 9;

  it('un lote de 20 ops cuesta a lo sumo 6 comandos por op más lo fijo del lote', async () => {
    const e = await escenario();
    const ops = opsDeScore(e, 20);

    let respuesta: RespuestaDeSync | undefined;
    const comandos = await comandosDe(async () => {
      respuesta = await sincronizar(e, ops);
    });

    // Que el lote se haya aplicado entero: contar viajes de un lote rechazado no dice nada.
    expect(respuesta?.results.map((r) => r.status)).toEqual(Array(20).fill('applied'));

    const limite = POR_LOTE + POR_OP * 20;
    expect(
      comandos.length,
      `${comandos.length} comandos: ${resumen(comandos)}`,
    ).toBeLessThanOrEqual(limite);
  });

  it('el costo por op no crece con el tamaño del lote', async () => {
    const e = await escenario();
    const chico = await comandosDe(() => sincronizar(e, opsDeScore(e, 4, 0)));
    const grande = await comandosDe(() => sincronizar(e, opsDeScore(e, 40, 4)));

    // 36 ops más tienen que costar a lo sumo 6 comandos cada una.
    expect(grande.length - chico.length).toBeLessThanOrEqual(POR_OP * 36);
  });
});

// ── El avance de la patrulla sigue exacto ────────────────────────────────────

describe('el avance de la patrulla, calculado una vez por lote', () => {
  const avanceEnLaBase = async (e: Escenario) =>
    (await patrols().findOne({ _id: e.patrolId }))?.targetsCompleted;

  /** Los cuatro arqueros en un blanco, con fichas válidas. */
  const blancoDeTodos = (e: Escenario, indice: number, excepto: string[] = []) => {
    const blanco = TARGETS.find((t) => t.index === indice);
    return e.participantIds
      .filter((id) => !excepto.includes(id))
      .map((id) => opScore(id, indice, FICHAS[blanco?.modality ?? ''] ?? []));
  };

  /**
   * Un blanco cuenta como completo cuando **todos** los arqueros de la patrulla
   * lo tienen. En un lote mixto una op mala no puede dejar el avance sin
   * recalcular: las buenas del mismo lote cambiaron lo que hay que contar.
   */
  it('un lote mixto, con una op rechazada, deja el avance exacto', async () => {
    const e = await escenario();
    const [a0] = e.participantIds as [string];

    const respuesta = await sincronizar(e, [
      ...blancoDeTodos(e, 1),
      // El blanco 2: a0 manda una ficha que no existe en el blanco, y los otros tres bien.
      opScore(a0, 2, ['99', '99']),
      ...blancoDeTodos(e, 2, [a0]),
    ]);

    // La premisa: hay exactamente un rechazo y siete aplicadas.
    expect(respuesta.results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(respuesta.results.filter((r) => r.status === 'applied')).toHaveLength(7);

    // El blanco 1 está completo; el 2 le falta a a0.
    expect(respuesta.patrol.targetsCompleted).toBe(1);
    expect(await avanceEnLaBase(e)).toBe(1);

    // El lote siguiente completa el blanco 2.
    const siguiente = await sincronizar(e, [
      opScore(a0, 2, FICHAS[TARGETS[1]?.modality ?? ''] ?? []),
    ]);
    expect(siguiente.patrol.targetsCompleted).toBe(2);
    expect(await avanceEnLaBase(e)).toBe(2);
  });

  /**
   * El recálculo ya no es parte de la transacción de cada op: si el proceso muere
   * entre los commits y el recálculo, el avance queda desactualizado. El reenvío
   * del lote —que el cliente hace solo, porque no recibió respuesta— tiene que
   * repararlo aunque todas sus ops vuelvan como `duplicate`.
   */
  it('reenviar un lote ya aplicado repara un avance desactualizado', async () => {
    const e = await escenario();
    const ops = blancoDeTodos(e, 1);

    await sincronizar(e, ops);
    expect(await avanceEnLaBase(e)).toBe(1);

    // Se simula la muerte del proceso entre los commits y el recálculo.
    await patrols().updateOne({ _id: e.patrolId }, { $set: { targetsCompleted: 0 } });

    const reenvio = await sincronizar(e, ops);

    expect(reenvio.results.every((r) => r.status === 'duplicate')).toBe(true);
    expect(reenvio.patrol.targetsCompleted).toBe(1);
    expect(await avanceEnLaBase(e)).toBe(1);
  });

  it('un lote que no cambia ningún puntaje no recalcula nada', async () => {
    const e = await escenario();

    const comandos = await comandosDe(() =>
      sincronizar(e, [opScore(e.participantIds[0] as string, 1, ['99', '99'])]),
    );

    // Un rechazo no tiene nada que contar: ni las dos listas del recálculo ni la
    // escritura del avance. Quedan cinco lecturas, las de cualquier lote: la sesión,
    // el torneo, la patrulla, el arquero de la op y la patrulla de nuevo para responder.
    expect(comandos.filter((c) => c === 'find').length, resumen(comandos)).toBeLessThanOrEqual(5);
  });
});
