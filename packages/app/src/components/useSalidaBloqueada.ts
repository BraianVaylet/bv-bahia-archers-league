/**
 * Bloquea el botón Atrás mientras hay sesión.
 *
 * **El problema es del día del torneo.** Un toque de más en Atrás sacaba al
 * líder de WAFL —o al admin de WAFA— a la pantalla de elección, y volver
 * significaba loguearse de nuevo: con guantes, al sol, y en WAFL con el PIN de
 * la planilla en el bolsillo. La única salida tiene que ser deliberada.
 *
 * **Cómo funciona.** Se empuja una entrada de historia al montar; cuando el
 * usuario va atrás, esa entrada se consume y se vuelve a empujar. El resultado
 * es que la app se queda donde está, sin bloquear nada más del navegador:
 * recargar, cerrar la pestaña y navegar hacia adelante siguen funcionando.
 *
 * **No usa `beforeunload`.** Ese aviso lo dispara también recargar la página,
 * que es lo que un líder hace cuando algo se ve raro; un diálogo del navegador
 * ahí asusta más de lo que evita. Y en un celular a veces ni se muestra.
 */

import { useEffect } from 'react';

/** Marca de la entrada propia, para no confundirla con una del ruteo. */
const MARCA = 'bal:sin-salida';

export function useSalidaBloqueada(activo: boolean): void {
  useEffect(() => {
    if (!activo) return;

    /**
     * La entrada centinela.
     *
     * Se empuja **una sola vez**: empujarla en cada `popstate` sin condición
     * llenaría el historial y haría que salir por adelante tampoco funcione.
     */
    if (window.history.state?.[MARCA] !== true) {
      window.history.pushState({ ...window.history.state, [MARCA]: true }, '');
    }

    const alVolver = () => {
      // Se vuelve a empujar: el usuario se queda donde estaba.
      window.history.pushState({ ...window.history.state, [MARCA]: true }, '');
    };

    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, [activo]);
}
