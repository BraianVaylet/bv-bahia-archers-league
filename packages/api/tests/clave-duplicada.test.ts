import { MongoServerError } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { archers, getDb } from '../src/db/client.js';
import { resetEnvCache } from '../src/env.js';
import { esClaveDuplicada } from '../src/lib/errors.js';
import { clearDb, startDb, stopDb, testEnvRaw } from './helpers.js';

/**
 * Detectar una clave duplicada (`REF6-13` / `C-5`).
 *
 * Tres repositorios lo hacían con `error.message.includes('E11000')`: depende del texto de un mensaje
 * que el driver puede cambiar sin avisar, y que otro error cualquiera podría contener. El driver
 * expone `MongoServerError` con `code === 11000`.
 */

beforeAll(async () => {
  Object.assign(process.env, testEnvRaw());
  resetEnvCache();
  await startDb();
}, 120_000);

afterAll(async () => {
  await stopDb();
});

beforeEach(async () => {
  await clearDb(getDb());
});

const errorDelServidor = (code: number, message = 'error') => {
  const e = new MongoServerError({ message });
  e.code = code;
  return e;
};

describe('esClaveDuplicada', () => {
  it('es verdadera para un MongoServerError con código 11000', () => {
    expect(esClaveDuplicada(errorDelServidor(11000))).toBe(true);
  });

  it('no depende del texto del mensaje', () => {
    expect(esClaveDuplicada(errorDelServidor(11000, 'cualquier otra cosa'))).toBe(true);
  });

  it('es falsa para otro código del servidor, aunque el mensaje diga E11000', () => {
    expect(esClaveDuplicada(errorDelServidor(112, 'E11000 duplicate key (en el texto)'))).toBe(
      false,
    );
  });

  it('es falsa para un Error común que contiene «E11000»: no es del driver', () => {
    expect(esClaveDuplicada(new Error('E11000 duplicate key error'))).toBe(false);
  });

  it.each([undefined, null, 'E11000', 11000, { code: 11000 }])(
    'es falsa para algo que no es un error: %j',
    (valor) => {
      expect(esClaveDuplicada(valor)).toBe(false);
    },
  );

  // La prueba que importa: el error que el driver de verdad lanza contra un índice único.
  it('reconoce el error real de un insert contra un índice único', async () => {
    await archers().createIndex(
      { dni: 1 },
      { unique: true, partialFilterExpression: { dni: { $type: 'string' } } },
    );
    const base = { firstName: 'A', lastName: 'B', dni: '30111222' };
    await archers().insertOne({ ...base } as never);

    const error = await archers()
      .insertOne({ ...base } as never)
      .catch((e: unknown) => e);

    expect(esClaveDuplicada(error)).toBe(true);
  });
});
