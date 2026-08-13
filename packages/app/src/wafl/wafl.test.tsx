import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  countOutbox,
  deleteDb,
  readBundle,
  readScores,
  readSignatures,
  type StoredBundle,
  saveBundle,
} from '../offline/db.js';
import { writeScore, writeSignature } from '../offline/outbox.js';
import { configureSync, flush, resetSyncWorker } from '../offline/syncWorker.js';
import { CircuitPage } from './CircuitPage.js';
import { ResultsPage } from './ResultsPage.js';
import { entrarConBundleLocal, logout } from './sesion.js';

/**
 * Circuito, resultados, firma y cierre (FE-4, FE-5, FE-7, FE-8).
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

/** La patrulla arranca en el blanco 2 de un recorrido de 3. */
const bundle: StoredBundle = {
  tournament: {
    id: 't1',
    name: '3ª fecha',
    date: '2026-08-08',
    maxPossibleScore: 74,
    targets: [
      { index: 2, modality: 'sala', arrows: 3, description: null },
      { index: 3, modality: 'campo', arrows: 3, description: null },
      { index: 1, modality: '3d', arrows: 2, description: 'Jabalí' },
    ],
  },
  patrol: { id: 'p1', number: 1, startTargetIndex: 2, status: 'en_curso', targetsCompleted: 0 },
  participants: participantes,
  fetchedAt: Date.now(),
  clockSkewMs: 0,
};

const PNG = 'data:image/png;base64,AAA';

