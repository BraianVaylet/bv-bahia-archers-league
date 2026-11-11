import { describe, expect, it } from 'vitest';
import { agregarFlecha, conAcumulado, problemaDeCorreccion, quitarUltima } from './correccion.js';

/**
 * Lo que la pantalla de corrección decide antes de dibujar (`FE-34`). El admin tiene la planilla
 * de papel al lado y compara fila contra fila; el servidor recalcula todo al guardar (`BE-25`).
 */

const fila = (index: number, tokens: string[] | null, total = 0) => ({
  index,
  modality: '3d' as const,
  arrows: tokens?.map((token) => ({ token, value: 0 })) ?? null,
  total,
  maxTotal: 22,
});

describe('conAcumulado', () => {
  /** Como la columna «Acumulado» de la planilla: se lee de arriba abajo. */
  it('suma los blancos en orden', () => {
    const filas = conAcumulado([fila(1, ['11', '8'], 19), fila(2, ['10', '5'], 15)]);
    expect(filas.map((f) => f.acumulado)).toEqual([19, 34]);
  });

  /** Un blanco sin puntaje no es un cero: no tiene acumulado, y el siguiente sigue la cuenta. */
  it('un blanco sin puntaje no tiene acumulado y no corta la cuenta', () => {
    const filas = conAcumulado([fila(1, ['11', '8'], 19), fila(2, null), fila(3, ['5', 'M'], 5)]);
    expect(filas.map((f) => f.acumulado)).toEqual([19, null, 24]);
  });
});

describe('flechas del borrador', () => {
  it('agrega hasta completar el blanco, y no más', () => {
    expect(agregarFlecha(['10'], '8', 2)).toEqual(['10', '8']);
    expect(agregarFlecha(['10', '8'], '5', 2)).toEqual(['10', '8']);
  });

  it('quita la última', () => {
    expect(quitarUltima(['10', '8'])).toEqual(['10']);
    expect(quitarUltima([])).toEqual([]);
  });

  it('no muta lo que recibe', () => {
    const antes = ['10'];
    agregarFlecha(antes, '8', 2);
    quitarUltima(antes);
    expect(antes).toEqual(['10']);
  });
});

describe('problemaDeCorreccion', () => {
  it('pide todas las flechas del blanco', () => {
    expect(problemaDeCorreccion(['10'], 2, 'La planilla dice otra cosa.')).toMatch(/1 flecha/);
  });

  /** El audit log tiene que poder explicar por qué cambió un resultado. */
  it('pide un motivo de al menos cinco letras', () => {
    expect(problemaDeCorreccion(['10', '8'], 2, ' ok ')).toMatch(/por qué/i);
  });

  it('con las flechas y el motivo, se puede guardar', () => {
    expect(problemaDeCorreccion(['10', '8'], 2, 'La planilla dice 10 y 8.')).toBeUndefined();
  });
});
