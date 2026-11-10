/**
 * Padrón de arqueros.
 *
 * **Eliminar no es lo mismo que archivar.** Un arquero que participó de un torneo no se puede
 * borrar: su histórico y su lugar en los rankings dependen de que siga existiendo. La pantalla lo
 * dice antes de que el admin lo intente, no después.
 *
 * Es sólo la composición (`REF6-11` / `C-1`): los datos y los filtros salen de `usePadron`, y cada
 * pieza vive en `wafa/padron/`.
 *
 * Ver `docs/FUNCTIONAL.md` §6.4.
 */

import { useTituloDePagina } from '@bal/ui';
import { useState } from 'react';
import { Button, Encabezado, Pantalla, Screen } from '../../components/ui.js';
import { ApiError, rpc } from '../../lib/rpc.js';
import { FilaDeArquero } from '../padron/FilaDeArquero.js';
import { FilaPendiente } from '../padron/FilaPendiente.js';
import { FiltrosDelPadron } from '../padron/FiltrosDelPadron.js';
import { FormularioDeArquero } from '../padron/FormularioDeArquero.js';
import { aCuerpoDeArquero, BORRADOR_VACIO, type Borrador } from '../padron/tipos.js';
import { usePadron } from '../padron/usePadron.js';

/** Por qué la lista está vacía: un padrón vacío y un filtro sin resultados no son lo mismo. */
function mensajeDeVacio(padron: ReturnType<typeof usePadron>): string {
  if (padron.busqueda.trim()) return 'Ningún arquero coincide con la búsqueda.';
  if (padron.soloIncompletos && padron.arqueros?.length) return 'Nadie tiene datos incompletos.';
  if (padron.verPendientes) return 'No hay altas pendientes de aprobar.';
  if (padron.verArchivados) return 'No hay arqueros archivados.';
  return 'El padrón está vacío.';
}

export function ArchersPage({ onVolver }: { readonly onVolver: () => void }) {
  useTituloDePagina('Arqueros');
  const padron = usePadron();
  const [editando, setEditando] = useState<Borrador>();

  /**
   * El error de la última acción, aparte del de la carga: así un fallo de «archivar» no lo borra
   * una recarga que sale bien por otro lado, y una carga fallida no tapa un rechazo del servidor.
   */
  const [errorDeAccion, setErrorDeAccion] = useState<string>();
  const error = errorDeAccion ?? padron.error;

  const accion = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setErrorDeAccion(undefined);
      await padron.recargar();
    } catch (err) {
      setErrorDeAccion(err instanceof ApiError ? err.message : 'No se pudo completar la acción.');
    }
  };

  const guardar = async (b: Borrador) => {
    const cuerpo = aCuerpoDeArquero(b);
    await (b.id
      ? rpc.admin.archers[':id'].$patch({ param: { id: b.id }, json: cuerpo })
      : rpc.admin.archers.$post({ json: cuerpo }));
    setEditando(undefined);
    setErrorDeAccion(undefined);
    await padron.recargar();
  };

  const { arqueros, visibles, busqueda, verPendientes, verArchivados, soloIncompletos } = padron;

  const formulario = (borrador: Borrador) => (
    <FormularioDeArquero
      inicial={borrador}
      onGuardar={guardar}
      onCancelar={() => setEditando(undefined)}
    />
  );

  return (
    <Pantalla>
      <Encabezado titulo="Arqueros" onVolver={onVolver} />

      <Screen>
        {/* Arriba sólo el alta. La edición se abre en el lugar del arquero (ver la lista):
            arriba quedaba fuera de pantalla cuando el arquero estaba abajo en el padrón. */}
        {editando && !editando.id ? (
          <div className="pt-4">{formulario(editando)}</div>
        ) : (
          <div className="pt-4">
            <Button ancho onClick={() => setEditando(BORRADOR_VACIO)}>
              Nuevo arquero
            </Button>
          </div>
        )}

        <FiltrosDelPadron
          busqueda={busqueda}
          onBusqueda={padron.setBusqueda}
          categoria={padron.categoria}
          onCategoria={padron.setCategoria}
          verArchivados={verArchivados}
          onVerArchivados={padron.elegirArchivados}
          verPendientes={verPendientes}
          onVerPendientes={padron.elegirPendientes}
          soloIncompletos={soloIncompletos}
          onSoloIncompletos={padron.setSoloIncompletos}
        />

        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        {arqueros === undefined && !error && <p className="text-[var(--ink-muted)]">Cargando…</p>}

        {visibles?.length === 0 && (
          <p className="text-[var(--ink-muted)]">{mensajeDeVacio(padron)}</p>
        )}

        <ul className="flex flex-col gap-2">
          {visibles?.map((a) =>
            verPendientes ? (
              <FilaPendiente
                key={a.id}
                arquero={a}
                onAprobar={() =>
                  accion(() => rpc.admin.archers[':id'].approve.$post({ param: { id: a.id } }))
                }
                onRechazar={() =>
                  accion(() => rpc.admin.archers[':id'].reject.$post({ param: { id: a.id } }))
                }
              />
            ) : editando?.id === a.id ? (
              // Mismo `data-testid` que la fila: es el mismo arquero, abierto.
              <li key={a.id} data-testid={`arquero-${a.lastName}`}>
                {formulario(editando)}
              </li>
            ) : (
              <FilaDeArquero
                key={a.id}
                arquero={a}
                onEditar={() =>
                  setEditando({
                    id: a.id,
                    firstName: a.firstName,
                    lastName: a.lastName,
                    category: a.category,
                    sex: a.sex ?? '',
                    dni: a.dni ?? '',
                  })
                }
                onArchivar={() =>
                  void accion(() => rpc.admin.archers[':id'].archive.$post({ param: { id: a.id } }))
                }
                onRestaurar={() =>
                  void accion(() => rpc.admin.archers[':id'].restore.$post({ param: { id: a.id } }))
                }
                onEliminar={() =>
                  void accion(() => rpc.admin.archers[':id'].$delete({ param: { id: a.id } }))
                }
              />
            ),
          )}
        </ul>
      </Screen>
    </Pantalla>
  );
}
