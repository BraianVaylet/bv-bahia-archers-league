import { Hono } from 'hono';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '../src/env.js';
import { AppError } from '../src/lib/errors.js';
import { handleError } from '../src/middleware/error.js';
import {
  consume,
  contadoresVivos,
  failedAttemptsLimit,
  MAX_CONTADORES,
  rateLimit,
  resetRateLimits,
} from '../src/middleware/rateLimit.js';
import { testEnvRaw } from './helpers.js';

/**
 * El limitador genérico, sobre una app mínima.
 *
 * Estos dos primeros tests vivían en `app.test.ts` y usaban `/api/auth/csrf`.
 * Esa ruta dejó de estar limitada a propósito (`REF6-2`: la app la pide en cada
 * carga y no tiene nada que proteger), así que dejaron de probar el middleware.
 * Se movieron acá, donde lo prueban de verdad.
 */

beforeAll(() => {
  Object.assign(process.env, testEnvRaw());
  resetEnvCache();
});

afterEach(() => resetRateLimits());

function appLimitada(limit: number) {
  const app = new Hono();
  app.onError(handleError);
  app.use('*', rateLimit({ limit, windowMs: 60_000, scope: 'prueba' }));
  app.get('/', (c) => c.text('ok'));
  return app;
}

const pedir = (app: Hono, ip: string) =>
  app.request('http://localhost/', { headers: { 'x-forwarded-for': ip } });

describe('rateLimit', () => {
  it('corta al pasarse y devuelve Retry-After', async () => {
    const app = appLimitada(10);

    let ultima: Response | undefined;
    for (let i = 0; i < 12; i++) ultima = await pedir(app, '203.0.113.10');

    expect(ultima?.status).toBe(429);
    expect(Number(ultima?.headers.get('retry-after'))).toBeGreaterThan(0);

    const body = (await ultima?.json()) as { error: { code: string } };
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('cuenta por IP, así que una no afecta a la otra', async () => {
    const app = appLimitada(10);
    for (let i = 0; i < 12; i++) await pedir(app, '203.0.113.20');

    expect((await pedir(app, '203.0.113.21')).status).toBe(200);
  });
});

describe('failedAttemptsLimit', () => {
  afterEach(() => vi.useRealTimers());

  /**
   * Devolver el lugar de un intento que salió bien no puede tocar una ventana
   * que se reabrió mientras tanto: ese contador es de otros intentos, y restarle
   * uno borraría un fallo ajeno.
   */
  it('devolver el lugar no borra un fallo de la ventana que se reabrió', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });

    const app = new Hono();
    app.onError(handleError);
    app.use('*', failedAttemptsLimit({ limit: 1, windowMs: 1_000, scope: 'prueba' }));
    app.get('/mal', () => {
      throw new AppError('UNAUTHORIZED');
    });
    app.get('/lento', async (c) => {
      // Mientras este intento está en vuelo la ventana vence, y otro intento
      // abre una nueva y la deja con un fallo.
      vi.setSystemTime(Date.now() + 2_000);
      await app.request('http://localhost/mal', { headers: { 'x-forwarded-for': '203.0.113.9' } });
      return c.text('ok');
    });

    const lento = await app.request('http://localhost/lento', {
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });
    expect(lento.status).toBe(200);

    // La ventana nueva tiene su fallo y el cupo es de uno: el siguiente se corta.
    const siguiente = await app.request('http://localhost/mal', {
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });
    expect(siguiente.status).toBe(429);
  });
});

describe('tope de contadores', () => {
  /**
   * `REF6-2` / `S-3`. Cada request con una IP inventada abre un contador nuevo, y
   * las ventanas que no vencieron no se pueden barrer: antes del tope, la memoria
   * del proceso crecía con cada request.
   */
  it('no guarda más contadores que el tope, aunque lleguen claves de sobra', () => {
    for (let i = 0; i < MAX_CONTADORES + 500; i++) consume(`inventada:${i}`, 5, 60_000);

    expect(contadoresVivos()).toBeLessThanOrEqual(MAX_CONTADORES);
  });

  it('al llenarse no pierde el contador que acaba de abrir', () => {
    for (let i = 0; i < MAX_CONTADORES; i++) consume(`vieja:${i}`, 1, 60_000);
    consume('nueva', 1, 60_000);

    // `nueva` ya gastó su único intento: el segundo se corta. Si el desalojo se
    // llevara justo el contador que se acaba de abrir, empezaría de cero y pasaría.
    expect(consume('nueva', 1, 60_000)).not.toBeNull();
  });
});
