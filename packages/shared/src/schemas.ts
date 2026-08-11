/**
 * Schemas de validación, compartidos por backend y frontends.
 *
 * **Todos son estrictos**: una propiedad no declarada se rechaza. Es lo que
 * previene el mass assignment y, con tipos primitivos explícitos, la inyección
 * NoSQL — `{ $ne: null }` no es un `string`, así que nunca llega a un filtro
 * de Mongo.
 *
 * Ver `docs/SECURITY.md` §5 y §6 · `docs/TECHNICAL.md` §4.
 */

import { z } from 'zod';
import {
  MAX_ARROWS_PER_TARGET,
  MAX_PATROL_SIZE,
  MIN_ARROWS_PER_TARGET,
  MIN_PATROL_SIZE,
} from './constants.js';
import { BOW_CATEGORIES, MODALITIES, UNITS } from './domain.js';

// ── Primitivos ───────────────────────────────────────────────────────────────

/** `ObjectId` de Mongo en hexadecimal. Se valida antes de construir uno. */
export const ObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido.');

/** Texto de una línea: recortado, no vacío, con tope. */
const texto = (min: number, max: number) => z.string().trim().min(min).max(max);

export const MAX_TARGETS = 60;
export const MAX_PARTICIPANTS = 200;
export const MAX_SYNC_OPS = 200;
/** Tope del data URL de una firma. Un trazo comprimido entra muy por debajo. */
export const MAX_SIGNATURE_BYTES = 60_000;
/** Tope del password. argon2id sobre un input enorme cuesta caro: es un vector de DoS. */
export const MAX_PASSWORD_LENGTH = 128;
export const MIN_PASSWORD_LENGTH = 12;

const CategorySchema = z.enum(BOW_CATEGORIES);
const ModalitySchema = z.enum(MODALITIES);

// ── Auth ─────────────────────────────────────────────────────────────────────

export const AdminLoginSchema = z.strictObject({
  username: z.string().trim().toLowerCase().min(3).max(60),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});

export const ChangePasswordSchema = z
  .strictObject({
    currentPassword: z.string().min(1).max(MAX_PASSWORD_LENGTH),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'El password nuevo tiene que ser distinto del actual.',
    path: ['newPassword'],
  });

export const PatrolLoginSchema = z.strictObject({
  tournamentId: ObjectIdSchema,
  /** `patrulla` + número. Ver `docs/DOMAIN_WA.md` §6. */
  username: z.string().regex(/^patrulla\d{1,3}$/, 'Usuario de patrulla inválido.'),
  /** Seis dígitos. Ver `docs/SECURITY.md` §3.2. */
  pin: z.string().regex(/^\d{6}$/, 'El PIN tiene 6 dígitos.'),
});

// ── Padrón y temporadas ──────────────────────────────────────────────────────

export const ArcherInputSchema = z.strictObject({
  firstName: texto(1, 60),
  lastName: texto(1, 60),
  category: CategorySchema,
});

