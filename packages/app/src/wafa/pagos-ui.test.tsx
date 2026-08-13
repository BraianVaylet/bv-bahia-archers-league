import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentsPanel } from './pages/Payments.js';

/**
 * Panel de pagos de inscripción (REF-5).
 *
 * El backend es de `REF-2`. Lo que se prueba acá es que la pantalla **no
 * recalcule** la recaudación por su cuenta y que **no mande ningún monto**.
 */

type Manejador = (body: unknown) => { status?: number; json: unknown };

let rutas: Record<string, Manejador>;
let llamadas: { method: string; url: string; body: unknown }[];

const participante = (o: Record<string, unknown> = {}) => ({
  id: 'p1',
  firstName: 'Juan',
  lastName: 'Pérez',
  category: 'razo',
  patrolNumber: 1,
  paid: false,
  ...o,
});

const resumen = (o: Record<string, unknown> = {}) => ({
  payment: { required: true, amount: 15_000 },
  paidCount: 0,
  collected: 0,
  participants: [participante()],
  ...o,
});

function servidor(json: unknown) {
  rutas['GET /api/admin/tournaments/t1/payments'] = () => ({ json });
}

beforeEach(() => {
  llamadas = [];
  rutas = { 'GET /api/auth/csrf': () => ({ json: { csrfToken: 't' } }) };

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      llamadas.push({ method, url, body });

      const manejador = rutas[`${method} ${url}`];
      if (!manejador) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'no' } }), {
            status: 404,
          }),
        );
      }

      const { status = 200, json } = manejador(body);
      return Promise.resolve(new Response(JSON.stringify(json), { status }));
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderPagos = () => render(<PaymentsPanel tournamentId="t1" />);

describe('PaymentsPanel', () => {
  it('lista a los arqueros con su estado escrito, no sólo con un color', async () => {
    servidor(
      resumen({
        participants: [participante(), participante({ id: 'p2', lastName: 'Gómez', paid: true })],
      }),
    );
    renderPagos();

    expect(await screen.findByTestId('pago-Pérez')).toHaveTextContent('Debe');
    expect(screen.getByTestId('pago-Gómez')).toHaveTextContent('Pagó');
  });

  /**
   * La recaudación la calcula el servidor. Si la pantalla la sumara por su
   * cuenta, dos números que tienen que ser el mismo podrían separarse — y el
   * que el tesorero mira sería el otro.
   */
  it('muestra la recaudación que manda el servidor, sin recalcularla', async () => {
    // Un total deliberadamente incoherente con `paidCount × amount`: si la
    // pantalla lo recalculara, mostraría 30.000 y no 99.999.
    servidor(resumen({ paidCount: 2, collected: 99_999 }));
    renderPagos();

    expect(await screen.findByTestId('recaudacion')).toHaveTextContent('$ 99.999');
  });

  it('formatea los montos con el separador de miles', async () => {
    servidor(resumen({ paidCount: 1, collected: 1_500_000 }));
    renderPagos();

    const caja = await screen.findByTestId('recaudacion');
    expect(caja).toHaveTextContent('$ 1.500.000');
    expect(caja).toHaveTextContent('$ 15.000 por arquero');
  });

  it('marca un pago y recarga', async () => {
    servidor(resumen());
    rutas['POST /api/admin/participants/p1/payment'] = () => ({ json: { paid: true } });
    renderPagos();

    fireEvent.click(await screen.findByRole('button', { name: 'Marcar pagado' }));

    await waitFor(() => {
      expect(llamadas.some((l) => l.url.endsWith('/participants/p1/payment'))).toBe(true);
    });
  });

  // El monto es del torneo. Mandarlo desde acá sería dejar que la pantalla
  // decida cuánto pagó cada uno.
  it('NO manda ningún monto al marcar', async () => {
    servidor(resumen());
    rutas['POST /api/admin/participants/p1/payment'] = () => ({ json: { paid: true } });
    renderPagos();

    fireEvent.click(await screen.findByRole('button', { name: 'Marcar pagado' }));

    await waitFor(() => {
      const post = llamadas.find((l) => l.method === 'POST');
      expect(post?.body).toEqual({ paid: true });
    });
  });

  it('se puede desmarcar: cobrar de más también se corrige', async () => {
    servidor(resumen({ participants: [participante({ paid: true })] }));
    rutas['POST /api/admin/participants/p1/payment'] = () => ({ json: { paid: false } });
    renderPagos();

    fireEvent.click(await screen.findByRole('button', { name: 'Desmarcar' }));

    await waitFor(() => {
      expect(llamadas.find((l) => l.method === 'POST')?.body).toEqual({ paid: false });
    });
  });

  it('un torneo gratuito lo dice y no muestra recaudación', async () => {
    servidor(resumen({ payment: { required: false, amount: 0 } }));
    renderPagos();

    expect(await screen.findByTestId('sin-inscripcion')).toBeDefined();
    expect(screen.queryByTestId('recaudacion')).toBeNull();
  });
});
