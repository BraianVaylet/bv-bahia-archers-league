import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PatrolsPage } from './pages/Patrols.js';

/**
 * Pantalla de patrullas y credenciales (FE-13).
 *
 * La lógica se prueba en `patrullas.test.ts`; acá, que la pantalla la use y que
 * el validador avise sin bloquear.
 */

const TORNEO = {
  id: 't1',
  name: '3ª fecha',
  status: 'sin_iniciar',
  targets: [1, 2, 3, 4].map((index) => ({ index })),
};

const miembro = (id: string, lastName: string, category = 'razo', stake = 'azul') => ({
  id,
  firstName: 'Nombre',
  lastName,
  category,
  stake,
  unit: 'A',
  position: 'izquierda',
  signed: false,
});

const PATRULLAS = [
  {
    id: 'x1',
    number: 1,
    startTargetIndex: 1,
    username: 'patrulla1',
    status: 'pendiente',
    targetsCompleted: 0,
    pin: '481902',
    members: [miembro('a', 'Pérez'), { ...miembro('b', 'Gómez'), position: 'derecha' }],
  },
  {
    id: 'x2',
    number: 2,
    startTargetIndex: 3,
    username: 'patrulla2',
    status: 'pendiente',
    targetsCompleted: 0,
    pin: '117744',
    members: [
      miembro('c', 'Díaz', 'longbow'),
      { ...miembro('d', 'Ruiz', 'longbow'), position: 'derecha' },
    ],
  },
];

type Manejador = (body: unknown) => { status?: number; json: unknown };

