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

import { useState } from 'react';
import { Button, Encabezado, Pantalla, Screen } from '../../components/ui.js';
import { ApiError, api } from '../../lib/apiClient.js';
import { FilaDeArquero } from '../padron/FilaDeArquero.js';
import { FilaPendiente } from '../padron/FilaPendiente.js';
import { FiltrosDelPadron } from '../padron/FiltrosDelPadron.js';
import { FormularioDeArquero } from '../padron/FormularioDeArquero.js';
import { BORRADOR_VACIO, type Borrador } from '../padron/tipos.js';
import { usePadron } from '../padron/usePadron.js';

export function ArchersPage({ onVolver }: { readonly onVolver: () => void }) {
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
    const cuerpo = {
      firstName: b.firstName,
      lastName: b.lastName,
      category: b.category,
      sex: b.sex || null,
      dni: b.dni.trim() || null,
    };
    await (b.id ? api.patch(`/admin/archers/${b.id}`, cuerpo) : api.post('/admin/archers', cuerpo));
    setEditando(undefined);
    setErrorDeAccion(undefined);
    await padron.recargar();
  };

  const { arqueros, visibles, busqueda, verPendientes, verArchivados } = padron;

  return (
    <Pantalla>
      <Encabezado titulo="Arqueros" onVolver={onVolver} />

      <Screen>
        {editando ? (
          <div className="pt-4">
            <FormularioDeArquero
              inicial={editando}
              onGuardar={guardar}
              onCancelar={() => setEditando(undefined)}
            />
          </div>
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
        />

        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        {arqueros === undefined && !error && <p className="text-[var(--ink-muted)]">Cargando…</p>}

        {visibles?.length === 0 && (
          <p className="text-[var(--ink-muted)]">
            {busqueda.trim()
              ? 'Ningún arquero coincide con la búsqueda.'
              : verPendientes
                ? 'No hay altas pendientes de aprobar.'
                : verArchivados
                  ? 'No hay arqueros archivados.'
                  : 'El padrón está vacío.'}
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {visibles?.map((a) =>
            verPendientes ? (
              <FilaPendiente
                key={a.id}
                arquero={a}
                onAprobar={() => accion(() => api.post(`/admin/archers/${a.id}/approve`))}
                onRechazar={() => accion(() => api.post(`/admin/archers/${a.id}/reject`))}
              />
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
                onArchivar={() => void accion(() => api.post(`/admin/archers/${a.id}/archive`))}
                onRestaurar={() => void accion(() => api.post(`/admin/archers/${a.id}/restore`))}
                onEliminar={() => void accion(() => api.del(`/admin/archers/${a.id}`))}
              />
            ),
          )}
        </ul>
      </Screen>
    </Pantalla>
  );
}
