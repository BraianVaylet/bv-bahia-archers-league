import { describe, expect, it } from 'vitest';
import {
  type BowCategory,
  buildPatrols,
  DEFAULT_STAKE_MAP,
  type ParticipantInput,
  type PlannedPatrol,
  stakeForCategory,
  validatePatrols,
} from '../src/index';

/**
 * Armado de patrullas (SH-3).
 *
 * La tarea más delicada del dominio. Los ejemplos de patrullas correctas e
 * incorrectas del reglamento del club son NORMATIVOS y están traducidos acá
 * literalmente.
 *
 * Restricciones duras (docs/DOMAIN_WA.md §5):
 *   H1  tamaño de patrulla entre 2 y 4
 *   H2  cada unidad de tiro es homogénea de categoría
 *   H3  ninguna patrulla puede ser 100% escuela
 *   H4  la estaca se deriva de la categoría
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

let contador = 0;

/** Crea participantes de una categoría. Apellidos distintos para que el orden sea estable. */
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

/**
 * Arma una patrulla explícita para probar el validador.
 * La estaca de cada arquero se deriva de su categoría, como en el armado real;
 * `estacaForzada` permite romper H4 a propósito.
 */
function patrulla(
  unidades: BowCategory[][],
  numero = 1,
  estacaForzada?: 'roja' | 'azul' | 'amarilla',
): PlannedPatrol {
  return {
    number: numero,
    startTargetIndex: 1,
    units: unidades.map((cats, i) => ({
      label: (i === 0 ? 'A' : 'B') as 'A' | 'B',
      category: cats[0] as BowCategory,
      stake: estacaForzada ?? stakeForCategory(cats[0] as BowCategory),
      members: cats.map((category, j) => ({
        archerId: `x${numero}${i}${j}`,
        firstName: 'N',
        lastName: `L${j}`,
        category,
        stake: estacaForzada ?? stakeForCategory(category),
        position: (j === 0 ? 'izquierda' : 'derecha') as 'izquierda' | 'derecha',
      })),
    })),
  };
}

function tamaño(p: PlannedPatrol): number {
  return p.units.reduce((n, u) => n + u.members.length, 0);
}

function categoriasDe(p: PlannedPatrol): BowCategory[] {
  return p.units.flatMap((u) => u.members.map((m) => m.category));
}

// ── validatePatrols: los ejemplos normativos del reglamento ──────────────────

