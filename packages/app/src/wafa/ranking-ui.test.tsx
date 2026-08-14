import { ETIQUETA_DE_MODO } from '@bal/shared';
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

// ── REF2-6 · Compartir ───────────────────────────────────────────────────────

describe('compartir el ranking', () => {
  /**
   * **Comparte el modo que está elegido.** Los dos modos ordenan distinto y dan
   * podios distintos: mandar «el ranking» sin decir cuál es mandar una lista de
   * números sin unidad.
   */
  it('manda el modo elegido, no siempre el mismo', async () => {
    const compartido: string[] = [];
    Object.defineProperty(navigator, 'share', {
      value: (d: { text: string }) => {
        compartido.push(d.text);
        return Promise.resolve();
      },
      configurable: true,
    });

    conRanking([{ category: 'razo', ranked: [arquero()], notYetEligible: [] }]);
    renderRanking();
    await screen.findByTestId('cat-razo');

    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));
    await waitFor(() => expect(compartido).toHaveLength(1));

    // El VALOR, no sólo la unidad. Una primera versión de este test comprobaba
    // que apareciera «pts» y «%», y pasaba con la pantalla mandando siempre los
    // puntos de liga: la unidad la pone el texto compartido según el modo, así
    // que cambiaba igual. Lo destapó la mutación.
    expect(compartido[0]).toMatch(/12 pts/);

    // Se cambia de modo y se vuelve a compartir: el texto tiene que cambiar.
    fireEvent.click(screen.getByRole('button', { name: ETIQUETA_DE_MODO.best_two }));
    await waitFor(() => expect(screen.getByTestId('cat-razo')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));
    await waitFor(() => expect(compartido).toHaveLength(2));

    expect(compartido[1]).toMatch(/81\.2 %/);
    expect(compartido[1]).not.toMatch(/12 /);
  });

  /**
   * Sin `navigator.share` —un escritorio— se copia. Un botón que no hace nada
   * en la mitad de los dispositivos no es una opción.
   */
  it('sin share, copia al portapapeles', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });

    const copiado: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (t: string) => {
          copiado.push(t);
          return Promise.resolve();
        },
      },
      configurable: true,
    });

    conRanking([{ category: 'razo', ranked: [arquero()], notYetEligible: [] }]);
    renderRanking();
    await screen.findByTestId('cat-razo');

    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    await waitFor(() => expect(copiado).toHaveLength(1));
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeDefined();
  });
});
