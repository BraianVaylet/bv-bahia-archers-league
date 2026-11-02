import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('se entra a la pantalla nueva desde arriba, aunque la anterior estuviera scrolleada', () => {
    render(<App />);
    principal().scrollTop = 640;

    fireEvent.click(screen.getAllByRole('link', { name: 'Ranking' })[0] as HTMLElement);

    expect(principal().scrollTop).toBe(0);
  });

  it('el foco pasa al título de la pantalla nueva', async () => {
    render(<App />);

    fireEvent.click(screen.getAllByRole('link', { name: 'Torneos' })[0] as HTMLElement);

    const h1 = await screen.findByRole('heading', { level: 1, name: 'Torneos' });
    await waitFor(() => expect(document.activeElement).toBe(h1));
  });

  it('abrir el sitio no le roba el foco a nadie', () => {
    render(<App />);

    expect(document.activeElement).toBe(document.body);
  });
});
