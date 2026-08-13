import { describe, expect, it } from 'vitest';
import {
  borradorDe,
  cambiarInicio,
  cuerpoDeDistribucion,
  type MiembroVista,
  moverArquero,
  type PatrullaVista,
  problemaDelBorrador,
  textoDeViolacion,
  unidadesDe,
  violacionesDe,
} from './patrullas.js';

/**
 * Lógica del editor de patrullas (FE-13).
 *
 * Ver docs/FUNCTIONAL.md §6.6 y docs/DOMAIN_WA.md §5.
 */

let n = 0;

function miembro(overrides: Partial<MiembroVista> = {}): MiembroVista {
  n++;
  return {
    id: `p${n}`,
    firstName: `Nombre${n}`,
    lastName: `Apellido${String(n).padStart(3, '0')}`,
    category: 'razo',
    stake: 'azul',
    unit: 'A',
    position: 'izquierda',
    signed: false,
    ...overrides,
  };
}

function patrulla(numero: number, members: MiembroVista[]): PatrullaVista {
  return {
    id: `x${numero}`,
    number: numero,
    startTargetIndex: numero,
    username: `patrulla${numero}`,
    status: 'pendiente',
    targetsCompleted: 0,
    members,
    pin: '481902',
  };
}

// ── Borrador ─────────────────────────────────────────────────────────────────

