import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TournamentCreatePage } from './pages/TournamentCreate.js';

/**
 * Wizard de creación de torneo, la pantalla (FE-11).
 *
 * Las decisiones se prueban en `wizard.test.ts`; acá se prueba que la pantalla
 * las use y que los cuatro pasos se puedan recorrer.
 */

const TEMPORADAS = [
  { id: 's1', name: 'Liga 2026', startsAt: '2026-01-01', endsAt: '2026-12-31', status: 'activa' },
];

const PADRON = [
  { id: 'a1', firstName: 'Juan', lastName: 'Pérez', category: 'razo' },
  { id: 'a2', firstName: 'Ana', lastName: 'Gómez', category: 'razo' },
  { id: 'a3', firstName: 'Luis', lastName: 'Díaz', category: 'longbow' },
  { id: 'a4', firstName: 'Sol', lastName: 'Ruiz', category: 'longbow' },
];

type Manejador = (body: unknown) => { status?: number; json: unknown };

let rutas: Record<string, Manejador>;
let llamadas: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  llamadas = [];
  rutas = {
    'GET /api/admin/seasons': () => ({ json: { seasons: TEMPORADAS } }),
    'GET /api/admin/archers': () => ({ json: { archers: PADRON } }),
    'GET /api/auth/csrf': () => ({ json: { csrfToken: 't' } }),
  };

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      llamadas.push({ method, url, body });

      // La búsqueda agrega query string; se resuelve contra la ruta sin ella.
      const manejador = rutas[`${method} ${url.split('?')[0]}`];
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

function renderWizard(onCreado = vi.fn()) {
  render(<TournamentCreatePage onVolver={vi.fn()} onCreado={onCreado} />);
  return { onCreado };
}

const continuar = () => fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

/** Completa el paso 1 y avanza al 2. */
async function pasoUno() {
  // Se espera la OPCIÓN, no el select: el select existe desde la primera
  // pintada y elegir un valor sin su opción no hace nada.
  await screen.findByRole('option', { name: 'Liga 2026' });

  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '3ª fecha' } });
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-08-08' } });
  fireEvent.change(screen.getByLabelText('Temporada'), { target: { value: 's1' } });

  expect((screen.getByLabelText('Temporada') as HTMLSelectElement).value).toBe('s1');
  continuar();
}

/** Elige a los cuatro del padrón en el paso 3. */
async function elegirCuatro() {
  await screen.findByText('Pérez, Juan');
  for (const nombre of ['Pérez, Juan', 'Gómez, Ana', 'Díaz, Luis', 'Ruiz, Sol']) {
    fireEvent.click(screen.getByText(nombre));
  }
}

// ── Paso 1 ───────────────────────────────────────────────────────────────────

describe('paso 1 · datos', () => {
  it('no deja continuar sin nombre, fecha y temporada', async () => {
    renderWizard();
    await screen.findByLabelText('Nombre');

    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText(/El nombre necesita al menos 3 caracteres/)).toBeDefined();
  });

  it('sin temporadas cargadas lo explica en vez de dejar un select vacío', async () => {
    rutas['GET /api/admin/seasons'] = () => ({ json: { seasons: [] } });
    renderWizard();

    expect(await screen.findByText(/Creá una antes de armar el torneo/)).toBeDefined();
  });
});

// ── Paso 2 ───────────────────────────────────────────────────────────────────

