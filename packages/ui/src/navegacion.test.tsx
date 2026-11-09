import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOMBRE_DEL_SITIO, useAlCambiarDeRuta, useTituloDePagina } from './navegacion.js';

/**
 * Navegación accesible (`REF6-12` / `U-5`).
 *
 * En una SPA el navegador no hace lo que hace con una página nueva: no cambia el título que oye un
 * lector de pantalla (WCAG 2.4.2), no lleva el scroll arriba cuando el contenido scrollea dentro de
 * un contenedor y no mueve el foco. Estos tests fijan las tres cosas.
 */

afterEach(() => {
  cleanup();
  document.title = '';
  vi.useRealTimers();
});

describe('useTituloDePagina', () => {
  function Pagina({ titulo }: { readonly titulo?: string }) {
    useTituloDePagina(titulo);
    return null;
  }

  beforeEach(() => {
    document.title = '';
  });

  it('pone el título de la página seguido del nombre del sitio', () => {
    render(<Pagina titulo="Ranking" />);

    expect(document.title).toBe(`Ranking · ${NOMBRE_DEL_SITIO}`);
  });

  it('cambia cuando cambia el título, como el nombre de un torneo que recién llegó', () => {
    const { rerender } = render(<Pagina titulo="Torneo" />);
    rerender(<Pagina titulo="3ª fecha" />);

    expect(document.title).toBe(`3ª fecha · ${NOMBRE_DEL_SITIO}`);
  });

  it('sin título, queda el nombre del sitio', () => {
    render(<Pagina />);

    expect(document.title).toBe(NOMBRE_DEL_SITIO);
  });

  it('un título vacío cuenta como ausente: no deja «  · Liga Bahiense»', () => {
    render(<Pagina titulo="   " />);

    expect(document.title).toBe(NOMBRE_DEL_SITIO);
  });
});

