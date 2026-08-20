import { describe, expect, it } from 'vitest';
import { estadoDeInstalacion, pareceInstalada, pareceIOS } from './instalacion.js';

/**
 * Qué se le ofrece a cada navegador (`REF4-4`).
 *
 * **Ofrecer un botón donde no hay prompt es peor que no ofrecer nada**: el
 * usuario lo toca, no pasa nada, y concluye que la app está rota. Por eso la
 * decisión es pura y se prueba sola.
 */

describe('estadoDeInstalacion', () => {
  const senales = (o: Partial<Parameters<typeof estadoDeInstalacion>[0]> = {}) =>
    estadoDeInstalacion({ instalada: false, tieneEvento: false, esIOS: false, ...o });

  it('con prompt nativo, se ofrece instalar', () => {
    expect(senales({ tieneEvento: true })).toBe('puede-instalar');
  });

  it('en iOS, que no tiene prompt, se explican los pasos', () => {
    expect(senales({ esIOS: true })).toBe('instrucciones');
  });

  /**
   * Firefox de escritorio: no dispara el evento y tampoco tiene «Agregar a
   * inicio». Explicarle los pasos de un iPhone sería desconcertante.
   */
  it('sin prompt y sin ser iOS, no se ofrece nada', () => {
    expect(senales()).toBe('nada');
  });

  /**
   * **Ya instalada gana sobre todo lo demás.** Recomendarle instalar a alguien
   * que ya la tiene es la clase de detalle que hace desconfiar del resto.
   */
  it('instalada, no se ofrece nada aunque haya prompt', () => {
    expect(senales({ instalada: true, tieneEvento: true })).toBe('instalada');
  });

  it('instalada, no se ofrece nada aunque sea iOS', () => {
    expect(senales({ instalada: true, esIOS: true })).toBe('instalada');
  });
});

describe('pareceInstalada', () => {
  const ventana = (o: {
    displayMode?: boolean;
    standalone?: boolean;
    sinMatchMedia?: boolean;
  }): Window =>
    ({
      ...(o.sinMatchMedia ? {} : { matchMedia: () => ({ matches: o.displayMode ?? false }) }),
      navigator: { standalone: o.standalone },
    }) as unknown as Window;

  it('lo detecta por `display-mode: standalone`', () => {
    expect(pareceInstalada(ventana({ displayMode: true }))).toBe(true);
  });

  /** Es lo único que tiene iOS: no reporta `display-mode`. */
  it('lo detecta por `navigator.standalone`, que es lo único de iOS', () => {
    expect(pareceInstalada(ventana({ standalone: true }))).toBe(true);
  });

  it('en una pestaña común, no', () => {
    expect(pareceInstalada(ventana({}))).toBe(false);
  });

  /**
   * **La lección de `REF-4`**, donde una API ausente dejó una pantalla entera
   * en blanco. Acá lo peor que puede pasar es ofrecer instalar algo ya
   * instalado; romper la puerta de entrada de la app, no.
   */
  it('sin `matchMedia` no rompe', () => {
    expect(() => pareceInstalada(ventana({ sinMatchMedia: true }))).not.toThrow();
    expect(pareceInstalada(ventana({ sinMatchMedia: true }))).toBe(false);
  });

  it('sin `matchMedia` todavía reconoce el standalone de iOS', () => {
    expect(pareceInstalada(ventana({ sinMatchMedia: true, standalone: true }))).toBe(true);
  });
});

describe('pareceIOS', () => {
  const nav = (userAgent: string, maxTouchPoints = 0) =>
    ({ userAgent, maxTouchPoints }) as Navigator;

  it('reconoce el iPhone', () => {
    expect(pareceIOS(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'))).toBe(true);
  });

  /** El iPad moderno se declara «Macintosh»: se lo separa por la pantalla táctil. */
  it('reconoce el iPad que se hace pasar por Mac', () => {
    expect(pareceIOS(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5))).toBe(true);
  });

  it('un Mac de escritorio no es iOS', () => {
    expect(pareceIOS(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0))).toBe(false);
  });

  it('Android no es iOS', () => {
    expect(pareceIOS(nav('Mozilla/5.0 (Linux; Android 14; Pixel 7)'))).toBe(false);
  });
});
