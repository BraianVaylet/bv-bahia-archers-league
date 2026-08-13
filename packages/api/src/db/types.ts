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

export interface ArcherDoc {
  _id: ObjectId;
  firstName: string;
  lastName: string;
  category: BowCategory;
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
}

// ── Sincronización ───────────────────────────────────────────────────────────

export type SyncOpType = 'score' | 'signature' | 'close';
export type SyncOpResult = 'applied' | 'superseded' | 'rejected';

export interface SyncOpDoc {
  /** El `opId` del cliente ES la clave primaria: deduplicar es un insert que falla. */
  _id: string;
  patrolId: ObjectId;
  type: SyncOpType;
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

  leaguePoints: number;
  tournamentsPlayed: number;
  podiums: { first: number; second: number; third: number };

  bestNormalizedPct: number;
  bestRawScore: number;
  bestTournamentId: ObjectId | null;

  /** Los dos mejores porcentajes, de mayor a menor. El promedio se deriva. */
  topTwoPcts: number[];

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
  | 'tournament.create'
  | 'signature.unlock'
  | 'patrol.pin.regenerate'
  | 'patrol.pin.reveal'
  | 'patrol.manual_edit'
  | 'sync.conflict'
  | 'sync.forbidden';

export interface AuditLogDoc {
  _id: ObjectId;
  at: Date;
  actorType: SubjectType | 'system';
  actorId: ObjectId | null;
  action: AuditAction;
  entity: 'tournament' | 'patrol' | 'participant';
  entityId: ObjectId;
  /** Nunca datos sensibles: ni tokens, ni hashes, ni PIN. */
  meta: Record<string, unknown>;
  ip: string | null;
}
