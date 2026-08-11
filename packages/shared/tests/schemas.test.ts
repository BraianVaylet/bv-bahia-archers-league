import { describe, expect, it } from 'vitest';
import {
  AdminLoginSchema,
  ArcherInputSchema,
  ChangePasswordSchema,
  CreateTournamentSchema,
  MAX_SIGNATURE_BYTES,
  ObjectIdSchema,
  PatrolDistributionSchema,
  PatrolLoginSchema,
  SeasonInputSchema,
  SyncBatchSchema,
  SyncOpSchema,
  TargetConfigSchema,
} from '../src/index.js';

/**
 * Schemas de validación (SH-7).
 *
 * Todo input pasa por acá antes de tocar un servicio. Son `.strict()`, así que
 * una propiedad no declarada se rechaza: es lo que previene el mass assignment
 * y, con tipos primitivos explícitos, la inyección NoSQL.
 *
 * Ver docs/SECURITY.md §5 y §6 · docs/TECHNICAL.md §4.
 */

const OID = 'a'.repeat(24);
const UUID = '0192f3a1-8c4e-7000-9abc-1234567890ab';

const torneoValido = {
  seasonId: OID,
  name: '3ª fecha — Liga Bahiense',
  date: '2026-08-08T00:00:00.000Z',
  targets: [{ index: 1, modality: '3d', arrows: 2, description: null }],
  archerIds: [OID, 'b'.repeat(24)],
};

// ── El control transversal ───────────────────────────────────────────────────

describe('inyección NoSQL', () => {
  // Sin esto, { $ne: null } llegaría a un filtro de Mongo y devolvería el
  // primer documento que encuentre.
  it.each([
    [
      'AdminLoginSchema.username',
      AdminLoginSchema,
      { username: { $ne: null }, password: 'x'.repeat(12) },
    ],
    [
      'PatrolLoginSchema.username',
      PatrolLoginSchema,
      { tournamentId: OID, username: { $ne: null }, pin: '123456' },
    ],
    [
      'ArcherInputSchema.firstName',
      ArcherInputSchema,
      { firstName: { $ne: null }, lastName: 'Pérez', category: 'razo' },
    ],
    [
      'CreateTournamentSchema.seasonId',
      CreateTournamentSchema,
      { ...torneoValido, seasonId: { $ne: null } },
    ],
  ])('%s rechaza un operador de Mongo', (_desc, schema, payload) => {
    expect(schema.safeParse(payload).success).toBe(false);
  });

  it('un array de ids rechaza un objeto en lugar de un string', () => {
    const r = CreateTournamentSchema.safeParse({
      ...torneoValido,
      archerIds: [OID, { $ne: null }],
    });
    expect(r.success).toBe(false);
  });

  it('un $where no puede colarse como propiedad extra', () => {
    const r = ArcherInputSchema.safeParse({
      firstName: 'Juan',
      lastName: 'Pérez',
      category: 'razo',
      $where: 'this.password.length > 0',
    });
    expect(r.success).toBe(false);
  });
});

describe('propiedades no declaradas', () => {
  it.each([
    ['AdminLoginSchema', AdminLoginSchema, { username: 'admin', password: 'x'.repeat(12) }],
    [
      'ArcherInputSchema',
      ArcherInputSchema,
      { firstName: 'Juan', lastName: 'Pérez', category: 'razo' },
    ],
    [
      'SeasonInputSchema',
      SeasonInputSchema,
      { name: 'Liga 2026', startsAt: '2026-01-01', endsAt: '2026-12-31' },
    ],
    ['CreateTournamentSchema', CreateTournamentSchema, torneoValido],
  ])('%s rechaza una propiedad extra', (_desc, schema, valido) => {
    expect(schema.safeParse(valido).success).toBe(true);
    expect(schema.safeParse({ ...valido, esAdmin: true }).success).toBe(false);
  });
});

// ── ObjectId ─────────────────────────────────────────────────────────────────

