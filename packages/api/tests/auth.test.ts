import type { Db } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { sessions, users } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import { resetEnvCache } from '../src/env.js';
import { sha256 } from '../src/lib/crypto.js';
import { requireAdmin } from '../src/middleware/auth.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import { clearDb, startDb, stopDb, testEnv, testEnvRaw } from './helpers.js';

/**
 * Autenticación de administrador (BE-3).
 *
 * Cubre la sección de auth del checklist de docs/SECURITY.md §13.
 */

const PASSWORD = 'password-de-test-1234';
let db: Db;

beforeAll(async () => {
  Object.assign(process.env, testEnvRaw());
  resetEnvCache();
  db = await startDb();
}, 120_000);

afterAll(async () => {
  await stopDb();
});

beforeEach(async () => {
  await clearDb(db);
  await seed(db, testEnv());
});

afterEach(() => {
  resetRateLimits();
});

// ── Cliente de prueba ────────────────────────────────────────────────────────

const CSRF = 'c'.repeat(43);

/** Mantiene la cookie de sesión entre requests, como haría un navegador. */
function cliente() {
  const app = createApp();
  let cookieDeSesion = '';

  const pedir = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers);
    const cookies = [`bal_csrf=${CSRF}`, cookieDeSesion].filter(Boolean).join('; ');
    headers.set('cookie', cookies);
    headers.set('x-csrf-token', CSRF);
    if (init.body) headers.set('content-type', 'application/json');

    const res = await app.request(`http://localhost${path}`, { ...init, headers });

    const set = res.headers.get('set-cookie');
    if (set?.includes('bal_session=')) {
      cookieDeSesion = set.split(';')[0] ?? '';
    }
    return res;
  };

  return {
    pedir,
    post: (path: string, body?: unknown) =>
      pedir(path, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) }),
    get: (path: string) => pedir(path),
    tieneSesion: () => cookieDeSesion.length > 0 && !cookieDeSesion.endsWith('='),
  };
}

const login = async (c = cliente(), password = PASSWORD) => {
  const res = await c.post('/api/auth/admin/login', { username: 'admin', password });
  return { c, res };
};

// ── Login ────────────────────────────────────────────────────────────────────

