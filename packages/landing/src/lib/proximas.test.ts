import { formatearMonto } from '@bal/shared';
import { describe, expect, it } from 'vitest';
import { bloqueDeFecha, proximasDeLaPortada, textoDeInscripcion } from './proximas.js';

/**
 * Lo que «Próximas fechas» decide antes de dibujar (`FE-38`). Funciones puras: los componentes
 * sólo pintan lo que sale de acá.
 */

describe('proximasDeLaPortada', () => {
  it('la portada muestra las tres más cercanas, en el orden en que llegan', () => {
    const lista = [1, 2, 3, 4].map((n) => ({ id: `t${n}` }));
    expect(proximasDeLaPortada(lista).map((t) => t.id)).toEqual(['t1', 't2', 't3']);
  });

  it('con menos de tres, muestra las que haya', () => {
    expect(proximasDeLaPortada([{ id: 't1' }])).toHaveLength(1);
  });
});

/**
 * La fecha grande de la tarjeta. Es un día del calendario guardado como medianoche UTC: se lee en
 * UTC, o en Argentina (UTC-3) el 5 de diciembre aparecería como 4.
 */
describe('bloqueDeFecha', () => {
  it('parte la fecha en día, mes corto y día de la semana', () => {
    expect(bloqueDeFecha('2026-12-05T00:00:00.000Z')).toEqual({
      dia: '5',
      mes: 'dic',
      diaDeLaSemana: 'sáb',
    });
  });

  it('una fecha que no se entiende no rompe la tarjeta', () => {
    expect(bloqueDeFecha('no-es-fecha')).toBeNull();
  });
});

describe('textoDeInscripcion', () => {
  it('con inscripción, el monto', () => {
    expect(textoDeInscripcion({ required: true, amount: 15000 })).toBe(
      `Inscripción ${formatearMonto(15000)}`,
    );
  });

  /** «Sin costo» y «no se sabe» no son lo mismo: por eso el endpoint manda `payment` entero. */
  it('sin inscripción, lo dice', () => {
    expect(textoDeInscripcion({ required: false, amount: 0 })).toBe('Sin costo');
  });
});
