import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { resetEnvCache } from '../src/env.js';
import { testEnvRaw } from './helpers.js';

/**
 * El tamaño del body se mide en bytes reales, no en lo que el cliente declara
 * (`REF6-6` / `S-5`).
 *
 * `parseJsonBody` miraba sólo el `Content-Length`. Con `Transfer-Encoding:
 * chunked` no hay header que mirar, y `c.req.json()` leía el body entero a
 * memoria antes de decidir nada: cualquiera podía mandar 500 MB a una ruta que
 * espera 200 bytes.
 *
 * No hace falta base de datos: todo se decide antes de llegar a un servicio.
 */

beforeAll(() => {
  Object.assign(process.env, testEnvRaw());
  resetEnvCache();
});

const CSRF = 'c'.repeat(43);
const KB = 1024;
const MB = 1024 * KB;

/**
 * Un body que se entrega en trozos y cuenta cuántos le pidieron.
 *
 * Son espacios: JSON en blanco hasta el final. Si el servidor lo leyera entero,
 * fallaría recién al parsear; lo que importa acá es cuánto leyó antes de decidir.
 */
function cuerpoEnTrozos(totalBytes: number, trozo = 16 * KB) {
  let entregados = 0;

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (entregados >= totalBytes) {
        controller.close();
        return;
      }
      const n = Math.min(trozo, totalBytes - entregados);
      entregados += n;
      controller.enqueue(new Uint8Array(n).fill(0x20));
    },
  });

  return { stream, entregados: () => entregados };
}

function pedir(ruta: string, init: { body: BodyInit; headers?: Record<string, string> }) {
  return createApp().request(`http://localhost${ruta}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `bal_csrf=${CSRF}`,
      'x-csrf-token': CSRF,
      ...init.headers,
    },
    body: init.body,
    // Hace falta para mandar un stream: es lo que lo vuelve `chunked`.
    duplex: 'half',
  } as RequestInit);
}

const codigoDe = async (res: Response) =>
  ((await res.json()) as { error?: { code: string } }).error?.code;

describe('límite de body', () => {
  it('un body chunked que se pasa del límite se corta con 413, sin leerse entero', async () => {
    const { stream, entregados } = cuerpoEnTrozos(5 * MB);

    const res = await pedir('/api/auth/admin/login', { body: stream });

    expect(res.status).toBe(413);
    expect(await codigoDe(res)).toBe('PAYLOAD_TOO_LARGE');

    // El límite general es 64 KB. Se corta apenas se pasa: unos trozos de más por
    // lo que el stream ya tenía en cola, nunca los 5 MB.
    expect(entregados(), `se leyeron ${entregados()} bytes`).toBeLessThan(256 * KB);
  });

  it('también corta cuando el cliente declara un Content-Length de más', async () => {
    const res = await pedir('/api/auth/admin/login', {
      body: ' '.repeat(100 * KB),
      headers: { 'content-length': String(100 * KB) },
    });

    expect(res.status).toBe(413);
    expect(await codigoDe(res)).toBe('PAYLOAD_TOO_LARGE');
  });

  it('un body chico pasa: el límite no toca lo que corresponde', async () => {
    // Sin base de datos: el schema rechaza `{}` antes de llegar a ningún servicio.
    const res = await pedir('/api/auth/admin/login', { body: '{}' });

    expect(res.status).toBe(400);
    expect(await codigoDe(res)).toBe('VALIDATION_ERROR');
  });

  /**
   * El sync es la excepción: un lote de 200 operaciones con firmas pesa cientos
   * de KB y **nunca** se rechaza por tamaño razonable. Un límite general de 64 KB
   * aplicado a todo `/api` lo rompería.
   */
  describe('/api/wafl/sync', () => {
    it('admite un lote grande: 600 KB no se rechazan por tamaño', async () => {
      const { stream } = cuerpoEnTrozos(600 * KB);

      const res = await pedir('/api/wafl/sync', { body: stream });

      // 401 por no haber sesión, que es lo que sigue después del límite.
      expect(res.status).toBe(401);
    });

    it('pero tiene su techo: 2 MB sí se cortan', async () => {
      const { stream, entregados } = cuerpoEnTrozos(2 * MB);

      const res = await pedir('/api/wafl/sync', { body: stream });

      expect(res.status).toBe(413);
      expect(entregados()).toBeLessThan(1.5 * MB);
    });
  });
});
