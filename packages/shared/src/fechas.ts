/**
 * Formateo de fechas, en el idioma y el orden del club.
 *
 * **Todo se formatea en UTC, a propósito.** La fecha de un torneo o de una
 * temporada es un *día del calendario*, no un instante: el 8 de agosto es el 8
 * de agosto se lea desde donde se lea. La API la guarda como medianoche UTC, y
 * Argentina es UTC-3 — formatear en la zona del navegador mostraría el día
 * anterior. En la planilla impresa esa diferencia es un problema real.
 *
 * Ver `docs/DESIGN_SYSTEM.md` §10.
 */

const LOCALE = 'es-AR';

/** Formateadores creados una sola vez: `Intl.DateTimeFormat` es caro de construir. */
const LARGA = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const LARGA_SIN_AÑO = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

const CORTA = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * Interpreta el valor recibido, o `null` si no se puede.
 *
 * Una fecha sin hora —`2026-08-08`— la trata como medianoche **UTC**, que es
 * lo mismo que hace `new Date()` con ese formato y lo que se quiere acá.
 */
function interpretar(valor: string | Date): Date | null {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/**
 * `8 de agosto de 2026`.
 *
 * Si el valor no se puede interpretar se devuelve **tal cual**: es un bug, pero
 * romper la pantalla es peor que mostrar el dato crudo, que además deja verlo
 * para reportarlo.
 */
export function formatearFecha(valor: string | Date): string {
  const fecha = interpretar(valor);
  return fecha ? LARGA.format(fecha) : String(valor);
}

/** `08/08/2026` — día, mes, año, que es el orden que se usa acá. */
export function formatearFechaCorta(valor: string | Date): string {
  const fecha = interpretar(valor);
  return fecha ? CORTA.format(fecha) : String(valor);
}

/**
 * `1 de marzo — 30 de noviembre de 2026`.
 *
 * Del mismo año el año no se repite: se lee más rápido y es como se escribe.
 */
export function formatearRango(desde: string | Date, hasta: string | Date): string {
  const a = interpretar(desde);
  const b = interpretar(hasta);

  if (!a || !b) return `${formatearFecha(desde)} — ${formatearFecha(hasta)}`;

  const mismoAño = a.getUTCFullYear() === b.getUTCFullYear();
  return `${mismoAño ? LARGA_SIN_AÑO.format(a) : LARGA.format(a)} — ${LARGA.format(b)}`;
}
