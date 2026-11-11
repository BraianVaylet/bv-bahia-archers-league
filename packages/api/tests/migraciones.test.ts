import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrarCategoriaRazoARaso } from '../src/db/migraciones.js';
import { COLLECTIONS } from '../src/db/types.js';
import { clearDb, startDb, stopDb } from './helpers.js';

/**
 * Migración de la clave de categoría `razo` → `raso` (2026-11-11).
 *
 * La categoría no es sólo una etiqueta: es la clave que se guarda en Mongo. Un
 * documento que quedara con `razo` rompe la UI (`CATEGORY_INFO['razo']` es
 * `undefined`) y desaparece en silencio de podios y rankings, que agrupan por
 * `BOW_CATEGORIES`. Por eso se migra al arrancar, y por eso tiene que ser
 * idempotente: corre en cada arranque.
 */

let db: Db;

beforeAll(async () => {
  db = await startDb();
}, 120_000);

afterAll(async () => {
  await stopDb();
});

beforeEach(async () => {
  await clearDb(db);
});

const coleccion = (nombre: string) => db.collection(nombre);

async function sembrarDatosViejos() {
  const tournamentId = new ObjectId();
  await coleccion(COLLECTIONS.archers).insertMany([
    { firstName: 'Ana', category: 'razo' },
    { firstName: 'Beto', category: 'recurvo' },
  ]);
  await coleccion(COLLECTIONS.participants).insertMany([
    { tournamentId, archerId: new ObjectId(), category: 'razo' },
    { tournamentId, archerId: new ObjectId(), category: 'longbow' },
  ]);
  await coleccion(COLLECTIONS.standings).insertOne({
    seasonId: new ObjectId(),
    archerId: new ObjectId(),
    category: 'razo',
  });
  await coleccion(COLLECTIONS.tournaments).insertOne({
    _id: tournamentId,
    stakeMap: {
      roja: ['recurvo', 'compuesto', 'cazador', 'razo'],
      azul: ['razo', 'tradicional', 'longbow'],
      amarilla: ['escuela'],
      naranja: ['principiantes'],
    },
  });
  return tournamentId;
}

describe('migrarCategoriaRazoARaso', () => {
  it('reemplaza la clave vieja en arqueros, participantes, standings y mapas de estaca', async () => {
    const tournamentId = await sembrarDatosViejos();

    await migrarCategoriaRazoARaso(db);

    const categorias = async (nombre: string) =>
      (await coleccion(nombre).find().toArray()).map((d) => d.category).sort();

    expect(await categorias(COLLECTIONS.archers)).toEqual(['raso', 'recurvo']);
    expect(await categorias(COLLECTIONS.participants)).toEqual(['longbow', 'raso']);
    expect(await categorias(COLLECTIONS.standings)).toEqual(['raso']);

    const torneo = await coleccion(COLLECTIONS.tournaments).findOne({ _id: tournamentId });
    expect(torneo?.stakeMap).toEqual({
      roja: ['recurvo', 'compuesto', 'cazador', 'raso'],
      azul: ['raso', 'tradicional', 'longbow'],
      amarilla: ['escuela'],
      naranja: ['principiantes'],
    });
  });

  it('informa cuántos documentos tocó por colección', async () => {
    await sembrarDatosViejos();

    const resultado = await migrarCategoriaRazoARaso(db);

    expect(resultado).toEqual({ archers: 1, participants: 1, standings: 1, tournaments: 1 });
  });

  it('migra un torneo viejo cuyo mapa no tiene todas las estacas', async () => {
    // Un torneo creado antes de que existiera una estaca no la tiene en el mapa.
    // Un update con `$[filtro]` sobre una ruta que no existe falla en Mongo.
    const _id = new ObjectId();
    await coleccion(COLLECTIONS.tournaments).insertOne({
      _id,
      stakeMap: { roja: ['recurvo'], azul: ['razo'], amarilla: ['escuela'] },
    });

    await migrarCategoriaRazoARaso(db);

    const torneo = await coleccion(COLLECTIONS.tournaments).findOne({ _id });
    expect(torneo?.stakeMap).toEqual({
      roja: ['recurvo'],
      azul: ['raso'],
      amarilla: ['escuela'],
    });
  });

  it('es idempotente: la segunda corrida no toca nada', async () => {
    await sembrarDatosViejos();
    await migrarCategoriaRazoARaso(db);

    const segunda = await migrarCategoriaRazoARaso(db);

    expect(segunda).toEqual({ archers: 0, participants: 0, standings: 0, tournaments: 0 });
  });

  it('con la base vacía no falla', async () => {
    expect(await migrarCategoriaRazoARaso(db)).toEqual({
      archers: 0,
      participants: 0,
      standings: 0,
      tournaments: 0,
    });
  });
});
