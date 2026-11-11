/**
 * Lo que la pantalla de corrección de puntajes decide antes de dibujar (`FE-34`).
 *
 * El admin tiene la planilla de papel al lado y compara fila contra fila. **Acá no se calcula
 * ningún puntaje que se vaya a guardar**: los valores y los totales los deriva el servidor al
 * corregir (`BE-25`, regla 1). Lo de acá es para leer y para armar el pedido.
 */

import type { FilaDeTarjeta } from '@bal/shared';

/** El motivo mínimo que acepta el servidor (`ScoreCorrectionSchema`). */
export const MIN_MOTIVO = 5;

/**
 * Las filas de la tarjeta con su acumulado, como la columna de la planilla.
 *
 * Un blanco sin puntaje no tiene acumulado (no es un cero: no se tiró o no se anotó), y el
 * siguiente sigue la cuenta desde el último que sí tiene.
 */
export function conAcumulado(
  filas: readonly FilaDeTarjeta[],
): { fila: FilaDeTarjeta; acumulado: number | null }[] {
  let suma = 0;
  return filas.map((fila) => {
    if (fila.arrows === null) return { fila, acumulado: null };
    suma += fila.total;
    return { fila, acumulado: suma };
  });
}

/** Suma una flecha al borrador, sin pasarse de las que lleva el blanco. */
export function agregarFlecha(flechas: readonly string[], token: string, max: number): string[] {
  return flechas.length >= max ? [...flechas] : [...flechas, token];
}

export function quitarUltima(flechas: readonly string[]): string[] {
  return flechas.slice(0, -1);
}

/** Qué le falta a la corrección para poder guardarse, o `undefined` si está lista. */
export function problemaDeCorreccion(
  flechas: readonly string[],
  max: number,
  motivo: string,
): string | undefined {
  const faltan = max - flechas.length;
  if (faltan > 0)
    return `Falta${faltan === 1 ? '' : 'n'} ${faltan} flecha${faltan === 1 ? '' : 's'}.`;
  if (motivo.trim().length < MIN_MOTIVO) return 'Contá en pocas palabras por qué se corrige.';
  return undefined;
}
