import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteDb, readBundle, readScores, type StoredBundle, saveBundle } from '../offline/db.js';
import { antiguedadDe, LoginPage } from './LoginPage.js';

/**
 * Login de WAFL (FE-4).
 *
 * Es la única vez que la app necesita red. Lo que más importa acá: que quien ya
 * descargó el recorrido pueda entrar aunque se le haya caído el wifi.
 */

const BUNDLE: StoredBundle = {
  tournament: {
    id: 't1',
    name: '3ª fecha',
    date: '2026-08-08',
    maxPossibleScore: 74,
    targets: [{ index: 1, modality: 'sala', arrows: 3, description: null }],
  },
  patrol: { id: 'p1', number: 3, startTargetIndex: 1, status: 'en_curso', targetsCompleted: 0 },
  participants: [],
  fetchedAt: Date.now(),
  clockSkewMs: 0,
};

let rutas: Record<string, { status?: number; json: unknown }> = {};

beforeEach(async () => {
  await deleteDb();
  rutas = {
    'GET /api/public/tournaments': {
      json: {
        tournaments: [{ id: 't1', name: '3ª fecha', date: '2026-08-08', status: 'en_proceso' }],
      },
    },
  };

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const clave = `${init?.method ?? 'GET'} ${url}`;
      const r = rutas[clave];
      if (!r) return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve(new Response(JSON.stringify(r.json), { status: r.status ?? 200 }));
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * Completa el formulario con credenciales válidas.
 *
 * Se espera a que exista la **opción**, no el select: el select está desde la
 * primera pintada, pero elegir un valor cuya opción todavía no cargó no hace
 * nada, y el formulario queda vacío sin que se note.
 */
async function completar() {
  await screen.findByRole('option', { name: /3ª fecha/ });

  fireEvent.change(screen.getByLabelText('Torneo'), { target: { value: 't1' } });
  fireEvent.change(screen.getByLabelText('Patrulla'), { target: { value: 'patrulla3' } });
  fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '481902' } });

  // Si el torneo no quedó elegido, el resto del test probaría otra cosa.
  expect((screen.getByLabelText('Torneo') as HTMLSelectElement).value).toBe('t1');
}

describe('antiguedadDe', () => {
  const AHORA = new Date('2026-08-08T12:00:00Z').getTime();

  it('dice las horas y los días, no una fecha que hay que interpretar', () => {
    expect(antiguedadDe(AHORA - 30 * 60_000, AHORA)).toBe('hace menos de una hora');
    expect(antiguedadDe(AHORA - 3_600_000, AHORA)).toBe('hace 1 hora');
    expect(antiguedadDe(AHORA - 5 * 3_600_000, AHORA)).toBe('hace 5 horas');
    expect(antiguedadDe(AHORA - 26 * 3_600_000, AHORA)).toBe('hace 1 día');
    expect(antiguedadDe(AHORA - 72 * 3_600_000, AHORA)).toBe('hace 3 días');
  });
});