describe('ObjectIdSchema', () => {
  it('acepta 24 caracteres hexadecimales', () => {
    expect(ObjectIdSchema.safeParse(OID).success).toBe(true);
    expect(ObjectIdSchema.safeParse('507f1f77bcf86cd799439011').success).toBe(true);
  });

  it.each([
    ['muy corto', 'abc'],
    ['muy largo', 'a'.repeat(25)],
    ['no hexadecimal', 'z'.repeat(24)],
    ['vacío', ''],
    ['con espacios', ` ${'a'.repeat(23)}`],
  ])('rechaza un id %s', (_desc, valor) => {
    expect(ObjectIdSchema.safeParse(valor).success).toBe(false);
  });

  it('rechaza un objeto', () => {
    expect(ObjectIdSchema.safeParse({ $oid: OID }).success).toBe(false);
  });
});

// ── Auth ─────────────────────────────────────────────────────────────────────

describe('AdminLoginSchema', () => {
  it('acepta credenciales válidas', () => {
    expect(
      AdminLoginSchema.safeParse({ username: 'admin', password: 'CBA2026-largo' }).success,
    ).toBe(true);
  });

  it('normaliza el usuario a minúscula y sin espacios alrededor', () => {
    const r = AdminLoginSchema.parse({ username: '  AdMin  ', password: 'x'.repeat(12) });
    expect(r.username).toBe('admin');
  });

  it('rechaza un password vacío', () => {
    expect(AdminLoginSchema.safeParse({ username: 'admin', password: '' }).success).toBe(false);
  });

  it('acota el largo del password para que no sirva como vector de DoS', () => {
    // argon2id sobre un input enorme cuesta caro.
    expect(
      AdminLoginSchema.safeParse({ username: 'admin', password: 'x'.repeat(500) }).success,
    ).toBe(false);
  });
});

describe('ChangePasswordSchema', () => {
  it('exige al menos 12 caracteres en el nuevo password', () => {
    const base = { currentPassword: 'actual-1234' };
    expect(ChangePasswordSchema.safeParse({ ...base, newPassword: 'corto' }).success).toBe(false);
    expect(ChangePasswordSchema.safeParse({ ...base, newPassword: 'x'.repeat(12) }).success).toBe(
      true,
    );
  });

  it('rechaza que el nuevo password sea igual al actual', () => {
    const igual = 'el-mismo-password';
    expect(
      ChangePasswordSchema.safeParse({ currentPassword: igual, newPassword: igual }).success,
    ).toBe(false);
  });
});

describe('PatrolLoginSchema', () => {
  it('acepta un PIN de 6 dígitos', () => {
    expect(
      PatrolLoginSchema.safeParse({ tournamentId: OID, username: 'patrulla3', pin: '481902' })
        .success,
    ).toBe(true);
  });

  it.each([
    ['de 4 dígitos', '1234'],
    ['de 7 dígitos', '1234567'],
    ['con letras', '12a456'],
    ['vacío', ''],
  ])('rechaza un PIN %s', (_desc, pin) => {
    expect(
      PatrolLoginSchema.safeParse({ tournamentId: OID, username: 'patrulla3', pin }).success,
    ).toBe(false);
  });

  it('rechaza un usuario que no tenga la forma patrullaN', () => {
    for (const username of ['admin', 'patrulla', 'patrulla-3', 'Patrulla3 ']) {
      expect(
        PatrolLoginSchema.safeParse({ tournamentId: OID, username, pin: '123456' }).success,
      ).toBe(false);
    }
  });
});

// ── Torneo ───────────────────────────────────────────────────────────────────

