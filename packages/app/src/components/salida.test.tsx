import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CerrarSesion } from './CerrarSesion.js';
import { Encabezado } from './ui.js';
import { useSalidaBloqueada } from './useSalidaBloqueada.js';

/**
 * Salir de la app sólo a propósito.
 *
 * Un toque de más en Atrás sacaba al líder de WAFL —o al admin de WAFA— a la
 * pantalla de elección, y volver significaba loguearse de nuevo: con guantes,
 * al sol, y con el PIN en la planilla del bolsillo.
 */

afterEach(() => {
  cleanup();
  /**
   * **Los espías se restauran.** `vi.spyOn` sobre un método ya espiado devuelve
   * el mismo espía, con su historial de llamadas: sin esto, un test que afirma
   * «no se llamó» ve las llamadas del test anterior y falla por eso.
   */
  vi.restoreAllMocks();
  // Y el marcador del historial, que si no sobrevive entre tests.
  window.history.replaceState(null, '');
});

function Prueba({ activo }: { readonly activo: boolean }) {
  useSalidaBloqueada(activo);
  return <p>adentro</p>;
}

describe('useSalidaBloqueada', () => {
  it('empuja una entrada propia al activarse', () => {
    const push = vi.spyOn(window.history, 'pushState');

    render(<Prueba activo />);

    expect(push).toHaveBeenCalled();
  });

  // Sin sesión no se toca el historial: el login tiene que poder volver.
  it('inactiva no toca el historial', () => {
    const push = vi.spyOn(window.history, 'pushState');

    render(<Prueba activo={false} />);

    expect(push).not.toHaveBeenCalled();
  });

  /**
   * **Al volver atrás, se vuelve a empujar.** Es lo que deja al usuario donde
   * estaba: el navegador consume la entrada centinela y se repone.
   */
  it('repone la entrada cuando el usuario va atrás', () => {
    render(<Prueba activo />);

    const push = vi.spyOn(window.history, 'pushState');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(push).toHaveBeenCalled();
  });

  // Desmontada deja de escuchar: si no, el login quedaría atrapado también.
  it('al desmontarse deja de bloquear', () => {
    const { unmount } = render(<Prueba activo />);
    unmount();

    const push = vi.spyOn(window.history, 'pushState');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(push).not.toHaveBeenCalled();
  });
});

describe('CerrarSesion', () => {
  /**
   * **Dos toques.** Es la única salida de la app y en WAFL borra los datos
   * locales: un botón de un toque al lado del indicador de sincronización se
   * aprieta sin querer con guantes.
   */
  it('el primer toque no cierra: pregunta', () => {
    const onCerrar = vi.fn();
    render(<CerrarSesion onCerrar={onCerrar} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(onCerrar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sí, cerrar sesión' })).toBeDefined();
  });

  it('el segundo lo cierra', () => {
    const onCerrar = vi.fn();
    render(<CerrarSesion onCerrar={onCerrar} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cerrar sesión' }));

    expect(onCerrar).toHaveBeenCalledOnce();
  });

  it('se puede volver atrás sin cerrar', () => {
    const onCerrar = vi.fn();
    render(<CerrarSesion onCerrar={onCerrar} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    fireEvent.click(screen.getByRole('button', { name: 'Seguir en el torneo' }));

    expect(onCerrar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeDefined();
  });

  /**
   * **Con trabajo sin enviar se dice que se pierde, y cuánto.**
   *
   * `logout` borra el IndexedDB entero, outbox incluido. La app nunca descarta
   * trabajo en silencio; que el usuario lo haga a propósito es otra cosa, y ahí
   * lo que corresponde es que sepa exactamente qué está tirando.
   */
  it('avisa cuántos cambios se pierden', () => {
    render(<CerrarSesion onCerrar={vi.fn()} pendientes={4} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    const aviso = screen.getByTestId('aviso-cerrar-sesion');
    expect(aviso.textContent).toMatch(/4/);
    expect(aviso.textContent).toMatch(/se pierden/i);
  });

  it('sin pendientes no habla de perder nada', () => {
    render(<CerrarSesion onCerrar={vi.fn()} pendientes={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(screen.getByTestId('aviso-cerrar-sesion').textContent).not.toMatch(/se pierden/i);
  });

  it('un solo cambio se dice en singular', () => {
    render(<CerrarSesion onCerrar={vi.fn()} pendientes={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(screen.getByTestId('aviso-cerrar-sesion').textContent).toMatch(/1 cambio sin enviar/);
  });
});

// ── El ícono del header ──────────────────────────────────────────────────────

describe('cerrar sesión desde el header', () => {
  /**
   * **Hay dos controles con el mismo nombre, y está bien.**
   *
   * El del header y el del final del contenido hacen exactamente lo mismo:
   * abrir la confirmación. Llamarlos distinto para que el test los distinga
   * sería mentirle al lector de pantalla sobre una diferencia que no existe.
   * El primero en el DOM es el del header.
   */
  const iconoDelHeader = () => screen.getAllByRole('button', { name: 'Cerrar sesión' })[0];

  function ConHeader({ onCerrar }: { readonly onCerrar: () => void }) {
    const [abierto, setAbierto] = useState(false);
    return (
      <>
        <Encabezado titulo="Prueba" onCerrarSesion={() => setAbierto(true)} />
        <CerrarSesion onCerrar={onCerrar} abierto={abierto} onAbiertoChange={setAbierto} />
      </>
    );
  }

  /**
   * **El ícono abre la confirmación, no cierra la sesión.**
   *
   * Es la única salida de la app y en WAFL borra los datos locales. Un ícono en
   * el header —donde el pulgar pasa todo el tiempo, con guantes— no puede ser
   * el disparo final.
   */
  it('el ícono NO cierra: abre la confirmación', () => {
    const onCerrar = vi.fn();
    render(<ConHeader onCerrar={onCerrar} />);

    fireEvent.click(iconoDelHeader() as HTMLElement);

    expect(onCerrar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sí, cerrar sesión' })).toBeDefined();
  });

  /**
   * **Una sola confirmación, no dos.** Duplicarla para el header habría
   * duplicado el texto de cuántos cambios se pierden, y dos textos que dicen lo
   * mismo terminan diciendo cosas distintas.
   */
  it('abre la MISMA confirmación que el botón de abajo', () => {
    render(<ConHeader onCerrar={vi.fn()} />);

    fireEvent.click(iconoDelHeader() as HTMLElement);

    expect(screen.getAllByTestId('aviso-cerrar-sesion')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Sí, cerrar sesión' })).toHaveLength(1);
  });

  it('desde el header también se puede volver atrás', () => {
    const onCerrar = vi.fn();
    render(<ConHeader onCerrar={onCerrar} />);

    fireEvent.click(iconoDelHeader() as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Seguir en el torneo' }));

    expect(onCerrar).not.toHaveBeenCalled();
    expect(screen.queryByTestId('aviso-cerrar-sesion')).toBeNull();
  });

  // Sin la prop no hay ícono: el login no tiene sesión que cerrar.
  it('sin sesión el header no lo muestra', () => {
    render(<Encabezado titulo="Prueba" />);
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
  });
});
