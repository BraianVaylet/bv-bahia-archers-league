import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteDb,
  readScore,
  readScoresDeBlanco,
  type StoredBundle,
  saveBundle,
} from '../offline/db.js';
import { writeScore } from '../offline/outbox.js';
import { configureSync, resetSyncWorker } from '../offline/syncWorker.js';
import { ArrowRow } from './ArrowRow.js';
import { ScoreKeypad } from './ScoreKeypad.js';
import { TargetPage } from './TargetPage.js';

/**
 * El camino de anotar una flecha (`REF6-14` / `P-7`).
 *
 * Se anota con guantes, caminando, y el toque tiene que responder al instante. Hoy son ≤ 240
 * registros y no se nota, pero la pantalla releía **todos** los puntajes de IndexedDB en cada
 * toque, repintaba **todas** las filas y el teclado, y el presupuesto de `TECHNICAL.md` §5
 * («registrar una flecha < 50 ms») no se medía.
 *
 * Los repintados se cuentan por lo que hace cada fila (`sortArrowsDescending` corre en cada
 * render de `ArrowRow`), no por cómo está escrito el componente.
 */

vi.mock('@bal/shared', async (original) => {
  const real = await original<typeof import('@bal/shared')>();
  return { ...real, sortArrowsDescending: vi.fn(real.sortArrowsDescending) };
});

vi.mock('../offline/db.js', async (original) => {
  const real = await original<typeof import('../offline/db.js')>();
  return { ...real, readScores: vi.fn(real.readScores) };
});

const { sortArrowsDescending } = await import('@bal/shared');
const { readScores } = await import('../offline/db.js');

const P1 = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const P2 = 'aaaaaaaaaaaaaaaaaaaaaaa2';
const P3 = 'aaaaaaaaaaaaaaaaaaaaaaa3';
const P4 = 'aaaaaaaaaaaaaaaaaaaaaaa4';

const participantes = [
  [P1, 'Juan', 'Pérez', 'A', 'izquierda'],
  [P2, 'Ana', 'Gómez', 'A', 'derecha'],
  [P3, 'Luis', 'Díaz', 'B', 'izquierda'],
  [P4, 'Eva', 'Ruiz', 'B', 'derecha'],
].map(([id, firstName, lastName, unit, position]) => ({
  id: id as string,
  firstName: firstName as string,
  lastName: lastName as string,
  category: 'razo',
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
      { index: 2, modality: 'aire_libre', arrows: 6, description: null },
    ],
  },
  patrol: { id: 'p1', number: 1, startTargetIndex: 1, status: 'en_curso', targetsCompleted: 0 },
  participants: participantes,
  fetchedAt: Date.now(),
  clockSkewMs: 0,
};

