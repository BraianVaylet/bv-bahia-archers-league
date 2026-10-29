import { describe, expect, it } from 'vitest';
import { armarTarjetaDePuntajes } from '../src/index';

/**
 * Tarjeta de puntajes de un arquero: flecha por flecha, blanco por blanco.
 *
 * Es lo que se muestra al entrar a un arquero desde los resultados de un torneo
 * publicado. **El servidor es la autoridad**: el valor de cada flecha y el total
 * de cada blanco se derivan de los tokens y de la modalidad **del blanco**, no se
 * leen de ningún total guardado.
 *
 * Referencia: docs/DOMAIN_WA.md §1 y §2.
 */

const RECORRIDO = [
  { index: 1, modality: '3d', arrows: 2 },
  { index: 2, modality: 'sala', arrows: 3 },
] as const;

describe('armarTarjetaDePuntajes', () => {
  it('arma una fila por blanco, en el orden del recorrido, con su modalidad y su máximo', () => {
    const tarjeta = armarTarjetaDePuntajes(RECORRIDO, [
      { targetIndex: 1, arrows: ['11', '10'] },
      { targetIndex: 2, arrows: ['X', '9', '8'] },
    ]);

    expect(tarjeta.rows.map((f) => [f.index, f.modality, f.maxTotal])).toEqual([
      [1, '3d', 22],
      [2, 'sala', 30],
    ]);
  });

  it('trae cada flecha con el valor que le da la modalidad de SU blanco', () => {
    const tarjeta = armarTarjetaDePuntajes(RECORRIDO, [
      { targetIndex: 1, arrows: ['11', '5'] },
      { targetIndex: 2, arrows: ['X', '9', 'M'] },
    ]);

    // Un `11` vale 11 en el blanco 3D; la `X` de sala vale 10 y la `M` no vale nada.
    expect(tarjeta.rows[0]?.arrows).toEqual([
      { token: '11', value: 11 },
      { token: '5', value: 5 },
    ]);
    expect(tarjeta.rows[1]?.arrows).toEqual([
      { token: 'X', value: 10 },
      { token: '9', value: 9 },
      { token: 'M', value: 0 },
    ]);
  });

  // Notación de planilla: la flecha mejor primero, aunque se haya tirado última.
  it('muestra las flechas de mayor a menor, con la inner primero a igual valor', () => {
    const tarjeta = armarTarjetaDePuntajes(RECORRIDO, [
      { targetIndex: 1, arrows: ['5', '11'] },
      { targetIndex: 2, arrows: ['M', '10', 'X'] },
    ]);

    expect(tarjeta.rows[0]?.arrows?.map((f) => f.token)).toEqual(['11', '5']);
    expect(tarjeta.rows[1]?.arrows?.map((f) => f.token)).toEqual(['X', '10', 'M']);
  });

  it('deriva el total de cada blanco y el general de los tokens', () => {
    const tarjeta = armarTarjetaDePuntajes(RECORRIDO, [
      { targetIndex: 1, arrows: ['11', '5'] },
      { targetIndex: 2, arrows: ['X', '9', 'M'] },
    ]);

    expect(tarjeta.rows.map((f) => f.total)).toEqual([16, 19]);
    expect(tarjeta.total).toBe(35);
    expect(tarjeta.maxTotal).toBe(52);
  });

  // Un arquero ausente en un blanco no es un blanco con cero: no se le tiró.
  it('un blanco sin puntaje queda con `arrows: null` y suma cero', () => {
    const tarjeta = armarTarjetaDePuntajes(RECORRIDO, [
      { targetIndex: 2, arrows: ['X', '9', '8'] },
    ]);

    expect(tarjeta.rows[0]).toMatchObject({ index: 1, arrows: null, total: 0, maxTotal: 22 });
    expect(tarjeta.total).toBe(27);
    // El máximo es el del recorrido entero, no el de lo que se tiró.
    expect(tarjeta.maxTotal).toBe(52);
  });

  it('ordena las filas por número de blanco aunque el recorrido venga desordenado', () => {
    const tarjeta = armarTarjetaDePuntajes([...RECORRIDO].reverse(), []);

    expect(tarjeta.rows.map((f) => f.index)).toEqual([1, 2]);
  });

  it('ignora un puntaje de un blanco que no está en el recorrido', () => {
    const tarjeta = armarTarjetaDePuntajes(RECORRIDO, [{ targetIndex: 9, arrows: ['11', '11'] }]);

    expect(tarjeta.rows).toHaveLength(2);
    expect(tarjeta.total).toBe(0);
  });

  // La modalidad es del blanco. Un `11` guardado en el blanco de sala es un dato
  // roto, y se nota: no se lo muestra como cero ni se lo corrige en silencio.
  it('lanza INVALID_TOKEN si la flecha no existe en la modalidad del blanco', () => {
    expect(() =>
      armarTarjetaDePuntajes(RECORRIDO, [{ targetIndex: 2, arrows: ['11', '9', '8'] }]),
    ).toThrow(expect.objectContaining({ code: 'INVALID_TOKEN' }));
  });

  it('no muta los argumentos', () => {
    const recorrido = [...RECORRIDO].reverse();
    const flechas = ['5', '11'];
    const puntajes = [{ targetIndex: 1, arrows: flechas }];

    armarTarjetaDePuntajes(recorrido, puntajes);

    expect(flechas).toEqual(['5', '11']);
    expect(recorrido.map((b) => b.index)).toEqual([2, 1]);
  });
});
