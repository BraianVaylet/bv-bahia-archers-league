import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArcherPage } from './pages/Archer.js';
import { HomePage } from './pages/Home.js';
import { RankingPage } from './pages/Ranking.js';
import { TournamentPage, TournamentsPage } from './pages/Tournaments.js';

/**
 * Sitio público (FE-17..FE-20).
 *
 * Se simula el fetch a nivel de red, no el cliente: así los tests también
 * cubren que cada pantalla pegue a la ruta correcta con sus parámetros.
 */

/** Una ruta que **nunca responde**, para poder mirar el estado intermedio. */
const NUNCA = Symbol('nunca responde');

type Manejador = () => { status?: number; json: unknown } | typeof NUNCA;

let rutas: Record<string, Manejador>;
let llamadas: string[];

function servidor(nuevas: Record<string, Manejador>) {
  rutas = { ...rutas, ...nuevas };
}

beforeEach(() => {
  rutas = {};
  llamadas = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      llamadas.push(url);
      const manejador = rutas[url];

      if (!manejador) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: { message: 'No se encontró.' } }), { status: 404 }),
        );
      }

      const respuesta = manejador();
      if (respuesta === NUNCA) return new Promise(() => {});

      const { status = 200, json } = respuesta;
      return Promise.resolve(new Response(JSON.stringify(json), { status }));
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const arquero = (o: Record<string, unknown> = {}) => ({
  archerId: 'a1',
  firstName: 'Juan',
  lastName: 'Pérez',
  leaguePoints: 12,
  tournamentsPlayed: 3,
  bestNormalizedPct: 84.5,
  bestRawScore: 279,
  bestTwoAvgPct: 81.2,
  position: 1,
  tied: false,
  ...o,
});

