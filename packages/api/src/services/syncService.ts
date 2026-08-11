/**
 * Sincronización del outbox de WAFL.
 *
 * La tarea más crítica del backend. Cada operación pasa por los seis pasos de
 * `docs/OFFLINE_SYNC.md` §6, **en ese orden**:
 *
 *   1. DEDUP      insert en `syncOps` con `_id = opId`; `E11000` → duplicada
 *   2. AUTORIZAR  ¿el participante es de ESTA patrulla?
 *   3. VALIDAR    contra la modalidad DEL BLANCO, leída del torneo en base
 *   4. LWW        gana el `clientUpdatedAt` más reciente
 *   5. APLICAR    upsert + delta a los rollups, en la misma transacción
 *   6. RESPONDER  resultado individual de cada op
 *
 * **El batch nunca falla entero por una op mala**: siempre responde 200 con el
 * resultado de cada una. Un `close` rechazado no puede hacer que se pierdan 40
 * puntajes válidos del mismo batch.
 */

import {
  type Modality,
  type SyncBatchInput,
  type SyncOpInput,
  validateTargetScore,
} from '@bal/shared';
import { type ClientSession, ObjectId } from 'mongodb';
import { getClient } from '../db/client.js';
import type { ScoreDoc, TournamentDoc } from '../db/types.js';
import * as auditRepo from '../repositories/auditRepo.js';
import * as patrolRepo from '../repositories/patrolRepo.js';
import * as scoreRepo from '../repositories/scoreRepo.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';
import { transition } from './tournamentStateService.js';

export type OpStatus = 'applied' | 'duplicate' | 'superseded' | 'rejected';

export interface OpResult {
  readonly opId: string;
  readonly status: OpStatus;
  readonly score?: {
    total: number;
    innerCount: number;
    xCount: number;
    tenCount: number;
    mCount: number;
  };
  readonly error?: { code: string; message: string };
}

export interface SyncResult {
  readonly results: readonly OpResult[];
  readonly patrol: { status: string; targetsCompleted: number };
  readonly serverTime: string;
}

const MODALIDADES_EN_CERO: Record<Modality, number> = {
  sala: 0,
  aire_libre: 0,
  campo: 0,
  '3d': 0,
};

const rechazo = (opId: string, code: string, message: string): OpResult => ({
  opId,
  status: 'rejected',
  error: { code, message },
});

/**
 * Procesa un batch de operaciones.
 *
 * Cada op corre en **su propia transacción**: una op inválida no puede revertir
 * las que ya se aplicaron correctamente en el mismo batch.
 */
export async function sync(
  batch: SyncBatchInput,
  patrolId: ObjectId,
  tournamentId: ObjectId,
): Promise<SyncResult> {
  const torneo = await tournamentRepo.findById(tournamentId);
  if (!torneo) {
    throw new Error('El torneo de la sesión ya no existe.');
  }

  const results: OpResult[] = [];
  for (const op of batch.ops) {
    results.push(await procesarOp(op, patrolId, torneo));
  }

  const patrulla = await patrolRepo.findById(patrolId);

  return {
    results,
    patrol: {
      status: patrulla?.status ?? 'en_curso',
      targetsCompleted: patrulla?.targetsCompleted ?? 0,
    },
    serverTime: new Date().toISOString(),
  };
}

/**
 * Procesa una op.
 *
 * **El dedup ocurre FUERA de la transacción, a propósito.** En MongoDB, un error
 * de clave duplicada *dentro* de una transacción la aborta, y capturarlo no la
 * revive: el `insert` de `syncOps` tiene que ser una operación suelta. Se hace
 * primero, se aplican las escrituras en una transacción, y si algo falla se
 * borra la marca para que el reintento del cliente vuelva a entrar.
 *
 * Riesgo residual: si el proceso muere entre la marca y el commit, la op queda
 * marcada sin haberse aplicado y el reintento la ve como duplicada. La ventana
 * es de milisegundos y el costo es un puntaje; el líder lo ve faltante en la
 * pantalla de resultados y lo vuelve a cargar, que genera un `opId` nuevo.
 */
async function procesarOp(
  op: SyncOpInput,
  patrolId: ObjectId,
  torneo: TournamentDoc,
): Promise<OpResult> {
  // Paso 1 — DEDUP. Insert atómico contra el índice único: no hay ventana entre
  // comprobar y escribir, como sí la habría con un `findOne` previo.
  if (!(await scoreRepo.claimOp(op.opId, patrolId, op.type, 'applied'))) {
    return { opId: op.opId, status: 'duplicate' };
  }

  const session = getClient().startSession();

  try {
    let resultado: OpResult = rechazo(op.opId, 'INTERNAL', 'No se pudo procesar.');

    await session.withTransaction(async () => {
      resultado =
        op.type === 'score'
          ? await aplicarScore(op, patrolId, torneo, session)
          : op.type === 'signature'
            ? await aplicarFirma(op, patrolId, session)
            : await aplicarCierre(op, patrolId, torneo, session);
    });

    // Una op rechazada queda registrada como tal: si el cliente la reenvía con
    // el mismo opId se le responde `duplicate`, no se reprocesa.
    if (resultado.status !== 'applied') {
      await scoreRepo.markOpResult(op.opId, 'rejected');
    }

    return resultado;
  } catch (error) {
    // La transacción se revirtió sola. Se borra la marca para que el reintento
    // del cliente pueda volver a entrar.
    await scoreRepo.releaseOp(op.opId);
    throw error;
  } finally {
    await session.endSession();
  }
}

