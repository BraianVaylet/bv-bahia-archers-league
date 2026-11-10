import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

/**
 * Navegación accesible del sitio público (`REF6-12` / `U-5`).
 *
 * Se monta la `App` de verdad, con su `BrowserRouter` y el `main` que scrollea: es justamente la
 * combinación (un contenedor compartido entre rutas) la que dejaba entrar a una ficha a la mitad
 * de la página. El fetch nunca responde: acá importa la pantalla, no los datos.
 */

beforeEach(() => {
  window.history.pushState({}, '', '/');
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.title = '';
});

const principal = () => {
  const main = document.querySelector('main');
  if (!main) throw new Error('el sitio no tiene <main>');
  return main;
};

describe('navegar por el sitio público', () => {
  it('cada pantalla pone su título', () => {
    render(<App />);
    expect(document.title).toBe('Resultados y ranking · Liga Bahiense de Arquería');

    fireEvent.click(screen.getAllByRole('link', { name: 'Ranking' })[0] as HTMLElement);
    expect(document.title).toBe('Ranking · Liga Bahiense de Arquería');

    fireEvent.click(screen.getAllByRole('link', { name: 'Torneos' })[0] as HTMLElement);
    expect(document.title).toBe('Torneos · Liga Bahiense de Arquería');
  });

  /**
   * **La landing es un documento** (`REF7-5` / `L-2`): scrollea la página entera, con el header
   * sticky y el pie al final. Antes el medio scrolleaba entre un header y un pie fijos, y el pie
   * se comía ~80px de alto útil. Al navegar, lo que vuelve arriba es la ventana.
   */
  it('se entra a la pantalla nueva desde arriba, aunque la anterior estuviera scrolleada', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<App />);

    fireEvent.click(screen.getAllByRole('link', { name: 'Ranking' })[0] as HTMLElement);

    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it('no hay un contenedor de scroll: scrollea el documento', () => {
    render(<App />);

    expect(document.querySelector('[data-scroll-principal]')).toBeNull();
    expect(principal().className).not.toMatch(/overflow-y-auto/);
  });

  it('el pie va después del contenido, no adentro ni fijo', () => {
    render(<App />);
    const pie = screen.getByRole('contentinfo');

    expect(principal().contains(pie)).toBe(false);
    expect(
      principal().compareDocumentPosition(pie) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('el foco pasa al título de la pantalla nueva', async () => {
    render(<App />);

    fireEvent.click(screen.getAllByRole('link', { name: 'Torneos' })[0] as HTMLElement);

    const h1 = await screen.findByRole('heading', { level: 1, name: 'Torneos' });
    await waitFor(() => expect(document.activeElement).toBe(h1));
  });

  /** `L-3`: el encabezado no decía en qué página estabas. */
  it('la página activa se marca en la navegación del encabezado', () => {
    render(<App />);
    const nav = within(screen.getByRole('banner')).getByRole('navigation');

    expect(within(nav).getByRole('link', { name: 'Inicio' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    fireEvent.click(within(nav).getByRole('link', { name: 'Torneos' }));

    expect(within(nav).getByRole('link', { name: 'Torneos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('la navegación lleva a las cuatro secciones', () => {
    render(<App />);
    const nav = within(screen.getByRole('banner')).getByRole('navigation');

    for (const [nombre, href] of [
      ['Inicio', '/'],
      ['Ranking', '/ranking'],
      ['Torneos', '/torneos'],
      ['Sumate', '/alta'],
    ] as const) {
      expect(within(nav).getByRole('link', { name: nombre })).toHaveAttribute('href', href);
    }
  });

  /**
   * `L-4` y decisión 2: «Ingresar» deja el centro de la portada y vive en el encabezado, en todas
   * las páginas. Le habla al que menos lo necesita —el líder ya tiene la PWA instalada—, así que no
   * va en grande en el medio, pero tiene que estar siempre a mano.
   */
  it('«Ingresar» está en el encabezado de todas las páginas', () => {
    render(<App />);
    const ingresar = () =>
      within(screen.getByRole('banner')).getByRole('link', { name: 'Ingresar' });

    expect(ingresar().getAttribute('href')).toMatch(/\/app\/$/);

    fireEvent.click(screen.getAllByRole('link', { name: 'Ranking' })[0] as HTMLElement);
    expect(ingresar()).toBeInTheDocument();
  });

  it('el cuerpo de la portada ya no tiene un «Ingresar» propio', () => {
    render(<App />);
    expect(within(principal()).queryByRole('link', { name: 'Ingresar' })).toBeNull();
  });

  /**
   * `REF7-12`: con el encabezado nuevo hay siete paradas de Tab antes del contenido (marca, cuatro
   * secciones, tema, «Ingresar»). El primer enlace salta al `<main>`.
   */
  it('el primer enlace salta al contenido', () => {
    render(<App />);
    const primero = screen.getAllByRole('link')[0];

    expect(primero).toHaveTextContent('Saltar al contenido');
    expect(primero).toHaveAttribute('href', '#contenido');
    expect(principal()).toHaveAttribute('id', 'contenido');
  });

  it('abrir el sitio no le roba el foco a nadie', () => {
    render(<App />);

    expect(document.activeElement).toBe(document.body);
  });
});
