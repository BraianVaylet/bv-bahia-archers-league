import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteDb, readScore, type StoredBundle, saveBundle } from '../offline/db.js';
import { configureSync, resetSyncWorker } from '../offline/syncWorker.js';
import { disposicionPara, ScoreKeypad, TAMAÑO_TECLA_PX } from './ScoreKeypad.js';
import { TargetPage } from './TargetPage.js';

/**
 * Teclado de scoring y página de blanco (FE-6).
 *
 * Se usa con guantes, al sol, caminando. Los objetivos táctiles de 56px son un
 * requisito funcional, no un detalle estético. Ver docs/DESIGN_SYSTEM.md §5.
 */

const P1 = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const P2 = 'aaaaaaaaaaaaaaaaaaaaaaa2';

const participantes = [
  {
    id: P1,
    firstName: 'Juan',
    lastName: 'Pérez',
    category: 'razo',
    stake: 'azul',
    unit: 'A',
    position: 'izquierda',
  },
  {
    id: P2,
    firstName: 'Ana',
    lastName: 'Gómez',
    category: 'razo',
    stake: 'azul',
    unit: 'A',
    position: 'derecha',
  },
];

const bundle: StoredBundle = {
  tournament: {
    id: 't1',
    name: 'Torneo',
    date: '2026-08-08',
    maxPossibleScore: 52,
    targets: [
      { index: 1, modality: '3d', arrows: 2, description: 'Jabalí' },
      { index: 2, modality: 'sala', arrows: 3, description: null },
    ],
  },
  patrol: { id: 'p1', number: 1, startTargetIndex: 1, status: 'en_curso', targetsCompleted: 0 },
  participants: participantes,
  fetchedAt: Date.now(),
  clockSkewMs: 0,
};

