import { type Db, ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, participants, patrols, tournaments } from '../src/db/client.js';
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
 * Crear patrullas desde la redistribución (`BE-30`, devolución de la prueba 1).
 *
 * «Si se borra alguna patrulla no hay forma de crear una nueva»: el editor sólo podía mover y
 * eliminar, y `PlannedPatrolSchema` exigía el `id` de una patrulla existente. Ahora una patrulla
 * **sin `id`** en la distribución es nueva: el servidor le crea usuario y PIN. Sólo sin iniciar.
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

async function torneoConPatrullas(): Promise<Armado> {
  const c = await adminListo();
  const seasonId = await crearTemporada(c);
  const archerIds = await crearArqueros(c, [
    ['recurvo', 3],
    ['compuesto', 4],
    ['cazador', 3],
    ['raso', 2],
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

const unidades = (ids: readonly string[]): UnidadPlaneada[] => [
  { label: 'A', members: ids.slice(0, 2) },
  ...(ids.length > 2 ? [{ label: 'B' as const, members: ids.slice(2) }] : []),
];

/**
 * La distribución actual, más **una patrulla nueva** (sin `id`) con el último arquero de cada una
 * de las dos patrullas más grandes. Numerada a continuación de las existentes, como la pantalla.
 */
async function conUnaNueva() {
  const todas = await patrols().find({}).sort({ number: 1 }).toArray();
  const miembros = await participants().find({}).toArray();

  const porPatrulla = new Map(
    todas.map((p) => [
      p._id.toHexString(),
      miembros.filter((m) => m.patrolId.equals(p._id)).map((m) => m._id.toHexString()),
    ]),
  );

  const grandes = [...porPatrulla.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 2);
  const aLaNueva = grandes.map(([, ids]) => ids.pop() as string);

  return {
    aLaNueva,
    cuerpo: {
      patrols: [
        ...todas.map((p) => ({
          id: p._id.toHexString(),
          number: p.number,
          startTargetIndex: p.startTargetIndex,
          units: unidades(porPatrulla.get(p._id.toHexString()) ?? []),
        })),
        { number: todas.length + 1, startTargetIndex: 1, units: unidades(aLaNueva) },
      ],
    },
    antes: todas,
  };
}

interface Respuesta {
  patrols: { id: string; number: number; username: string; pin?: string }[];
}

describe('una patrulla nueva en la redistribución', () => {
  it('se crea con su número, su usuario y un PIN propio, y con sus arqueros', async () => {
    const { c, tournamentId } = await torneoConPatrullas();
    const { cuerpo, aLaNueva, antes } = await conUnaNueva();

    const res = await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, cuerpo);
    expect(res.status).toBe(200);

    const { patrols: vistas } = (await res.json()) as Respuesta;
    const numero = antes.length + 1;
    const nueva = vistas.find((p) => p.number === numero);
    expect(nueva?.username).toBe(`patrulla${numero}`);
    expect(nueva?.pin).toMatch(/^\d{6}$/);

    const doc = await patrols().findOne({ number: numero });
    expect(doc).not.toBeNull();
    expect(doc?.status).toBe('pendiente');
    for (const id of aLaNueva) {
      const p = await participants().findOne({ _id: new ObjectId(id) });
      expect(p?.patrolId.equals(doc?._id as never)).toBe(true);
    }
  });

  it('las patrullas que ya estaban conservan su PIN: puede estar impreso', async () => {
    const { c, tournamentId } = await torneoConPatrullas();
    const { cuerpo, antes } = await conUnaNueva();

    await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, cuerpo);

    for (const p of antes) {
      const ahora = await patrols().findOne({ _id: p._id });
      expect(ahora?.pinHash).toBe(p.pinHash);
      expect(ahora?.pinEnc).toBe(p.pinEnc);
    }
  });

  it('el torneo cuenta la patrulla nueva', async () => {
    const { c, tournamentId } = await torneoConPatrullas();
    const { cuerpo, antes } = await conUnaNueva();

    await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, cuerpo);

    const t = await tournaments().findOne({});
    expect(t?.patrolCount).toBe(antes.length + 1);
  });

  it('queda en la auditoría cuántas se crearon', async () => {
    const { c, tournamentId } = await torneoConPatrullas();
    const { cuerpo } = await conUnaNueva();

    await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, cuerpo);

    const registro = await auditLog().findOne({ action: 'patrol.manual_edit' });
    expect(registro?.meta.created).toBe(1);
  });

  it('una patrulla repetida en la distribución da 400 y no toca nada', async () => {
    const { c, tournamentId } = await torneoConPatrullas();
    const { cuerpo, antes } = await conUnaNueva();
    const [primera] = cuerpo.patrols;
    if (!primera) throw new Error('fixture');
    // La nueva pasa a decir que es la primera: dos entradas con el mismo id.
    const repetida = {
      ...cuerpo,
      patrols: [...cuerpo.patrols.slice(0, -1), { ...cuerpo.patrols.at(-1), id: primera.id }],
    };

    const res = await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, repetida);

    expect(res.status).toBe(400);
    expect(await patrols().countDocuments()).toBe(antes.length);
  });

  it('con el torneo en marcha no se puede: 409 y no se crea nada', async () => {
    const { c, tournamentId } = await torneoConPatrullas();
    await c.post(`/api/admin/tournaments/${tournamentId}/start`);
    const { cuerpo, antes } = await conUnaNueva();

    const res = await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, cuerpo);

    expect(res.status).toBe(409);
    expect(await patrols().countDocuments()).toBe(antes.length);
  });
});
