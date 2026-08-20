import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  actualizaciones,
  configurarRegistroSW,
  reiniciarRegistroSW,
} from '../test/pwaRegisterFalso.js';
import { AvisoDeVersion } from './AvisoDeVersion.js';
import { RegistroDeVersion } from './registroDeVersion.js';

/**
 * Aviso de versión nueva (`REF4-3`).
 *
 * **La mitad que le faltaba a la regla 7.** `registerType: 'prompt'` estaba
 * puesto, el service worker quedaba en `waiting` esperando un `SKIP_WAITING`
 * que nadie mandaba, y el usuario no tenía forma de actualizar.
 *
 * Se prueban las dos mitades por separado: **qué se muestra** (`AvisoDeVersion`,
 * sin service worker de por medio) y **que esté conectado** (`RegistroDeVersion`,
 * contra el doble del módulo virtual). La segunda es la que importa: un aviso
 * perfecto que nadie enchufa es exactamente el defecto original.
 */

beforeEach(() => {
  reiniciarRegistroSW();
});

afterEach(() => {
  cleanup();
});

describe('AvisoDeVersion', () => {
  const props = { onActualizar: () => {}, onDespues: () => {} };

  it('no se ve si no hay versión nueva', () => {
    render(<AvisoDeVersion visible={false} {...props} />);
    expect(screen.queryByTestId('aviso-version')).toBeNull();
  });

  it('con versión nueva ofrece actualizar y posponer', () => {
    render(<AvisoDeVersion visible {...props} />);

    expect(screen.getByTestId('aviso-version')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Ahora no' })).toBeDefined();
  });

  /**
   * **No puede robar el foco ni tapar la pantalla.** Recargar a mitad de un
   * recorrido es lo que la regla 7 prohíbe; un `role="dialog"` modal haría
   * justamente eso.
   */
  it('es un aviso, no un modal', () => {
    render(<AvisoDeVersion visible {...props} />);

    const aviso = screen.getByTestId('aviso-version');
    expect(aviso.getAttribute('role')).toBe('status');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  /**
   * El pad de firma es un `fixed inset-0` en `z-20`. Con un z mayor, la barra
   * se le pondría encima justo cuando el arquero está firmando.
   */
  it('queda por debajo del pad de firma', () => {
    render(<AvisoDeVersion visible {...props} />);
    expect(screen.getByTestId('aviso-version').className).toContain('z-10');
  });
});

describe('RegistroDeVersion', () => {
  it('sin versión nueva no muestra nada', () => {
    configurarRegistroSW({ hayVersionNueva: false });
    render(<RegistroDeVersion />);

    expect(screen.queryByTestId('aviso-version')).toBeNull();
  });

  /** **Esto es lo que estaba roto**: el service worker avisaba y nadie escuchaba. */
  it('cuando el service worker avisa, aparece el aviso', () => {
    configurarRegistroSW({ hayVersionNueva: true });
    render(<RegistroDeVersion />);

    expect(screen.getByTestId('aviso-version')).toBeDefined();
  });

  it('«Actualizar» le pide al service worker que tome el control y recargue', () => {
    configurarRegistroSW({ hayVersionNueva: true });
    render(<RegistroDeVersion />);

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

    // `true` es lo que recarga la página al activarse el service worker nuevo.
    expect(actualizaciones).toEqual([true]);
  });

  /**
   * **No actualizar es una respuesta válida**, y tiene que ser de verdad: nada
   * de actualizar «igual pero más tarde».
   */
  it('«Ahora no» esconde el aviso y NO actualiza', () => {
    configurarRegistroSW({ hayVersionNueva: true });
    render(<RegistroDeVersion />);

    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));

    expect(screen.queryByTestId('aviso-version')).toBeNull();
    expect(actualizaciones).toEqual([]);
  });
});

/**
 * **Que el aviso exista no prueba que la app lo muestre.**
 *
 * Es literalmente el defecto que esta tanda corrige, un escalón más arriba:
 * `registerType: 'prompt'` estaba bien puesto y nadie lo consumía. Un
 * `AvisoDeVersion` impecable que `App` no monta sería el mismo error con otra
 * ropa.
 */
describe('App', () => {
  it('monta el aviso de versión', async () => {
    configurarRegistroSW({ hayVersionNueva: true });

    // Import diferido: `App` arrastra el árbol entero y sólo hace falta acá.
    const { App } = await import('../App.js');
    render(<App />);

    expect(await screen.findByTestId('aviso-version')).toBeDefined();
  });
});
