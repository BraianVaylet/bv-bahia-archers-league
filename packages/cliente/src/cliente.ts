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
  /**
   * Un `fetch` con el CSRF y los errores resueltos, para el cliente RPC de Hono (`hc`): éste arma
   * la URL y el cuerpo, y lo que se manda pasa por acá. **No agrega la base**: la URL ya viene
   * entera. Si el servidor rechaza, lanza `ApiError`; si sale bien, devuelve la respuesta **sin
   * leerla**.
   */
  readonly fetch: (input: Entrada, init?: RequestInit) => Promise<Response>;
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

/**
 * El `csrfToken` del cuerpo de `/api/auth/csrf`, o `undefined` si la respuesta no salió bien o no
 * trae uno: un portal cautivo responde HTML con un 200, y eso no debe romper la mutación (que
 * sale igual, sin header, y el servidor la rechaza con su mensaje).
 */
async function tokenDelCuerpo(res: Response): Promise<string | undefined> {
  if (!res.ok) return undefined;

  try {
    const { csrfToken } = (await res.json()) as { csrfToken?: unknown };
    return typeof csrfToken === 'string' ? csrfToken : undefined;
  } catch {
    return undefined;
  }
}

type Entrada = string | URL | Request;

const metodoDe = (input: Entrada, init: RequestInit): string =>
  (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();

/**
 * Pasar `headers` en `init` reemplaza los del `Request`, no los suma: si el pedido ya traía los
 * suyos, se parte de ésos.
 */
const cabecerasDe = (input: Entrada, init: RequestInit): Headers =>
  new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));

/**
 * El `ApiError` de una respuesta que no salió bien.
 *
 * **Un cuerpo que no es JSON sale como `SyntaxError`, a propósito.** El wifi del club tiene un
 * portal cautivo que contesta con una página HTML. El outbox de WAFL trata cualquier error sin
 * `status` como «no sé qué pasó» y reintenta; si esto fuera un `ApiError`, `esReintentable` diría
 * que no y la op se descartaría: un puntaje perdido por un portal.
 */
async function rechazoDe(res: Response, porDefecto: string): Promise<ApiError> {
  const texto = await res.text();
  const cuerpo = texto ? (JSON.parse(texto) as unknown) : {};
  const error = (
    cuerpo as { error?: { code: string; message: string; details?: Record<string, unknown> } }
  ).error;

  return new ApiError(
    res.status,
    error?.code ?? 'INTERNAL',
    error?.message ?? porDefecto,
    error?.details,
  );
}

export function crearCliente(opciones: OpcionesDelCliente): Cliente {
  const { base, rutaCsrf = '/api/auth/csrf', mensajes } = opciones;

  /**
   * Asegura la cookie CSRF antes de la primera mutación.
   *
   * Si el navegador todavía no deja ver la cookie recién recibida, se usa el token del cuerpo
   * (`/api/auth/csrf` lo devuelve): WebKit en Linux la muestra recién en el turno siguiente, y el
   * primer POST de quien llega a `/alta` sin ninguna petición previa salía sin header y volvía 403.
   * El navegador igual manda la cookie, así que el par cookie/header coincide.
   */
  async function asegurarCsrf(): Promise<string | undefined> {
    const existente = leerCookie(CSRF_COOKIE);
    if (existente) return existente;

    const res = await fetch(rutaCsrf, { credentials: 'same-origin' });
    return leerCookie(CSRF_COOKIE) ?? (await tokenDelCuerpo(res));
  }

  /**
   * Manda el pedido con el CSRF y convierte un rechazo en `ApiError`. Es lo común a `request` y a
   * `fetch`: leer el cuerpo de una respuesta que salió bien es cosa de cada uno.
   */
  async function enviar(input: Entrada, init: RequestInit = {}): Promise<Response> {
    const esMutacion = MUTACIONES.has(metodoDe(input, init));
    const headers = cabecerasDe(input, init);

    if (esMutacion) {
      const token = await asegurarCsrf();
      if (token) headers.set(CSRF_HEADER, token);
    }

    const res = await fetch(input instanceof Request ? input : String(input), {
      ...init,
      headers,
      credentials: 'same-origin',
    });

    if (res.ok) return res;

    throw await rechazoDe(
      res,
      (esMutacion ? mensajes?.escritura : mensajes?.lectura) ?? MENSAJE_POR_DEFECTO,
    );
  }

  async function request<T>(path: string, pedido: OpcionesDePedido = {}): Promise<T> {
    const headers = new Headers();
    if (pedido.body !== undefined) headers.set('content-type', 'application/json');

    const res = await enviar(`${base}${path}`, {
      method: pedido.method ?? 'GET',
      headers,
      ...(pedido.body !== undefined ? { body: JSON.stringify(pedido.body) } : {}),
      ...(pedido.signal ? { signal: pedido.signal } : {}),
    });

    if (res.status === 204) return undefined as T;

    // Lo mismo del portal cautivo, del lado de los `200`: si no es JSON, `JSON.parse` lanza.
    const texto = await res.text();
    return (texto ? JSON.parse(texto) : {}) as T;
  }

  return {
    request,
    fetch: enviar,
    api: {
      get: <T>(path: string, signal?: AbortSignal) => request<T>(path, signal ? { signal } : {}),
      post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
      put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body }),
      patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
      del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
    },
  };
}
