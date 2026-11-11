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

import { type SyncBatchInput, type SyncOpInput, validateTargetScore } from '@bal/shared';
import { type ClientSession, ObjectId } from 'mongodb';
import { iniciarSesion } from '../db/sesion.js';
import type { ParticipantDoc, ScoreDoc, TournamentDoc } from '../db/types.js';
import { AppError, type ErrorCode } from '../lib/errors.js';
import { log } from '../lib/logger.js';
import * as auditRepo from '../repositories/auditRepo.js';
import * as patrolRepo from '../repositories/patrolRepo.js';
import * as scoreRepo from '../repositories/scoreRepo.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';
import { escribirPuntaje } from './escrituraDePuntaje.js';
import { conTransaccion } from './tournamentService.js';
import { transition } from './tournamentStateService.js';

export type OpStatus = 'applied' | 'duplicate' | 'superseded' | 'rejected';

export interface OpResult {
  readonly opId: string;
  readonly status: OpStatus;
  /**
   * En `applied`, los totales que **recalculó** el servidor. En `superseded` y
   * `duplicate`, lo que el servidor tiene **hoy** en esa celda, con sus `arrows`:
   * el celular que perdió —o que no llegó a enterarse— necesita saber qué ganó,
   * no sólo cuánto suma.
   */
  readonly score?: {
    total: number;
    innerCount: number;
    xCount: number;
    tenCount: number;
    mCount: number;
    arrows?: string[];
  };
  readonly error?: { code: string; message: string };
}

export interface SyncResult {
  readonly results: readonly OpResult[];
  readonly patrol: { status: string; targetsCompleted: number };
  readonly serverTime: string;
}

const rechazo = (opId: string, code: string, message: string): OpResult => ({
  opId,
  status: 'rejected',
  error: { code, message },
});

/** Rechazo con un código del catálogo: el mensaje sale del mismo lugar que el de la API. */
const rechazoTipado = (opId: string, code: ErrorCode): OpResult =>
  rechazo(opId, code, new AppError(code).message);

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
  ip: string | null,
): Promise<SyncResult> {
  const torneo = await tournamentRepo.findById(tournamentId);
  if (!torneo) {
    throw new Error('El torneo de la sesión ya no existe.');
  }

  /**
   * **El torneo tiene que estar en curso.**
   *
   * La autorización de `/wafl/sync` sale de la sesión de patrulla y nada más, y
   * una sesión emitida mientras el torneo corría sigue viva después. Mientras
   * el torneo sólo iba para adelante eso no importaba; desde que existe la
   * vuelta atrás a `sin_iniciar` (`REF2-3`), un líder que entró antes podía
   * seguir anotando sobre un torneo que dice no haber empezado.
   *
   * Se rechaza **op por op** y no con un error del batch: un 4xx dejaría al
   * outbox del cliente reintentando algo que nunca va a entrar, y el contrato
   * de `/sync` es responder 200 siempre con el resultado individual de cada op.
   * Ver `docs/OFFLINE_SYNC.md` §6 y la entrada del `/security-review` en
   * `BITACORA.md`.
   */
  if (torneo.status !== 'en_proceso') {
    return {
      results: batch.ops.map((op) => ({
        opId: op.opId,
        status: 'rejected' as const,
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: 'El torneo no está en curso. Consultá con la organización.',
        },
      })),
      patrol: { status: 'pendiente', targetsCompleted: 0 },
      serverTime: new Date().toISOString(),
    };
  }

  // Una sola lectura por lote, y no una por op: el estado de la patrulla no
  // cambia entre las ops de un lote salvo por un `close` del propio lote, que
  // se sigue acá. Otro dispositivo cerrando en paralelo no abre un hueco: para
  // cerrar hacen falta todas las firmas, y `aplicarScore` rechaza sobre firmados.
  let cerrada = (await patrolRepo.findById(patrolId))?.status === 'cerrada';

  // Alineado con `batch.ops`; `null` es una op que otro request está procesando y a la que no se
  // contesta (`B-4`): el cliente la deja en el outbox y la reintenta.
  const inicio = Date.now();
  const resultados: (OpResult | null)[] = [];
  for (const op of batch.ops) {
    const resultado = await procesarOp(op, patrolId, torneo, cerrada, ip);
    resultados.push(resultado);
    if (op.type === 'close' && resultado?.status === 'applied') cerrada = true;
  }

  // Los scores aplicados se confirman de una vez: un comando por lote, no por op (`REF6-5`).
  await scoreRepo.confirmarOps(
    batch.ops
      .filter((op, i) => op.type === 'score' && resultados[i]?.status === 'applied')
      .map((op) => op.opId),
  );

  // Una vez por lote, y antes de leer la patrulla para responder: el número que
  // vuelve en `patrol.targetsCompleted` tiene que ser el recién contado.
  if (hayQueRecontar(batch.ops, resultados)) await recalcularAvanceDePatrulla(patrolId);

  log.info(
    'sync.lote',
    resumenDelLote(patrolId, batch.ops.length, resultados, Date.now() - inicio),
  );

  const results = resultados.filter((r): r is OpResult => r !== null);

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