export const SeasonInputSchema = z
  .strictObject({
    name: texto(3, 120),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((v) => v.endsAt > v.startsAt, {
    message: 'La temporada no puede terminar antes de empezar.',
    path: ['endsAt'],
  });

// ── Torneo ───────────────────────────────────────────────────────────────────

export const TargetConfigSchema = z.strictObject({
  index: z.number().int().min(1).max(MAX_TARGETS),
  modality: ModalitySchema,
  arrows: z.number().int().min(MIN_ARROWS_PER_TARGET).max(MAX_ARROWS_PER_TARGET),
  description: texto(1, 120).nullable().default(null),
});

// Escritos explícitos, no generados desde STAKES: las tres estacas son
// semántica fija del dominio y así el schema se lee de un vistazo.
const listaDeCategorias = z.array(CategorySchema).max(BOW_CATEGORIES.length);

const StakeMapSchema = z.strictObject({
  roja: listaDeCategorias,
  azul: listaDeCategorias,
  amarilla: listaDeCategorias,
});

const metros = z.number().int().min(1).max(200);

const DistancesSchema = z.strictObject({
  roja: metros,
  azul: metros,
  amarilla: metros,
});

/** Los índices de los blancos tienen que ser contiguos desde 1, sin repetidos. */
function indicesContiguos(targets: readonly { index: number }[]): boolean {
  const ordenados = targets.map((t) => t.index).sort((a, b) => a - b);
  return ordenados.every((valor, i) => valor === i + 1);
}

export const CreateTournamentSchema = z
  .strictObject({
    seasonId: ObjectIdSchema,
    name: texto(3, 120),
    date: z.coerce.date(),
    description: z.string().max(1000).default(''),
    targets: z.array(TargetConfigSchema).min(1).max(MAX_TARGETS),
    // Mínimo 2: con menos no se puede armar ni una patrulla (H1).
    archerIds: z.array(ObjectIdSchema).min(MIN_PATROL_SIZE).max(MAX_PARTICIPANTS),
    stakeMap: StakeMapSchema.optional(),
    distances: DistancesSchema.optional(),
  })
  .refine((v) => new Set(v.archerIds).size === v.archerIds.length, {
    message: 'Hay arqueros repetidos.',
    path: ['archerIds'],
  })
  .refine((v) => indicesContiguos(v.targets), {
    message: 'Los blancos tienen que estar numerados de 1 a N, sin huecos ni repetidos.',
    path: ['targets'],
  });

export const UpdateTournamentSchema = z.strictObject({
  name: texto(3, 120).optional(),
  date: z.coerce.date().optional(),
  description: z.string().max(1000).optional(),
  targets: z.array(TargetConfigSchema).min(1).max(MAX_TARGETS).optional(),
});

// ── Patrullas ────────────────────────────────────────────────────────────────

const PlannedUnitSchema = z.strictObject({
  label: z.enum(UNITS),
  /** Una unidad tira de a uno o de a dos. */
  members: z.array(ObjectIdSchema).min(1).max(2),
});

const PlannedPatrolSchema = z.strictObject({
  number: z.number().int().min(1).max(MAX_PARTICIPANTS),
  startTargetIndex: z.number().int().min(1).max(MAX_TARGETS),
  /** Una patrulla tiene una o dos unidades: `A` y `B`. */
  units: z.array(PlannedUnitSchema).min(1).max(2),
});

/**
 * Distribución manual de patrullas.
 *
 * Valida la **forma**; las restricciones de dominio `H1`..`H4` las verifica
 * `validatePatrols`, que informa sin bloquear porque el admin puede tener
 * motivos para una excepción. Ver `docs/FUNCTIONAL.md` §6.6.
 */
export const PatrolDistributionSchema = z
  .strictObject({
    patrols: z
      .array(PlannedPatrolSchema)
      .min(1)
      .max(MAX_PARTICIPANTS / MIN_PATROL_SIZE),
  })
  .refine(
    (v) => {
      const todos = v.patrols.flatMap((p) => p.units.flatMap((u) => u.members));
      return new Set(todos).size === todos.length;
    },
    { message: 'Hay arqueros repetidos entre patrullas.', path: ['patrols'] },
  )
  .refine(
    (v) => v.patrols.every((p) => p.units.flatMap((u) => u.members).length <= MAX_PATROL_SIZE),
    {
      message: `Una patrulla no puede tener más de ${MAX_PATROL_SIZE} arqueros.`,
      path: ['patrols'],
    },
  );

// ── Sincronización ───────────────────────────────────────────────────────────

const opBase = {
  opId: z.uuid('El identificador de la operación tiene que ser un UUID.'),
  clientUpdatedAt: z.coerce.date(),
};

export const SyncOpSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...opBase,
    type: z.literal('score'),
    participantId: ObjectIdSchema,
    targetIndex: z.number().int().min(1).max(MAX_TARGETS),
    /**
     * Los tokens **no** se validan acá contra una lista fija: el set válido
     * depende de la modalidad **de ese blanco**, que el servidor lee del torneo
     * en base. Acá sólo se acota la forma. Ver `docs/DOMAIN_WA.md` §7.
     */
    arrows: z.array(z.string().min(1).max(2)).min(1).max(MAX_ARROWS_PER_TARGET),
  }),

  z.strictObject({
    ...opBase,
    type: z.literal('signature'),
    participantId: ObjectIdSchema,
    pngDataUrl: z
      .string()
      .max(MAX_SIGNATURE_BYTES)
      .startsWith('data:image/png;base64,', 'La firma tiene que ser un PNG.'),
  }),

  z.strictObject({ ...opBase, type: z.literal('close') }),
]);

export const SyncBatchSchema = z
  .strictObject({
    ops: z.array(SyncOpSchema).min(1).max(MAX_SYNC_OPS),
  })
  .refine((v) => new Set(v.ops.map((o) => o.opId)).size === v.ops.length, {
    message: 'Hay operaciones repetidas en el batch.',
    path: ['ops'],
  });

// ── Tipos inferidos ──────────────────────────────────────────────────────────

export type AdminLoginInput = z.infer<typeof AdminLoginSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type PatrolLoginInput = z.infer<typeof PatrolLoginSchema>;
export type ArcherInput = z.infer<typeof ArcherInputSchema>;
export type SeasonInput = z.infer<typeof SeasonInputSchema>;
export type TargetConfigInput = z.infer<typeof TargetConfigSchema>;
export type CreateTournamentInput = z.infer<typeof CreateTournamentSchema>;
export type UpdateTournamentInput = z.infer<typeof UpdateTournamentSchema>;
export type PatrolDistributionInput = z.infer<typeof PatrolDistributionSchema>;
export type SyncOpInput = z.infer<typeof SyncOpSchema>;
export type SyncBatchInput = z.infer<typeof SyncBatchSchema>;
