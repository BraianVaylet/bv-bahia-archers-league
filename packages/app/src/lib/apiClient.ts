/**
 * Cliente HTTP.
 *
 * Adjunta el token CSRF en toda mutación, de forma automática: si hace falta
 * acordarse de ponerlo en cada llamada, alguna se va a olvidar.
 *
 * Ver `docs/SECURITY.md` §8.
 */

const BASE = import.meta.env.VITE_API_BASE ?? '/api';
const CSRF_COOKIE = 'bal_csrf';
const CSRF_HEADER = 'x-csrf-token';

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

function leerCookie(nombre: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${nombre}=`))
    ?.slice(nombre.length + 1);
}

/** Asegura la cookie CSRF antes de la primera mutación. */
async function asegurarCsrf(): Promise<string | undefined> {
  const existente = leerCookie(CSRF_COOKIE);
  if (existente) return existente;

  await fetch(`${BASE}/auth/csrf`, { credentials: 'same-origin' });
  return leerCookie(CSRF_COOKIE);
}

const MUTACIONES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface RequestOptions {
  readonly method?: string;
  readonly body?: unknown;
  readonly signal?: AbortSignal;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers = new Headers();

  if (options.body !== undefined) headers.set('content-type', 'application/json');

  if (MUTACIONES.has(method)) {
    const token = await asegurarCsrf();
    if (token) headers.set(CSRF_HEADER, token);
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (res.status === 204) return undefined as T;

  const texto = await res.text();
  const cuerpo = texto ? (JSON.parse(texto) as unknown) : {};

  if (!res.ok) {
    const error = (
      cuerpo as { error?: { code: string; message: string; details?: Record<string, unknown> } }
    ).error;
    throw new ApiError(
      res.status,
      error?.code ?? 'INTERNAL',
      error?.message ?? 'Ocurrió un error inesperado.',
      error?.details,
    );
  }

  return cuerpo as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, signal ? { signal } : {}),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
