import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RankingPage } from './pages/Ranking.js';

/**
 * Ranking de liga dentro de WAFA (FE-16).
 *
 * Los mismos datos y los mismos dos modos que la landing, contra los mismos
 * endpoints públicos. Lo que **no** se comparte es el JSX —los paquetes no
 * comparten bundle a propósito— pero sí las decisiones: medallas y nombres de
 * modo salen de `@bal/shared`.
 */

type Manejador = (body: unknown) => { status?: number; json: unknown };

let rutas: Record<string, Manejador>;
let llamadas: string[];

const arquero = (o: Record<string, unknown> = {}) => ({
  archerId: 'a1',
  firstName: 'Juan',
  lastName: 'Pérez',
  category: 'razo',
  leaguePoints: 12,
  tournamentsPlayed: 3,
  bestNormalizedPct: 84.5,
  bestTwoAvgPct: 81.2,
  position: 1,
  tied: false,
  ...o,
});

function conRanking(categories: unknown[]) {
  rutas['GET /api/public/seasons'] = () => ({
    json: { seasons: [{ id: 's1', name: 'Liga 2026', status: 'activa' }] },
  });
  for (const modo of ['position', 'best_two']) {
    rutas[`GET /api/public/rankings?seasonId=s1&mode=${modo}`] = () => ({ json: { categories } });
  }
}

beforeEach(() => {
  llamadas = [];
  rutas = {};

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const clave = `${init?.method ?? 'GET'} ${url}`;
      llamadas.push(clave);

      const manejador = rutas[clave];
      if (!manejador) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'no' } }), {
            status: 404,
          }),
        );
      }

      const { status = 200, json } = manejador(undefined);
      return Promise.resolve(new Response(JSON.stringify(json), { status }));
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderRanking = () => render(<RankingPage onVolver={vi.fn()} />);

describe('RankingPage de WAFA', () => {
  it('lista el ranking por categoría', async () => {
    conRanking([{ category: 'razo', ranked: [arquero()], notYetEligible: [] }]);
    renderRanking();

    expect(await screen.findByTestId('cat-razo')).toHaveTextContent('Razo');
    expect(screen.getByTestId('fila-Pérez')).toHaveTextContent('Pérez, Juan');
  });

  // Los mismos dos modos que la landing, con los mismos nombres: salen del
  // mismo `ETIQUETA_DE_MODO`.
  it('ofrece los dos modos y cambia de endpoint al conmutar', async () => {
    conRanking([{ category: 'razo', ranked: [arquero()], notYetEligible: [] }]);
    renderRanking();

    await screen.findByTestId('cat-razo');
    expect(screen.getByRole('button', { name: 'Por puntos' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Mejor de 2' }));

    await waitFor(() => {
      expect(llamadas.some((l) => l.includes('mode=best_two'))).toBe(true);
    });
  });

  it('marca el podio con medalla, y con el puesto escrito al lado', async () => {
    conRanking([
      {
        category: 'razo',
        ranked: [
          arquero({ archerId: 'a1', lastName: 'Oro', position: 1 }),
          arquero({ archerId: 'a4', lastName: 'Cuarto', position: 4 }),
        ],
        notYetEligible: [],
      },
    ]);
    renderRanking();

    const oro = await screen.findByTestId('fila-Oro');
    expect(oro).toHaveTextContent('🥇');
    expect(oro).toHaveTextContent('1');
    expect(within(oro).getByLabelText(/primer puesto/i)).toBeDefined();

    // Del cuarto en adelante no hay medalla que inventar.
    expect(screen.getByTestId('fila-Cuarto').textContent).not.toMatch(/🥇|🥈|🥉/);
  });

  /**
   * Los que no llegan al mínimo van aparte, **no se ocultan**: esconderlos haría
   * creer que se perdió su resultado. Misma regla que la landing.
   */
  it('separa a los que todavía no clasifican, sin esconderlos', async () => {
    conRanking([
      {
        category: 'razo',
        ranked: [arquero()],
        notYetEligible: [arquero({ archerId: 'a9', lastName: 'Díaz', tournamentsPlayed: 1 })],
      },
    ]);
    renderRanking();

    expect(await screen.findByTestId('pendiente-Díaz')).toBeDefined();
  });

  it('sin temporadas lo dice en vez de dejar un select vacío', async () => {
    rutas['GET /api/public/seasons'] = () => ({ json: { seasons: [] } });
    renderRanking();

    expect(await screen.findByText(/Todavía no hay temporadas/)).toBeDefined();
  });

  // WAFA es la app del admin: si el ranking no carga, tiene que decirlo, no
  // quedarse en blanco.
  it('si el ranking falla lo informa', async () => {
    rutas['GET /api/public/seasons'] = () => ({
      json: { seasons: [{ id: 's1', name: 'Liga 2026', status: 'activa' }] },
    });
    renderRanking();

    expect(await screen.findByRole('alert')).toBeDefined();
  });
});
