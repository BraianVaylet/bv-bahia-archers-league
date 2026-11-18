/**
 * Edición de un torneo ya creado.
 *
 * **Qué campo se edita en qué estado** lo decide `camposEditables` de `@bal/shared` (`SH-11`):
 * la misma tabla que lee WAFA para dibujar el formulario. Este servicio sólo agrega lo que necesita
 * mirar la base: **un blanco en el que alguna patrulla ya cargó puntaje no se puede editar ni
 * eliminar.** Cambiarlo invalidaría puntajes ya firmados.
 *
 * Ver `docs/FUNCTIONAL.md` §6.7 y §8.
 */

import {
  buildPatrols,
  CAMPOS_DE_TORNEO,
  type CampoDeTorneo,
  CampoNoEditableError,
  exigirEditables,
  incorporarArqueros,
  maxPossibleScore,
  type PlannedPatrol,
  POSITIONS,
  type Position,
  puedeEliminar,
  STAKES,
  type Stake,
  type StakeMap,
  UNITS,
  type Unit,
  type UpdateTournamentInput,
} from '@bal/shared';
import { ObjectId } from 'mongodb';
import type {
  ParticipantDoc,
  PatrolDoc,
  StakeMapDoc,
  TargetDoc,
  TournamentDoc,
} from '../db/types.js';
import { AppError, notFound, validationError } from '../lib/errors.js';
import * as archerRepo from '../repositories/archerRepo.js';
import * as auditRepo from '../repositories/auditRepo.js';
import * as patrolRepo from '../repositories/patrolRepo.js';
import * as scoreRepo from '../repositories/scoreRepo.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';
import {
  aParticipantInput,
  conTransaccion,
  materializar,
  participanteNuevo,
  patrullaNueva,
} from './tournamentService.js';

/** Blancos del torneo que ya tienen al menos un puntaje cargado. */
export async function blancosBloqueados(torneo: TournamentDoc): Promise<number[]> {
  const bloqueados: number[] = [];

  for (const blanco of torneo.targets) {
    if ((await scoreRepo.countScoresOfTarget(torneo._id, blanco.index)) > 0) {
      bloqueados.push(blanco.index);
    }
  }

  return bloqueados;
}

function mismoBlanco(a: TargetDoc, b: TargetDoc | undefined): boolean {
  return (
    b !== undefined &&
    a.modality === b.modality &&
    a.arrows === b.arrows &&
    a.description === b.description
  );
}

/**
 * Los campos que trae el pedido, en el orden de `CAMPOS_DE_TORNEO`.
 *
 * Un campo con `undefined` no se pidió: el esquema los declara opcionales y Zod omite la clave.
 */
function camposPedidos(input: UpdateTournamentInput): CampoDeTorneo[] {
  return CAMPOS_DE_TORNEO.filter((c) => c in input && input[c as keyof typeof input] !== undefined);
}

/**
 * Rechaza el pedido entero si trae un campo que el estado del torneo no permite (`SH-11`).
 *
 * `DomainError` no viaja por HTTP: se traduce acá a `FIELD_NOT_EDITABLE` (409), con **todos** los
 * campos rechazados en `details`, para que WAFA pueda decir cuáles.
 *
 * @throws {AppError} `FIELD_NOT_EDITABLE`.
 */
function exigirCampos(torneo: TournamentDoc, campos: readonly CampoDeTorneo[]): void {
  try {
    exigirEditables(torneo.status, campos);
  } catch (err) {
    if (err instanceof CampoNoEditableError) {
      throw new AppError('FIELD_NOT_EDITABLE', { details: { campos: [...err.campos] } });
    }
    throw err;
  }
}

/** Los campos que se editan tal cual vienen. */
function cambiosSimples(input: UpdateTournamentInput): Partial<TournamentDoc> {
  const cambios: Partial<TournamentDoc> = {};
  if (input.name !== undefined) cambios.name = input.name;
  if (input.date !== undefined) cambios.date = input.date;
  if (input.description !== undefined) cambios.description = input.description;
  // `null` también se guarda: es «sacar el link».
  if (input.registrationUrl !== undefined) cambios.registrationUrl = input.registrationUrl;
  if (input.payment) cambios.payment = { ...input.payment };
  if (input.stakeMap) cambios.stakeMap = copiaDelMapa(input.stakeMap);
  if (input.distances) cambios.distances = { ...input.distances };
  return cambios;
}