// ── Puntaje ──────────────────────────────────────────────────────────────────

async function aplicarScore(
  op: Extract<SyncOpInput, { type: 'score' }>,
  patrolId: ObjectId,
  torneo: TournamentDoc,
  session: ClientSession,
): Promise<OpResult> {
  // Paso 2 — AUTORIZAR. Dentro del loop, por op: un batch puede traer 200 y
  // cualquiera podría apuntar a un participante ajeno. Esto es lo que impide
  // el IDOR entre patrullas. Ver docs/SECURITY.md §4.
  const participante = await scoreRepo.findParticipant(new ObjectId(op.participantId), session);

  if (
    !participante ||
    !participante.patrolId.equals(patrolId) ||
    !participante.tournamentId.equals(torneo._id)
  ) {
    await auditRepo.record(
      {
        actorType: 'patrol',
        actorId: patrolId,
        action: 'sync.forbidden',
        entity: 'participant',
        entityId: new ObjectId(op.participantId),
        meta: { opId: op.opId },
      },
      session,
    );
    return rechazo(op.opId, 'FORBIDDEN', 'Ese arquero no es de tu patrulla.');
  }

  // Paso 3 — VALIDAR contra la modalidad DEL BLANCO, leída del torneo en base.
  // Nunca contra lo que diga el cliente.
  const blanco = torneo.targets.find((t) => t.index === op.targetIndex);
  if (!blanco) {
    return rechazo(op.opId, 'NOT_FOUND', 'Ese blanco no existe en el torneo.');
  }

  const validacion = validateTargetScore(blanco.modality, blanco.arrows, op.arrows);
  if (!validacion.ok) {
    const { error } = validacion;
    return rechazo(
      op.opId,
      error.code,
      error.code === 'ARROW_COUNT'
        ? `Este blanco es de ${error.expected} flechas y llegaron ${error.got}.`
        : `El puntaje "${error.token}" no es válido para un blanco de ${blanco.modality}.`,
    );
  }

  const computo = validacion.value;

  // Paso 4 — LWW. Gana el clientUpdatedAt más reciente; a igualdad, el opId
  // mayor, para que el desempate sea determinista.
  const existente = await scoreRepo.findScore(participante._id, op.targetIndex, session);

  if (existente) {
    const masViejo =
      existente.clientUpdatedAt > op.clientUpdatedAt ||
      (existente.clientUpdatedAt.getTime() === op.clientUpdatedAt.getTime() &&
        existente.lastOpId >= op.opId);

    if (masViejo) {
      await auditRepo.record(
        {
          actorType: 'patrol',
          actorId: patrolId,
          action: 'sync.conflict',
          entity: 'participant',
          entityId: participante._id,
          meta: { opId: op.opId, targetIndex: op.targetIndex },
        },
        session,
      );

      return {
        opId: op.opId,
        status: 'superseded',
        score: {
          total: existente.total,
          innerCount: existente.innerCount,
          xCount: existente.xCount,
          tenCount: existente.tenCount,
          mCount: existente.mCount,
        },
      };
    }
  }

  // Paso 5 — APLICAR. Los totales son los que RECALCULÓ el servidor; el cliente
  // no manda totales y si los mandara se ignorarían.
  const ahora = new Date();
  const doc: ScoreDoc = {
    _id: existente?._id ?? new ObjectId(),
    tournamentId: torneo._id,
    patrolId,
    participantId: participante._id,
    targetIndex: op.targetIndex,
    modality: blanco.modality,
    arrows: [...op.arrows],
    total: computo.total,
    innerCount: computo.innerCount,
    xCount: computo.xCount,
    tenCount: computo.tenCount,
    mCount: computo.mCount,
    clientUpdatedAt: op.clientUpdatedAt,
    lastOpId: op.opId,
    createdAt: existente?.createdAt ?? ahora,
    updatedAt: ahora,
  };

  await scoreRepo.upsertScore(doc, session);

  // El delta descuenta lo que había: editar un blanco no debe sumar dos veces.
  const byModality = { ...MODALIDADES_EN_CERO };
  byModality[blanco.modality] = computo.total - (existente?.total ?? 0);

  await scoreRepo.applyRollupDelta(
    participante._id,
    {
      total: computo.total - (existente?.total ?? 0),
      innerCount: computo.innerCount - (existente?.innerCount ?? 0),
      xCount: computo.xCount - (existente?.xCount ?? 0),
      tenCount: computo.tenCount - (existente?.tenCount ?? 0),
      mCount: computo.mCount - (existente?.mCount ?? 0),
      targetsCompleted: existente ? 0 : 1,
      byModality,
    },
    torneo.maxPossibleScore,
    session,
  );

  await actualizarAvanceDePatrulla(patrolId, session);

  return {
    opId: op.opId,
    status: 'applied',
    score: {
      total: computo.total,
      innerCount: computo.innerCount,
      xCount: computo.xCount,
      tenCount: computo.tenCount,
      mCount: computo.mCount,
    },
  };
}