/** Lo que el servidor tiene guardado en una celda, tal como se le devuelve al cliente. */
const puntajeVigente = (doc: ScoreDoc): NonNullable<OpResult['score']> => ({
  total: doc.total,
  innerCount: doc.innerCount,
  xCount: doc.xCount,
  tenCount: doc.tenCount,
  mCount: doc.mCount,
  arrows: [...doc.arrows],
});

/**
 * Qué se le responde a una op que ya se había procesado.
 *
 * `duplicate` es lo que recibe quien reenvía una op cuya respuesta se perdió, y no
 * dice qué pasó con ella: puede haberse aplicado, haber perdido contra algo más
 * nuevo o haberse rechazado. Para un score, entonces, se le dice lo que el
 * servidor tiene **hoy** en esa celda, y el cliente alinea su pantalla con eso.
 *
 * **El duplicado se detecta por `opId` antes de autorizar nada.** Sin la
 * comprobación de abajo, reenviar un `opId` propio con el `participantId` de otra
 * patrulla devolvería el puntaje ajeno.
 */
async function respuestaDeDuplicada(op: SyncOpInput, patrolId: ObjectId): Promise<OpResult> {
  const sinDetalle: OpResult = { opId: op.opId, status: 'duplicate' };
  if (op.type !== 'score') return sinDetalle;

  const participante = await scoreRepo.findParticipant(new ObjectId(op.participantId));
  if (!participante?.patrolId.equals(patrolId)) return sinDetalle;

  const vigente = await scoreRepo.findScore(participante._id, op.targetIndex);
  return vigente ? { ...sinDetalle, score: puntajeVigente(vigente) } : sinDetalle;
}

/** Quién es dueño de una op que se quiere procesar. */
type Reclamo = 'mia' | 'duplicada' | 'en-proceso';

/**
 * Reclama la op para esta request (`REF6-13` / `B-4`).
 *
 * - `mia`: es nueva, o estaba abandonada en `processing` hace más de 30 s y se retomó.
 * - `duplicada`: ya terminó. Se le responde lo que el servidor tiene hoy.
 * - `en-proceso`: otro request la está procesando ahora. No se contesta.
 */
