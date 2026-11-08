/**
 * Editar los datos de un torneo que todavía no arrancó, o eliminarlo.
 *
 * Sólo mientras nadie tiró. Una vez iniciado, el recorrido está descargado en los celulares de
 * los líderes y cambiarlo dejaría la app y el papel diciendo cosas distintas.
 */

import { useState } from 'react';
import { Button, clasesDeTarjeta, cn, Field } from '../../components/ui.js';
import { ApiError, rpc } from '../../lib/rpc.js';
import type { Torneo } from './useTorneo.js';

export function EdicionDelTorneo({
  torneo,
  onCambio,
  onError,
  onEliminado,
}: {
  readonly torneo: Torneo;
  readonly onCambio: () => Promise<void>;
  readonly onError: (mensaje: string) => void;
  readonly onEliminado: () => void;
}) {
  const [editando, setEditando] = useState<Torneo>();
  const [eliminando, setEliminando] = useState(false);

  /**
   * Borrar pide dos toques.
   *
   * No hay `confirm()` —bloquea el hilo y en un celular sale del contexto— ni modal: el segundo
   * toque sobre el mismo botón, con el texto cambiado, dice lo mismo y no tapa la pantalla.
   */
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  const guardarDatos = async () => {
    if (!editando) return;
    try {
      await rpc.admin.tournaments[':id'].$patch({
        param: { id: torneo.id },
        json: { name: editando.name.trim(), date: editando.date.slice(0, 10) },
      });
      setEditando(undefined);
      await onCambio();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'No se pudieron guardar los cambios.');
    }
  };

  const eliminar = async () => {
    if (!confirmandoBorrado) {
      setConfirmandoBorrado(true);
      return;
    }

    setEliminando(true);
    try {
      await rpc.admin.tournaments[':id'].$delete({ param: { id: torneo.id } });
      onEliminado();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'No se pudo eliminar el torneo.');
      setConfirmandoBorrado(false);
    } finally {
      setEliminando(false);
    }
  };

  return (
    <>
      {torneo.status === 'sin_iniciar' && (
        <div className="flex gap-2 pt-2">
          <Button
            variante="secundario"
            className="flex-1"
            onClick={() => setEditando(editando ? undefined : { ...torneo })}
          >
            {editando ? 'Cancelar edición' : 'Editar'}
          </Button>

          <Button
            variante="peligro"
            disabled={eliminando}
            onClick={() => void eliminar()}
            className="flex-1"
          >
            {confirmandoBorrado ? 'Confirmar borrado' : 'Eliminar'}
          </Button>
        </div>
      )}

      {confirmandoBorrado && (
        <p role="status" className="text-sm text-[var(--danger)]">
          Se van a borrar el torneo, sus patrullas y sus credenciales. Tocá de nuevo para confirmar.
        </p>
      )}

      {/* Sólo nombre, fecha y descripción. El recorrido tiene sus propias reglas —un blanco con
          puntajes está bloqueado— y se edita desde su pantalla, no de refilón acá. */}
      {editando && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void guardarDatos();
          }}
          className={cn(clasesDeTarjeta(), 'flex flex-col gap-3')}
          data-testid="editar-torneo"
        >
          <Field
            label="Nombre"
            value={editando.name}
            onChange={(e) => setEditando({ ...editando, name: e.target.value })}
            required
          />
          <Field
            label="Fecha"
            type="date"
            value={editando.date.slice(0, 10)}
            onChange={(e) => setEditando({ ...editando, date: e.target.value })}
            required
          />

          <Button type="submit" ancho disabled={editando.name.trim().length < 3}>
            Guardar cambios
          </Button>
        </form>
      )}
    </>
  );
}