function copiaDelMapa(mapa: StakeMap): StakeMapDoc {
  return {
    roja: [...mapa.roja],
    azul: [...mapa.azul],
    amarilla: [...mapa.amarilla],
    naranja: [...mapa.naranja],
  };
}

/** La estaca de la categoría en `mapa`, o `null` si el mapa no la ubica en ninguna. */
function estacaEn(mapa: StakeMap, category: string): Stake | null {
  return STAKES.find((s) => (mapa[s] as readonly string[]).includes(category)) ?? null;
}

/**
 * A quiénes hay que rearmar **desde cero**, o `null` si no hace falta.
 *
 * - **Cambiar los participantes ya no rearma** (`BE-31`, decisión 5 de la Fase 10): se incorporan
 *   y se quitan sin tocar a los demás (`prepararIncorporacion`). Sólo rearma si además cambia la
 *   estructura, por alguna de las dos razones de abajo.
 * - Si cambia el mapa de estacas, a los inscriptos **sólo si alguno cambia de estaca**: si nadie
 *   se mueve, las patrullas y sus PIN se quedan y no hay que reimprimir nada.
 * - Si cambia **la cantidad** de blancos con el torneo sin iniciar, a los inscriptos (`FE-32`): el
 *   blanco de inicio de cada patrulla se reparte sobre el recorrido, y con menos blancos una podía
 *   quedar arrancando en uno que ya no existe. Cambiar cómo es un blanco, sin cambiar cuántos son,
 *   no rearma. En proceso nunca se rearma: las patrullas ya están en el predio.
 */
async function quienesRearmar(
  torneo: TournamentDoc,
  input: UpdateTournamentInput,
): Promise<readonly string[] | null> {
  const cambiaLaCantidad =
    torneo.status === 'sin_iniciar' &&
    input.targets !== undefined &&
    input.targets.length !== torneo.targets.length;
  if (!input.stakeMap && !cambiaLaCantidad) return null;

  const inscriptos = await tournamentRepo.listParticipants(torneo._id);
  const mapa = input.stakeMap;
  const alguienCambiaDeEstaca =
    mapa !== undefined && inscriptos.some((p) => estacaEn(mapa, p.category) !== p.stake);

  if (!alguienCambiaDeEstaca && !cambiaLaCantidad) return null;
  return input.archerIds ?? inscriptos.map((p) => p.archerId.toHexString());
}

/**
 * Lo que el club ya anotó de cada arquero sobrevive al rearmado (`FE-32`).
 *
 * Rearmar recrea los participantes con `paid: false`. El admin marca los pagos en la puerta,
 * antes de largar, y un ajuste de último momento los borraba. Se copian por `archerId`: quien
 * sigue en el torneo conserva su pago; quien entra, arranca sin pagar.
 */
async function conLosPagos(
  torneo: TournamentDoc,
  participantDocs: readonly ParticipantDoc[],
): Promise<ParticipantDoc[]> {
  const previos = await tournamentRepo.listParticipants(torneo._id);
  const pagaron = new Set(previos.filter((p) => p.paid).map((p) => p.archerId.toHexString()));
  return participantDocs.map((p) =>
    pagaron.has(p.archerId.toHexString()) ? { ...p, paid: true } : p,
  );
}

/**
 * Los blancos que quedan después de la edición.
 *
 * Con el torneo en proceso, un blanco que ya tiene puntajes tiene que seguir existiendo y seguir
 * siendo idéntico.
 *
 * @throws {AppError} `TARGET_LOCKED`.
 */
async function blancosEditados(
  torneo: TournamentDoc,
  targets: NonNullable<UpdateTournamentInput['targets']>,
): Promise<TargetDoc[]> {
  const nuevos: TargetDoc[] = targets.map((t) => ({
    index: t.index,
    modality: t.modality,
    arrows: t.arrows,
    description: t.description,
  }));

  if (torneo.status !== 'en_proceso') return nuevos;

  const bloqueados = await blancosBloqueados(torneo);
  const porIndice = new Map(nuevos.map((t) => [t.index, t]));

  for (const indice of bloqueados) {
    const antes = torneo.targets.find((t) => t.index === indice);
    if (!antes || !mismoBlanco(antes, porIndice.get(indice))) {
      throw new AppError('TARGET_LOCKED', {
        details: { targetIndex: indice },
        message: `El blanco ${indice} ya tiene puntajes cargados y no se puede modificar.`,
      });
    }
  }

  return nuevos;
}