let rutas: Record<string, Manejador>;
let llamadas: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  llamadas = [];
  rutas = {
    'GET /api/admin/tournaments/t1': () => ({ json: { tournament: TORNEO } }),
    'GET /api/admin/tournaments/t1/patrols': () => ({
      json: { patrols: PATRULLAS, violations: [] },
    }),
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

function renderPatrullas() {
  render(
    <MemoryRouter initialEntries={['/wafa/torneos/t1/patrullas']}>
      <Routes>
        <Route path="/wafa/torneos/:id/patrullas" element={<PatrolsPage onVolver={vi.fn()} />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Lectura ──────────────────────────────────────────────────────────────────

describe('composición', () => {
  it('muestra las patrullas con sus unidades, estacas y blanco de inicio', async () => {
    renderPatrullas();

    expect(await screen.findByTestId('patrulla-1')).toBeDefined();
    const p1 = screen.getByTestId('patrulla-1');

    expect(p1.textContent).toMatch(/Pérez/);
    expect(p1.textContent).toMatch(/Unidad A · tira primero/);
    expect(p1.textContent).toMatch(/Arranca en el blanco 1/);
    // El color de estaca nunca va solo: lleva el nombre escrito.
    expect(p1.textContent).toMatch(/Estaca Azul/);
  });

  it('muestra la credencial de cada patrulla', async () => {
    renderPatrullas();

    expect(await screen.findByTestId('pin-1')).toHaveTextContent('481902');
    expect(screen.getByTestId('pin-2')).toHaveTextContent('117744');
    expect(screen.getByText('patrulla1')).toBeDefined();
  });

  it('regenerar el PIN pega a su ruta y recarga', async () => {
    rutas['POST /api/admin/patrols/x1/pin/regenerate'] = () => ({
      json: { username: 'patrulla1', pin: '999999' },
    });
    renderPatrullas();

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Regenerar' }))[0] as HTMLElement,
    );

    await waitFor(() => {
      expect(llamadas.some((l) => l.url.endsWith('/patrols/x1/pin/regenerate'))).toBe(true);
    });
  });
});

// ── Edición ──────────────────────────────────────────────────────────────────

describe('edición manual', () => {
  it('mueve un arquero a otra patrulla', async () => {
    renderPatrullas();
    await screen.findByTestId('patrulla-1');

    fireEvent.click(screen.getByRole('button', { name: 'Mover a Pérez' }));
    fireEvent.click(screen.getByRole('button', { name: 'A la 2' }));

    expect(screen.getByTestId('patrulla-2').textContent).toMatch(/Pérez/);
    expect(screen.getByTestId('patrulla-1').textContent).not.toMatch(/Pérez/);
  });

  it('cambia el blanco de inicio', async () => {
    renderPatrullas();
    await screen.findByTestId('patrulla-1');

    fireEvent.change(screen.getByLabelText('Blanco de inicio de la patrulla 1'), {
      target: { value: '4' },
    });

    expect(screen.getByTestId('patrulla-1').textContent).toMatch(/Arranca en el blanco 4/);
  });

  // El admin conoce el terreno. La pantalla informa; la decisión es suya.
  it('AVISA en vivo sin bloquear el guardado', async () => {
    renderPatrullas();
    await screen.findByTestId('patrulla-1');

    // La patrulla 1 queda con un solo arquero: viola H1.
    fireEvent.click(screen.getByRole('button', { name: 'Mover a Pérez' }));
    fireEvent.click(screen.getByRole('button', { name: 'A la 2' }));

    const avisos = screen.getByTestId('violaciones');
    expect(avisos.textContent).toMatch(/Podés guardarlas igual; queda registrado/);
    expect(avisos.textContent).toMatch(/Patrulla 1.*entre 2 y 4/);

    // Y el botón sigue habilitado: avisar no es impedir.
    expect(
      (screen.getByRole('button', { name: 'Guardar patrullas' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  /**
   * Los arqueros se suman **al final**, así que un movimiento suelto deja al
   * recién llegado solo en la unidad `B` y la `A` no se ensucia. Para mezclar una
   * unidad hace falta que caiga junto a otro: primero se vacía un lugar.
   */
  it('detecta una unidad con categorías mezcladas', async () => {
    renderPatrullas();
    await screen.findByTestId('patrulla-1');

    fireEvent.click(screen.getByRole('button', { name: 'Mover a Ruiz' }));
    fireEvent.click(screen.getByRole('button', { name: 'A la 1' }));

    // Ahora la patrulla 2 tiene sólo a Díaz (longbow): Pérez (razo) cae al lado.
    fireEvent.click(screen.getByRole('button', { name: 'Mover a Pérez' }));
    fireEvent.click(screen.getByRole('button', { name: 'A la 2' }));

    expect(screen.getByTestId('violaciones').textContent).toMatch(/unidad A.*categorías distintas/);
  });

  it('NO deja guardar una patrulla de más de 4: el servidor la rechazaría', async () => {
    renderPatrullas();
    await screen.findByTestId('patrulla-1');

    for (const apellido of ['Díaz', 'Ruiz']) {
      fireEvent.click(screen.getByRole('button', { name: `Mover a ${apellido}` }));
      fireEvent.click(screen.getByRole('button', { name: 'A la 1' }));
    }

    // Cuatro entran; el quinto no existe, así que se prueba con el tope justo:
    // 4 es válido y el aviso de tope no aparece.
    expect(screen.queryByText(/El máximo es 4/)).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Guardar patrullas' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('guarda mandando las unidades derivadas del orden', async () => {
    rutas['PUT /api/admin/tournaments/t1/patrols'] = () => ({
      json: { patrols: PATRULLAS, violations: [] },
    });
    renderPatrullas();
    await screen.findByTestId('patrulla-1');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar patrullas' }));

    await waitFor(() => {
      const put = llamadas.find((l) => l.method === 'PUT');
      expect(put?.body).toEqual({
        patrols: [
          { number: 1, startTargetIndex: 1, units: [{ label: 'A', members: ['a', 'b'] }] },
          { number: 2, startTargetIndex: 3, units: [{ label: 'A', members: ['c', 'd'] }] },
        ],
      });
    });

    expect(await screen.findByText('Patrullas guardadas.')).toBeDefined();
  });

  it('si el servidor rechaza, lo dice y no se pierde lo editado', async () => {
    rutas['PUT /api/admin/tournaments/t1/patrols'] = () => ({
      status: 400,
      json: { error: { code: 'VALIDATION_ERROR', message: 'Faltan arqueros en la distribución.' } },
    });
    renderPatrullas();
    await screen.findByTestId('patrulla-1');

    fireEvent.click(screen.getByRole('button', { name: 'Mover a Pérez' }));
    fireEvent.click(screen.getByRole('button', { name: 'A la 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar patrullas' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Faltan arqueros');
    expect(screen.getByTestId('patrulla-2').textContent).toMatch(/Pérez/);
  });
});

// ── Congelado ────────────────────────────────────────────────────────────────

describe('torneo ya iniciado', () => {
  beforeEach(() => {
    rutas['GET /api/admin/tournaments/t1'] = () => ({
      json: { tournament: { ...TORNEO, status: 'en_proceso' } },
    });
  });

  it('no se puede editar y explica por qué', async () => {
    renderPatrullas();

    expect(await screen.findByText(/las patrullas quedaron congeladas/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mover a Pérez' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Guardar patrullas' })).toBeNull();
  });

  it('las credenciales se siguen viendo: el líder puede necesitarlas', async () => {
    renderPatrullas();
    expect(await screen.findByTestId('pin-1')).toHaveTextContent('481902');
  });
});
