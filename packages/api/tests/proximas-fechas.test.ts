import { distribucionDeModalidades, hoyEnArgentina } from '@bal/shared';
import { ObjectId } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getDb, tournaments } from '../src/db/client.js';
import type { TournamentDoc } from '../src/db/types.js';
import { resetEnvCache } from '../src/env.js';
import { clearDb, cliente, startDb, stopDb, testEnvRaw } from './helpers.js';

/**
 * Próximas fechas (`BE-28`): los torneos que todavía no arrancaron y son de hoy en adelante.
 *
 * Es la primera vez que la landing ve un torneo `sin_iniciar` (decisión 7 de la Fase 9). Sale
 * **sólo la convocatoria**: nombre, fecha, descripción, link de pre-inscripción, inscripción,
 * cuántos blancos y qué modalidades. Nunca quién está anotado ni cómo se arman las patrullas.
 */

beforeAll(async () => {
  Object.assign(process.env, testEnvRaw());
  resetEnvCache();
  await startDb();
}, 120_000);

afterAll(async () => {
  await stopDb();
});

beforeEach(async () => {
  await clearDb(getDb());
});

const DIA = 86_400_000;

/** El día de hoy en Bahía Blanca más `dias`, como la API guarda una fecha. */
const enDias = (dias: number) => new Date(hoyEnArgentina(new Date()).getTime() + dias * DIA);

/** Un torneo con todo lo que el endpoint NO debe sacar, para ver que no lo saca. */
function torneo(name: string, date: Date, status: TournamentDoc['status'] = 'sin_iniciar') {
  return {
    _id: new ObjectId(),
    seasonId: new ObjectId(),
    name,
    date,
    status,
    description: 'Se larga 9:30 en el predio.',
    registrationUrl: 'https://forms.gle/AbCdEf123',
    payment: { required: true, amount: 5000 },
    targets: [
      { index: 1, modality: 'sala', arrows: 3, description: null },
      { index: 2, modality: '3d', arrows: 2, description: null },
      { index: 3, modality: '3d', arrows: 2, description: null },
    ],
    maxPossibleScore: 74,
    stakeMap: { roja: ['recurvo'], azul: [], amarilla: [], naranja: [] },
    distances: null,
    patrolCount: 3,
    participantCount: 11,
    createdAt: new Date(),
    startedAt: null,
    completedAt: null,
    publishedAt: null,
    publishedBy: null,
  } as TournamentDoc;
}

interface Proxima {
  readonly [clave: string]: unknown;
  readonly name: string;
}

const proximas = async () => {
  const res = await cliente().get('/api/public/tournaments/upcoming');
  expect(res.status).toBe(200);
  return ((await res.json()) as { tournaments: Proxima[] }).tournaments;
};

describe('GET /api/public/tournaments/upcoming', () => {
  it('trae los sin iniciar de hoy en adelante, el más cercano primero', async () => {
    await tournaments().insertMany([
      torneo('En dos semanas', enDias(14)),
      torneo('Hoy', enDias(0)),
      torneo('Ayer', enDias(-1)),
      torneo('Mañana', enDias(1)),
    ]);

    expect((await proximas()).map((t) => t.name)).toEqual(['Hoy', 'Mañana', 'En dos semanas']);
  });

  /** Uno que ya arrancó está en «En curso»; uno publicado, en los resultados. */
  it('no trae los que ya arrancaron, aunque su fecha sea futura', async () => {
    await tournaments().insertMany([
      torneo('En proceso', enDias(3), 'en_proceso'),
      torneo('Publicado', enDias(3), 'publicado'),
      torneo('Completado', enDias(3), 'completado'),
      torneo('Sin iniciar', enDias(3)),
    ]);

    expect((await proximas()).map((t) => t.name)).toEqual(['Sin iniciar']);
  });

  /**
   * **Lista blanca.** Cada clave que sale está nombrada acá: una clave nueva en el documento no
   * puede filtrarse a la landing por accidente.
   */
  it('saca sólo la convocatoria: nada de participantes, patrullas ni estacas', async () => {
    const doc = torneo('3ª fecha', enDias(5));
    await tournaments().insertOne(doc);

    const [fila] = await proximas();

    expect(fila).toEqual({
      id: doc._id.toHexString(),
      name: '3ª fecha',
      date: doc.date.toISOString(),
      description: 'Se larga 9:30 en el predio.',
      registrationUrl: 'https://forms.gle/AbCdEf123',
      payment: { required: true, amount: 5000 },
      targetCount: 3,
      // El mismo formato que el listado público, para que la landing reuse la barra.
      modalities: distribucionDeModalidades(['sala', '3d', '3d']),
    });
  });

  it('un torneo viejo sin link lo trae en null', async () => {
    const doc = torneo('Sin link', enDias(2)) as Partial<TournamentDoc>;
    delete doc.registrationUrl;
    await tournaments().insertOne(doc as TournamentDoc);

    expect((await proximas())[0]?.registrationUrl).toBeNull();
  });

  it('trae a lo sumo seis', async () => {
    await tournaments().insertMany(
      Array.from({ length: 8 }, (_, i) => torneo(`Fecha ${i + 1}`, enDias(i + 1))),
    );

    const lista = await proximas();
    expect(lista).toHaveLength(6);
    expect(lista.at(-1)?.name).toBe('Fecha 6');
  });

  it('sin próximos torneos devuelve una lista vacía', async () => {
    expect(await proximas()).toEqual([]);
  });

  /** Un torneo sin iniciar sigue sin tener ficha pública: sólo sale en este listado. */
  it('el detalle público de un sin iniciar sigue dando 404', async () => {
    const doc = torneo('3ª fecha', enDias(5));
    await tournaments().insertOne(doc);

    const res = await cliente().get(`/api/public/tournaments/${doc._id.toHexString()}`);
    expect(res.status).toBe(404);
  });
});