describe('validatePatrols — ejemplos del reglamento del club', () => {
  describe('patrullas CORRECTAS', () => {
    it.each([
      [
        'A:[razo, razo] · B:[razo, razo]',
        [
          ['razo', 'razo'],
          ['razo', 'razo'],
        ],
      ],
      [
        'A:[razo, razo] · B:[escuela, escuela]',
        [
          ['razo', 'razo'],
          ['escuela', 'escuela'],
        ],
      ],
      [
        'A:[compuesto, compuesto] · B:[escuela, escuela]',
        [
          ['compuesto', 'compuesto'],
          ['escuela', 'escuela'],
        ],
      ],
      ['A:[compuesto, compuesto] · B:[cazador]', [['compuesto', 'compuesto'], ['cazador']]],
      ['A:[compuesto, compuesto] · B:[escuela]', [['compuesto', 'compuesto'], ['escuela']]],
    ] as [string, BowCategory[][]][])('%s', (_desc, unidades) => {
      expect(validatePatrols([patrulla(unidades)])).toEqual([]);
    });
  });

  describe('patrullas INCORRECTAS', () => {
    it('A:[razo, tradicional] · B:[razo, cazador] viola H2 en las dos unidades', () => {
      const violaciones = validatePatrols([
        patrulla([
          ['razo', 'tradicional'],
          ['razo', 'cazador'],
        ]),
      ]);
      expect(violaciones).toHaveLength(2);
      expect(violaciones.every((v) => v.code === 'MIXED_UNIT')).toBe(true);
      expect(violaciones.map((v) => (v.code === 'MIXED_UNIT' ? v.unit : null))).toEqual(['A', 'B']);
    });

    it('A:[longbow, compuesto] · B:[razo, compuesto] viola H2 en las dos unidades', () => {
      const violaciones = validatePatrols([
        patrulla([
          ['longbow', 'compuesto'],
          ['razo', 'compuesto'],
        ]),
      ]);
      expect(violaciones).toHaveLength(2);
      expect(violaciones.every((v) => v.code === 'MIXED_UNIT')).toBe(true);
    });

    it('A:[escuela, escuela] · B:[escuela, escuela] viola H3', () => {
      const violaciones = validatePatrols([
        patrulla([
          ['escuela', 'escuela'],
          ['escuela', 'escuela'],
        ]),
      ]);
      expect(violaciones).toEqual([{ code: 'ALL_ESCUELA', patrolNumber: 1 }]);
    });
  });

  describe('casos derivados de H3', () => {
    it('una patrulla de 2 arqueros, ambos escuela, viola H3', () => {
      expect(validatePatrols([patrulla([['escuela', 'escuela']])])).toEqual([
        { code: 'ALL_ESCUELA', patrolNumber: 1 },
      ]);
    });

    it('una patrulla de 3 arqueros, todos escuela, viola H3', () => {
      expect(validatePatrols([patrulla([['escuela', 'escuela'], ['escuela']])])).toEqual([
        { code: 'ALL_ESCUELA', patrolNumber: 1 },
      ]);
    });

    it('un solo senior alcanza para cumplir H3', () => {
      expect(validatePatrols([patrulla([['escuela', 'escuela'], ['longbow']])])).toEqual([]);
    });
  });

  describe('casos derivados de H1', () => {
    it('una patrulla de 5 arqueros viola H1', () => {
      const p = patrulla([
        ['razo', 'razo'],
        ['razo', 'razo'],
      ]);
      p.units[1]?.members.push({
        archerId: 'extra',
        firstName: 'N',
        lastName: 'L',
        category: 'razo',
        stake: 'azul',
        position: 'izquierda',
      });
      expect(validatePatrols([p])).toContainEqual({
        code: 'PATROL_SIZE',
        patrolNumber: 1,
        size: 5,
      });
    });

    it('una patrulla de 1 arquero viola H1', () => {
      expect(validatePatrols([patrulla([['razo']])])).toEqual([
        { code: 'PATROL_SIZE', patrolNumber: 1, size: 1 },
      ]);
    });
  });

  it('reporta violaciones de varias patrullas con su número', () => {
    const violaciones = validatePatrols([
      patrulla([['razo', 'razo']], 1),
      patrulla([['escuela', 'escuela']], 2),
      patrulla([['longbow', 'razo']], 3),
    ]);
    expect(violaciones).toEqual([
      { code: 'ALL_ESCUELA', patrolNumber: 2 },
      { code: 'MIXED_UNIT', patrolNumber: 3, unit: 'A', categories: ['longbow', 'razo'] },
    ]);
  });

  it('detecta una estaca que no corresponde a la categoría (H4)', () => {
    // razo va a estaca azul; se fuerza roja para romper H4.
    const p = patrulla([['razo', 'razo']], 1, 'roja');
    expect(validatePatrols([p])).toContainEqual({
      code: 'STAKE_MISMATCH',
      patrolNumber: 1,
      archerId: p.units[0]?.members[0]?.archerId,
      expected: 'azul',
      got: 'roja',
    });
  });
});

// ── buildPatrols ─────────────────────────────────────────────────────────────

