/**
 * Registro de acciones sensibles.
 *
 * **Nunca datos sensibles en `meta`**: ni tokens, ni hashes, ni PIN.
 * Ver `docs/SECURITY.md` §11.
 */

import type { ClientSession, ObjectId } from 'mongodb';
import { auditLog } from '../db/client.js';
import type { AuditAction, AuditLogDoc, SubjectType } from '../db/types.js';

export interface AuditInput {
  readonly actorType: SubjectType | 'system';
  readonly actorId: ObjectId | null;
  readonly action: AuditAction;
  readonly entity: 'tournament' | 'patrol' | 'participant';
  readonly entityId: ObjectId;
  readonly meta?: Record<string, unknown>;
  readonly ip?: string | null;
}

export async function record(input: AuditInput, session?: ClientSession): Promise<void> {
  await auditLog().insertOne(
    {
      at: new Date(),
      actorType: input.actorType,
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      meta: input.meta ?? {},
      ip: input.ip ?? null,
    } as AuditLogDoc,
    session ? { session } : {},
  );
}

export function listForEntity(
  entity: AuditInput['entity'],
  entityId: ObjectId,
): Promise<AuditLogDoc[]> {
  return auditLog().find({ entity, entityId }).sort({ at: -1 }).limit(200).toArray();
}
