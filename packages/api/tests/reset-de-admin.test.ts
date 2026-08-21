import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, users } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import { resetEnvCache } from '../src/env.js';
import { verifySecret } from '../src/lib/crypto.js';
import { clearDb, startDb, stopDb, testEnv, testEnvRaw } from './helpers.js';

/**
 * Recuperar el acceso del administrador cambiando `ADMIN_INITIAL_PASSWORD`.
 *
 * **Es la única salida si el admin se olvida el password.** No hay recupero por
 * mail —la liga no guarda mails de nadie— ni un segundo administrador que
 * pueda rescatarlo. Sin esto, olvidarse la clave significa entrar a la base a
 * mano.
 *
 * El mecanismo es deliberadamente el mismo que el del primer arranque: quien
 * controla las variables de entorno del deploy ya controla la aplicación
 * entera, así que no agrega una superficie nueva. Lo que sí hace falta es que
 * **el valor viejo no siga sirviendo**: si redesplegar con la misma variable
 * reseteara el password, cada deploy pisaría el que el admin eligió.
 */

const PASSWORD_INICIAL = 'password-de-arranque-largo';
const PASSWORD_NUEVO = 'el-que-eligio-el-admin';
const PASSWORD_DE_RESCATE = 'password-de-rescate-largo';

let db: Db;

beforeAll(async () => {
  Object.assign(process.env, testEnvRaw());
  resetEnvCache();
  db = await startDb();
}, 120_000);

afterAll(async () => {
  await stopDb();
});

beforeEach(async () => {
  await clearDb(db);
});

/** El entorno con un `ADMIN_INITIAL_PASSWORD` puntual. */
const conPassword = (password: string) => ({ ...testEnv(), ADMIN_INITIAL_PASSWORD: password });

/** Simula que el admin entró y eligió su propio password. */
async function elAdminEligeElSuyo(password: string) {
  const { hashSecret } = await import('../src/lib/crypto.js');
  await users().updateOne(
    {},
    { $set: { passwordHash: await hashSecret(password), mustChangePassword: false } },
  );
}

describe('reset del admin por variable de entorno', () => {
  it('el primer arranque crea el admin y obliga a cambiar el password', async () => {
    const r = await seed(db, conPassword(PASSWORD_INICIAL));

    expect(r.adminCreated).toBe(true);
    const admin = await users().findOne({});
    expect(admin?.mustChangePassword).toBe(true);
    expect(await verifySecret(admin?.passwordHash ?? '', PASSWORD_INICIAL)).toBe(true);
  });

  /**
   * **Lo que ya funcionaba y no puede romperse.** Si cada arranque pisara el
   * password, el que el admin eligió duraría hasta el próximo deploy.
   */
  it('arrancar de nuevo con la MISMA variable no toca nada', async () => {
    await seed(db, conPassword(PASSWORD_INICIAL));
    await elAdminEligeElSuyo(PASSWORD_NUEVO);

    const r = await seed(db, conPassword(PASSWORD_INICIAL));

    expect(r.adminReset).toBe(false);
    const admin = await users().findOne({});
    expect(await verifySecret(admin?.passwordHash ?? '', PASSWORD_NUEVO)).toBe(true);
    expect(admin?.mustChangePassword).toBe(false);
  });

  /** El caso del pedido: el operador cambia el secreto para recuperar acceso. */
  it('cambiar la variable resetea el password y vuelve a exigir uno nuevo', async () => {
    await seed(db, conPassword(PASSWORD_INICIAL));
    await elAdminEligeElSuyo(PASSWORD_NUEVO);

    const r = await seed(db, conPassword(PASSWORD_DE_RESCATE));

    expect(r.adminReset).toBe(true);
    const admin = await users().findOne({});
    expect(await verifySecret(admin?.passwordHash ?? '', PASSWORD_DE_RESCATE)).toBe(true);

    // El de rescate es de paso, no permanente: se cambia al entrar.
    expect(admin?.mustChangePassword).toBe(true);
  });

  /** El que el admin había elegido deja de servir: si no, el reset no resetea. */
  it('después del reset, el password viejo ya no entra', async () => {
    await seed(db, conPassword(PASSWORD_INICIAL));
    await elAdminEligeElSuyo(PASSWORD_NUEVO);
    await seed(db, conPassword(PASSWORD_DE_RESCATE));

    const admin = await users().findOne({});
    expect(await verifySecret(admin?.passwordHash ?? '', PASSWORD_NUEVO)).toBe(false);
  });

  /**
   * **Un admin bloqueado por intentos fallidos tiene que poder recuperarse.**
   *
   * El bloqueo por fuerza bruta es justo lo que puede haber pasado antes de que
   * el dueño busque la forma de recuperar el acceso. Si el reset no lo levanta,
   * el operador cambia la variable, reinicia, y sigue sin poder entrar.
   */
  it('el reset levanta el bloqueo por intentos fallidos', async () => {
    await seed(db, conPassword(PASSWORD_INICIAL));
    await users().updateOne(
      {},
      { $set: { failedAttempts: 9, lockedUntil: new Date(Date.now() + 3_600_000) } },
    );

    await seed(db, conPassword(PASSWORD_DE_RESCATE));

    const admin = await users().findOne({});
    expect(admin?.failedAttempts).toBe(0);
    expect(admin?.lockedUntil).toBeNull();
  });

  /**
   * **Volver a la variable anterior también es un cambio.**
   *
   * Se compara contra la última aplicada, no contra un historial: si el
   * operador vuelve al valor viejo, eso es un reset más, no un «no pasó nada».
   */
  it('volver al valor anterior resetea otra vez', async () => {
    await seed(db, conPassword(PASSWORD_INICIAL));
    await seed(db, conPassword(PASSWORD_DE_RESCATE));
    await elAdminEligeElSuyo(PASSWORD_NUEVO);

    const r = await seed(db, conPassword(PASSWORD_INICIAL));

    expect(r.adminReset).toBe(true);
    const admin = await users().findOne({});
    expect(await verifySecret(admin?.passwordHash ?? '', PASSWORD_INICIAL)).toBe(true);
  });

  /**
   * **El reset queda registrado.** Es un cambio de credenciales hecho desde
   * fuera de la aplicación: tiene que poder auditarse después.
   */
  it('deja rastro en el audit log', async () => {
    await seed(db, conPassword(PASSWORD_INICIAL));
    await seed(db, conPassword(PASSWORD_DE_RESCATE));

    const entradas = await auditLog().find({ action: 'admin.password_reset' }).toArray();
    expect(entradas).toHaveLength(1);
    expect(entradas[0]?.actorType).toBe('system');
  });

  /**
   * **Nunca un password, ni su hash, en el audit log.** Es la regla de
   * `SECURITY.md` para `meta`, y acá el dato en juego es una credencial.
   */
  it('el rastro no guarda el password ni su hash', async () => {
    await seed(db, conPassword(PASSWORD_INICIAL));
    await seed(db, conPassword(PASSWORD_DE_RESCATE));

    const entrada = await auditLog().findOne({ action: 'admin.password_reset' });
    const texto = JSON.stringify(entrada);

    expect(texto).not.toContain(PASSWORD_DE_RESCATE);
    expect(texto).not.toContain(PASSWORD_INICIAL);
    expect(texto).not.toContain('$argon2');
  });
});