async function reclamar(op: SyncOpInput, patrolId: ObjectId): Promise<Reclamo> {
  if (await scoreRepo.claimOp(op.opId, patrolId, op.type)) return 'mia';

  const marca = await scoreRepo.findOp(op.opId);

  // Se soltó entre el insert y la lectura (el otro request falló y la liberó): otra vuelta.
  if (!marca) return (await scoreRepo.claimOp(op.opId, patrolId, op.type)) ? 'mia' : 'en-proceso';

  if (marca.result !== 'processing') return 'duplicada';
  return (await scoreRepo.retomarOp(op.opId, patrolId)) ? 'mia' : 'en-proceso';
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
 * **La marca nace `processing`, no `applied`** (`REF6-13` / `B-4`). Antes se marcaba `applied`
 * antes de aplicar: si el proceso moría entre la marca y el commit, el reintento recibía
 * `duplicate` y el puntaje se perdía en silencio. Ahora, una op que sigue `processing` pasados
 * 30 s se **reprocesa**. Una `processing` reciente es de otro request que sigue vivo, y a ésa no
 * se le contesta nada: el cliente trata una op ausente de la respuesta como «reintentar más
 * tarde», mientras que `duplicate` la sacaría del outbox antes de saber si llegó a aplicarse.
 */
async function procesarOp(
  op: SyncOpInput,
  patrolId: ObjectId,
  torneo: TournamentDoc,
  patrullaCerrada: boolean,
  ip: string | null,
): Promise<OpResult | null> {
  // Paso 1 — DEDUP. Insert atómico contra el índice único: no hay ventana entre
  // comprobar y escribir, como sí la habría con un `findOne` previo.
  const reclamo = await reclamar(op, patrolId);
  if (reclamo === 'duplicada') return respuestaDeDuplicada(op, patrolId);
  if (reclamo === 'en-proceso') return null;

  const session = iniciarSesion();

  try {
    let resultado: OpResult = rechazo(op.opId, 'INTERNAL', 'No se pudo procesar.');

    await session.withTransaction(async () => {
      resultado =
        op.type === 'score'
          ? await aplicarScore(op, patrolId, torneo, patrullaCerrada, session)
          : op.type === 'signature'
            ? await aplicarFirma(op, patrolId, patrullaCerrada, session)
            : await aplicarCierre(op, patrolId, torneo, ip, session);

      // Una firma o un cierre no se pueden volver a aplicar sin consecuencias (rechazarían por
      // «ya firmado» y el líder vería un conflicto que no existe), así que su marca se confirma
      // en la misma transacción. Los scores, que son idempotentes, se confirman por lote.
      if (op.type !== 'score' && resultado.status === 'applied') {
        await scoreRepo.markOpResult(op.opId, 'applied', session);
      }
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

/**
 * Por qué no se puede escribir un puntaje de este participante, o `null`.
 *
 * - **Patrulla cerrada**: la planilla es la que se firmó, nada la modifica. Va
 *   primero para que, después del cierre, el motivo sea ése y no el de la firma
 *   que el cierre exigió.
 * - **Arquero firmado**: la firma guarda el hash del puntaje del momento. La UI
 *   ya lo respeta; el servidor tiene que decir lo mismo, porque una app
 *   modificada o una op vieja en el outbox no pasan por esa UI. Incluye la firma
 *   desbloqueada por el admin (sin trazo): también cuenta como cerrada.
 */
function motivoDeBloqueo(participante: ParticipantDoc, patrullaCerrada: boolean): ErrorCode | null {
  if (patrullaCerrada) return 'PATROL_CLOSED';
  return participante.signature !== null ? 'SIGNATURE_LOCKED' : null;
}

async function aplicarScore(
  op: Extract<SyncOpInput, { type: 'score' }>,
  patrolId: ObjectId,
  torneo: TournamentDoc,
  patrullaCerrada: boolean,
  session: ClientSession,
): Promise<OpResult> {
  // Paso 2 — AUTORIZAR. Dentro del loop, por op: un batch puede traer 200 y
  // cualquiera podría apuntar a un participante ajeno. Esto es lo que impide
  // el IDOR entre patrullas. Ver docs/SECURITY.md §4.
  const participante = await scoreRepo.findParticipant(new ObjectId(op.participantId), session);

  if (!participante?.patrolId.equals(patrolId) || !participante.tournamentId.equals(torneo._id)) {
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

  // Va después de AUTORIZAR a propósito: un intento sobre un ajeno es FORBIDDEN y
  // queda en el audit log, no un «cerrada» que no le incumbe.
  const bloqueo = motivoDeBloqueo(participante, patrullaCerrada);
  if (bloqueo) return rechazoTipado(op.opId, bloqueo);

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

      return { opId: op.opId, status: 'superseded', score: puntajeVigente(existente) };
    }
  }

  // Paso 5 — APLICAR. Los totales son los que RECALCULÓ el servidor; el cliente
  // no manda totales y si los mandara se ignorarían. El mismo camino que usa la
  // corrección del admin (`escrituraDePuntaje`, `BE-25`).
  await escribirPuntaje(
    {
      torneo,
      participante,
      blanco,
      arrows: op.arrows,
      computo,
      existente,
      clientUpdatedAt: op.clientUpdatedAt,
      lastOpId: op.opId,
    },
    session,
  );

  // El avance de la patrulla NO se recalcula acá: se cuenta una vez por lote, al
  // final de `sync`. Hacerlo en cada op eran 3 comandos más por score.

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

/**
 * ¿Hay algo que recontar? Sí si el lote trae algún score que no se rechazó.
 *
 * - `applied`: cambió un puntaje, es el caso obvio.
 * - `duplicate` y `superseded`: no cambiaron nada **ahora**, pero cuentan a
 *   propósito. El recálculo ya no es parte de la transacción de cada op: si el
 *   proceso muere entre los commits y el recálculo, el avance queda
 *   desactualizado, y el reenvío del lote —que el cliente hace solo, porque no
 *   recibió respuesta— vuelve con todo `duplicate`. Es lo que lo repara.
 * - `rejected`: no cambió nada, y un lote entero de rechazos no paga el recálculo.
 *   Una op mala **no** impide recontar si las buenas del mismo lote lo piden.
 */
const hayQueRecontar = (
  ops: SyncBatchInput['ops'],
  resultados: readonly (OpResult | null)[],
): boolean =>
  // Una op en proceso (`null`) no cambió nada acá: la cuenta es de quien la está aplicando.
  ops.some((op, i) => op.type === 'score' && resultados[i] && resultados[i]?.status !== 'rejected');

/** Lo que se escribe en el log por cada lote (`REF6-13` / `B-5`). */
function resumenDelLote(
  patrolId: ObjectId,
  ops: number,
  resultados: readonly (OpResult | null)[],
  duracionMs: number,
) {
  const cuantas = (estado: OpResult['status']) =>
    resultados.filter((r) => r?.status === estado).length;
  const codigos: Record<string, number> = {};
  for (const r of resultados) {
    if (r?.status === 'rejected' && r.error)
      codigos[r.error.code] = (codigos[r.error.code] ?? 0) + 1;
  }

  return {
    patrolId: patrolId.toHexString(),
    ops,
    aplicadas: cuantas('applied'),
    duplicadas: cuantas('duplicate'),
    reemplazadas: cuantas('superseded'),
    rechazadas: cuantas('rejected'),
    enProceso: resultados.filter((r) => r === null).length,
    ...(Object.keys(codigos).length > 0 ? { codigosDeRechazo: codigos } : {}),
    duracionMs,
  };
}

/**
 * Blancos en los que TODOS los participantes de la patrulla ya tienen puntaje.
 *
 * Se cuenta **una vez por lote**, en su propia transacción corta. Antes iba dentro
 * de la transacción de cada score, y eran 3 comandos más por op —dos listas y una
 * escritura—, cada uno una ida y vuelta a la base (`REF6-5`). La transacción propia
 * conserva lo que importaba de estar adentro: dos lotes de la misma patrulla que
 * corren a la vez escriben el mismo documento, el segundo recibe un
 * `WriteConflict` y se reintenta releyendo, así que ninguno deja un número viejo.
 *
 * Las lecturas van **con la `session`**: sin ella no ven lo que la transacción
 * escribe. Es el «7 de 8».
 */
export async function recalcularAvanceDePatrulla(patrolId: ObjectId): Promise<void> {
  await conTransaccion(async (session) => {
    const miembros = await tournamentRepo.listParticipantsOfPatrol(patrolId, session);
    const puntajes = await scoreRepo.listScoresOfPatrol(patrolId, session);

    const porBlanco = new Map<number, number>();
    for (const s of puntajes) {
      porBlanco.set(s.targetIndex, (porBlanco.get(s.targetIndex) ?? 0) + 1);
    }

    // `miembros` no viene vacío si hay puntajes: reacomodar las patrullas sólo se
    // puede con el torneo `sin_iniciar`, y ahí no hay puntajes. En el cliente no
    // vale la misma garantía —el bundle sí puede estar vacío— y por eso
    // `CircuitPage` necesita su propia guarda.
    let completos = 0;
    for (const cantidad of porBlanco.values()) {
      if (cantidad >= miembros.length) completos++;
    }

    await patrolRepo.setTargetsCompleted(patrolId, completos, session);
  });
}

// ── Firma ────────────────────────────────────────────────────────────────────

async function aplicarFirma(
  op: Extract<SyncOpInput, { type: 'signature' }>,
  patrolId: ObjectId,
  patrullaCerrada: boolean,
  session: ClientSession,
): Promise<OpResult> {
  const participante = await scoreRepo.findParticipant(new ObjectId(op.participantId), session);

  if (!participante?.patrolId.equals(patrolId)) {
    return rechazo(op.opId, 'FORBIDDEN', 'Ese arquero no es de tu patrulla.');
  }

  if (patrullaCerrada) return rechazoTipado(op.opId, 'PATROL_CLOSED');

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
  ip: string | null,
  session: ClientSession,
): Promise<OpResult> {
  const miembros = await tournamentRepo.listParticipantsOfPatrol(patrolId, session);
  const activos = miembros.filter((m) => m.status === 'activo');

  // Con cero activos, `esperados` da cero y todas las comprobaciones de abajo
  // pasan por vacuidad: la patrulla cerraba el circuito sin un solo puntaje.
  // Puede quedar sin nadie al redistribuir, conservando usuario y PIN.
  if (activos.length === 0) {
    return rechazo(op.opId, 'VALIDATION_ERROR', 'La patrulla no tiene arqueros activos.');
  }

  // Todos los blancos, de todos los arqueros.
  const puntajes = await scoreRepo.listScoresOfPatrol(patrolId, session);
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
      action: 'patrol.close',
      entity: 'patrol',
      entityId: patrolId,
      ip,
    },
    session,
  );

  // Si era la última patrulla abierta, el torneo pasa a completado solo.
  if ((await patrolRepo.countOpen(torneo._id, session)) === 0) {
    await transition(torneo._id, 'completado', { completedAt: new Date() }, session);
  }

  return { opId: op.opId, status: 'applied' };
}
