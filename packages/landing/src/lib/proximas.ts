/**
 * Lo que «Próximas fechas» decide antes de dibujar (`FE-38`, `docs/FUNCTIONAL.md` §5.3).
 *
 * Funciones puras: `ProximasFechas` sólo pinta lo que sale de acá.
 */

import { formatearMonto } from '@bal/shared';

/** Cuántas próximas fechas entran en la portada. `/torneos` muestra todas las que mande la API. */
export const PROXIMAS_EN_PORTADA = 3;

/** Las más cercanas, en el orden en que llegan: la API ya las manda de la más cercana a la última. */
export function proximasDeLaPortada<T>(lista: readonly T[]): T[] {
  return lista.slice(0, PROXIMAS_EN_PORTADA);
}

/*
  En UTC: la fecha de un torneo es un día del calendario guardado como medianoche UTC. Leída en la
  zona de Argentina (UTC-3), el 5 de diciembre saldría como 4. Ver `@bal/shared/fechas.ts`.
*/
const DIA = new Intl.DateTimeFormat('es-AR', { day: 'numeric', timeZone: 'UTC' });
const MES = new Intl.DateTimeFormat('es-AR', { month: 'short', timeZone: 'UTC' });
const SEMANA = new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'UTC' });

/** Sin el punto de abreviatura que agrega `es-AR` («dic.», «sáb.»): en un bloque grande sobra. */
const sinPunto = (texto: string) => texto.replace(/\.$/, '');

/** El bloque de fecha de la tarjeta, o `null` si la fecha no se entiende (no rompe la tarjeta). */
export function bloqueDeFecha(
  valor: string,
): { dia: string; mes: string; diaDeLaSemana: string } | null {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  return {
    dia: DIA.format(fecha),
    mes: sinPunto(MES.format(fecha)),
    diaDeLaSemana: sinPunto(SEMANA.format(fecha)),
  };
}

/** «Inscripción $ 15.000» o «Sin costo»: no es lo mismo que no saberlo. */
export function textoDeInscripcion(pago: { required: boolean; amount: number }): string {
  return pago.required ? `Inscripción ${formatearMonto(pago.amount)}` : 'Sin costo';
}
