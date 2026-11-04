import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, crearCliente } from './index.js';

/**
 * El cliente HTTP único (`REF6-11` / `C-4`).
 *
 * Había dos: `app/src/lib/apiClient.ts` y `landing/src/lib/api.ts`. Duplicaban la lógica
 * de CSRF y tenían dos `ApiError` con formas distintas (el de la landing sin `code` ni
 * `details`). Un cambio en el manejo del token tenía que acordarse en los dos lados.
 *
 * Se prueba contra `fetch` falso y la cookie de `document`: es lo que ve el navegador.
 */

interface Llamada {
  url: string;
  init: RequestInit;
}

let llamadas: Llamada[];
let responder: (url: string, init: RequestInit) => Response;

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

const borrarCookies = () => {
  for (const c of document.cookie.split('; ')) {
    const nombre = c.split('=')[0];
    if (nombre) {
      // biome-ignore lint/suspicious/noDocumentCookie: el cliente lee el token CSRF de `document.cookie`; en jsdom es la única forma de ponerlo y sacarlo.
      document.cookie = `${nombre}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  }
};

const ponerCsrf = (token: string) => {
  // biome-ignore lint/suspicious/noDocumentCookie: ídem.
  document.cookie = `bal_csrf=${token}`;
};

beforeEach(() => {
  llamadas = [];
  responder = () => json({});
  borrarCookies();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      llamadas.push({ url, init });
      return responder(url, init);
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

const headersDe = (l: Llamada | undefined) => new Headers(l?.init.headers);

describe('crearCliente', () => {
  describe('lecturas', () => {
    it('piden bajo la base, con la sesión, y sin token CSRF', async () => {
      responder = () => json({ ok: true });
      const { api } = crearCliente({ base: '/api' });

      expect(await api.get('/seasons')).toEqual({ ok: true });

      expect(llamadas).toHaveLength(1);
      expect(llamadas[0]?.url).toBe('/api/seasons');
      expect(llamadas[0]?.init.credentials).toBe('same-origin');
      expect(headersDe(llamadas[0]).has('x-csrf-token')).toBe(false);
    });

    it('pasan la señal, para poder cancelar', async () => {
      const control = new AbortController();
      const { api } = crearCliente({ base: '/api' });

      await api.get('/seasons', control.signal);

      expect(llamadas[0]?.init.signal).toBe(control.signal);
    });
  });

  describe('mutaciones', () => {
    it.each([
      ['post', 'POST'],
      ['put', 'PUT'],
      ['patch', 'PATCH'],
    ] as const)('%s lleva el token CSRF y el cuerpo en JSON', async (verbo, metodo) => {
      ponerCsrf('abc');
      const { api } = crearCliente({ base: '/api' });

      await api[verbo]('/x', { a: 1 });

      expect(llamadas[0]?.init.method).toBe(metodo);
      expect(headersDe(llamadas[0]).get('x-csrf-token')).toBe('abc');
      expect(headersDe(llamadas[0]).get('content-type')).toBe('application/json');
      expect(llamadas[0]?.init.body).toBe(JSON.stringify({ a: 1 }));
    });

    it('del también lleva el token, y no manda cuerpo', async () => {
      ponerCsrf('abc');
      const { api } = crearCliente({ base: '/api' });

      await api.del('/x');

      expect(llamadas[0]?.init.method).toBe('DELETE');
      expect(headersDe(llamadas[0]).get('x-csrf-token')).toBe('abc');
      expect(llamadas[0]?.init.body).toBeUndefined();
    });

    it('sin cookie, pide el token primero y lo usa', async () => {
      responder = (url) => {
        if (url === '/api/auth/csrf') {
          ponerCsrf('nuevo');
          return json({ csrfToken: 'nuevo' });
        }
        return json({});
      };
      const { api } = crearCliente({ base: '/api' });

      await api.post('/x', {});

      expect(llamadas.map((l) => l.url)).toEqual(['/api/auth/csrf', '/api/x']);
      expect(headersDe(llamadas[1]).get('x-csrf-token')).toBe('nuevo');
    });

    /**
     * WebKit en Linux no deja ver en `document.cookie` la cookie de una respuesta recién resuelta,
     * aunque el navegador ya la tenga y la mande en el pedido siguiente. El primer POST de un
     * visitante sin ninguna petición previa (el alta de la landing) salía sin `x-csrf-token` y
     * volvía 403: lo mostró el E2E de iPhone 14 en el CI. El token también viene en el cuerpo.
     */
    describe('si el navegador todavía no muestra la cookie que acaba de recibir', () => {
      const sinCookieVisible = (cuerpo: () => Response) => (url: string) =>
        url === '/api/auth/csrf' ? cuerpo() : json({});

      it('usa el token que vino en el cuerpo', async () => {
        responder = sinCookieVisible(() => json({ csrfToken: 'del-cuerpo' }));
        const { api } = crearCliente({ base: '/api' });

        await api.post('/x', {});

        expect(headersDe(llamadas[1]).get('x-csrf-token')).toBe('del-cuerpo');
      });

      it('la cookie manda sobre el cuerpo cuando están las dos', async () => {
        responder = (url) => {
          if (url !== '/api/auth/csrf') return json({});
          ponerCsrf('de-la-cookie');
          return json({ csrfToken: 'del-cuerpo' });
        };
        const { api } = crearCliente({ base: '/api' });

        await api.post('/x', {});

        expect(headersDe(llamadas[1]).get('x-csrf-token')).toBe('de-la-cookie');
      });

      it('no confía en el cuerpo de una respuesta que no salió bien', async () => {
        responder = sinCookieVisible(() => json({ csrfToken: 'de-un-error' }, 500));
        const { api } = crearCliente({ base: '/api' });

        await api.post('/x', {});

        expect(headersDe(llamadas[1]).has('x-csrf-token')).toBe(false);
      });

      it.each([
        ['un portal cautivo que devuelve HTML', () => new Response('<html>entrá al wifi</html>')],
        ['un cuerpo sin token', () => json({})],
        ['un token que no es texto', () => json({ csrfToken: 42 })],
        ['un token vacío', () => json({ csrfToken: '' })],
      ])('con %s manda la mutación igual, sin token', async (_caso, cuerpo) => {
        responder = sinCookieVisible(cuerpo);
        const { api } = crearCliente({ base: '/api' });

        await api.post('/x', {});

        expect(llamadas.map((l) => l.url)).toEqual(['/api/auth/csrf', '/api/x']);
        expect(headersDe(llamadas[1]).has('x-csrf-token')).toBe(false);
      });
    });

    it('con la cookie puesta no vuelve a pedirla', async () => {
      ponerCsrf('abc');
      const { api } = crearCliente({ base: '/api' });

      await api.post('/x', {});
      await api.post('/x', {});

      expect(llamadas.filter((l) => l.url.endsWith('/auth/csrf'))).toHaveLength(0);
    });

    /**
     * La landing cuelga de `/api/public`, pero el CSRF es de toda la API. Por eso la ruta
     * del token se puede dar aparte, y es **absoluta**.
     */
    it('el token se pide a la ruta absoluta que se le diga, no relativa a la base', async () => {
      responder = (url) => {
        if (url === '/api/auth/csrf') ponerCsrf('t');
        return json({});
      };
      const { api } = crearCliente({ base: '/api/public', rutaCsrf: '/api/auth/csrf' });

      await api.post('/archers', {});

      expect(llamadas.map((l) => l.url)).toEqual(['/api/auth/csrf', '/api/public/archers']);
    });
  });

  describe('respuestas', () => {
    it('un 204 no tiene cuerpo: devuelve undefined', async () => {
      responder = () => new Response(null, { status: 204 });
      const { api } = crearCliente({ base: '/api' });

      expect(await api.get('/x')).toBeUndefined();
    });

    it('un error trae su código, su mensaje y sus detalles', async () => {
      responder = () =>
        json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Faltan datos.',
              details: { campo: 'dni' },
            },
          },
          400,
        );
      const { api } = crearCliente({ base: '/api' });

      const error = await api.get('/x').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Faltan datos.',
        details: { campo: 'dni' },
      });
    });

    it('sin cuerpo de error, el código es INTERNAL y el mensaje es el de siempre', async () => {
      responder = () => json({}, 500);
      const { api } = crearCliente({ base: '/api' });

      const error = (await api.get('/x').catch((e: unknown) => e)) as ApiError;

      expect(error.code).toBe('INTERNAL');
      expect(error.message).toBe('Ocurrió un error inesperado.');
    });

    // La landing tenía un mensaje distinto para leer y para enviar, y la pantalla de alta lo
    // muestra tal cual: «No se pudo enviar. Revisá la conexión.».
    it('los mensajes por defecto se pueden dar para lectura y para escritura', async () => {
      responder = () => json({}, 500);
      const { api } = crearCliente({
        base: '/api/public',
        mensajes: { lectura: 'No se pudo cargar.', escritura: 'No se pudo enviar.' },
      });
      ponerCsrf('t');

      const leer = (await api.get('/x').catch((e: unknown) => e)) as ApiError;
      const enviar = (await api.post('/x', {}).catch((e: unknown) => e)) as ApiError;

      expect(leer.message).toBe('No se pudo cargar.');
      expect(enviar.message).toBe('No se pudo enviar.');
    });

    /**
     * **Una respuesta que no es JSON NO se convierte en un `ApiError`.** El wifi del club
     * tiene un portal cautivo: contesta `200` con una página HTML. El `JSON.parse` falla y
     * sale un `SyntaxError`, que el outbox de WAFL trata como «no sé qué pasó» y reintenta.
     * Si fuera un `ApiError(200, …)`, `esReintentable` diría que no (no es 5xx ni 4xx
     * transitorio) y la op se marcaría en conflicto y se **descartaría del outbox**: un
     * puntaje perdido por un portal de wifi.
     */
    it('un HTML con 200 (portal cautivo) sale como SyntaxError, no como ApiError', async () => {
      responder = () => new Response('<html>Iniciá sesión en el wifi</html>', { status: 200 });
      const { api } = crearCliente({ base: '/api' });

      const error = await api.get('/x').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(SyntaxError);
      expect(error).not.toBeInstanceOf(ApiError);
    });
  });

  describe('request', () => {
    // El worker de sincronización usa `request` directo, con su propia señal de plazo.
    it('acepta método, cuerpo y señal', async () => {
      ponerCsrf('abc');
      const control = new AbortController();
      const { request } = crearCliente({ base: '/api' });

      await request('/wafl/sync', { method: 'POST', body: { ops: [] }, signal: control.signal });

      expect(llamadas[0]?.url).toBe('/api/wafl/sync');
      expect(llamadas[0]?.init.signal).toBe(control.signal);
      expect(headersDe(llamadas[0]).get('x-csrf-token')).toBe('abc');
    });
  });

  /**
   * El `fetch` que se le da al cliente RPC de Hono (`REF6-11` / `C-3`). `hc` arma la URL y el
   * cuerpo; el CSRF y los errores tienen que seguir pasando por acá, no por cada llamada.
   */
  describe('fetch', () => {
    it('no toca la URL: el cliente RPC ya la arma entera', async () => {
      const { fetch: pedir } = crearCliente({ base: '/api' });

      await pedir('/api/admin/archers?q=ana');

      expect(llamadas[0]?.url).toBe('/api/admin/archers?q=ana');
      expect(llamadas[0]?.init.credentials).toBe('same-origin');
    });

    it('acepta una URL que no es un string, y la manda como string', async () => {
      const { fetch: pedir } = crearCliente({ base: '/api' });

      await pedir(new URL('http://localhost/api/admin/archers'));

      expect(llamadas[0]?.url).toBe('http://localhost/api/admin/archers');
    });

    it('una lectura no lleva token CSRF', async () => {
      ponerCsrf('abc');
      const { fetch: pedir } = crearCliente({ base: '/api' });

      await pedir('/api/admin/archers', { method: 'GET' });

      expect(headersDe(llamadas[0]).has('x-csrf-token')).toBe(false);
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('%s lleva el token CSRF', async (method) => {
      ponerCsrf('abc');
      const { fetch: pedir } = crearCliente({ base: '/api' });

      await pedir('/api/admin/archers', { method });

      expect(headersDe(llamadas[0]).get('x-csrf-token')).toBe('abc');
    });

    it('pide el token si todavía no hay cookie, y recién después manda la mutación', async () => {
      responder = (url) => {
        if (url === '/api/auth/csrf') {
          ponerCsrf('nuevo');
          return json({});
        }
        return json({ ok: true });
      };
      const { fetch: pedir } = crearCliente({ base: '/api' });

      await pedir('/api/admin/archers', { method: 'POST' });

      expect(llamadas.map((l) => l.url)).toEqual(['/api/auth/csrf', '/api/admin/archers']);
      expect(headersDe(llamadas[1]).get('x-csrf-token')).toBe('nuevo');
    });

    it('el método de un Request también cuenta: sin `init.method` no se cuela sin token', async () => {
      ponerCsrf('abc');
      const { fetch: pedir } = crearCliente({ base: '/api' });

      await pedir(new Request('http://localhost/api/admin/archers', { method: 'POST' }));

      expect(headersDe(llamadas[0]).get('x-csrf-token')).toBe('abc');
    });

    it('un Request conserva sus headers: pasar `headers` en el init los reemplazaría', async () => {
      ponerCsrf('abc');
      const { fetch: pedir } = crearCliente({ base: '/api' });

      await pedir(
        new Request('http://localhost/api/admin/archers', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
        }),
      );

      expect(headersDe(llamadas[0]).get('content-type')).toBe('application/json');
      expect(headersDe(llamadas[0]).get('x-csrf-token')).toBe('abc');
    });

    it('conserva los headers que ya traía el pedido', async () => {
      ponerCsrf('abc');
      const { fetch: pedir } = crearCliente({ base: '/api' });

      await pedir('/api/admin/archers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });

      expect(headersDe(llamadas[0]).get('content-type')).toBe('application/json');
      expect(headersDe(llamadas[0]).get('x-csrf-token')).toBe('abc');
      expect(llamadas[0]?.init.body).toBe('{}');
    });

    it('pasa la señal, para poder cancelar', async () => {
      const control = new AbortController();
      const { fetch: pedir } = crearCliente({ base: '/api' });

      await pedir('/api/admin/archers', { signal: control.signal });

      expect(llamadas[0]?.init.signal).toBe(control.signal);
    });

    it('si sale bien, devuelve la respuesta sin leerla', async () => {
      const { fetch: pedir } = crearCliente({ base: '/api' });
      responder = () => json({ archers: [] });

      const res = await pedir('/api/admin/archers');

      expect(res.bodyUsed).toBe(false);
      expect(await res.json()).toEqual({ archers: [] });
    });

    it('si el servidor rechaza, lanza un ApiError con code, message y details', async () => {
      responder = () =>
        json(
          { error: { code: 'CONFLICT', message: 'Ya existe.', details: { campo: 'dni' } } },
          409,
        );
      const { fetch: pedir } = crearCliente({ base: '/api' });

      const error = await pedir('/api/admin/archers').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 409, code: 'CONFLICT', message: 'Ya existe.' });
      expect((error as ApiError).details).toEqual({ campo: 'dni' });
    });

    it('si el rechazo no explica nada, usa el mensaje según se lea o se escriba', async () => {
      responder = () => json({}, 500);
      const { fetch: pedir } = crearCliente({
        base: '/api',
        mensajes: { lectura: 'No se pudo leer.', escritura: 'No se pudo guardar.' },
      });

      const lectura = await pedir('/api/admin/archers').catch((e: unknown) => e);
      ponerCsrf('abc');
      const escritura = await pedir('/api/admin/archers', { method: 'POST' }).catch(
        (e: unknown) => e,
      );

      expect((lectura as ApiError).message).toBe('No se pudo leer.');
      expect((escritura as ApiError).message).toBe('No se pudo guardar.');
    });

    // Es el mismo caso del portal cautivo de `request`: tiene que seguir siendo reintentable.
    it('un `200` que no es JSON llega como respuesta, y leerlo es un SyntaxError', async () => {
      responder = () => new Response('<html>portal</html>', { status: 200 });
      const { fetch: pedir } = crearCliente({ base: '/api' });

      const res = await pedir('/api/admin/archers');
      const error = await res.json().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(SyntaxError);
      expect(error).not.toBeInstanceOf(ApiError);
    });

    it('un rechazo con HTML (un 502 del proxy) sale como SyntaxError, igual que en `request`', async () => {
      responder = () => new Response('<html>Bad Gateway</html>', { status: 502 });
      const { fetch: pedir } = crearCliente({ base: '/api' });

      const error = await pedir('/api/admin/archers').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(SyntaxError);
    });

    it('si no hay red, el error pasa tal cual', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new TypeError('Failed to fetch');
        }),
      );
      const { fetch: pedir } = crearCliente({ base: '/api' });

      await expect(pedir('/api/admin/archers')).rejects.toThrow(TypeError);
    });
  });
});

describe('ApiError', () => {
  it('lleva status, code y details, y es un Error', () => {
    const e = new ApiError(409, 'CONFLICT', 'Ya existe.', { campo: 'dni' });

    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('ApiError');
    expect(e).toMatchObject({ status: 409, code: 'CONFLICT', message: 'Ya existe.' });
    expect(e.details).toEqual({ campo: 'dni' });
  });

  it('details es opcional', () => {
    expect(new ApiError(500, 'INTERNAL', 'x').details).toBeUndefined();
  });
});
