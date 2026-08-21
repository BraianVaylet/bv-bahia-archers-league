import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { IndicadorDeConexion } from './IndicadorDeConexion.js';
import { Encabezado } from './ui.js';

/**
 * El indicador de conexión del header.
 *
 * **WAFA lo necesita y no lo tenía.** Es la app que depende de la red: puede
 * leer de la caché sin señal, pero no crear ni editar nada. Sin indicador, el
 * admin se entera de que está sin conexión recién cuando falla el guardado.
 */

/** Deja `navigator.onLine` en el valor pedido y dispara el evento del caso. */
function conexion(enLinea: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: enLinea, configurable: true });
  act(() => {
    window.dispatchEvent(new Event(enLinea ? 'online' : 'offline'));
  });
}

afterEach(() => {
  cleanup();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

describe('IndicadorDeConexion', () => {
  it('con conexión se ve verde', () => {
    conexion(true);
    render(<IndicadorDeConexion />);

    const punto = screen.getByTestId('indicador-conexion');
    expect(punto.getAttribute('data-conexion')).toBe('en-linea');
    expect(punto.innerHTML).toContain('--ok');
  });

  it('sin conexión se ve rojo', () => {
    render(<IndicadorDeConexion />);
    conexion(false);

    const punto = screen.getByTestId('indicador-conexion');
    expect(punto.getAttribute('data-conexion')).toBe('sin-linea');
    expect(punto.innerHTML).toContain('--danger');
  });

  it('vuelve a verde cuando la señal regresa', () => {
    render(<IndicadorDeConexion />);

    conexion(false);
    expect(screen.getByTestId('indicador-conexion').getAttribute('data-conexion')).toBe(
      'sin-linea',
    );

    conexion(true);
    expect(screen.getByTestId('indicador-conexion').getAttribute('data-conexion')).toBe('en-linea');
  });

  /**
   * **El color nunca va solo** — `DESIGN_SYSTEM.md` §10.
   *
   * Verde y rojo son el par más común de confundir: para quien no los
   * distingue, los dos estados son el mismo punto gris.
   */
  it('el estado se lee sin depender del color', () => {
    render(<IndicadorDeConexion />);
    expect(screen.getByLabelText('Con conexión')).toBeDefined();

    conexion(false);
    expect(screen.getByLabelText('Sin conexión')).toBeDefined();
  });

  /** Se anuncia solo al caerse la señal, sin que haya que ir a buscarlo. */
  it('es una región que se anuncia', () => {
    render(<IndicadorDeConexion />);
    expect(screen.getByTestId('indicador-conexion').getAttribute('role')).toBe('status');
  });

  /**
   * **La lección de `REF-4`**: una API ausente dejó una pantalla en blanco.
   * Acá, ante la duda, se dice que hay conexión — es mejor no avisar nada que
   * teñir de rojo una app que anda bien.
   */
  it('sin `navigator.onLine` no rompe ni marca error', () => {
    Object.defineProperty(navigator, 'onLine', { value: undefined, configurable: true });

    expect(() => render(<IndicadorDeConexion />)).not.toThrow();
    expect(screen.getByTestId('indicador-conexion').getAttribute('data-conexion')).toBe('en-linea');
  });

  /** No se imprime: una planilla de puntajes no lleva el estado de la red. */
  it('no se imprime', () => {
    render(<IndicadorDeConexion />);
    expect(screen.getByTestId('indicador-conexion').className).toContain('print:hidden');
  });
});

/**
 * **Que el componente exista no prueba que el header lo muestre.**
 *
 * Es la lección de `REF4-3`, donde el aviso de versión quedó dentro del router
 * y no se renderizaba nunca.
 */
describe('el header', () => {
  it('muestra el indicador cuando la pantalla no trae el suyo', () => {
    render(<Encabezado titulo="Torneos" />);
    expect(screen.getByTestId('indicador-conexion')).toBeDefined();
  });

  /**
   * WAFL pasa su `SyncBadge` por `children`: dice lo mismo y además cuántos
   * cambios quedan sin enviar. Dos indicadores de red en la misma barra son dos
   * cosas que pueden contradecirse.
   */
  it('NO lo duplica cuando la pantalla ya trae uno', () => {
    render(
      <Encabezado titulo="Blanco 3">
        <span data-testid="propio">sincronizado</span>
      </Encabezado>,
    );

    expect(screen.getByTestId('propio')).toBeDefined();
    expect(screen.queryByTestId('indicador-conexion')).toBeNull();
  });
});
