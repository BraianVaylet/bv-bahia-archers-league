/**
 * Gestión de patrullas desde WAFA.
 *
 * Incluye la lectura del PIN, que es el tradeoff documentado en
 * `docs/SECURITY.md` §9: se guarda cifrado además de hasheado para que el admin
 * pueda volver a mostrarlo, y **cada visualización queda en el audit log**.
 */

import { type PatrolDistributionInput, validatePatrols } from '@bal/shared';
import type { ObjectId } from 'mongodb';
import { env } from '../env.js';
import { decryptPin, encryptPin, generatePin, hashSecret } from '../lib/crypto.js';
import { AppError, notFound } from '../lib/errors.js';
import { endAllSessionsFor } from '../lib/session.js';
import * as auditRepo from '../repositories/auditRepo.js';
import * as patrolRepo from '../repositories/patrolRepo.js';
import * as scoreRepo from '../repositories/scoreRepo.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';
import { conTransaccion } from './tournamentService.js';

export interface PatrolView {
  readonly id: string;
  readonly number: number;
  readonly startTargetIndex: number;
  readonly username: string;
  readonly status: string;
  readonly targetsCompleted: number;
  readonly members: readonly {
    id: string;
    firstName: string;
    lastName: string;
    category: string;
    stake: string;
    unit: string;
    position: string;
    signed: boolean;
  }[];
  /** Sólo presente si el torneo todavía no se publicó. */
  readonly pin?: string;
}

/**
 * Lista las patrullas con su composición y, si corresponde, su PIN.
 *
 * El PIN se descifra **sólo** mientras el torneo no está publicado, y la lectura
 * queda registrada. Una vez publicado, la credencial ya no sirve para nada y no
 * hay motivo para exponerla.
 */
export async function listPatrols(
  tournamentId: ObjectId,
  actorId: ObjectId,
  ip: string | null,
): Promise<PatrolView[]> {
  const torneo = await tournamentRepo.findById(tournamentId);
  if (!torneo) throw notFound();

  const mostrarPin = torneo.status !== 'publicado';
  const [patrullas, miembros] = await Promise.all([
    patrolRepo.listByTournament(tournamentId),
    tournamentRepo.listParticipants(tournamentId),
  ]);

  if (mostrarPin && patrullas.length > 0) {
    await auditRepo.record({
      actorType: 'admin',
      actorId,
      action: 'patrol.pin.reveal',
      entity: 'tournament',
      entityId: tournamentId,
      meta: { patrols: patrullas.length },
      ip,
    });
  }

  const cfg = env();

  return patrullas.map((p) => ({
    id: p._id.toHexString(),
    number: p.number,
    startTargetIndex: p.startTargetIndex,
    username: p.username,
    status: p.status,
    targetsCompleted: p.targetsCompleted,
    members: miembros
      .filter((m) => m.patrolId.equals(p._id))
      .map((m) => ({
        id: m._id.toHexString(),
        firstName: m.firstName,
        lastName: m.lastName,
        category: m.category,
        stake: m.stake,
        unit: m.unit,
        position: m.position,
        signed: m.signature !== null,
      })),
    ...(mostrarPin ? { pin: decryptPin(p.pinEnc, cfg.PIN_ENC_KEY) } : {}),
  }));
}

/**
 * Genera un PIN nuevo e **invalida las sesiones activas** de esa patrulla.
 *
 * Si el motivo del cambio es que el PIN se filtró, dejar viva la sesión abierta
 * no arregla nada.
 */
export async function regeneratePin(
  patrolId: ObjectId,
  actorId: ObjectId,
): Promise<{ username: string; pin: string }> {
  const patrulla = await patrolRepo.findById(patrolId);
  if (!patrulla) throw notFound();

  const cfg = env();
  const pin = generatePin(6);

  await patrolRepo.setStatus(patrolId, patrulla.status, {
    pinHash: await hashSecret(pin),
    pinEnc: encryptPin(pin, cfg.PIN_ENC_KEY),
    pinUpdatedAt: new Date(),
    failedAttempts: 0,
    lockedUntil: null,
  });

  await endAllSessionsFor('patrol', patrolId);

  await auditRepo.record({
    actorType: 'admin',
    actorId,
    action: 'patrol.pin.regenerate',
    entity: 'patrol',
    entityId: patrolId,
    meta: { number: patrulla.number },
  });

  return { username: patrulla.username, pin };
}

/**
 * Desbloquea la firma de un participante.
 *
 * Es el escape para el caso real de que un arquero se vaya antes de firmar.
 * **No se oculta**: queda `unlockedBy`, `unlockReason` y una entrada en el audit
 * log, y el detalle del torneo lo muestra. Ver `docs/SECURITY.md` §7.
 */