beforeEach(async () => {
  resetSyncWorker();
  // La red no importa acá, y que nunca resuelva deja el vaciado del outbox quieto.
  configureSync({ post: () => new Promise(() => {}) });
  await deleteDb();
  await saveBundle(bundle);
  vi.mocked(sortArrowsDescending).mockClear();
  vi.mocked(readScores).mockClear();
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

const hastaQue = async (condicion: () => boolean, limiteMs = 2_000) => {
  const inicio = performance.now();
  while (!condicion()) {
    if (performance.now() - inicio > limiteMs) throw new Error('la condición no se cumplió');
    await new Promise((r) => setTimeout(r, 0));
  }
};

const totalDe = (apellido: string) =>
  screen.getByTestId(`fila-${apellido}`).querySelector('.tabular-nums')?.textContent;

describe('leer los puntajes de un blanco', () => {
  it('trae sólo los de ese blanco, por el índice', async () => {
    await writeScore(P1, 1, ['11', '8']);
    await writeScore(P2, 1, ['8', '5']);
    await writeScore(P1, 2, ['X', '10', '9', '8', '7', '6']);

    const delPrimero = await readScoresDeBlanco(1);

    expect(delPrimero.map((s) => s.participantId).sort()).toEqual([P1, P2]);
    expect(delPrimero.every((s) => s.targetIndex === 1)).toBe(true);
  });

  it('de un blanco sin puntajes, una lista vacía', async () => {
    expect(await readScoresDeBlanco(2)).toEqual([]);
  });
});

describe('TargetPage al anotar', () => {
  it('no relee todos los puntajes del almacén: lee los del blanco, por el índice', async () => {
    montar(1);

    fireEvent.click(await screen.findByRole('button', { name: 'Puntaje 11' }));
    fireEvent.click(screen.getByRole('button', { name: 'Puntaje 8' }));
    await hastaQue(() => totalDe('Pérez') === '19');

    expect(readScores).not.toHaveBeenCalled();
  });

  it('al anotarle una flecha a un arquero no se repinta la fila de los demás', async () => {
    montar(1);
    await screen.findByText('Blanco 1');
    await hastaQue(() => vi.mocked(sortArrowsDescending).mock.calls.length >= 4);
    vi.mocked(sortArrowsDescending).mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Puntaje 11' }));
    await hastaQue(() => totalDe('Pérez') === '11');

    // Los otros tres siguen sin flechas: si alguna de sus filas se repintó, `ArrowRow` corrió con `[]`.
    const repintadasSinCambios = vi
      .mocked(sortArrowsDescending)
      .mock.calls.filter(([, flechas]) => flechas.length === 0);
    expect(repintadasSinCambios).toHaveLength(0);
  });

  it('la fila que sí cambió se repinta con sus flechas', async () => {
    montar(1);
    await screen.findByText('Blanco 1');
    vi.mocked(sortArrowsDescending).mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Puntaje 11' }));
    await hastaQue(() => totalDe('Pérez') === '11');

    expect(
      vi.mocked(sortArrowsDescending).mock.calls.some(([, flechas]) => flechas.join() === '11'),
    ).toBe(true);
  });
});

/**
 * La medición del presupuesto «registrar una flecha < 50 ms» (`TECHNICAL.md` §5).
 *
 * Es el tiempo de **jsdom con IndexedDB falso**, que no es el de un celular: sirve para ver el
 * orden de magnitud y para que un cambio que lo multiplique (releer el almacén entero, repintarlo
 * todo) se note. El número real se mide en el teléfono. El tope es holgado a propósito: un test
 * de tiempos que falla por una máquina lenta enseña a ignorarlo.
 */
describe('registrar una flecha, medido', () => {
  it('toca, guarda en IndexedDB y se ve, en milisegundos', async () => {
    montar(2);
    await screen.findByText('Blanco 2');

    const tiempos: number[] = [];
    for (let i = 1; i <= 6; i++) {
      const inicio = performance.now();
      fireEvent.click(screen.getByRole('button', { name: 'Puntaje 9' }));
      await hastaQue(() => totalDe('Pérez') === String(9 * i));
      tiempos.push(performance.now() - inicio);
    }

    expect((await readScore(P1, 2))?.arrows).toHaveLength(6);

    const ordenados = [...tiempos].sort((a, b) => a - b);
    const mediana = ordenados[Math.floor(ordenados.length / 2)] ?? Number.POSITIVE_INFINITY;
    console.info(
      `registrar una flecha (jsdom): mediana ${mediana.toFixed(1)} ms, máx ${Math.max(...tiempos).toFixed(1)} ms`,
    );

    expect(mediana).toBeLessThan(150);
  });
});

describe('ArrowRow', () => {
  const base = {
    firstName: 'Juan',
    lastName: 'Pérez',
    stake: 'azul',
    unit: 'A',
    modality: '3d' as const,
    total: 19,
    arrowsPerTarget: 2,
    seleccionado: false,
    onSelect: () => {},
    onBorrarUltima: () => {},
  };

  const repintadas = () => vi.mocked(sortArrowsDescending).mock.calls.length;

  it('no se repinta si llegan las mismas flechas en un arreglo nuevo', () => {
    // IndexedDB devuelve objetos nuevos en cada lectura aunque el puntaje no haya cambiado.
    const { rerender } = render(<ArrowRow {...base} arrows={['11', '8']} />);
    const antes = repintadas();

    rerender(<ArrowRow {...base} arrows={['11', '8']} />);

    expect(repintadas()).toBe(antes);
  });

  it.each([
    ['otras flechas', { arrows: ['11', '5'] }],
    ['otro total', { total: 16 }],
    ['quedó seleccionada', { seleccionado: true }],
    ['la firmaron', { firmado: true }],
    ['otro callback', { onSelect: () => {} }],
  ])('se repinta si cambia algo real: %s', (_nombre, cambio) => {
    const { rerender } = render(<ArrowRow {...base} arrows={['11', '8']} />);
    const antes = repintadas();

    rerender(<ArrowRow {...base} arrows={['11', '8']} {...cambio} />);

    expect(repintadas()).toBe(antes + 1);
  });

  it('con una flecha más se repinta', () => {
    const { rerender } = render(<ArrowRow {...base} arrows={['11']} />);
    const antes = repintadas();

    rerender(<ArrowRow {...base} arrows={['11', '8']} />);

    expect(repintadas()).toBe(antes + 1);
  });
});

describe('ScoreKeypad', () => {
  // `memo` no se puede observar desde afuera sin contar renders del propio teclado; se comprueba que
  // el componente exportado lo sea. El efecto sobre la pantalla lo cubren los tests de `TargetPage`.
  it('es un componente memo: no se repinta por cambios que no son suyos', () => {
    expect((ScoreKeypad as unknown as { $$typeof: symbol }).$$typeof).toBe(
      Symbol.for('react.memo'),
    );
  });
});

describe('TargetPage y los firmados', () => {
  const firma = (participantId: string) => ({
    participantId,
    pngDataUrl: 'data:image/png;base64,AAAA',
    clientUpdatedAt: Date.now(),
    syncState: 'pending' as const,
  });

  // `TargetPage` conserva el mismo conjunto de firmados si no cambió, para no repintar todas las
  // filas. Que conserve el conjunto **cuando sí cambió** (otro arquero, mismo tamaño) sería peor
  // que repintar de más: se vería firmado a quien no firmó y se podría editar a quien sí.
  it('si cambia quién firmó, aunque sean tantos como antes, la pantalla lo refleja', async () => {
    const { getDb } = await import('../offline/db.js');
    const db = await getDb();
    await db.put('signatures', firma(P1));

    montar(1);
    expect(await screen.findByText(/Pérez ya firmó/)).toBeDefined();

    // Misma cantidad de firmas, otra persona: se desbloqueó P1 y firmó P2.
    await db.delete('signatures', P1);
    await db.put('signatures', firma(P2));
    // Seleccionar a otro arquero y anotarle una flecha fuerza una relectura.
    fireEvent.click(screen.getByTestId('fila-Díaz').querySelector('button') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Puntaje 11' }));

    await hastaQue(() => screen.queryByText(/Gómez ya firmó/) !== null);
    expect(screen.queryByText(/Pérez ya firmó/)).toBeNull();
  });
});