describe('TargetConfigSchema', () => {
  it('acepta un blanco válido', () => {
    expect(
      TargetConfigSchema.safeParse({ index: 1, modality: '3d', arrows: 2, description: null })
        .success,
    ).toBe(true);
  });

  it('rechaza una modalidad inventada', () => {
    expect(
      TargetConfigSchema.safeParse({ index: 1, modality: 'ballesta', arrows: 2, description: null })
        .success,
    ).toBe(false);
  });

  it('acota las flechas al rango configurable de 1 a 12', () => {
    const base = { index: 1, modality: 'sala', description: null };
    expect(TargetConfigSchema.safeParse({ ...base, arrows: 0 }).success).toBe(false);
    expect(TargetConfigSchema.safeParse({ ...base, arrows: 13 }).success).toBe(false);
    expect(TargetConfigSchema.safeParse({ ...base, arrows: 1 }).success).toBe(true);
    expect(TargetConfigSchema.safeParse({ ...base, arrows: 12 }).success).toBe(true);
  });

  it('rechaza flechas decimales', () => {
    expect(
      TargetConfigSchema.safeParse({ index: 1, modality: 'sala', arrows: 2.5, description: null })
        .success,
    ).toBe(false);
  });
});

describe('CreateTournamentSchema', () => {
  it('acepta un torneo válido', () => {
    expect(CreateTournamentSchema.safeParse(torneoValido).success).toBe(true);
  });

  it('exige al menos 2 arqueros: con menos no se puede armar ni una patrulla', () => {
    expect(CreateTournamentSchema.safeParse({ ...torneoValido, archerIds: [OID] }).success).toBe(
      false,
    );
  });

  it('rechaza arqueros repetidos', () => {
    expect(
      CreateTournamentSchema.safeParse({ ...torneoValido, archerIds: [OID, OID] }).success,
    ).toBe(false);
  });

  it('exige al menos un blanco', () => {
    expect(CreateTournamentSchema.safeParse({ ...torneoValido, targets: [] }).success).toBe(false);
  });

  it('exige que los índices de los blancos sean contiguos desde 1', () => {
    const conHueco = {
      ...torneoValido,
      targets: [
        { index: 1, modality: 'sala', arrows: 3, description: null },
        { index: 3, modality: 'sala', arrows: 3, description: null },
      ],
    };
    expect(CreateTournamentSchema.safeParse(conHueco).success).toBe(false);
  });

  it('rechaza índices de blanco repetidos', () => {
    const repetido = {
      ...torneoValido,
      targets: [
        { index: 1, modality: 'sala', arrows: 3, description: null },
        { index: 1, modality: '3d', arrows: 2, description: null },
      ],
    };
    expect(CreateTournamentSchema.safeParse(repetido).success).toBe(false);
  });

  it('acepta el recorrido de referencia del brief, de 14 blancos', () => {
    const targets = [
      ...Array.from({ length: 6 }, (_, i) => ({
        index: i + 1,
        modality: '3d',
        arrows: 2,
        description: null,
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        index: i + 7,
        modality: 'campo',
        arrows: 3,
        description: null,
      })),
      { index: 13, modality: 'aire_libre', arrows: 6, description: null },
      { index: 14, modality: 'sala', arrows: 3, description: null },
    ];
    expect(CreateTournamentSchema.safeParse({ ...torneoValido, targets }).success).toBe(true);
  });

  it('acota el nombre y la descripción', () => {
    expect(CreateTournamentSchema.safeParse({ ...torneoValido, name: 'ab' }).success).toBe(false);
    expect(
      CreateTournamentSchema.safeParse({ ...torneoValido, name: 'x'.repeat(200) }).success,
    ).toBe(false);
  });

  it('la descripción es opcional y por defecto queda vacía', () => {
    expect(CreateTournamentSchema.parse(torneoValido).description).toBe('');
  });
});

