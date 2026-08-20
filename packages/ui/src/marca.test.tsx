import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Footer } from './Footer.js';
import { GraficoDeEvolucion } from './GraficoDeEvolucion.js';
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
  it('los dos escudos van juntos a la izquierda y el nombre a la derecha', () => {
    const { container } = render(<Footer />);

    const fila = container.querySelector('footer > div') as HTMLElement;
    const primero = fila.firstElementChild as HTMLElement;

    // A la izquierda, las dos imágenes: el PNG del club y el SVG de la liga.
    expect(primero.querySelector('img')).not.toBeNull();
    expect(primero.querySelector('svg')).not.toBeNull();

    // A la derecha, el nombre.
    expect((fila.lastElementChild as HTMLElement).textContent).toBe('Liga Bahiense');
  });

  /**
   * **El `alt` del escudo del club dejó de ser decorativo.**
   *
   * Antes el nombre del CBA iba escrito al lado y el `alt` vacío evitaba que un
   * lector de pantalla lo dijera dos veces. Ahora el texto visible es sólo el de
   * la liga: con el `alt` vacío, para un lector de pantalla **el club no
   * existiría**.
   */
  it('el escudo del club se anuncia, porque su nombre ya no está escrito', () => {
    render(<Footer />);
    expect(screen.getByAltText('Círculo Bahiense de Arquería')).toBeInTheDocument();
  });

  /** El de la liga sí es decorativo: el nombre está al lado. */
  it('el logo de la liga no repite el nombre que ya se lee', () => {
    const { container } = render(<Footer />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden');
  });

  /**
   * La versión compacta existe para que el pie entre en las pantallas que
   * terminan en barra de acción, sin robarle alto al teclado de scoring.
   */
  it('la versión compacta ocupa menos alto', () => {
    const { container: normal } = render(<Footer />);
    const alto = (c: HTMLElement) => (c.querySelector('footer > div') as HTMLElement).className;
    expect(alto(normal as unknown as HTMLElement)).toContain('py-6');

    cleanup();
    const { container: chico } = render(<Footer compacto />);
    expect(alto(chico as unknown as HTMLElement)).toContain('py-1.5');
  });

  /**
   * **El pie no trae margen propio.**
   *
   * Tenía `mt-8` y los dos únicos consumidores lo cancelaban con `mt-0`: en una
   * columna flex de alto fijo ese margen no es aire, es un hueco entre el
   * contenido y el pie. Un valor que todo el mundo anula no es un default, es
   * una trampa: el que agregue un consumidor nuevo se come el hueco y no sabe
   * de dónde salió.
   */
  it('no trae margen propio', () => {
    const { container } = render(<Footer />);
    const clases = (container.querySelector('footer')?.className ?? '').split(/\s+/);

    /*
      Se comparan clases enteras en vez de buscar con una expresión regular.

      La primera versión usaba un límite de palabra y quedó escrito como un
      **carácter de retroceso literal**, invisible al leer el archivo: la
      expresión no matcheaba nunca y el test pasaba vacío. Lo destapó el control
      de mutación que repone el `mt-8`.
    */
    expect(clases.filter((c) => c.startsWith('mt-'))).toEqual([]);
  });

  it('no se imprime', () => {
    const { container } = render(<Footer />);
    expect(container.querySelector('footer')?.className).toContain('print:hidden');
  });
});

// ── REF2-7 · Gráfico de evolución ────────────────────────────────────────────

describe('GraficoDeEvolucion', () => {
  const punto = (name: string, normalizedPct: number) => ({ name, normalizedPct });

  /**
   * **Con un solo torneo no hay evolución.** Una línea de un punto es un punto,
   * y el número ya está escrito en la ficha.
   */
  it('no dibuja nada con menos de dos torneos', () => {
    expect(render(<GraficoDeEvolucion puntos={[]} />).container.firstChild).toBeNull();
    cleanup();
    expect(
      render(<GraficoDeEvolucion puntos={[punto('1ª', 80)]} />).container.firstChild,
    ).toBeNull();
  });

  /**
   * Quien no ve el gráfico **escucha la serie entera**. Un `<svg>` con
   * `role="img"` y sin descripción es un agujero en la página.
   */
  it('describe la serie completa para un lector de pantalla', () => {
    render(<GraficoDeEvolucion puntos={[punto('1ª fecha', 78), punto('2ª fecha', 85)]} />);

    const svg = screen.getByRole('img');
    expect(svg.getAttribute('aria-label')).toMatch(/1ª fecha: 78%/);
    expect(svg.getAttribute('aria-label')).toMatch(/2ª fecha: 85%/);
  });

  it('escribe el valor de cada punto, sin depender del mouse', () => {
    render(<GraficoDeEvolucion puntos={[punto('a', 78), punto('b', 85)]} />);

    expect(screen.getByText('78%')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  /**
   * **La escala es siempre 0-100.** Escalarla al máximo de la serie haría que
   * una temporada de 40% y 45% se viera igual de buena que una de 90% y 95%:
   * la línea subiría igual en las dos.
   */
  it('la escala no se adapta a la serie', () => {
    /**
     * Se mide contra una posición **absoluta**, no comparando dos series.
     *
     * Una primera versión comparaba las polilíneas de 40/45 y 90/95 y afirmaba
     * que fueran distintas — y con escala adaptativa **también** lo son, porque
     * los ratios internos difieren. Pasaba con la mutación puesta. Lo destapó
     * el control, no la corrida en verde.
     *
     * Con escala fija, un 100% toca el borde de arriba del área y un 0% el de
     * abajo, y el punto medio cae exactamente en el medio.
     */
    const yDe = (pct: number) => {
      cleanup();
      const { container } = render(
        <GraficoDeEvolucion puntos={[punto('a', pct), punto('b', pct)]} />,
      );
      const [primero] = (container.querySelector('polyline')?.getAttribute('points') ?? '').split(
        ' ',
      );
      return Number((primero ?? '').split(',')[1]);
    };

    const arriba = yDe(100);
    const medio = yDe(50);
    const abajo = yDe(0);

    expect(medio).toBeCloseTo((arriba + abajo) / 2, 5);
    // Y una serie floja se dibuja abajo, no estirada hasta arriba.
    expect(yDe(45)).toBeGreaterThan(medio);
  });
});

// ── REF3-2 · El logo del CBA no depende del tema ─────────────────────────────

describe('el logo del CBA en modo oscuro', () => {
  /**
   * **Es el único asset del proyecto que depende del fondo.**
   *
   * Un PNG con fondo transparente y tinta oscura: sobre el fondo claro se ve,
   * sobre el oscuro desaparece. El resto de la iconografía es SVG con
   * `currentColor`, y el logo de la Liga trae su propia placa.
   */
  it('va sobre una placa blanca', () => {
    const { container } = render(<Footer />);
    const img = container.querySelector('img');

    expect(img?.parentElement?.className, 'el logo del CBA no tiene placa').toMatch(/bg-white/);
  });

  /**
   * **Blanco literal, no un token.** Si la placa siguiera al tema volvería a
   * desaparecer en oscuro, que es justo lo que se está arreglando.
   */
  it('la placa no sigue al tema', () => {
    const { container } = render(<Footer />);
    const placa = container.querySelector('img')?.parentElement;

    // El radio sí sale de un token —eso no cambia con el tema—; el FONDO no.
    expect(placa?.className).not.toMatch(/bg-\[var\(--/);
  });
});
