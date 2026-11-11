import { describe, expect, it } from 'vitest';
import { ambienteDeDesarrollo } from './vite.js';

/**
 * `pnpm dev` también es desarrollo, y ahí no hay API que marque el `index.html`: lo sirve el Vite
 * de cada frontend. Este plugin hace lo mismo que `marcarAmbiente` en la API.
 */
describe('ambienteDeDesarrollo', () => {
  const plugin = ambienteDeDesarrollo();

  it('marca el <html> como desarrollo', () => {
    expect(plugin.transformIndexHtml('<!doctype html><html lang="es-AR"><head>')).toBe(
      '<!doctype html><html data-ambiente="development" lang="es-AR"><head>',
    );
  });

  // `vite build` no lo aplica: el build no sabe en qué ambiente va a correr. Lo marca la API.
  it('sólo corre en el servidor de desarrollo, no en el build', () => {
    expect(plugin.apply).toBe('serve');
  });
});
