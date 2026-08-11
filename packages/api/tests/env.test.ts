import { describe, expect, it } from 'vitest';
import { EnvError, loadEnv } from '../src/env.js';
import { testEnvRaw } from './helpers.js';

/**
 * Configuración por entorno (BE-1).
 *
 * El control que importa: un servidor de producción que levanta con un secreto
 * de desarrollo es peor que uno que no levanta.
 *
 * Ver docs/SECURITY.md §3.1 y §13.
 */

describe('loadEnv', () => {
  it('acepta una configuración válida y aplica los defaults', () => {
    const env = loadEnv(testEnvRaw());

    expect(env.NODE_ENV).toBe('test');
    expect(env.PORT).toBe(8787);
    expect(env.MONGODB_DB).toBe('bal_test');
    expect(env.SESSION_COOKIE_NAME).toBe('bal_session');
    expect(env.SESSION_TTL_HOURS_ADMIN).toBe(12);
    expect(env.RATE_LIMIT_SYNC).toBe(300);
    expect(env.isProduction).toBe(false);
  });

  it('reúne TODOS los problemas, no sólo el primero', () => {
    // Quien configura un deploy no debería descubrirlos de a uno.
    try {
      loadEnv({ NODE_ENV: 'development' });
      expect.unreachable('debería haber fallado');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      const problemas = (error as EnvError).problems;
      expect(problemas.length).toBeGreaterThanOrEqual(3);
      expect(problemas.join('\n')).toMatch(/MONGODB_URI/);
      expect(problemas.join('\n')).toMatch(/SESSION_SECRET/);
      expect(problemas.join('\n')).toMatch(/PIN_ENC_KEY/);
    }
  });

  describe('validación de secretos', () => {
    it('rechaza un SESSION_SECRET corto', () => {
      expect(() => loadEnv(testEnvRaw({ SESSION_SECRET: 'corto' }))).toThrow(EnvError);
    });

    it('rechaza una PIN_ENC_KEY que no sea de 32 bytes en hex', () => {
      expect(() => loadEnv(testEnvRaw({ PIN_ENC_KEY: 'abc' }))).toThrow(EnvError);
      expect(() => loadEnv(testEnvRaw({ PIN_ENC_KEY: 'z'.repeat(64) }))).toThrow(EnvError);
    });

    it('acepta una PIN_ENC_KEY de 64 caracteres hexadecimales', () => {
      expect(() => loadEnv(testEnvRaw({ PIN_ENC_KEY: 'aF0'.repeat(21) + 'b' }))).not.toThrow();
    });
  });

  describe('producción', () => {
    const produccion = (overrides: Record<string, string> = {}) =>
      testEnvRaw({
        NODE_ENV: 'production',
        SESSION_SECRET: 'b'.repeat(48),
        PIN_ENC_KEY: '2'.repeat(64),
        ADMIN_INITIAL_PASSWORD: 'un-password-largo-de-verdad',
        ...overrides,
      });

    it('acepta una configuración de producción correcta', () => {
      const env = loadEnv(produccion());
      expect(env.isProduction).toBe(true);
      expect(env.cookieSecure).toBe(true);
    });

    it('FALLA si falta ADMIN_INITIAL_PASSWORD', () => {
      const raw = produccion();
      raw.ADMIN_INITIAL_PASSWORD = undefined;
      expect(() => loadEnv(raw)).toThrow(EnvError);
    });

    it('FALLA si ADMIN_INITIAL_PASSWORD sigue siendo el de desarrollo', () => {
      expect(() => loadEnv(produccion({ ADMIN_INITIAL_PASSWORD: 'CBA2026' }))).toThrow(
        /ADMIN_INITIAL_PASSWORD/,
      );
    });

    it('FALLA si ADMIN_INITIAL_PASSWORD tiene menos de 12 caracteres', () => {
      expect(() => loadEnv(produccion({ ADMIN_INITIAL_PASSWORD: 'corto123' }))).toThrow(
        /12 caracteres/,
      );
    });

    it('FALLA si SESSION_SECRET es el valor de desarrollo del .env.example', () => {
      expect(() =>
        loadEnv(produccion({ SESSION_SECRET: 'dev-only-inseguro-cambiar-en-produccion-0000' })),
      ).toThrow(/SESSION_SECRET/);
    });

    it('FALLA si PIN_ENC_KEY es el valor de desarrollo del .env.example', () => {
      expect(() => loadEnv(produccion({ PIN_ENC_KEY: '0'.repeat(64) }))).toThrow(/PIN_ENC_KEY/);
    });

    it('FALLA si SESSION_SECRET y PIN_ENC_KEY son iguales', () => {
      const misma = 'c'.repeat(64);
      expect(() => loadEnv(produccion({ SESSION_SECRET: misma, PIN_ENC_KEY: misma }))).toThrow(
        /distintas/,
      );
    });

    it('permite desactivar COOKIE_SECURE a propósito', () => {
      expect(loadEnv(produccion({ COOKIE_SECURE: 'false' })).cookieSecure).toBe(false);
    });
  });

  describe('desarrollo', () => {
    it('deja pasar los valores de desarrollo', () => {
      const env = loadEnv(
        testEnvRaw({
          NODE_ENV: 'development',
          SESSION_SECRET: 'dev-only-inseguro-cambiar-en-produccion-0000',
          PIN_ENC_KEY: '0'.repeat(64),
          ADMIN_INITIAL_PASSWORD: 'CBA2026',
        }),
      );
      expect(env.isProduction).toBe(false);
      expect(env.cookieSecure).toBe(false);
    });
  });
});
