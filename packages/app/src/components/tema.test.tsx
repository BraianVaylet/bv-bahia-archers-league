import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BotonTema } from './ui.js';

/**
 * Conmutador de tema (REF-4).
 *
 * La decisión de qué tema corresponde vive en `@bal/shared` y está probada
 * ahí. Acá se verifica lo otro: que el control lo **aplique** al documento y
 * lo **persista**, que es lo que el script anti-FOUC lee en la próxima carga.
 */

function conPreferencia(oscuro: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: oscuro, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  conPreferencia(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const boton = () => screen.getByRole('button', { name: /tema/i });

describe('BotonTema', () => {
  it('arranca en el tema que prefiere el sistema', () => {
    conPreferencia(true);
    render(<BotonTema />);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('arranca en el que el usuario eligió antes, por encima del sistema', () => {
    localStorage.setItem('bal_tema', 'light');
    conPreferencia(true);
    render(<BotonTema />);

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('conmuta al tocarlo', () => {
    render(<BotonTema />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    fireEvent.click(boton());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    fireEvent.click(boton());
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  // Sin esto el tema se pierde en cada recarga, que es exactamente lo que el
  // script anti-FOUC existe para evitar.
  it('lo persiste para la próxima carga', () => {
    render(<BotonTema />);
    fireEvent.click(boton());

    expect(localStorage.getItem('bal_tema')).toBe('dark');
  });

  /**
   * El color de la barra del navegador se pinta con el tema. Si no se
   * actualiza, en un celular queda el color del tema anterior alrededor de la
   * app — que es justo donde más se nota.
   */
  it('actualiza el theme-color del navegador', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#ffffff');
    document.head.appendChild(meta);

    render(<BotonTema />);
    fireEvent.click(boton());

    expect(meta.getAttribute('content')).toBe('#16170f');
    meta.remove();
  });

  // El ícono nunca va solo: con lector de pantalla, un símbolo sin nombre no
  // dice nada. Ver docs/DESIGN_SYSTEM.md §10.
  it('dice a qué tema va a cambiar, no sólo muestra un símbolo', () => {
    render(<BotonTema />);

    expect(boton().getAttribute('aria-label')).toMatch(/oscuro/i);
    fireEvent.click(boton());
    expect(boton().getAttribute('aria-label')).toMatch(/claro/i);
  });

  it('el objetivo táctil llega a 44px', () => {
    render(<BotonTema />);
    expect(boton().className).toMatch(/min-h-\[44px\]/);
  });

  /**
   * `matchMedia` no existe en todos lados. Sin guarda, la llamada tira y como
   * el conmutador vive en el header, **se cae la pantalla entera**: no es que
   * falte un botón, es que no se ve nada.
   */
  it('no rompe la pantalla si el navegador no tiene matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(() => render(<BotonTema />)).not.toThrow();
    expect(boton()).toBeDefined();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('tampoco si localStorage está bloqueado', () => {
    bloquearLocalStorage();

    expect(() => render(<BotonTema />)).not.toThrow();
    fireEvent.click(boton());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  /**
   * Los dos fallos **a la vez**, que es lo que el código original no sobrevivía.
   *
   * Antes, `temaInicial` llamaba a `matchMedia` dentro del `try` y **otra vez
   * en el `catch`**. Con `localStorage` bloqueado el `try` fallaba, y en el
   * camino de respaldo la misma llamada volvía a tirar: el error salía sin
   * atrapar y se caía la pantalla.
   *
   * Con uno solo de los dos fallos el bug no se ve, y por eso hace falta este
   * caso además de los dos de arriba.
   */
  it('no rompe con localStorage bloqueado Y sin matchMedia', () => {
    bloquearLocalStorage();
    vi.stubGlobal('matchMedia', undefined);

    expect(() => render(<BotonTema />)).not.toThrow();
    expect(boton()).toBeDefined();
  });
});

function bloquearLocalStorage() {
  for (const metodo of ['getItem', 'setItem'] as const) {
    vi.spyOn(Storage.prototype, metodo).mockImplementation(() => {
      throw new Error('acceso denegado');
    });
  }
}
