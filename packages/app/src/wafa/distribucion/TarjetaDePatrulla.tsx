/**
 * Una patrulla del borrador: su inicio, sus unidades, a quién se mueve adónde y su credencial.
 */

import { ChipCategoria, IconoBajar, IconoEliminar, IconoMover, IconoSubir } from '@bal/ui';
import { Button, clasesDeTarjeta, cn, StakeChip } from '../../components/ui.js';
import {
  type Borrador,
  cambiarInicio,
  eliminarPatrulla,
  moverArquero,
  moverEnPatrulla,
  type PatrullaVista,
  unidadesDe,
} from '../patrullas.js';
import { BotonDeFila } from './BotonDeFila.js';
import { Credencial } from './Credencial.js';

/** Índice de un arquero dentro de su patrulla, para saber si está en un extremo. */
function indiceEnPatrulla(p: Borrador, participantId: string): number {
  return p.miembros.findIndex((m) => m.id === participantId);
}

export function TarjetaDePatrulla({
  patrulla: p,
  original,
  borrador,
  torneo,
  editable,
  moviendo,
  onMoviendo,
  onEditar,
  onRegenerado,
}: {
  readonly patrulla: Borrador;
  /** La patrulla como la tiene el servidor: de ahí salen el usuario y el PIN. */
  readonly original: PatrullaVista | undefined;
  readonly borrador: Borrador[];
  readonly torneo: { readonly targets: readonly { index: number }[] } | undefined;
  readonly editable: boolean;
  readonly moviendo: string | undefined;
  readonly onMoviendo: (participantId: string | undefined) => void;
  /** Toda edición del borrador pasa por acá, para que ninguna se olvide de marcarlo. */
  readonly onEditar: (siguiente: Borrador[]) => void;
  readonly onRegenerado: () => void;
}) {
  const editar = onEditar;
  const setMoviendo = onMoviendo;

  return (
    <article
      key={p.numero}
      className={cn(clasesDeTarjeta(), 'flex flex-col gap-3')}
      data-testid={`patrulla-${p.numero}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Patrulla {p.numero}</h2>

        <span className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-[var(--ink-muted)]">
            Arranca en el blanco {p.startTargetIndex}
          </span>

          {/*
                      Eliminar, **sólo cuando quedó vacía**. Con gente adentro
                      sacaría arqueros del torneo sin decirlo: primero se los
                      mueve. Eliminarla renumera a las que siguen, porque el
                      usuario del líder es `patrulla${'{'}number{'}'}` y una
                      numeración con huecos deja un usuario que no existe.
                    */}
          {editable && p.miembros.length === 0 && (
            <BotonDeFila
              icono={IconoEliminar}
              etiqueta={`Eliminar la patrulla ${p.numero}`}
              onClick={() => editar(eliminarPatrulla(borrador, p.numero))}
            />
          )}
        </span>
      </div>

      {editable && p.miembros.length === 0 && (
        <p className="text-sm text-[var(--warn)]" data-testid="patrulla-vacia">
          Sin arqueros. Movele alguien o eliminala: así no se puede guardar.
        </p>
      )}

      {editable && torneo && (
        <label className="flex items-center gap-2 text-sm print:hidden">
          Blanco de inicio
          <select
            aria-label={`Blanco de inicio de la patrulla ${p.numero}`}
            value={p.startTargetIndex}
            onChange={(e) => editar(cambiarInicio(borrador, p.numero, Number(e.target.value)))}
            className="min-h-[44px] px-2 rounded-[var(--radius-sm)] border bg-[var(--surface)]"
          >
            {torneo.targets.map((t) => (
              <option key={t.index} value={t.index}>
                {t.index}
              </option>
            ))}
          </select>
        </label>
      )}

      {p.miembros.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)]">
          Sin arqueros. Su credencial sigue existiendo por si la repartiste en papel.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {unidadesDe(p.miembros).map((u) => (
            <li key={u.label} className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                Unidad {u.label}
                {u.label === 'A' && ' · tira primero'}
              </span>

              {u.members.map((m, i) => (
                <div
                  key={m.id}
                  /*
                              **Tres renglones, no una fila.**

                              Estaba todo en una: nombre y categoría a la
                              izquierda, estaca y tres botones a la derecha. En
                              360px de ancho el nombre se cortaba y los botones
                              quedaban pegados contra el borde.

                              Ahora cada renglón responde una pregunta: quién
                              es, con qué tira, y qué se puede hacer con él.
                            */
                  className="flex flex-col gap-1.5 rounded-[var(--radius-md)] bg-[var(--surface-2)] px-3 py-2"
                  data-testid={`miembro-${m.lastName}`}
                >
                  {/* 1 · Quién es. Completo: en una planilla impresa
                                el apellido solo no alcanza para desempatar. */}
                  <p className="font-medium">
                    {m.lastName}, {m.firstName}
                  </p>

                  {/* 2 · Con qué tira: categoría y estaca. Las dos
                                deciden desde dónde y contra quién compite. */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ChipCategoria category={m.category} compacto />
                    <StakeChip stake={m.stake} compacto />
                  </div>

                  {/* 3 · Dónde se para, y qué se puede hacer.
                                El lado sale del ORDEN dentro de la unidad, no de
                                un dato guardado: es lo mismo que hace el
                                servidor al recibir la distribución. */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-[var(--ink-muted)]">
                      {i === 0 ? 'Izquierda' : 'Derecha'}
                    </span>

                    {editable && (
                      <div className="flex items-center gap-2 shrink-0 print:hidden">
                        {/*
                                    Subir y bajar **dentro** de la patrulla. No es
                                    cosmético: los dos primeros son la unidad `A`
                                    y la `A` tira primero, así que esto decide el
                                    orden de tiro.

                                    Deshabilitados en los extremos: un botón que
                                    parece activo y no hace nada es peor que uno
                                    apagado. Ver `DESIGN_SYSTEM.md` §10.
                                  */}
                        <BotonDeFila
                          icono={IconoSubir}
                          etiqueta={`Subir a ${m.lastName}`}
                          disabled={indiceEnPatrulla(p, m.id) === 0}
                          onClick={() => editar(moverEnPatrulla(borrador, m.id, 'arriba'))}
                        />
                        <BotonDeFila
                          icono={IconoBajar}
                          etiqueta={`Bajar a ${m.lastName}`}
                          disabled={indiceEnPatrulla(p, m.id) === p.miembros.length - 1}
                          onClick={() => editar(moverEnPatrulla(borrador, m.id, 'abajo'))}
                        />
                        <BotonDeFila
                          icono={IconoMover}
                          etiqueta={`Mover a ${m.lastName} a otra patrulla`}
                          onClick={() => setMoviendo(moviendo === m.id ? undefined : m.id)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* El destino se elige de una lista: arrastrar con guantes
                            en un celular no es una interacción confiable. */}
              {moviendo && u.members.some((m) => m.id === moviendo) && (
                <div className="flex flex-wrap gap-1.5 pt-1 print:hidden">
                  {borrador
                    .filter((otra) => otra.numero !== p.numero)
                    .map((otra) => (
                      <Button
                        key={otra.numero}
                        variante="secundario"
                        onClick={() => {
                          editar(moverArquero(borrador, moviendo, otra.numero));
                          setMoviendo(undefined);
                        }}
                      >
                        A la {otra.numero}
                      </Button>
                    ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {original && <Credencial patrulla={original} onRegenerado={onRegenerado} />}
    </article>
  );
}
