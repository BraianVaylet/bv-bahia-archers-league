import { describe, expect, it } from 'vitest';
import {
  type BowCategory,
  buildPatrols,
  incorporarArqueros,
  type ParticipantInput,
  type PlannedPatrol,
} from '../src/index';

/**
 * Incorporar y quitar arqueros sin rearmar las patrullas (`SH-12`, decisión 5 de la Fase 10).
 *
 * Devolución de la prueba 1: «cuando se agrega un nuevo arquero al torneo y se quiere ajustar las
 * patrullas, que queden con la posición editada por el admin, que no se vuelvan a desordenar».
 * Hasta acá, cambiar los participantes volvía a correr `buildPatrols` desde cero: reordenaba todo
 * y armaba patrullas nuevas, con PIN nuevos aunque estuvieran impresos.
 */

let contador = 0;

function arqueros(category: BowCategory, cantidad: number): ParticipantInput[] {
  return Array.from({ length: cantidad }, () => {
    contador++;
    return {
      archerId: `a${String(contador).padStart(3, '0')}`,
      firstName: `Nombre${contador}`,
      lastName: `Apellido${String(contador).padStart(3, '0')}`,
      category,
    };
  });
}

/** Dónde está cada arquero: patrulla, unidad y posición. Es lo que el admin ve y ajusta. */
function ubicaciones(patrullas: readonly PlannedPatrol[]): Map<string, string> {
  return new Map(
    patrullas.flatMap((p) =>
      p.units.flatMap((u) =>
        u.members.map((m) => [m.archerId, `${p.number}${u.label}-${m.position}`] as const),
      ),
    ),
  );
}

const tamaños = (patrullas: readonly PlannedPatrol[]) =>
  patrullas.map((p) => p.units.flatMap((u) => u.members).length);

