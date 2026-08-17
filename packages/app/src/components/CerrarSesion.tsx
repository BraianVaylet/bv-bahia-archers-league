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

import { useEffect, useRef, useState } from 'react';
import { Button } from './ui.js';

export interface CerrarSesionProps {
  readonly onCerrar: () => void;
  /**
   * Cuántos cambios quedaron sin enviar. Sólo lo pasa WAFL: en WAFA no hay
   * outbox y cerrar sesión no pierde nada.
   */
  readonly pendientes?: number;
  /**
   * Abierto desde afuera — el ícono del header.
   *
   * **Hay una sola confirmación, no dos.** Duplicarla para el header habría
   * duplicado también el texto de cuántos cambios se pierden, y dos textos que
   * dicen lo mismo terminan diciendo cosas distintas.
   *
   * Sin esta prop el componente se maneja solo, que es como lo usa el botón de
   * abajo.
   */
  readonly abierto?: boolean;
  readonly onAbiertoChange?: (abierto: boolean) => void;
}

export function CerrarSesion({
  onCerrar,
  pendientes = 0,
  abierto,
  onAbiertoChange,
}: CerrarSesionProps) {
  const [propio, setPropio] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  const confirmando = abierto ?? propio;
  const setConfirmando = (v: boolean) => {
    setPropio(v);
    onAbiertoChange?.(v);
  };

  /**
   * Si lo abrió el header, hay que traerlo a la vista.
   *
   * El bloque vive al final del contenido —a propósito: es la única salida de
   * la app y no puede tocarse de refilón— así que abrirlo desde arriba dejaría
   * al usuario mirando una pantalla que no cambió.
   */
  useEffect(() => {
    if (!confirmando) return;

    /**
     * `scrollIntoView` puede no existir: jsdom no lo implementa, y navegadores
     * viejos tampoco. Traer el bloque a la vista es una comodidad — si no se
     * puede, la confirmación igual está ahí y se llega bajando. Que falte no
     * puede romper la única salida de la app.
     *
     * Es la misma lección que `matchMedia` en `REF-4`, donde una API ausente
     * dejó una pantalla entera en blanco.
     */
    caja.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [confirmando]);

  return (
    <div ref={caja} className="flex flex-col gap-2 pt-2 print:hidden">
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
