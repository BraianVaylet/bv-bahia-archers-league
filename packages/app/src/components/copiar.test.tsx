import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotonCopiar } from './BotonCopiar.js';

/**
 * Copiar el PIN de la patrulla.
 *
 * Seis dígitos se transcriben mal, y un PIN mal transcripto es un líder que no
 * entra con el torneo ya empezado.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function conPortapapeles(escribir: (t: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: escribir },
    configurable: true,
  });
}

describe('BotonCopiar', () => {
  it('copia el valor', async () => {
    const copiado: string[] = [];
    conPortapapeles(async (t) => {
      copiado.push(t);
    });

    render(<BotonCopiar valor="481902" queEs="el PIN de la patrulla 2" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar el PIN de la patrulla 2' }));

    await waitFor(() => expect(copiado).toEqual(['481902']));
  });

  /**
   * **El acuse es visible, no sólo un cambio de ícono.** Un ícono que cambia no
   * lo anuncia nadie, y «copiado» es justo lo que hay que confirmar.
   */
  it('confirma que copió', async () => {
    conPortapapeles(async () => {});

    render(<BotonCopiar valor="481902" queEs="el PIN" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar el PIN' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Copiado');
  });

  /**
   * **Y dice cuándo NO pudo.** `navigator.clipboard` no existe fuera de un
   * contexto seguro: un botón que no hace nada y tampoco avisa deja al admin
   * creyendo que copió, y el PIN se pasa mal.
   */
  it('avisa si no se pudo copiar, en vez de fingir', async () => {
    conPortapapeles(async () => {
      throw new Error('sin portapapeles');
    });

    render(<BotonCopiar valor="481902" queEs="el PIN" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar el PIN' }));

    const acuse = await screen.findByRole('status');
    expect(acuse.textContent).toMatch(/no se pudo copiar/i);
    expect(acuse.textContent).toMatch(/a mano/i);
  });

  it('sin la API del portapapeles tampoco rompe', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });

    render(<BotonCopiar valor="481902" queEs="el PIN" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar el PIN' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/no se pudo/i);
  });

  // El acuse vuelve solo: es una confirmación, no un estado de la pantalla.
  it('la confirmación se va sola', async () => {
    vi.useFakeTimers();
    conPortapapeles(async () => {});

    render(<BotonCopiar valor="481902" queEs="el PIN" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar el PIN' }));

    await vi.waitFor(() => expect(screen.queryByTestId('acuse-copiar')).not.toBeNull());

    // Dentro de `act`: el temporizador dispara el cambio de estado, pero sin
    // esto React no repinta y el acuse sigue en el DOM.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.queryByTestId('acuse-copiar')).toBeNull();
    vi.useRealTimers();
  });
});
