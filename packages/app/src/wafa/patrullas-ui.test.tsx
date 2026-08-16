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

let alInicio: () => void;

function renderPatrullas() {
  alInicio = vi.fn();
  render(
    <MemoryRouter initialEntries={['/wafa/torneos/t1/patrullas']}>
      <Routes>
        <Route path="/wafa/torneos/:id/patrullas" element={<PatrolsPage onVolver={alInicio} />} />
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

    fireEvent.click(screen.getByRole('button', { name: 'Mover a Pérez a otra patrulla' }));
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

    // Se intercambian dos arqueros: quedan dos patrullas de 2 con las unidades
    // mezcladas de categoría. Viola el reglamento, pero se puede correr.
    fireEvent.click(screen.getByRole('button', { name: 'Mover a Ruiz a otra patrulla' }));
    fireEvent.click(screen.getByRole('button', { name: 'A la 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mover a Pérez a otra patrulla' }));
    fireEvent.click(screen.getByRole('button', { name: 'A la 2' }));

    const avisos = screen.getByTestId('violaciones');
    expect(avisos.textContent).toMatch(/Podés guardarlas igual; queda registrado/);
    expect(avisos.textContent).toMatch(/categorías distintas/);

    // Y el botón sigue habilitado: avisar no es impedir.
    expect(
      (screen.getByRole('button', { name: 'Guardar patrullas' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  /**
   * Un arquero solo no tiene quién le controle el puntaje: no es una excepción
   * que el admin pueda tomar, es un torneo que no se puede correr. A diferencia
   * de las violaciones de reglamento, el tamaño **sí** frena el guardado.
   */
  it('NO deja guardar una patrulla con un solo arquero, y dice cuál', async () => {
    renderPatrullas();
    await screen.findByTestId('patrulla-1');

    fireEvent.click(screen.getByRole('button', { name: 'Mover a Pérez a otra patrulla' }));
    fireEvent.click(screen.getByRole('button', { name: 'A la 2' }));

    expect(screen.getByText(/La patrulla 1 tiene un solo arquero/)).toBeDefined();
    expect(
      (screen.getByRole('button', { name: 'Guardar patrullas' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  /**
   * Los arqueros se suman **al final**, así que un movimiento suelto deja al
   * recién llegado solo en la unidad `B` y la `A` no se ensucia. Para mezclar una
   * unidad hace falta que caiga junto a otro: primero se vacía un lugar.
   */
  it('detecta una unidad con categorías mezcladas', async () => {
    renderPatrullas();
    await screen.findByTestId('patrulla-1');

    fireEvent.click(screen.getByRole('button', { name: 'Mover a Ruiz a otra patrulla' }));
    fireEvent.click(screen.getByRole('button', { name: 'A la 1' }));

    // Ahora la patrulla 2 tiene sólo a Díaz (longbow): Pérez (razo) cae al lado.
    fireEvent.click(screen.getByRole('button', { name: 'Mover a Pérez a otra patrulla' }));
    fireEvent.click(screen.getByRole('button', { name: 'A la 2' }));

    expect(screen.getByTestId('violaciones').textContent).toMatch(/unidad A.*categorías distintas/);
  });

  it('NO deja guardar una patrulla de más de 4: el servidor la rechazaría', async () => {
    renderPatrullas();
    await screen.findByTestId('patrulla-1');

    for (const apellido of ['Díaz', 'Ruiz']) {
      fireEvent.click(screen.getByRole('button', { name: `Mover a ${apellido} a otra patrulla` }));
      fireEvent.click(screen.getByRole('button', { name: 'A la 1' }));
    }

    // Cuatro entran; el quinto no existe, así que se prueba con el tope justo:
    // 4 es válido y el aviso de tope no aparece.
    expect(screen.queryByText(/El máximo es 4/)).toBeNull();

    /**
     * La 2 quedó vacía, y desde `REF2-5` **eso frena el guardado**: antes se
     * mandaba igual y la patrulla desaparecía en silencio, dejando una
     * numeración con huecos. Se elimina, que es lo que renumera al resto.
     */
    expect(screen.getByTestId('patrulla-vacia')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar la patrulla 2' }));

    expect(
      (screen.getByRole('button', { name: 'Guardar patrullas' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  /**
   * El bug que motivó `REF-1`: mover un 5º arquero a una patrulla llena lo
   * movía **y lo perdía**. `unidadesDe` recortaba en cuatro, así que el
   * arquero desaparecía de la pantalla y del cuerpo del `PUT` sin aviso.
   */
  describe('un quinto arquero', () => {
    beforeEach(() => {
      const cuatro = [
        miembro('a', 'Pérez'),
        { ...miembro('b', 'Gómez'), position: 'derecha' },
        miembro('c', 'Díaz'),
        { ...miembro('d', 'Ruiz'), position: 'derecha' },
      ];

      rutas['GET /api/admin/tournaments/t1/patrols'] = () => ({
        json: {
          patrols: [
            { ...PATRULLAS[0], members: cuatro },
            { ...PATRULLAS[1], members: [miembro('e', 'Sosa')] },
          ],
          violations: [],
        },
      });
    });

    const moverSosaALaUno = () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mover a Sosa a otra patrulla' }));
      fireEvent.click(screen.getByRole('button', { name: 'A la 1' }));
    };

    it('queda A LA VISTA en la patrulla destino, no desaparece', async () => {
      renderPatrullas();
      await screen.findByTestId('patrulla-1');

      moverSosaALaUno();

      expect(screen.getByTestId('patrulla-1').textContent).toMatch(/Sosa/);
      expect(screen.getByTestId('patrulla-2').textContent).not.toMatch(/Sosa/);
    });

    it('bloquea el guardado y dice cuál es el tope', async () => {
      renderPatrullas();
      await screen.findByTestId('patrulla-1');

      moverSosaALaUno();

      expect(screen.getByText(/La patrulla 1 tiene 5 arqueros. El máximo es 4./)).toBeDefined();
      expect(
        (screen.getByRole('button', { name: 'Guardar patrullas' }) as HTMLButtonElement).disabled,
      ).toBe(true);
    });
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
          // Con el id: es lo que identifica la patrulla desde REF3-1.
          {
            id: 'x1',
            number: 1,
            startTargetIndex: 1,
            units: [{ label: 'A', members: ['a', 'b'] }],
          },
          {
            id: 'x2',
            number: 2,
            startTargetIndex: 3,
            units: [{ label: 'A', members: ['c', 'd'] }],
          },
        ],
      });
    });

    expect(await screen.findByText('Patrullas guardadas.')).toBeDefined();
  });

  /**
   * Imprimir un borrador sin guardar produce una planilla que no coincide con
   * lo que el servidor tiene. En el monte, esa planilla es la única fuente de
   * verdad en papel: no puede decir algo distinto de lo que la app va a mandar.
   */
  describe('imprimir', () => {
    const botonImprimir = () =>
      screen.getByRole('button', { name: 'Imprimir' }) as HTMLButtonElement;

    it('está habilitado mientras no se haya tocado nada', async () => {
      renderPatrullas();
      await screen.findByTestId('patrulla-1');

      expect(botonImprimir().disabled).toBe(false);
    });

    it('se deshabilita en cuanto hay un cambio sin guardar', async () => {
      renderPatrullas();
      await screen.findByTestId('patrulla-1');

      fireEvent.click(screen.getByRole('button', { name: 'Mover a Díaz a otra patrulla' }));
      fireEvent.click(screen.getByRole('button', { name: 'A la 1' }));

      expect(botonImprimir().disabled).toBe(true);
      expect(screen.getByText(/Guardá los cambios antes de imprimir/)).toBeDefined();
    });

    it('cambiar el blanco de inicio también cuenta como cambio', async () => {
      renderPatrullas();
      await screen.findByTestId('patrulla-1');

      fireEvent.change(screen.getByLabelText('Blanco de inicio de la patrulla 1'), {
        target: { value: '4' },
      });

      expect(botonImprimir().disabled).toBe(true);
    });

    it('vuelve a habilitarse después de guardar', async () => {
      rutas['PUT /api/admin/tournaments/t1/patrols'] = () => ({
        json: { patrols: PATRULLAS, violations: [] },
      });
      renderPatrullas();
      await screen.findByTestId('patrulla-1');

      // Las dos, no una: dejar la patrulla 2 con un solo arquero bloquearía el
      // guardado y el test verificaría lo que no quiere verificar. Y al quedar
      // vacía hay que eliminarla, que desde `REF2-5` es lo que renumera.
      for (const apellido of ['Díaz', 'Ruiz']) {
        fireEvent.click(
          screen.getByRole('button', { name: `Mover a ${apellido} a otra patrulla` }),
        );
        fireEvent.click(screen.getByRole('button', { name: 'A la 1' }));
      }
      fireEvent.click(screen.getByRole('button', { name: 'Eliminar la patrulla 2' }));
      expect(botonImprimir().disabled).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'Guardar patrullas' }));

      await waitFor(() => expect(botonImprimir().disabled).toBe(false));
    });
  });

  describe('después de guardar', () => {
    beforeEach(() => {
      rutas['PUT /api/admin/tournaments/t1/patrols'] = () => ({
        json: { patrols: PATRULLAS, violations: [] },
      });
    });

    const guardar = async () => {
      renderPatrullas();
      await screen.findByTestId('patrulla-1');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar patrullas' }));
      return screen.findByText('Patrullas guardadas.');
    };

    // Arriba de todo, en una pantalla con cinco patrullas, el aviso queda fuera
    // de cuadro: se confirma algo que el admin no llega a ver.
    it('el aviso aparece junto a los botones, no arriba de todo', async () => {
      const aviso = await guardar();
      expect(screen.getByTestId('barra-acciones').contains(aviso)).toBe(true);
    });

    it('ofrece volver al inicio', async () => {
      await guardar();

      fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }));
      expect(alInicio).toHaveBeenCalled();
    });

    it('el botón de volver NO está antes de guardar', async () => {
      renderPatrullas();
      await screen.findByTestId('patrulla-1');

      expect(screen.queryByRole('button', { name: 'Volver al inicio' })).toBeNull();
    });
  });

  it('si el servidor rechaza, lo dice y no se pierde lo editado', async () => {
    rutas['PUT /api/admin/tournaments/t1/patrols'] = () => ({
      status: 400,
      json: { error: { code: 'VALIDATION_ERROR', message: 'Faltan arqueros en la distribución.' } },
    });
    renderPatrullas();
    await screen.findByTestId('patrulla-1');

    // Las dos de la patrulla 2 pasan a la 1 y la vacía se elimina: queda una
    // sola de cuatro, que es un borrador guardable. Mover uno solo dejaría una
    // de 1 y frenaría acá, y dejar la vacía también — desde `REF2-5`.
    for (const apellido of ['Díaz', 'Ruiz']) {
      fireEvent.click(screen.getByRole('button', { name: `Mover a ${apellido} a otra patrulla` }));
      fireEvent.click(screen.getByRole('button', { name: 'A la 1' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar la patrulla 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar patrullas' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Faltan arqueros');
    expect(screen.getByTestId('patrulla-1').textContent).toMatch(/Díaz/);
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
    expect(screen.queryByRole('button', { name: 'Mover a Pérez a otra patrulla' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Guardar patrullas' })).toBeNull();
  });

  it('las credenciales se siguen viendo: el líder puede necesitarlas', async () => {
    renderPatrullas();
    expect(await screen.findByTestId('pin-1')).toHaveTextContent('481902');
  });
});

// ── REF2-5 · Orden dentro de la patrulla y patrullas vacías ──────────────────

describe('ordenar dentro de la patrulla', () => {
  /**
   * **El orden decide quién tira primero.** Los dos primeros son la unidad `A`
   * y la `A` tira antes, así que esto no es acomodar una lista.
   */
  it('subir a un arquero lo adelanta en la patrulla', async () => {
    renderPatrullas();
    await screen.findByTestId('patrulla-1');

    // Ruiz es el segundo de la patrulla 2, detrás de Díaz.
    const orden = () =>
      [...screen.getByTestId('patrulla-2').querySelectorAll('[data-testid^=miembro-]')].map((e) =>
        e.getAttribute('data-testid'),
      );

    const antes = orden();
    fireEvent.click(screen.getByRole('button', { name: 'Subir a Ruiz' }));

    expect(orden()).not.toEqual(antes);
    expect(orden()[0]).toBe('miembro-Ruiz');
  });

  /**
   * En los extremos el botón está **apagado**, no ignorado. Un botón que
   * parece activo y no hace nada es peor que uno apagado — es la misma lección
   * del teclado de scoring en `REF-6`.
   */
  it('el primero no puede subir y el último no puede bajar', async () => {
    renderPatrullas();
    await screen.findByTestId('patrulla-1');

    expect(
      (screen.getByRole('button', { name: 'Subir a Pérez' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Bajar a Ruiz' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('patrullas vacías', () => {
  it('una patrulla vacía avisa y frena el guardado', async () => {
    renderPatrullas();
    await screen.findByTestId('patrulla-1');

    for (const apellido of ['Díaz', 'Ruiz']) {
      fireEvent.click(screen.getByRole('button', { name: `Mover a ${apellido} a otra patrulla` }));
      fireEvent.click(screen.getByRole('button', { name: 'A la 1' }));
    }

    expect(screen.getByTestId('patrulla-vacia')).toBeDefined();
    expect(
      (screen.getByRole('button', { name: 'Guardar patrullas' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  // Con gente adentro no hay botón: eliminarla sacaría arqueros del torneo.
  it('sólo se puede eliminar la que está vacía', async () => {
    renderPatrullas();
    await screen.findByTestId('patrulla-1');

    expect(screen.queryByRole('button', { name: 'Eliminar la patrulla 1' })).toBeNull();
  });
});
