/**
 * Bloqueo por intentos fallidos, por (cuenta, IP), con backoff progresivo.
 *
 * `REF6-6` / `S-4`. El bloqueo era por cuenta sola: cinco intentos fallidos,
 * desde cualquier lado, dejaban afuera a su dueño durante 15 minutos. El usuario
 * del admin es `admin` y los de las patrullas los publica
 * `/api/public/tournaments/:id`, así que dejar afuera al admin en pleno torneo
 * costaba cinco requests. Con el par (cuenta, IP) quien insiste se bloquea a sí
 * mismo, y el dueño —que entra desde otra IP— no se entera.
 *
 * **Es la primera de dos capas.** Por sí sola abre un hueco: adivinar un PIN
 * desde muchas IPs, cinco intentos por cada una. La segunda es el contador por
 * cuenta que se persiste en la base, con un umbral mucho más alto
 * (`authService`/`patrolAuthService`).
 *
 * **Reserva el intento al entrar y no lo anota al salir.** Mirar el contador antes
 * de verificar la clave y sumar el fallo después deja una ventana: una ráfaga de
 * requests simultáneos mira el contador antes de que el primero termine y pasan
 * todos. Acá el intento se cuenta apenas llega, de forma sincrónica, y un ingreso
 * correcto lo devuelve con `liberar`.
 *
 * **Se aplica igual a una cuenta que no existe.** Si sólo se bloquearan las
 * cuentas reales, el comportamiento del bloqueo distinguiría un usuario válido de
 * uno inventado: un oráculo para enumerarlos.
 *
 * Vive en memoria, como el rate limit: alcanza para el despliegue de un solo
 * contenedor (`docs/ARCHITECTURE.md` §3). Ver `docs/SECURITY.md` §3.3.
 */

import { AppError } from './errors.js';

export interface PoliticaDeBloqueo {
  /** Intentos que se dejan pasar; el siguiente dispara el bloqueo. */
  readonly intentos: number;
  /** Duración del primer bloqueo. Cada uno seguido dura el doble. */
  readonly baseMs: number;
  /** Lo máximo que puede durar un bloqueo. */
  readonly techoMs: number;
  /** Sin intentos durante este tiempo, el castigo vuelve a empezar de cero. */
  readonly olvidoMs: number;
}

interface Estado {
  intentos: number;
  /** Cuántos bloqueos seguidos lleva: de ahí sale la duración del próximo. */
  nivel: number;
  bloqueadoHasta: number;
  vistoEn: number;
}

const estados = new Map<string, Estado>();

/**
 * Tope de pares vivos. Una IP distinta por request abre un estado por request; sin
 * tope, el `Map` crece hasta agotar la memoria del proceso.
 */
export const MAX_ESTADOS = 10_000;

const segundos = (ms: number): number => Math.ceil(ms / 1000);

const estaOlvidado = (e: Estado, politica: PoliticaDeBloqueo, ahora: number): boolean =>
  e.bloqueadoHasta <= ahora && ahora - e.vistoEn > politica.olvidoMs;

function abrir(clave: string, politica: PoliticaDeBloqueo, ahora: number): Estado {
  if (estados.size >= MAX_ESTADOS) {
    for (const [k, e] of estados) if (estaOlvidado(e, politica, ahora)) estados.delete(k);
  }

  // Si no alcanza con lo olvidado, sale el más viejo: el `Map` conserva el orden
  // de inserción.
  while (estados.size >= MAX_ESTADOS) {
    const masViejo = estados.keys().next().value;
    if (masViejo === undefined) break;
    estados.delete(masViejo);
  }

  const estado: Estado = { intentos: 0, nivel: 0, bloqueadoHasta: 0, vistoEn: ahora };
  estados.set(clave, estado);
  return estado;
}

/**
 * Reserva un intento para la clave.
 *
 * @returns los segundos que faltan para poder volver a intentar si está bloqueada
 *   —o si este mismo intento dispara el bloqueo—, o `null` si puede seguir.
 */
export function reservarIntento(
  clave: string,
  politica: PoliticaDeBloqueo,
  ahora = Date.now(),
): number | null {
  let estado = estados.get(clave);

  if (estado && estaOlvidado(estado, politica, ahora)) {
    estados.delete(clave);
    estado = undefined;
  }
  estado ??= abrir(clave, politica, ahora);

  // Insistir mientras está bloqueada no cuenta ni lo alarga: sólo informa.
  if (estado.bloqueadoHasta > ahora) return segundos(estado.bloqueadoHasta - ahora);

  estado.vistoEn = ahora;
  estado.intentos++;
  if (estado.intentos <= politica.intentos) return null;

  const duracion = Math.min(politica.baseMs * 2 ** estado.nivel, politica.techoMs);
  estado.bloqueadoHasta = ahora + duracion;
  estado.nivel++;
  estado.intentos = 0;
  return segundos(duracion);
}

/** El `429` con `Retry-After` que corresponde a un bloqueo. */
export const errorDeBloqueo = (segundosDeEspera: number, message: string): AppError =>
  new AppError('RATE_LIMITED', {
    message,
    headers: { 'Retry-After': String(segundosDeEspera) },
  });

/** Un ingreso correcto: se olvida todo, castigo incluido. */
export function liberar(clave: string): void {
  estados.delete(clave);
}

/**
 * Suelta todas las IPs de una cuenta. Para cuando el dueño recupera el acceso por
 * otro camino —recuperar el password, regenerar el PIN—: seguir bloqueado después
 * de eso no tiene sentido.
 */
export function liberarCuenta(prefijo: string): void {
  for (const clave of estados.keys()) {
    if (clave.startsWith(prefijo)) estados.delete(clave);
  }
}

/** Sólo para tests: olvida todos los estados. */
export function resetBloqueos(): void {
  estados.clear();
}

/** Sólo para tests: cuántos estados hay hoy. */
export function estadosVivos(): number {
  return estados.size;
}
