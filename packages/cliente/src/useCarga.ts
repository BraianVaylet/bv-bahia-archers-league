/**
 * Carga de datos, común a WAFA y a la landing (`REF6-11` / `C-2`).
 *
 * Cada página de WAFA reimplementaba `useState` + `useEffect` + `try/catch` + `setError`, sin
 * cancelación; la landing tenía su propio `useRecurso` con `AbortController`. Y
 * `@tanstack/react-query` estaba entre las dependencias sin importarse en ningún lado. La
 * decisión (informe, decisión 3) fue **un hook propio**: WAFA es chica, y esto suma cero bytes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './cliente.js';

const MENSAJE_DE_CONEXION = 'No se pudo conectar. Probá de nuevo en un rato.';

export interface OpcionesDeCarga {
  /**
   * Qué mostrar cuando la carga falla. Un texto fijo, sea cual sea el error —las pantallas
   * tienen el suyo: «No se pudo cargar el torneo. Revisá la conexión.»—, o una función. Por
   * defecto: el mensaje de un `ApiError`, o uno de conexión para cualquier otra cosa.
   */
  readonly mensajeDeError?: string | ((error: unknown) => string);
  /**
   * Al cambiar las claves, **conserva lo que ya se ve** hasta que lleguen los datos nuevos, en vez de
   * descartarlo. Para los filtros de una lista: la búsqueda o «ver archivados» piden el mismo recurso
   * con otra consulta, y si cada tecla vaciara la lista para mostrar «Cargando…», el padrón
   * parpadearía mientras se escribe. Por defecto no: pasar del torneo A al B no puede mostrar, ni un
   * instante, los datos de A.
   */
  readonly conservarDatos?: boolean;
}

export interface Carga<T> {
  /** Lo último que llegó. Se conserva mientras se recarga; se descarta al cambiar de recurso. */
  readonly datos: T | undefined;
  /** Hay una carga en vuelo que se tiene que ver. Una recarga silenciosa no cuenta. */
  readonly cargando: boolean;
  readonly error: string | undefined;
  /**
   * Vuelve a pedir. Estable entre renders: se puede usar de dependencia de un efecto.
   *
   * Con `silencioso` (el refresco automático) no pasa por «cargando», un fallo no muestra nada
   * y un éxito no borra un error anterior: lo que ya se ve sigue siendo lo mejor que hay, y el
   * motivo por el que el servidor rechazó la última acción tiene que poder leerse. Y si ya hay una
   * carga en vuelo, no manda otra.
   */
  readonly recargar: (opciones?: { readonly silencioso?: boolean }) => Promise<void>;
}

function mensajeDe(error: unknown, opcion: OpcionesDeCarga['mensajeDeError']): string {
  if (typeof opcion === 'string') return opcion;
  if (typeof opcion === 'function') return opcion(error);
  return error instanceof ApiError ? error.message : MENSAJE_DE_CONEXION;
}

/** El resultado de un pedido, sin lanzar: así quien lo usa decide qué hacer sin `try/catch`. */
type Resultado<T> =
  | { readonly ok: true; readonly datos: T }
  | { readonly ok: false; readonly error: unknown };

async function intentar<T>(
  cargar: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
): Promise<Resultado<T>> {
  try {
    return { ok: true, datos: await cargar(signal) };
  } catch (error) {
    return { ok: false, error };
  }
}

interface Efectos<T> {
  readonly setDatos: (datos: T) => void;
  readonly setError: (mensaje: string | undefined) => void;
}

/**
 * Qué se ve cuando terminó un pedido que no se canceló.
 *
 * Una recarga silenciosa no toca el error: si falla, no se ve, y si sale bien no borra el motivo por
 * el que otra cosa había fallado.
 */
function mostrar<T>(
  resultado: Resultado<T>,
  silencioso: boolean,
  mensajeDeError: OpcionesDeCarga['mensajeDeError'],
  { setDatos, setError }: Efectos<T>,
): void {
  if (resultado.ok) {
    setDatos(resultado.datos);
    if (!silencioso) setError(undefined);
  } else if (!silencioso) {
    setError(mensajeDe(resultado.error, mensajeDeError));
  }
}

/**
 * @param cargar lo que se pide. Recibe la señal de cancelación.
 * @param claves de qué depende lo que se pide (un id, una ruta): al cambiar, es **otro recurso**.
 */
export function useCarga<T>(
  cargar: (signal: AbortSignal) => Promise<T>,
  claves: readonly unknown[],
  opciones: OpcionesDeCarga = {},
): Carga<T> {
  const [datos, setDatos] = useState<T>();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string>();

  // La última versión de lo que se pide: cada render crea una función nueva, y si el efecto
  // dependiera de ella cargaría de nuevo en cada render.
  const ultima = useRef({ cargar, opciones });
  ultima.current = { cargar, opciones };

  const control = useRef<AbortController | undefined>(undefined);
  const enVuelo = useRef(false);

  const pedir = useCallback(async (silencioso: boolean): Promise<void> => {
    if (silencioso && enVuelo.current) return;

    // Pedir de nuevo cancela lo anterior: una respuesta vieja no puede pisar a la nueva.
    control.current?.abort();
    const propio = new AbortController();
    control.current = propio;
    enVuelo.current = true;
    if (!silencioso) setCargando(true);

    const resultado = await intentar(ultima.current.cargar, propio.signal);

    // Un aborto no es un error ni un dato: pasa al cambiar de pantalla antes de que llegue.
    if (!propio.signal.aborted) {
      mostrar(resultado, silencioso, ultima.current.opciones.mensajeDeError, {
        setDatos,
        setError,
      });
    }

    if (control.current === propio) {
      enVuelo.current = false;
      if (!silencioso) setCargando(false);
    }
  }, []);

  useEffect(() => {
    // Otro recurso: lo del anterior no se muestra ni un instante. Salvo que sea el mismo con otra
    // consulta (`conservarDatos`): ahí se queda hasta que llegue lo nuevo.
    if (!ultima.current.opciones.conservarDatos) {
      setDatos(undefined);
      setError(undefined);
    }
    void pedir(false);

    return () => control.current?.abort();
    // biome-ignore lint/correctness/useExhaustiveDependencies: `claves` es justamente la lista que dice cuándo es otro recurso: la pone quien llama, y no se puede escribir como un literal.
  }, claves);

  const recargar = useCallback(
    (o?: { readonly silencioso?: boolean }) => pedir(o?.silencioso ?? false),
    [pedir],
  );

  return { datos, cargando, error, recargar };
}

export type Recurso<T> =
  | { readonly estado: 'cargando' }
  | { readonly estado: 'listo'; readonly datos: T }
  | { readonly estado: 'error'; readonly mensaje: string };

/**
 * Una lectura de sólo lectura, con los tres estados **explícitos**. Sin `cargando`, la primera
 * pintada mostraría «no hay nada» a alguien cuyos datos están en camino, que es el error más fácil
 * de cometer en una pantalla de lectura.
 *
 * Con `path` en `null` no pide nada: la ruta todavía no se conoce.
 */
export function useRecurso<T>(
  cliente: { readonly get: <R>(path: string, signal?: AbortSignal) => Promise<R> },
  path: string | null,
): Recurso<T> {
  const { datos, error } = useCarga<T>(
    (signal) => (path === null ? new Promise<T>(() => {}) : cliente.get<T>(path, signal)),
    [cliente, path],
  );

  if (error !== undefined) return { estado: 'error', mensaje: error };
  if (datos === undefined) return { estado: 'cargando' };
  return { estado: 'listo', datos };
}
