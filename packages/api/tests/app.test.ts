import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '../src/app.js';
import { resetEnvCache } from '../src/env.js';
import { AppError } from '../src/lib/errors.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import { parseJsonBody } from '../src/middleware/validate.js';
import { startDb, stopDb, testEnvRaw } from './helpers.js';

/**
 * Base de Hono y middlewares de seguridad (BE-2).
 *
 * Cubre el checklist de docs/SECURITY.md §13 en lo que corresponde a esta capa.
 */

beforeAll(async () => {
  // `createApp` lee la configuración del proceso, así que se siembra antes de
  // que nada la cachee. La base hace falta para que el healthcheck dé `ok`.
  Object.assign(process.env, testEnvRaw());
  resetEnvCache();
  await startDb();
}, 120_000);

afterAll(async () => {
  await stopDb();
});

afterEach(() => {
  resetRateLimits();
});

const app = () => createApp();

/** Hace una request y devuelve la respuesta. */
const pedir = (path: string, init?: RequestInit) => app().request(`http://localhost${path}`, init);

describe('healthcheck', () => {
  it('responde 200 con el estado de la base', async () => {
    const res = await pedir('/api/health');
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; db: string; version: string };
    expect(body.status).toBe('ok');
    expect(body.db).toBe('ok');
    expect(body.version).toBeTruthy();
  });

  it('no lleva rate limit: Railway lo consulta seguido', async () => {
    // Bloquearlo daría de baja el servicio por su propio monitoreo.
    for (let i = 0; i < 200; i++) {
      const res = await pedir('/api/health');
      expect(res.status).toBe(200);
    }
  });
});

describe('cabeceras de seguridad', () => {
  it('están presentes en toda respuesta', async () => {
    const res = await pedir('/api/health');

    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('same-origin');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('permissions-policy')).toContain('geolocation=()');
  });

  it('la CSP no permite scripts inline', async () => {
    const csp = (await pedir('/api/health')).headers.get('content-security-policy') ?? '';
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? '';

    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).not.toContain('unsafe-inline');
    expect(scriptSrc).not.toContain('unsafe-eval');
  });

  it('permite data: y blob: en img-src, que hacen falta para las firmas', async () => {
    const csp = (await pedir('/api/health')).headers.get('content-security-policy') ?? '';
    expect(csp).toContain("img-src 'self' data: blob:");
  });

  it('también van en las respuestas de error', async () => {
    const res = await pedir('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('sin HSTS fuera de producción', async () => {
    expect((await pedir('/api/health')).headers.get('strict-transport-security')).toBeNull();
  });
});

