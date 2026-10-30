import type { Db } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { seed } from '../src/db/seed.js';
import { resetEnvCache } from '../src/env.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import { clearDb, cliente, startDb, stopDb, testEnv, testEnvRaw } from './helpers.js';

/**
 * El cupo de la IP en los endpoints de ingreso. `REF6-2` / `S-2`.
 *
 * El límite de login se aplicaba a **todo** `/api/auth/*` y contaba cada
 * request, no cada fallo. El día del torneo, los líderes entran desde el wifi del
 * club —una sola IP pública— y la patrulla 11 recibía «Demasiados intentos» por
 * culpa de las diez anteriores, que habían entrado bien.
 *
 * Qué frena la fuerza bruta de verdad es el bloqueo **por cuenta** (5 intentos);
 * el cupo por IP es para quien rocía intentos contra muchas cuentas, y por eso
 * cuenta fallos y no requests.
 *
 * Los límites se bajan a 10 y 5 para no tener que hacer sesenta intentos con
 * argon2 en cada test.
 */

const PASSWORD = 'password-de-test-1234';
let db: Db;

beforeAll(async () => {
  Object.assign(process.env, testEnvRaw({ RATE_LIMIT_LOGIN: '10', RATE_LIMIT_RECOVER: '5' }));
  resetEnvCache();
  db = await startDb();
}, 120_000);

afterAll(async () => {
  await stopDb();
});

afterEach(() => resetRateLimits());

beforeEach(async () => {
  await clearDb(db);
  await seed(db, testEnv());
});

const CSRF = 'c'.repeat(43);

