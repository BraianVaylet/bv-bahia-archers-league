/**
 * Documentos de MongoDB.
 *
 * Espejo tipado del esquema de `docs/TECHNICAL.md` §2. Cualquier cambio acá
 * exige actualizar ese documento y registrarlo en la bitácora.
 */

import type {
  BowCategory,
  Modality,
  PatrolStatus,
  Position,
  Sex,
  Stake,
  TournamentStatus,
  Unit,
} from '@bal/shared';
import type { ObjectId } from 'mongodb';

export const COLLECTIONS = {
  users: 'users',
  sessions: 'sessions',
  seasons: 'seasons',
  archers: 'archers',
  tournaments: 'tournaments',
  patrols: 'patrols',
  participants: 'participants',
  scores: 'scores',
  syncOps: 'syncOps',
  standings: 'standings',
  auditLog: 'auditLog',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface UserDoc {
  _id: ObjectId;
  username: string;
  passwordHash: string;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  failedAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SubjectType = 'admin' | 'patrol';

export interface SessionDoc {
  _id: ObjectId;
  /** `sha256(token)`. El token en claro sólo vive en la cookie. */
  tokenHash: string;
  subjectType: SubjectType;
  subjectId: ObjectId;
  tournamentId: ObjectId | null;
  expiresAt: Date;
  createdAt: Date;
  ip: string | null;
  userAgent: string | null;
}

// ── Liga ─────────────────────────────────────────────────────────────────────

export interface SeasonDoc {
  _id: ObjectId;
  name: string;
  startsAt: Date;
  endsAt: Date;
  status: 'activa' | 'cerrada';
  createdAt: Date;
  updatedAt: Date;
}

/** `aprobado` de entrada si lo crea el admin; `pendiente` si se autoregistró (`BE-20`). */
export type ArcherRegistrationStatus = 'pendiente' | 'aprobado';

export interface ArcherDoc {
  _id: ObjectId;
  firstName: string;
  lastName: string;
  category: BowCategory;
  /** `null`: el padrón anterior a este campo no lo tenía cargado. No se inventa el valor. */
  sex: Sex | null;
  /** 7-8 dígitos, sin puntos. `null` en el padrón viejo. Único entre los no nulos. */
  dni: string | null;
  registrationStatus: ArcherRegistrationStatus;
  /** Apellido y nombre normalizados, sin acentos, para buscar. */
  searchKey: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Torneo ───────────────────────────────────────────────────────────────────

export interface TargetDoc {
  /** 1-based, contiguo y único dentro del torneo. */
  index: number;
  modality: Modality;
  arrows: number;
  description: string | null;
}

export type StakeMapDoc = Record<Stake, BowCategory[]>;

export interface TournamentDoc {
  _id: ObjectId;
  seasonId: ObjectId;
  name: string;
  date: Date;
  description: string;
  /**
   * Link a un formulario o planilla externa de pre-inscripción (`BE-27`), sólo `https:`.
   * **Opcional en el tipo**: los torneos creados antes no tienen la clave. Se lee con `?? null`.
   */
  registrationUrl?: string | null;
  status: TournamentStatus;

  /**
   * Inscripción: **un monto único para todos los arqueros**.
   *
   * La recaudación no se guarda, se deriva —pagos × monto— para que no exista
   * un total que pueda quedar desfasado de los pagos que lo componen.
   */
  payment: { required: boolean; amount: number };

  /** Embebido: son 14-28 y siempre se leen junto con el torneo. */
  targets: TargetDoc[];
  maxPossibleScore: number;
  stakeMap: StakeMapDoc;
  distances: Record<Stake, number> | null;
  patrolCount: number;
  participantCount: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  publishedAt: Date | null;
  publishedBy: ObjectId | null;
  /**
   * La última corrección de puntajes del admin (`BE-25`). Además de dato, es el ancla de la
   * transacción: escribirlo condicionado a `completado` hace que una corrección y un «publicar»
   * simultáneos choquen (`WriteConflict`) en vez de cruzarse. Opcional: los torneos viejos no lo tienen.
   */
  lastCorrectedAt?: Date;
}

export interface PatrolDoc {
  _id: ObjectId;
  tournamentId: ObjectId;
  number: number;
  startTargetIndex: number;
  username: string;
  /** argon2id, para verificar el login. */
  pinHash: string;
  /** AES-256-GCM, para que el admin pueda volver a mostrarlo. Ver SECURITY.md §9. */
  pinEnc: string;
  pinUpdatedAt: Date;
  status: PatrolStatus;
  failedAttempts: number;
  lockedUntil: Date | null;
  targetsCompleted: number;
  closedAt: Date | null;
  /** `true` si el admin editó la composición a mano. */
  manualOverride: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SignatureDoc {
  pngDataUrl: string;
  signedAt: Date;
  /** `sha256` del puntaje al momento de firmar. Detecta alteraciones posteriores. */
  scorecardHash: string;
  unlockedBy: ObjectId | null;
  unlockReason: string | null;
}

export interface ParticipantDoc {
  _id: ObjectId;
  tournamentId: ObjectId;
  patrolId: ObjectId;
  archerId: ObjectId;

  // Snapshot congelado al crear el torneo: el histórico no cambia si el
  // arquero se edita o se archiva después.
  firstName: string;
  lastName: string;
  category: BowCategory;
  /** `null` si el arquero no tenía `sex` cargado al crearse el torneo. */
  sex: Sex | null;

  stake: Stake;
  unit: Unit;
  position: Position;

  // Rollups denormalizados. Se actualizan por delta en la misma transacción
  // que el puntaje, así podios y estadísticas no recorren flechas.
  total: number;
  innerCount: number;
  xCount: number;
  tenCount: number;
  mCount: number;
  targetsCompleted: number;
  normalizedPct: number;
  byModality: Record<Modality, number>;

  status: 'activo' | 'ausente';

  /**
   * Si pagó la inscripción. **El monto no vive acá**: es el del torneo, uno
   * solo para todos. Guardarlo por participante permitiría que dos arqueros del
   * mismo torneo tuvieran montos distintos sin que nada lo impida.
   */
  paid: boolean;

  signature: SignatureDoc | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScoreDoc {
  _id: ObjectId;
  tournamentId: ObjectId;
  patrolId: ObjectId;
  participantId: ObjectId;
  targetIndex: number;
  modality: Modality;
  arrows: string[];

  // Todo lo que sigue lo calcula el servidor. Nunca se acepta del cliente.
  total: number;
  innerCount: number;
  xCount: number;
  tenCount: number;
  mCount: number;

  /** Reloj del cliente, corregido por desfase. Criterio de last-write-wins. */
  clientUpdatedAt: Date;
  lastOpId: string;
  createdAt: Date;
  updatedAt: Date;
  /**
   * Si el admin corrigió este blanco contra la planilla de papel (`BE-25`), quién y cuándo.
   * **Opcional**: los puntajes que sólo anotó el líder no tienen la clave.
   */
  correctedBy?: ObjectId | null;
  correctedAt?: Date;
}

// ── Sincronización ───────────────────────────────────────────────────────────

export type SyncOpType = 'score' | 'signature' | 'close';
/**
 * Cómo terminó una op de sync. `processing` es la marca de dedup que nace antes de aplicarla
 * (`REF6-13` / `B-4`): si el proceso muere antes del commit, la op queda ahí y se reprocesa.
 */
export type SyncOpResult = 'processing' | 'applied' | 'superseded' | 'rejected';

export interface SyncOpDoc {
  /** El `opId` del cliente ES la clave primaria: deduplicar es un insert que falla. */
  _id: string;
  patrolId: ObjectId;
  type: SyncOpType;
  /**
   * Cuándo se marcó la op. Con `processing`, desde cuándo se está procesando: pasado el plazo de
   * reproceso se da por abandonada (el proceso murió) y otro request la retoma, renovando la hora.
   */
  appliedAt: Date;
  result: SyncOpResult;
  /** TTL. */
  expiresAt: Date;
}

// ── Liga materializada ───────────────────────────────────────────────────────

export interface StandingDoc {
  _id: ObjectId;
  seasonId: ObjectId;
  category: BowCategory;
  archerId: ObjectId;
  firstName: string;
  lastName: string;
  /** Snapshot del arquero, para el ranking por sexo (`SH-10`). `null`: no cargado. */
  sex: Sex | null;

  tournamentsPlayed: number;

  bestNormalizedPct: number;
  bestRawScore: number;
  bestTournamentId: ObjectId | null;

  /**
   * Los `bestN` mejores porcentajes, de mayor a menor. El promedio se deriva.
   * `bestN` es `LEAGUE_BEST_N`, variable de entorno — no un número fijo.
   */
  topNPcts: number[];

  totalX: number;
  totalTens: number;
  totalM: number;
  updatedAt: Date;
}

// ── Auditoría ────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'tournament.publish'
  | 'tournament.unpublish'
  | 'tournament.target_edit'
  | 'tournament.participants_edit'
  | 'tournament.unstart'
  | 'tournament.create'
  | 'tournament.start'
  | 'tournament.delete'
  | 'tournament.update'
  | 'score.admin_correct'
  | 'signature.unlock'
  | 'patrol.pin.regenerate'
  | 'patrol.pin.reveal'
  | 'patrol.manual_edit'
  /** La patrulla cerró el circuito: todas las firmas puestas. */
  | 'patrol.close'
  | 'sync.conflict'
  | 'sync.forbidden'
  /** El operador cambió `ADMIN_INITIAL_PASSWORD` y el admin quedó reseteado. */
  /** Se recuperó el password con el código de `ADMIN_INITIAL_PASSWORD`. */
  | 'admin.password_recovered'
  /** Un ingreso correcto del administrador. Los fallidos no se registran: ver `REF6-7`. */
  | 'admin.login'
  /** Padrón: alta, edición, archivo, restauración y baja hechos por el admin. */
  | 'archer.create'
  | 'archer.update'
  | 'archer.archive'
  | 'archer.restore'
  | 'archer.delete'
  | 'season.create'
  | 'season.update'
  | 'season.close'
  | 'season.reopen'
  /** Se marcó o desmarcó el pago de un arquero. Es plata. */
  | 'payment.set'
  /** Alguien probó un código de recuperación equivocado. */
  | 'admin.recovery_failed'
  /** Un arquero autoregistrado (`BE-20`) pasó de `pendiente` a `aprobado`. */
  | 'archer.approve'
  /** Un arquero autoregistrado se rechazó y se borró del padrón. */
  | 'archer.reject'
  /**
   * Alguien se anotó con un DNI que ya estaba en esa categoría. Al visitante se le
   * responde igual que a un alta nueva (no puede ser un oráculo); acá queda el
   * rastro para el admin.
   */
  | 'archer.register_duplicate';

export type AuditEntity = 'tournament' | 'patrol' | 'participant' | 'user' | 'archer' | 'season';

export interface AuditLogDoc {
  _id: ObjectId;
  at: Date;
  actorType: SubjectType | 'system';
  actorId: ObjectId | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId: ObjectId;
  /** Nunca datos sensibles: ni tokens, ni hashes, ni PIN. */
  meta: Record<string, unknown>;
  ip: string | null;
}