beforeEach(async () => {
  resetSyncWorker();
  await deleteDb();
  await saveBundle(bundle);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Vacía el outbox simulando un servidor que acepta todo.
 * Devuelve la lista de ops que efectivamente llegaron.
 */
async function sincronizarTodo(): Promise<Record<string, unknown>[]> {
  const enviadas: Record<string, unknown>[] = [];

  configureSync({
    post: async (ops) => {
      enviadas.push(...ops);
      return {
        results: ops.map((o) => ({ opId: o.opId as string, status: 'applied' as const })),
        patrol: { status: 'en_curso', targetsCompleted: 3 },
        serverTime: new Date().toISOString(),
      };
    },
  });

  await flush();
  return enviadas;
}

/** Carga el recorrido completo de los dos arqueros. */
async function cargarTodo() {
  for (const pid of [P1, P2]) {
    await writeScore(pid, 2, ['X', '10', '9']);
    await writeScore(pid, 3, ['6', '5', '4']);
    await writeScore(pid, 1, ['11', '11']);
  }
}

// ── FE-4 · Sesión ────────────────────────────────────────────────────────────

describe('sesión', () => {
  it('permite entrar sin conexión si el bundle guardado es del mismo torneo', async () => {
    expect(await entrarConBundleLocal('t1')).not.toBeNull();
  });

  it('NO reusa el bundle de otro torneo', async () => {
    // Los datos de otro torneo no sirven, y usarlos sería peor que no entrar.
    expect(await entrarConBundleLocal('otro-torneo')).toBeNull();
  });

  it('cerrar sesión borra todo lo local, aunque no haya red', async () => {
    await writeScore(P1, 2, ['X', '10', '9']);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await logout();

    // Un celu prestado no puede quedarse con los datos sólo porque no había señal.
    expect(await readBundle()).toBeUndefined();
    expect(await readScores()).toEqual([]);
    expect(await countOutbox()).toBe(0);
  });
});

// ── FE-5 · Circuito ──────────────────────────────────────────────────────────

describe('CircuitPage', () => {
  const renderCircuito = (onAbrir = vi.fn(), onResultados = vi.fn()) => {
    render(<CircuitPage bundle={bundle} onAbrirBlanco={onAbrir} onResultados={onResultados} />);
    return { onAbrir, onResultados };
  };

  it('muestra los blancos en el orden que manda el backend, desde el de inicio', async () => {
    renderCircuito();

    const numeros = (await screen.findAllByTestId('numero-blanco')).map((n) => n.textContent);

    // La patrulla arranca en el 2: ve 2, 3, 1.
    expect(numeros).toEqual(['2', '3', '1']);
  });

  it('dice desde qué blanco arranca la patrulla', async () => {
    renderCircuito();
    expect(await screen.findByText(/arrancás en el 2/)).toBeDefined();
  });

  it('marca un blanco como completo sólo cuando TODOS los arqueros lo cargaron', async () => {
    // Sólo el primer arquero cargó el blanco 2.
    await writeScore(P1, 2, ['X', '10', '9']);
    renderCircuito();

    // Se espera al contador, no a "Pendiente": el estado inicial vacío también
    // muestra todo pendiente, así que esperar eso pasaría antes de cargar nada.
    expect(await screen.findByText(/^0 de 3 blancos/)).toBeDefined();
    expect(screen.queryAllByText('Completo')).toHaveLength(0);

    cleanup();

    // Ahora sí, los dos.
    await writeScore(P2, 2, ['X', '10', '9']);
    renderCircuito();

    expect(await screen.findByText(/^1 de 3 blancos/)).toBeDefined();
    expect(screen.getAllByText('Completo')).toHaveLength(1);
  });

  it('abre el blanco al tocarlo', async () => {
    const { onAbrir } = renderCircuito();

    // Se busca el blanco por su número, no por posición en el DOM: el header
    // tiene botones propios —el conmutador de tema— y `buttons[0]` apuntaba a
    // uno de ellos apenas se agregó.
    const primero = (await screen.findAllByTestId('numero-blanco'))[0];
    fireEvent.click(primero?.closest('button') as HTMLElement);

    expect(onAbrir).toHaveBeenCalledWith(expect.objectContaining({ index: 2 }));
  });

  it('Resultados finales está bloqueado hasta completar el recorrido', async () => {
    const { onResultados } = renderCircuito();

    const boton = await screen.findByRole('button', { name: 'Resultados finales' });
    expect((boton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(boton);
    expect(onResultados).not.toHaveBeenCalled();
  });

  it('se habilita con el recorrido completo', async () => {
    await cargarTodo();
    renderCircuito();

    await waitFor(() => {
      expect(
        (screen.getByRole('button', { name: 'Resultados finales' }) as HTMLButtonElement).disabled,
      ).toBe(false);
    });
  });

  /**
   * `delBlanco.length >= total` con `total === 0` es verdadero **siempre**.
   * Un bundle sin arqueros mostraba el recorrido entero como completo y
   * habilitaba las firmas sin que nadie hubiera anotado nada.
   */
  describe('un bundle vacío no puede dar todo por hecho', () => {
    const renderCon = (b: StoredBundle) =>
      render(<CircuitPage bundle={b} onAbrirBlanco={vi.fn()} onResultados={vi.fn()} />);

    it('sin arqueros, ningún blanco figura completo', async () => {
      renderCon({ ...bundle, participants: [] });

      expect(await screen.findByText(/^0 de 3 blancos/)).toBeDefined();
      expect(screen.queryAllByText('Completo')).toHaveLength(0);
      expect(screen.getAllByText('Pendiente')).toHaveLength(3);
    });

    it('sin arqueros, Resultados finales sigue bloqueado', async () => {
      renderCon({ ...bundle, participants: [] });

      const boton = await screen.findByRole('button', { name: 'Resultados finales' });
      expect((boton as HTMLButtonElement).disabled).toBe(true);
    });

    it('sin blancos, Resultados finales sigue bloqueado', async () => {
      // `completos.size === targets.length` es 0 === 0: la otra verdad vacua.
      renderCon({ ...bundle, tournament: { ...bundle.tournament, targets: [] } });

      const boton = await screen.findByRole('button', { name: 'Resultados finales' });
      expect((boton as HTMLButtonElement).disabled).toBe(true);
    });
  });
});

// ── FE-7 y FE-8 · Resultados, firma y cierre ─────────────────────────────────

describe('ResultsPage', () => {
  const renderResultados = (onCerrado = vi.fn()) => {
    render(<ResultsPage bundle={bundle} onVolver={() => {}} onCerrado={onCerrado} />);
    return { onCerrado };
  };

  it('suma el total de cada arquero y lo desglosa por blanco', async () => {
    await cargarTodo();
    renderResultados();

    // sala X+10+9 = 29 · campo 6+5+4 = 15 · 3D 11+11 = 22 → 66
    await waitFor(() => {
      expect(screen.getAllByText('66')).toHaveLength(2);
    });

    const fila = screen.getByTestId('resultado-Pérez');
    expect(fila.textContent).toMatch(/29/);
    expect(fila.textContent).toMatch(/22/);
  });

  it('cuenta inner, dieces y emes', async () => {
    await writeScore(P1, 2, ['X', '10', 'M']);
    renderResultados();

    // X es inner y además vale 10, así que cuenta en los dos.
    await waitFor(() => {
      const fila = screen.getByTestId('resultado-Pérez');
      expect(fila.textContent).toMatch(/Inner1/);
      expect(fila.textContent).toMatch(/M1/);
    });
  });

  it('Finalizar torneo está bloqueado y dice QUIÉNES faltan firmar', async () => {
    await cargarTodo();
    const { onCerrado } = renderResultados();

    const boton = await screen.findByRole('button', { name: 'Finalizar torneo' });
    expect((boton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Faltan las firmas de Pérez, Gómez/)).toBeDefined();

    fireEvent.click(boton);
    expect(onCerrado).not.toHaveBeenCalled();
  });

  it('con todas las firmas, cierra y encola la op', async () => {
    await cargarTodo();
    await writeSignature(P1, PNG);
    await writeSignature(P2, PNG);

    // El cierre exige el outbox vacío, así que primero se sincroniza todo.
    const enviadas = await sincronizarTodo();
    expect(await countOutbox()).toBe(0);

    const { onCerrado } = renderResultados();

    const boton = await screen.findByRole('button', { name: 'Finalizar torneo' });
    await waitFor(() => {
      expect((boton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(boton);

    // La op de cierre se encola y el `nudge()` la manda enseguida, así que se
    // verifica lo que llegó al servidor, no lo que quedó en el outbox.
    await waitFor(() => {
      expect(enviadas.some((o) => o.type === 'close')).toBe(true);
    });
    expect(onCerrado).toHaveBeenCalled();
  });

  // Cerrar con puntajes sin enviar dejaría al servidor rechazando por datos
  // incompletos. Ver docs/OFFLINE_SYNC.md §5.5.
  it('con ops pendientes NO cierra, y aclara que los puntajes están guardados', async () => {
    await cargarTodo();
    await writeSignature(P1, PNG);
    await writeSignature(P2, PNG);

    const { onCerrado } = renderResultados();

    const boton = await screen.findByRole('button', { name: 'Finalizar torneo' });
    await waitFor(() => expect((boton as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(boton);

    // El outbox tiene las ops de puntaje y de firma sin sincronizar.
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/ya están guardados en el celular/);
    });
    expect(onCerrado).not.toHaveBeenCalled();
  });

  it('marca como firmado a quien ya firmó', async () => {
    await cargarTodo();
    await writeSignature(P1, PNG);
    renderResultados();

    await waitFor(() => {
      expect(screen.getByTestId('resultado-Pérez').textContent).toMatch(/Firmado/);
    });
    expect(screen.getByTestId('resultado-Gómez').textContent).not.toMatch(/Firmado/);
  });

  describe('firma', () => {
    it('muestra el puntaje que se está firmando, arriba del canvas', async () => {
      await cargarTodo();
      renderResultados();

      fireEvent.click((await screen.findAllByRole('button', { name: 'Firmar' }))[0] as HTMLElement);

      expect(await screen.findByTestId('signature-canvas')).toBeDefined();
      expect(screen.getByText('Pérez, Juan')).toBeDefined();
      // Nadie firma algo que no está viendo.
      expect(screen.getByText('66')).toBeDefined();
    });

    it('no deja confirmar sin trazo', async () => {
      await cargarTodo();
      renderResultados();

      fireEvent.click((await screen.findAllByRole('button', { name: 'Firmar' }))[0] as HTMLElement);

      const confirmar = await screen.findByRole('button', { name: 'Confirmar firma' });
      expect((confirmar as HTMLButtonElement).disabled).toBe(true);

      fireEvent.click(confirmar);
      expect(await readSignatures()).toEqual([]);
    });

    it('se puede volver sin firmar', async () => {
      await cargarTodo();
      renderResultados();

      fireEvent.click((await screen.findAllByRole('button', { name: 'Firmar' }))[0] as HTMLElement);
      fireEvent.click(await screen.findByRole('button', { name: 'Volver' }));

      expect(await screen.findByText('Resultados')).toBeDefined();
      expect(await readSignatures()).toEqual([]);
    });
  });
});
