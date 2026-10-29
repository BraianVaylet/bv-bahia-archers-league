import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScorecardPage } from './pages/Scorecard.js';

/**
 * Tarjeta de puntajes de un arquero: flecha por flecha, blanco por blanco.
 *
 * Se simula el fetch a nivel de red, como en `landing.test.tsx`: así el test
 * también cubre que la pantalla pegue a la ruta correcta.
 */

const RUTA = '/api/public/tournaments/t1/participants/p1';

let respuestas: Record<string, { status?: number; json: unknown }>;

beforeEach(() => {
  respuestas = {};
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const r = respuestas[url];
      if (!r) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: { message: 'No se encontró lo que buscabas.' } }), {
            status: 404,
          }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify(r.json), { status: r.status ?? 200 }));
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const tarjeta = (o: Record<string, unknown> = {}) => ({
  scorecard: {
    tournament: { id: 't1', name: '3ª fecha', date: '2026-08-08' },
    archer: { firstName: 'Juan', lastName: 'Pérez', category: 'razo', stake: 'azul' },
    total: 51,
    maxTotal: 52,
    normalizedPct: 98.08,
    innerCount: 3,
    xCount: 1,
    tenCount: 3,
    mCount: 0,
    rows: [
      {
        index: 1,
        modality: '3d',
        arrows: [
          { token: '11', value: 11 },
          { token: '11', value: 11 },
        ],
        total: 22,
        maxTotal: 22,
      },
      {
        index: 2,
        modality: 'sala',
        arrows: [
          { token: 'X', value: 10 },
          { token: '10', value: 10 },
          { token: '9', value: 9 },
        ],
        total: 29,
        maxTotal: 30,
      },
    ],
    ...o,
  },
});

function renderTarjeta() {
  render(
    <MemoryRouter initialEntries={['/torneos/t1/participantes/p1']}>
      <Routes>
        <Route path="/torneos/:id/participantes/:participantId" element={<ScorecardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ScorecardPage', () => {
  it('pide la tarjeta del participante de ese torneo', async () => {
    respuestas[RUTA] = { json: tarjeta() };
    renderTarjeta();

    await screen.findByRole('heading', { level: 1 });
    expect(fetch).toHaveBeenCalledWith(RUTA, expect.anything());
  });

  it('dice de quién es, de qué torneo y cuánto sacó en total', async () => {
    respuestas[RUTA] = { json: tarjeta() };
    renderTarjeta();

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Pérez, Juan');
    expect(screen.getByTestId('resumen')).toHaveTextContent('51');
    expect(screen.getByTestId('resumen')).toHaveTextContent('52');
    expect(screen.getByRole('link', { name: /3ª fecha/ })).toHaveAttribute('href', '/torneos/t1');
  });

  it('muestra un blanco por fila, en orden, con su número y su modalidad', async () => {
    respuestas[RUTA] = { json: tarjeta() };
    renderTarjeta();

    const blancos = await screen.findAllByTestId(/^blanco-/);

    expect(blancos.map((b) => b.getAttribute('data-testid'))).toEqual(['blanco-1', 'blanco-2']);
    expect(blancos[0]).toHaveTextContent('Blanco 1');
    expect(blancos[0]).toHaveTextContent('3D');
    expect(blancos[1]).toHaveTextContent('Blanco 2');
  });

  it('muestra cada flecha y su valor, y el total del blanco', async () => {
    respuestas[RUTA] = { json: tarjeta() };
    renderTarjeta();

    const sala = await screen.findByTestId('blanco-2');
    const flechas = within(sala).getAllByRole('listitem');

    // Dicho con palabras: el nombre accesible no depende de ver la caja.
    expect(flechas.map((f) => f.getAttribute('aria-label'))).toEqual([
      'X, 10 puntos',
      '10, 10 puntos',
      '9, 9 puntos',
    ]);
    expect(sala).toHaveTextContent('29');
    expect(sala).toHaveTextContent('30');
  });

  // Una `X` vale 10 y una `M` vale 0: ese es justo el dato que no se ve sólo
  // con el token. Si el token ya es el número, repetirlo es ruido.
  it('aclara el valor sólo cuando el token no lo dice', async () => {
    respuestas[RUTA] = {
      json: tarjeta({
        rows: [
          {
            index: 1,
            modality: 'sala',
            arrows: [
              { token: 'X', value: 10 },
              { token: '9', value: 9 },
              { token: 'M', value: 0 },
            ],
            total: 19,
            maxTotal: 30,
          },
        ],
      }),
    };
    renderTarjeta();

    const flechas = within(await screen.findByTestId('blanco-1')).getAllByRole('listitem');

    expect(flechas[0]).toHaveTextContent('X10');
    expect(flechas[1]).toHaveTextContent(/^9$/);
    expect(flechas[2]).toHaveTextContent('M0');
  });

  it('un blanco sin puntaje lo dice, no lo muestra como un cero', async () => {
    respuestas[RUTA] = {
      json: tarjeta({
        rows: [{ index: 1, modality: '3d', arrows: null, total: 0, maxTotal: 22 }],
      }),
    };
    renderTarjeta();

    const blanco = await screen.findByTestId('blanco-1');

    expect(blanco).toHaveTextContent('Sin puntaje');
    expect(within(blanco).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('si no se encuentra, lo avisa y ofrece volver al torneo', async () => {
    renderTarjeta();

    expect(await screen.findByRole('alert')).toHaveTextContent('No se encontró lo que buscabas.');
    expect(screen.getByRole('link', { name: /torneo/i })).toHaveAttribute('href', '/torneos/t1');
  });
});
