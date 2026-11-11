import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CampoDePassword } from '../components/ui.js';
import { ChangePasswordPage } from './pages/ChangePassword.js';
import { LoginPage } from './pages/Login.js';
import { RecuperarPassword } from './pages/RecuperarPassword.js';

/**
 * El ojito para ver el password, en los campos de clave de WAFA.
 *
 * El admin escribe la clave en el celular, al sol y a veces con guantes: un
 * typo que no se ve es un «Usuario o password incorrectos» que no se entiende.
 *
 * Se prueba el componente y, además, que **las tres pantallas lo monten**: un
 * componente que existe pero ninguna pantalla usa no le sirve a nadie (`REF4-3`).
 */

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CampoDePassword', () => {
  it('arranca oculto y el botón lo muestra y lo vuelve a ocultar', () => {
    render(<CampoDePassword label="Password" value="secreto" onChange={vi.fn()} />);
    const campo = screen.getByLabelText('Password');
    const ojo = screen.getByRole('button', { name: 'Mostrar password' });

    expect(campo).toHaveAttribute('type', 'password');
    expect(ojo).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(ojo);
    expect(campo).toHaveAttribute('type', 'text');
    expect(ojo).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(ojo);
    expect(campo).toHaveAttribute('type', 'password');
    expect(ojo).toHaveAttribute('aria-pressed', 'false');
  });

  // Dentro de un `<form>`, un `<button>` sin `type` es submit: tocar el ojo mandaría el login.
  it('el botón no envía el formulario', () => {
    const enviar = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={enviar}>
        <CampoDePassword label="Password" value="" onChange={vi.fn()} />
      </form>,
    );
    const ojo = screen.getByRole('button', { name: 'Mostrar password' });

    expect(ojo).toHaveAttribute('type', 'button');
    fireEvent.click(ojo);
    expect(enviar).not.toHaveBeenCalled();
  });

  /** §5: todo lo tocable, 44 px. */
  it('llega al objetivo táctil mínimo', () => {
    render(<CampoDePassword label="Password" value="" onChange={vi.fn()} />);
    const ojo = screen.getByRole('button', { name: 'Mostrar password' });
    expect(ojo.className).toContain('min-h-[44px]');
    expect(ojo.className).toContain('min-w-[44px]');
  });
});

describe('las pantallas de WAFA con password', () => {
  it('el login', () => {
    render(<LoginPage onEntro={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  });

  // Dos campos en la misma pantalla: cada ojo dice de cuál es, y muestra sólo ese.
  it('cambiar el password, un ojo por campo', () => {
    render(<ChangePasswordPage obligatorio onCambiado={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar password nuevo' }));

    expect(screen.getByLabelText('Password nuevo')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Password actual')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Mostrar password actual' })).toBeInTheDocument();
  });

  it('recuperar el acceso', () => {
    render(<RecuperarPassword onVolver={vi.fn()} onRecuperado={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar código de recuperación' }));

    expect(screen.getByLabelText('Código de recuperación')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Mostrar password nuevo' })).toBeInTheDocument();
  });
});