/**
 * Actualiza el torneo.
 *
 * Qué se puede tocar en cada estado lo dice `camposEditables` (`SH-11`); un pedido con un campo de
 * más se rechaza entero, antes de tocar nada. Con el torneo en proceso, además, los blancos
 * **con puntajes** no se tocan.
 *
 * @throws {AppError} `FIELD_NOT_EDITABLE` si el estado no permite alguno de los campos.
 * @throws {AppError} `TARGET_LOCKED` si se intenta tocar un blanco ya tirado.
 * @throws {AppError} `VALIDATION_ERROR` si el mapa de estacas deja sin estaca a un inscripto.
 */
export async function updateTournament(
  tournamentId: ObjectId,
  input: UpdateTournamentInput,
  actorId: ObjectId,
): Promise<TournamentDoc> {
  const torneo = await tournamentRepo.findById(tournamentId);
  if (!torneo) throw notFound();

  const campos = camposPedidos(input);
  exigirCampos(torneo, campos);

  const cambios = cambiosSimples(input);

  if (input.targets) {
    const nuevos = await blancosEditados(torneo, input.targets);
    cambios.targets = nuevos;
    cambios.maxPossibleScore = maxPossibleScore(nuevos);
  }

  /**
   * Cambiar quiénes participan **rearma las patrullas**.
   *
   * No es una decisión de comodidad: las patrullas se derivan de la lista de
   * arqueros y de las restricciones del dominio (`H1`-`H4`). Agregar a alguien
   * sin rehacerlas daría una patrulla de cinco o una 100% escuela, que es justo
   * lo que el algoritmo evita.
   *
   * Cambiar el mapa de estacas también, si algún inscripto cambia de estaca:
   * las patrullas se arman agrupando por estaca (`BE-24`).
   *
   * Sólo con el torneo `sin_iniciar` (`camposEditables`). Con el torneo en
   * marcha las patrullas ya están en el predio con su PIN y su planilla
   * impresa: rearmarlas desde el escritorio dejaría al líder mirando una lista
   * que no coincide con la gente que tiene al lado.
   */
  const aRearmar = await quienesRearmar(torneo, input);
  const nuevosParticipantes =
    aRearmar === null
      ? null
      : await prepararParticipantes(
          torneo,
          aRearmar,
          input.stakeMap ?? torneo.stakeMap,
          // Si el mismo pedido cambia el recorrido, las patrullas arrancan sobre el nuevo.
          (input.targets ?? torneo.targets).length,
        );

  if (nuevosParticipantes) {
    cambios.patrolCount = nuevosParticipantes.patrolDocs.length;
    cambios.participantCount = nuevosParticipantes.participantDocs.length;
  }

  // Cambiar quiénes participan, sin cambiar la estructura: se incorporan y se quitan sin
  // rearmar (`BE-31`). Las patrullas, sus PIN y lo que el admin ajustó a mano se conservan.
  const incorporacion =
    aRearmar === null && input.archerIds !== undefined
      ? await prepararIncorporacion(
          torneo,
          input.archerIds,
          input.stakeMap ?? torneo.stakeMap,
          (input.targets ?? torneo.targets).length,
        )
      : null;

  if (incorporacion) {
    cambios.patrolCount = incorporacion.patrolCount;
    cambios.participantCount = incorporacion.participantCount;
  }

  const actualizado = await tournamentRepo.updateIfStatus(tournamentId, torneo.status, cambios);

  if (!actualizado) {
    throw new AppError('INVALID_STATE_TRANSITION', {
      message: 'El torneo cambió de estado mientras se procesaba la solicitud.',
    });
  }

  if (nuevosParticipantes) {
    const { patrolDocs } = nuevosParticipantes;
    // Antes de borrar la distribución vieja: de ahí salen los pagos que se conservan.
    const participantDocs = await conLosPagos(torneo, nuevosParticipantes.participantDocs);

    // En una transacción: un torneo sin patrullas, aunque sea por un instante,
    // es un torneo que un líder no puede abrir.
    await conTransaccion(async (session) => {
      // Patrullas, participantes y puntajes, juntos: un puntaje sin dueño hace
      // que el torneo marque blancos bloqueados de arqueros que ya no existen.
      await tournamentRepo.clearDistribution(tournamentId, session);
      await tournamentRepo.insertPatrols(patrolDocs, session);
      await tournamentRepo.insertParticipants(participantDocs, session);

      await auditRepo.record(
        {
          actorType: 'admin',
          actorId,
          action: 'tournament.participants_edit',
          entity: 'tournament',
          entityId: tournamentId,
          meta: { participants: participantDocs.length, patrols: patrolDocs.length },
        },
        session,
      );
    });
  }

  if (incorporacion) await aplicarIncorporacion(tournamentId, incorporacion, actorId);

  if (cambios.targets) {
    await auditRepo.record({
      actorType: 'admin',
      actorId,
      action: 'tournament.target_edit',
      entity: 'tournament',
      entityId: tournamentId,
      meta: { targets: cambios.targets.length, maxPossibleScore: cambios.maxPossibleScore },
    });
  }

  // Qué cambió, no con qué valores: el pago es plata y el log no tiene por qué guardarla.
  if (campos.length > 0) {
    await auditRepo.record({
      actorType: 'admin',
      actorId,
      action: 'tournament.update',
      entity: 'tournament',
      entityId: tournamentId,
      meta: { campos },
    });
  }

  return actualizado;
}

