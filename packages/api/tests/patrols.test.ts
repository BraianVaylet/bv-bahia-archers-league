import type { BowCategory } from '@bal/shared';
import type { Db } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { auditLog, participants } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import { resetEnvCache } from '../src/env.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import { clearDb, startDb, stopDb, testEnv, testEnvRaw } from './helpers.js';

/**
 * Redistribución manual de patrullas (BE-15).
 *
 * El admin conoce el terreno y puede tener motivos para una excepción, así que
 * la redistribución **avisa pero no bloquea**. Lo que sí bloquea es perder un
 * arquero: la operación exige la lista completa.
 *
 * Ver `docs/FUNCTIONAL.md` §6.6.
 */

const PASSWORD = 'password-de-test-1234';
const CSRF = 'c'.repeat(43);
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
  vi.restoreAllMocks();
});

beforeEach(async () => {
  await clearDb(db);
  await seed(db, testEnv());
});

// ── Cliente ──────────────────────────────────────────────────────────────────

function cliente() {
  const app = createApp();
  let sesion = '';

  const pedir = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers);
    headers.set('cookie', [`bal_csrf=${CSRF}`, sesion].filter(Boolean).join('; '));
    headers.set('x-csrf-token', CSRF);
    if (init.body) headers.set('content-type', 'application/json');

    const res = await app.request(`http://localhost${path}`, { ...init, headers });
    const set = res.headers.get('set-cookie');
    if (set?.includes('bal_session=')) sesion = set.split(';')[0] ?? '';
    return res;
  };

  return {
    get: (p: string) => pedir(p),
    post: (p: string, body?: unknown) =>
      pedir(p, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) }),
    put: (p: string, body: unknown) => pedir(p, { method: 'PUT', body: JSON.stringify(body) }),
  };
}

async function adminListo() {
  const c = cliente();
  await c.post('/api/auth/admin/login', { username: 'admin', password: PASSWORD });
  await c.post('/api/auth/admin/password', {
    currentPassword: PASSWORD,
    newPassword: 'un-password-nuevo-largo',
  });
  return c;
}

// ── Escenario ────────────────────────────────────────────────────────────────

interface Miembro {
  id: string;
  lastName: string;
  category: string;
  unit: string;
  position: string;
}

interface Patrulla {
  id: string;
  number: number;
  startTargetIndex: number;
  username: string;
  members: Miembro[];
}

async function crearArqueros(c: ReturnType<typeof cliente>, defs: [BowCategory, number][]) {
  const creados: string[] = [];
  let n = 0;

  for (const [category, cantidad] of defs) {
    for (let i = 0; i < cantidad; i++) {
      n++;
      const res = await c.post('/api/admin/archers', {
        firstName: `Nombre${n}`,
        lastName: `Apellido${String(n).padStart(3, '0')}`,
        category,
      });
      creados.push(((await res.json()) as { archer: { id: string } }).archer.id);
    }
  }

  return creados;
}

/** Torneo con 3 razo y 3 longbow sobre 4 blancos: dos patrullas, de 4 y de 2. */
async function torneoConPatrullas(c: ReturnType<typeof cliente>) {
  const temporada = await c.post('/api/admin/seasons', {
    name: 'Liga 2026',
    startsAt: '2026-01-01',
    endsAt: '2026-12-31',
  });
  const seasonId = ((await temporada.json()) as { season: { id: string } }).season.id;

  const archerIds = await crearArqueros(c, [
    ['razo', 3],
    ['longbow', 3],
  ]);

  const res = await c.post('/api/admin/tournaments', {
    seasonId,
    name: 'Torneo de prueba',
    date: '2026-08-08',
    targets: [1, 2, 3, 4].map((index) => ({
      index,
      modality: 'sala',
      arrows: 3,
      description: null,
    })),
    archerIds,
  });

  const tournamentId = ((await res.json()) as { tournament: { id: string } }).tournament.id;
  return { tournamentId, archerIds };
}

async function leerPatrullas(c: ReturnType<typeof cliente>, tournamentId: string) {
  const res = await c.get(`/api/admin/tournaments/${tournamentId}/patrols`);
  return (await res.json()) as { patrols: Patrulla[]; violations: { code: string }[] };
}