describe('incorporarArqueros', () => {
  it('agregar uno no mueve a nadie de los que ya estaban', () => {
    // Seis recurvos: una patrulla de 4 y una de 2.
    const { patrols: actuales } = buildPatrols(arqueros('recurvo', 6), undefined, 6);
    const antes = ubicaciones(actuales);

    const { patrols } = incorporarArqueros(actuales, {
      nuevos: arqueros('recurvo', 1),
      quitados: [],
    });

    const despues = ubicaciones(patrols);
    for (const [archerId, donde] of antes) expect(despues.get(archerId)).toBe(donde);
    expect(despues.size).toBe(antes.size + 1);
    expect(patrols.map((p) => p.startTargetIndex)).toEqual(actuales.map((p) => p.startTargetIndex));
    // Entra como unidad B de la 2, no como tercero de un par: una unidad es de a uno o de a dos.
    expect(patrols[1]?.units.map((u) => u.members.length)).toEqual([2, 1]);
  });

  it('quitar uno no mueve a nadie más', () => {
    const { patrols: actuales } = buildPatrols(arqueros('recurvo', 6), undefined, 6);
    const antes = ubicaciones(actuales);
    // El de la derecha de la unidad A de la patrulla 1: su compañero sigue a la izquierda.
    const quitado = actuales[0]?.units[0]?.members[1]?.archerId as string;

    const { patrols } = incorporarArqueros(actuales, { nuevos: [], quitados: [quitado] });

    const despues = ubicaciones(patrols);
    expect(despues.has(quitado)).toBe(false);
    for (const [archerId, donde] of antes) {
      if (archerId !== quitado) expect(despues.get(archerId)).toBe(donde);
    }
  });

  describe('si no hay lugar', () => {
    it('abre una patrulla nueva, al final, en el primer blanco libre, y avisa que es de uno', () => {
      // Ocho recurvos: dos patrullas de 4, llenas. Arrancan en el 1 y en el 4 de 6.
      const { patrols: actuales } = buildPatrols(arqueros('recurvo', 8), undefined, 6);
      const [nuevo] = arqueros('recurvo', 1);

      const { patrols, violations } = incorporarArqueros(
        actuales,
        { nuevos: [nuevo as ParticipantInput], quitados: [] },
        undefined,
        6,
      );

      expect(tamaños(patrols)).toEqual([4, 4, 1]);
      expect(patrols[2]).toMatchObject({ number: 3, startTargetIndex: 2 });
      expect(patrols[2]?.units[0]?.members[0]?.archerId).toBe(nuevo?.archerId);
      expect(violations).toContainEqual({ code: 'PATROL_SIZE', patrolNumber: 3, size: 1 });
    });

    it('dos nuevos de la misma categoría quedan juntos en la nueva, y ya no hay aviso', () => {
      const { patrols: actuales } = buildPatrols(arqueros('recurvo', 8), undefined, 6);

      const { patrols, violations } = incorporarArqueros(
        actuales,
        { nuevos: arqueros('recurvo', 2), quitados: [] },
        undefined,
        6,
      );

      expect(tamaños(patrols)).toEqual([4, 4, 2]);
      expect(violations).toEqual([]);
    });
  });

  /*
    `H3`: ninguna patrulla 100% no senior. Un `escuela` o `principiantes` que llega va a una patrulla
    con un senior aunque haya lugar antes en otra.
  */
  it('un no senior va a una patrulla con senior, aunque haya lugar antes en una sin ninguno', () => {
    // La 1 es dos recurvos y dos de escuela; la 2, dos recurvos.
    const { patrols: armadas } = buildPatrols(
      [...arqueros('recurvo', 4), ...arqueros('escuela', 2)],
      undefined,
      6,
    );
    // Se bajan los dos recurvos de la 1: queda sólo con los de escuela, y con lugar.
    const recurvosDeLa1 =
      armadas[0]?.units.find((u) => u.category === 'recurvo')?.members.map((m) => m.archerId) ?? [];
    const { patrols: actuales } = incorporarArqueros(armadas, {
      nuevos: [],
      quitados: recurvosDeLa1,
    });
    const [nuevo] = arqueros('escuela', 1);

    const { patrols } = incorporarArqueros(actuales, {
      nuevos: [nuevo as ParticipantInput],
      quitados: [],
    });

    const conElNuevo = patrols.find((p) =>
      p.units.some((u) => u.members.some((m) => m.archerId === nuevo?.archerId)),
    );
    expect(conElNuevo?.units.some((u) => u.category === 'recurvo')).toBe(true);
  });

  it('un no senior que queda solo se reporta, no se esconde', () => {
    const { patrols: actuales } = buildPatrols(arqueros('recurvo', 8), undefined, 6);

    const { violations } = incorporarArqueros(
      actuales,
      { nuevos: arqueros('escuela', 1), quitados: [] },
      undefined,
      6,
    );

    expect(violations).toContainEqual({ code: 'ALL_ESCUELA', patrolNumber: 3 });
  });

  // `H2`: una unidad es de una sola categoría. El que llega no completa una unidad ajena.
  it('uno de otra categoría no completa una unidad ajena: entra como unidad propia', () => {
    // Cinco recurvos: la 1 es un par y una unidad de UNO (incompleta); la 2, un par.
    const { patrols: actuales } = buildPatrols(arqueros('recurvo', 5), undefined, 6);
    expect(actuales[0]?.units.map((u) => u.members.length)).toEqual([2, 1]);

    const { patrols, violations } = incorporarArqueros(actuales, {
      nuevos: arqueros('compuesto', 1),
      quitados: [],
    });

    // No completa la unidad de un recurvo de la 1: va como unidad B a la 2.
    expect(patrols[0]?.units.map((u) => u.members.length)).toEqual([2, 1]);
    expect(patrols[1]?.units.map((u) => [u.label, u.category, u.members.length])).toEqual([
      ['A', 'recurvo', 2],
      ['B', 'compuesto', 1],
    ]);
    expect(violations.filter((v) => v.code === 'MIXED_UNIT')).toEqual([]);
  });

  it('es determinista: el orden en que llegan los nuevos no cambia el resultado', () => {
    const { patrols: actuales } = buildPatrols(arqueros('recurvo', 6), undefined, 6);
    const nuevos = [...arqueros('compuesto', 2), ...arqueros('recurvo', 1)];

    const a = incorporarArqueros(actuales, { nuevos, quitados: [] }, undefined, 6);
    const b = incorporarArqueros(
      actuales,
      { nuevos: [...nuevos].reverse(), quitados: [] },
      undefined,
      6,
    );

    expect(b).toEqual(a);
  });

  /*
    `H3` del otro lado: un senior que llega va primero a una patrulla que quedó sin ningún senior
    (con lugar), y la arregla. Encontrado por la mutación: antes iba a la primera con lugar.
  */
  it('un senior que llega rescata a una patrulla que quedó 100% no senior', () => {
    const { patrols: armadas } = buildPatrols(
      [...arqueros('recurvo', 4), ...arqueros('escuela', 2)],
      undefined,
      6,
    );
    const recurvosDeLa1 =
      armadas[0]?.units.find((u) => u.category === 'recurvo')?.members.map((m) => m.archerId) ?? [];
    const { patrols: actuales, violations: antes } = incorporarArqueros(armadas, {
      nuevos: [],
      quitados: recurvosDeLa1,
    });
    expect(antes).toContainEqual({ code: 'ALL_ESCUELA', patrolNumber: 1 });

    // La de recurvos primero: si el senior fuera a la primera con lugar, no rescataría a nadie.
    const { violations } = incorporarArqueros([...actuales].reverse(), {
      nuevos: arqueros('compuesto', 1),
      quitados: [],
    });

    expect(violations.filter((v) => v.code === 'ALL_ESCUELA')).toEqual([]);
  });

  describe('dónde entra cada uno (cubre lo que la mutación encontró sin vigilar)', () => {
    it('completa una unidad incompleta de su categoría antes que abrir una nueva', () => {
      // Cinco recurvos: la 1 es un par y una unidad de uno; la 2, un par.
      const { patrols: actuales } = buildPatrols(arqueros('recurvo', 5), undefined, 6);

      const { patrols } = incorporarArqueros(actuales, {
        nuevos: arqueros('recurvo', 1),
        quitados: [],
      });

      expect(patrols[0]?.units.map((u) => u.members.length)).toEqual([2, 2]);
      expect(patrols[1]?.units.map((u) => u.members.length)).toEqual([2]);
    });

    it('dos nuevos de la misma categoría forman una unidad, no dos sueltas', () => {
      const { patrols: actuales } = buildPatrols(arqueros('recurvo', 8), undefined, 6);

      const { patrols } = incorporarArqueros(
        actuales,
        { nuevos: arqueros('recurvo', 2), quitados: [] },
        undefined,
        6,
      );

      expect(patrols[2]?.units.map((u) => [u.label, u.members.map((m) => m.position)])).toEqual([
        ['A', ['izquierda', 'derecha']],
      ]);
    });

    it('un no senior completa su unidad en una patrulla mixta antes que ir a una sin senior', () => {
      // La 1: dos recurvos y dos de escuela. La 2: dos recurvos y uno de escuela (incompleta).
      const { patrols: armadas } = buildPatrols(
        [...arqueros('recurvo', 4), ...arqueros('escuela', 3)],
        undefined,
        6,
      );
      const recurvosDeLa1 =
        armadas[0]?.units.find((u) => u.category === 'recurvo')?.members.map((m) => m.archerId) ??
        [];
      // Sin sus recurvos, la 1 queda sólo con escuela y con lugar; la 2 es mixta.
      const { patrols: actuales } = incorporarArqueros(armadas, {
        nuevos: [],
        quitados: recurvosDeLa1,
      });
      const [nuevo] = arqueros('escuela', 1);

      const { patrols } = incorporarArqueros(actuales, {
        nuevos: [nuevo as ParticipantInput],
        quitados: [],
      });

      expect(patrols[1]?.units.find((u) => u.category === 'escuela')?.members.length).toBe(2);
      expect(patrols[0]?.units.flatMap((u) => u.members).length).toBe(2);
    });

    it('la patrulla nueva puede arrancar en el último blanco, si es el único libre', () => {
      // Dos patrullas llenas en un recorrido de 3: arrancan en el 1 y en el 2.
      const { patrols: actuales } = buildPatrols(arqueros('recurvo', 8), undefined, 3);
      expect(actuales.map((p) => p.startTargetIndex)).toEqual([1, 2]);

      const { patrols } = incorporarArqueros(
        actuales,
        { nuevos: arqueros('recurvo', 1), quitados: [] },
        undefined,
        3,
      );

      expect(patrols[2]?.startTargetIndex).toBe(3);
    });
  });

  describe('al quitar', () => {
    it('si se van los dos de una unidad, la unidad desaparece y la B pasa a ser la A', () => {
      // Ocho recurvos: la 1 tiene dos pares, A y B.
      const { patrols: actuales } = buildPatrols(arqueros('recurvo', 8), undefined, 6);
      const deLaA = actuales[0]?.units[0]?.members.map((m) => m.archerId) ?? [];
      const deLaB = actuales[0]?.units[1]?.members.map((m) => m.archerId) ?? [];

      const { patrols } = incorporarArqueros(actuales, { nuevos: [], quitados: deLaA });

      expect(patrols[0]?.units.map((u) => [u.label, u.members.map((m) => m.archerId)])).toEqual([
        ['A', deLaB],
      ]);
    });

    it('una patrulla que se queda sin nadie no se borra: se avisa, y la resuelve el admin', () => {
      const { patrols: actuales } = buildPatrols(arqueros('recurvo', 6), undefined, 6);
      const todosLa2 = actuales[1]?.units.flatMap((u) => u.members.map((m) => m.archerId)) ?? [];

      const { patrols, violations } = incorporarArqueros(actuales, {
        nuevos: [],
        quitados: todosLa2,
      });

      expect(patrols).toHaveLength(2);
      expect(patrols[1]?.units).toEqual([]);
      expect(violations).toContainEqual({ code: 'PATROL_SIZE', patrolNumber: 2, size: 0 });
    });
  });

  it('no ubica a nadie en una patrulla que quedó vacía si hay lugar en otra', () => {
    // Seis recurvos (4 y 2). Se va toda la 1: queda vacía, y la 2 tiene lugar.
    const { patrols: armadas } = buildPatrols(arqueros('recurvo', 6), undefined, 6);
    const todosLa1 = armadas[0]?.units.flatMap((u) => u.members.map((m) => m.archerId)) ?? [];
    const { patrols: actuales } = incorporarArqueros(armadas, { nuevos: [], quitados: todosLa1 });

    const { patrols } = incorporarArqueros(actuales, {
      nuevos: arqueros('compuesto', 1),
      quitados: [],
    });

    expect(patrols[0]?.units).toEqual([]);
    expect(patrols[1]?.units.map((u) => u.category)).toEqual(['recurvo', 'compuesto']);
  });

  it('no completa la unidad de uno de otra categoría aunque sea la única de la patrulla', () => {
    // Seis recurvos (4 y 2); se va uno de la 2, que queda con una unidad de un recurvo.
    const { patrols: armadas } = buildPatrols(arqueros('recurvo', 6), undefined, 6);
    const unoDeLa2 = armadas[1]?.units[0]?.members[0]?.archerId as string;
    const { patrols: actuales } = incorporarArqueros(armadas, { nuevos: [], quitados: [unoDeLa2] });

    const { patrols, violations } = incorporarArqueros(actuales, {
      nuevos: arqueros('compuesto', 1),
      quitados: [],
    });

    expect(patrols[1]?.units.map((u) => [u.category, u.members.length])).toEqual([
      ['recurvo', 1],
      ['compuesto', 1],
    ]);
    expect(violations.filter((v) => v.code === 'MIXED_UNIT')).toEqual([]);
  });

  it('una patrulla nunca pasa de dos unidades', () => {
    // Dos recurvos y un compuesto: una sola patrulla, con un par y una unidad de uno.
    const { patrols: actuales } = buildPatrols(
      [...arqueros('recurvo', 2), ...arqueros('compuesto', 1)],
      undefined,
      6,
    );
    expect(actuales.map((p) => p.units.length)).toEqual([2]);

    const { patrols } = incorporarArqueros(
      actuales,
      { nuevos: arqueros('recurvo', 1), quitados: [] },
      undefined,
      6,
    );

    expect(patrols.map((p) => p.units.length)).toEqual([2, 1]);
  });

  it('si las demás están llenas, reusa una patrulla vacía antes que abrir otra', () => {
    // Diez recurvos: 4, 4 y 2. Se va toda la 3, que queda vacía con su número y su PIN.
    const { patrols: armadas } = buildPatrols(arqueros('recurvo', 10), undefined, 6);
    const todosLa3 = armadas[2]?.units.flatMap((u) => u.members.map((m) => m.archerId)) ?? [];
    const { patrols: actuales } = incorporarArqueros(armadas, { nuevos: [], quitados: todosLa3 });

    const { patrols } = incorporarArqueros(
      actuales,
      { nuevos: arqueros('recurvo', 2), quitados: [] },
      undefined,
      6,
    );

    expect(tamaños(patrols)).toEqual([4, 4, 2]);
  });
});