describe('login de admin', () => {
  it('acepta credenciales correctas y abre sesión', async () => {
    const { c, res } = await login();
    expect(res.status).toBe(200);

    const body = (await res.json()) as { admin: { username: string; mustChangePassword: boolean } };
    expect(body.admin.username).toBe('admin');
    expect(body.admin.mustChangePassword).toBe(true);
    expect(c.tieneSesion()).toBe(true);
  });

  it('la cookie de sesión es HttpOnly y SameSite=Lax', async () => {
    const app = createApp();
    const res = await app.request('http://localhost/api/auth/admin/login', {
      method: 'POST',
      headers: {
        cookie: `bal_csrf=${CSRF}`,
        'x-csrf-token': CSRF,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ username: 'admin', password: PASSWORD }),
    });

    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('en la base guarda el sha256 del token, nunca el token', async () => {
    const app = createApp();
    const res = await app.request('http://localhost/api/auth/admin/login', {
      method: 'POST',
      headers: {
        cookie: `bal_csrf=${CSRF}`,
        'x-csrf-token': CSRF,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ username: 'admin', password: PASSWORD }),
    });

    const token = (res.headers.get('set-cookie') ?? '').match(/bal_session=([^;]+)/)?.[1] ?? '';
    expect(token).toBeTruthy();

    const doc = await sessions().findOne({});
    expect(doc?.tokenHash).toBe(sha256(token));
    expect(doc?.tokenHash).not.toBe(token);
  });

  it('rechaza un password incorrecto', async () => {
    const { res } = await login(cliente(), 'password-equivocado');
    expect(res.status).toBe(401);
  });

  // No se puede distinguir un usuario inexistente de un password incorrecto.
  it('devuelve el MISMO error para un usuario inexistente que para un password malo', async () => {
    const app = createApp();
    const pedir = (username: string, password: string) =>
      app.request('http://localhost/api/auth/admin/login', {
        method: 'POST',
        headers: {
          cookie: `bal_csrf=${CSRF}`,
          'x-csrf-token': CSRF,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

    const inexistente = await pedir('noexiste', PASSWORD);
    const passwordMalo = await pedir('admin', 'otro-password-1234');

    expect(inexistente.status).toBe(passwordMalo.status);
    expect(await inexistente.text()).toBe(await passwordMalo.text());
  });

  it('un usuario inexistente tarda lo mismo que uno real', async () => {
    // Sin el hash de referencia, el inexistente responde en microsegundos y el
    // real tarda lo que tarda argon2id. Esa diferencia permite enumerar cuentas.
    const app = createApp();
    const medir = async (username: string): Promise<number> => {
      const inicio = performance.now();
      await app.request('http://localhost/api/auth/admin/login', {
        method: 'POST',
        headers: {
          cookie: `bal_csrf=${CSRF}`,
          'x-csrf-token': CSRF,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ username, password: 'password-incorrecto-x' }),
      });
      return performance.now() - inicio;
    };

    // Descarta la primera medición: incluye el cálculo del hash de referencia.
    await medir('admin');

    const existente = await medir('admin');
    const inexistente = await medir('noexiste');

    // argon2id tarda decenas de milisegundos; sin la guarda, el inexistente
    // sería órdenes de magnitud más rápido.
    expect(inexistente).toBeGreaterThan(existente * 0.4);
  });

  it('rechaza un body sin los campos requeridos', async () => {
    const c = cliente();
    expect((await c.post('/api/auth/admin/login', { username: 'admin' })).status).toBe(400);
  });

  it('rechaza un operador de Mongo en el usuario', async () => {
    const c = cliente();
    const res = await c.post('/api/auth/admin/login', {
      username: { $ne: null },
      password: PASSWORD,
    });
    expect(res.status).toBe(400);
  });

  it('exige el header CSRF', async () => {
    const app = createApp();
    const res = await app.request('http://localhost/api/auth/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: PASSWORD }),
    });
    expect(res.status).toBe(403);
  });
});

// ── Bloqueo por intentos fallidos ────────────────────────────────────────────

describe('bloqueo por intentos fallidos', () => {
  it('bloquea la cuenta tras 5 intentos, y el 6º falla aun con el password CORRECTO', async () => {
    const c = cliente();

    for (let i = 0; i < 5; i++) {
      const r = await c.post('/api/auth/admin/login', { username: 'admin', password: `malo-${i}` });
      expect(r.status).toBe(401);
    }

    const conElCorrecto = await c.post('/api/auth/admin/login', {
      username: 'admin',
      password: PASSWORD,
    });

    expect(conElCorrecto.status).toBe(429);
    expect(Number(conElCorrecto.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('un login exitoso limpia el contador de intentos', async () => {
    const c = cliente();
    await c.post('/api/auth/admin/login', { username: 'admin', password: 'malo' });
    await c.post('/api/auth/admin/login', { username: 'admin', password: PASSWORD });

    expect((await users().findOne({ username: 'admin' }))?.failedAttempts).toBe(0);
  });
});

// ── mustChangePassword ───────────────────────────────────────────────────────

describe('cambio de password obligatorio', () => {
  it('bloquea con 403 cualquier ruta protegida mientras no se cambie', async () => {
    // Ruta protegida real, montada sobre la misma app que usa la sesión.
    const app = createApp();
    app.get('/api/protegida', requireAdmin(), (ctx) => ctx.json({ ok: true }));

    const headers = {
      cookie: `bal_csrf=${CSRF}`,
      'x-csrf-token': CSRF,
      'content-type': 'application/json',
    };
    const loginRes = await app.request('http://localhost/api/auth/admin/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ username: 'admin', password: PASSWORD }),
    });
    const sesion = (loginRes.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

    const res = await app.request('http://localhost/api/protegida', {
      headers: { cookie: sesion },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { details?: { mustChangePassword?: boolean } } };
    expect(body.error.details?.mustChangePassword).toBe(true);
  });

  it('deja de bloquear una vez cambiado', async () => {
    const app = createApp();
    app.get('/api/protegida', requireAdmin(), (ctx) => ctx.json({ ok: true }));

    const headers = {
      cookie: `bal_csrf=${CSRF}`,
      'x-csrf-token': CSRF,
      'content-type': 'application/json',
    };
    const loginRes = await app.request('http://localhost/api/auth/admin/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ username: 'admin', password: PASSWORD }),
    });
    let sesion = (loginRes.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

    const cambio = await app.request('http://localhost/api/auth/admin/password', {
      method: 'POST',
      headers: { ...headers, cookie: `bal_csrf=${CSRF}; ${sesion}` },
      body: JSON.stringify({
        currentPassword: PASSWORD,
        newPassword: 'un-password-nuevo-largo',
      }),
    });
    sesion = (cambio.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

    const res = await app.request('http://localhost/api/protegida', {
      headers: { cookie: sesion },
    });
    expect(res.status).toBe(200);
  });

  it('permite el cambio de password aunque mustChangePassword esté activo', async () => {
    const { c } = await login();

    const res = await c.post('/api/auth/admin/password', {
      currentPassword: PASSWORD,
      newPassword: 'un-password-nuevo-largo',
    });

    expect(res.status).toBe(200);
    expect((await users().findOne({ username: 'admin' }))?.mustChangePassword).toBe(false);
  });

  it('GET /me informa que hay que cambiarlo', async () => {
    const { c } = await login();
    const body = (await (await c.get('/api/auth/me')).json()) as {
      admin: { mustChangePassword: boolean };
    };
    expect(body.admin.mustChangePassword).toBe(true);
  });
});

// ── Cambio de password ───────────────────────────────────────────────────────

describe('cambio de password', () => {
  it('rechaza si el password actual no es correcto', async () => {
    const { c } = await login();
    const res = await c.post('/api/auth/admin/password', {
      currentPassword: 'no-es-el-actual',
      newPassword: 'un-password-nuevo-largo',
    });
    expect(res.status).toBe(401);
  });

  it('rechaza un password nuevo de menos de 12 caracteres', async () => {
    const { c } = await login();
    const res = await c.post('/api/auth/admin/password', {
      currentPassword: PASSWORD,
      newPassword: 'corto',
    });
    expect(res.status).toBe(400);
  });

  it('rechaza que el nuevo sea igual al actual', async () => {
    const { c } = await login();
    const res = await c.post('/api/auth/admin/password', {
      currentPassword: PASSWORD,
      newPassword: PASSWORD,
    });
    expect(res.status).toBe(400);
  });

  it('el password nuevo funciona y el viejo deja de funcionar', async () => {
    const { c } = await login();
    await c.post('/api/auth/admin/password', {
      currentPassword: PASSWORD,
      newPassword: 'un-password-nuevo-largo',
    });

    resetRateLimits();
    expect((await login(cliente(), 'un-password-nuevo-largo')).res.status).toBe(200);

    resetRateLimits();
    expect((await login(cliente(), PASSWORD)).res.status).toBe(401);
  });

  // Si el motivo del cambio es que el password se filtró, dejar vivas las
  // sesiones abiertas no arregla nada.
  it('invalida las demás sesiones abiertas', async () => {
    const otroDispositivo = cliente();
    await login(otroDispositivo);
    expect((await otroDispositivo.get('/api/auth/me')).status).toBe(200);

    const { c } = await login();
    await c.post('/api/auth/admin/password', {
      currentPassword: PASSWORD,
      newPassword: 'un-password-nuevo-largo',
    });

    expect((await otroDispositivo.get('/api/auth/me')).status).toBe(401);
  });

  it('la sesión que hizo el cambio sigue funcionando', async () => {
    const { c } = await login();
    await c.post('/api/auth/admin/password', {
      currentPassword: PASSWORD,
      newPassword: 'un-password-nuevo-largo',
    });

    expect((await c.get('/api/auth/me')).status).toBe(200);
  });

  it('guarda el password hasheado, nunca en claro', async () => {
    const { c } = await login();
    await c.post('/api/auth/admin/password', {
      currentPassword: PASSWORD,
      newPassword: 'un-password-nuevo-largo',
    });

    const user = await users().findOne({ username: 'admin' });
    expect(user?.passwordHash).not.toContain('un-password-nuevo-largo');
    expect(user?.passwordHash).toMatch(/^\$argon2id\$/);
  });
});

// ── Sesión ───────────────────────────────────────────────────────────────────

describe('sesión', () => {
  it('GET /me sin sesión devuelve 401', async () => {
    expect((await cliente().get('/api/auth/me')).status).toBe(401);
  });

  it('GET /me con sesión devuelve el admin', async () => {
    const { c } = await login();
    const res = await c.get('/api/auth/me');
    expect(res.status).toBe(200);

    const body = (await res.json()) as { admin: { username: string } };
    expect(body.admin.username).toBe('admin');
  });

  it('logout invalida la sesión EN LA BASE, no sólo la cookie', async () => {
    const { c } = await login();
    expect(await sessions().countDocuments()).toBe(1);

    await c.post('/api/auth/logout');

    expect(await sessions().countDocuments()).toBe(0);
    expect((await c.get('/api/auth/me')).status).toBe(401);
  });

  it('una cookie de sesión inventada no autentica', async () => {
    const app = createApp();
    const res = await app.request('http://localhost/api/auth/me', {
      headers: { cookie: 'bal_session=token-inventado-por-el-atacante' },
    });
    expect(res.status).toBe(401);
  });

  it('una sesión vencida no autentica aunque siga en la colección', async () => {
    // El índice TTL de Mongo barre cada ~60 s: entre el vencimiento y el barrido
    // el documento todavía existe, así que el filtro por fecha es necesario.
    const { c } = await login();
    await sessions().updateOne({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    expect(await sessions().countDocuments()).toBe(1);
    expect((await c.get('/api/auth/me')).status).toBe(401);
  });
});