describe('LoginPage', () => {
  it('sólo ofrece los torneos EN PROCESO', async () => {
    rutas['GET /api/public/tournaments'] = {
      json: {
        tournaments: [
          { id: 't1', name: 'Corriendo', date: '2026-08-08', status: 'en_proceso' },
          { id: 't2', name: 'Publicado', date: '2026-07-01', status: 'publicado' },
        ],
      },
    };
    render(<LoginPage onEntro={vi.fn()} />);

    // A un torneo publicado ya no se le cargan puntajes: ofrecerlo sería mandar
    // al líder a un rechazo del servidor.
    expect(await screen.findByRole('option', { name: /Corriendo/ })).toBeDefined();
    expect(screen.queryByRole('option', { name: /Publicado/ })).toBeNull();
  });

  it('sin torneos en curso lo explica', async () => {
    rutas['GET /api/public/tournaments'] = { json: { tournaments: [] } };
    render(<LoginPage onEntro={vi.fn()} />);

    expect(await screen.findByText(/El admin tiene que iniciarlo primero/)).toBeDefined();
  });

  it('el PIN acepta seis dígitos y nada más', async () => {
    render(<LoginPage onEntro={vi.fn()} />);

    const pin = (await screen.findByLabelText('PIN')) as HTMLInputElement;
    fireEvent.change(pin, { target: { value: '12ab34cd5678' } });

    expect(pin.value).toBe('123456');
  });

  it('no deja entrar con el PIN incompleto', async () => {
    render(<LoginPage onEntro={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText('Torneo'), { target: { value: 't1' } });
    fireEvent.change(screen.getByLabelText('Patrulla'), { target: { value: 'patrulla3' } });
    fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '4819' } });

    expect((screen.getByRole('button', { name: 'Entrar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('entra, descarga el recorrido y lo persiste', async () => {
    rutas['POST /api/auth/csrf'] = { json: {} };
    rutas['GET /api/auth/csrf'] = { json: { csrfToken: 't' } };
    rutas['POST /api/auth/patrol/login'] = { json: { patrol: { id: 'p1' } } };
    rutas['GET /api/wafl/bundle'] = {
      json: {
        tournament: BUNDLE.tournament,
        patrol: BUNDLE.patrol,
        participants: [],
        scores: [],
        signatures: [],
        serverTime: new Date().toISOString(),
      },
    };

    const onEntro = vi.fn();
    render(<LoginPage onEntro={onEntro} />);
    await completar();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(onEntro).toHaveBeenCalled());

    // Persistido: es lo que permite seguir sin señal a partir de acá.
    expect((await readBundle())?.tournament.id).toBe('t1');
  });

  it('siembra los puntajes que ya estaban en el servidor', async () => {
    rutas['GET /api/auth/csrf'] = { json: { csrfToken: 't' } };
    rutas['POST /api/auth/patrol/login'] = { json: { patrol: { id: 'p1' } } };
    rutas['GET /api/wafl/bundle'] = {
      json: {
        tournament: BUNDLE.tournament,
        patrol: BUNDLE.patrol,
        participants: [],
        scores: [{ participantId: 'x1', targetIndex: 1, arrows: ['X', '10', '9'], total: 29 }],
        signatures: [],
        serverTime: new Date().toISOString(),
      },
    };

    render(<LoginPage onEntro={vi.fn()} />);
    await completar();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    // Cubre al líder que cambia de celular a mitad del recorrido.
    await waitFor(async () => {
      expect(await readScores()).toHaveLength(1);
    });
  });

  it('repite el motivo del rechazo tal cual lo manda el servidor', async () => {
    rutas['GET /api/auth/csrf'] = { json: { csrfToken: 't' } };
    rutas['POST /api/auth/patrol/login'] = {
      status: 403,
      json: { error: { code: 'TOURNAMENT_NOT_STARTED', message: 'El torneo todavía no arrancó.' } },
    };

    render(<LoginPage onEntro={vi.fn()} />);
    await completar();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El torneo todavía no arrancó.');
  });

  it('con el recorrido ya descargado ofrece seguir SIN conexión, diciendo de cuándo son los datos', async () => {
    await saveBundle({ ...BUNDLE, fetchedAt: Date.now() - 5 * 3_600_000 });

    const onEntro = vi.fn();
    render(<LoginPage onEntro={onEntro} />);

    expect(await screen.findByText('3ª fecha')).toBeDefined();
    expect(screen.getByText(/Patrulla 3 · descargado hace 5 horas/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Seguir sin conexión' }));

    await waitFor(() => expect(onEntro).toHaveBeenCalled());
    // Sin tocar la red: el líder al que se le cayó el wifi no queda afuera de su
    // propio torneo.
    expect(onEntro.mock.calls[0]?.[0]).toMatchObject({ tournament: { id: 't1' } });
  });

  it('sin recorrido guardado no ofrece entrar sin conexión', async () => {
    render(<LoginPage onEntro={vi.fn()} />);

    await screen.findByLabelText('PIN');
    expect(screen.queryByRole('button', { name: 'Seguir sin conexión' })).toBeNull();
  });

  it('si se cae la red al entrar, avisa que se puede usar lo descargado', async () => {
    rutas['GET /api/auth/csrf'] = { json: { csrfToken: 't' } };
    // Sin manejador para el login: el fetch simulado rechaza, como sin señal.

    render(<LoginPage onEntro={vi.fn()} />);
    await completar();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /podés entrar con los datos del celular/,
    );
  });
});

// ── REF-6 · Botonera de patrullas ────────────────────────────────────────────

/**
 * Al elegir el torneo aparecen los botones de cada patrulla y sólo se tipea el
 * PIN. Tipear `patrulla3` con guantes, al sol, con el celular en una mano, es
 * la parte más lenta de entrar — y la que más se equivoca.
 */
describe('botonera de patrullas', () => {
  const conPatrullas = (patrols: { number: number; username: string }[]) => {
    rutas['GET /api/public/tournaments/t1'] = { json: { tournament: { patrols } } };
  };

  /**
   * Se espera la OPCIÓN, no el select.
   *
   * `findByLabelText('Torneo')` resuelve apenas existe el `<select>`, pero los
   * torneos llegan por fetch: elegir un valor cuya `<option>` todavía no
   * renderizó **no hace nada**, y el formulario queda vacío sin que se note.
   * Es el mismo defecto que apareció en el E2E.
   */
  const elegirTorneo = async (id = 't1') => {
    render(<LoginPage onEntro={vi.fn()} />);
    await screen.findByRole('option', { name: /3ª fecha/ });
    fireEvent.change(screen.getByLabelText('Torneo'), { target: { value: id } });
  };

  it('al elegir el torneo aparecen los botones de sus patrullas', async () => {
    conPatrullas([
      { number: 1, username: 'patrulla1' },
      { number: 2, username: 'patrulla2' },
      { number: 3, username: 'patrulla3' },
    ]);
    await elegirTorneo();

    expect(await screen.findByRole('button', { name: 'Patrulla 1' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Patrulla 3' })).toBeDefined();
  });

  it('sin torneo elegido no hay botonera', async () => {
    conPatrullas([{ number: 1, username: 'patrulla1' }]);
    render(<LoginPage onEntro={vi.fn()} />);
    await screen.findByLabelText('Torneo');

    expect(screen.queryByRole('button', { name: 'Patrulla 1' })).toBeNull();
  });

  it('elegir una patrulla deja el formulario listo para tipear sólo el PIN', async () => {
    conPatrullas([
      { number: 1, username: 'patrulla1' },
      { number: 2, username: 'patrulla2' },
    ]);
    await elegirTorneo();

    fireEvent.click(await screen.findByRole('button', { name: 'Patrulla 2' }));
    fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '481902' } });

    expect((screen.getByRole('button', { name: 'Entrar' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('la patrulla elegida se marca, para saber cuál se apretó', async () => {
    conPatrullas([
      { number: 1, username: 'patrulla1' },
      { number: 2, username: 'patrulla2' },
    ]);
    await elegirTorneo();

    fireEvent.click(await screen.findByRole('button', { name: 'Patrulla 2' }));

    expect(screen.getByRole('button', { name: 'Patrulla 2' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Patrulla 1' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  /**
   * Si el torneo no responde —sin señal en el club, por ejemplo— el líder tiene
   * que poder entrar igual tipeando el usuario. Quedarse sin botonera Y sin
   * campo sería quedarse afuera del torneo.
   */
  it('si no llegan las patrullas, el campo de texto sigue estando', async () => {
    // Sin ruta declarada: el fetch simulado rechaza.
    await elegirTorneo();

    expect(await screen.findByLabelText('Patrulla')).toBeDefined();
  });

  /**
   * Cambiar de torneo limpia la patrulla elegida.
   *
   * Con la patrulla de otro torneo puesta, el login fallaría con un 401 que no
   * explica nada.
   *
   * Se tipea en el campo en vez de tocar la botonera: el comportamiento es el
   * mismo —el efecto limpia el usuario— y el click sobre la botonera metía una
   * frontera asincrónica de más que hacía el test intermitente sin agregar
   * nada a lo que se quiere probar.
   */
  it('cambiar de torneo limpia la patrulla elegida', async () => {
    rutas['GET /api/public/tournaments'] = {
      json: {
        tournaments: [
          { id: 't1', name: '3ª fecha', date: '2026-08-08', status: 'en_proceso' },
          { id: 't2', name: '4ª fecha', date: '2026-09-08', status: 'en_proceso' },
        ],
      },
    };
    render(<LoginPage onEntro={vi.fn()} />);

    await screen.findByRole('option', { name: /3ª fecha/ });
    fireEvent.change(screen.getByLabelText('Torneo'), { target: { value: 't1' } });
    fireEvent.change(screen.getByLabelText('Patrulla'), { target: { value: 'patrulla3' } });

    // Que quede puesto es lo que hace que la aserción de abajo signifique algo:
    // un campo que nunca se llenó pasaría igual.
    expect((screen.getByLabelText('Patrulla') as HTMLInputElement).value).toBe('patrulla3');

    fireEvent.change(screen.getByLabelText('Torneo'), { target: { value: 't2' } });

    await waitFor(() => {
      expect((screen.getByLabelText('Patrulla') as HTMLInputElement).value).toBe('');
    });
  });
});
