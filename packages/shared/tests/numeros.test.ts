import { describe, expect, it } from 'vitest';
import { formatearMonto } from '../src/index.js';

/**
 * Formateo de montos (REF-5).
 *
 * La inscripción y la recaudación se muestran en pesos, con el separador de
 * miles argentino: sin él, `1500000` y `150000` se confunden de un vistazo.
 */

describe('formatearMonto', () => {
  it('separa los miles con punto, como se escribe acá', () => {
    expect(formatearMonto(15_000)).toBe('$ 15.000');
    expect(formatearMonto(1_500_000)).toBe('$ 1.500.000');
  });

  it('sin decimales: la inscripción no tiene centavos', () => {
    expect(formatearMonto(15_000.6)).toBe('$ 15.001');
  });

  it('cero es cero, no vacío', () => {
    expect(formatearMonto(0)).toBe('$ 0');
  });

  it('un número chico no lleva separador', () => {
    expect(formatearMonto(500)).toBe('$ 500');
  });
});
