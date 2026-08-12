/**
 * Cliente HTTP del sitio público.
 *
 * Mucho más simple que el de la PWA: acá **todo es lectura**. Sin sesión, sin
 * CSRF, sin outbox. Si algo falla, se dice y se sigue.
 */

const BASE = import.meta.env.VITE_API_BASE ?? '/api/public';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'same-origin',
    ...(signal ? { signal } : {}),
  });

  const texto = await res.text();
  const cuerpo = texto ? (JSON.parse(texto) as unknown) : {};

  if (!res.ok) {
    const error = (cuerpo as { error?: { message: string } }).error;
    throw new ApiError(res.status, error?.message ?? 'No se pudo cargar la información.');
  }

  return cuerpo as T;
}
