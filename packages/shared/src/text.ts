/**
 * Comparación de texto determinista.
 *
 * **Sin `localeCompare`**: su resultado depende del locale del entorno, y el
 * armado de patrullas y los rankings tienen que ser reproducibles en cualquier
 * máquina. Un torneo que se arma distinto en el celular del admin y en el
 * servidor es un torneo roto.
 */

/** Minúsculas y sin acentos. */
export function normalizeText(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Comparador de tres vías, estable en todo entorno. */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Compara dos nombres propios: apellido, después nombre. */
export function comparePersonName(
  a: { lastName: string; firstName: string },
  b: { lastName: string; firstName: string },
): number {
  return (
    compareText(normalizeText(a.lastName), normalizeText(b.lastName)) ||
    compareText(normalizeText(a.firstName), normalizeText(b.firstName))
  );
}
