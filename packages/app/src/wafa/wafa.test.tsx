import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArchersPage } from './pages/Archers.js';
import { ChangePasswordPage, validarPassword } from './pages/ChangePassword.js';
import { HomePage, type TournamentRow } from './pages/Home.js';
import { SeasonsPage, validarTemporada } from './pages/Seasons.js';
import { WafaApp } from './WafaApp.js';

/**
 * WAFA: sesión, home, arqueros y temporadas (FE-9, FE-10, FE-12).
 *
 * El fetch se simula a nivel de red, no mockeando el `apiClient`: así los tests
 * también cubren que las pantallas peguen a la ruta correcta.
 */

// ── Servidor simulado ────────────────────────────────────────────────────────

type Manejador = (body: unknown) => { status?: number; json: unknown };

let rutas: Record<string, Manejador> = {};
let llamadas: { method: string; url: string; body: unknown }[] = [];

function servidor(nuevas: Record<string, Manejador>) {
  rutas = { ...rutas, ...nuevas };
}

function error(code: string, message: string, status = 400) {
  return { status, json: { error: { code, message } } };
}

beforeEach(() => {
  rutas = {};
  llamadas = [];

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

const ADMIN = { id: 'a1', username: 'admin', mustChangePassword: false };

/**
 * Se monta anidado bajo `/wafa/*` igual que en `App.tsx`: montarlo en la raíz
 * haría que las rutas internas no coincidan, y el test estaría probando un
 * árbol que en la app no existe.
 */
function renderWafa(entrada = '/wafa') {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route path="/wafa/*" element={<WafaApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── FE-9 · Sesión ────────────────────────────────────────────────────────────

describe('validarPassword', () => {
  it('exige 12 caracteres', () => {
    expect(validarPassword('viejo', 'corto123')).toMatch(/12 caracteres/);
    expect(validarPassword('viejo', 'a'.repeat(12))).toBeUndefined();
  });

  it('no deja repetir el actual', () => {
    const largo = 'password-largo-1';
    expect(validarPassword(largo, largo)).toMatch(/distinto/);
  });
});

describe('sesión de admin', () => {
  it('sin sesión muestra el login, no la home', async () => {
    servidor({ 'GET /api/auth/me': () => error('UNAUTHORIZED', 'Entrá primero.', 401) });
    renderWafa();

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeDefined();
    expect(screen.queryByText('Crear torneo')).toBeNull();
  });

  it('entra y muestra la home', async () => {
    servidor({
      'GET /api/auth/me': () => error('UNAUTHORIZED', 'Entrá primero.', 401),
      'GET /api/auth/csrf': () => ({ json: { csrfToken: 't' } }),
      'POST /api/auth/admin/login': () => ({ json: { admin: ADMIN } }),
      'GET /api/admin/tournaments': () => ({ json: { tournaments: [] } }),
    });
    renderWafa();

    fireEvent.change(await screen.findByLabelText('Usuario'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secreto' } });

    // La sesión se relee del servidor tras entrar: la home aparece porque
    // /auth/me ya responde, no porque el login haya devuelto un admin.
    servidor({ 'GET /api/auth/me': () => ({ json: { admin: ADMIN } }) });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Crear torneo')).toBeDefined();
  });

  it('muestra el motivo del rechazo tal cual lo manda el servidor', async () => {
    servidor({
      'GET /api/auth/me': () => error('UNAUTHORIZED', 'Entrá primero.', 401),
      'GET /api/auth/csrf': () => ({ json: { csrfToken: 't' } }),
      'POST /api/auth/admin/login': () =>
        error('RATE_LIMITED', 'Demasiados intentos fallidos. Probá de nuevo en un rato.', 429),
    });
    renderWafa();

    fireEvent.change(await screen.findByLabelText('Usuario'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Demasiados intentos/);
  });

  // El servidor ya lo bloquea; esto verifica que la interfaz no ofrezca puertas
  // que igual se van a cerrar en la cara.
  it('con mustChangePassword NO se puede llegar a ninguna otra pantalla', async () => {
    servidor({
      'GET /api/auth/me': () => ({ json: { admin: { ...ADMIN, mustChangePassword: true } } }),
      'GET /api/admin/tournaments': () => ({ json: { tournaments: [] } }),
    });

    // Se entra apuntando a Arqueros a propósito: ni así debería aparecer.
    renderWafa('/wafa/arqueros');

    expect(await screen.findByText('Cambiar password')).toBeDefined();
    expect(screen.queryByText('Arqueros')).toBeNull();
    expect(screen.queryByText('Crear torneo')).toBeNull();
    // Y no hay salida: ni cancelar, ni cerrar sesión.
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Salir' })).toBeNull();
  });

  it('después de cambiarlo, deja entrar', async () => {
    servidor({
      'GET /api/auth/me': () => ({ json: { admin: { ...ADMIN, mustChangePassword: true } } }),
      'GET /api/auth/csrf': () => ({ json: { csrfToken: 't' } }),
      'POST /api/auth/admin/password': () => ({ json: { ok: true } }),
      'GET /api/admin/tournaments': () => ({ json: { tournaments: [] } }),
    });
    renderWafa();

    fireEvent.change(await screen.findByLabelText('Password actual'), {
      target: { value: 'inicial-12345' },
    });
    fireEvent.change(screen.getByLabelText('Password nuevo'), {
      target: { value: 'un-password-nuevo' },
    });

    servidor({ 'GET /api/auth/me': () => ({ json: { admin: ADMIN } }) });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Crear torneo')).toBeDefined();
  });
});

describe('ChangePasswordPage', () => {
  it('no deja guardar un password corto', async () => {
    render(<ChangePasswordPage obligatorio onCambiado={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Password actual'), { target: { value: 'actual-123' } });
    fireEvent.change(screen.getByLabelText('Password nuevo'), { target: { value: 'corto' } });

    expect((screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByRole('alert').textContent).toMatch(/12 caracteres/);
  });
});

// ── FE-10 · Home ─────────────────────────────────────────────────────────────

describe('HomePage', () => {
  const torneo = (o: Partial<TournamentRow>): TournamentRow => ({
    id: 't1',
    name: 'Torneo',
    date: '2026-08-08',
    status: 'sin_iniciar',
    targetCount: 14,
    patrolCount: 4,
    participantCount: 16,
    maxPossibleScore: 400,
    ...o,
  });

  const renderHome = () =>
    render(
      <MemoryRouter>
        <HomePage onSalir={vi.fn()} />
      </MemoryRouter>,
    );

  it('pone el torneo en proceso PRIMERO, aunque venga último', async () => {
    // Si hay un torneo corriendo, es lo único que importa en ese momento.
    servidor({
      'GET /api/admin/tournaments': () => ({
        json: {
          tournaments: [
            torneo({ id: 'viejo', name: 'Publicado', status: 'publicado' }),
            torneo({ id: 'ahora', name: 'Corriendo', status: 'en_proceso' }),
          ],
        },
      }),
    });
    renderHome();

    await screen.findByTestId('torneo-ahora');
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titulos[0]).toBe('En proceso');

    const enlaces = screen.getAllByTestId(/^torneo-/).map((e) => e.getAttribute('data-testid'));
    expect(enlaces).toEqual(['torneo-ahora', 'torneo-viejo']);
  });

  it('cada grupo vacío explica que está vacío, no desaparece', async () => {
    servidor({
      'GET /api/admin/tournaments': () => ({
        json: { tournaments: [torneo({ status: 'sin_iniciar' })] },
      }),
    });
    renderHome();

    expect(await screen.findByText('No hay ningún torneo corriendo.')).toBeDefined();
  });

  it('sin torneos invita a crear el primero', async () => {
    servidor({ 'GET /api/admin/tournaments': () => ({ json: { tournaments: [] } }) });
    renderHome();

    expect(await screen.findByText(/Empezá creando uno/)).toBeDefined();
  });

  it('si falla la carga lo dice, no se queda en blanco', async () => {
    servidor({ 'GET /api/admin/tournaments': () => error('INTERNAL', 'boom', 500) });
    renderHome();

    expect(await screen.findByRole('alert')).toHaveTextContent(/Revisá la conexión/);
  });
});

// ── FE-12 · Arqueros ─────────────────────────────────────────────────────────

describe('ArchersPage', () => {
  const arquero = (o: Record<string, unknown> = {}) => ({
    id: 'x1',
    firstName: 'Juan',
    lastName: 'Pérez',
    category: 'razo',
    archived: false,
    participated: false,
    ...o,
  });

  const listar = (archers: unknown[]) => {
    servidor({ 'GET /api/admin/archers': () => ({ json: { archers } }) });
  };

  const renderArqueros = () => render(<ArchersPage onVolver={vi.fn()} />);

  it('lista el padrón', async () => {
    listar([arquero()]);
    renderArqueros();

    expect(await screen.findByTestId('arquero-Pérez')).toHaveTextContent('Pérez, Juan');
    expect(screen.getByTestId('arquero-Pérez')).toHaveTextContent('Razo');
  });

  // Distingue al que compite del que está anotado en el padrón y nada más.
  it('dice en cuántos torneos jugó cada uno', async () => {
    listar([
      arquero({ lastName: 'Pérez', tournamentCount: 3 }),
      arquero({ id: 'x2', lastName: 'Gómez', tournamentCount: 1 }),
      arquero({ id: 'x3', lastName: 'Díaz', tournamentCount: 0 }),
    ]);
    renderArqueros();

    expect(await screen.findByTestId('arquero-Pérez')).toHaveTextContent('3 torneos jugados');
    // En singular, no «1 torneos».
    expect(screen.getByTestId('arquero-Gómez')).toHaveTextContent('1 torneo jugado');
    expect(screen.getByTestId('arquero-Díaz')).toHaveTextContent('Todavía no jugó ningún torneo');
  });

  describe('filtro por categoría', () => {
    const padronMixto = () =>
      listar([
        arquero({ lastName: 'Pérez', category: 'razo' }),
        arquero({ id: 'x2', lastName: 'Gómez', category: 'longbow' }),
        arquero({ id: 'x3', lastName: 'Díaz', category: 'razo' }),
      ]);

    it('deja sólo los de la categoría elegida', async () => {
      padronMixto();
      renderArqueros();
      await screen.findByTestId('arquero-Pérez');

      fireEvent.change(screen.getByLabelText('Filtrar por categoría'), {
        target: { value: 'longbow' },
      });

      expect(screen.getByTestId('arquero-Gómez')).toBeDefined();
      expect(screen.queryByTestId('arquero-Pérez')).toBeNull();
      expect(screen.queryByTestId('arquero-Díaz')).toBeNull();
    });

    it('volver a «Todas» los muestra de nuevo', async () => {
      padronMixto();
      renderArqueros();
      await screen.findByTestId('arquero-Pérez');

      const filtro = screen.getByLabelText('Filtrar por categoría');
      fireEvent.change(filtro, { target: { value: 'longbow' } });
      fireEvent.change(filtro, { target: { value: '' } });

      expect(screen.getByTestId('arquero-Pérez')).toBeDefined();
      expect(screen.getByTestId('arquero-Díaz')).toBeDefined();
    });

    /**
     * El filtro es del cliente: el padrón ya está en memoria y filtrar de este
     * lado responde sin viaje. Si pidiera al servidor, cada cambio sería una
     * consulta — y la pantalla se usa justo mientras se arma un torneo.
     */
    it('NO vuelve a pedirle el padrón al servidor', async () => {
      padronMixto();
      renderArqueros();
      await screen.findByTestId('arquero-Pérez');

      const antes = llamadas.filter((l) => l.url.includes('/admin/archers')).length;
      fireEvent.change(screen.getByLabelText('Filtrar por categoría'), {
        target: { value: 'razo' },
      });

      expect(llamadas.filter((l) => l.url.includes('/admin/archers'))).toHaveLength(antes);
    });
  });

  // Un botón gris sin motivo es una pared, no una respuesta.
  it('quien participó no se puede eliminar, y la pantalla explica por qué', async () => {
    listar([arquero({ participated: true })]);
    renderArqueros();

    const eliminar = await screen.findByRole('button', { name: /^Eliminar a/ });
    expect((eliminar as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/no se puede eliminar sin romper su histórico/)).toBeDefined();
    // Y ofrece la alternativa que sí sirve.
    expect(screen.getByText(/Archivalo/)).toBeDefined();
  });

  it('quien no participó sí se puede eliminar', async () => {
    listar([arquero({ participated: false })]);
    renderArqueros();

    const eliminar = await screen.findByRole('button', { name: /^Eliminar a/ });
    expect((eliminar as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/no se puede eliminar/)).toBeNull();
  });

  it('archivar pega a la ruta de archivar y recarga', async () => {
    listar([arquero()]);
    servidor({
      'GET /api/auth/csrf': () => ({ json: { csrfToken: 't' } }),
      'POST /api/admin/archers/x1/archive': () => ({
        json: { archer: arquero({ archived: true }) },
      }),
    });
    renderArqueros();

    fireEvent.click(await screen.findByRole('button', { name: /^Archivar a/ }));

    await waitFor(() => {
      expect(llamadas.some((l) => l.url.endsWith('/archers/x1/archive'))).toBe(true);
    });
  });

  it('la búsqueda viaja al servidor, no se filtra en el cliente', async () => {
    listar([arquero()]);
    renderArqueros();
    await screen.findByTestId('arquero-Pérez');

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'gomez' } });

    // Filtrar en el cliente sólo encontraría lo que ya se descargó, y el padrón
    // viene topeado a 500.
    await waitFor(() => {
      expect(llamadas.some((l) => l.url.includes('q=gomez'))).toBe(true);
    });
  });

  it('ver archivados pide la lista de archivados', async () => {
    listar([arquero()]);
    renderArqueros();
    await screen.findByTestId('arquero-Pérez');

    fireEvent.click(screen.getByLabelText('Ver archivados'));

    await waitFor(() => {
      expect(llamadas.some((l) => l.url.includes('archived=true'))).toBe(true);
    });
  });

  it('un padrón vacío lo dice', async () => {
    listar([]);
    renderArqueros();

    expect(await screen.findByText('El padrón está vacío.')).toBeDefined();
  });

  it('crea un arquero', async () => {
    listar([]);
    servidor({
      'GET /api/auth/csrf': () => ({ json: { csrfToken: 't' } }),
      'POST /api/admin/archers': () => ({ status: 201, json: { archer: arquero() } }),
    });
    renderArqueros();

    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo arquero' }));
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Gómez' } });
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'longbow' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      const alta = llamadas.find((l) => l.method === 'POST' && l.url.endsWith('/admin/archers'));
      expect(alta?.body).toEqual({ firstName: 'Ana', lastName: 'Gómez', category: 'longbow' });
    });
  });

  it('editar manda PATCH al arquero, no crea uno nuevo', async () => {
    listar([arquero()]);
    servidor({
      'GET /api/auth/csrf': () => ({ json: { csrfToken: 't' } }),
      'PATCH /api/admin/archers/x1': () => ({ json: { archer: arquero() } }),
    });
    renderArqueros();

    fireEvent.click(await screen.findByRole('button', { name: /^Editar a/ }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Juan Carlos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(llamadas.some((l) => l.method === 'PATCH' && l.url.endsWith('/archers/x1'))).toBe(
        true,
      );
    });
    expect(llamadas.some((l) => l.method === 'POST' && l.url.endsWith('/admin/archers'))).toBe(
      false,
    );
  });
});

// ── FE-12 · Temporadas ───────────────────────────────────────────────────────

describe('validarTemporada', () => {
  it('rechaza que termine antes de empezar', () => {
    expect(validarTemporada('Liga 2026', '2026-12-01', '2026-01-01')).toMatch(/antes de empezar/);
  });

  it('rechaza que termine el mismo día', () => {
    expect(validarTemporada('Liga 2026', '2026-01-01', '2026-01-01')).toMatch(/antes de empezar/);
  });

  it('acepta un rango válido', () => {
    expect(validarTemporada('Liga 2026', '2026-01-01', '2026-12-31')).toBeUndefined();
  });
});

describe('SeasonsPage', () => {
  it('no deja crear una temporada que termina antes de empezar', async () => {
    servidor({ 'GET /api/admin/seasons': () => ({ json: { seasons: [] } }) });
    render(<SeasonsPage onVolver={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Liga 2026' } });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-01-01' } });

    expect((screen.getByRole('button', { name: 'Crear' }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    expect(llamadas.some((l) => l.method === 'POST')).toBe(false);
  });

  it('crea una temporada válida', async () => {
    servidor({
      'GET /api/admin/seasons': () => ({ json: { seasons: [] } }),
      'GET /api/auth/csrf': () => ({ json: { csrfToken: 't' } }),
      'POST /api/admin/seasons': () => ({ status: 201, json: { season: { id: 's1' } } }),
    });
    render(<SeasonsPage onVolver={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Liga 2026' } });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-12-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => {
      const alta = llamadas.find((l) => l.method === 'POST');
      expect(alta?.body).toEqual({
        name: 'Liga 2026',
        startsAt: '2026-01-01',
        endsAt: '2026-12-31',
      });
    });
  });

  it('lista las temporadas', async () => {
    servidor({
      'GET /api/admin/seasons': () => ({
        json: {
          seasons: [
            {
              id: 's1',
              name: 'Liga 2026',
              startsAt: '2026-01-01T00:00:00.000Z',
              endsAt: '2026-12-31T00:00:00.000Z',
              status: 'activa',
            },
          ],
        },
      }),
    });
    render(<SeasonsPage onVolver={vi.fn()} />);

    expect(await screen.findByTestId('temporada-s1')).toHaveTextContent('Liga 2026');
    // El año no se repite cuando las dos fechas son del mismo.
    expect(screen.getByTestId('temporada-s1')).toHaveTextContent(
      '1 de enero — 31 de diciembre de 2026',
    );
  });

  /**
   * Cerrar una temporada **no borra ni congela nada**: los torneos publicados
   * siguen contando para su ranking. Es una marca para saber cuál está en curso
   * cuando hay varias, que es el caso normal a fin de año.
   */
  describe('cerrar y reabrir', () => {
    const conEstado = (status: string) => {
      servidor({
        'GET /api/admin/seasons': () => ({
          json: {
            seasons: [
              {
                id: 's1',
                name: 'Liga 2026',
                startsAt: '2026-01-01T00:00:00.000Z',
                endsAt: '2026-12-31T00:00:00.000Z',
                status,
              },
            ],
          },
        }),
        'POST /api/admin/seasons/s1/archive': () => ({ json: { season: { status: 'cerrada' } } }),
        'POST /api/admin/seasons/s1/restore': () => ({ json: { season: { status: 'activa' } } }),
      });
      render(<SeasonsPage onVolver={vi.fn()} />);
    };

    it('muestra el estado escrito, no sólo con un color', async () => {
      conEstado('cerrada');
      expect(await screen.findByTestId('temporada-s1')).toHaveTextContent('Cerrada');
    });

    it('cierra una activa', async () => {
      conEstado('activa');
      fireEvent.click(await screen.findByRole('button', { name: 'Cerrar' }));

      await waitFor(() => {
        expect(llamadas.some((l) => l.url.endsWith('/seasons/s1/archive'))).toBe(true);
      });
    });

    it('reabre una cerrada', async () => {
      conEstado('cerrada');
      fireEvent.click(await screen.findByRole('button', { name: 'Reabrir' }));

      await waitFor(() => {
        expect(llamadas.some((l) => l.url.endsWith('/seasons/s1/restore'))).toBe(true);
      });
    });
  });
});
