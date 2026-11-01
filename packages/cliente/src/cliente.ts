/**
 * Cliente HTTP único de los dos frontends (`REF6-11` / `C-4`).
 *
 * Había dos: `app/src/lib/apiClient.ts` y `landing/src/lib/api.ts`. Duplicaban la lógica
 * de CSRF y tenían dos `ApiError` con formas distintas (el de la landing sin `code` ni
 * `details`). Un cambio en cómo se maneja el token tenía que acordarse en los dos lados.
 *
 * Adjunta el token CSRF en toda mutación, **de forma automática**: si hace falta acordarse
 * de ponerlo en cada llamada, alguna se va a olvidar. Ver `docs/SECURITY.md` §8.
 */

const CSRF_COOKIE = 'bal_csrf';
const CSRF_HEADER = 'x-csrf-token';
const MUTACIONES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const MENSAJE_POR_DEFECTO = 'Ocurrió un error inesperado.';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface OpcionesDelCliente {
  /** Dónde cuelga la API para este frontend: `/api` en la PWA, `/api/public` en la landing. */
  readonly base: string;
  /**
   * Dónde se pide el token CSRF. Es **absoluta**: la landing cuelga de `/api/public`, pero el
   * CSRF es común a toda la API, no sólo a lo público.
   */
  readonly rutaCsrf?: string;
  /** Qué decir cuando el servidor falla sin explicar por qué, según se lea o se escriba. */
  readonly mensajes?: { readonly lectura?: string; readonly escritura?: string };
}

export interface OpcionesDePedido {
  readonly method?: string;
  readonly body?: unknown;
  readonly signal?: AbortSignal;
}

export interface Cliente {
  readonly request: <T>(path: string, opciones?: OpcionesDePedido) => Promise<T>;
  readonly api: {
    readonly get: <T>(path: string, signal?: AbortSignal) => Promise<T>;
    readonly post: <T>(path: string, body?: unknown) => Promise<T>;
    readonly put: <T>(path: string, body: unknown) => Promise<T>;
    readonly patch: <T>(path: string, body: unknown) => Promise<T>;
    readonly del: <T>(path: string) => Promise<T>;
  };
}

function leerCookie(nombre: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${nombre}=`))
    ?.slice(nombre.length + 1);
}

export function crearCliente(opciones: OpcionesDelCliente): Cliente {
  const { base, rutaCsrf = '/api/auth/csrf', mensajes } = opciones;

  /** Asegura la cookie CSRF antes de la primera mutación. */
  async function asegurarCsrf(): Promise<string | undefined> {
    const existente = leerCookie(CSRF_COOKIE);
    if (existente) return existente;

    await fetch(rutaCsrf, { credentials: 'same-origin' });
    return leerCookie(CSRF_COOKIE);
  }

  async function request<T>(path: string, pedido: OpcionesDePedido = {}): Promise<T> {
    const method = pedido.method ?? 'GET';
    const esMutacion = MUTACIONES.has(method);
    const headers = new Headers();

    if (pedido.body !== undefined) headers.set('content-type', 'application/json');

    if (esMutacion) {
      const token = await asegurarCsrf();
      if (token) headers.set(CSRF_HEADER, token);
    }

    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      ...(pedido.body !== undefined ? { body: JSON.stringify(pedido.body) } : {}),
      ...(pedido.signal ? { signal: pedido.signal } : {}),
    });

    if (res.status === 204) return undefined as T;

    // **Un cuerpo que no es JSON sale como `SyntaxError`, a propósito.** El wifi del club tiene un
    // portal cautivo que contesta `200` con una página HTML. El outbox de WAFL trata cualquier
    // error sin `status` como «no sé qué pasó» y reintenta; si esto fuera un `ApiError(200, …)`,
    // `esReintentable` diría que no y la op se descartaría: un puntaje perdido por un portal.
    const texto = await res.text();
    const cuerpo = texto ? (JSON.parse(texto) as unknown) : {};

    if (!res.ok) {
      const error = (
        cuerpo as { error?: { code: string; message: string; details?: Record<string, unknown> } }
      ).error;
      const porDefecto =
        (esMutacion ? mensajes?.escritura : mensajes?.lectura) ?? MENSAJE_POR_DEFECTO;

      throw new ApiError(
        res.status,
        error?.code ?? 'INTERNAL',
        error?.message ?? porDefecto,
        error?.details,
      );
    }

    return cuerpo as T;
  }

  return {
    request,
    api: {
      get: <T>(path: string, signal?: AbortSignal) => request<T>(path, signal ? { signal } : {}),
      post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
      put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body }),
      patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
      del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
    },
  };
}
