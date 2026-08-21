/**
 * Si el dispositivo tiene conexión, en el header.
 *
 * **WAFA la necesita y no la tenía.** Es la app que sí depende de la red: puede
 * leer de la caché sin señal, pero no crear ni editar nada. Sin indicador, el
 * admin descubre que está sin conexión recién cuando falla el guardado.
 *
 * WAFL no lo usa: ahí está el `SyncBadge`, que dice lo mismo y además cuántos
 * cambios quedan sin enviar. Dos indicadores de conexión en la misma barra
 * serían dos cosas que pueden contradecirse.
 *
 * **`navigator.onLine` no dice que el servidor esté vivo.** Dice que hay una
 * interfaz de red levantada: en el monte se tiene señal y no pasa un byte.
 * Por eso el texto habla de la conexión del dispositivo y no promete que la
 * app vaya a poder guardar — quien sabe eso de verdad es el intento real.
 */

import { useEffect, useState } from 'react';
import { cn } from './ui.js';

/**
 * `true` mientras el navegador se considere en línea.
 *
 * Arranca en `true` cuando `navigator.onLine` no existe: **es mejor no avisar
 * nada que teñir de rojo una app que anda bien**. Es la misma lección que
 * `matchMedia` en `REF-4`, donde una API ausente rompió una pantalla entera.
 */
export function useConexion(): boolean {
  const [enLinea, setEnLinea] = useState(() => navigator?.onLine ?? true);

  useEffect(() => {
    const conectado = () => setEnLinea(true);
    const desconectado = () => setEnLinea(false);

    // Se vuelve a leer al montar: entre el primer render y el efecto pudo
    // cambiar, y ahí no hubo evento que escuchar.
    setEnLinea(navigator?.onLine ?? true);

    window.addEventListener('online', conectado);
    window.addEventListener('offline', desconectado);
    return () => {
      window.removeEventListener('online', conectado);
      window.removeEventListener('offline', desconectado);
    };
  }, []);

  return enLinea;
}

export function IndicadorDeConexion({ className }: { readonly className?: string }) {
  const enLinea = useConexion();

  /*
    El color **nunca va solo** — `DESIGN_SYSTEM.md` §10.

    Un punto verde y uno rojo son el mismo punto para quien no distingue esos
    dos colores, que además es el par más común de confundir. El nombre
    accesible lo dice con palabras, y `role="status"` hace que el cambio se
    anuncie cuando la señal se cae.
  */
  const texto = enLinea ? 'Con conexión' : 'Sin conexión';

  return (
    <span
      role="status"
      aria-label={texto}
      title={texto}
      data-conexion={enLinea ? 'en-linea' : 'sin-linea'}
      data-testid="indicador-conexion"
      className={cn('flex items-center shrink-0 print:hidden', className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          'w-2.5 h-2.5 rounded-full',
          enLinea ? 'bg-[var(--ok)]' : 'bg-[var(--danger)]',
        )}
      />
    </span>
  );
}