describe('borradorDe', () => {
  it('ordena por unidad y posición, no por como vino de la base', () => {
    const desordenados = [
      miembro({ id: 'd', unit: 'B', position: 'derecha' }),
      miembro({ id: 'b', unit: 'A', position: 'derecha' }),
      miembro({ id: 'c', unit: 'B', position: 'izquierda' }),
      miembro({ id: 'a', unit: 'A', position: 'izquierda' }),
    ];

    const [b] = borradorDe([patrulla(1, desordenados)]);

    // La `A` tira primero, y dentro de cada unidad la izquierda va primero.
    expect(b?.miembros.map((m) => m.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('unidadesDe', () => {
  it('parte de a dos: A y B', () => {
    const cuatro = [miembro(), miembro(), miembro(), miembro()];
    const unidades = unidadesDe(cuatro);

    expect(unidades.map((u) => u.label)).toEqual(['A', 'B']);
    expect(unidades[0]?.members).toHaveLength(2);
    expect(unidades[1]?.members).toHaveLength(2);
  });

  it('con uno solo hay una sola unidad', () => {
    expect(unidadesDe([miembro()])).toHaveLength(1);
  });

  it('con tres, la B queda con uno', () => {
    const unidades = unidadesDe([miembro(), miembro(), miembro()]);
    expect(unidades[1]?.members).toHaveLength(1);
  });

  /**
   * Recortar en cuatro hacía que mover un 5º arquero lo moviera **y lo
   * perdiera**: desaparecía de la pantalla y del cuerpo que se manda. El
   * exceso tiene que verse; frenarlo es tarea de `problemaDelBorrador`.
   */
  it('con cinco no descarta a nadie: los cinco siguen ahí', () => {
    const cinco = [
      miembro({ id: 'a' }),
      miembro({ id: 'b' }),
      miembro({ id: 'c' }),
      miembro({ id: 'd' }),
      miembro({ id: 'e' }),
    ];

    const unidades = unidadesDe(cinco);
    const vistos = unidades.flatMap((u) => u.members.map((m) => m.id));

    expect(vistos).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

// ── Mover ────────────────────────────────────────────────────────────────────

describe('moverArquero', () => {
  const base = () =>
    borradorDe([
      patrulla(1, [miembro({ id: 'a' }), miembro({ id: 'b' })]),
      patrulla(2, [miembro({ id: 'c' }), miembro({ id: 'd' })]),
    ]);

  it('lo saca de una y lo pone en la otra', () => {
    const r = moverArquero(base(), 'a', 2);

    expect(r[0]?.miembros.map((m) => m.id)).toEqual(['b']);
    expect(r[1]?.miembros.map((m) => m.id)).toEqual(['c', 'd', 'a']);
  });

  it('no lo duplica si ya está en la patrulla destino', () => {
    const r = moverArquero(base(), 'a', 1);
    expect(r[0]?.miembros.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('un id que no existe no cambia nada', () => {
    // Se compara contra el MISMO borrador: `base()` genera arqueros nuevos en
    // cada llamada, así que dos invocaciones nunca serían iguales.
    const antes = base();
    expect(moverArquero(antes, 'zzz', 2)).toEqual(antes);
  });

  it('no muta el borrador recibido', () => {
    const original = base();
    moverArquero(original, 'a', 2);
    expect(original[0]?.miembros.map((m) => m.id)).toEqual(['a', 'b']);
  });
});

describe('cambiarInicio', () => {
  it('cambia sólo la patrulla indicada', () => {
    const r = cambiarInicio(borradorDe([patrulla(1, [miembro()]), patrulla(2, [miembro()])]), 1, 7);

    expect(r[0]?.startTargetIndex).toBe(7);
    expect(r[1]?.startTargetIndex).toBe(2);
  });
});

// ── Validación en vivo ───────────────────────────────────────────────────────

describe('violacionesDe', () => {
  it('una patrulla con un solo arquero viola H1', () => {
    const v = violacionesDe(borradorDe([patrulla(1, [miembro()])]));
    expect(v.some((x) => x.code === 'PATROL_SIZE')).toBe(true);
  });

  it('una unidad con categorías mezcladas viola H2', () => {
    const v = violacionesDe(
      borradorDe([patrulla(1, [miembro({ category: 'razo' }), miembro({ category: 'longbow' })])]),
    );

    expect(v.some((x) => x.code === 'MIXED_UNIT')).toBe(true);
  });

  it('una patrulla toda de escuela viola H3', () => {
    const escuela = { category: 'escuela' as const, stake: 'amarilla' as const };
    const v = violacionesDe(borradorDe([patrulla(1, [miembro(escuela), miembro(escuela)])]));

    expect(v.some((x) => x.code === 'ALL_ESCUELA')).toBe(true);
  });

  it('una patrulla válida no genera violaciones', () => {
    expect(violacionesDe(borradorDe([patrulla(1, [miembro(), miembro()])]))).toEqual([]);
  });

  // Una patrulla vacía es un estado intermedio esperable mientras se reacomoda:
  // marcarla como violación llenaría la pantalla de ruido durante la edición.
  it('una patrulla sin nadie no cuenta como violación', () => {
    const b = borradorDe([patrulla(1, [miembro(), miembro()]), patrulla(2, [])]);
    expect(violacionesDe(b)).toEqual([]);
  });
});

describe('textoDeViolacion', () => {
  it('nombra la patrulla y explica qué está mal', () => {
    expect(textoDeViolacion({ code: 'PATROL_SIZE', patrolNumber: 3, size: 1 })).toMatch(
      /Patrulla 3.*1 arquero.*entre 2 y 4/,
    );
    expect(textoDeViolacion({ code: 'ALL_ESCUELA', patrolNumber: 2 })).toMatch(
      /todos de escuela.*senior/,
    );
    expect(
      textoDeViolacion({
        code: 'MIXED_UNIT',
        patrolNumber: 1,
        unit: 'A',
        categories: ['razo', 'longbow'],
      }),
    ).toMatch(/unidad A.*razo, longbow/);
  });
});

// ── Guardado ─────────────────────────────────────────────────────────────────

describe('problemaDelBorrador', () => {
  it('frena una patrulla con más de 4 arqueros', () => {
    const cinco = [miembro(), miembro(), miembro(), miembro(), miembro()];
    expect(problemaDelBorrador(borradorDe([patrulla(1, cinco)]))).toMatch(/El máximo es 4/);
  });

  /**
   * El guardado exige 2–4 en todas.
   *
   * Antes una patrulla de uno se podía guardar: era una violación que «avisaba
   * sin bloquear». Pero un arquero solo no puede tirar —no tiene quién le
   * controle el puntaje— así que no es una excepción que el admin pueda tomar,
   * es un torneo que no se puede correr.
   */
  it('frena una patrulla con un solo arquero', () => {
    expect(problemaDelBorrador(borradorDe([patrulla(1, [miembro()])]))).toMatch(/al menos 2/);
  });

  it('nombra la patrulla que está mal, no dice sólo que algo falla', () => {
    const b = borradorDe([patrulla(1, [miembro(), miembro()]), patrulla(7, [miembro()])]);
    expect(problemaDelBorrador(b)).toMatch(/patrulla 7/i);
  });

  // Una patrulla vacía es un estado intermedio mientras se reacomoda, y no se
  // manda al servidor: no tiene por qué frenar el guardado.
  it('NO frena una patrulla sin nadie', () => {
    const b = borradorDe([patrulla(1, [miembro(), miembro()]), patrulla(2, [])]);
    expect(problemaDelBorrador(b)).toBeUndefined();
  });

  // Las violaciones de reglamento siguen avisando sin bloquear: el admin conoce
  // el terreno y la decisión queda registrada.
  it('NO frena una patrulla que viola el reglamento pero se puede correr', () => {
    const escuela = { category: 'escuela' as const, stake: 'amarilla' as const };
    const b = borradorDe([patrulla(1, [miembro(escuela), miembro(escuela)])]);

    expect(violacionesDe(b).some((v) => v.code === 'ALL_ESCUELA')).toBe(true);
    expect(problemaDelBorrador(b)).toBeUndefined();
  });
});

describe('textoDeViolacion · reglas nuevas', () => {
  it('nombra las patrullas de dos que se podrían juntar', () => {
    expect(textoDeViolacion({ code: 'TOO_MANY_PAIRS', patrolNumbers: [2, 5] })).toMatch(
      /patrullas 2 y 5.*dos arqueros/i,
    );
  });

  it('nombra el blanco compartido y quiénes lo comparten', () => {
    expect(
      textoDeViolacion({ code: 'DUPLICATE_START', targetIndex: 7, patrolNumbers: [1, 3] }),
    ).toMatch(/patrullas 1 y 3.*blanco 7/i);
  });
});

describe('cuerpoDeDistribucion', () => {
  it('manda las unidades derivadas del orden', () => {
    const cuerpo = cuerpoDeDistribucion(
      borradorDe([
        patrulla(1, [
          miembro({ id: 'a', unit: 'A', position: 'izquierda' }),
          miembro({ id: 'b', unit: 'A', position: 'derecha' }),
          miembro({ id: 'c', unit: 'B', position: 'izquierda' }),
        ]),
      ]),
    );

    expect(cuerpo.patrols[0]).toEqual({
      number: 1,
      startTargetIndex: 1,
      units: [
        { label: 'A', members: ['a', 'b'] },
        { label: 'B', members: ['c'] },
      ],
    });
  });

  // El schema exige al menos una unidad por patrulla, así que una vacía no se
  // puede expresar. Al no mencionarla queda vacía, que es lo que se quiere.
  it('omite las patrullas que quedaron sin nadie', () => {
    const cuerpo = cuerpoDeDistribucion(
      borradorDe([patrulla(1, [miembro(), miembro()]), patrulla(2, [])]),
    );

    expect(cuerpo.patrols).toHaveLength(1);
    expect(cuerpo.patrols[0]?.number).toBe(1);
  });

  // El guardado está bloqueado en ese estado, pero si el cuerpo se armara igual
  // no puede salir con cuatro de los cinco: sería perder a un arquero en
  // silencio, que es exactamente el bug.
  it('con cinco arqueros no se pierde ninguno en el cuerpo', () => {
    const cinco = ['a', 'b', 'c', 'd', 'e'].map((id) => miembro({ id }));
    const cuerpo = cuerpoDeDistribucion(borradorDe([patrulla(1, cinco)]));
    const mandados = cuerpo.patrols[0]?.units.flatMap((u) => u.members);

    expect(mandados).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('no manda ni la estaca ni la posición: las deriva el servidor', () => {
    const cuerpo = cuerpoDeDistribucion(borradorDe([patrulla(1, [miembro(), miembro()])]));
    const unidad = cuerpo.patrols[0]?.units[0] as Record<string, unknown>;

    expect(Object.keys(unidad)).toEqual(['label', 'members']);
  });
});
