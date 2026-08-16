import type { Db } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { participants, patrols } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import { resetEnvCache } from '../src/env.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import {
  adminListo,
  type Cliente,
  clearDb,
  crearArqueros,
  crearTemporada,
  recorridoDeReferencia,
  startDb,
  stopDb,
  testEnv,
  testEnvRaw,
} from './helpers.js';

/**
 * Eliminar una patrulla y renumerar (REF3-1).
 *
 * **El bug que motivó esta tanda, y que introduje yo en `REF2-5`.**
 *
 * `redistribute` decía en su cabecera que «no crea ni borra patrullas», y era
 * coherente hasta que agregué en la pantalla un botón de eliminar —que sólo
 * sacaba la patrulla de la vista— **y** la regla de que una patrulla vacía frena
 * el guardado. Juntas dan un bloqueo del que no se sale: se guarda, el servidor
 * deja la patrulla vacía donde estaba, la pantalla recarga y vuelve a frenar.
 */

let db: Db;

beforeAll(async () => {
  Object.assign(process.env, testEnvRaw());
  resetEnvCache();
  db = await startDb();
}, 120_000);

afterAll(async () => {
  await stopDb();
});

afterEach(() => {
  resetRateLimits();
});

beforeEach(async () => {
  await clearDb(db);
  await seed(db, testEnv());
});

interface Armado {
  readonly c: Cliente;
  readonly tournamentId: string;
}

/** Un torneo con arqueros suficientes para varias patrullas. */
async function torneoConPatrullas(): Promise<Armado> {
  const c = await adminListo();
  const seasonId = await crearTemporada(c);
  const archerIds = await crearArqueros(c, [
    ['recurvo', 3],
    ['compuesto', 4],
    ['cazador', 3],
    ['razo', 2],
  ]);

  const res = await c.post('/api/admin/tournaments', {
    seasonId,
    name: '3ª fecha',
    date: '2026-08-08',
    targets: recorridoDeReferencia(),
    archerIds,
  });

  const { tournament } = (await res.json()) as { tournament: { id: string } };
  return { c, tournamentId: tournament.id };
}

interface UnidadPlaneada {
  readonly label: 'A' | 'B';
  readonly members: string[];
}

/**
 * Arma el cuerpo de `PUT /patrols` vaciando una patrulla y **repartiendo su
 * gente de a uno** entre las que quedan, sin mencionar la vaciada.
 *
 * Es exactamente el caso del reporte: «moví los arqueros de la patrulla de 2,
 * uno a cada una de las patrullas de 3». Amontonarlos en una sola pasaría de
 * cuatro, que el schema rechaza — y el test estaría probando otra cosa.
 */
async function distribucionVaciando(vaciar: number) {
  const todas = await patrols().find({}).sort({ number: 1 }).toArray();
  const miembros = await participants().find({}).toArray();

  const vaciada = todas.find((p) => p.number === vaciar);
  if (!vaciada) throw new Error(`no existe la patrulla ${vaciar}`);

  const quedan = todas.filter((p) => p.number !== vaciar);
  const sueltos = miembros.filter((m) => m.patrolId.equals(vaciada._id));

  // Uno a cada una, empezando por la que menos tiene.
  const porPatrulla = new Map(
    quedan.map((p) => [
      p._id.toHexString(),
      miembros.filter((m) => m.patrolId.equals(p._id)).map((m) => m._id.toHexString()),
    ]),
  );

  for (const suelto of sueltos) {
    const destino = [...porPatrulla.entries()].sort((a, b) => a[1].length - b[1].length)[0];
    if (!destino) throw new Error('no quedan patrullas donde poner a nadie');
    destino[1].push(suelto._id.toHexString());
  }

  return {
    patrols: quedan.map((p, i) => {
      const propios = porPatrulla.get(p._id.toHexString()) ?? [];
      if (propios.length > 4) throw new Error(`la patrulla ${i + 1} quedó con ${propios.length}`);

      const unidades: UnidadPlaneada[] = [{ label: 'A', members: propios.slice(0, 2) }];
      if (propios.length > 2) unidades.push({ label: 'B', members: propios.slice(2) });

      return {
        id: p._id.toHexString(),
        // Renumerado, como hace la pantalla.
        number: i + 1,
        startTargetIndex: p.startTargetIndex,
        units: unidades,
      };
    }),
  };
}

