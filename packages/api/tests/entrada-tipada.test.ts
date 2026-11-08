import { beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createApp } from '../src/app.js';
import { resetEnvCache } from '../src/env.js';
import { bodyValidado, consultaValidada } from '../src/middleware/validate.js';
import { testEnvRaw } from './helpers.js';

/**
 * La validación de entrada como middleware (`REF6-11` / `C-3`).
 *
 * Es `parseJsonBody` y `parseQuery` movidos antes del handler, y nada más: misma validación, mismos
 * errores. Lo único nuevo es que el resultado queda en `c.req.valid(…)` con tipo, y de ahí lo lee el
 * cliente RPC de Hono para saber qué acepta cada ruta. Estos tests fijan que **no cambió nada de lo
 * que ya garantizaba** (`.strict()`, operadores de Mongo, tamaño) y que el handler no corre si la
 * entrada no pasa.
 */

const TOKEN = 'b'.repeat(43);

// `createApp` lee la configuración del proceso. No hace falta la base: ninguna ruta de acá la toca.
beforeAll(() => {
  Object.assign(process.env, testEnvRaw());
  resetEnvCache();
});

const BodySchema = z
  .strictObject({ nombre: z.string().trim().min(1), edad: z.number().int().optional() })
  .transform((v) => ({ ...v, nombre: v.nombre.toUpperCase() }));

const QuerySchema = z
  .strictObject({
    q: z.string().max(10).optional(),
    archivados: z.enum(['true', 'false']).optional(),
  })
  .transform((v) => ({ texto: v.q, archivados: v.archivados === 'true' }));

function montar() {
  const handler = vi.fn();
  const local = createApp();

  local.post('/api/eco', bodyValidado(BodySchema), async (c) => {
    handler();
    return c.json(c.req.valid('json'));
  });
  local.get('/api/buscar', consultaValidada(QuerySchema), (c) => {
    handler();
    return c.json(c.req.valid('query'));
  });

  return { local, handler };
}

const enviar = (local: ReturnType<typeof montar>['local'], body: unknown, extra = {}) =>
  local.request('http://localhost/api/eco', {
    method: 'POST',
    headers: {
      cookie: `bal_csrf=${TOKEN}`,
      'x-csrf-token': TOKEN,
      'content-type': 'application/json',
      ...extra,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('bodyValidado', () => {
  it('deja en c.req.valid el resultado del schema, con sus transformaciones', async () => {
    const { local } = montar();

    const res = await enviar(local, { nombre: '  juan  ' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nombre: 'JUAN' });
  });

  it('rechaza una propiedad no declarada (.strict) y el handler no corre', async () => {
    const { local, handler } = montar();

    const res = await enviar(local, { nombre: 'Juan', esAdmin: true });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
    expect(handler).not.toHaveBeenCalled();
  });

  it('rechaza un operador de Mongo donde se espera un string', async () => {
    const { local, handler } = montar();

    const res = await enviar(local, { nombre: { $ne: null } });

    expect(res.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it('rechaza un body que no es JSON, con el mismo mensaje de siempre', async () => {
    const { local, handler } = montar();

    const res = await enviar(local, 'esto no es json');
    const body = (await res.json()) as { error: { code: string; details?: { fields: unknown[] } } };

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(body.error.details)).toContain('El body no es JSON válido.');
    expect(handler).not.toHaveBeenCalled();
  });

  it('rechaza un body declarado más grande que el máximo', async () => {
    const { local, handler } = montar();

    const res = await enviar(
      local,
      { nombre: 'Juan' },
      { 'content-length': String(2 * 1_048_576) },
    );

    expect(res.status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
  });

  it('informa qué campo falló', async () => {
    const { local } = montar();

    const res = await enviar(local, { nombre: '' });
    const body = (await res.json()) as { error: { details?: { fields: { path: string }[] } } };

    expect(body.error.details?.fields[0]?.path).toBe('nombre');
  });

  it('sin sesión CSRF ni nada: la validación corre después del CSRF, que sigue primero', async () => {
    const { local, handler } = montar();

    const res = await local.request('http://localhost/api/eco', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nombre: 'Juan' }),
    });

    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('consultaValidada', () => {
  it('deja en c.req.valid el resultado del schema, con sus transformaciones', async () => {
    const { local } = montar();

    const res = await local.request('http://localhost/api/buscar?q=ana&archivados=true');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ texto: 'ana', archivados: true });
  });

  it('rechaza un parámetro desconocido y el handler no corre', async () => {
    const { local, handler } = montar();

    const res = await local.request('http://localhost/api/buscar?q=ana&admin=1');

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
    expect(handler).not.toHaveBeenCalled();
  });

  it('rechaza un valor fuera del enum', async () => {
    const { local, handler } = montar();

    const res = await local.request('http://localhost/api/buscar?archivados=quizás');

    expect(res.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it('sin parámetros, el schema recibe un objeto vacío', async () => {
    const { local } = montar();

    const res = await local.request('http://localhost/api/buscar');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ archivados: false });
  });
});
