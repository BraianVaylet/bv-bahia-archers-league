import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishPage } from './pages/Publish.js';
import { TournamentPage } from './pages/Tournament.js';

/**
 * Detalle, seguimiento y publicación (FE-14 y FE-15).
 *
 * La lógica se prueba en `torneo.test.ts`; acá, que las pantallas la usen.
 */

const TORNEO = {
  id: 't1',
  name: '3ª fecha',
  date: '2026-08-08',
  status: 'en_proceso',
  targets: [1, 2, 3, 4].map((index) => ({ index, modality: 'sala', arrows: 3 })),
  maxPossibleScore: 120,
  participantCount: 4,
};

const participante = (o: Record<string, unknown> = {}) => ({
  id: 'x1',
  participantId: 'x1',
  archerId: 'a1',
  firstName: 'Juan',
  lastName: 'Pérez',
  category: 'razo',
  stake: 'azul',
  patrolNumber: 1,
  total: 100,
  normalizedPct: 83.33,
  innerCount: 5,
  tenCount: 8,
  mCount: 1,
  targetsCompleted: 4,
  status: 'activo',
  signed: true,
  signatureUnlocked: false,
  ...o,
});

const PATRULLAS = [
  { id: 'y1', number: 1, status: 'en_curso', targetsCompleted: 2, members: [] },
  { id: 'y2', number: 2, status: 'en_curso', targetsCompleted: 4, members: [] },
];

type Manejador = (body: unknown) => { status?: number; json: unknown };

let rutas: Record<string, Manejador>;
let llamadas: { method: string; url: string; body: unknown }[];

function servidor(nuevas: Record<string, Manejador>) {
  rutas = { ...rutas, ...nuevas };
}