function renderEn(elemento: React.ReactNode, ruta = '/', patron = '/') {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path={patron} element={elemento} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── FE-18 · Introducción ─────────────────────────────────────────────────────

describe('HomePage', () => {
  it('el acceso para anotar puntajes está primero y va a WAFL', () => {
    renderEn(<HomePage />);

    const accesos = screen.getAllByRole('link');
    // Lo primero que hace falta el día del torneo es entrar a anotar.
    expect(accesos[0]?.getAttribute('href')).toBe('/app/wafl');
    expect(accesos[0]?.textContent).toMatch(/Anotar puntajes/);
  });

  it('también ofrece la administración', () => {
    renderEn(<HomePage />);
    expect(screen.getByText('Administración').getAttribute('href')).toBe('/app/wafa');
  });
});

// ── FE-18 · Ranking ──────────────────────────────────────────────────────────

describe('RankingPage', () => {
  const conTemporada = (categories: unknown[]) => {
    servidor({
      '/api/public/seasons': () => ({
        json: { seasons: [{ id: 's1', name: 'Liga 2026', status: 'activa' }] },
      }),
      '/api/public/rankings?seasonId=s1&mode=position': () => ({ json: { categories } }),
      '/api/public/rankings?seasonId=s1&mode=score': () => ({ json: { categories } }),
    });
  };

  it('muestra el ranking de cada categoría', async () => {
    conTemporada([
      { category: 'razo', ranked: [arquero()], notYetEligible: [] },
      {
        category: 'longbow',
        ranked: [arquero({ archerId: 'a2', lastName: 'Gómez' })],
        notYetEligible: [],
      },
    ]);
    renderEn(<RankingPage />, '/ranking', '/ranking');

    expect(await screen.findByTestId('cat-razo')).toHaveTextContent('Razo');
    expect(screen.getByTestId('cat-longbow')).toHaveTextContent('Longbow');
    expect(screen.getByTestId('fila-Pérez')).toHaveTextContent('84.5%');
  });

  it('arranca en la primera temporada sin que haya que elegirla', async () => {
    conTemporada([{ category: 'razo', ranked: [arquero()], notYetEligible: [] }]);
    renderEn(<RankingPage />, '/ranking', '/ranking');

    await screen.findByTestId('cat-razo');
    expect(llamadas.some((u) => u.includes('seasonId=s1'))).toBe(true);
  });

  it('cambiar de modo pide el ranking de nuevo al servidor', async () => {
    conTemporada([{ category: 'razo', ranked: [arquero()], notYetEligible: [] }]);
    renderEn(<RankingPage />, '/ranking', '/ranking');

    await screen.findByTestId('cat-razo');
    fireEvent.click(screen.getByRole('button', { name: 'Mejor de 2' }));

    // El orden lo decide el servidor: la landing no reordena por su cuenta.
    await waitFor(() => {
      expect(llamadas.some((u) => u.includes('mode=best_two'))).toBe(true);
    });
  });

  /**
   * El modo `score` ya no existe en la API: pedirlo devuelve 400.
   *
   * El mock acepta cualquier ruta que se le declare, así que un test que sólo
   * mire lo que se pinta no habría notado que la landing pedía un modo muerto.
   */
  it('NO le pide al servidor ningún modo que la API ya no acepta', async () => {
    conTemporada([{ category: 'razo', ranked: [arquero()], notYetEligible: [] }]);
    renderEn(<RankingPage />, '/ranking', '/ranking');

    await screen.findByTestId('cat-razo');
    for (const boton of screen.getAllByRole('button')) fireEvent.click(boton);

    await waitFor(() => expect(llamadas.length).toBeGreaterThan(1));

    const modos = llamadas
      .filter((u) => u.includes('/rankings?'))
      .map((u) => new URL(u, 'http://x').searchParams.get('mode'));

    expect(modos.length).toBeGreaterThan(0);
    expect([...new Set(modos)].sort()).toEqual(['best_two', 'position']);
  });

  // Esconderlos haría creer que se perdió su resultado.
  it('los que no llegan al mínimo van aparte, CON la explicación', async () => {
    conTemporada([
      {
        category: 'razo',
        ranked: [arquero()],
        notYetEligible: [arquero({ archerId: 'a9', lastName: 'Díaz', tournamentsPlayed: 1 })],
      },
    ]);
    renderEn(<RankingPage />, '/ranking', '/ranking');

    expect(await screen.findByText(/1 con menos de 2 torneos/)).toBeDefined();
    expect(screen.getByTestId('pendiente-Díaz')).toHaveTextContent('1 torneo');
    expect(screen.getByText(/cuentan apenas lleguen/)).toBeDefined();
  });

  it('una categoría sin nadie clasificado lo dice', async () => {
    conTemporada([{ category: 'razo', ranked: [], notYetEligible: [arquero()] }]);
    renderEn(<RankingPage />, '/ranking', '/ranking');

    expect(await screen.findByText(/Nadie llegó todavía al mínimo/)).toBeDefined();
  });

  /**
   * Mientras llega el ranking nuevo **no se muestra el viejo**. Dejarlo puesto
   * haría leer los resultados de una temporada como si fueran de otra, que es
   * peor que no mostrar nada.
   */
  it('al cambiar de temporada vuelve a «Cargando», no deja lo anterior', async () => {
    conTemporada([{ category: 'razo', ranked: [arquero()], notYetEligible: [] }]);
    servidor({
      '/api/public/seasons': () => ({
        json: {
          seasons: [
            { id: 's1', name: 'Liga 2026', status: 'activa' },
            { id: 's2', name: 'Liga 2025', status: 'cerrada' },
          ],
        },
      }),
      // La de 2025 nunca responde: es la única forma de mirar el estado
      // intermedio. Con un error, la pantalla se limpiaría igual y el test
      // pasaría aunque no se reseteara nada.
      '/api/public/rankings?seasonId=s2&mode=position': () => NUNCA,
    });

    renderEn(<RankingPage />, '/ranking', '/ranking');
    expect(await screen.findByTestId('fila-Pérez')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Temporada'), { target: { value: 's2' } });

    await waitFor(() => {
      expect(screen.queryByTestId('fila-Pérez')).toBeNull();
    });
    expect(screen.getByRole('status')).toHaveTextContent('Cargando');
  });

  it('sin temporadas lo dice en vez de dejar la pantalla vacía', async () => {
    servidor({ '/api/public/seasons': () => ({ json: { seasons: [] } }) });
    renderEn(<RankingPage />, '/ranking', '/ranking');

    expect(await screen.findByText(/Todavía no hay temporadas/)).toBeDefined();
  });
});

// ── FE-19 · Torneos ──────────────────────────────────────────────────────────

describe('TournamentsPage', () => {
  it('lista los torneos', async () => {
    servidor({
      '/api/public/tournaments': () => ({
        json: {
          tournaments: [
            {
              id: 't1',
              name: '3ª fecha',
              date: '2026-08-08',
              status: 'publicado',
              targetCount: 14,
              participantCount: 20,
            },
          ],
        },
      }),
    });
    renderEn(<TournamentsPage />, '/torneos', '/torneos');

    expect(await screen.findByTestId('torneo-t1')).toHaveTextContent('3ª fecha');
    expect(screen.getByTestId('torneo-t1')).toHaveTextContent('14 blancos · 20 arqueros');
  });

  it('sin torneos publicados lo dice', async () => {
    servidor({ '/api/public/tournaments': () => ({ json: { tournaments: [] } }) });
    renderEn(<TournamentsPage />, '/torneos', '/torneos');

    expect(await screen.findByText(/Todavía no hay torneos publicados/)).toBeDefined();
  });
});

describe('TournamentPage', () => {
  const detalle = (o: Record<string, unknown> = {}) => ({
    id: 't1',
    name: '3ª fecha',
    date: '2026-08-08',
    description: '',
    status: 'publicado',
    targets: [
      { index: 1, modality: '3d', arrows: 2 },
      { index: 2, modality: 'sala', arrows: 3 },
    ],
    maxPossibleScore: 52,
    patrols: [
      {
        number: 1,
        startTargetIndex: 1,
        status: 'cerrada',
        targetsCompleted: 2,
        members: [{ firstName: 'Juan', lastName: 'Pérez', category: 'razo', stake: 'azul' }],
      },
    ],
    ...o,
  });

  const renderDetalle = () => renderEn(<TournamentPage />, '/torneos/t1', '/torneos/:id');

  it('muestra el podio de un torneo publicado', async () => {
    servidor({
      '/api/public/tournaments/t1': () => ({
        json: {
          tournament: detalle({
            // Vienen DESORDENADOS a propósito: si el test los recibiera ya
            // ordenados, no probaría que la pantalla los ordena.
            results: [
              {
                firstName: 'Ana',
                lastName: 'Gómez',
                category: 'razo',
                total: 40,
                normalizedPct: 76.92,
                innerCount: 1,
                tenCount: 2,
                mCount: 1,
              },
              {
                firstName: 'Juan',
                lastName: 'Pérez',
                category: 'razo',
                total: 45,
                normalizedPct: 86.54,
                innerCount: 3,
                tenCount: 4,
                mCount: 0,
              },
            ],
          }),
        },
      }),
    });
    renderDetalle();

    const podio = await screen.findByTestId('podio-razo');
    expect(podio).toHaveTextContent('86.54%');

    // El orden lo da `rankByCategory`, el mismo del servidor: el de 45 va
    // primero aunque haya llegado segundo en la respuesta.
    const filas = podio.querySelectorAll('tbody tr');
    expect(filas[0]?.textContent).toMatch(/Pérez/);
    expect(filas[1]?.textContent).toMatch(/Gómez/);
  });

  // Es una regla del backend —el endpoint no los manda— pero la pantalla lo
  // explica para que nadie crea que está rota.
  it('un torneo EN CURSO muestra patrullas y avance, y NINGÚN puntaje', async () => {
    servidor({
      '/api/public/tournaments/t1': () => ({
        json: { tournament: detalle({ status: 'en_proceso', results: undefined }) },
      }),
    });
    renderDetalle();

    expect(await screen.findByTestId('aviso-en-curso')).toHaveTextContent(
      /Los puntajes se publican cuando termina/,
    );
    expect(screen.getByTestId('patrulla-1')).toHaveTextContent('2 de 2 blancos');
    expect(screen.queryByTestId('podio-razo')).toBeNull();
  });

  it('muestra la estaca con el nombre, no sólo el color', async () => {
    servidor({ '/api/public/tournaments/t1': () => ({ json: { tournament: detalle() } }) });
    renderDetalle();

    expect(await screen.findByText('Estaca Azul')).toBeDefined();
  });

  it('un torneo que no existe muestra el error y una salida', async () => {
    renderDetalle();

    expect(await screen.findByRole('alert')).toHaveTextContent('No se encontró.');
    expect(screen.getByText('Volver a los torneos')).toBeDefined();
  });
});

// ── FE-20 · Ficha de arquero ─────────────────────────────────────────────────

describe('ArcherPage', () => {
  const renderFicha = () => renderEn(<ArcherPage />, '/arqueros/a1', '/arqueros/:id');

  it('muestra las estadísticas de cada temporada', async () => {
    servidor({
      '/api/public/archers/a1': () => ({
        json: {
          archer: {
            id: 'a1',
            firstName: 'Juan',
            lastName: 'Pérez',
            seasons: [
              {
                seasonId: 's1',
                category: 'razo',
                leaguePoints: 12,
                tournamentsPlayed: 3,
                podiums: { first: 1, second: 1, third: 0 },
                bestNormalizedPct: 84.5,
                bestRawScore: 279,
                totalX: 15,
                totalTens: 22,
                totalM: 3,
              },
            ],
          },
        },
      }),
    });
    renderFicha();

    const temporada = await screen.findByTestId('temporada-s1');
    expect(temporada).toHaveTextContent('Razo');
    expect(temporada).toHaveTextContent('12');
    // El porcentaje primero, el bruto entre paréntesis.
    expect(temporada).toHaveTextContent('84.5% (279)');
    expect(temporada).toHaveTextContent('1-1-0');
  });

  // El padrón del club no se filtra hacia afuera.
  it('un arquero sin torneos publicados no tiene ficha', async () => {
    renderFicha();

    expect(await screen.findByRole('alert')).toHaveTextContent('No se encontró.');
    expect(screen.getByText('Volver al ranking')).toBeDefined();
  });
});
