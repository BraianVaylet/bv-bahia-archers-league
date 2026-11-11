import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Icono } from './iconos/base.js';
import * as ui from './index.js';

/**
 * Los íconos de navegación (`REF7-3` / `C-6`).
 *
 * Las pantallas nuevas de `ref-7` necesitan volver, avanzar, sincronizar, sin señal, panel, podio,
 * arqueros, calendario, lugar e instalar. Ninguno existía, y donde hacía falta se usaban caracteres
 * sueltos ("←"), que dependen de la fuente del sistema y no se alinean con el texto de al lado.
 *
 * Se prueba que salgan **del barril** de `@bal/ui` (que es por donde los importan la PWA y la
 * landing) y que respeten el trazo común: si uno trajera su propio grosor o su color, se notaría
 * que vino de otro lado.
 */

afterEach(cleanup);

const NUEVOS = [
  'IconoChevron',
  'IconoFlecha',
  'IconoVolver',
  'IconoSincronizar',
  'IconoSinSenal',
  'IconoPanel',
  'IconoPodio',
  'IconoArqueros',
  'IconoCalendario',
  'IconoLugar',
  'IconoInstalar',
  // `FE-37`: el enlace al repositorio, en el pie, sale del sitio.
  'IconoEnlaceExterno',
] as const;

const exportados = ui as unknown as Record<string, Icono | undefined>;

describe('los íconos de navegación', () => {
  it.each(NUEVOS)('%s se exporta desde @bal/ui', (nombre) => {
    expect(typeof exportados[nombre]).toBe('function');
  });

  it.each(NUEVOS)('%s usa el trazo común y es decorativo', (nombre) => {
    const Componente = exportados[nombre] as Icono;
    const { container } = render(<Componente />);
    const svg = container.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('stroke-width', '1.8');
    expect(svg).toHaveAttribute('fill', 'none');
    // El texto de al lado dice qué es; suelto, quien lo usa le pasa su `aria-label`.
    expect(svg).toHaveAttribute('aria-hidden');
    // Dibuja algo: un `<svg>` vacío también pasaría lo de arriba.
    expect(svg?.children.length).toBeGreaterThan(0);
  });

  it.each([16, 20, 24])('se dibujan a %ipx', (size) => {
    for (const nombre of NUEVOS) {
      const Componente = exportados[nombre] as Icono;
      const { container } = render(<Componente size={size} />);
      const svg = container.querySelector('svg');

      expect(svg, nombre).toHaveAttribute('width', String(size));
      expect(svg, nombre).toHaveAttribute('height', String(size));
      cleanup();
    }
  });

  it('suelto, acepta su nombre accesible', () => {
    const { container } = render(
      <ui.IconoSinSenal role="img" aria-label="Sin señal" aria-hidden={false} />,
    );
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('aria-label', 'Sin señal');
    expect(svg).toHaveAttribute('aria-hidden', 'false');
  });
});
