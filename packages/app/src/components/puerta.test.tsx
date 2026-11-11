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
    expect(screen.getByRole('button', { name: 'Instalar' })).toBeDefined();
  });

  it('el accionable dispara el prompt nativo', () => {
    render(<InstalarApp />);
    const prompt = ofrecerInstalacion();

    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
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

    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
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
    expect(screen.getByRole('button', { name: 'Instalar' })).toBeDefined();
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
 * La puerta nueva (`REF7-7` / `P-1`, `DISENO.md` §5.3).
 *
 * Antes eran un título y dos botones —«Soy líder de patrulla» y «Soy administrador», el segundo
 * gris como deshabilitado— y quien entraba por primera vez no sabía qué hacía cada app ni que la de
 * líder funciona sin señal.
 */
describe('la puerta nueva', () => {
  const enLaPuerta = async () => {
    window.history.replaceState({}, '', '/app/');
    const { App } = await import('../App.js');
    render(<App />);
    return screen.findByRole('heading', { level: 1, name: '¿Cómo entrás hoy?' });
  };

  it('pregunta cómo entrás, con un h1', async () => {
    expect(await enLaPuerta()).toBeInTheDocument();
  });

  it('cada rol dice qué hace su app, y el título va primero en el nombre', async () => {
    await enLaPuerta();

    const lider = screen.getByRole('link', { name: /^Soy líder de patrulla/ });
    const admin = screen.getByRole('link', { name: /^Soy administrador/ });

    expect(lider).toHaveAttribute('href', '/app/wafl');
    expect(lider).toHaveTextContent('Anotá los puntajes del recorrido.');
    expect(admin).toHaveAttribute('href', '/app/wafa');
    expect(admin).toHaveTextContent('Torneos, patrullas, padrón y publicación.');
  });

  it('la de líder es la principal y avisa que funciona sin señal', async () => {
    await enLaPuerta();
    const lider = screen.getByRole('link', { name: /^Soy líder de patrulla/ });
    const admin = screen.getByRole('link', { name: /^Soy administrador/ });

    expect(lider).toHaveTextContent(/funciona sin señal/i);
    expect(admin).not.toHaveTextContent(/funciona sin señal/i);
    expect(lider.className).toContain('border-[var(--nock-text)]');
  });

  it('cada tarjeta de rol mide al menos 96px de alto', async () => {
    await enLaPuerta();
    for (const nombre of [/^Soy líder de patrulla/, /^Soy administrador/]) {
      expect(screen.getByRole('link', { name: nombre }).className).toContain('min-h-[96px]');
    }
  });

  it('el panel de la marca dice qué es la app', async () => {
    await enLaPuerta();

    expect(screen.getByRole('complementary')).toHaveTextContent('Anotá, sincronizá y publicá.');
    expect(screen.getByRole('complementary')).toHaveTextContent(
      'La app del día del torneo. Guarda todo en el celular y envía cuando hay señal.',
    );
  });

  it('volver a la liga es un enlace verde con su flecha', async () => {
    await enLaPuerta();
    const salida = screen.getByRole('link', { name: 'Ver resultados y rankings' });

    expect(salida.className).toContain('text-[var(--nock-text)]');
    expect(salida.querySelector('svg')).toHaveAttribute('aria-hidden');
  });

  it('el pie de la caja nombra al club', async () => {
    await enLaPuerta();
    expect(screen.getByText('Círculo Bahiense de Arquería')).toBeInTheDocument();
  });

  it('instalar es una tarjeta que dice para qué sirve', async () => {
    await enLaPuerta();
    ofrecerInstalacion();
    const tarjeta = screen.getByTestId('instalar-app');

    expect(tarjeta).toHaveTextContent('Instalá la app');
    expect(tarjeta).toHaveTextContent('Abre directo acá y funciona sin señal.');
    expect(tarjeta.className).toContain('border-dashed');
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

    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    expect(screen.getByTestId('dialogo-instalar')).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('dialogo-instalar')).toBeNull();
  });
});

/**
 * La barra «estás en modo desarrollo» (`@bal/ui`, `IndicadorDeAmbiente`), arriba de todo en la
 * puerta, WAFA y WAFL. El ambiente lo escribe en el `<html>` quien sirve el documento.
 */
describe('barra de ambiente', () => {
  afterEach(() => document.documentElement.removeAttribute('data-ambiente'));

  const montarEn = async (ruta: string) => {
    window.history.replaceState({}, '', ruta);
    const { App } = await import('../App.js');
    return render(<App />);
  };

  it.each(['/app/', '/app/wafa', '/app/wafl'])(
    'en desarrollo avisa en %s, antes que cualquier otra cosa',
    async (ruta) => {
      document.documentElement.setAttribute('data-ambiente', 'development');
      const { container } = await montarEn(ruta);

      const barra = screen
        .getByText(/estás en modo desarrollo/i)
        .closest('[data-indicador-ambiente]');
      expect(barra).not.toBeNull();
      expect(container.firstElementChild).toBe(barra);
    },
  );

  // WAFL tiene que arrancar sin red: la barra no espera ninguna respuesta.
  it('en WAFL aparece sin red', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    document.documentElement.setAttribute('data-ambiente', 'development');
    await montarEn('/app/wafl');

    expect(screen.getByText(/estás en modo desarrollo/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('en producción no hay barra', async () => {
    document.documentElement.setAttribute('data-ambiente', 'production');
    await montarEn('/app/');

    await screen.findByRole('heading', { level: 1, name: '¿Cómo entrás hoy?' });
    expect(screen.queryByText(/modo desarrollo/i)).toBeNull();
  });
});
