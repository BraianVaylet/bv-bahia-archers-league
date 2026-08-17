/**
 * Cerrar sesión: la **única** salida de la app.
 *
 * Desde que el botón Atrás dejó de sacar al usuario, esta es la puerta. Y por
 * eso mismo no puede ser un botón suelto que se toca de refilón: pide **dos
 * toques**, igual que eliminar un torneo en WAFA.
 *
 * **En WAFL además borra los datos locales**, que es lo que evita que un celu
 * prestado se quede con el recorrido de una patrulla. Si hay trabajo sin
 * sincronizar, eso significa **perder puntajes cargados**, así que se dice
 * cuántos y con esas palabras. La app nunca descarta trabajo en silencio; que
 * el usuario lo haga a propósito es otra cosa, y ahí lo que corresponde es que
 * sepa exactamente qué está tirando.
 */

import { useState } from 'react';
import { Button } from './ui.js';

export interface CerrarSesionProps {
  readonly onCerrar: () => void;
  /**
   * Cuántos cambios quedaron sin enviar. Sólo lo pasa WAFL: en WAFA no hay
   * outbox y cerrar sesión no pierde nada.
   */
  readonly pendientes?: number;
}

export function CerrarSesion({ onCerrar, pendientes = 0 }: CerrarSesionProps) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <div className="flex flex-col gap-2 pt-2 print:hidden">
      {confirmando && (
        <p role="status" className="text-sm text-[var(--warn)]" data-testid="aviso-cerrar-sesion">
          {pendientes > 0 ? (
            <>
              Quedan <strong>{pendientes}</strong>{' '}
              {pendientes === 1 ? 'cambio sin enviar' : 'cambios sin enviar'} al servidor. Si cerrás
              la sesión ahora, <strong>se pierden</strong>. Buscá señal primero si podés.
            </>
          ) : (
            <>Vas a tener que volver a entrar con el usuario y el PIN.</>
          )}
        </p>
      )}

      <Button
        variante={confirmando ? 'peligro' : 'secundario'}
        ancho
        onClick={() => (confirmando ? onCerrar() : setConfirmando(true))}
      >
        {confirmando ? 'Sí, cerrar sesión' : 'Cerrar sesión'}
      </Button>

      {confirmando && (
        <Button variante="secundario" ancho onClick={() => setConfirmando(false)}>
          Seguir en el torneo
        </Button>
      )}
    </div>
  );
}
