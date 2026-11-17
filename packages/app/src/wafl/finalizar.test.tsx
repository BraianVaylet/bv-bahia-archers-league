import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteDb,
  readOutbox,
  readSignatures,
  type StoredBundle,
  saveBundle,
} from '../offline/db.js';
import { writeScore, writeSignature } from '../offline/outbox.js';
import { configureSync, flush, resetSyncWorker } from '../offline/syncWorker.js';
import { ResultsPage } from './ResultsPage.js';

/**
 * «Finalizar torneo» en un solo toque (`FE-44`, devolución de la prueba 1).
 *
 * En el predio cada patrulla tuvo que tocar «Finalizar» dos veces: el primero chocaba con las ops
 * recién encoladas —la última firma, siempre— y el segundo, ya con el outbox vacío, cerraba. Nadie
 * entendía por qué. `OFFLINE_SYNC.md` §5.5 ya lo pedía: «la UI muestra "Sincronizando N cambios…"
 * y encola el cierre recién cuando termina». El `close` **nunca** se encola con ops pendientes.
 */

const P1 = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const P2 = 'aaaaaaaaaaaaaaaaaaaaaaa2';

const participantes = [
  [P1, 'Juan', 'Pérez', 'izquierda'],
  [P2, 'Ana', 'Gómez', 'derecha'],
].map(([id, firstName, lastName, position]) => ({
  id: id as string,
  firstName: firstName as string,
  lastName: lastName as string,
  category: 'raso',
  stake: 'azul',
  unit: 'A',
  position: position as string,
}));

const bundle: StoredBundle = {
  tournament: {
    id: 't1',
    name: 'Torneo',
    date: '2026-08-08',
    maxPossibleScore: 22,
    targets: [{ index: 1, modality: '3d', arrows: 2, description: null }],
  },
  patrol: { id: 'p1', number: 1, startTargetIndex: 1, status: 'en_curso', targetsCompleted: 0 },
  participants: participantes,
  fetchedAt: Date.now(),
  clockSkewMs: 0,
};

const PNG = 'data:image/png;base64,AAA';

type Op = Record<string, unknown>;

/** Un servidor que acepta todo y anota lo que le llegó, en orden. */
function servidorQueAcepta(enviadas: Op[] = []) {
  configureSync({
    post: async (ops) => {
      enviadas.push(...ops);
      return {
        results: ops.map((o) => ({ opId: o.opId as string, status: 'applied' as const })),
        patrol: { status: 'en_curso', targetsCompleted: 1 },
        serverTime: new Date().toISOString(),
      };
    },
  });
  return enviadas;
}

/** Sin señal: el `TypeError` que tira `fetch` sin red. */
function sinSeñal() {
  configureSync({
    post: async () => {
      throw new TypeError('Failed to fetch');
    },
  });
}

/** Recorrido completo y las dos firmas: todo queda en el outbox, como al terminar de firmar. */
async function listoParaFinalizar() {
  await writeScore(P1, 1, ['11', '8']);
  await writeScore(P2, 1, ['10', '5']);
  await writeSignature(P1, PNG);
  await writeSignature(P2, PNG);
}