describe('CSRF', () => {
  it('GET /api/auth/csrf entrega el token y la cookie', async () => {
    const res = await pedir('/api/auth/csrf');
    expect(res.status).toBe(200);

    const { csrfToken } = (await res.json()) as { csrfToken: string };
    expect(csrfToken).toBeTruthy();
    expect(res.headers.get('set-cookie')).toContain('bal_csrf=');
  });

  it('una mutación SIN el header devuelve 403', async () => {
    const res = await pedir('/api/auth/algo', { method: 'POST' });
    expect(res.status).toBe(403);

    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('CSRF_INVALID');
  });

  it('una mutación con un header que no coincide devuelve 403', async () => {
    const res = await pedir('/api/auth/algo', {
      method: 'POST',
      headers: { cookie: 'bal_csrf=token-real', 'x-csrf-token': 'token-falso' },
    });
    expect(res.status).toBe(403);
  });

  it('una mutación con cookie y header coincidentes pasa el control de CSRF', async () => {
    // Llega al 404 de ruta inexistente, que es lo que se quiere demostrar:
    // el CSRF no la frenó.
    const token = 'a'.repeat(43);
    const res = await pedir('/api/auth/algo', {
      method: 'POST',
      headers: { cookie: `bal_csrf=${token}`, 'x-csrf-token': token },
    });
    expect(res.status).toBe(404);
  });

  it('los GET no exigen header', async () => {
    expect((await pedir('/api/health')).status).toBe(200);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('%s exige el header', async (method) => {
    expect((await pedir('/api/auth/algo', { method })).status).toBe(403);
  });
});

describe('rate limiting', () => {
  it('corta al pasarse y devuelve Retry-After', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.10' };

    let ultima: Response | undefined;
    for (let i = 0; i < 12; i++) {
      ultima = await pedir('/api/auth/csrf', { headers });
    }

    expect(ultima?.status).toBe(429);
    expect(Number(ultima?.headers.get('retry-after'))).toBeGreaterThan(0);

    const body = (await ultima?.json()) as { error: { code: string } };
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('cuenta por IP, así que una no afecta a la otra', async () => {
    for (let i = 0; i < 12; i++) {
      await pedir('/api/auth/csrf', { headers: { 'x-forwarded-for': '203.0.113.20' } });
    }

    const otra = await pedir('/api/auth/csrf', { headers: { 'x-forwarded-for': '203.0.113.21' } });
    expect(otra.status).toBe(200);
  });
});

describe('manejo de errores', () => {
  it('los errores tipados salen con su código y su status', async () => {
    const local = createApp();
    local.get('/api/boom', () => {
      throw new AppError('TARGET_LOCKED');
    });

    const res = await local.request('http://localhost/api/boom');
    expect(res.status).toBe(409);

    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('TARGET_LOCKED');
    expect(body.error.message).toMatch(/puntajes cargados/);
  });

  it('un error inesperado devuelve 500 con requestId y sin stack', async () => {
    const local = createApp();
    local.get('/api/kaboom', () => {
      throw new Error('detalle interno que no debe salir');
    });

    const res = await local.request('http://localhost/api/kaboom');
    expect(res.status).toBe(500);

    const texto = await res.text();
    expect(texto).not.toContain('at Object');
    expect(texto).not.toMatch(/\.ts:\d+/);

    const body = JSON.parse(texto) as { error: { code: string; requestId?: string } };
    expect(body.error.code).toBe('INTERNAL');
    expect(body.error.requestId).toBeTruthy();
  });

  it('una ruta inexistente devuelve 404 con la forma de error estándar', async () => {
    const res = await pedir('/api/nada');
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('validación de entrada', () => {
  const Schema = z.object({ nombre: z.string().min(1) }).strict();

  const conBody = (body: unknown, contentLength?: string) => {
    const local = createApp();
    local.post('/api/eco', async (c) => c.json(await parseJsonBody(c, Schema)));

    const token = 'b'.repeat(43);
    return local.request('http://localhost/api/eco', {
      method: 'POST',
      headers: {
        cookie: `bal_csrf=${token}`,
        'x-csrf-token': token,
        'content-type': 'application/json',
        ...(contentLength ? { 'content-length': contentLength } : {}),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  };

  it('acepta un body válido', async () => {
    const res = await conBody({ nombre: 'Juan' });
    expect(res.status).toBe(200);
  });

  it('rechaza una propiedad no declarada (.strict)', async () => {
    const res = await conBody({ nombre: 'Juan', esAdmin: true });
    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza un operador de Mongo donde se espera un string', async () => {
    // Sin esto, { $ne: null } llegaría a un filtro y devolvería el primer documento.
    const res = await conBody({ nombre: { $ne: null } });
    expect(res.status).toBe(400);
  });

  it('rechaza un body que no es JSON', async () => {
    const res = await conBody('esto no es json');
    expect(res.status).toBe(400);
  });

  it('rechaza un body declarado más grande que el máximo', async () => {
    const res = await conBody({ nombre: 'Juan' }, String(2 * 1_048_576));
    expect(res.status).toBe(413);
  });

  it('informa qué campo falló', async () => {
    const res = await conBody({ nombre: '' });
    const body = (await res.json()) as {
      error: { details?: { fields: { path: string }[] } };
    };
    expect(body.error.details?.fields[0]?.path).toBe('nombre');
  });
});
