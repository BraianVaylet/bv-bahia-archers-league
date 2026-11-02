/**
 * Las acciones que cambian el estado de un torneo: iniciar, volver atrás y publicar.
 *
 * Dueño de su estado y de sus pedidos: avisa a la página con `onCambio` (que recarga) y
 * `onError`, y no sabe nada de cómo se carga el torneo.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, botonClases } from '../../components/ui.js';
import { ApiError, rpc } from '../../lib/rpc.js';
import type { Torneo } from './useTorneo.js';

export function ControlesDeEstado({
  torneo,
  onCambio,
  onError,
}: {
  readonly torneo: Torneo;
  /** Recarga la pantalla. Se espera: el botón sigue deshabilitado hasta que llegan los datos. */
  readonly onCambio: () => Promise<void>;
  readonly onError: (mensaje: string) => void;
}) {
  const [iniciando, setIniciando] = useState(false);
  const [confirmandoInicio, setConfirmandoInicio] = useState(false);

  /**
   * Volver a `sin_iniciar`.
   *
   * La guarda —que no haya ni un puntaje— **es del servidor**. Acá no se adivina: se pide y se
   * muestra lo que conteste. Una pantalla que decide sola puede estar mirando datos de hace un
   * minuto.
   */
  const volverAtras = async () => {
    setIniciando(true);
    try {
      await rpc.admin.tournaments[':id'].unstart.$post({ param: { id: torneo.id } });
      await onCambio();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'No se pudo volver atrás.');
    } finally {
      setIniciando(false);
    }
  };

  const iniciar = async () => {
    setIniciando(true);
    try {
      await rpc.admin.tournaments[':id'].start.$post({ param: { id: torneo.id } });
      await onCambio();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'No se pudo iniciar el torneo.');
    } finally {
      setIniciando(false);
    }
  };

  return (
    <>
      {/*
        Iniciar pide confirmación. No es una formalidad: a partir de acá las patrullas quedan
        congeladas y los líderes bajan el recorrido al celular. Dos toques sobre el mismo botón,
        sin `confirm()` ni modal — igual que eliminar, que es la otra acción de ida.
      */}
      {torneo.status === 'sin_iniciar' && (
        <div className="flex flex-col gap-2">
          {confirmandoInicio && (
            <p className="text-sm text-[var(--warn)]" role="status">
              A partir de acá las patrullas quedan congeladas y los líderes bajan el recorrido.
              ¿Iniciar el torneo?
            </p>
          )}
          <Button
            ancho
            disabled={iniciando}
            onClick={() => (confirmandoInicio ? void iniciar() : setConfirmandoInicio(true))}
          >
            {iniciando ? 'Iniciando…' : confirmandoInicio ? 'Sí, iniciar' : 'Iniciar torneo'}
          </Button>
        </div>
      )}

      {/*
        Y la vuelta atrás, para el arranque por error. El servidor la rechaza si ya hay un
        puntaje: acá no se esconde el botón por las dudas, se muestra el motivo cuando dice que no.
      */}
      {torneo.status === 'en_proceso' && (
        <Button variante="secundario" ancho disabled={iniciando} onClick={() => void volverAtras()}>
          {iniciando ? 'Volviendo…' : 'Volver a sin iniciar'}
        </Button>
      )}

      {(torneo.status === 'completado' || torneo.status === 'publicado') && (
        <Link to={`/wafa/torneos/${torneo.id}/publicar`} className={botonClases({ ancho: true })}>
          {torneo.status === 'publicado' ? 'Ver resultados' : 'Revisar y publicar'}
        </Link>
      )}
    </>
  );
}
