/**
 * Editar los datos de un torneo, o eliminarlo.
 *
 * **Qué se puede editar lo decide `camposEditables`** de `@bal/shared` (`SH-11`, `FE-33`), la
 * misma tabla con la que el servidor acepta o rechaza el pedido: sin iniciar, todo; en proceso,
 * nombre, fecha y link (decisión 1); esperando publicación, nombre y fecha; publicado, nada. Si
 * cada lado tuviera su regla, el formulario podría ofrecer un campo que el servidor rechaza.
 *
 * Eliminar sigue siendo sólo de un torneo que no arrancó (`puedeEliminar`).
 */

import { camposEditables, puedeEliminar } from '@bal/shared';
import { useState } from 'react';
import { Button, clasesDeTarjeta, cn, Field } from '../../components/ui.js';
import { ApiError, rpc } from '../../lib/rpc.js';
import { CampoDePago } from '../crear/CampoDePago.js';
import { linkParaEnviar, problemaDelLink } from '../wizard.js';
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

  const editables = camposEditables(torneo.status);
  // El formulario de acá edita nombre y fecha; sin al menos eso, no hay nada que ofrecer.
  const sePuedeEditar = editables.has('name') && editables.has('date');
  const editaLink = editables.has('registrationUrl');
  const editaDescripcion = editables.has('description');
  const editaPago = editables.has('payment');
  const sePuedeEliminar = puedeEliminar(torneo.status);

  const linkActual = torneo.registrationUrl ?? null;
  const descripcionActual = torneo.description ?? '';
  const pagoActual = torneo.payment ?? { required: false, amount: 0 };
  const problemaDeLink =
    editando && editaLink ? problemaDelLink(editando.registrationUrl ?? '') : undefined;
  const pagoSinMonto =
    editando !== undefined &&
    editaPago &&
    editando.payment?.required === true &&
    !(editando.payment.amount > 0);

  const guardarDatos = async () => {
    if (!editando) return;
    const link = linkParaEnviar(editando.registrationUrl ?? '');
    const descripcion = (editando.description ?? '').trim();
    const pago = editando.payment ?? pagoActual;
    const pagoCambio = pago.required !== pagoActual.required || pago.amount !== pagoActual.amount;
    try {
      await rpc.admin.tournaments[':id'].$patch({
        param: { id: torneo.id },
        json: {
          name: editando.name.trim(),
          date: editando.date.slice(0, 10),
          // Sólo si el estado lo permite y cambió: el servidor rechaza el pedido entero si sobra
          // un campo, y el audit log no anota un cambio que no hubo (`BE-24`).
          ...(editaLink && link !== linkActual ? { registrationUrl: link } : {}),
          ...(editaDescripcion && descripcion !== descripcionActual.trim()
            ? { description: descripcion }
            : {}),
          ...(editaPago && pagoCambio ? { payment: { ...pago } } : {}),
        },
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

  if (!sePuedeEditar && !sePuedeEliminar) return null;

  return (
    <>
      <div className="flex gap-2 pt-2">
        {sePuedeEditar && (
          <Button
            variante="secundario"
            className="flex-1"
            onClick={() => setEditando(editando ? undefined : { ...torneo })}
          >
            {editando ? 'Cancelar edición' : 'Editar'}
          </Button>
        )}

        {sePuedeEliminar && (
          <Button
            variante="peligro"
            disabled={eliminando}
            onClick={() => void eliminar()}
            className="flex-1"
          >
            {confirmandoBorrado ? 'Confirmar borrado' : 'Eliminar'}
          </Button>
        )}
      </div>

      {confirmandoBorrado && (
        <p role="status" className="text-sm text-[var(--danger)]">
          Se van a borrar el torneo, sus patrullas y sus credenciales. Tocá de nuevo para confirmar.
        </p>
      )}

      {/* Nombre, fecha y, si el estado lo deja, el link. El recorrido tiene sus propias reglas —un
          blanco con puntajes está bloqueado— y se edita desde su pantalla, no de refilón acá. */}
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
          {/* `FE-32`: lo que el servidor ya aceptaba y la ficha no ofrecía. */}
          {editaDescripcion && (
            <Field
              label="Descripción"
              value={editando.description ?? ''}
              onChange={(e) => setEditando({ ...editando, description: e.target.value })}
              placeholder="Opcional"
            />
          )}
          {/* `FE-36`. Vaciarlo lo borra: el formulario de pre-inscripción cerró. */}
          {editaLink && (
            <Field
              label="Link de pre-inscripción"
              type="url"
              inputMode="url"
              autoComplete="off"
              value={editando.registrationUrl ?? ''}
              onChange={(e) => setEditando({ ...editando, registrationUrl: e.target.value })}
              placeholder="Opcional · https://…"
              hint="Vacío, la landing no muestra el botón."
              error={problemaDeLink}
            />
          )}
          {editaPago && (
            <CampoDePago
              pago={editando.payment ?? pagoActual}
              onCambio={(payment) => setEditando({ ...editando, payment })}
            />
          )}

          <Button
            type="submit"
            ancho
            disabled={
              editando.name.trim().length < 3 || problemaDeLink !== undefined || pagoSinMonto
            }
          >
            Guardar cambios
          </Button>
        </form>
      )}
    </>
  );
}
