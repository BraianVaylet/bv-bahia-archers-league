import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { participants, patrols } from '../src/db/client.js';
import { seed } from '../src/db/seed.js';
import { resetEnvCache } from '../src/env.js';
import { resetBloqueos } from '../src/lib/bloqueoDeIngreso.js';
import { decryptPin } from '../src/lib/crypto.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import {
  adminListo,
  clearDb,
  crearArqueros,
  crearTemporada,
  recorridoDeReferencia,
  startDb,
  stopDb,
  testEnv,
  testEnvRaw,
} from './helpers.js';

/**
 * Bloquear a quien insiste, no a quien es dueño de la cuenta (`REF6-6` / `S-4`).
 *
 * El bloqueo era por cuenta sola: cinco intentos fallidos, desde cualquier lado,
 * dejaban afuera a su dueño. El usuario del admin es `admin` y los de las patrullas
 * los publica `/api/public/tournaments/:id`: dejar afuera al admin en pleno torneo
 * —cuando necesita desbloquear una firma o regenerar un PIN— costaba cinco
 * requests. Ahora el bloqueo es por (cuenta, IP), y por encima hay un tope por
 * cuenta, mucho más alto, contra quien intenta desde muchas IPs.
 */

const PASSWORD = 'password-de-test-1234';
const CSRF = 'c'.repeat(43);
let db: Db;

beforeAll(async () => {
  Object.assign(process.env, testEnvRaw());
  resetEnvCache();
  db = await startDb();
}, 120_000);

afterAll(async () => {
  await stopDb();
});

afterEach(() => {
  resetRateLimits();
  resetBloqueos();
});

beforeEach(async () => {
  await clearDb(db);
  await seed(db, testEnv());
});