beforeEach(async () => {
  resetSyncWorker();
  await deleteDb();
  await saveBundle(bundle);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function montar() {
  const onCerrado = vi.fn();
  render(<ResultsPage bundle={bundle} onVolver={() => {}} onCerrado={onCerrado} />);
  return { onCerrado };
}

const botonFinalizar = async () => {
  const boton = (await screen.findByRole('button', {
    name: 'Finalizar torneo',
  })) as HTMLButtonElement;
  await waitFor(() => expect(boton.disabled).toBe(false));
  return boton;
};

const closesEnElOutbox = async () => (await readOutbox()).filter((o) => o.type === 'close');

describe('Finalizar con cambios sin enviar', () => {
  it('un solo toque: envía lo pendiente y finaliza solo', async () => {
    await listoParaFinalizar();
    const enviadas = servidorQueAcepta();
    const { onCerrado } = montar();

    fireEvent.click(await botonFinalizar());

    await waitFor(() => expect(onCerrado).toHaveBeenCalledTimes(1));
    // El cierre llega al servidor **después** de los puntajes y las firmas.
    await waitFor(() => expect(enviadas.at(-1)?.type).toBe('close'));
    expect(enviadas.filter((o) => o.type === 'close')).toHaveLength(1);
    expect(enviadas.filter((o) => o.type !== 'close')).toHaveLength(4);
  });

  it('mientras envía, el botón dice cuántos cambios faltan y no se puede volver a tocar', async () => {
    await listoParaFinalizar();
    // Un servidor que nunca contesta: el envío queda en camino.
    configureSync({ post: () => new Promise(() => {}) });
    const { onCerrado } = montar();

    fireEvent.click(await botonFinalizar());

    const enviando = (await screen.findByRole('button', {
      name: /Sincronizando 4 cambios/,
    })) as HTMLButtonElement;
    expect(enviando.disabled).toBe(true);
    expect(screen.getByText(/se finaliza solo/i)).toBeDefined();
    expect(onCerrado).not.toHaveBeenCalled();
    // §5.5: con ops pendientes, el `close` no se encola.
    expect(await closesEnElOutbox()).toHaveLength(0);
  });

  it('sin señal: no finaliza, dice por qué, conserva todo y ofrece reintentar', async () => {
    await listoParaFinalizar();
    sinSeñal();
    const { onCerrado } = montar();

    fireEvent.click(await botonFinalizar());

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/ya están guardados en el celular/);
    });
    expect(onCerrado).not.toHaveBeenCalled();
    expect(await closesEnElOutbox()).toHaveLength(0);
    expect((await readOutbox()).length).toBe(4);
    expect((screen.getByRole('button', { name: /Reintentar/ }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('cuando vuelve la señal, finaliza sin otro toque', async () => {
    await listoParaFinalizar();
    sinSeñal();
    const { onCerrado } = montar();

    fireEvent.click(await botonFinalizar());
    await screen.findByRole('button', { name: /Reintentar/ });

    // Vuelve la señal: el sync worker reintenta solo (evento `online`, intervalo o backoff).
    const enviadas = servidorQueAcepta();
    await flush();

    await waitFor(() => expect(onCerrado).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(enviadas.at(-1)?.type).toBe('close'));
  });

  it('«Reintentar» vuelve a intentar el envío', async () => {
    await listoParaFinalizar();
    sinSeñal();
    const { onCerrado } = montar();

    fireEvent.click(await botonFinalizar());
    const reintentar = await screen.findByRole('button', { name: /Reintentar/ });

    servidorQueAcepta();
    fireEvent.click(reintentar);

    await waitFor(() => expect(onCerrado).toHaveBeenCalledTimes(1));
  });

  it('si el servidor rechaza una firma, no finaliza y pide volver a firmar', async () => {
    await listoParaFinalizar();
    const enviadas: Op[] = [];
    configureSync({
      post: async (ops) => {
        enviadas.push(...ops);
        return {
          results: ops.map((o) =>
            o.type === 'signature' && o.participantId === P1
              ? {
                  opId: o.opId as string,
                  status: 'rejected' as const,
                  error: { code: 'INVALID_SIGNATURE', message: 'La firma no es válida.' },
                }
              : { opId: o.opId as string, status: 'applied' as const },
          ),
          patrol: { status: 'en_curso', targetsCompleted: 1 },
          serverTime: new Date().toISOString(),
        };
      },
    });
    const { onCerrado } = montar();

    fireEvent.click(await botonFinalizar());

    // Pérez vuelve a tener su botón de firmar, y el aviso lo nombra.
    await waitFor(() => {
      expect(screen.getByTestId('resultado-Pérez').textContent).toMatch(/Firmar/);
    });
    expect(screen.getByRole('alert').textContent).toMatch(/Pérez/);
    expect(onCerrado).not.toHaveBeenCalled();
    expect(enviadas.some((o) => o.type === 'close')).toBe(false);
    expect(await closesEnElOutbox()).toHaveLength(0);
    expect((await readSignatures()).find((f) => f.participantId === P1)?.syncState).toBe(
      'conflict',
    );
  });
});
