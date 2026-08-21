// El login de WAFL consulta el bundle local al montar: sin esto queda un
// error sin manejar que tapa los de verdad.
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage as LoginWafa } from '../wafa/pages/Login.js';
import { LoginPage as LoginWafl } from '../wafl/LoginPage.js';
import { VolverALaLiga } from './VolverALaLiga.js';

/**
 * La salida al sitio público desde los dos logins.
 *
 * **Quien abre la PWA sin credenciales quedaba encerrado** en un formulario que
 * no puede completar: WAFA pide usuario y password, WAFL pide torneo, patrulla
 * y PIN de seis dígitos. Y desde `ref-3` el botón Atrás ya no saca de la app.
 *
 * Se prueba que **las pantallas lo monten**, no sólo que el componente exista.
 * Es la lección de `REF4-3`, donde el aviso de versión quedó dentro del router
 * y no se renderizaba nunca.
 */

/** El destino resuelto, que en desarrollo es absoluto y en producción relativo. */
const destino = (a: Element) =>
  new URL(a.getAttribute('href') ?? '', window.location.href).pathname;

beforeEach(() => {
  // Los logins piden datos al montar; sin esto el fetch real tira en jsdom.
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ tournaments: [] }), { status: 200 })),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('VolverALaLiga', () => {
  it('apunta a la raíz, que es la landing', () => {
    render(<VolverALaLiga />);
    expect(destino(screen.getByRole('link'))).toBe('/');
  });

  /** §5: todo lo tocable, 44 px. Un enlace de texto suelto no llega solo. */
  it('llega al objetivo táctil mínimo', () => {
    render(<VolverALaLiga />);
    expect(screen.getByRole('link').className).toContain('min-h-[44px]');
  });
});

describe('el login de WAFA', () => {
  it('ofrece volver a la landing', () => {
    render(<LoginWafa onEntro={vi.fn()} />);

    const salida = screen.getByRole('link', { name: /resultados/i });
    expect(destino(salida)).toBe('/');
  });
});

describe('el login de WAFL', () => {
  it('ofrece volver a la landing', () => {
    render(<LoginWafl onEntro={vi.fn()} />);

    const salida = screen.getByRole('link', { name: /resultados/i });
    expect(destino(salida)).toBe('/');
  });
});

/**
 * La recuperación del password, desde el login de WAFA (`ref-6`).
 *
 * **Que el endpoint exista no sirve si no hay por dónde llegar.** El admin que
 * se olvidó la clave no puede entrar a pedirla: el camino tiene que estar en la
 * única pantalla que ve.
 */
describe('recuperar el password desde el login', () => {
  it('el login ofrece la salida para el que se olvidó', () => {
    render(<LoginWafa onEntro={vi.fn()} />);
    expect(screen.getByRole('button', { name: /olvidé mi password/i })).toBeDefined();
  });

  it('lleva a un formulario que pide el código y el password nuevo', () => {
    render(<LoginWafa onEntro={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /olvidé mi password/i }));

    expect(screen.getByLabelText('Código de recuperación')).toBeDefined();
    expect(screen.getByLabelText('Password nuevo')).toBeDefined();
  });

  /** El código es un secreto: no puede quedar a la vista de quien mira al lado. */
  it('el código se escribe enmascarado', () => {
    render(<LoginWafa onEntro={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /olvidé mi password/i }));

    expect(screen.getByLabelText('Código de recuperación').getAttribute('type')).toBe('password');
  });

  it('se puede volver al ingreso sin recuperar nada', () => {
    render(<LoginWafa onEntro={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /olvidé mi password/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Volver al ingreso' }));

    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDefined();
  });
});
