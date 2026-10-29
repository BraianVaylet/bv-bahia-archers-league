/**
 * Cliente HTTP del sitio público.
 *
 * Casi todo acá es lectura, sin sesión. `post` es la excepción —desde
 * `BE-20`/`FE-27`, el alta de arquero— y por eso sí necesita CSRF: el
 * middleware lo exige en toda mutación de `/api/*`, autoregistro incluido.
 * Sin outbox: a diferencia de WAFL, una alta que falla no se reintenta sola.
 */

const BASE = import.meta.env.VITE_API_BASE ?? '/api/public';
const CSRF_COOKIE = 'bal_csrf';
const CSRF_HEADER = 'x-csrf-token';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function leerCookie(nombre: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${nombre}=`))
    ?.slice(nombre.length + 1);
}

/**
 * Asegura la cookie CSRF antes de la primera mutación.
 *
 * `/api/auth/csrf` es **absoluta**, no relativa a `BASE`: `BASE` es
 * `/api/public`, pero el CSRF es común a toda la API, no sólo a lo público.
 */
async function asegurarCsrf(): Promise<string | undefined> {
  const existente = leerCookie(CSRF_COOKIE);
  if (existente) return existente;

  await fetch('/api/auth/csrf', { credentials: 'same-origin' });
  return leerCookie(CSRF_COOKIE);
}

async function respuesta<T>(res: Response, mensajePorDefecto: string): Promise<T> {
  const texto = await res.text();
  const cuerpo = texto ? (JSON.parse(texto) as unknown) : {};

  if (!res.ok) {
    const error = (cuerpo as { error?: { message: string } }).error;
    throw new ApiError(res.status, error?.message ?? mensajePorDefecto);
  }

  return cuerpo as T;
}

export async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'same-origin',
    ...(signal ? { signal } : {}),
  });

  return respuesta<T>(res, 'No se pudo cargar la información.');
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const token = await asegurarCsrf();
  const headers = new Headers({ 'content-type': 'application/json' });
  if (token) headers.set(CSRF_HEADER, token);

  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });

  return respuesta<T>(res, 'No se pudo enviar. Revisá la conexión.');
}