describe('PatrolDistributionSchema', () => {
  const valida = {
    patrols: [
      {
        number: 1,
        startTargetIndex: 1,
        units: [{ label: 'A', members: [OID, 'b'.repeat(24)] }],
      },
    ],
  };

  it('acepta una distribución válida', () => {
    expect(PatrolDistributionSchema.safeParse(valida).success).toBe(true);
  });

  it('rechaza una unidad de más de 2 arqueros', () => {
    const conTres = {
      patrols: [
        {
          number: 1,
          startTargetIndex: 1,
          units: [{ label: 'A', members: [OID, 'b'.repeat(24), 'c'.repeat(24)] }],
        },
      ],
    };
    expect(PatrolDistributionSchema.safeParse(conTres).success).toBe(false);
  });

  it('rechaza una patrulla con más de 2 unidades', () => {
    const conTres = {
      patrols: [
        {
          number: 1,
          startTargetIndex: 1,
          units: [
            { label: 'A', members: [OID] },
            { label: 'B', members: ['b'.repeat(24)] },
            { label: 'A', members: ['c'.repeat(24)] },
          ],
        },
      ],
    };
    expect(PatrolDistributionSchema.safeParse(conTres).success).toBe(false);
  });

  it('rechaza una etiqueta de unidad que no sea A o B', () => {
    const mala = {
      patrols: [{ number: 1, startTargetIndex: 1, units: [{ label: 'C', members: [OID] }] }],
    };
    expect(PatrolDistributionSchema.safeParse(mala).success).toBe(false);
  });

  it('rechaza el mismo arquero en dos patrullas', () => {
    const duplicado = {
      patrols: [
        { number: 1, startTargetIndex: 1, units: [{ label: 'A', members: [OID] }] },
        { number: 2, startTargetIndex: 5, units: [{ label: 'A', members: [OID] }] },
      ],
    };
    expect(PatrolDistributionSchema.safeParse(duplicado).success).toBe(false);
  });
});

// ── Sincronización ───────────────────────────────────────────────────────────

describe('SyncOpSchema', () => {
  const scoreOp = {
    type: 'score',
    opId: UUID,
    clientUpdatedAt: '2026-08-10T14:22:31.004Z',
    participantId: OID,
    targetIndex: 7,
    arrows: ['6', '5', 'M'],
  };

  it('acepta una op de puntaje', () => {
    expect(SyncOpSchema.safeParse(scoreOp).success).toBe(true);
  });

  it('rechaza un opId que no sea uuid', () => {
    expect(SyncOpSchema.safeParse({ ...scoreOp, opId: 'no-es-uuid' }).success).toBe(false);
  });

  // Los tokens NO se validan acá contra una lista fija: dependen de la
  // modalidad DEL BLANCO, que el servidor lee del torneo. Ver DOMAIN_WA.md §7.
  it('acepta cualquier token corto: la validación real es por modalidad, en el servidor', () => {
    expect(SyncOpSchema.safeParse({ ...scoreOp, arrows: ['11', '8'] }).success).toBe(true);
    expect(SyncOpSchema.safeParse({ ...scoreOp, arrows: ['X6', '6'] }).success).toBe(true);
  });

  it('acota el largo de cada token, para que no sirva de vector', () => {
    expect(SyncOpSchema.safeParse({ ...scoreOp, arrows: ['x'.repeat(50)] }).success).toBe(false);
  });

  it('acota la cantidad de flechas al máximo configurable', () => {
    expect(
      SyncOpSchema.safeParse({ ...scoreOp, arrows: Array.from({ length: 13 }, () => '5') }).success,
    ).toBe(false);
    expect(SyncOpSchema.safeParse({ ...scoreOp, arrows: [] }).success).toBe(false);
  });

  it('acepta una op de firma', () => {
    const firma = {
      type: 'signature',
      opId: UUID,
      clientUpdatedAt: '2026-08-10T16:10:02.500Z',
      participantId: OID,
      pngDataUrl: `data:image/png;base64,${'A'.repeat(100)}`,
    };
    expect(SyncOpSchema.safeParse(firma).success).toBe(true);
  });

  it('rechaza una firma que no declare ser PNG', () => {
    const falsa = {
      type: 'signature',
      opId: UUID,
      clientUpdatedAt: '2026-08-10T16:10:02.500Z',
      participantId: OID,
      pngDataUrl: 'data:text/html;base64,PHNjcmlwdD4=',
    };
    expect(SyncOpSchema.safeParse(falsa).success).toBe(false);
  });

  it('acota el tamaño de la firma', () => {
    const enorme = {
      type: 'signature',
      opId: UUID,
      clientUpdatedAt: '2026-08-10T16:10:02.500Z',
      participantId: OID,
      pngDataUrl: `data:image/png;base64,${'A'.repeat(MAX_SIGNATURE_BYTES + 1)}`,
    };
    expect(SyncOpSchema.safeParse(enorme).success).toBe(false);
  });

  it('acepta una op de cierre', () => {
    const cierre = { type: 'close', opId: UUID, clientUpdatedAt: '2026-08-10T16:12:00.000Z' };
    expect(SyncOpSchema.safeParse(cierre).success).toBe(true);
  });

  it('rechaza un tipo de op desconocido', () => {
    expect(SyncOpSchema.safeParse({ ...scoreOp, type: 'borrarTodo' }).success).toBe(false);
  });

  it('rechaza una op de cierre con campos de puntaje colados', () => {
    const mezclada = {
      type: 'close',
      opId: UUID,
      clientUpdatedAt: '2026-08-10T16:12:00.000Z',
      participantId: OID,
    };
    expect(SyncOpSchema.safeParse(mezclada).success).toBe(false);
  });
});