/** Blancos en los que TODOS los participantes de la patrulla ya tienen puntaje. */
async function actualizarAvanceDePatrulla(
  patrolId: ObjectId,
  session: ClientSession,
): Promise<void> {
  const miembros = await tournamentRepo.listParticipantsOfPatrol(patrolId);
  const puntajes = await scoreRepo.listScoresOfPatrol(patrolId);

  const porBlanco = new Map<number, number>();
  for (const s of puntajes) {
    porBlanco.set(s.targetIndex, (porBlanco.get(s.targetIndex) ?? 0) + 1);
  }

  let completos = 0;
  for (const cantidad of porBlanco.values()) {
    if (cantidad >= miembros.length) completos++;
  }

  await patrolRepo.setTargetsCompleted(patrolId, completos, session);
}

// ── Firma ────────────────────────────────────────────────────────────────────

async function aplicarFirma(
  op: Extract<SyncOpInput, { type: 'signature' }>,
  patrolId: ObjectId,
  session: ClientSession,
): Promise<OpResult> {
  const participante = await scoreRepo.findParticipant(new ObjectId(op.participantId), session);

  if (!participante || !participante.patrolId.equals(patrolId)) {
    return rechazo(op.opId, 'FORBIDDEN', 'Ese arquero no es de tu patrulla.');
  }

  const png = decodificarPng(op.pngDataUrl);
  if (!png) {
    return rechazo(op.opId, 'VALIDATION_ERROR', 'La firma no es un PNG válido.');
  }

  await scoreRepo.setSignature(
    participante._id,
    {
      pngDataUrl: op.pngDataUrl,
      signedAt: new Date(),
      // Hash del puntaje al momento de firmar: si después cambia, el cierre lo
      // detecta. Ver docs/SECURITY.md §7.
      scorecardHash: await scoreRepo.scorecardHashOf(participante),
      unlockedBy: null,
      unlockReason: null,
    },
    session,
  );

  return { opId: op.opId, status: 'applied' };
}

/**
 * Verifica que el data URL contenga un PNG real.
 *
 * No alcanza con el prefijo `data:image/png;base64,`: es texto que el cliente
 * elige. Se comprueban los **magic bytes** del formato.
 */
function decodificarPng(dataUrl: string): Buffer | null {
  const base64 = dataUrl.slice('data:image/png;base64,'.length);
  let bytes: Buffer;

  try {
    bytes = Buffer.from(base64, 'base64');
  } catch {
    return null;
  }

  const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < FIRMA_PNG.length || !bytes.subarray(0, 8).equals(FIRMA_PNG)) {
    return null;
  }

  return bytes;
}

// ── Cierre del circuito ──────────────────────────────────────────────────────

async function aplicarCierre(
  op: Extract<SyncOpInput, { type: 'close' }>,
  patrolId: ObjectId,
  torneo: TournamentDoc,
  session: ClientSession,
): Promise<OpResult> {
  const miembros = await tournamentRepo.listParticipantsOfPatrol(patrolId);
  const activos = miembros.filter((m) => m.status === 'activo');

  // Todos los blancos, de todos los arqueros.
  const puntajes = await scoreRepo.listScoresOfPatrol(patrolId);
  const esperados = activos.length * torneo.targets.length;

  if (puntajes.length < esperados) {
    return rechazo(
      op.opId,
      'VALIDATION_ERROR',
      `Faltan puntajes: hay ${puntajes.length} de ${esperados}.`,
    );
  }

  const sinFirmar = activos.filter((m) => m.signature === null);
  if (sinFirmar.length > 0) {
    return rechazo(
      op.opId,
      'SIGNATURES_MISSING',
      `Faltan las firmas de ${sinFirmar.map((m) => m.lastName).join(', ')}.`,
    );
  }

  // El puntaje no puede haber cambiado después de firmarse.
  for (const miembro of activos) {
    const actual = await scoreRepo.scorecardHashOf(miembro);
    if (miembro.signature && miembro.signature.scorecardHash !== actual) {
      return rechazo(
        op.opId,
        'SIGNATURE_MISMATCH',
        `El puntaje de ${miembro.lastName} cambió después de firmarse.`,
      );
    }
  }

  await patrolRepo.setStatus(patrolId, 'cerrada', { closedAt: new Date() }, session);

  await auditRepo.record(
    {
      actorType: 'patrol',
      actorId: patrolId,
      action: 'patrol.manual_edit',
      entity: 'patrol',
      entityId: patrolId,
      meta: { closed: true },
    },
    session,
  );

  // Si era la última patrulla abierta, el torneo pasa a completado solo.
  if ((await patrolRepo.countOpen(torneo._id, session)) === 0) {
    await transition(torneo._id, 'completado', { completedAt: new Date() }, session);
  }

  return { opId: op.opId, status: 'applied' };
}
