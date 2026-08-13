/**
 * Formateo de números del dominio.
 *
 * Ver `docs/DESIGN_SYSTEM.md` §9.1, que agrupa esto con el de fechas.
 */

/**
 * `$ 15.000`.
 *
 * Sin decimales: la inscripción no tiene centavos, y un separador de miles con
 * la coma decimal al lado se lee mal en una tarjeta chica.
 *
 * Se arma con `Intl.NumberFormat` y no a mano porque el separador de miles
 * argentino es el punto y el decimal la coma — al revés que el default de
 * JavaScript.
 */
const MONTO = new Intl.NumberFormat('es-AR', {
  style: 'decimal',
  maximumFractionDigits: 0,
});

export function formatearMonto(pesos: number): string {
  return `$ ${MONTO.format(pesos)}`;
}
