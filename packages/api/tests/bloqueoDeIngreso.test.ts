import { beforeEach, describe, expect, it } from 'vitest';
import {
  estadosVivos,
  liberar,
  liberarCuenta,
  MAX_ESTADOS,
  type PoliticaDeBloqueo,
  reservarIntento,
  resetBloqueos,
} from '../src/lib/bloqueoDeIngreso.js';

/**
 * El bloqueo por (cuenta, IP) con backoff progresivo (`REF6-6` / `S-4`).
 *
 * Se prueba con el tiempo **explícito**, sin relojes falsos: `reservarIntento`
 * recibe el momento como argumento, así que el backoff se verifica con
 * aritmética y no esperando.
 *
 * Por qué por (cuenta, IP) y no por cuenta sola: con la cuenta sola, cinco
 * intentos fallidos desde cualquier lado —el usuario del admin es `admin`, los de
 * las patrullas los publica `/api/public/tournaments/:id`— dejaban afuera a su
 * dueño durante 15 minutos. Con el par, quien insiste se bloquea a sí mismo.
 */

const MIN = 60_000;
const POLITICA: PoliticaDeBloqueo = {
  intentos: 5,
  baseMs: 1 * MIN,
  techoMs: 4 * MIN,
  olvidoMs: 60 * MIN,
};

beforeEach(() => resetBloqueos());

/** Gasta `n` intentos de la clave, todos en el mismo instante. */
const gastar = (clave: string, n: number, ahora: number) => {
  for (let i = 0; i < n; i++) reservarIntento(clave, POLITICA, ahora);
};

describe('el bloqueo', () => {
  it('deja pasar cinco intentos y bloquea el sexto, con la duración base', () => {
    for (let i = 0; i < 5; i++) expect(reservarIntento('k', POLITICA, 0)).toBeNull();

    expect(reservarIntento('k', POLITICA, 0)).toBe(60);
  });

  it('mientras dura, todo intento recibe los segundos que faltan', () => {
    gastar('k', 6, 0);

    expect(reservarIntento('k', POLITICA, 10_000)).toBe(50);
    expect(reservarIntento('k', POLITICA, 59_000)).toBe(1);
  });

  it('insistir mientras está bloqueado no lo alarga', () => {
    gastar('k', 6, 0);
    for (let i = 0; i < 50; i++) reservarIntento('k', POLITICA, 30_000);

    // Sigue venciendo a los 60 s, no 50 intentos después.
    expect(reservarIntento('k', POLITICA, 59_000)).toBe(1);
    expect(reservarIntento('k', POLITICA, 61_000)).toBeNull();
  });

  it('vencido, vuelve a dejar pasar cinco', () => {
    gastar('k', 6, 0);

    for (let i = 0; i < 5; i++) expect(reservarIntento('k', POLITICA, 61_000)).toBeNull();
    expect(reservarIntento('k', POLITICA, 61_000)).not.toBeNull();
  });

  describe('backoff progresivo', () => {
    it('cada bloqueo seguido dura el doble, hasta el techo', () => {
      let t = 0;
      const duraciones: (number | null)[] = [];

      for (let ronda = 0; ronda < 5; ronda++) {
        gastar('k', 5, t);
        const espera = reservarIntento('k', POLITICA, t);
        duraciones.push(espera);
        t += (espera ?? 0) * 1000 + 1;
      }

      // 1, 2 y 4 minutos; el techo es 4, así que ahí se queda.
      expect(duraciones).toEqual([60, 120, 240, 240, 240]);
    });

    it('un ingreso correcto reinicia el castigo', () => {
      gastar('k', 6, 0);
      gastar('k', 6, 61_000);

      liberar('k');

      gastar('k', 5, 400_000);
      expect(reservarIntento('k', POLITICA, 400_000)).toBe(60);
    });

    it('se olvida tras un rato sin intentos', () => {
      gastar('k', 6, 0); // bloqueo de 1 min
      gastar('k', 6, 61_000); // bloqueo de 2 min: nivel 2

      // Pasa una hora sin tocar nada.
      const mucho = 61_000 + 2 * MIN + POLITICA.olvidoMs + 1;
      gastar('k', 5, mucho);

      expect(reservarIntento('k', POLITICA, mucho)).toBe(60);
    });
  });

  describe('independencia', () => {
    it('cada clave tiene su propio cupo: el par (cuenta, IP) no afecta a otro', () => {
      gastar('admin:admin:1.1.1.1', 6, 0);

      expect(reservarIntento('admin:admin:2.2.2.2', POLITICA, 0)).toBeNull();
      expect(reservarIntento('admin:otro:1.1.1.1', POLITICA, 0)).toBeNull();
    });

    it('liberar una cuenta suelta todas sus IPs y nada más', () => {
      gastar('admin:admin:1.1.1.1', 6, 0);
      gastar('admin:admin:2.2.2.2', 6, 0);
      gastar('patrol:t1:patrulla1:1.1.1.1', 6, 0);

      liberarCuenta('admin:admin:');

      expect(reservarIntento('admin:admin:1.1.1.1', POLITICA, 1)).toBeNull();
      expect(reservarIntento('admin:admin:2.2.2.2', POLITICA, 1)).toBeNull();
      // La otra cuenta sigue bloqueada.
      expect(reservarIntento('patrol:t1:patrulla1:1.1.1.1', POLITICA, 1)).not.toBeNull();
    });
  });

  it('no guarda más estados que el tope, aunque lleguen claves de sobra', () => {
    for (let i = 0; i < MAX_ESTADOS + 500; i++) reservarIntento(`k:${i}`, POLITICA, 0);

    expect(estadosVivos()).toBeLessThanOrEqual(MAX_ESTADOS);
  });
});
