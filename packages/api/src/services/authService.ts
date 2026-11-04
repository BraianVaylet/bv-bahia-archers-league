/**
 * Autenticación de administrador.
 *
 * Ver `docs/SECURITY.md` §3.1 y §8.
 */

import { timingSafeEqual } from 'node:crypto';
import type { AdminLoginInput, ChangePasswordInput, RecoverAdminInput } from '@bal/shared';
import type { Context } from 'hono';
import { env } from '../env.js';
import {
  errorDeBloqueo,
  liberar,
  liberarCuenta,
  type PoliticaDeBloqueo,
  reservarIntento,
} from '../lib/bloqueoDeIngreso.js';
import { getDummyHash, hashSecret, sha256, verifySecret } from '../lib/crypto.js';
import { AppError } from '../lib/errors.js';
import { ipDelCliente } from '../lib/ip.js';
import { endAllSessionsFor, startSession } from '../lib/session.js';
import * as auditRepo from '../repositories/auditRepo.js';
import * as userRepo from '../repositories/userRepo.js';

export interface AdminSessionInfo {
  readonly id: string;
  readonly username: string;
  readonly mustChangePassword: boolean;
}

/**
 * El bloqueo de una IP contra una cuenta: cinco intentos, y después 15 minutos que
 * se duplican con cada bloqueo seguido hasta una hora. Ver `lib/bloqueoDeIngreso.ts`.
 */
export const POLITICA_ADMIN: PoliticaDeBloqueo = {
  intentos: 5,
  baseMs: 15 * 60_000,
  techoMs: 60 * 60_000,
  olvidoMs: 60 * 60_000,
};

/**
 * El tope por cuenta, sumando **todas** las IPs, que se persiste en la base.
 *
 * Es la segunda capa y tiene que ser mucho más alta que la primera. A cinco, volvía
 * a ser lo de antes: cualquiera dejaba afuera al admin con cinco requests. Pero
 * tiene que existir: sin ella, adivinar la clave desde muchas IPs —cinco intentos
 * por cada una— no tiene techo.
 */
const MAX_INTENTOS_POR_CUENTA = 30;
const BLOQUEO_MS = 15 * 60_000;

/** Mismo error para usuario inexistente y password incorrecto: no se puede enumerar. */
const credencialesInvalidas = () =>
  new AppError('UNAUTHORIZED', { message: 'Usuario o password incorrectos.' });

/**
 * Verifica las credenciales del admin y abre la sesión.
 *
 * **Timing-safe**: si el usuario no existe se compara igual contra un hash de
 * referencia. Sin eso, un login contra una cuenta inexistente responde en
 * microsegundos y uno contra una real tarda lo que tarda argon2id, y esa
 * diferencia permite enumerar cuentas midiendo el tiempo.
 */
export async function loginAdmin(c: Context, input: AdminLoginInput): Promise<AdminSessionInfo> {
  // Primero y antes de tocar la base: el intento se reserva de forma sincrónica, así
  // una ráfaga no mira el contador antes de que el primero termine. Y se aplica
  // aunque el usuario no exista, o el bloqueo distinguiría uno real de uno inventado.
  const clave = `admin:${input.username}:${ipDelCliente(c) ?? 'desconocida'}`;
  const espera = reservarIntento(clave, POLITICA_ADMIN);
  if (espera !== null) {
    throw errorDeBloqueo(espera, 'Demasiados intentos fallidos. Probá de nuevo en un rato.');
  }

  const user = await userRepo.findByUsername(input.username);

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const segundos = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
    throw new AppError('RATE_LIMITED', {
      message: 'Demasiados intentos fallidos. Probá de nuevo en un rato.',
      headers: { 'Retry-After': String(segundos) },
    });
  }

  const hash = user?.passwordHash ?? (await getDummyHash());
  const coincide = await verifySecret(hash, input.password);

  if (!user || !coincide) {
    if (user) {
      await userRepo.registerFailedAttempt(user._id, MAX_INTENTOS_POR_CUENTA, BLOQUEO_MS);
    }
    throw credencialesInvalidas();
  }

  liberar(clave);
  await userRepo.registerSuccessfulLogin(user._id);
  await startSession(c, { type: 'admin', id: user._id });

  // Sólo los correctos: un `401` por request llenaría el log con el ruido de
  // cualquier bot, y los intentos fallidos ya tienen su freno.
  await auditRepo.record({
    actorType: 'admin',
    actorId: user._id,
    action: 'admin.login',
    entity: 'user',
    entityId: user._id,
    ip: ipDelCliente(c),
  });

  return {
    id: user._id.toHexString(),
    username: user.username,
    mustChangePassword: user.mustChangePassword,
  };
}

