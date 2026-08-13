import { describe, expect, it } from 'vitest';
import { formatearFecha, formatearFechaCorta, formatearRango } from '../src/index.js';

/**
 * Formateo de fechas (REF-4).
 *
 * La fecha de un torneo es un **día del calendario**, no un instante: el 8 de
 * agosto es el 8 de agosto se lea desde donde se lea. Por eso se formatea en
 * UTC, que es como se guarda.
 */

// Medianoche UTC: lo que manda la API para un torneo del 8 de agosto.
const OCHO_DE_AGOSTO = '2026-08-08T00:00:00.000Z';

describe('formatearFecha', () => {
  it('escribe la fecha como la diría una persona', () => {
    expect(formatearFecha(OCHO_DE_AGOSTO)).toBe('8 de agosto de 2026');
  });

  /**
   * Argentina es UTC-3, así que medianoche UTC es las 21:00 del día ANTERIOR en
   * hora local. Formateando en la zona del navegador, un torneo del 8 se
   * mostraría como 7 — y en la planilla impresa esa diferencia es un problema.
   */
  it('NO corre un día por la zona horaria', () => {
    expect(formatearFecha(OCHO_DE_AGOSTO)).toMatch(/^8 de agosto/);
    expect(formatearFecha('2026-01-01T00:00:00.000Z')).toBe('1 de enero de 2026');
  });

  it('acepta un Date además de un string', () => {
    expect(formatearFecha(new Date(OCHO_DE_AGOSTO))).toBe('8 de agosto de 2026');
  });

  it('acepta una fecha sin hora', () => {
    expect(formatearFecha('2026-08-08')).toBe('8 de agosto de 2026');
  });

  // Una fecha que no se puede leer es un bug, pero romper la pantalla es peor
  // que mostrarla cruda: así se ve el dato y se puede reportar.
  it('devuelve el valor tal cual si no se puede interpretar', () => {
    expect(formatearFecha('no es una fecha')).toBe('no es una fecha');
    expect(formatearFecha('')).toBe('');
  });
});

describe('formatearFechaCorta', () => {
  it('usa el orden argentino: día, mes, año', () => {
    expect(formatearFechaCorta(OCHO_DE_AGOSTO)).toBe('08/08/2026');
  });

  it('tampoco corre un día', () => {
    expect(formatearFechaCorta('2026-01-01T00:00:00.000Z')).toBe('01/01/2026');
  });

  it('devuelve el valor tal cual si no se puede interpretar', () => {
    expect(formatearFechaCorta('cualquier cosa')).toBe('cualquier cosa');
  });
});

describe('formatearRango', () => {
  it('junta las dos fechas de una temporada', () => {
    // Una temporada típica: de enero a diciembre del mismo año.
    expect(formatearRango('2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z')).toBe(
      '1 de enero — 31 de diciembre de 2026',
    );
  });

  // Del mismo año no hace falta repetirlo: se lee más rápido.
  it('no repite el año cuando las dos son del mismo', () => {
    expect(formatearRango('2026-03-01T00:00:00.000Z', '2026-11-30T00:00:00.000Z')).toBe(
      '1 de marzo — 30 de noviembre de 2026',
    );
  });

  it('sí lo repite cuando cambian de año', () => {
    expect(formatearRango('2026-11-01T00:00:00.000Z', '2027-02-28T00:00:00.000Z')).toBe(
      '1 de noviembre de 2026 — 28 de febrero de 2027',
    );
  });
});
