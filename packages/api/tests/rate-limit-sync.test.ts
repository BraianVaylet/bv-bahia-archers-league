import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { getDb } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import { resetEnvCache } from '../src/env.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import { clearDb, escenarioDeSync, startDb, stopDb, testEnv, testEnvRaw } from './helpers.js';

/**
 * El límite de `POST /api/wafl/sync` es **por sesión** (`REF6-15` / `B-2`).
 *
 * `SECURITY.md` §3.3 lo prometía por sesión y el código lo contaba por IP. Es una diferencia que
 * importa: el wifi del club es **una sola IP para todas las patrullas**, y cuando diez vuelven del
 * monte y vacían su outbox a la vez, un cupo por IP las corta entre sí. El doc lo dice: «nunca debe
 * ser rechazada».
 *
 * Pero contar sólo por cookie abre un agujero: quien no tiene sesión manda una cookie distinta en
 * cada request y no gasta nunca el mismo cupo, con una lectura a la base por request. Por eso hay una
 * segunda capa, por IP y mucho más alta, que no depende de la cookie.
 */

/** El cupo por sesión, bajo a propósito para que los tests no necesiten cientos de requests. */
const LIMITE = 3;
/** El tope por IP es 20 veces el de la sesión (ver `app.ts`). */
const TOPE_POR_IP = LIMITE * 20;

const TOKEN = 'c'.repeat(43);

beforeAll(async () => {
  Object.assign(process.env, testEnvRaw({ RATE_LIMIT_SYNC: String(LIMITE) }));
  resetEnvCache();
  await startDb();
}, 120_000);

afterAll(async () => {
  await stopDb();
});

afterEach(() => resetRateLimits());

beforeEach(async () => {
  await clearDb(getDb());
  await seed(getDb(), testEnv());
});

/** Un sync con la cookie de sesión que se pida, desde la IP que se pida. */
function sincronizarConCookie(app: ReturnType<typeof createApp>, cookie: string, ip: string) {
  return app.request('http://localhost/api/wafl/sync', {
    method: 'POST',
    headers: {
      cookie: `bal_csrf=${TOKEN}; bal_session=${cookie}`,
      'x-csrf-token': TOKEN,
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify({ ops: [] }),
  });
}

describe('el cupo de sync es de la sesión', () => {
  it('dos dispositivos de la misma patrulla, desde la misma IP, no se pisan el cupo', async () => {
    const e = await escenarioDeSync();
    const otro = await e.entrarOtraVez();

    const delPrimero: number[] = [];
    for (let i = 0; i < LIMITE + 1; i++) {
      delPrimero.push((await e.lider.post('/api/wafl/sync', { ops: [] })).status);
    }
    const delSegundo = (await otro.post('/api/wafl/sync', { ops: [] })).status;

    // El primero se pasó del cupo; el segundo, con su propia sesión, ni se entera.
    expect(delPrimero.slice(0, LIMITE).every((s) => s !== 429)).toBe(true);
    expect(delPrimero[LIMITE]).toBe(429);
    expect(delSegundo).not.toBe(429);
  });

  it('el rechazo avisa cuánto esperar', async () => {
    const e = await escenarioDeSync();
    for (let i = 0; i < LIMITE; i++) await e.lider.post('/api/wafl/sync', { ops: [] });

    const res = await e.lider.post('/api/wafl/sync', { ops: [] });

    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('la misma sesión desde otra IP sigue siendo la misma sesión: comparte el cupo', async () => {
    const app = createApp();
    const cookie = 'd'.repeat(43);

    for (let i = 0; i < LIMITE; i++) await sincronizarConCookie(app, cookie, '10.0.0.1');
    const desdeOtraIp = await sincronizarConCookie(app, cookie, '10.0.0.2');

    expect(desdeOtraIp.status).toBe(429);
  });
});

describe('sin cookie no hay sesión: cuenta la IP', () => {
  const sinCookie = (app: ReturnType<typeof createApp>, ip: string) =>
    app.request('http://localhost/api/wafl/sync', {
      method: 'POST',
      headers: {
        cookie: `bal_csrf=${TOKEN}`,
        'x-csrf-token': TOKEN,
        'content-type': 'application/json',
        'x-forwarded-for': ip,
      },
      body: JSON.stringify({ ops: [] }),
    });

  it('la misma IP comparte el cupo, otra IP no', async () => {
    const app = createApp();
    for (let i = 0; i < LIMITE; i++) await sinCookie(app, '10.0.0.5');

    expect((await sinCookie(app, '10.0.0.5')).status).toBe(429);
    expect((await sinCookie(app, '10.0.0.6')).status).not.toBe(429);
  });
});
describe('el tope por IP, que no depende de la cookie', () => {
  it('rotar la cookie en cada request no escapa del tope', async () => {
    const app = createApp();
    const estados: number[] = [];

    for (let i = 0; i < TOPE_POR_IP + 1; i++) {
      estados.push((await sincronizarConCookie(app, `${i}`.padStart(43, 'x'), '10.0.0.9')).status);
    }

    expect(estados.slice(0, TOPE_POR_IP).some((s) => s === 429)).toBe(false);
    expect(estados[TOPE_POR_IP]).toBe(429);
  });

  it('es por IP: otra IP no lo hereda', async () => {
    const app = createApp();
    for (let i = 0; i < TOPE_POR_IP + 1; i++) {
      await sincronizarConCookie(app, `${i}`.padStart(43, 'x'), '10.0.0.9');
    }

    const otraIp = await sincronizarConCookie(app, 'y'.repeat(43), '10.0.0.10');

    expect(otraIp.status).not.toBe(429);
  });

  it('muchas patrullas detrás de la misma IP caben holgadas', async () => {
    // Diez patrullas del club, cada una con su sesión y su cupo entero: 30 requests desde una IP.
    const app = createApp();
    const estados: number[] = [];

    for (let patrulla = 0; patrulla < 10; patrulla++) {
      for (let i = 0; i < LIMITE; i++) {
        estados.push(
          (await sincronizarConCookie(app, `${patrulla}`.padStart(43, 'p'), '10.0.0.1')).status,
        );
      }
    }

    expect(estados.some((s) => s === 429)).toBe(false);
  });
});
