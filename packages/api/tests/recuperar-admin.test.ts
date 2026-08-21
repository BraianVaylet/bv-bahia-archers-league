import type { Db } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, sessions, users } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import { resetEnvCache } from '../src/env.js';
import { verifySecret } from '../src/lib/crypto.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import { type Cliente, clearDb, cliente, startDb, stopDb, testEnv, testEnvRaw } from './helpers.js';

/**
 * Recuperar el password del admin **sin redesplegar**.
 *
 * La primera versión de esto reseteaba el password al arrancar, cuando cambiaba
 * `ADMIN_INITIAL_PASSWORD`. Era inútil en el único momento en que hace falta:
 * **el día del torneo**, donde nadie va a esperar un redeploy porque el admin se
 * olvidó la clave.
 *
 * Ahora la variable es un **código de recuperación**: se ingresa desde el login
 * y habilita elegir un password nuevo. Sólo la conoce quien tenga acceso al
 * panel del proveedor.
 *
 * **Es un endpoint sin sesión que cambia credenciales, expuesto a internet.**
 * Eso es lo que estos tests cuidan: que no filtre por tiempo, que no se pueda
 * probar a ciegas, y que mate las sesiones vivas.
 */

const SECRETO = 'el-secreto-de-railway-largo';
const PASSWORD_VIEJO = 'el-que-el-admin-olvido';
const PASSWORD_NUEVO = 'el-que-elige-al-recuperar';

let db: Db;
let anonimo: Cliente;

beforeAll(async () => {
  Object.assign(process.env, { ...testEnvRaw(), ADMIN_INITIAL_PASSWORD: SECRETO });
  resetEnvCache();
  db = await startDb();
}, 120_000);

afterAll(async () => {
  await stopDb();
});

afterEach(() => {
  resetRateLimits();
});

beforeEach(async () => {
  await clearDb(db);
  await seed(db, { ...testEnv(), ADMIN_INITIAL_PASSWORD: SECRETO });
  anonimo = cliente();
});

/** Deja al admin con un password propio, como después del primer login. */
async function elAdminYaEligioElSuyo() {
  const { hashSecret } = await import('../src/lib/crypto.js');
  await users().updateOne(
    {},
    { $set: { passwordHash: await hashSecret(PASSWORD_VIEJO), mustChangePassword: false } },
  );
}

const recuperar = (c: Cliente, body: unknown) => c.post('/api/auth/admin/recover', body);