describe('eliminar una patrulla', () => {
  /**
   * **El caso exacto del reporte.**
   *
   * Se vacía la última patrulla moviendo su gente a otra, se manda la
   * distribución sin mencionarla, y al recargar tiene que haber **una patrulla
   * menos**. Antes volvía a aparecer, vacía, y frenaba el guardado para siempre.
   */
  it('la patrulla que no viene en la distribución se borra', async () => {
    const { c, tournamentId } = await torneoConPatrullas();

    const antes = await patrols().countDocuments();
    expect(antes).toBeGreaterThan(2);

    const cuerpo = await distribucionVaciando(antes);

    const res = await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, cuerpo);
    expect(res.status).toBe(200);

    expect(await patrols().countDocuments()).toBe(antes - 1);

    // Y ninguna quedó vacía: es lo que frenaba el guardado.
    for (const p of await patrols().find({}).toArray()) {
      expect(await participants().countDocuments({ patrolId: p._id })).toBeGreaterThan(0);
    }
  });

  it('las que quedan se renumeran sin huecos', async () => {
    const { c, tournamentId } = await torneoConPatrullas();
    const total = await patrols().countDocuments();

    await c.put(
      `/api/admin/tournaments/${tournamentId}/patrols`,
      await distribucionVaciando(total),
    );

    const numeros = (await patrols().find({}).sort({ number: 1 }).toArray()).map((p) => p.number);
    expect(numeros).toEqual(Array.from({ length: total - 1 }, (_, i) => i + 1));
  });

  /**
   * **El usuario del líder es `patrulla` más el número.** Renumerar sin
   * actualizarlo dejaría un usuario que la botonera del login ya no ofrece.
   */
  it('el usuario acompaña al número nuevo', async () => {
    const { c, tournamentId } = await torneoConPatrullas();

    /**
     * Se elimina **la primera**, no la última.
     *
     * Con la última, ninguna patrulla cambia de número —{1,2,3,4} menos la 4 es
     * {1,2,3}— y este test pasaba sin ejercitar el renumerado: una mutación que
     * borraba la actualización del usuario no lo rompía. Lo destapó el control.
     */
    const antes = await patrols().find({}).sort({ number: 1 }).toArray();
    await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, await distribucionVaciando(1));

    const despues = await patrols().find({}).sort({ number: 1 }).toArray();

    // Alguna cambió de número de verdad, o el test no prueba nada.
    expect(despues.some((p) => antes.find((q) => q._id.equals(p._id))?.number !== p.number)).toBe(
      true,
    );

    for (const p of despues) {
      expect(p.username, `la patrulla ${p.number} quedó con otro usuario`).toBe(
        `patrulla${p.number}`,
      );
    }
  });

  /**
   * **Cada patrulla conserva SU PIN.** El PIN viaja con el grupo de arqueros,
   * no con el número: si se corriera, la planilla impresa de un grupo abriría
   * la de otro.
   */
  it('renumerar no mezcla los PIN entre patrullas', async () => {
    const { c, tournamentId } = await torneoConPatrullas();
    const total = await patrols().countDocuments();

    const antes = new Map(
      (await patrols().find({}).toArray()).map((p) => [p._id.toHexString(), p.pinEnc]),
    );

    await c.put(
      `/api/admin/tournaments/${tournamentId}/patrols`,
      await distribucionVaciando(total),
    );

    for (const p of await patrols().find({}).toArray()) {
      expect(p.pinEnc, `la patrulla ${p.number} cambió de PIN`).toEqual(
        antes.get(p._id.toHexString()),
      );
    }
  });

  /**
   * **Eliminar una del medio.** El caso que nadie probó: el cliente renumera y
   * el servidor mapeaba por número, así que los arqueros de la vieja 3 iban a
   * parar al documento de la 2 — con el PIN de la 2, ya impreso.
   */
  it('eliminar una del medio no reparte los arqueros en la patrulla equivocada', async () => {
    const { c, tournamentId } = await torneoConPatrullas();
    const total = await patrols().countDocuments();
    if (total < 3) throw new Error('hacen falta al menos tres patrullas');

    const todas = await patrols().find({}).sort({ number: 1 }).toArray();
    const tercera = todas[2];
    if (!tercera) throw new Error('no hay tercera patrulla');

    const suyos = (await participants().find({ patrolId: tercera._id }).toArray())
      .map((m) => m._id.toHexString())
      .sort();

    // Se vacía la SEGUNDA, no la última.
    await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, await distribucionVaciando(2));

    // La tercera pasó a ser la segunda, pero es el MISMO documento: su gente y
    // su PIN siguen juntos.
    const ahora = await patrols().findOne({ _id: tercera._id });
    expect(ahora?.number).toBe(2);
    expect(ahora?.pinEnc).toEqual(tercera.pinEnc);

    const deEsa = (await participants().find({ patrolId: tercera._id }).toArray())
      .map((m) => m._id.toHexString())
      .sort();
    expect(deEsa).toEqual(suyos);
  });

  it('con el torneo ya iniciado no se borra nada', async () => {
    const { c, tournamentId } = await torneoConPatrullas();
    const total = await patrols().countDocuments();
    const cuerpo = await distribucionVaciando(total);

    await c.post(`/api/admin/tournaments/${tournamentId}/start`);
    const res = await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, cuerpo);

    expect(res.status).toBe(409);
    expect(await patrols().countDocuments()).toBe(total);
  });
});
