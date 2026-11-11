import type { CommandStartedEvent } from 'mongodb';
import { ObjectId } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getClient, getDb, tournaments } from '../src/db/client.js';
import type { TournamentDoc } from '../src/db/types.js';
import { resetEnvCache } from '../src/env.js';
import { clearDb, cliente, startDb, stopDb, testEnvRaw } from './helpers.js';

/**
 * El listado público de torneos (`REF6-13` / `P-6`).
 *
 * Traía hasta 200 torneos completos —con todos sus blancos— y recién después filtraba por estado en
 * memoria, teniendo el índice `ix_status_date`. Además el `limit(200)` iba **antes** del filtro: con
 * 200 torneos recientes sin publicar, los públicos quedaban afuera del listado.
 */

beforeAll(async () => {
  Object.assign(process.env, testEnvRaw());
  resetEnvCache();
  await startDb({ monitorCommands: true });
}, 120_000);

afterAll(async () => {
  await stopDb();
});

beforeEach(async () => {
  await clearDb(getDb());
});

let dia = 0;

/** Un torneo mínimo: sólo lo que el listado público lee. Cada uno, un día después del anterior. */
function torneo(status: TournamentDoc['status'], name = `Torneo ${status}`) {
  dia++;
  return {
    _id: new ObjectId(),
    name,
    date: new Date(Date.UTC(2026, 0, dia)),
    status,
    targets: [
      { index: 1, modality: 'sala', arrows: 3, description: null },
      { index: 2, modality: '3d', arrows: 2, description: null },
    ],
    participantCount: 4,
    // Lo que el listado no necesita y no tiene por qué traerse.
    stakeMap: { raso: 'azul' },
    description: 'una descripción larga',
    payment: { required: true, amount: 5000 },
  } as unknown as TournamentDoc;
}

const listar = async () => {
  const res = await cliente().get('/api/public/tournaments');
  return (await res.json()) as {
    tournaments: { id: string; name: string; status: string; targetCount: number }[];
  };
};

describe('GET /api/public/tournaments', () => {
  it('sólo trae los publicados y los que están en proceso, el más nuevo primero', async () => {
    await tournaments().insertMany([
      torneo('sin_iniciar', 'A'),
      torneo('publicado', 'B'),
      torneo('completado', 'C'),
      torneo('en_proceso', 'D'),
    ]);

    const { tournaments: lista } = await listar();

    expect(lista.map((t) => t.name)).toEqual(['D', 'B']);
  });

  it('arma cada fila con lo de siempre', async () => {
    await tournaments().insertOne(torneo('publicado', 'Fecha 3'));

    const [fila] = (await listar()).tournaments;

    expect(fila).toMatchObject({ name: 'Fecha 3', status: 'publicado', targetCount: 2 });
  });

  // El defecto de fondo: el límite se aplicaba antes de filtrar.
  it('los torneos sin publicar no desplazan a los públicos del listado', async () => {
    await tournaments().insertMany([torneo('publicado', 'Viejo público')]);
    await tournaments().insertMany(Array.from({ length: 210 }, () => torneo('sin_iniciar')));

    const { tournaments: lista } = await listar();

    expect(lista.map((t) => t.name)).toEqual(['Viejo público']);
  });

  it('filtra por estado en la consulta y trae sólo los campos que usa', async () => {
    await tournaments().insertMany([torneo('publicado'), torneo('sin_iniciar')]);

    const consultas: CommandStartedEvent[] = [];
    const alEmpezar = (e: CommandStartedEvent) => {
      if (e.commandName === 'find' && e.command.find === 'tournaments') consultas.push(e);
    };
    getClient().on('commandStarted', alEmpezar);
    try {
      await listar();
    } finally {
      getClient().off('commandStarted', alEmpezar);
    }

    expect(consultas).toHaveLength(1);
    const { filter, projection } = (consultas[0] as CommandStartedEvent).command as {
      filter: Record<string, unknown>;
      projection: Record<string, number>;
    };
    expect(filter).toHaveProperty('status');
    expect(Object.keys(projection ?? {}).sort()).toEqual(
      ['date', 'name', 'participantCount', 'status', 'targets'].sort(),
    );
  });
});
