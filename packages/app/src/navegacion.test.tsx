import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { NavegacionAccesible } from './components/NavegacionAccesible.js';
import { Encabezado, Pantalla, Screen } from './components/ui.js';

/**
 * Navegación accesible de la PWA (`REF6-12` / `U-5`).
 *
 * Cada pantalla de la app es un `Pantalla` con su `Encabezado` y un `Screen` que scrollea. Se monta
 * con las piezas de verdad —no con un contenedor de mentira— porque lo que se prueba es que
 * `Screen` marca su scroll y `Encabezado` su título: sin esas marcas el hook no encuentra nada.
 */

afterEach(cleanup);

function Con({ titulo, conH1 }: { readonly titulo: string; readonly conH1: boolean }) {
  return (
    <Pantalla>
      <Encabezado titulo={titulo} />
      <Screen>
        {conH1 && <h1>{titulo} (contenido)</h1>}
        <Link to="/b">ir a b</Link>
        <Link to="/a">ir a a</Link>
        <Link to="/sin-h1">ir a sin h1</Link>
      </Screen>
    </Pantalla>
  );
}

function montar() {
  render(
    <MemoryRouter initialEntries={['/a']}>
      <NavegacionAccesible />
      <Routes>
        <Route path="/a" element={<Con titulo="Pantalla A" conH1 />} />
        <Route path="/b" element={<Con titulo="Pantalla B" conH1 />} />
        <Route path="/sin-h1" element={<Con titulo="Sin h1" conH1={false} />} />
      </Routes>
    </MemoryRouter>,
  );
}

const scroll = () => {
  const el = document.querySelector<HTMLElement>('[data-scroll-principal]');
  if (!el) throw new Error('Screen no marca su contenedor de scroll');
  return el;
};

describe('navegar por la PWA', () => {
  it('Screen marca el contenedor que scrollea', () => {
    montar();

    expect(scroll()).toBeInTheDocument();
  });

  it('Encabezado marca su título', () => {
    montar();

    expect(document.querySelector('[data-titulo-de-pagina]')).toHaveTextContent('Pantalla A');
  });

  it('al navegar, la pantalla nueva se ve desde arriba', () => {
    montar();
    scroll().scrollTop = 500;

    fireEvent.click(screen.getByRole('link', { name: 'ir a b' }));

    expect(scroll().scrollTop).toBe(0);
  });

  it('y el foco va al h1 del contenido', async () => {
    montar();

    fireEvent.click(screen.getByRole('link', { name: 'ir a b' }));

    const h1 = await screen.findByRole('heading', { level: 1, name: 'Pantalla B (contenido)' });
    await waitFor(() => expect(document.activeElement).toBe(h1));
  });

  it('una pantalla sin h1 —las de WAFA lo son— recibe el foco en el título del encabezado', async () => {
    montar();

    fireEvent.click(screen.getByRole('link', { name: 'ir a sin h1' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(document.querySelector('[data-titulo-de-pagina]')),
    );
    expect(document.activeElement).toHaveTextContent('Sin h1');
  });
});