/** Elimina un torneo. Sólo si nunca arrancó. */
export async function removeTournament(
  tournamentId: ObjectId,
  actorId: ObjectId,
  ip: string | null,
): Promise<void> {
  const torneo = await tournamentRepo.findById(tournamentId);
  if (!torneo) throw notFound();

  if (!puedeEliminar(torneo.status)) {
    throw new AppError('INVALID_STATE_TRANSITION', {
      message: 'Sólo se puede eliminar un torneo que todavía no arrancó.',
    });
  }

  await tournamentRepo.remove(tournamentId);

  // El documento ya no existe: el nombre queda acá, que es lo único que dirá
  // después qué torneo fue.
  await auditRepo.record({
    actorType: 'admin',
    actorId,
    action: 'tournament.delete',
    entity: 'tournament',
    entityId: tournamentId,
    meta: { name: torneo.name, date: torneo.date },
    ip,
  });
}

/**
 * Valida la lista de arqueros y arma las patrullas nuevas.
 *
 * Las mismas dos comprobaciones que al crear el torneo —que existan y que
 * ninguno esté archivado—: si estuvieran sólo en la creación, se podría meter
 * un archivado por la puerta de la edición.
 *
 * Que el estado lo permita ya lo exigió `exigirCampos` (`SH-11`): esto sólo
 * corre con el torneo `sin_iniciar`.
 */
async function prepararParticipantes(
  torneo: TournamentDoc,
  archerIds: readonly string[],
  stakeMap: StakeMap,
  blancos: number,
) {
  const arqueros = await validarArqueros(archerIds, stakeMap);
  const plan = buildPatrols(aParticipantInput(arqueros), stakeMap, blancos);
  return materializar(plan, torneo._id, new Date());
}

/**
 * Las patrullas de la base como las entiende el dominio, en orden de número: unidades por
 * etiqueta y miembros por posición. Es lo que `incorporarArqueros` conserva.
 */
function patrullasActuales(
  patrullas: readonly PatrolDoc[],
  inscriptos: readonly ParticipantDoc[],
): PlannedPatrol[] {
  return [...patrullas]
    .sort((a, b) => a.number - b.number)
    .map((p) => {
      const propios = inscriptos.filter((m) => m.patrolId.equals(p._id));
      return {
        number: p.number,
        startTargetIndex: p.startTargetIndex,
        units: UNITS.flatMap((label) => {
          const deLaUnidad = propios
            .filter((m) => m.unit === label)
            .sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position));
          const [primero] = deLaUnidad;
          if (!primero) return [];
          return [
            {
              label,
              category: primero.category,
              stake: primero.stake,
              members: deLaUnidad.map((m) => ({
                archerId: m.archerId.toHexString(),
                firstName: m.firstName,
                lastName: m.lastName,
                category: m.category,
                stake: m.stake,
                position: m.position,
                ...(m.sex ? { sex: m.sex } : {}),
              })),
            },
          ];
        }),
      };
    });
}

