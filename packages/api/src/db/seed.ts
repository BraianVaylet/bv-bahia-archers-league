/**
 * Siembra los datos mínimos para operar: el administrador inicial.
 *
 * **También es la vía de recuperación.** Si el admin se olvida el password no
 * hay recupero por mail —la liga no guarda mails de nadie— ni un segundo
 * administrador que pueda rescatarlo. Cambiar `ADMIN_INITIAL_PASSWORD` en las
 * variables del deploy y reiniciar es la única salida que no sea entrar a la
 * base a mano.
 *
 * Ver `docs/SECURITY.md` §3.1 y `docs/CONFIG.md` §4.3.
 */

import { type Db, ObjectId } from 'mongodb';
import { type Env, env as loadEnv } from '../env.js';
import { hashSecret, verifySecret } from '../lib/crypto.js';
import { type AuditLogDoc, COLLECTIONS, type UserDoc } from './types.js';

export interface SeedResult {
  readonly adminCreated: boolean;
  /** El operador cambió la variable y el password quedó reseteado. */
  readonly adminReset: boolean;
  readonly adminUsername: string;
}

/**
 * Si el `ADMIN_INITIAL_PASSWORD` de ahora es el mismo que se aplicó la última
 * vez.
 *
 * Se compara con `verifySecret` contra el hash guardado, no con una igualdad de
 * strings: el valor en claro **no se guarda en ningún lado**.
 *
 * Sin huella guardada —bases anteriores a este cambio— se responde que **no
 * cambió**. No se puede saber, y resetear ante la duda pisaría el password que
 * el admin eligió.
 */
async function laVariableEsLaMisma(admin: UserDoc, password: string): Promise<boolean> {
  if (!admin.initialPasswordHash) return true;
  return verifySecret(admin.initialPasswordHash, password);
}

/**
 * Crea el administrador inicial, o lo resetea si cambió la variable.
 *
 * El password sale de `ADMIN_INITIAL_PASSWORD`, **nunca del código**. En
 * producción el arranque ya falló si no estaba, si era el valor de desarrollo o
 * si tenía menos de 12 caracteres: ver `env.ts`.
 */
export async function seed(db: Db, env: Env = loadEnv()): Promise<SeedResult> {
  const users = db.collection<UserDoc>(COLLECTIONS.users);
  const username = env.ADMIN_USERNAME.toLowerCase();
  const ahora = new Date();

  const existente = await users.findOne({ username });

  if (!existente) {
    await users.insertOne({
      username,
      passwordHash: await hashSecret(env.ADMIN_INITIAL_PASSWORD),
      initialPasswordHash: await hashSecret(env.ADMIN_INITIAL_PASSWORD),
      // Obliga a cambiarlo en el primer login: el password del deploy no puede
      // quedar como password permanente.
      mustChangePassword: true,
      lastLoginAt: null,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: ahora,
      updatedAt: ahora,
    } as UserDoc);

    return { adminCreated: true, adminReset: false, adminUsername: username };
  }

  if (await laVariableEsLaMisma(existente, env.ADMIN_INITIAL_PASSWORD)) {
    /*
      Se guarda la huella si faltaba, sin tocar el password.

      Es lo que deja a las bases anteriores en condiciones de usar el reset la
      próxima vez, sin pisar nada esta vez.
    */
    if (!existente.initialPasswordHash) {
      await users.updateOne(
        { _id: existente._id },
        {
          $set: {
            initialPasswordHash: await hashSecret(env.ADMIN_INITIAL_PASSWORD),
            updatedAt: ahora,
          },
        },
      );
    }

    return { adminCreated: false, adminReset: false, adminUsername: username };
  }

  /*
    La variable cambió: el operador está recuperando el acceso.

    Se limpian los intentos fallidos y el bloqueo **a propósito**. Que el admin
    esté bloqueado por fuerza bruta es justo lo que puede haber pasado antes de
    que el dueño busque cómo recuperar la cuenta; si el reset no levanta el
    bloqueo, cambia la variable, reinicia, y sigue afuera.
  */
  await users.updateOne(
    { _id: existente._id },
    {
      $set: {
        passwordHash: await hashSecret(env.ADMIN_INITIAL_PASSWORD),
        initialPasswordHash: await hashSecret(env.ADMIN_INITIAL_PASSWORD),
        // El de rescate es de paso, no permanente.
        mustChangePassword: true,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: ahora,
      },
    },
  );

  /*
    Queda registrado: es un cambio de credenciales hecho **desde afuera de la
    aplicación**, sin sesión y sin usuario que lo pida.

    `meta` no lleva el password ni su hash — la regla de `SECURITY.md` para el
    audit log es que ahí no va nada sensible, y acá el dato en juego es
    exactamente una credencial.
  */
  await db.collection<AuditLogDoc>(COLLECTIONS.auditLog).insertOne({
    _id: new ObjectId(),
    at: ahora,
    actorType: 'system',
    actorId: null,
    action: 'admin.password_reset',
    entity: 'user',
    entityId: existente._id,
    meta: { motivo: 'cambió ADMIN_INITIAL_PASSWORD', username },
    ip: null,
  });

  return { adminCreated: false, adminReset: true, adminUsername: username };
}