/** Un POST con la IP que se quiera, sin pasar por el cliente de los otros tests. */
function pedir(ruta: string, ip: string, cuerpo: unknown, extra: Record<string, string> = {}) {
  return createApp().request(`http://localhost${ruta}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `bal_csrf=${CSRF}`,
      'x-csrf-token': CSRF,
      'x-forwarded-for': ip,
      ...extra,
    },
    body: JSON.stringify(cuerpo),
  });
}

const loginDeAdmin = (ip: string, username: string, password: string) =>
  pedir('/api/auth/admin/login', ip, { username, password });

describe('lo que cuenta', () => {
  it('diez intentos fallidos frenan a la IP: el undécimo recibe 429 aun con la clave correcta', async () => {
    // Usuarios que no existen: cada uno falla con 401 sin bloquear una cuenta,
    // que es otro control y también devolvería 429.
    for (let i = 0; i < 10; i++) {
      expect((await loginDeAdmin('203.0.113.10', `nadie${i}`, 'x')).status).toBe(401);
    }

    const res = await loginDeAdmin('203.0.113.10', 'admin', PASSWORD);

    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('RATE_LIMITED');
  });

  it('el cupo es por IP: otra IP sigue pudiendo entrar', async () => {
    for (let i = 0; i < 10; i++) await loginDeAdmin('203.0.113.20', `nadie${i}`, 'x');

    // La primera quedó afuera; la segunda ni se entera.
    expect((await loginDeAdmin('203.0.113.20', 'admin', PASSWORD)).status).toBe(429);
    expect((await loginDeAdmin('203.0.113.21', 'admin', PASSWORD)).status).toBe(200);
  });

  it('el bloqueo de una cuenta no gasta el cupo de la IP', async () => {
    // Cinco fallos bloquean la cuenta; del sexto en adelante el servicio responde
    // 429 y eso no son credenciales equivocadas. Si contara, un solo líder
    // insistiendo con su PIN agotaría el cupo de todo el club.
    for (let i = 0; i < 5; i++) await loginDeAdmin('203.0.113.30', 'admin', `malo-${i}`);
    for (let i = 0; i < 8; i++) {
      expect((await loginDeAdmin('203.0.113.30', 'admin', PASSWORD)).status).toBe(429);
    }

    // 5 fallos contados de 10: la IP todavía puede intentar con otra cuenta.
    expect((await loginDeAdmin('203.0.113.30', 'nadie', 'x')).status).toBe(401);
  });
});

describe('recuperación del password', () => {
  const recuperar = (ip: string, recoverySecret: string) =>
    pedir('/api/auth/admin/recover', ip, {
      recoverySecret,
      newPassword: 'un-password-nuevo-largo',
    });

  /**
   * Es la única ruta sin sesión que cambia una credencial, y **no tiene bloqueo
   * por cuenta**: lo único que frena adivinar el código es el cupo de la IP. Por
   * eso el suyo es más corto que el del login, y es aparte: errar el código de
   * recuperación no deja a nadie sin poder entrar con su PIN, ni al revés.
   */
  it('tiene un cupo propio y más corto: el sexto fallo recibe 429 aun con el código correcto', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await recuperar('203.0.113.40', `incorrecto-${i}`)).status).toBe(401);
    }

    // El código correcto, pero llega tarde: la IP ya gastó sus cinco.
    expect((await recuperar('203.0.113.40', PASSWORD)).status).toBe(429);

    // Y no cambió nada: el password original sigue sirviendo, desde la misma IP.
    expect((await loginDeAdmin('203.0.113.40', 'admin', PASSWORD)).status).toBe(200);
  });
});

describe('ráfagas simultáneas', () => {
  /**
   * Contar el fallo cuando la respuesta ya salió deja una ventana: todos los
   * requests que llegan juntos miran el contador antes de que el primero termine,
   * y pasan. El límite viejo no tenía ese problema porque reservaba el lugar *al
   * entrar*. En la recuperación del password, que no tiene bloqueo por cuenta,
   * una ráfaga adivinaba el código sin otro freno que su propio tamaño.
   */
  it('no deja pasar más intentos que el cupo, aunque lleguen todos juntos', async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        pedir('/api/auth/admin/recover', '203.0.113.70', {
          recoverySecret: `incorrecto-${i}`,
          newPassword: 'un-password-nuevo-largo',
        }),
      ),
    );

    const estados = respuestas.map((r) => r.status);
    expect(estados.filter((s) => s === 401)).toHaveLength(5);
    expect(estados.filter((s) => s === 429)).toHaveLength(25);
  });

  it('un ingreso correcto devuelve el lugar: una tanda de ingresos buenos no gasta nada', async () => {
    // Dos tandas de cinco a la vez: el par (cuenta, IP) admite cinco intentos en
    // vuelo, y entre las dos suman el cupo de diez de la IP mientras están en vuelo...
    for (let tanda = 0; tanda < 2; tanda++) {
      const respuestas = await Promise.all(
        Array.from({ length: 5 }, () => loginDeAdmin('203.0.113.80', 'admin', PASSWORD)),
      );
      expect(respuestas.map((r) => r.status)).toEqual(Array(5).fill(200));
    }

    // ...y como salieron bien, la IP sigue teniendo el cupo entero.
    for (let i = 0; i < 10; i++) {
      expect((await loginDeAdmin('203.0.113.80', `nadie${i}`, 'x')).status).toBe(401);
    }
  });
});

describe('la IP del cliente', () => {
  /**
   * `REF6-2` / `S-3`. El código tomaba el **primer** valor de `X-Forwarded-For`,
   * y los proxies *agregan* al final: el primero lo escribe quien quiera. Con un
   * valor distinto en cada request, cada intento caía en una cubeta nueva y el
   * cupo no frenaba a nadie.
   *
   * Railway documenta `X-Real-IP` como la IP del cliente (docs.railway.com,
   * «Specs & Limits» → Request Headers) y no dice nada de `X-Forwarded-For`.
   */
  beforeAll(() => {
    process.env.TRUSTED_IP_HEADER = 'x-real-ip';
    resetEnvCache();
  });

  afterAll(() => {
    delete process.env.TRUSTED_IP_HEADER;
    resetEnvCache();
  });

  const desde = (ipReal: string, inventada: string, username: string, password: string) =>
    pedir('/api/auth/admin/login', inventada, { username, password }, { 'x-real-ip': ipReal });

  it('un X-Forwarded-For inventado en cada intento no esquiva el cupo', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await desde('198.51.100.7', `10.9.9.${i}`, `nadie${i}`, 'x')).status).toBe(401);
    }

    // Otra IP inventada, la misma real: es el mismo cliente, y ya gastó sus diez.
    expect((await desde('198.51.100.7', '10.9.9.99', 'admin', PASSWORD)).status).toBe(429);
  });

  it('IPs reales distintas son clientes distintos', async () => {
    for (let i = 0; i < 10; i++) await desde('198.51.100.8', '10.9.9.1', `nadie${i}`, 'x');

    expect((await desde('198.51.100.8', '10.9.9.1', 'admin', PASSWORD)).status).toBe(429);
    expect((await desde('198.51.100.9', '10.9.9.1', 'admin', PASSWORD)).status).toBe(200);
  });
});

describe('lo que no cuenta', () => {
  it('los ingresos correctos y las consultas de sesión no gastan el cupo de la IP', async () => {
    const c = cliente();

    // Más del doble del límite. Todos entran bien: no hay nada que frenar.
    for (let i = 0; i < 12; i++) {
      const res = await c.post('/api/auth/admin/login', { username: 'admin', password: PASSWORD });
      expect(res.status).toBe(200);
    }

    // `/me` y `/csrf` los pide la app en cada carga: tampoco cuentan.
    for (let i = 0; i < 12; i++) {
      expect((await c.get('/api/auth/me')).status).toBe(200);
      expect((await c.get('/api/auth/csrf')).status).toBe(200);
    }
  });
});