/** Lo que hay que escribir para incorporar y quitar arqueros sin rearmar (`BE-31`). */
interface Incorporacion {
  readonly patrullasNuevas: readonly PatrolDoc[];
  readonly insertar: readonly ParticipantDoc[];
  readonly reubicar: readonly {
    readonly id: ObjectId;
    readonly patrolId: ObjectId;
    readonly unit: Unit;
    readonly position: Position;
  }[];
  readonly quitar: readonly ObjectId[];
  readonly patrolCount: number;
  readonly participantCount: number;
  readonly violaciones: number;
}

/**
 * Calcula cómo quedan las patrullas con los arqueros que entran y salen, **sin rearmar**
 * (`incorporarArqueros`, `SH-12`), y qué hay que escribir. Las credenciales de las patrullas que
 * hagan falta se generan acá, fuera de la transacción: argon2id tarda.
 *
 * Las mismas validaciones que el armado: que los arqueros existan, que ninguno esté archivado y
 * que el mapa de estacas los ubique.
 */
async function prepararIncorporacion(
  torneo: TournamentDoc,
  archerIds: readonly string[],
  stakeMap: StakeMap,
  blancos: number,
): Promise<Incorporacion> {
  const arqueros = await validarArqueros(archerIds, stakeMap);
  const [patrullas, inscriptos] = await Promise.all([
    patrolRepo.listByTournament(torneo._id),
    tournamentRepo.listParticipants(torneo._id),
  ]);

  const pedidos = new Set(archerIds);
  const porArquero = new Map(inscriptos.map((p) => [p.archerId.toHexString(), p]));
  const nuevos = aParticipantInput(arqueros.filter((a) => !porArquero.has(a._id.toHexString())));
  const quitados = inscriptos.filter((p) => !pedidos.has(p.archerId.toHexString()));

  const resultado = incorporarArqueros(
    patrullasActuales(patrullas, inscriptos),
    { nuevos, quitados: quitados.map((p) => p.archerId.toHexString()) },
    stakeMap,
    blancos,
  );

  const ahora = new Date();
  const existentes = new Map(patrullas.map((p) => [p.number, p._id]));
  const patrullasNuevas = await Promise.all(
    resultado.patrols
      .filter((p) => !existentes.has(p.number))
      .map((p) => patrullaNueva(torneo._id, p.number, p.startTargetIndex, ahora)),
  );
  const idDe = new Map([...existentes, ...patrullasNuevas.map((p) => [p.number, p._id] as const)]);

  const insertar: ParticipantDoc[] = [];
  const reubicar: Incorporacion['reubicar'][number][] = [];
  for (const p of resultado.patrols) {
    // biome-ignore lint/style/noNonNullAssertion: cada número tiene su patrulla, vieja o nueva
    const patrolId = idDe.get(p.number)!;
    for (const u of p.units) {
      for (const m of u.members) {
        const previo = porArquero.get(m.archerId);
        if (!previo) {
          insertar.push(participanteNuevo(m, u.label, torneo._id, patrolId, ahora));
        } else if (
          !previo.patrolId.equals(patrolId) ||
          previo.unit !== u.label ||
          previo.position !== m.position
        ) {
          reubicar.push({ id: previo._id, patrolId, unit: u.label, position: m.position });
        }
      }
    }
  }

  return {
    patrullasNuevas,
    insertar,
    reubicar,
    quitar: quitados.map((p) => p._id),
    patrolCount: resultado.patrols.length,
    participantCount: archerIds.length,
    violaciones: resultado.violations.length,
  };
}

/** Escribe la incorporación, todo junto: un participante a medio mover no puede quedar. */
async function aplicarIncorporacion(
  tournamentId: ObjectId,
  inc: Incorporacion,
  actorId: ObjectId,
): Promise<void> {
  await conTransaccion(async (session) => {
    await tournamentRepo.removeParticipants(tournamentId, inc.quitar, session);
    await tournamentRepo.insertPatrols(inc.patrullasNuevas, session);
    await tournamentRepo.insertParticipants(inc.insertar, session);
    for (const r of inc.reubicar) {
      await tournamentRepo.reassignParticipant(
        r.id,
        { patrolId: r.patrolId, unit: r.unit, position: r.position },
        session,
      );
    }

    await auditRepo.record(
      {
        actorType: 'admin',
        actorId,
        action: 'tournament.participants_edit',
        entity: 'tournament',
        entityId: tournamentId,
        meta: {
          participants: inc.participantCount,
          patrols: inc.patrolCount,
          added: inc.insertar.length,
          removed: inc.quitar.length,
          newPatrols: inc.patrullasNuevas.length,
          violations: inc.violaciones,
        },
      },
      session,
    );
  });
}