/**
 * Cambia el password del admin.
 *
 * Invalida **todas** las demás sesiones: si el motivo del cambio es que el
 * password se filtró, dejar vivas las sesiones abiertas no arregla nada.
 */
export async function changeAdminPassword(
  c: Context,
  userId: import('mongodb').ObjectId,
  input: ChangePasswordInput,
): Promise<void> {
  const user = await userRepo.findById(userId);
  if (!user) throw new AppError('UNAUTHORIZED');

  if (!(await verifySecret(user.passwordHash, input.currentPassword))) {
    throw new AppError('UNAUTHORIZED', { message: 'El password actual no es correcto.' });
  }

  await userRepo.updatePassword(userId, await hashSecret(input.newPassword));
  await endAllSessionsFor('admin', userId);

  // La sesión actual también se invalidó, así que se abre una nueva: el usuario
  // acaba de demostrar que conoce el password.
  await startSession(c, { type: 'admin', id: userId });
}

/** Datos del admin de la sesión, para `GET /api/auth/me`. */
export async function getAdminInfo(
  userId: import('mongodb').ObjectId,
): Promise<AdminSessionInfo | null> {
  const user = await userRepo.findById(userId);
  if (!user) return null;

  return {
    id: user._id.toHexString(),
    username: user.username,
    mustChangePassword: user.mustChangePassword,
  };
}

/** Configuración del bloqueo, expuesta para los tests. */
export const LOCK_POLICY = { maxAttempts: MAX_INTENTOS_POR_CUENTA, lockMs: BLOQUEO_MS } as const;

/** Ventana de rate limit del login, en milisegundos. */
export const loginWindowMs = (): number => env().RATE_LIMIT_LOGIN_WINDOW_MIN * 60_000;

/**
 * Recupera el password del admin con el código de `ADMIN_INITIAL_PASSWORD`.
 *
 * **La estrategia anterior resetear al arrancar— era inútil el día del torneo**,
 * que es el único momento en que esto hace falta: exigía un redeploy. Ahora la
 * variable funciona como código de recuperación y se ingresa desde el login.
 *
 * Es la **única ruta sin sesión que cambia una credencial**, así que:
 *
 * - La comparación del código es de **tiempo constante**. Un `===` sobre strings
 *   corta en el primer carácter distinto, y esa diferencia deja adivinar el
 *   código de a un carácter por vez contra el servidor.
 * - El error es **el mismo** para código incorrecto que para password inválido:
 *   distinguirlos convierte el endpoint en un oráculo.
 * - Se cierran **todas** las sesiones del admin. Si el motivo de recuperar es
 *   que alguien más entró, dejar su sesión viva no arregla nada.
 * - Se levanta el bloqueo por intentos fallidos: es justo lo que puede haber
 *   pasado antes de que el dueño busque cómo recuperar la cuenta.
 */
export async function recoverAdminPassword(input: RecoverAdminInput): Promise<void> {
  const cfg = env();
  const esperado = Buffer.from(sha256(cfg.ADMIN_INITIAL_PASSWORD), 'hex');
  const recibido = Buffer.from(sha256(input.recoverySecret), 'hex');

  /*
    Se comparan los digest y no los valores: `timingSafeEqual` exige largos
    iguales, y dos secretos de largo distinto lo harían tirar — con lo cual el
    largo del código quedaría expuesto por la forma de fallar.
  */
  const correcto = timingSafeEqual(esperado, recibido);

  const admin = await userRepo.findByUsername(cfg.ADMIN_USERNAME.toLowerCase());

  if (!correcto || !admin) {
    if (admin) {
      await auditRepo.record({
        actorType: 'system',
        actorId: null,
        action: 'admin.recovery_failed',
        entity: 'user',
        entityId: admin._id,
        meta: { username: admin.username },
      });
    }

    // El mismo mensaje que un login fallido: no dice qué dato estuvo mal.
    throw credencialesInvalidas();
  }

  await userRepo.recoverPassword(admin._id, await hashSecret(input.newPassword));
  await endAllSessionsFor('admin', admin._id);
  // El dueño recuperó el acceso por otro camino: seguir bloqueado después de eso,
  // desde la IP que sea, no tiene sentido.
  liberarCuenta(`admin:${admin.username}:`);

  await auditRepo.record({
    actorType: 'system',
    actorId: null,
    action: 'admin.password_recovered',
    entity: 'user',
    entityId: admin._id,
    // Nunca el código ni el password: `SECURITY.md` §11.
    meta: { username: admin.username },
  });
}
