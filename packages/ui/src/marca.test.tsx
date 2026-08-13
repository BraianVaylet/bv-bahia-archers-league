import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Footer } from './Footer.js';
import { Logo } from './Logo.js';

/**
 * La marca (REF2-2).
 *
 * Lo que se prueba es que **la marca no dependa de que las imágenes carguen**.
 * Un logo es una imagen: sin red, con las imágenes apagadas, o en un lector de
 * pantalla, lo único que queda es el texto.
 */

afterEach(cleanup);

const SVG_CANONICO = join(process.cwd(), '..', 'shared', 'assets', 'liga.svg');

describe('Logo', () => {
  /**
   * **El arte está escrito dos veces**: en este componente y en el `.svg` del
   * que salen el ícono de la PWA y el favicon. No hay forma razonable de tener
   * una sola copia —un `<img>` no se puede recolorear ni inlinear— así que hay
   * un test que las compara.
   *
   * Dos copias de un logo se separan. La que se separa es siempre la que nadie
   * mira, que acá es el ícono de la pantalla de inicio.
   */
  it('dibuja lo mismo que el SVG canónico', () => {
    const archivo = readFileSync(SVG_CANONICO, 'utf8');
    const { container } = render(<Logo />);
    const componente = container.innerHTML;

    // Los tres círculos y la placa, con sus radios y sus colores.
    for (const rasgo of ['#16170f', '#c6f000', '#f4f3ec', 'r="21"', 'r="12.5"', 'r="4.5"']) {
      expect(archivo, `el archivo no tiene ${rasgo}`).toContain(rasgo);
      expect(componente, `el componente no tiene ${rasgo}`).toContain(rasgo);
    }
  });

  /**
   * La regla 8: rojo, azul y amarillo son sólo estaca. El logo anterior los
   * usaba como identidad —era la única excepción de toda la interfaz— y el
   * nuevo la saca.
   */
  it('no usa ningún color de estaca', () => {
    const archivo = readFileSync(SVG_CANONICO, 'utf8');
    const { container } = render(<Logo />);

    for (const estaca of ['#d22b2b', '#1d5fd6', '#f5c518']) {
      expect(archivo.toLowerCase()).not.toContain(estaca);
      expect(container.innerHTML.toLowerCase()).not.toContain(estaca);
    }
  });

  // Por defecto es decorativo: el nombre de la liga está escrito al lado.
  it('es decorativo salvo que se le dé un título', () => {
    const { container } = render(<Logo />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden');

    cleanup();

    render(<Logo titulo="Liga Bahiense de Arquería" />);
    expect(screen.getByRole('img', { name: 'Liga Bahiense de Arquería' })).toBeInTheDocument();
  });
});

describe('Footer', () => {
  it('nombra a las dos instituciones con texto, no sólo con imágenes', () => {
    render(<Footer />);

    expect(screen.getByText('Liga Bahiense de Arquería')).toBeInTheDocument();
    expect(screen.getByText('Círculo Bahiense de Arquería')).toBeInTheDocument();
  });

  /**
   * Los logos van con `alt` vacío **a propósito**: el nombre está al lado. Un
   * `alt` con el nombre haría que un lector de pantalla lo diga dos veces.
   */
  it('los logos no repiten lo que ya dice el texto', () => {
    const { container } = render(<Footer />);

    for (const img of container.querySelectorAll('img')) {
      expect(img).toHaveAttribute('alt', '');
    }
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden');
  });

  it('no se imprime', () => {
    const { container } = render(<Footer />);
    expect(container.querySelector('footer')?.className).toContain('print:hidden');
  });
});
