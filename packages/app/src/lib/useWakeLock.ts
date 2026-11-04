/**
 * Mantiene la pantalla encendida mientras la pantalla de la app está montada (`REF6-12` / `U-7`).
 *
 * Entre flecha y flecha el celular se bloquea, y desbloquearlo con guantes es exactamente lo que el
 * sistema de diseño intenta evitar. La Screen Wake Lock API lo evita **sin dejar la pantalla
 * encendida todo el recorrido**: se pide sólo en la pantalla de un blanco y se suelta al salir.
 *
 * - **Es opcional**: sin la API (navegadores viejos) o si el sistema la niega —batería baja, ahorro
 *   de energía—, no pasa nada y se sigue anotando. Nada del camino de anotar depende de esto.
 * - **El navegador lo suelta solo al ocultarse la página**, así que se vuelve a pedir al volver a
 *   ser visible. Sin eso, el candado del primer blanco no cubriría el segundo.
 * - **Costo**: batería. Por eso `TargetPage` y no toda la app (decisión 4 de `REF6-12`).
 */

import { useEffect } from 'react';

export function useWakeLock(activo = true): void {
  useEffect(() => {
    if (!activo || !('wakeLock' in navigator)) return;

    let cancelado = false;
    let pidiendo = false;
    let candado: WakeLockSentinel | undefined;

    const pedir = async () => {
      // Con un pedido en camino o un candado vivo, otro pedido sólo gastaría batería.
      if (cancelado || pidiendo || candado) return;

      pidiendo = true;
      try {
        const nuevo = await navigator.wakeLock.request('screen');
        if (cancelado) {
          // La pantalla se fue mientras el pedido viajaba: el candado llega tarde y se suelta.
          await nuevo.release().catch(() => {});
          return;
        }
        candado = nuevo;
        nuevo.addEventListener('release', () => {
          if (candado === nuevo) candado = undefined;
        });
      } catch {
        // Sin permiso o con batería baja. Se reintenta la próxima vez que la página sea visible.
      } finally {
        pidiendo = false;
      }
    };

    const alCambiarLaVisibilidad = () => {
      if (document.visibilityState === 'visible') void pedir();
    };

    void pedir();
    document.addEventListener('visibilitychange', alCambiarLaVisibilidad);

    return () => {
      cancelado = true;
      document.removeEventListener('visibilitychange', alCambiarLaVisibilidad);
      void candado?.release().catch(() => {});
      candado = undefined;
    };
  }, [activo]);
}