export async function unlockSignature(
  participantId: ObjectId,
  reason: string,
  actorId: ObjectId,
  ip: string | null,
): Promise<void> {
  const participante = await scoreRepo.findParticipant(participantId);
  if (!participante) throw notFound();

  if (participante.signature !== null) {
    throw new AppError('INVALID_STATE_TRANSITION', {
      message: 'Ese arquero ya firmó.',
    });
  }

  // El hash se calcula igual que en una firma real: el desbloqueo autoriza
  // cerrar sin el trazo, pero NO renuncia a detectar que el puntaje cambie
  // después. Si cambia, el cierre lo sigue frenando con SIGNATURE_MISMATCH.
  const scorecardHash = await scoreRepo.scorecardHashOf(participante);

  const session = (await import('../db/client.js')).getClient().startSession();
  try {
    await session.withTransaction(async () => {
      await scoreRepo.setSignature(
        participantId,
        {
          // Sin trazo: nadie firmó. Lo que queda registrado es la excepción.
          pngDataUrl: '',
          signedAt: new Date(),
          scorecardHash,
          unlockedBy: actorId,
          unlockReason: reason,
        },
        session,
      );

      await auditRepo.record(
        {
          actorType: 'admin',
          actorId,
          action: 'signature.unlock',
          entity: 'participant',
          entityId: participantId,
          meta: { reason, archer: `${participante.lastName}, ${participante.firstName}` },
          ip,
        },
        session,
      );
    });
  } finally {
    await session.endSession();
  }
}

/**
 * Reubica manualmente a los arqueros entre las patrullas del torneo.
 *
 * **Avisa pero no bloquea.** El admin conoce el terreno y puede tener motivos
 * para una excepción a `H1`..`H4`; la decisión queda en el audit log junto con
 * las violaciones que aceptó. Ver `docs/FUNCTIONAL.md` §6.6.
 *
 * Lo que sí bloquea es **perder un arquero**: la operación exige la lista
 * completa de participantes del torneo. Uno que quede sin patrulla no aparece en
 * ninguna planilla, y nadie se entera hasta que ya se está tirando.
 *
 * **Borra las patrullas que no vengan en la distribución, y renumera.** Hasta
 * `REF3-1` no borraba ninguna, con este razonamiento: las credenciales pueden
 * estar repartidas en papel, así que una patrulla que quedaba sin nadie quedaba
 * vacía y el validador lo informaba.
 *
 * Eso dejó de funcionar cuando `REF2-5` agregó un botón de eliminar en la
 * pantalla —que sólo la sacaba de la vista— y la regla de que una patrulla
 * vacía frena el guardado: se guardaba, el servidor dejaba la patrulla donde
 * estaba, la pantalla recargaba y volvía a frenar. **Un bloqueo del que no se
 * salía.**
 *
 * El papel sigue importando, y por eso **cada patrulla conserva su PIN** al
 * renumerarse: el PIN viaja con el grupo de arqueros, no con el número.
 */