beforeEach(async () => {
  resetSyncWorker();
  /**
   * Esta suite es del teclado, no de la red.
   *
   * El transporte **nunca resuelve**: así el vaciado del outbox queda parado y
   * no escribe intentos ni programa reintentos mientras el test toca botones.
   * Con uno que rechaza, esas escrituras corren contra la cola del componente y
   * dos tests se vuelven intermitentes.
   */
  configureSync({ post: () => new Promise(() => {}) });
  await deleteDb();
  await saveBundle(bundle);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Teclado ──────────────────────────────────────────────────────────────────

describe('ScoreKeypad', () => {
  const render3d = (props: Partial<Parameters<typeof ScoreKeypad>[0]> = {}) =>
    render(<ScoreKeypad modality="3d" cargadas={0} total={2} onToken={() => {}} {...props} />);

  it('ofrece los tokens de la modalidad DEL BLANCO', () => {
    render3d();

    for (const token of ['11', '10', '8', '5', 'M']) {
      expect(screen.getByRole('button', { name: new RegExp(token) })).toBeDefined();
    }
    // La X es de sala y aire libre: acá no existe.
    expect(screen.queryByRole('button', { name: /Puntaje X$/ })).toBeNull();
  });

  it('un blanco de sala ofrece X y los doce tokens', () => {
    render(<ScoreKeypad modality="sala" cargadas={0} total={3} onToken={() => {}} />);

    expect(screen.getByRole('button', { name: 'Puntaje X' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Puntaje 11' })).toBeNull();
  });

  // Requisito funcional: es lo que hace falta para acertar con guante de tiro.
  // El 56 va literal a propósito: comparar contra la constante haría que bajarla
  // cambie los dos lados de la aserción y el test no protegería nada.
  it('TODAS las teclas miden al menos 56px', () => {
    render3d();

    const teclas = within(screen.getByTestId('score-keypad')).getAllByRole('button');
    expect(teclas.length).toBeGreaterThan(0);

    for (const tecla of teclas) {
      const estilo = (tecla as HTMLElement).style;
      expect(Number.parseInt(estilo.minWidth, 10)).toBeGreaterThanOrEqual(56);
      expect(Number.parseInt(estilo.minHeight, 10)).toBeGreaterThanOrEqual(56);
    }
  });

  it('la constante del design system no bajó de 56', () => {
    expect(TAMAÑO_TECLA_PX).toBeGreaterThanOrEqual(56);
  });

  it('avisa el token al tocarlo', () => {
    const onToken = vi.fn();
    render3d({ onToken });

    fireEvent.click(screen.getByRole('button', { name: 'Puntaje 11' }));
    expect(onToken).toHaveBeenCalledWith('11');
  });

  it('se deshabilita al completar las flechas del blanco', () => {
    const onToken = vi.fn();
    render3d({ cargadas: 2, onToken });

    // Las teclas quedan deshabilitadas de verdad, no sólo ignoradas: un botón
    // que parece activo y no hace nada es peor que uno apagado.
    const teclas = within(screen.getByTestId('score-keypad')).getAllByRole('button');
    for (const tecla of teclas) {
      expect((tecla as HTMLButtonElement).disabled).toBe(true);
    }

    fireEvent.click(screen.getByRole('button', { name: 'Puntaje 11' }));
    expect(onToken).not.toHaveBeenCalled();
    expect(screen.getByText(/Ya cargaste las 2 flechas/)).toBeDefined();
  });

  it('la M se anuncia como flecha sin puntaje, no como una letra suelta', () => {
    render3d();
    expect(screen.getByRole('button', { name: 'Miss, flecha sin puntaje' })).toBeDefined();
  });

  it('usa feedback háptico donde exista', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });

    render3d();
    fireEvent.click(screen.getByRole('button', { name: 'Puntaje 11' }));

    expect(vibrate).toHaveBeenCalled();
  });

  describe('disposición', () => {
    // 3D y campo mapean 1:1 con los anillos de la cara real. Sala y aire libre
    // tienen doce tokens, que no caben en anillos legibles.
    it('elige arcos para 3D y campo, grilla para sala y aire libre', () => {
      expect(disposicionPara('3d')).toBe('arcos');
      expect(disposicionPara('campo')).toBe('arcos');
      expect(disposicionPara('sala')).toBe('grilla');
      expect(disposicionPara('aire_libre')).toBe('grilla');
    });

    // La disposición en arcos es una apuesta sin validar: si en la prueba de
    // campo no le gana a la grilla, se cambia con una prop.
    it('se puede forzar la grilla sin tocar el resto del componente', () => {
      render3d({ disposicion: 'grilla' });
      expect(screen.getByTestId('score-keypad').dataset.disposicion).toBe('grilla');

      cleanup();
      render3d({ disposicion: 'arcos' });
      expect(screen.getByTestId('score-keypad').dataset.disposicion).toBe('arcos');
    });

    it('en arcos siguen estando todos los tokens', () => {
      render3d({ disposicion: 'arcos' });
      const teclas = within(screen.getByTestId('score-keypad')).getAllByRole('button');
      expect(teclas).toHaveLength(5);
    });
  });
});

// ── Página de blanco ─────────────────────────────────────────────────────────

describe('TargetPage', () => {
  const renderPagina = (onContinuar = vi.fn()) => {
    const target = bundle.tournament.targets[0];
    if (!target) throw new Error('falta el blanco');

    render(
      <TargetPage
        target={target}
        participants={participantes}
        onContinuar={onContinuar}
        onVolver={() => {}}
      />,
    );
    return { onContinuar };
  };

  it('muestra la modalidad y las flechas del blanco', async () => {
    renderPagina();

    expect(await screen.findByText('Blanco 1')).toBeDefined();
    expect(screen.getByText(/3D · 2 flechas/)).toBeDefined();
    expect(screen.getByText('Jabalí')).toBeDefined();
  });

  it('guarda cada flecha al instante, sin botón de guardar', async () => {
    renderPagina();

    fireEvent.click(await screen.findByRole('button', { name: 'Puntaje 11' }));

    await waitFor(async () => {
      expect((await readScore(P1, 1))?.arrows).toEqual(['11']);
    });

    // No existe ningún "Guardar": el puntaje ya está en IndexedDB.
    expect(screen.queryByRole('button', { name: /guardar/i })).toBeNull();
  });

  it('la red NO está en el camino: guarda con onLine en false', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderPagina();

    fireEvent.click(await screen.findByRole('button', { name: 'Puntaje 11' }));
    fireEvent.click(screen.getByRole('button', { name: 'Puntaje 8' }));

    await waitFor(async () => {
      expect((await readScore(P1, 1))?.total).toBe(19);
    });
  });

  it('pasa solo al siguiente arquero al completar uno', async () => {
    renderPagina();

    fireEvent.click(await screen.findByRole('button', { name: 'Puntaje 11' }));
    fireEvent.click(screen.getByRole('button', { name: 'Puntaje 8' }));

    await waitFor(async () => {
      expect((await readScore(P1, 1))?.arrows).toHaveLength(2);
    });

    // El cambio de arquero ocurre dentro de la cola de escrituras, así que hay
    // que esperar a que el teclado vuelva a aceptar: tocarlo antes sería tocar
    // un botón deshabilitado y el test dependería del tiempo.
    const tecla = () => screen.getByRole('button', { name: 'Puntaje 10' }) as HTMLButtonElement;
    await waitFor(() => {
      expect(tecla().disabled).toBe(false);
    });

    // Ahora las flechas van al segundo arquero.
    fireEvent.click(tecla());

    await waitFor(async () => {
      expect((await readScore(P2, 1))?.arrows).toEqual(['10']);
    });
  });

  it('Continuar está deshabilitado y dice QUIÉN falta', async () => {
    const { onContinuar } = renderPagina();

    const continuar = await screen.findByRole('button', { name: 'Continuar' });
    expect((continuar as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Falta cargar: Pérez, Gómez/)).toBeDefined();

    fireEvent.click(continuar);
    expect(onContinuar).not.toHaveBeenCalled();
  });

  it('Continuar se habilita cuando todos tienen puntaje', async () => {
    const { onContinuar } = renderPagina();

    // Primer arquero: al completarlo, la selección pasa sola al segundo.
    fireEvent.click(await screen.findByRole('button', { name: 'Puntaje 11' }));
    fireEvent.click(screen.getByRole('button', { name: 'Puntaje 8' }));
    await waitFor(async () => {
      expect((await readScore(P1, 1))?.arrows).toHaveLength(2);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Puntaje 10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Puntaje 5' }));
    await waitFor(async () => {
      expect((await readScore(P2, 1))?.arrows).toHaveLength(2);
    });

    await waitFor(() => {
      expect(
        (screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled,
      ).toBe(false);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(onContinuar).toHaveBeenCalled();
  });

  it('se puede borrar la última flecha cargada', async () => {
    renderPagina();

    fireEvent.click(await screen.findByRole('button', { name: 'Puntaje 11' }));
    await waitFor(async () => {
      expect((await readScore(P1, 1))?.arrows).toEqual(['11']);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Borrar' })[0] as HTMLElement);

    await waitFor(async () => {
      expect((await readScore(P1, 1))?.arrows).toEqual([]);
    });
  });

  it('muestra las flechas de mayor a menor, sin importar el orden de carga', async () => {
    renderPagina();

    fireEvent.click(await screen.findByRole('button', { name: 'Puntaje 8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Puntaje 11' }));

    await waitFor(() => {
      const fila = screen.getByTestId('fila-Pérez');
      expect(fila.textContent).toMatch(/11.*8/s);
    });
  });

  it('el indicador de sincronización está siempre visible', async () => {
    renderPagina();
    expect(await screen.findByTestId('sync-badge')).toBeDefined();
  });
});
