import { describe, expect, it } from 'vitest';
import { temporadaActiva } from './temporada.js';

/**
 * Cuál es la temporada que se nombra en el pie (y, desde `REF7-6`, en el hero).
 *
 * `/api/public/seasons` las devuelve de la más nueva a la más vieja. Se nombra la **activa**; si
 * no hay ninguna, no se inventa una: el pie simplemente no la dice.
 */
describe('temporadaActiva', () => {
  const t = (id: string, status: 'activa' | 'cerrada') => ({ id, name: `Liga ${id}`, status });

  it('es la primera activa, en el orden en que llegan', () => {
    expect(temporadaActiva([t('2027', 'activa'), t('2026', 'activa')])?.id).toBe('2027');
  });

  it('salta las cerradas', () => {
    expect(temporadaActiva([t('2027', 'cerrada'), t('2026', 'activa')])?.id).toBe('2026');
  });

  it('sin ninguna activa no hay temporada', () => {
    expect(temporadaActiva([t('2025', 'cerrada')])).toBeNull();
    expect(temporadaActiva([])).toBeNull();
  });
});