describe('SyncBatchSchema', () => {
  const op = (i: number) => ({
    type: 'score' as const,
    opId: `0192f3a1-8c4e-7000-9abc-${String(i).padStart(12, '0')}`,
    clientUpdatedAt: '2026-08-10T14:22:31.004Z',
    participantId: OID,
    targetIndex: 1,
    arrows: ['5'],
  });

  it('acepta un batch de 200 ops', () => {
    // Una patrulla que vuelve de tres horas sin señal manda cientos de golpe.
    const ops = Array.from({ length: 200 }, (_, i) => op(i));
    expect(SyncBatchSchema.safeParse({ ops }).success).toBe(true);
  });

  it('rechaza un batch de más de 200', () => {
    const ops = Array.from({ length: 201 }, (_, i) => op(i));
    expect(SyncBatchSchema.safeParse({ ops }).success).toBe(false);
  });

  it('rechaza un batch vacío', () => {
    expect(SyncBatchSchema.safeParse({ ops: [] }).success).toBe(false);
  });

  it('rechaza opIds repetidos dentro del mismo batch', () => {
    expect(SyncBatchSchema.safeParse({ ops: [op(1), op(1)] }).success).toBe(false);
  });
});

// ── Padrón ───────────────────────────────────────────────────────────────────

describe('ArcherInputSchema', () => {
  it('acepta un arquero válido', () => {
    expect(
      ArcherInputSchema.safeParse({ firstName: 'Juan', lastName: 'Pérez', category: 'razo' })
        .success,
    ).toBe(true);
  });

  it('recorta espacios alrededor del nombre', () => {
    const r = ArcherInputSchema.parse({
      firstName: '  Juan  ',
      lastName: ' Pérez ',
      category: 'razo',
    });
    expect(r.firstName).toBe('Juan');
    expect(r.lastName).toBe('Pérez');
  });

  it('rechaza una categoría inventada', () => {
    expect(
      ArcherInputSchema.safeParse({ firstName: 'Juan', lastName: 'Pérez', category: 'ballesta' })
        .success,
    ).toBe(false);
  });

  it('rechaza nombres vacíos o sólo espacios', () => {
    expect(
      ArcherInputSchema.safeParse({ firstName: '   ', lastName: 'Pérez', category: 'razo' })
        .success,
    ).toBe(false);
  });
});

describe('SeasonInputSchema', () => {
  it('acepta una temporada válida', () => {
    expect(
      SeasonInputSchema.safeParse({
        name: 'Liga Bahiense 2026',
        startsAt: '2026-01-01',
        endsAt: '2026-12-31',
      }).success,
    ).toBe(true);
  });

  it('rechaza una temporada que termina antes de empezar', () => {
    expect(
      SeasonInputSchema.safeParse({
        name: 'Liga Bahiense 2026',
        startsAt: '2026-12-31',
        endsAt: '2026-01-01',
      }).success,
    ).toBe(false);
  });
});