/** Un POST desde la IP que se pida. */
function desde(ip: string, ruta: string, cuerpo: unknown) {
  return createApp().request(`http://localhost${ruta}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `bal_csrf=${CSRF}`,
      'x-csrf-token': CSRF,
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(cuerpo),
  });
}

const loginAdmin = (ip: string, password: string, username = 'admin') =>
  desde(ip, '/api/auth/admin/login', { username, password });

// ── Administrador ────────────────────────────────────────────────────────────

describe('administrador', () => {
  it('cinco intentos fallidos desde una IP no bloquean a la cuenta desde otra', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await loginAdmin('203.0.113.1', `malo-${i}`)).status).toBe(401);
    }

    // La IP que insistió queda afuera, aun con la clave correcta.
    const bloqueado = await loginAdmin('203.0.113.1', PASSWORD);
    expect(bloqueado.status).toBe(429);
    expect(Number(bloqueado.headers.get('retry-after'))).toBeGreaterThan(0);

    // El dueño entra desde otro lado como si nada.
    expect((await loginAdmin('203.0.113.2', PASSWORD)).status).toBe(200);

    // Y entrar él no le levanta el castigo al que insistía.
    expect((await loginAdmin('203.0.113.1', PASSWORD)).status).toBe(429);
  });

  /**
   * Contar el fallo después de verificar deja una ventana: una ráfaga de
   * requests simultáneos mira el contador antes de que el primero termine y pasan
   * todos. Treinta intentos tenían treinta chances de acertar.
   */
  it('una ráfaga simultánea no pasa de cinco intentos', async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 30 }, (_, i) => loginAdmin('203.0.113.3', `malo-${i}`)),
    );

    const estados = respuestas.map((r) => r.status);
    expect(estados.filter((s) => s === 401)).toHaveLength(5);
    expect(estados.filter((s) => s === 429)).toHaveLength(25);
  });

  /**
   * Si sólo se bloquearan las cuentas reales, que el bloqueo aparezca o no
   * distinguiría un usuario válido de uno inventado: un oráculo para enumerarlos.
   */
  it('una cuenta que no existe se bloquea igual', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await loginAdmin('203.0.113.4', 'x', 'nadie')).status).toBe(401);
    }

    expect((await loginAdmin('203.0.113.4', 'x', 'nadie')).status).toBe(429);
  });

  /**
   * Cada IP tiene sus cinco intentos, así que desde muchas IPs el bloqueo por par
   * no alcanza: para eso está el tope por cuenta. Más alto que cinco —o volvería
   * a ser lo mismo que bloquear por cuenta— pero finito.
   */
  it('muchas IPs, cinco intentos cada una, terminan bloqueando a la cuenta para todos', async () => {
    for (let ip = 1; ip <= 6; ip++) {
      for (let i = 0; i < 5; i++) await loginAdmin(`198.51.100.${ip}`, `malo-${ip}-${i}`);
    }

    // 30 fallos repartidos en 6 IPs: una IP nueva, con la clave correcta, ya no entra.
    expect((await loginAdmin('198.51.100.99', PASSWORD)).status).toBe(429);
  });

  it('un ingreso correcto devuelve los intentos: los fallos de antes no se acumulan', async () => {
    for (let i = 0; i < 4; i++) await loginAdmin('203.0.113.7', `malo-${i}`);
    expect((await loginAdmin('203.0.113.7', PASSWORD)).status).toBe(200);

    // Sin el reinicio serían nueve intentos seguidos y el sexto ya estaría bloqueado.
    for (let i = 0; i < 4; i++) {
      expect((await loginAdmin('203.0.113.7', `malo-${i}`)).status).toBe(401);
    }
  });

  it('recuperar el password suelta el bloqueo de todas las IPs', async () => {
    for (let i = 0; i < 6; i++) await loginAdmin('203.0.113.5', `malo-${i}`);
    expect((await loginAdmin('203.0.113.5', PASSWORD)).status).toBe(429);

    const nuevo = 'un-password-nuevo-largo';
    const recuperar = await desde('203.0.113.6', '/api/auth/admin/recover', {
      recoverySecret: PASSWORD,
      newPassword: nuevo,
    });
    expect(recuperar.status).toBe(200);

    // Seguir bloqueado después de recuperar la cuenta no tendría sentido.
    expect((await loginAdmin('203.0.113.5', nuevo)).status).toBe(200);
  });
});

// ── Patrulla ─────────────────────────────────────────────────────────────────

describe('patrulla', () => {
  /** Un torneo iniciado con una patrulla de 4. */
  async function escenario() {
    const admin = await adminListo();
    const seasonId = await crearTemporada(admin);
    const archerIds = await crearArqueros(admin, [['raso', 4]]);

    const res = await admin.post('/api/admin/tournaments', {
      seasonId,
      name: 'Torneo',
      date: '2026-08-08',
      targets: recorridoDeReferencia(),
      archerIds,
    });
    const tournamentId = ((await res.json()) as { tournament: { id: string } }).tournament.id;
    await admin.post(`/api/admin/tournaments/${tournamentId}/start`);

    const patrulla = await patrols().findOne({ tournamentId: new ObjectId(tournamentId) });
    if (!patrulla) throw new Error('no se armó ninguna patrulla');
    await participants().findOne({ patrolId: patrulla._id });

    return {
      admin,
      patrolId: patrulla._id.toHexString(),
      tournamentId,
      username: patrulla.username,
      pin: decryptPin(patrulla.pinEnc, testEnv().PIN_ENC_KEY),
    };
  }

  const loginPatrulla = (
    ip: string,
    e: { tournamentId: string; username: string },
    pin: string,
    username = e.username,
  ) => desde(ip, '/api/auth/patrol/login', { tournamentId: e.tournamentId, username, pin });

  it('cinco PIN equivocados desde una IP no dejan afuera a la patrulla en otra', async () => {
    const e = await escenario();

    for (let i = 0; i < 5; i++) {
      expect((await loginPatrulla('203.0.113.10', e, '000000')).status).toBe(401);
    }

    expect((await loginPatrulla('203.0.113.10', e, e.pin)).status).toBe(429);
    // El líder, con su celular en otra red, entra.
    expect((await loginPatrulla('203.0.113.11', e, e.pin)).status).toBe(200);
  });

  /**
   * Un PIN son seis dígitos: un millón de combinaciones. Sin un tope por patrulla
   * que sume todas las IPs, probarlos desde muchas IPs —cinco por cada una— no
   * tiene techo.
   */
  it('muchas IPs, cinco intentos cada una, terminan bloqueando a la patrulla para todos', async () => {
    const e = await escenario();

    for (let ip = 1; ip <= 6; ip++) {
      for (let i = 0; i < 5; i++) await loginPatrulla(`198.51.100.${ip}`, e, '000000');
    }

    expect((await loginPatrulla('198.51.100.99', e, e.pin)).status).toBe(429);
  });

  it('una patrulla que no existe se bloquea igual', async () => {
    const e = await escenario();

    for (let i = 0; i < 5; i++) {
      expect((await loginPatrulla('203.0.113.12', e, '000000', 'patrulla99')).status).toBe(401);
    }

    expect((await loginPatrulla('203.0.113.12', e, '000000', 'patrulla99')).status).toBe(429);
  });

  it('un ingreso correcto devuelve los intentos: los fallos de antes no se acumulan', async () => {
    const e = await escenario();

    for (let i = 0; i < 4; i++) await loginPatrulla('203.0.113.14', e, '000000');
    expect((await loginPatrulla('203.0.113.14', e, e.pin)).status).toBe(200);

    for (let i = 0; i < 4; i++) {
      expect((await loginPatrulla('203.0.113.14', e, '000000')).status).toBe(401);
    }
  });

  /**
   * El id del torneo es hexadecimal y el esquema acepta mayúsculas. Si la clave usara
   * el texto tal como llega, el mismo torneo escrito de otra forma daría un cupo nuevo.
   */
  it('el mismo torneo en mayúsculas comparte el cupo', async () => {
    const e = await escenario();
    const enMayusculas = { ...e, tournamentId: e.tournamentId.toUpperCase() };

    for (let i = 0; i < 3; i++) await loginPatrulla('203.0.113.15', e, '000000');
    for (let i = 0; i < 2; i++) {
      expect((await loginPatrulla('203.0.113.15', enMayusculas, '000000')).status).toBe(401);
    }

    // Cinco intentos entre las dos grafías: el sexto, en la que sea, queda afuera.
    expect((await loginPatrulla('203.0.113.15', e, e.pin)).status).toBe(429);
    expect((await loginPatrulla('203.0.113.15', enMayusculas, e.pin)).status).toBe(429);
  });

  it('regenerar el PIN suelta el bloqueo: el líder entra con el nuevo', async () => {
    const e = await escenario();
    for (let i = 0; i < 6; i++) await loginPatrulla('203.0.113.13', e, '000000');
    expect((await loginPatrulla('203.0.113.13', e, e.pin)).status).toBe(429);

    const res = await e.admin.post(`/api/admin/patrols/${e.patrolId}/pin/regenerate`);
    const { pin } = (await res.json()) as { pin: string };

    // El admin acaba de darle un PIN nuevo en mano: que siga esperando no tiene sentido.
    expect((await loginPatrulla('203.0.113.13', e, pin)).status).toBe(200);
  });
});
