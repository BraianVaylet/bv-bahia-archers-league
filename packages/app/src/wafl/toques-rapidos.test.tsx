import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteDb, readScore, type StoredBundle, saveBundle } from '../offline/db.js';
import { writeScore } from '../offline/outbox.js';
import { configureSync, resetSyncWorker } from '../offline/syncWorker.js';
import { TargetPage } from './TargetPage.js';

/**
 * Toques rápidos que no se pierden (`FE-45`, devolución de la prueba 1).
 *
 * En el predio, «muchos clicks rápidos fallan». Se anota con guantes y a ritmo: el líder canta
 * «diez, ocho, nueve, nueve» y toca sin mirar entre toque y toque. Cada toque tiene que quedar,
 * en el arquero que corresponde, aunque la escritura anterior en IndexedDB no haya terminado.
 *
 * `fireEvent.click` seguidos, **sin esperar nada entre uno y otro**, es exactamente eso: los
 * toques llegan antes de que la cola de escrituras termine.
 */

const P1 = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const P2 = 'aaaaaaaaaaaaaaaaaaaaaaa2';
const P3 = 'aaaaaaaaaaaaaaaaaaaaaaa3';

const participantes = [
  [P1, 'Juan', 'Pérez', 'A', 'izquierda'],
  [P2, 'Ana', 'Gómez', 'A', 'derecha'],
  [P3, 'Luis', 'Díaz', 'B', 'izquierda'],
].map(([id, firstName, lastName, unit, position]) => ({
  id: id as string,
  firstName: firstName as string,
  lastName: lastName as string,
  category: 'raso',
  stake: 'azul',
  unit: unit as string,
  position: position as string,
}));

const bundle: StoredBundle = {
  tournament: {
    id: 't1',
    name: 'Torneo',
    date: '2026-08-08',
    maxPossibleScore: 100,
    targets: [
      { index: 1, modality: '3d', arrows: 2, description: null },
      { index: 2, modality: 'aire_libre', arrows: 4, description: null },
    ],
  },
  patrol: { id: 'p1', number: 1, startTargetIndex: 1, status: 'en_curso', targetsCompleted: 0 },
  participants: participantes,
  fetchedAt: Date.now(),
  clockSkewMs: 0,
};

beforeEach(async () => {
  resetSyncWorker();
  // La red no es parte de esto: un transporte que nunca resuelve deja el outbox quieto.
  configureSync({ post: () => new Promise(() => {}) });
  await deleteDb();
  await saveBundle(bundle);
});

afterEach(() => {
  cleanup();
});

function montar(indiceDeBlanco: number) {
  const target = bundle.tournament.targets.find((t) => t.index === indiceDeBlanco);
  if (!target) throw new Error('falta el blanco');
  render(
    <TargetPage
      target={target}
      participants={participantes}
      onContinuar={() => {}}
      onVolver={() => {}}
    />,
  );
}

const tecla = (token: string) =>
  screen.getByRole('button', { name: `Puntaje ${token}` }) as HTMLButtonElement;

const tocar = (...tokens: string[]) => {
  for (const t of tokens) fireEvent.click(tecla(t));
};

const totalDe = (apellido: string) =>
  screen.getByTestId(`fila-${apellido}`).querySelector('.tabular-nums')?.textContent;

/** Espera a que la lectura inicial de IndexedDB termine: el teclado ya está montado. */
const listo = async () => {
  await screen.findByRole('button', { name: 'Puntaje 10' });
  await waitFor(() =>
    expect(document.querySelector('[data-panel-teclado]')?.getAttribute('aria-busy')).toBe('false'),
  );
};

describe('toques seguidos, sin esperar a IndexedDB', () => {
  it('al completar un arquero, los toques siguientes van al próximo: no se pierde ninguno', async () => {
    montar(1);
    await listo();

    // Dos flechas por arquero: los toques 3 y 4 son de Gómez, el 5 y el 6 de Díaz.
    tocar('11', '8', '10', '5', '5', '8');

    await waitFor(async () => {
      expect((await readScore(P1, 1))?.arrows).toEqual(['11', '8']);
      expect((await readScore(P2, 1))?.arrows).toEqual(['10', '5']);
      expect((await readScore(P3, 1))?.arrows).toEqual(['5', '8']);
    });
  });

  it('la misma tecla dos veces seguidas son dos flechas', async () => {
    montar(2);
    await listo();

    tocar('10', '10', '10', '10');

    await waitFor(async () => {
      expect((await readScore(P1, 2))?.arrows).toEqual(['10', '10', '10', '10']);
    });
  });

  it('la flecha se ve en el mismo toque, antes de que termine la escritura', async () => {
    montar(2);
    await listo();

    tocar('9');

    // Sin `await`: lo que se ve sale del toque, no de releer la base.
    expect(totalDe('Pérez')).toBe('9');
  });

  it('el teclado no se apaga entre un arquero y el siguiente', async () => {
    montar(1);
    await listo();

    tocar('11', '8');

    // En el mismo instante: el seleccionado ya es Gómez y el teclado acepta.
    expect(tecla('10').disabled).toBe(false);
    expect(screen.queryByText(/Ya cargaste/)).toBeNull();
  });

  it('cuando todos completaron, el teclado se apaga y dice por qué', async () => {
    montar(1);
    await listo();

    tocar('11', '8', '10', '5', '5', '8');

    expect(tecla('10').disabled).toBe(true);
    expect(screen.getByText(/Ya cargaste las 2 flechas/)).toBeDefined();
  });

  it('borrar la última, tocar de nuevo y seguir: la base queda igual a lo que se ve', async () => {
    montar(2);
    await listo();

    tocar('10', '9');
    fireEvent.click(screen.getByRole('button', { name: /borrar la última de Pérez/i }));
    tocar('8');

    expect(totalDe('Pérez')).toBe('18');
    await waitFor(async () => {
      expect((await readScore(P1, 2))?.arrows).toEqual(['10', '8']);
    });
  });

  it('si la base ya tenía flechas que la pantalla no vio, se avisa y se muestra lo guardado', async () => {
    montar(1);
    await listo();

    // Otra pestaña, o una lectura vieja: Pérez ya está completo en la base.
    await writeScore(P1, 1, ['11', '11']);
    tocar('5');

    expect(await screen.findByRole('alert')).toHaveTextContent(/Pérez ya tiene las 2 flechas/);
    await waitFor(() => expect(totalDe('Pérez')).toBe('22'));
    expect((await readScore(P1, 1))?.arrows).toEqual(['11', '11']);
  });
});

describe('las teclas no esperan un doble toque', () => {
  it('ninguna tecla deja que el navegador tome dos toques rápidos como zoom', async () => {
    montar(1);
    await listo();

    const teclas = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label')?.match(/^(Puntaje|Miss)/));
    expect(teclas.length).toBeGreaterThan(0);
    for (const t of teclas) expect(t.style.touchAction).toBe('manipulation');
  });
});
