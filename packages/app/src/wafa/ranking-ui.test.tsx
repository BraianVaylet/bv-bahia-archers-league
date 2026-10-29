import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RankingPage } from './pages/Ranking.js';

/**
 * Ranking de liga dentro de WAFA (FE-16, rediseñado en SH-9).
 *
 * Los mismos datos y el mismo endpoint público que la landing, con el ranking
 * «mejor de N» — un solo modo, con `bestN` que manda el servidor. Lo que **no**
 * se comparte es el JSX —los paquetes no comparten bundle a propósito— pero sí
 * las decisiones: las medallas salen de `@bal/shared`.
 */

type Manejador = (body: unknown) => { status?: number; json: unknown };

let rutas: Record<string, Manejador>;
let llamadas: string[];

const arquero = (o: Record<string, unknown> = {}) => ({
  archerId: 'a1',
  firstName: 'Juan',
  lastName: 'Pérez',
  category: 'razo',
  tournamentsPlayed: 3,
  bestNormalizedPct: 84.5,
  bestNAvgPct: 81.2,
  position: 1,
  tied: false,
  ...o,
});

/**
 * Toma `{category, ranked, notYetEligible}` —la forma simple que usan los
 * tests— y la envuelve en `general` (`BE-21`): `femenino`/`masculino` van
 * vacíos porque esta pantalla todavía no los usa, eso es `FE-28`.
 */
function conRanking(
  categoriasSimples: { category: string; ranked: unknown[]; notYetEligible: unknown[] }[],
  bestN = 2,
) {
  const vacia = { ranked: [], notYetEligible: [] };
  const categories = categoriasSimples.map(({ category, ranked, notYetEligible }) => ({
    category,
    general: { ranked, notYetEligible },
    femenino: vacia,
    masculino: vacia,
  }));

  rutas['GET /api/public/seasons'] = () => ({
    json: { seasons: [{ id: 's1', name: 'Liga 2026', status: 'activa' }] },
  });
  rutas['GET /api/public/rankings?seasonId=s1'] = () => ({ json: { bestN, categories } });
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
    expect(oro).toHaveTextContent('81.2%');

    // Del cuarto en adelante no hay medalla que inventar.
    expect(screen.getByTestId('fila-Cuarto').textContent).not.toMatch(/🥇|🥈|🥉/);
  });

  /**
   * Los que no llegan a `bestN` van aparte, **no se ocultan**: esconderlos
   * haría creer que se perdió su resultado. Misma regla que la landing.
   *
   * El texto dice el `bestN` vigente —acá 3, no el default 2— y no un número
   * escrito a fuego en el JSX.
   */
  it('separa a los que todavía no clasifican, con el bestN vigente', async () => {
    conRanking(
      [
        {
          category: 'razo',
          ranked: [arquero()],
          notYetEligible: [arquero({ archerId: 'a9', lastName: 'Díaz', tournamentsPlayed: 2 })],
        },
      ],
      3,
    );
    renderRanking();

    const pendiente = await screen.findByTestId('pendiente-Díaz');
    expect(pendiente).toBeDefined();
    expect(screen.getByText(/con menos de 3 torneos/)).toBeDefined();
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

// ── FE-28 · Pestañas General/Femenino/Masculino ─────────────────────────────

describe('pestañas de sexo', () => {
  const vacia: { ranked: unknown[]; notYetEligible: unknown[] } = {
    ranked: [],
    notYetEligible: [],
  };

  function conVistas(
    general: { ranked: unknown[]; notYetEligible: unknown[] },
    femenino = vacia,
    masculino = vacia,
    bestN = 2,
  ) {
    rutas['GET /api/public/seasons'] = () => ({
      json: { seasons: [{ id: 's1', name: 'Liga 2026', status: 'activa' }] },
    });
    rutas['GET /api/public/rankings?seasonId=s1'] = () => ({
      json: { bestN, categories: [{ category: 'razo', general, femenino, masculino }] },
    });
  }

  it('arranca mostrando General', async () => {
    conVistas({ ranked: [arquero({ lastName: 'Gral' })], notYetEligible: [] });
    renderRanking();

    expect(await screen.findByTestId('fila-Gral')).toBeDefined();
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
  });

  it('tocar «Femenino» muestra sólo ese ranking', async () => {
    conVistas(
      { ranked: [arquero({ lastName: 'Gral' })], notYetEligible: [] },
      { ranked: [arquero({ archerId: 'f1', lastName: 'Fem' })], notYetEligible: [] },
    );
    renderRanking();
    await screen.findByTestId('fila-Gral');

    fireEvent.click(screen.getByRole('tab', { name: 'Femenino' }));

    expect(await screen.findByTestId('fila-Fem')).toBeDefined();
    expect(screen.queryByTestId('fila-Gral')).toBeNull();
  });

  it('cambiar de pestaña no cambia el testid de la tarjeta de categoría', async () => {
    conVistas({ ranked: [arquero({ lastName: 'Gral' })], notYetEligible: [] });
    renderRanking();
    await screen.findByTestId('cat-razo');

    fireEvent.click(screen.getByRole('tab', { name: 'Masculino' }));

    expect(await screen.findByTestId('cat-razo')).toBeDefined();
  });
});

// ── REF2-6 · Compartir ───────────────────────────────────────────────────────

describe('compartir el ranking', () => {
  it('manda el promedio y el bestN vigente, no un número fijo', async () => {
    const compartido: string[] = [];
    Object.defineProperty(navigator, 'share', {
      value: (d: { text: string }) => {
        compartido.push(d.text);
        return Promise.resolve();
      },
      configurable: true,
    });

    conRanking([{ category: 'razo', ranked: [arquero()], notYetEligible: [] }], 3);
    renderRanking();
    await screen.findByTestId('cat-razo');

    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));
    await waitFor(() => expect(compartido).toHaveLength(1));

    expect(compartido[0]).toMatch(/Mejor de 3/);
    expect(compartido[0]).toMatch(/81\.2 %/);
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

  // FE-28: las pestañas no sirven de nada si Compartir siempre manda General
  // aunque la pantalla esté mostrando Femenino.
  it('comparte la pestaña que está mostrando, no siempre General', async () => {
    const compartido: string[] = [];
    Object.defineProperty(navigator, 'share', {
      value: (d: { text: string }) => {
        compartido.push(d.text);
        return Promise.resolve();
      },
      configurable: true,
    });

    rutas['GET /api/public/seasons'] = () => ({
      json: { seasons: [{ id: 's1', name: 'Liga 2026', status: 'activa' }] },
    });
    rutas['GET /api/public/rankings?seasonId=s1'] = () => ({
      json: {
        bestN: 2,
        categories: [
          {
            category: 'razo',
            general: { ranked: [arquero({ lastName: 'Gral' })], notYetEligible: [] },
            femenino: {
              ranked: [arquero({ archerId: 'f1', lastName: 'Fem' })],
              notYetEligible: [],
            },
            masculino: { ranked: [], notYetEligible: [] },
          },
        ],
      },
    });
    renderRanking();
    await screen.findByTestId('fila-Gral');

    fireEvent.click(screen.getByRole('tab', { name: 'Femenino' }));
    await screen.findByTestId('fila-Fem');

    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));
    await waitFor(() => expect(compartido).toHaveLength(1));

    expect(compartido[0]).toMatch(/Fem, Juan/);
    expect(compartido[0]).not.toMatch(/Gral, Juan/);
  });
});