describe('paso 2 · recorrido', () => {
  const irAlDos = async () => {
    renderWizard();
    await pasoUno();
    await screen.findByTestId('blanco-1');
  };

  it('el máximo posible se actualiza en vivo al cambiar la modalidad', async () => {
    await irAlDos();

    // Arranca con un blanco de sala: 3 × 10.
    expect(screen.getByTestId('maximo-posible')).toHaveTextContent('30');

    fireEvent.change(screen.getByLabelText('Modalidad'), { target: { value: '3d' } });

    // 3D precarga 2 flechas de 11.
    expect(screen.getByTestId('maximo-posible')).toHaveTextContent('22');
  });

  it('cambiar la modalidad repone las flechas del reglamento', async () => {
    await irAlDos();

    expect((screen.getByLabelText('Flechas') as HTMLInputElement).value).toBe('3');
    fireEvent.change(screen.getByLabelText('Modalidad'), { target: { value: 'aire_libre' } });
    expect((screen.getByLabelText('Flechas') as HTMLInputElement).value).toBe('6');
  });

  it('el máximo también sigue a las flechas cargadas a mano', async () => {
    await irAlDos();

    fireEvent.change(screen.getByLabelText('Flechas'), { target: { value: '6' } });
    expect(screen.getByTestId('maximo-posible')).toHaveTextContent('60');
  });

  it('agrega blancos y los numera', async () => {
    await irAlDos();

    fireEvent.click(screen.getByRole('button', { name: 'Agregar blanco' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar blanco' }));

    expect(screen.getByTestId('blanco-3')).toBeDefined();
    expect(screen.getByTestId('maximo-posible')).toHaveTextContent('90');
  });

  it('eliminar del medio renumera, sin dejar huecos', async () => {
    await irAlDos();

    fireEvent.click(screen.getByRole('button', { name: 'Agregar blanco' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar blanco' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar el blanco 2' }));

    // El backend exige índices contiguos: un hueco se rechazaría recién al
    // confirmar, después de cargar todo.
    expect(screen.queryByTestId('blanco-3')).toBeNull();
    expect(screen.getByTestId('blanco-1')).toBeDefined();
    expect(screen.getByTestId('blanco-2')).toBeDefined();
  });

  it('no deja eliminar el último blanco', async () => {
    await irAlDos();

    expect(
      (screen.getByRole('button', { name: 'Eliminar el blanco 1' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('reordena los blancos', async () => {
    await irAlDos();

    fireEvent.click(screen.getByRole('button', { name: 'Agregar blanco' }));
    fireEvent.change(screen.getAllByLabelText('Modalidad')[1] as HTMLElement, {
      target: { value: '3d' },
    });

    // El 3D está segundo; al subirlo pasa a ser el blanco 1.
    fireEvent.click(screen.getByRole('button', { name: 'Subir el blanco 2' }));

    expect((screen.getAllByLabelText('Modalidad')[0] as HTMLSelectElement).value).toBe('3d');
  });

  it('en los extremos no se puede mover', async () => {
    await irAlDos();

    expect(
      (screen.getByRole('button', { name: 'Subir el blanco 1' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Bajar el blanco 1' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

// ── Paso 3 ───────────────────────────────────────────────────────────────────

describe('paso 3 · participantes', () => {
  const irAlTres = async () => {
    renderWizard();
    await pasoUno();
    await screen.findByTestId('blanco-1');
    continuar();
  };

  it('cuenta los elegidos y los agrupa por categoría', async () => {
    await irAlTres();
    await elegirCuatro();

    expect(screen.getByTestId('conteo-elegidos')).toHaveTextContent('4 arqueros elegidos');
    expect(screen.getByText('Razo: 2')).toBeDefined();
    expect(screen.getByText('Longbow: 2')).toBeDefined();
  });

  it('frena si la composición dejaría arqueros sin patrulla, y dice quiénes', async () => {
    rutas['GET /api/admin/archers'] = () => ({
      json: {
        archers: [
          { id: 'e1', firstName: 'Mia', lastName: 'Soto', category: 'escuela' },
          { id: 'e2', firstName: 'Leo', lastName: 'Vera', category: 'escuela' },
        ],
      },
    });
    await irAlTres();

    await screen.findByText('Soto, Mia');
    fireEvent.click(screen.getByText('Soto, Mia'));
    fireEvent.click(screen.getByText('Vera, Leo'));

    // H3: ninguna patrulla puede ser 100% escuela.
    expect(screen.getByRole('alert')).toHaveTextContent(/No alcanzan los arqueros senior/);
    expect(screen.getByRole('alert')).toHaveTextContent(/Soto/);
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('crea un arquero sin salir del wizard y lo suma a los elegidos', async () => {
    rutas['POST /api/admin/archers'] = () => ({
      status: 201,
      json: { archer: { id: 'nuevo', firstName: 'Eva', lastName: 'Luna', category: 'recurvo' } },
    });
    await irAlTres();
    await screen.findByText('Pérez, Juan');

    fireEvent.click(screen.getByRole('button', { name: 'Arquero nuevo' }));
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Luna' } });
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Eva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear y sumar' }));

    // Mandar al admin al padrón y de vuelta le haría perder todo lo cargado.
    await waitFor(() => {
      expect(screen.getByTestId('conteo-elegidos')).toHaveTextContent('1 arqueros elegidos');
    });
    expect(screen.getByText('Recurvo olímpico: 1')).toBeDefined();
  });
});

// ── Paso 4 ───────────────────────────────────────────────────────────────────

describe('paso 4 · revisión', () => {
  const irAlCuatro = async () => {
    const r = renderWizard();
    await pasoUno();
    await screen.findByTestId('blanco-1');
    continuar();
    await elegirCuatro();
    continuar();
    return r;
  };

  it('resume lo cargado', async () => {
    await irAlCuatro();

    expect(screen.getByText('3ª fecha')).toBeDefined();
    expect(screen.getByText(/1 blancos · máximo 30/)).toBeDefined();
    expect(screen.getByText('4 arqueros')).toBeDefined();
  });

  it('desde la revisión se vuelve a cualquier paso sin perder lo cargado', async () => {
    await irAlCuatro();

    // Rehacer todo por un blanco mal cargado no es una opción.
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[1] as HTMLElement);

    expect(screen.getByTestId('blanco-1')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar blanco' }));
    expect(screen.getByTestId('maximo-posible')).toHaveTextContent('60');

    continuar();
    await screen.findByText('Pérez, Juan');
    // Los participantes siguen elegidos.
    expect(screen.getByTestId('conteo-elegidos')).toHaveTextContent('4 arqueros elegidos');
  });

  it('crea el torneo con lo cargado', async () => {
    rutas['POST /api/admin/tournaments'] = () => ({
      status: 201,
      json: { tournament: { id: 't1' } },
    });

    const { onCreado } = await irAlCuatro();
    fireEvent.click(screen.getByRole('button', { name: 'Crear torneo' }));

    await waitFor(() => expect(onCreado).toHaveBeenCalledWith('t1'));

    const alta = llamadas.find((l) => l.method === 'POST' && l.url.endsWith('/admin/tournaments'));
    expect(alta?.body).toMatchObject({
      seasonId: 's1',
      name: '3ª fecha',
      date: '2026-08-08',
      targets: [{ index: 1, modality: 'sala', arrows: 3, description: null }],
      archerIds: ['a1', 'a2', 'a3', 'a4'],
    });
  });

  it('si el servidor rechaza, lo dice y no se pierde lo cargado', async () => {
    rutas['POST /api/admin/tournaments'] = () => ({
      status: 400,
      json: { error: { code: 'VALIDATION', message: 'Hay arqueros repetidos.' } },
    });

    const { onCreado } = await irAlCuatro();
    fireEvent.click(screen.getByRole('button', { name: 'Crear torneo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Hay arqueros repetidos.');
    expect(onCreado).not.toHaveBeenCalled();
    expect(screen.getByText('4 arqueros')).toBeDefined();
  });
});
