import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CorregirPage } from './pages/Corregir.js';

/**
 * Corregir puntajes contra la planilla de papel (`FE-34`, sobre `BE-25`).
 *
 * El admin elige un arquero, ve su tarjeta blanco por blanco —flechas, subtotal y acumulado, como
 * la planilla— y corrige el blanco que no coincide con el teclado de esa modalidad. El servidor
 * recalcula; la pantalla vuelve a pedir la tarjeta para mostrar lo que quedó.
 */

const TORNEO = {
  id: 't1',
  name: '3ª fecha',
  date: '2026-08-08',
  status: 'completado',
  targets: [
    { index: 1, modality: '3d', arrows: 2 },
    { index: 2, modality: 'sala', arrows: 3 },
  ],
  maxPossibleScore: 52,
  participantCount: 2,
};

const participante = (id: string, lastName: string) => ({
  id,
  archerId: `a-${id}`,
  firstName: 'Juan',
  lastName,
  category: 'raso',
  stake: 'azul',
  patrolNumber: 1,
  total: 19,
  normalizedPct: 36.54,
  innerCount: 1,
  tenCount: 0,
  mCount: 0,
  targetsCompleted: 1,
  status: 'activo',
  signed: true,
  signatureUnlocked: false,
});

const tarjeta = (corrected: number[] = []) => ({
  scorecard: {
    archer: { id: 'x1', firstName: 'Juan', lastName: 'Pérez', category: 'raso', stake: 'azul' },
    total: 19,
    maxTotal: 52,
    rows: [
      {
        index: 1,
        modality: '3d',
        arrows: [
          { token: '11', value: 11 },
          { token: '8', value: 8 },
        ],
        total: 19,
        maxTotal: 22,
      },
      { index: 2, modality: 'sala', arrows: null, total: 0, maxTotal: 30 },
    ],
    corrected,
  },
});

type Manejador = (body: unknown) => { status?: number; json: unknown };
let rutas: Record<string, Manejador>;
let llamadas: { method: string; url: string; body: unknown }[];

const servidor = (nuevas: Record<string, Manejador>) => {
  rutas = { ...rutas, ...nuevas };
};

beforeEach(() => {
  llamadas = [];
  rutas = {
    'GET /api/admin/tournaments/t1': () => ({ json: { tournament: TORNEO } }),
    'GET /api/admin/tournaments/t1/results': () => ({
      json: {
        maxPossibleScore: 52,
        participants: [participante('x1', 'Pérez'), participante('x2', 'Gómez')],
      },
    }),
    'GET /api/admin/tournaments/t1/participants/x1/scorecard': () => ({ json: tarjeta() }),
    'GET /api/auth/csrf': () => ({ json: { csrfToken: 't' } }),
  };

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
  vi.restoreAllMocks();
});

const renderCorregir = () =>
  render(
    <MemoryRouter initialEntries={['/wafa/torneos/t1/corregir']}>
      <Routes>
        <Route path="/wafa/torneos/:id/corregir" element={<CorregirPage onVolver={vi.fn()} />} />
      </Routes>
    </MemoryRouter>,
  );

/** Elige a Pérez y espera su tarjeta. */
async function elegirPerez() {
  fireEvent.click(await screen.findByRole('button', { name: /Pérez, Juan/ }));
  return screen.findByTestId('fila-1');
}

describe('corregir puntajes', () => {
  it('muestra la tarjeta del arquero: flechas, subtotal y acumulado de cada blanco', async () => {
    renderCorregir();

    const fila = await elegirPerez();

    expect(fila).toHaveTextContent('11');
    expect(fila).toHaveTextContent('8');
    expect(fila).toHaveTextContent('19');
    // Un blanco sin puntaje no es un cero.
    expect(screen.getByTestId('fila-2')).toHaveTextContent('Sin puntaje');
  });

  it('marca los blancos que ya se corrigieron', async () => {
    servidor({
      'GET /api/admin/tournaments/t1/participants/x1/scorecard': () => ({ json: tarjeta([1]) }),
    });
    renderCorregir();

    expect(await elegirPerez()).toHaveTextContent('Corregido');
  });

  it('corrige un blanco con el teclado de su modalidad, y manda flechas y motivo', async () => {
    servidor({
      'PUT /api/admin/tournaments/t1/participants/x1/scores/1': () => ({ json: { ok: true } }),
    });
    renderCorregir();
    const fila = await elegirPerez();

    fireEvent.click(within(fila).getByRole('button', { name: /Corregir/ }));

    // El 3D tiene 11; la sala, no. El teclado es el del blanco, no uno genérico.
    expect(screen.getByRole('button', { name: 'Puntaje 11' })).toBeDefined();
    const guardar = screen.getByRole('button', { name: 'Guardar corrección' });
    expect(guardar).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Puntaje 10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Puntaje 10' }));
    expect(guardar).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Por qué se corrige'), {
      target: { value: 'La planilla dice 10 y 10.' },
    });
    fireEvent.click(guardar);

    await waitFor(() => {
      const put = llamadas.find((l) => l.method === 'PUT');
      expect(put?.body).toEqual({ arrows: ['10', '10'], reason: 'La planilla dice 10 y 10.' });
    });
    // Vuelve a pedir la tarjeta: lo que quedó lo dice el servidor, no la pantalla.
    await waitFor(() =>
      expect(
        llamadas.filter((l) => l.url.endsWith('/participants/x1/scorecard')).length,
      ).toBeGreaterThan(1),
    );
    expect(await screen.findByText(/Blanco 1 corregido/)).toBeDefined();
  });

  it('un blanco vacío también se carga: está en el papel', async () => {
    renderCorregir();
    await elegirPerez();

    fireEvent.click(within(screen.getByTestId('fila-2')).getByRole('button', { name: /Corregir/ }));

    // Sala: con X, sin 11.
    expect(screen.getByRole('button', { name: 'Puntaje X' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Puntaje 11' })).toBeNull();
  });

  it('si el servidor rechaza, lo dice y no pierde lo tipeado', async () => {
    servidor({
      'PUT /api/admin/tournaments/t1/participants/x1/scores/1': () => ({
        status: 409,
        json: {
          error: {
            code: 'FIELD_NOT_EDITABLE',
            message: 'Los puntajes sólo se corrigen con el torneo esperando publicación.',
          },
        },
      }),
    });
    renderCorregir();
    const fila = await elegirPerez();
    fireEvent.click(within(fila).getByRole('button', { name: /Corregir/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Puntaje 10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Puntaje 10' }));
    fireEvent.change(screen.getByLabelText('Por qué se corrige'), {
      target: { value: 'La planilla dice 10 y 10.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));

    expect(await screen.findByText(/sólo se corrigen con el torneo esperando/)).toBeDefined();
    expect(screen.getByLabelText('Por qué se corrige')).toHaveValue('La planilla dice 10 y 10.');
  });

  /** Decisión 2: sólo esperando publicación. En otro estado la tarjeta se ve, pero no se toca. */
  it('con el torneo en otro estado, se ve la tarjeta pero no se corrige', async () => {
    servidor({
      'GET /api/admin/tournaments/t1': () => ({
        json: { tournament: { ...TORNEO, status: 'publicado' } },
      }),
    });
    renderCorregir();

    expect(await screen.findByText(/esperando publicación/)).toBeDefined();
    const fila = await elegirPerez();
    expect(within(fila).queryByRole('button', { name: /Corregir/ })).toBeNull();
  });
});