beforeEach(() => {
  llamadas = [];
  rutas = {
    'GET /api/admin/tournaments/t1': () => ({ json: { tournament: TORNEO } }),
    'GET /api/admin/tournaments/t1/patrols': () => ({ json: { patrols: PATRULLAS } }),
    'GET /api/admin/tournaments/t1/results': () => ({
      json: {
        maxPossibleScore: 120,
        participants: [
          participante(),
          participante({ id: 'x2', lastName: 'Gómez', total: 90, patrolNumber: 1, signed: false }),
        ],
      },
    }),
    'GET /api/admin/tournaments/t1/locked-targets': () => ({ json: { lockedTargets: [1, 2] } }),
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

function renderPantalla(
  Componente: typeof TournamentPage | typeof PublishPage,
  ruta = '/wafa/torneos/t1',
) {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/wafa/torneos/:id" element={<Componente onVolver={vi.fn()} />} />
        <Route path="/wafa/torneos/:id/publicar" element={<Componente onVolver={vi.fn()} />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── FE-14 · Detalle y seguimiento ────────────────────────────────────────────

describe('TournamentPage', () => {
  it('muestra el estado, la fecha y el máximo', async () => {
    renderPantalla(TournamentPage);

    // La fecha se escribe, no se muestra el ISO crudo. Y es el 8: la API la
    // manda como medianoche UTC, y formatearla en hora local daría el 7.
    expect(await screen.findByTestId('estado')).toHaveTextContent(
      'En proceso · 8 de agosto de 2026 · 4 arqueros · máximo 120',
    );
  });

  it('muestra el avance de cada patrulla', async () => {
    renderPantalla(TournamentPage);

    expect(await screen.findByTestId('avance-1')).toHaveTextContent('2 de 4 blancos');
    expect(screen.getByTestId('avance-2')).toHaveTextContent('4 de 4 blancos');

    const barra = screen.getAllByRole('progressbar')[0] as HTMLElement;
    expect(barra.getAttribute('aria-valuenow')).toBe('50');
  });

  it('dice quién falta firmar en cada patrulla', async () => {
    renderPantalla(TournamentPage);

    expect(await screen.findByText(/Falta la firma de Gómez/)).toBeDefined();
    expect(screen.getByTestId('avance-2')).toHaveTextContent('Todos firmaron.');
  });

  // Un blanco gris sin explicación parece un error de la app.
  it('un blanco con puntajes aparece bloqueado, con el motivo', async () => {
    renderPantalla(TournamentPage);

    expect(await screen.findByTestId('blanco-1')).toHaveTextContent(/Ya tiene puntajes cargados/);
    expect(screen.getByTestId('blanco-3')).not.toHaveTextContent(/Ya tiene puntajes/);
  });

  it('desbloquear una firma exige un motivo y lo manda al servidor', async () => {
    servidor({
      'POST /api/admin/participants/x2/signature/unlock': () => ({ json: { ok: true } }),
    });
    renderPantalla(TournamentPage);

    fireEvent.click(await screen.findByRole('button', { name: 'Desbloquear firma' }));

    const confirmar = screen.getByRole('button', { name: 'Desbloquear' });
    // Sin motivo no se puede: es lo que queda en el audit log.
    expect((confirmar as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/Por qué Gómez no firma/), {
      target: { value: 'Se fue antes de cerrar el circuito.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Desbloquear' }));

    await waitFor(() => {
      const post = llamadas.find((l) => l.url.includes('signature/unlock'));
      expect(post?.body).toEqual({ reason: 'Se fue antes de cerrar el circuito.' });
    });
  });

  it('sin iniciar ofrece iniciar, y no muestra avance todavía', async () => {
    servidor({
      'GET /api/admin/tournaments/t1': () => ({
        json: { tournament: { ...TORNEO, status: 'sin_iniciar' } },
      }),
    });
    renderPantalla(TournamentPage);

    expect(await screen.findByRole('button', { name: 'Iniciar torneo' })).toBeDefined();
    expect(screen.queryByTestId('avance-1')).toBeNull();
  });

  it('iniciado el torneo, ya no se ofrece iniciarlo de nuevo', async () => {
    renderPantalla(TournamentPage);

    await screen.findByTestId('estado');
    expect(screen.queryByRole('button', { name: 'Iniciar torneo' })).toBeNull();
  });

  it('completado, ofrece revisar y publicar', async () => {
    servidor({
      'GET /api/admin/tournaments/t1': () => ({
        json: { tournament: { ...TORNEO, status: 'completado' } },
      }),
    });
    renderPantalla(TournamentPage);

    expect(await screen.findByText('Revisar y publicar')).toBeDefined();
    // Y ya no se pueden desbloquear firmas: el torneo cerró.
    expect(screen.queryByRole('button', { name: 'Desbloquear firma' })).toBeNull();
  });
});

// ── FE-15 · Publicar ─────────────────────────────────────────────────────────

describe('PublishPage', () => {
  const completado = () => {
    servidor({
      'GET /api/admin/tournaments/t1': () => ({
        json: { tournament: { ...TORNEO, status: 'completado' } },
      }),
    });
  };

  it('muestra el podio con los puntos de liga que se aplicarían', async () => {
    completado();
    renderPantalla(PublishPage, '/wafa/torneos/t1/publicar');

    const podio = await screen.findByTestId('podio-razo');
    expect(podio).toHaveTextContent('Pérez');
    expect(podio).toHaveTextContent('+5');
    expect(podio).toHaveTextContent('+4');
  });

  it('resume cuántos arqueros sumarían puntos', async () => {
    completado();
    renderPantalla(PublishPage, '/wafa/torneos/t1/publicar');

    expect(await screen.findByTestId('resumen-puntos')).toHaveTextContent(
      '2 arqueros suman puntos',
    );
  });

  it('un torneo en proceso NO se puede publicar, y lo explica', async () => {
    renderPantalla(PublishPage, '/wafa/torneos/t1/publicar');

    expect(await screen.findByRole('alert')).toHaveTextContent(/todas las patrullas cerradas/);
    expect((screen.getByRole('button', { name: 'Publicar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('avisa de las firmas desbloqueadas sin frenar la publicación', async () => {
    completado();
    servidor({
      'GET /api/admin/tournaments/t1/results': () => ({
        json: {
          maxPossibleScore: 120,
          participants: [participante({ signatureUnlocked: true }), participante({ id: 'x2' })],
        },
      }),
    });
    renderPantalla(PublishPage, '/wafa/torneos/t1/publicar');

    /*
      Se espera **el texto** del aviso, no un rol.

      Antes esto era `findByRole('status')`, que asumía una sola región
      anunciada en la pantalla. Desde que el header tiene el indicador de
      conexión —que también es un `status`, y con razón: su cambio tiene que
      anunciarse— esa suposición dejó de valer, y peor: `findBy*` se resuelve
      con el primero que aparezca, así que el indicador satisfacía la espera y
      el test dejaba de aguardar al aviso.

      Esperar el contenido y después verificar que esté dentro de una región
      anunciada prueba las dos cosas sin depender de cuántas haya.
    */
    const aviso = await screen.findByText(/firmas desbloqueadas/);
    expect(aviso.closest('[role="status"]')).not.toBeNull();
    expect((screen.getByRole('button', { name: 'Publicar' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  // Publicar aplica los resultados a la liga: no puede pasar de un toque.
  it('publicar pide una confirmación aparte', async () => {
    completado();
    servidor({
      'POST /api/admin/tournaments/t1/publish': () => ({ json: { standingsUpdated: 2 } }),
    });
    renderPantalla(PublishPage, '/wafa/torneos/t1/publicar');

    fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }));

    expect(llamadas.some((l) => l.method === 'POST')).toBe(false);
    expect(screen.getByText(/Se aplican los resultados a la liga/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Sí, publicar' }));

    await waitFor(() => {
      expect(llamadas.some((l) => l.url.endsWith('/publish'))).toBe(true);
    });
  });

  it('se puede cancelar la confirmación', async () => {
    completado();
    renderPantalla(PublishPage, '/wafa/torneos/t1/publicar');

    fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByRole('button', { name: 'Publicar' })).toBeDefined();
    expect(llamadas.some((l) => l.method === 'POST')).toBe(false);
  });

  it('publicado, ofrece despublicar y dice exactamente qué revierte', async () => {
    servidor({
      'GET /api/admin/tournaments/t1': () => ({
        json: { tournament: { ...TORNEO, status: 'publicado' } },
      }),
    });
    renderPantalla(PublishPage, '/wafa/torneos/t1/publicar');

    fireEvent.click(await screen.findByRole('button', { name: 'Despublicar' }));

    // No un "¿estás seguro?" genérico: qué pasa exactamente.
    expect(screen.getByText(/se recalculan/)).toBeDefined();
    expect(screen.getByText(/no se borran/)).toBeDefined();
  });

  it('despublicar exige un motivo', async () => {
    servidor({
      'GET /api/admin/tournaments/t1': () => ({
        json: { tournament: { ...TORNEO, status: 'publicado' } },
      }),
      'POST /api/admin/tournaments/t1/unpublish': () => ({ json: { ok: true } }),
    });
    renderPantalla(PublishPage, '/wafa/torneos/t1/publicar');

    fireEvent.click(await screen.findByRole('button', { name: 'Despublicar' }));

    const confirmar = screen.getAllByRole('button', {
      name: 'Despublicar',
    })[0] as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Por qué lo despublicás'), {
      target: { value: 'Se cargó mal un puntaje.' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Despublicar' })[0] as HTMLElement);

    await waitFor(() => {
      const post = llamadas.find((l) => l.url.endsWith('/unpublish'));
      expect(post?.body).toEqual({ reason: 'Se cargó mal un puntaje.' });
    });
  });

  it('si el servidor rechaza publicar, lo dice', async () => {
    completado();
    servidor({
      'POST /api/admin/tournaments/t1/publish': () => ({
        status: 409,
        json: {
          error: {
            code: 'INVALID_STATE_TRANSITION',
            message: 'Sólo se puede publicar un torneo completado.',
          },
        },
      }),
    });
    renderPantalla(PublishPage, '/wafa/torneos/t1/publicar');

    fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, publicar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sólo se puede publicar un torneo completado.',
    );
  });
});

// ── REF-5 · Editar y eliminar un torneo sin iniciar ──────────────────────────

/**
 * Sólo mientras nadie tiró. Una vez iniciado, el recorrido está descargado en
 * los celulares de los líderes y cambiarlo dejaría la app y el papel diciendo
 * cosas distintas.
 */
describe('editar y eliminar el torneo', () => {
  const sinIniciar = () => {
    servidor({
      'GET /api/admin/tournaments/t1': () => ({
        json: { tournament: { ...TORNEO, status: 'sin_iniciar' } },
      }),
    });
    renderPantalla(TournamentPage);
  };

  it('con el torneo en proceso NO ofrece ni editar ni eliminar', async () => {
    renderPantalla(TournamentPage);
    await screen.findByTestId('estado');

    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).toBeNull();
  });

  it('editar abre el formulario con lo que ya tiene cargado', async () => {
    sinIniciar();

    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));

    expect(screen.getByTestId('editar-torneo')).toBeDefined();
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe(TORNEO.name);
  });

  it('guardar manda PATCH y recarga', async () => {
    sinIniciar();
    servidor({ 'PATCH /api/admin/tournaments/t1': () => ({ json: { tournament: TORNEO } }) });

    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nombre nuevo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      const patch = llamadas.find((l) => l.method === 'PATCH');
      expect(patch?.body).toMatchObject({ name: 'Nombre nuevo' });
    });
  });

  /**
   * Borrar pide dos toques sobre el mismo botón. Sin `confirm()` —bloquea el
   * hilo y en un celular saca del contexto— ni modal, que taparía la pantalla.
   */
  it('el primer toque en Eliminar NO borra: avisa qué se va a perder', async () => {
    sinIniciar();

    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));

    expect(llamadas.some((l) => l.method === 'DELETE')).toBe(false);
    expect(screen.getByText(/Tocá de nuevo para confirmar/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Confirmar borrado' })).toBeDefined();
  });

  it('el segundo toque sí borra', async () => {
    sinIniciar();
    servidor({ 'DELETE /api/admin/tournaments/t1': () => ({ json: { ok: true } }) });

    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar borrado' }));

    await waitFor(() => {
      expect(llamadas.some((l) => l.method === 'DELETE')).toBe(true);
    });
  });
});

// ── REF2-5 · Iniciar y volver atrás ──────────────────────────────────────────

describe('iniciar el torneo', () => {
  /**
   * **Iniciar pide confirmación.** A partir de ahí las patrullas quedan
   * congeladas y los líderes bajan el recorrido al celular. Dos toques sobre el
   * mismo botón, igual que eliminar: sin `confirm()` ni modal.
   */
  it('el primer toque no inicia: pregunta', async () => {
    servidor({
      'GET /api/admin/tournaments/t1': () => ({
        json: { tournament: { ...TORNEO, status: 'sin_iniciar' } },
      }),
    });
    renderPantalla(TournamentPage);

    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar torneo' }));

    expect(screen.getByText(/¿Iniciar el torneo\?/)).toBeDefined();
    expect(llamadas.find((l) => l.url.includes('/start'))).toBeUndefined();
  });

  it('el segundo toque lo inicia', async () => {
    servidor({
      'GET /api/admin/tournaments/t1': () => ({
        json: { tournament: { ...TORNEO, status: 'sin_iniciar' } },
      }),
      'POST /api/admin/tournaments/t1/start': () => ({
        json: { tournament: { id: 't1', status: 'en_proceso' } },
      }),
    });
    renderPantalla(TournamentPage);

    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar torneo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, iniciar' }));

    await waitFor(() => {
      expect(llamadas.find((l) => l.url.includes('/start'))).toBeDefined();
    });
  });
});

describe('volver a sin iniciar', () => {
  it('un torneo en proceso ofrece volver atrás', async () => {
    servidor({
      'GET /api/admin/tournaments/t1': () => ({
        json: { tournament: { ...TORNEO, status: 'en_proceso' } },
      }),
      'POST /api/admin/tournaments/t1/unstart': () => ({
        json: { tournament: { id: 't1', status: 'sin_iniciar' } },
      }),
    });
    renderPantalla(TournamentPage);

    fireEvent.click(await screen.findByRole('button', { name: 'Volver a sin iniciar' }));

    await waitFor(() => {
      expect(llamadas.find((l) => l.url.includes('/unstart'))).toBeDefined();
    });
  });

  /**
   * **La guarda es del servidor.** Si ya hay puntajes cargados, la pantalla no
   * lo adivina: pide, y muestra lo que conteste. Una pantalla que decide sola
   * puede estar mirando datos de hace un minuto.
   */
  it('si el servidor dice que no, muestra el motivo', async () => {
    servidor({
      'GET /api/admin/tournaments/t1': () => ({
        json: { tournament: { ...TORNEO, status: 'en_proceso' } },
      }),
      'POST /api/admin/tournaments/t1/unstart': () => ({
        status: 409,
        json: {
          error: {
            code: 'TOURNAMENT_HAS_SCORES',
            message: 'Ya hay 3 puntajes cargados: el torneo no puede volver a sin iniciar.',
          },
        },
      }),
    });
    renderPantalla(TournamentPage);

    fireEvent.click(await screen.findByRole('button', { name: 'Volver a sin iniciar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/3 puntajes cargados/);
  });

  it('un torneo sin iniciar no ofrece volver atrás', async () => {
    servidor({
      'GET /api/admin/tournaments/t1': () => ({
        json: { tournament: { ...TORNEO, status: 'sin_iniciar' } },
      }),
    });
    renderPantalla(TournamentPage);

    await screen.findByRole('button', { name: 'Iniciar torneo' });
    expect(screen.queryByRole('button', { name: 'Volver a sin iniciar' })).toBeNull();
  });
});