describe('buildPatrols', () => {
  describe('determinismo', () => {
    it('el mismo input en distinto orden produce exactamente el mismo resultado', () => {
      const participantes = [
        ...arqueros('razo', 5),
        ...arqueros('compuesto', 4),
        ...arqueros('escuela', 3),
        ...arqueros('longbow', 2),
      ];
      const barajado = [...participantes].reverse();

      const a = buildPatrols(participantes, DEFAULT_STAKE_MAP, 14);
      const b = buildPatrols(barajado, DEFAULT_STAKE_MAP, 14);

      expect(b).toEqual(a);
    });

    it('dos corridas seguidas dan el mismo resultado', () => {
      const participantes = [...arqueros('cazador', 7), ...arqueros('escuela', 2)];
      expect(buildPatrols(participantes, DEFAULT_STAKE_MAP, 10)).toEqual(
        buildPatrols(participantes, DEFAULT_STAKE_MAP, 10),
      );
    });

    // El orden desempata por apellido, después por nombre, después por id.
    // Es lo que hace reproducible el armado con hermanos o con homónimos:
    // docs/FUNCTIONAL.md §10 lo lista como caso borde.
    it('desempata por nombre cuando el apellido se repite', () => {
      const mismoApellido: ParticipantInput[] = [
        { archerId: 'a2', firstName: 'Zoe', lastName: 'Pérez', category: 'razo' },
        { archerId: 'a1', firstName: 'Ana', lastName: 'Pérez', category: 'razo' },
      ];
      const plan = buildPatrols(mismoApellido, DEFAULT_STAKE_MAP, 6);
      expect(plan.patrols[0]?.units[0]?.members.map((m) => m.firstName)).toEqual(['Ana', 'Zoe']);
    });

    it('desempata por id cuando el nombre y el apellido se repiten', () => {
      const homonimos: ParticipantInput[] = [
        { archerId: 'zzz', firstName: 'Ana', lastName: 'Pérez', category: 'razo' },
        { archerId: 'aaa', firstName: 'Ana', lastName: 'Pérez', category: 'razo' },
      ];
      const plan = buildPatrols(homonimos, DEFAULT_STAKE_MAP, 6);
      expect(plan.patrols[0]?.units[0]?.members.map((m) => m.archerId)).toEqual(['aaa', 'zzz']);
    });

    it('ignora acentos y mayúsculas al ordenar, sin depender del locale', () => {
      const conAcentos: ParticipantInput[] = [
        { archerId: 'b', firstName: 'N', lastName: 'Zapata', category: 'razo' },
        { archerId: 'a', firstName: 'N', lastName: 'Álvarez', category: 'razo' },
      ];
      const plan = buildPatrols(conAcentos, DEFAULT_STAKE_MAP, 6);
      expect(plan.patrols[0]?.units[0]?.members.map((m) => m.lastName)).toEqual([
        'Álvarez',
        'Zapata',
      ]);
    });
  });

  describe('invariantes', () => {
    it('ninguna patrulla generada viola H1..H4', () => {
      const participantes = [
        ...arqueros('recurvo', 3),
        ...arqueros('compuesto', 4),
        ...arqueros('cazador', 2),
        ...arqueros('razo', 5),
        ...arqueros('tradicional', 1),
        ...arqueros('longbow', 2),
        ...arqueros('escuela', 3),
      ];
      const plan = buildPatrols(participantes, DEFAULT_STAKE_MAP, 14);
      expect(validatePatrols(plan.patrols)).toEqual([]);
    });

    it('no pierde ni duplica arqueros', () => {
      const participantes = [
        ...arqueros('razo', 5),
        ...arqueros('compuesto', 4),
        ...arqueros('escuela', 3),
      ];
      const plan = buildPatrols(participantes, DEFAULT_STAKE_MAP, 14);

      const asignados = plan.patrols.flatMap((p) => p.units.flatMap((u) => u.members));
      const ids = [...asignados.map((m) => m.archerId), ...plan.unassigned.map((m) => m.archerId)];

      expect(ids).toHaveLength(participantes.length);
      expect(new Set(ids).size).toBe(participantes.length);
    });

    it('asigna la estaca que corresponde a cada categoría', () => {
      const participantes = [
        ...arqueros('recurvo', 2),
        ...arqueros('razo', 2),
        ...arqueros('escuela', 2),
      ];
      const plan = buildPatrols(participantes, DEFAULT_STAKE_MAP, 8);
      const porCategoria = new Map(
        plan.patrols
          .flatMap((p) => p.units.flatMap((u) => u.members))
          .map((m) => [m.category, m.stake]),
      );
      expect(porCategoria.get('recurvo')).toBe('roja');
      expect(porCategoria.get('razo')).toBe('azul');
      expect(porCategoria.get('escuela')).toBe('amarilla');
    });

    it('respeta un stakeMap personalizado del torneo', () => {
      const personalizado = {
        roja: ['recurvo'] as const,
        azul: ['compuesto', 'cazador', 'razo', 'tradicional', 'longbow'] as const,
        amarilla: ['escuela'] as const,
      };
      const plan = buildPatrols(arqueros('compuesto', 2), personalizado, 8);
      expect(plan.patrols[0]?.units[0]?.stake).toBe('azul');
    });

    it('numera las patrullas desde 1 y sin huecos', () => {
      const plan = buildPatrols(arqueros('razo', 12), DEFAULT_STAKE_MAP, 14);
      expect(plan.patrols.map((p) => p.number)).toEqual(plan.patrols.map((_, i) => i + 1));
    });

    it('la unidad A siempre existe y B es opcional', () => {
      const plan = buildPatrols(arqueros('razo', 6), DEFAULT_STAKE_MAP, 14);
      for (const p of plan.patrols) {
        expect(p.units[0]?.label).toBe('A');
        if (p.units[1]) expect(p.units[1].label).toBe('B');
      }
    });

    it('dentro de una unidad de dos, uno tira a la izquierda y otro a la derecha', () => {
      const plan = buildPatrols(arqueros('razo', 4), DEFAULT_STAKE_MAP, 14);
      for (const p of plan.patrols) {
        for (const u of p.units) {
          if (u.members.length === 2) {
            expect(u.members.map((m) => m.position)).toEqual(['izquierda', 'derecha']);
          }
        }
      }
    });
  });

  describe('blancos de inicio (S3)', () => {
    it('reparte los blancos de inicio a lo largo del circuito', () => {
      // 20 arqueros de una categoría → 5 patrullas de 4; 14 blancos.
      const plan = buildPatrols(arqueros('razo', 20), DEFAULT_STAKE_MAP, 14);
      expect(plan.patrols).toHaveLength(5);
      expect(plan.patrols.map((p) => p.startTargetIndex)).toEqual([1, 3, 6, 9, 12]);
    });

    it('no repite blanco de inicio mientras haya al menos tantos blancos como patrullas', () => {
      const plan = buildPatrols(arqueros('razo', 20), DEFAULT_STAKE_MAP, 14);
      const inicios = plan.patrols.map((p) => p.startTargetIndex);
      expect(new Set(inicios).size).toBe(inicios.length);
    });

    it('todos los blancos de inicio están dentro del recorrido', () => {
      const plan = buildPatrols(arqueros('razo', 20), DEFAULT_STAKE_MAP, 14);
      for (const p of plan.patrols) {
        expect(p.startTargetIndex).toBeGreaterThanOrEqual(1);
        expect(p.startTargetIndex).toBeLessThanOrEqual(14);
      }
    });

    it('un torneo todavía sin blancos configurados arranca todas en el 1', () => {
      // El admin puede armar las patrullas antes de terminar el recorrido.
      const plan = buildPatrols(arqueros('razo', 8), DEFAULT_STAKE_MAP, 0);
      expect(plan.patrols.every((p) => p.startTargetIndex === 1)).toBe(true);
    });
  });

  describe('agrupar por categoría (S1)', () => {
    it('junta a los arqueros de la misma categoría en la misma unidad', () => {
      const plan = buildPatrols(
        [...arqueros('razo', 6), ...arqueros('compuesto', 2)],
        DEFAULT_STAKE_MAP,
        14,
      );
      for (const p of plan.patrols) {
        for (const u of p.units) {
          const cats = new Set(u.members.map((m) => m.category));
          expect(cats.size).toBe(1);
        }
      }
    });

    it('con 6 razo y 2 compuesto, los razo no quedan dispersos de a uno', () => {
      const plan = buildPatrols(
        [...arqueros('razo', 6), ...arqueros('compuesto', 2)],
        DEFAULT_STAKE_MAP,
        14,
      );
      const unidadesRazo = plan.patrols.flatMap((p) =>
        p.units.filter((u) => u.category === 'razo'),
      );
      // 6 razo → 3 unidades de 2. Ninguna unidad solitaria.
      expect(unidadesRazo).toHaveLength(3);
      expect(unidadesRazo.every((u) => u.members.length === 2)).toBe(true);
    });
  });

  describe('restricción de escuela (H3)', () => {
    it('acompaña a cada unidad de escuela con una unidad senior', () => {
      const plan = buildPatrols(
        [...arqueros('escuela', 4), ...arqueros('compuesto', 4)],
        DEFAULT_STAKE_MAP,
        14,
      );
      expect(plan.requiresManualReview).toBe(false);
      expect(plan.unassigned).toEqual([]);

      for (const p of plan.patrols) {
        const cats = categoriasDe(p);
        if (cats.includes('escuela')) {
          expect(cats.some((c) => c !== 'escuela')).toBe(true);
        }
      }
    });

    // Si escuela se lleva las unidades senior de a DOS, las senior SOLITARIAS
    // quedan sin compañero posible y se pierden. Por eso escuela toma primero
    // las solitarias: son las que no pueden formar patrulla por su cuenta.
    it('escuela toma primero las unidades senior solitarias, para no dejarlas huérfanas', () => {
      // 2 escuela (1 unidad) + 3 razo (1 unidad de dos + 1 solitaria).
      const plan = buildPatrols(
        [...arqueros('escuela', 2), ...arqueros('razo', 3)],
        DEFAULT_STAKE_MAP,
        14,
      );

      expect(plan.unassigned).toEqual([]);
      expect(plan.requiresManualReview).toBe(false);
      expect(validatePatrols(plan.patrols)).toEqual([]);
      expect(plan.patrols.map(tamaño).sort()).toEqual([2, 3]);
    });

    it('nunca arma una patrulla 100% escuela, aunque no alcancen los seniors', () => {
      const plan = buildPatrols(
        [...arqueros('escuela', 6), ...arqueros('razo', 2)],
        DEFAULT_STAKE_MAP,
        14,
      );

      for (const p of plan.patrols) {
        expect(categoriasDe(p).every((c) => c === 'escuela')).toBe(false);
      }
      expect(validatePatrols(plan.patrols)).toEqual([]);
    });

    it('marca revisión manual y avisa cuándo quedan escuela sin senior', () => {
      const plan = buildPatrols(
        [...arqueros('escuela', 6), ...arqueros('razo', 2)],
        DEFAULT_STAKE_MAP,
        14,
      );

      expect(plan.requiresManualReview).toBe(true);
      expect(plan.warnings).toHaveLength(1);
      expect(plan.warnings[0]?.code).toBe('ESCUELA_SIN_SENIOR');
      expect(plan.unassigned.length).toBeGreaterThan(0);
      expect(plan.unassigned.every((m) => m.category === 'escuela')).toBe(true);
      expect(plan.warnings[0]?.archerIds).toEqual(plan.unassigned.map((m) => m.archerId));
    });

    it('con todos los participantes de escuela no arma ninguna patrulla, y no rompe', () => {
      const participantes = arqueros('escuela', 8);
      const plan = buildPatrols(participantes, DEFAULT_STAKE_MAP, 14);

      expect(plan.patrols).toEqual([]);
      expect(plan.unassigned).toHaveLength(8);
      expect(plan.requiresManualReview).toBe(true);
    });
  });

  describe('casos extremos', () => {
    it('sin participantes devuelve un plan vacío', () => {
      const plan = buildPatrols([], DEFAULT_STAKE_MAP, 14);
      expect(plan).toEqual({
        patrols: [],
        unassigned: [],
        warnings: [],
        requiresManualReview: false,
      });
    });

    it('con 2 participantes arma una sola patrulla', () => {
      const plan = buildPatrols(arqueros('razo', 2), DEFAULT_STAKE_MAP, 14);
      expect(plan.patrols).toHaveLength(1);
      expect(tamaño(plan.patrols[0] as PlannedPatrol)).toBe(2);
      expect(validatePatrols(plan.patrols)).toEqual([]);
    });

    it('con 1 solo participante no puede armar patrulla y lo deja sin asignar', () => {
      const plan = buildPatrols(arqueros('razo', 1), DEFAULT_STAKE_MAP, 14);
      expect(plan.patrols).toEqual([]);
      expect(plan.unassigned).toHaveLength(1);
      expect(plan.requiresManualReview).toBe(true);
    });

    it('con 5 arqueros de una categoría arma 3+2, no 4+1', () => {
      const plan = buildPatrols(arqueros('razo', 5), DEFAULT_STAKE_MAP, 14);
      expect(plan.patrols.map(tamaño).sort()).toEqual([2, 3]);
      expect(validatePatrols(plan.patrols)).toEqual([]);
      expect(plan.unassigned).toEqual([]);
    });

    it('con impares en varias categorías no deja a nadie suelto', () => {
      const participantes = [
        ...arqueros('recurvo', 3),
        ...arqueros('razo', 3),
        ...arqueros('longbow', 1),
      ];
      const plan = buildPatrols(participantes, DEFAULT_STAKE_MAP, 14);
      expect(plan.unassigned).toEqual([]);
      expect(validatePatrols(plan.patrols)).toEqual([]);
    });

    it('con 3 arqueros de una categoría arma una sola patrulla de 3', () => {
      const plan = buildPatrols(arqueros('cazador', 3), DEFAULT_STAKE_MAP, 14);
      expect(plan.patrols).toHaveLength(1);
      expect(tamaño(plan.patrols[0] as PlannedPatrol)).toBe(3);
    });
  });

  describe('caso de referencia del brief', () => {
    // 20 arqueros inscriptos, 14 blancos.
    it('arma un torneo completo sin violaciones', () => {
      const participantes = [
        ...arqueros('recurvo', 2),
        ...arqueros('compuesto', 4),
        ...arqueros('cazador', 3),
        ...arqueros('razo', 4),
        ...arqueros('tradicional', 2),
        ...arqueros('longbow', 1),
        ...arqueros('escuela', 4),
      ];
      expect(participantes).toHaveLength(20);

      const plan = buildPatrols(participantes, DEFAULT_STAKE_MAP, 14);

      expect(validatePatrols(plan.patrols)).toEqual([]);
      expect(plan.unassigned).toEqual([]);
      expect(plan.requiresManualReview).toBe(false);

      for (const p of plan.patrols) {
        expect(tamaño(p)).toBeGreaterThanOrEqual(2);
        expect(tamaño(p)).toBeLessThanOrEqual(4);
      }
    });
  });
});