describe('useAlCambiarDeRuta', () => {
  function Arnes({
    pathname,
    conH1 = true,
    conTitulo = false,
    conScroll = true,
  }: {
    readonly pathname: string;
    readonly conH1?: boolean;
    readonly conTitulo?: boolean;
    readonly conScroll?: boolean;
  }) {
    useAlCambiarDeRuta(pathname);
    return (
      <div>
        {conTitulo && <span data-titulo-de-pagina>Encabezado</span>}
        <input aria-label="buscar" />
        <div {...(conScroll ? { 'data-scroll-principal': '' } : {})} data-testid="scroll">
          {conH1 && <h1>Pantalla</h1>}
        </div>
      </div>
    );
  }

  const scroller = () => document.querySelector<HTMLElement>('[data-scroll-principal]');

  it('en el primer render no mueve nada: la página recién abierta ya está arriba', () => {
    const { container } = render(<Arnes pathname="/a" />);
    const s = scroller();
    if (s) s.scrollTop = 120;

    expect(s?.scrollTop).toBe(120);
    expect(container.contains(document.activeElement) && document.activeElement?.tagName).not.toBe(
      'H1',
    );
  });

  it('al cambiar de ruta lleva el scroll del contenedor a 0', () => {
    const { rerender } = render(<Arnes pathname="/a" />);
    const s = scroller();
    if (s) s.scrollTop = 480;

    rerender(<Arnes pathname="/b" />);

    expect(s?.scrollTop).toBe(0);
  });

  /**
   * **Sin contenedor de scroll, scrollea la ventana** (`REF7-5`). La landing pasó a ser un
   * documento —header sticky, pie al final— y ya no tiene un `[data-scroll-principal]`: lo que
   * scrollea es la página entera.
   */
  it('sin contenedor de scroll, lleva la ventana arriba', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    const { rerender } = render(<Arnes pathname="/a" conScroll={false} />);

    rerender(<Arnes pathname="/b" conScroll={false} />);

    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    vi.unstubAllGlobals();
  });

  it('con contenedor, la ventana no se toca: la PWA scrollea adentro', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    const { rerender } = render(<Arnes pathname="/a" />);

    rerender(<Arnes pathname="/b" />);

    expect(scrollTo).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('y pone el foco en el h1, que no es focusable de por sí', () => {
    const { rerender, getByRole } = render(<Arnes pathname="/a" />);

    rerender(<Arnes pathname="/b" />);

    const h1 = getByRole('heading', { level: 1 });
    expect(document.activeElement).toBe(h1);
    expect(h1).toHaveAttribute('tabindex', '-1');
  });

  it('si la pantalla no tiene h1, el foco va al título del encabezado', () => {
    const { rerender, getByText } = render(<Arnes pathname="/a" conH1={false} conTitulo />);

    rerender(<Arnes pathname="/b" conH1={false} conTitulo />);

    expect(document.activeElement).toBe(getByText('Encabezado'));
  });

  it('con las dos cosas gana el h1: es el título del contenido', () => {
    const { rerender, getByRole } = render(<Arnes pathname="/a" conTitulo />);

    rerender(<Arnes pathname="/b" conTitulo />);

    expect(document.activeElement).toBe(getByRole('heading', { level: 1 }));
  });

  it('no pisa un tabindex que el elemento ya traía', () => {
    function ConTabindex({ pathname }: { readonly pathname: string }) {
      useAlCambiarDeRuta(pathname);
      // biome-ignore lint/a11y/noNoninteractiveTabindex: es justo lo que se prueba, que el hook respete un tabindex ya puesto.
      return <h1 tabIndex={0}>Pantalla</h1>;
    }
    const { rerender, getByRole } = render(<ConTabindex pathname="/a" />);

    rerender(<ConTabindex pathname="/b" />);

    expect(getByRole('heading', { level: 1 })).toHaveAttribute('tabindex', '0');
  });

  it('si la ruta no cambia, no hace nada', () => {
    const { rerender } = render(<Arnes pathname="/a" />);
    const s = scroller();
    if (s) s.scrollTop = 300;

    rerender(<Arnes pathname="/a" />);

    expect(s?.scrollTop).toBe(300);
    expect(document.activeElement?.tagName).not.toBe('H1');
  });

  it('no se lleva el foco si quien navega ya está escribiendo en otro lado', () => {
    const { rerender, getByLabelText } = render(<Arnes pathname="/a" />);
    getByLabelText('buscar').focus();

    rerender(<Arnes pathname="/b" />);

    expect(document.activeElement).toBe(getByLabelText('buscar'));
  });

  it('sin contenedor de scroll no falla', () => {
    const { rerender } = render(<Arnes pathname="/a" conScroll={false} />);

    expect(() => rerender(<Arnes pathname="/b" conScroll={false} />)).not.toThrow();
  });

  // Una página que carga datos o un chunk perezoso todavía no tiene su h1 cuando cambia la ruta.
  it('si el h1 aparece después, el foco va cuando aparece', async () => {
    const { rerender } = render(<Arnes pathname="/a" conH1={false} />);
    rerender(<Arnes pathname="/b" conH1={false} />);
    expect(document.activeElement?.tagName).toBe('BODY');

    await act(async () => {
      const h1 = document.createElement('h1');
      h1.textContent = 'Llegó';
      scroller()?.appendChild(h1);
    });

    await waitFor(() => expect(document.activeElement?.textContent).toBe('Llegó'));
  });

  it('y deja de esperar pasado un plazo: un h1 de mucho después no le roba el foco a nadie', async () => {
    vi.useFakeTimers();
    const { rerender } = render(<Arnes pathname="/a" conH1={false} />);
    rerender(<Arnes pathname="/b" conH1={false} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    await act(async () => {
      const h1 = document.createElement('h1');
      h1.textContent = 'Tarde';
      scroller()?.appendChild(h1);
    });

    expect(document.activeElement?.tagName).toBe('BODY');
  });

  it('si el usuario se puso a escribir mientras esperaba, el h1 tardío no le roba el foco', async () => {
    const { rerender, getByLabelText } = render(<Arnes pathname="/a" conH1={false} />);
    rerender(<Arnes pathname="/b" conH1={false} />);
    getByLabelText('buscar').focus();

    await act(async () => {
      const h1 = document.createElement('h1');
      h1.textContent = 'Llegó';
      scroller()?.appendChild(h1);
    });

    expect(document.activeElement).toBe(getByLabelText('buscar'));
  });
});
