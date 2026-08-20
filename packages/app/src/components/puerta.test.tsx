import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstalarApp } from './InstalarApp.js';

/**
 * La puerta de entrada (`REF4-4`).
 *
 * **Ofrecer un botón donde no hay prompt es peor que no ofrecer nada.** Acá se
 * prueba que cada navegador vea lo que le corresponde y, sobre todo, que el que
 * ya la tiene instalada no vea nada.
 */

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7)';

/** Deja el navegador como si fuera uno u otro, sin instalar y sin prompt. */
function navegador({ ua = ANDROID, instalada = false }: { ua?: string; instalada?: boolean } = {}) {
  vi.stubGlobal('matchMedia', () => ({ matches: instalada }));
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 5, configurable: true });
}

/** Dispara `beforeinstallprompt` con un `prompt` espiable. */
function ofrecerInstalacion() {
  const prompt = vi.fn(() => Promise.resolve());
  const evento = Object.assign(new Event('beforeinstallprompt'), { prompt });
  fireEvent(window, evento);
  return prompt;
}

beforeEach(() => {
  navegador();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('InstalarApp', () => {
  /**
   * Android sin el evento todavía: no hay nada que ofrecer **hasta** que el
   * navegador avise. Ofrecerlo antes daría un botón que no hace nada.
   */
  it('sin prompt y sin ser iOS, no ofrece nada', () => {
    render(<InstalarApp />);
    expect(screen.queryByTestId('instalar-app')).toBeNull();
  });

  it('cuando el navegador avisa que se puede instalar, lo ofrece', () => {
    render(<InstalarApp />);
    ofrecerInstalacion();

    expect(screen.getByTestId('instalar-app')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Instalar la app' })).toBeDefined();
  });

  it('el accionable dispara el prompt nativo', () => {
    render(<InstalarApp />);
    const prompt = ofrecerInstalacion();

    fireEvent.click(screen.getByRole('button', { name: 'Instalar la app' }));
    fireEvent.click(screen.getByRole('button', { name: 'Instalar ahora' }));

    expect(prompt).toHaveBeenCalledTimes(1);
  });

  /**
   * **iOS no tiene API.** No existe `beforeinstallprompt` y no hay forma de
   * disparar la instalación desde la página: lo único honesto es decir dónde
   * tocar. Un botón «Instalar ahora» acá sería un botón muerto.
   */
  it('en iOS explica los pasos en vez de ofrecer un botón muerto', () => {
    navegador({ ua: IPHONE });
    render(<InstalarApp />);

    fireEvent.click(screen.getByRole('button', { name: 'Instalar la app' }));

    expect(screen.getByTestId('dialogo-instalar').textContent).toMatch(/Compartir/);
    expect(screen.queryByRole('button', { name: 'Instalar ahora' })).toBeNull();
  });

  /**
   * **Recomendarle instalar a alguien que ya la tiene instalada** es la clase
   * de detalle que hace desconfiar del resto de la app.
   */
  it('ya instalada, no ofrece nada aunque el navegador avise', () => {
    navegador({ instalada: true });
    render(<InstalarApp />);
    ofrecerInstalacion();

    expect(screen.queryByTestId('instalar-app')).toBeNull();
  });

  it('ya instalada en iOS, tampoco', () => {
    navegador({ ua: IPHONE, instalada: true });
    render(<InstalarApp />);

    expect(screen.queryByTestId('instalar-app')).toBeNull();
  });

  /** El diálogo se puede cerrar sin instalar: no es una trampa. */
  it('el diálogo se cierra sin hacer nada', () => {
    navegador({ ua: IPHONE });
    render(<InstalarApp />);

    fireEvent.click(screen.getByRole('button', { name: 'Instalar la app' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByTestId('dialogo-instalar')).toBeNull();
  });

  /**
   * **La lección de `REF-4`**: una API ausente dejó una pantalla entera en
   * blanco. Acá lo peor sería no poder entrar a la app.
   */
  it('sin `matchMedia` no rompe la puerta de entrada', () => {
    vi.stubGlobal('matchMedia', undefined);
    Object.defineProperty(window.navigator, 'userAgent', { value: IPHONE, configurable: true });

    expect(() => render(<InstalarApp />)).not.toThrow();
    expect(screen.getByRole('button', { name: 'Instalar la app' })).toBeDefined();
  });
});

/**
 * **Que los componentes existan no prueba que la pantalla los muestre.**
 *
 * Es la misma lección que en `REF4-3`, donde el aviso de versión quedó dentro
 * de `BrowserRouter` y no se renderizaba nunca.
 */
describe('pantalla de elección de rol', () => {
  const enLaPuerta = async () => {
    window.history.replaceState({}, '', '/app/');
    const { App } = await import('../App.js');
    render(<App />);
  };

  it('ofrece salir a la landing, fuera de /app', async () => {
    await enLaPuerta();

    const salida = await screen.findByRole('link', { name: /resultados/i });
    const destino = new URL(salida.getAttribute('href') ?? '', window.location.href);
    expect(destino.pathname).toBe('/');
  });

  it('monta la recomendación de instalar', async () => {
    await enLaPuerta();
    await screen.findByRole('link', { name: /resultados/i });

    ofrecerInstalacion();
    expect(screen.getByTestId('instalar-app')).toBeDefined();
  });
});

/**
 * El atajo de teclado, que reemplazó al «tocar afuera para cerrar».
 *
 * Esa primera versión ponía el manejador sobre el fondo —un `div` sin rol
 * interactivo— y el lint la marcó con razón: un fondo que se comporta como
 * botón no se anuncia a un lector de pantalla y el teclado nunca llega.
 */
describe('cerrar el diálogo', () => {
  it('Escape lo cierra', () => {
    navegador({ ua: IPHONE });
    render(<InstalarApp />);

    fireEvent.click(screen.getByRole('button', { name: 'Instalar la app' }));
    expect(screen.getByTestId('dialogo-instalar')).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('dialogo-instalar')).toBeNull();
  });
});