describe('recuperar el password del admin', () => {
  it('con el secreto correcto, deja elegir un password nuevo', async () => {
    await elAdminYaEligioElSuyo();

    const res = await recuperar(anonimo, { recoverySecret: SECRETO, newPassword: PASSWORD_NUEVO });
    expect(res.status).toBe(200);

    const admin = await users().findOne({});
    expect(await verifySecret(admin?.passwordHash ?? '', PASSWORD_NUEVO)).toBe(true);
  });

  it('el password viejo deja de servir', async () => {
    await elAdminYaEligioElSuyo();
    await recuperar(anonimo, { recoverySecret: SECRETO, newPassword: PASSWORD_NUEVO });

    const admin = await users().findOne({});
    expect(await verifySecret(admin?.passwordHash ?? '', PASSWORD_VIEJO)).toBe(false);
  });

  /**
   * **No se exige cambiarlo de nuevo.** El que recupera es el admin: acaba de
   * elegir su password a mano, no le dieron uno de paso.
   */
  it('el password elegido es definitivo, no de paso', async () => {
    await elAdminYaEligioElSuyo();
    await recuperar(anonimo, { recoverySecret: SECRETO, newPassword: PASSWORD_NUEVO });

    expect((await users().findOne({}))?.mustChangePassword).toBe(false);
  });

  it('con el secreto equivocado, no cambia nada', async () => {
    await elAdminYaEligioElSuyo();

    const res = await recuperar(anonimo, {
      recoverySecret: 'cualquier-otra-cosa-larga',
      newPassword: PASSWORD_NUEVO,
    });
    expect(res.status).toBe(401);

    const admin = await users().findOne({});
    expect(await verifySecret(admin?.passwordHash ?? '', PASSWORD_VIEJO)).toBe(true);
  });

  /**
   * **El error no dice cuál de los dos datos estuvo mal.**
   *
   * Un mensaje que distinga «secreto incorrecto» de «password inválido»
   * convierte el endpoint en un oráculo para adivinar el secreto.
   */
  it('el error no revela qué falló', async () => {
    const res = await recuperar(anonimo, {
      recoverySecret: 'cualquier-otra-cosa-larga',
      newPassword: PASSWORD_NUEVO,
    });

    const cuerpo = JSON.stringify(await res.json()).toLowerCase();
    expect(cuerpo).not.toContain('secret');
    expect(cuerpo).not.toContain('recuperación');
  });

  /**
   * **Mata las sesiones vivas.**
   *
   * Si el motivo de recuperar es que alguien más entró a la cuenta, dejar su
   * sesión abierta no arregla nada.
   */
  it('cierra las sesiones abiertas del admin', async () => {
    await elAdminYaEligioElSuyo();

    const conSesion = cliente();
    await conSesion.post('/api/auth/admin/login', { username: 'admin', password: PASSWORD_VIEJO });
    expect(await sessions().countDocuments()).toBeGreaterThan(0);

    await recuperar(anonimo, { recoverySecret: SECRETO, newPassword: PASSWORD_NUEVO });

    expect(await sessions().countDocuments()).toBe(0);
    expect((await conSesion.get('/api/auth/me')).status).toBe(401);
  });

  /** El bloqueo por intentos fallidos es justo lo que puede haber pasado antes. */
  it('levanta el bloqueo por intentos fallidos', async () => {
    await users().updateOne(
      {},
      { $set: { failedAttempts: 9, lockedUntil: new Date(Date.now() + 3_600_000) } },
    );

    await recuperar(anonimo, { recoverySecret: SECRETO, newPassword: PASSWORD_NUEVO });

    const admin = await users().findOne({});
    expect(admin?.failedAttempts).toBe(0);
    expect(admin?.lockedUntil).toBeNull();
  });

  it('el password nuevo tiene que cumplir el mínimo', async () => {
    const res = await recuperar(anonimo, { recoverySecret: SECRETO, newPassword: 'corto' });
    expect(res.status).toBe(400);
  });

  /** Zod `.strict()`: nada que no esté en el schema llega a la base. */
  it('rechaza campos de más', async () => {
    const res = await recuperar(anonimo, {
      recoverySecret: SECRETO,
      newPassword: PASSWORD_NUEVO,
      username: 'otro',
    });
    expect(res.status).toBe(400);
  });

  it('deja rastro en el audit log', async () => {
    await recuperar(anonimo, { recoverySecret: SECRETO, newPassword: PASSWORD_NUEVO });

    const entradas = await auditLog().find({ action: 'admin.password_recovered' }).toArray();
    expect(entradas).toHaveLength(1);
  });

  /** Ni el secreto ni el password nuevo pueden quedar escritos en el rastro. */
  it('el rastro no guarda ninguno de los dos secretos', async () => {
    await recuperar(anonimo, { recoverySecret: SECRETO, newPassword: PASSWORD_NUEVO });

    const texto = JSON.stringify(await auditLog().findOne({ action: 'admin.password_recovered' }));
    expect(texto).not.toContain(SECRETO);
    expect(texto).not.toContain(PASSWORD_NUEVO);
    expect(texto).not.toContain('$argon2');
  });

  /**
   * **Un intento fallido también queda registrado.**
   *
   * Alguien probando el código de recuperación contra el servidor es
   * exactamente lo que hay que poder ver después.
   */
  it('registra los intentos fallidos', async () => {
    await recuperar(anonimo, {
      recoverySecret: 'no-es-el-secreto-largo',
      newPassword: PASSWORD_NUEVO,
    });

    expect(await auditLog().countDocuments({ action: 'admin.recovery_failed' })).toBe(1);
  });
});