/**
 * «Rearmar patrullas», como acción explícita del admin (`BE-31`, decisión 5 de la Fase 10).
 *
 * Desde que editar participantes dejó de rearmar, ésta es la única forma de volver a correr
 * `buildPatrols` sobre un torneo armado: patrullas nuevas, **con PIN nuevos** —la pantalla lo
 * avisa antes (`FE-48`)—. Se conservan los pagos. Sólo sin iniciar.
 *
 * @throws {AppError} `NOT_FOUND` · `INVALID_STATE_TRANSITION` si el torneo ya arrancó.
 */
export async function rearmarPatrullas(
  tournamentId: ObjectId,
  actorId: ObjectId,
  ip: string | null,
): Promise<void> {
  const torneo = await tournamentRepo.findById(tournamentId);
  if (!torneo) throw notFound();
  if (torneo.status !== 'sin_iniciar') {
    throw new AppError('INVALID_STATE_TRANSITION', {
      message: 'Las patrullas sólo se pueden rearmar mientras el torneo no arrancó.',
    });
  }

  const inscriptos = await tournamentRepo.listParticipants(tournamentId);
  const { patrolDocs, participantDocs: sinPagos } = await prepararParticipantes(
    torneo,
    inscriptos.map((p) => p.archerId.toHexString()),
    torneo.stakeMap,
    torneo.targets.length,
  );
  const participantDocs = await conLosPagos(torneo, sinPagos);

  await conTransaccion(async (session) => {
    const actualizado = await tournamentRepo.updateIfStatus(
      tournamentId,
      'sin_iniciar',
      { patrolCount: patrolDocs.length, participantCount: participantDocs.length },
      session,
    );
    if (!actualizado) {
      throw new AppError('INVALID_STATE_TRANSITION', {
        message: 'El torneo cambió de estado mientras se procesaba la solicitud.',
      });
    }

    await tournamentRepo.clearDistribution(tournamentId, session);
    await tournamentRepo.insertPatrols(patrolDocs, session);
    await tournamentRepo.insertParticipants(participantDocs, session);

    await auditRepo.record(
      {
        actorType: 'admin',
        actorId,
        action: 'patrol.rebuild',
        entity: 'tournament',
        entityId: tournamentId,
        meta: { patrols: patrolDocs.length, participants: participantDocs.length },
        ip,
      },
      session,
    );
  });
}

/**
 * Que los arqueros existan, que ninguno esté archivado y que el mapa de estacas los ubique.
 *
 * Las mismas comprobaciones que al crear el torneo: si estuvieran sólo en la creación, se podría
 * meter un archivado por la puerta de la edición.
 */
async function validarArqueros(archerIds: readonly string[], stakeMap: StakeMap) {
  const ids = archerIds.map((id) => new ObjectId(id));
  const arqueros = await archerRepo.findManyByIds(ids);

  if (arqueros.length !== ids.length) {
    throw new AppError('NOT_FOUND', { message: 'Alguno de los arqueros no existe.' });
  }

  const archivados = arqueros.filter((a) => a.archivedAt !== null);
  if (archivados.length > 0) {
    throw new AppError('VALIDATION_ERROR', {
      message: 'No se puede inscribir a un arquero archivado.',
      details: { archerIds: archivados.map((a) => a._id.toHexString()) },
    });
  }

  /*
    Un mapa que no ubica la categoría de un inscripto dejaría al dominio sin estaca para él, y
    `buildPatrols` lanzaría un `DomainError` que sale como 500. Es un dato mal cargado: 400.
  */
  const sinEstaca = [...new Set(arqueros.map((a) => a.category))].filter(
    (c) => estacaEn(stakeMap, c) === null,
  );
  if (sinEstaca.length > 0) {
    throw validationError({ stakeMap: `Sin estaca para: ${sinEstaca.join(', ')}.` });
  }

  return arqueros;
}