export async function redistribute(
  tournamentId: ObjectId,
  input: PatrolDistributionInput,
  actorId: ObjectId,
  ip: string | null,
): Promise<void> {
  const torneo = await tournamentRepo.findById(tournamentId);
  if (!torneo) throw notFound();

  if (torneo.status !== 'sin_iniciar') {
    // Los líderes ya tienen el recorrido descargado: moverles la patrulla abajo
    // de los pies rompería la sincronización.
    throw new AppError('INVALID_STATE_TRANSITION', {
      message: 'Las patrullas sólo se pueden reacomodar mientras el torneo no arrancó.',
    });
  }

  const [patrullas, miembros] = await Promise.all([
    patrolRepo.listByTournament(tournamentId),
    tournamentRepo.listParticipants(tournamentId),
  ]);

  /**
   * Por **id**, no por número.
   *
   * El cliente renumera al eliminar una patrulla, así que el número que manda
   * no identifica nada: mapeando por número, los arqueros de la vieja patrulla
   * 3 terminaban en el documento de la 2 —con el PIN de la 2, que puede estar
   * impreso—.
   */
  const porPatrullaId = new Map(patrullas.map((p) => [p._id.toHexString(), p]));
  const porId = new Map(miembros.map((m) => [m._id.toHexString(), m]));

  /**
   * **La numeración tiene que ser 1..N, sin huecos ni repetidos.**
   *
   * Antes esto se verificaba solo, porque el número identificaba a la patrulla
   * y tenía que existir. Ahora el número es un dato editable —eliminar una
   * renumera al resto— y hay que exigirlo explícitamente: el usuario del líder
   * es `patrulla` más el número, así que un hueco deja un usuario que la
   * botonera del login no ofrece, y un 99 crea un `patrulla99` suelto.
   */
  const numeros = [...input.patrols.map((p) => p.number)].sort((a, b) => a - b);
  const esperados = numeros.map((_, i) => i + 1);
  if (numeros.join(',') !== esperados.join(',')) {
    throw new AppError('VALIDATION_ERROR', {
      message: `Las patrullas tienen que numerarse de 1 a ${input.patrols.length}, sin huecos ni repetidos.`,
    });
  }

  for (const p of input.patrols) {
    if (!porPatrullaId.has(p.id)) {
      throw new AppError('VALIDATION_ERROR', {
        message: `La patrulla ${p.number} no existe en este torneo.`,
      });
    }
    if (p.startTargetIndex > torneo.targets.length) {
      throw new AppError('VALIDATION_ERROR', {
        message: `El blanco de inicio ${p.startTargetIndex} no existe: el recorrido tiene ${torneo.targets.length}.`,
      });
    }
  }

  const asignados = input.patrols.flatMap((p) => p.units.flatMap((u) => u.members));

  // Un id que no es de este torneo se trata como "no pertenece", sin decir si
  // existe en otro lado: desde acá, sencillamente no está.
  const ajenos = asignados.filter((id) => !porId.has(id));
  if (ajenos.length > 0) {
    throw new AppError('VALIDATION_ERROR', {
      message: 'Hay arqueros que no participan de este torneo.',
    });
  }

  const enLaDistribucion = new Set(asignados);
  const faltantes = miembros.filter((m) => !enLaDistribucion.has(m._id.toHexString()));
  if (faltantes.length > 0) {
    const nombres = faltantes.map((m) => `${m.lastName}, ${m.firstName}`).join(' · ');
    throw new AppError('VALIDATION_ERROR', {
      message: `Faltan arqueros en la distribución: ${nombres}. Ninguno puede quedar sin patrulla.`,
    });
  }

  /**
   * Las que no vinieron se borran.
   *
   * La distribución es **completa**: describe cómo queda el torneo, no un
   * parche. Una patrulla que no está en ella es una que el admin eliminó, y ya
   * se verificó arriba que ningún arquero quedó sin patrulla.
   */
  const mencionadas = new Set(input.patrols.map((p) => p.id));
  const aBorrar = patrullas.filter((p) => !mencionadas.has(p._id.toHexString()));

  await conTransaccion(async (session) => {
    await patrolRepo.removeMany(
      aBorrar.map((p) => p._id),
      session,
    );

    for (const planeada of input.patrols) {
      // biome-ignore lint/style/noNonNullAssertion: verificado arriba
      const patrulla = porPatrullaId.get(planeada.id)!;
      await patrolRepo.setStartTargetIndex(patrulla._id, planeada.startTargetIndex, session);

      // El número y el usuario, juntos. Ver `patrolRepo.setNumber`.
      if (patrulla.number !== planeada.number) {
        await patrolRepo.setNumber(patrulla._id, planeada.number, session);
      }

      for (const unidad of planeada.units) {
        for (const [i, participantId] of unidad.members.entries()) {
          // biome-ignore lint/style/noNonNullAssertion: verificado arriba
          const miembro = porId.get(participantId)!;
          await tournamentRepo.reassignParticipant(
            miembro._id,
            {
              patrolId: patrulla._id,
              unit: unidad.label,
              // La posición sale del ORDEN dentro de la unidad, no de lo que
              // mande el cliente: es un dato derivado, no una opinión.
              position: i === 0 ? 'izquierda' : 'derecha',
            },
            session,
          );
        }
      }
    }
  });

  const violations = await validateCurrentDistribution(tournamentId);

  await auditRepo.record({
    actorType: 'admin',
    actorId,
    action: 'patrol.manual_edit',
    entity: 'tournament',
    entityId: tournamentId,
    meta: { patrols: input.patrols.length, violations: violations.length },
    ip,
  });
}

/** Verifica las restricciones `H1`..`H4` sobre la distribución actual. */
export async function validateCurrentDistribution(tournamentId: ObjectId) {
  const [patrullas, miembros] = await Promise.all([
    patrolRepo.listByTournament(tournamentId),
    tournamentRepo.listParticipants(tournamentId),
  ]);

  const planned = patrullas.map((p) => {
    const propios = miembros.filter((m) => m.patrolId.equals(p._id));
    const unidades = ['A', 'B'] as const;

    return {
      number: p.number,
      startTargetIndex: p.startTargetIndex,
      units: unidades
        .filter((u) => propios.some((m) => m.unit === u))
        .map((u) => {
          const deLaUnidad = propios.filter((m) => m.unit === u);
          return {
            label: u,
            // biome-ignore lint/style/noNonNullAssertion: el filter garantiza al menos uno
            category: deLaUnidad[0]!.category,
            // biome-ignore lint/style/noNonNullAssertion: idem
            stake: deLaUnidad[0]!.stake,
            members: deLaUnidad.map((m) => ({
              archerId: m.archerId.toHexString(),
              firstName: m.firstName,
              lastName: m.lastName,
              category: m.category,
              stake: m.stake,
              position: m.position,
            })),
          };
        }),
    };
  });

  return validatePatrols(planned);
}
