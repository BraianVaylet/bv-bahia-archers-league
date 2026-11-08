import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, cuerpo, rpc } from './rpc.js';

/**
 * El cliente RPC de la PWA (`REF6-11` / `C-3`).
 *
 * `hc<…>` arma la URL y el cuerpo a partir de los tipos de la API; lo que sale por la red tiene que
 * ser exactamente lo que salía con `api.get('/admin/…')`. Si no, las pantallas dejarían de pegarle
 * a las rutas que existen, y los tests de UI —que simulan la red— no lo notarían.
 *
 * Se prueba contra `fetch` falso y la cookie de `document`: es lo que ve el navegador.
 */

interface Llamada {
  url: string;
  init: RequestInit;
}

let llamadas: Llamada[];
let responder: (url: string, init: RequestInit) => Response;

const json = (cuerpoDeLaRespuesta: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpoDeLaRespuesta), {
    status,
    headers: { 'content-type': 'application/json' },
  });

beforeEach(() => {
  llamadas = [];
  responder = () => json({});
  // biome-ignore lint/suspicious/noDocumentCookie: el cliente lee el token CSRF de `document.cookie`; en jsdom es la única forma de ponerlo.
  document.cookie = 'bal_csrf=tok';
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

describe('rpc', () => {
  describe('rutas', () => {
    it('admin cuelga de /api/admin y arma el parámetro de la ruta', async () => {
      await rpc.admin.tournaments[':id'].$get({ param: { id: 't1' } });

      expect(llamadas[0]?.url).toBe('/api/admin/tournaments/t1');
      expect(llamadas[0]?.init.method).toBe('GET');
      expect(llamadas[0]?.init.credentials).toBe('same-origin');
    });

    it('auth cuelga de /api/auth', async () => {
      await rpc.auth.me.$get();

      expect(llamadas[0]?.url).toBe('/api/auth/me');
    });

    it('publico cuelga de /api/public', async () => {
      await rpc.publico.seasons.$get();

      expect(llamadas[0]?.url).toBe('/api/public/seasons');
    });

    it('la consulta va en la URL, con las claves en el orden en que se pasan', async () => {
      await rpc.admin.archers.$get({ query: { q: 'ana', archived: 'true' } });

      expect(llamadas[0]?.url).toBe('/api/admin/archers?q=ana&archived=true');
    });

    it('una ruta anidada con dos parámetros los reemplaza a los dos', async () => {
      await rpc.publico.tournaments[':id'].participants[':participantId'].$get({
        param: { id: 't1', participantId: 'p9' },
      });

      expect(llamadas[0]?.url).toBe('/api/public/tournaments/t1/participants/p9');
    });
  });

  describe('lo que se escribe', () => {
    it('una mutación lleva el token CSRF y el método', async () => {
      await rpc.admin.tournaments[':id'].start.$post({ param: { id: 't1' } });

      expect(llamadas[0]?.url).toBe('/api/admin/tournaments/t1/start');
      expect(llamadas[0]?.init.method).toBe('POST');
      expect(headersDe(llamadas[0]).get('x-csrf-token')).toBe('tok');
    });

    it('el cuerpo viaja como JSON, con su content-type, junto al token', async () => {
      const temporada = { name: 'Temporada 2027', startsAt: '2027-01-01', endsAt: '2027-12-31' };

      await rpc.admin.seasons.$post({ json: temporada });

      expect(llamadas[0]?.init.body).toBe(JSON.stringify(temporada));
      expect(headersDe(llamadas[0]).get('content-type')).toContain('application/json');
      expect(headersDe(llamadas[0]).get('x-csrf-token')).toBe('tok');
    });

    it('PATCH y DELETE también llevan el token', async () => {
      await rpc.admin.tournaments[':id'].$patch({ param: { id: 't1' }, json: {} });
      await rpc.admin.tournaments[':id'].$delete({ param: { id: 't1' } });

      expect(llamadas.map((l) => l.init.method)).toEqual(['PATCH', 'DELETE']);
      for (const l of llamadas) expect(headersDe(l).get('x-csrf-token')).toBe('tok');
    });

    it('una lectura no lleva token', async () => {
      await rpc.admin.seasons.$get();

      expect(headersDe(llamadas[0]).has('x-csrf-token')).toBe(false);
    });
  });

  describe('cancelar', () => {
    it('la señal llega al fetch', async () => {
      const control = new AbortController();

      await rpc.admin.seasons.$get(undefined, { init: { signal: control.signal } });

      expect(llamadas[0]?.init.signal).toBe(control.signal);
    });
  });

  describe('errores', () => {
    it('un rechazo del servidor es un ApiError, el mismo de siempre', async () => {
      responder = () => json({ error: { code: 'CONFLICT', message: 'Ya existe.' } }, 409);

      const error = await rpc.admin.seasons.$get().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 409, code: 'CONFLICT', message: 'Ya existe.' });
    });

    it('una mutación que falla sin explicación dice «no se pudo guardar», no «no se pudo cargar»', async () => {
      responder = () => json({}, 500);

      const error = await rpc.admin.tournaments[':id'].start
        .$post({ param: { id: 't1' } })
        .catch((e: unknown) => e);

      expect((error as ApiError).message).not.toMatch(/cargar/i);
    });

    it('un 200 que no es JSON es un SyntaxError al leerlo, no un ApiError (el portal del wifi)', async () => {
      responder = () => new Response('<html>portal</html>', { status: 200 });

      const error = await cuerpo(rpc.admin.seasons.$get()).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(SyntaxError);
      expect(error).not.toBeInstanceOf(ApiError);
    });
  });

  describe('cuerpo', () => {
    it('devuelve el JSON de una respuesta que salió bien', async () => {
      responder = () => json({ seasons: [{ id: 's1', name: 'Temporada 2026' }] });

      expect(await cuerpo(rpc.admin.seasons.$get())).toEqual({
        seasons: [{ id: 's1', name: 'Temporada 2026' }],
      });
    });

    it('si el pedido falla, el error pasa sin tocar', async () => {
      responder = () => json({ error: { code: 'UNAUTHORIZED', message: 'No.' } }, 401);

      await expect(cuerpo(rpc.admin.seasons.$get())).rejects.toMatchObject({ status: 401 });
    });
  });
});
