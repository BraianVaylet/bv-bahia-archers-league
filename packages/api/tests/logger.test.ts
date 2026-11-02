import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '../src/env.js';
import { crearLogger, log, type Nivel } from '../src/lib/logger.js';
import { testEnvRaw } from './helpers.js';

/**
 * Logger estructurado (`REF6-13` / `B-5`).
 *
 * El día del torneo, si la sincronización anda lenta, hay que poder responder cuántas ops trae cada
 * lote, cuánto tarda y cuántas rechaza. `console.*` con texto libre no permite buscar nada de eso, y
 * `LOG_LEVEL` se validaba en `env.ts` sin que filtrara una sola línea.
 */

const AHORA = new Date('2026-08-08T12:00:00.000Z');

function conLogger(nivel: Nivel) {
  const lineas: { nivel: Nivel; linea: string }[] = [];
  const logger = crearLogger({
    nivel: () => nivel,
    escribir: (n, linea) => lineas.push({ nivel: n, linea }),
    ahora: () => AHORA,
  });
  const json = () => lineas.map((l) => JSON.parse(l.linea) as Record<string, unknown>);
  return { logger, lineas, json };
}

describe('crearLogger', () => {
  it('escribe una línea JSON con la hora, el nivel, el evento y los campos', () => {
    const { logger, json } = conLogger('info');

    logger.info('sync.lote', { ops: 20, duracionMs: 312 });

    expect(json()).toEqual([
      {
        t: '2026-08-08T12:00:00.000Z',
        nivel: 'info',
        evento: 'sync.lote',
        ops: 20,
        duracionMs: 312,
      },
    ]);
  });

  it('una línea por llamada, sin saltos de línea adentro', () => {
    const { logger, lineas } = conLogger('info');

    logger.info('x', { texto: 'uno\ndos' });

    expect(lineas).toHaveLength(1);
    expect(lineas[0]?.linea).not.toContain('\n');
  });

  it('con nivel warn no escribe info ni debug, pero sí warn y error', () => {
    const { logger, json } = conLogger('warn');

    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');

    expect(json().map((l) => l.evento)).toEqual(['c', 'd']);
  });

  it('con nivel error sólo escribe errores', () => {
    const { logger, json } = conLogger('error');

    logger.info('a');
    logger.warn('b');
    logger.error('c');

    expect(json().map((l) => l.evento)).toEqual(['c']);
  });

  it('con nivel debug escribe todo', () => {
    const { logger, json } = conLogger('debug');

    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');

    expect(json().map((l) => l.evento)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('le pasa a `escribir` el nivel de la línea, para elegir el stream', () => {
    const { logger, lineas } = conLogger('debug');

    logger.warn('a');

    expect(lineas[0]?.nivel).toBe('warn');
  });

  it('serializa un Error con nombre, mensaje y stack', () => {
    const { logger, json } = conLogger('info');

    logger.error('falla', { error: new TypeError('no anda') });

    const error = json()[0]?.error as { name: string; message: string; stack: string };
    expect(error).toMatchObject({ name: 'TypeError', message: 'no anda' });
    expect(error.stack).toContain('no anda');
  });

  it('un campo no puede pisar la hora, el nivel ni el evento', () => {
    const { logger, json } = conLogger('info');

    logger.info('real', { evento: 'falso', nivel: 'error', t: 'ayer' });

    expect(json()[0]).toMatchObject({
      evento: 'real',
      nivel: 'info',
      t: '2026-08-08T12:00:00.000Z',
    });
  });

  // Un log que tira una excepción tira abajo la request que quería contar.
  it('nunca lanza, ni con campos que no se pueden serializar', () => {
    const { logger, json } = conLogger('info');
    const circular: Record<string, unknown> = {};
    circular.yo = circular;

    expect(() => logger.info('raro', { circular })).not.toThrow();
    expect(json()[0]).toMatchObject({ evento: 'raro', nivel: 'info' });
  });
});

describe('log (el de la API)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetEnvCache();
  });

  const conNivel = (LOG_LEVEL: string) => {
    Object.assign(process.env, testEnvRaw({ LOG_LEVEL }));
    resetEnvCache();
  };

  it('respeta LOG_LEVEL del entorno', () => {
    conNivel('warn');

    log.info('no');
    log.warn('si');

    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('escribe cada nivel por su propio console, que es como Railway separa stdout de stderr', () => {
    conNivel('debug');

    log.info('a');
    log.error('b');

    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('cambiar LOG_LEVEL se nota en la siguiente línea: se lee cuando se escribe', () => {
    conNivel('error');
    log.info('a');
    conNivel('info');
    log.info('b');

    expect(console.info).toHaveBeenCalledTimes(1);
  });
});