/**
 * Parte una lista de arqueros en unidades.
 *
 * Una unidad son **1 o 2** arqueros, así que una patrulla de 4 se expresa como
 * dos unidades. No es un detalle del transporte: es la regla de tiro, y una
 * patrulla no puede pasar de dos unidades.
 */
function enUnidades(lista: readonly string[]) {
  const b = lista.slice(2, 4);
  return [
    { label: 'A' as const, members: lista.slice(0, 2) },
    ...(b.length > 0 ? [{ label: 'B' as const, members: b }] : []),
  ];
}

/** Distribución que deja todo como está. */
function talCual(patrullas: readonly Patrulla[]) {
  return {
    patrols: patrullas.map((p) => ({
      number: p.number,
      startTargetIndex: p.startTargetIndex,
      units: enUnidades(p.members.map((m) => m.id)),
    })),
  };
}

/** Los ids de una patrulla, en el orden en que vinieron. */
const ids = (p: Patrulla) => p.members.map((m) => m.id);

/** Una distribución con la unidad A mezclando razo y longbow: viola `H2`. */
function conUnidadMezclada(patrols: Patrulla[]) {
  const todos = patrols.flatMap((p) => p.members);
  const razo = todos.filter((m) => m.category === 'razo');
  const longbow = todos.filter((m) => m.category === 'longbow');
  const [p1, p2] = patrols as [Patrulla, Patrulla];

  return {
    patrols: [
      {
        number: p1.number,
        startTargetIndex: p1.startTargetIndex,
        units: enUnidades([
          razo[0]?.id as string,
          longbow[0]?.id as string,
          razo[1]?.id as string,
          longbow[1]?.id as string,
        ]),
      },
      {
        number: p2.number,
        startTargetIndex: p2.startTargetIndex,
        units: enUnidades([razo[2]?.id as string, longbow[2]?.id as string]),
      },
    ],
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('redistribución de patrullas', () => {
  it('mueve un arquero de una patrulla a otra', async () => {
    const c = await adminListo();
    const { tournamentId } = await torneoConPatrullas(c);
    const { patrols } = await leerPatrullas(c, tournamentId);

    const [p1, p2] = patrols as [Patrulla, Patrulla];
    const mudado = ids(p1)[0] as string;

    const res = await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, {
      patrols: [
        {
          number: p1.number,
          startTargetIndex: p1.startTargetIndex,
          units: enUnidades(ids(p1).slice(1)),
        },
        {
          number: p2.number,
          startTargetIndex: p2.startTargetIndex,
          units: enUnidades([...ids(p2), mudado]),
        },
      ],
    });

    expect(res.status).toBe(200);

    const despues = await leerPatrullas(c, tournamentId);
    expect(despues.patrols.find((p) => p.number === p2.number)?.members.map((m) => m.id)).toContain(
      mudado,
    );
    // Uno menos de los que tenía, sin dar por sentado cuántos armó el algoritmo.
    expect(despues.patrols.find((p) => p.number === p1.number)?.members).toHaveLength(
      p1.members.length - 1,
    );
    expect(despues.patrols.find((p) => p.number === p2.number)?.members).toHaveLength(
      p2.members.length + 1,
    );
  });

  it('la posición sale del ORDEN de la unidad, no de lo que mande el cliente', async () => {
    const c = await adminListo();
    const { tournamentId } = await torneoConPatrullas(c);
    const { patrols } = await leerPatrullas(c, tournamentId);
    const [p1] = patrols as [Patrulla];

    const [a, b, ...resto] = ids(p1) as [string, string, ...string[]];

    await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, {
      patrols: [
        {
          number: p1.number,
          startTargetIndex: p1.startTargetIndex,
          // Invertidos respecto de como estaban.
          units: enUnidades([b, a, ...resto]),
        },
        ...talCual(patrols.slice(1)).patrols,
      ],
    });

    const despues = await leerPatrullas(c, tournamentId);
    const unidadA = despues.patrols
      .find((p) => p.number === p1.number)
      ?.members.filter((m) => m.unit === 'A');

    // La posición es un dato derivado, no una opinión del cliente.
    expect(unidadA?.find((m) => m.id === b)?.position).toBe('izquierda');
    expect(unidadA?.find((m) => m.id === a)?.position).toBe('derecha');
  });

  it('cambia el blanco de inicio de una patrulla', async () => {
    const c = await adminListo();
    const { tournamentId } = await torneoConPatrullas(c);
    const { patrols } = await leerPatrullas(c, tournamentId);

    const distribucion = talCual(patrols);
    const primera = distribucion.patrols[0];
    if (primera) Object.assign(primera, { startTargetIndex: 4 });

    await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, distribucion);

    expect((await leerPatrullas(c, tournamentId)).patrols[0]?.startTargetIndex).toBe(4);
  });

  // Es el error que rompe el torneo en silencio: un arquero sin patrulla no
  // aparece en ninguna planilla y nadie se entera hasta que ya se está tirando.
  it('RECHAZA una distribución a la que le falta un arquero, y dice a quién', async () => {
    const c = await adminListo();
    const { tournamentId } = await torneoConPatrullas(c);
    const { patrols } = await leerPatrullas(c, tournamentId);
    const [p1, p2] = patrols as [Patrulla, Patrulla];

    const res = await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, {
      patrols: [
        {
          number: p1.number,
          startTargetIndex: p1.startTargetIndex,
          units: enUnidades(ids(p1)),
        },
        {
          number: p2.number,
          startTargetIndex: p2.startTargetIndex,
          units: enUnidades(ids(p2).slice(1)),
        },
      ],
    });

    expect(res.status).toBe(400);
    const cuerpo = (await res.json()) as { error: { code: string; message: string } };
    expect(cuerpo.error.code).toBe('VALIDATION_ERROR');
    expect(cuerpo.error.message).toMatch(/Faltan arqueros/);
    expect(cuerpo.error.message).toMatch(p2.members[0]?.lastName ?? 'x');
  });

  it('rechaza un participante que no es de este torneo', async () => {
    const c = await adminListo();
    const primero = await torneoConPatrullas(c);
    const segundo = await torneoConPatrullas(c);

    const { patrols } = await leerPatrullas(c, primero.tournamentId);
    const ajeno = (await leerPatrullas(c, segundo.tournamentId)).patrols[0]?.members[0]
      ?.id as string;

    // Se cambia un miembro por el ajeno, no se agrega una unidad: una patrulla
    // admite dos, y una tercera la rechazaría el schema antes de llegar acá.
    const distribucion = talCual(patrols);
    const unidad = distribucion.patrols[0]?.units[0];
    if (unidad) Object.assign(unidad, { members: [ajeno] });

    const res = await c.put(`/api/admin/tournaments/${primero.tournamentId}/patrols`, distribucion);

    expect(res.status).toBe(400);
    // No se filtra si el id existe en otro lado: desde acá, sencillamente no
    // pertenece a este torneo.
    expect(((await res.json()) as { error: { message: string } }).error.message).toMatch(
      /no participan de este torneo/,
    );
  });

  it('rechaza un número de patrulla que no existe en el torneo', async () => {
    const c = await adminListo();
    const { tournamentId } = await torneoConPatrullas(c);
    const { patrols } = await leerPatrullas(c, tournamentId);

    const distribucion = talCual(patrols);
    const primera = distribucion.patrols[0];
    if (primera) Object.assign(primera, { number: 99 });

    const res = await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, distribucion);

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { message: string } }).error.message).toMatch(
      /La patrulla 99 no existe/,
    );
  });

  it('rechaza un blanco de inicio que no existe en el recorrido', async () => {
    const c = await adminListo();
    const { tournamentId } = await torneoConPatrullas(c);
    const { patrols } = await leerPatrullas(c, tournamentId);

    const distribucion = talCual(patrols);
    const primera = distribucion.patrols[0];
    // El recorrido tiene 4 blancos.
    if (primera) Object.assign(primera, { startTargetIndex: 9 });

    const res = await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, distribucion);

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { message: string } }).error.message).toMatch(
      /el recorrido tiene 4/,
    );
  });

  // El admin conoce el terreno. La excepción se registra, no se impide.
  it('AVISA pero NO bloquea una unidad con categorías mezcladas', async () => {
    const c = await adminListo();
    const { tournamentId } = await torneoConPatrullas(c);
    const { patrols } = await leerPatrullas(c, tournamentId);

    const res = await c.put(
      `/api/admin/tournaments/${tournamentId}/patrols`,
      conUnidadMezclada(patrols),
    );

    expect(res.status).toBe(200);
    const cuerpo = (await res.json()) as { violations: { code: string }[] };
    expect(cuerpo.violations.some((v) => v.code === 'MIXED_UNIT')).toBe(true);

    // Y quedó guardado: avisar no es deshacer.
    const despues = await leerPatrullas(c, tournamentId);
    const unidadA = despues.patrols[0]?.members.filter((m) => m.unit === 'A');
    expect(new Set(unidadA?.map((m) => m.category)).size).toBe(2);
  });

  it('no crea ni borra patrullas: sus credenciales pueden estar repartidas en papel', async () => {
    const c = await adminListo();
    const { tournamentId } = await torneoConPatrullas(c);
    const antes = await leerPatrullas(c, tournamentId);

    await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, conUnidadMezclada(antes.patrols));

    const despues = await leerPatrullas(c, tournamentId);
    expect(despues.patrols).toHaveLength(antes.patrols.length);
    expect(despues.patrols.map((p) => p.username)).toEqual(antes.patrols.map((p) => p.username));
  });

  it('NO se puede redistribuir un torneo ya iniciado', async () => {
    const c = await adminListo();
    const { tournamentId } = await torneoConPatrullas(c);
    const { patrols } = await leerPatrullas(c, tournamentId);

    await c.post(`/api/admin/tournaments/${tournamentId}/start`);

    const res = await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, talCual(patrols));

    // Los líderes ya tienen el recorrido descargado: moverles la patrulla abajo
    // de los pies rompería la sincronización.
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'INVALID_STATE_TRANSITION',
    );
  });

  it('queda registrado en el audit log, con las violaciones aceptadas', async () => {
    const c = await adminListo();
    const { tournamentId } = await torneoConPatrullas(c);
    const { patrols } = await leerPatrullas(c, tournamentId);

    await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, conUnidadMezclada(patrols));

    const registro = await auditLog().findOne({ action: 'patrol.manual_edit' });
    expect(registro).not.toBeNull();
    // Qué se aceptó, no sólo que hubo un cambio.
    const meta = registro?.meta as { violations: number } | undefined;
    expect(meta?.violations).toBeGreaterThan(0);
  });

  it('sin sesión de admin no se puede redistribuir', async () => {
    const c = await adminListo();
    const { tournamentId } = await torneoConPatrullas(c);
    const { patrols } = await leerPatrullas(c, tournamentId);

    const res = await cliente().put(
      `/api/admin/tournaments/${tournamentId}/patrols`,
      talCual(patrols),
    );

    expect(res.status).toBe(401);
  });

  it('si la distribución se rechaza, nadie cambia de patrulla', async () => {
    const c = await adminListo();
    const { tournamentId } = await torneoConPatrullas(c);
    const { patrols } = await leerPatrullas(c, tournamentId);
    const [p1, p2] = patrols as [Patrulla, Patrulla];

    const foto = async () =>
      (
        await participants()
          .find({})
          .map((p) => `${p._id.toHexString()}:${p.patrolId.toHexString()}:${p.unit}`)
          .toArray()
      ).sort();

    const antes = await foto();

    // Válida para la primera patrulla, rota en la segunda: falta un arquero.
    await c.put(`/api/admin/tournaments/${tournamentId}/patrols`, {
      patrols: [
        {
          number: p1.number,
          startTargetIndex: p1.startTargetIndex,
          units: enUnidades([...ids(p1).slice(1), ids(p2)[0] as string]),
        },
        {
          number: p2.number,
          startTargetIndex: p2.startTargetIndex,
          units: enUnidades(ids(p2).slice(1)),
        },
      ],
    });

    expect(await foto()).toEqual(antes);
  });
});
