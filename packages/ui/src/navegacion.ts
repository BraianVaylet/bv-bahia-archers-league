/**
 * Navegación accesible de una SPA (`REF6-12` / `U-5`).
 *
 * Con una página nueva el navegador cambia el título, lleva el scroll arriba y deja el foco al
 * principio. En una SPA nada de eso pasa solo, y se nota donde más molesta:
 *
 * - **El título.** Todas las pantallas se llamaban igual en el historial, en las pestañas y para un
 *   lector de pantalla (WCAG 2.4.2).
 * - **El scroll.** El contenido scrollea dentro de un contenedor (`h-dvh overflow-hidden`), y React
 *   Router sólo restaura el scroll de `window`: del ranking a la ficha de un arquero se entraba a la
 *   mitad de la página.
 * - **El foco.** Seguía en el enlace que se tocó, que a veces ya no existe.
 *
 * Sin I/O ni dependencia del router: el hook recibe el `pathname`, que cada app lee de su `location`.
 */

import { useEffect, useRef } from 'react';

export const NOMBRE_DEL_SITIO = 'Liga Bahiense de Arquería';

/** Cuánto se espera a que aparezca el título de una pantalla que carga datos o un chunk. */
const PLAZO_DEL_TITULO_MS = 3_000;

/**
 * El contenedor que scrollea en la PWA: lo marca `Screen`. La landing no tiene (`REF7-5`): es un
 * documento y scrollea la ventana.
 */
const SCROLL_PRINCIPAL = '[data-scroll-principal]';

/** El título de pantalla que no es un `h1`: el del `Encabezado` de la PWA. */
const TITULO_DE_ENCABEZADO = '[data-titulo-de-pagina]';

/**
 * El título de la pantalla, en la pestaña, el historial y el lector de pantalla.
 *
 * Sin título —o vacío— queda el nombre del sitio. Una pantalla que carga su nombre (un torneo) lo
 * pasa cuando llega: mientras tanto, el genérico.
 */
export function useTituloDePagina(titulo?: string): void {
  const limpio = titulo?.trim();

  useEffect(() => {
    document.title = limpio ? `${limpio} · ${NOMBRE_DEL_SITIO}` : NOMBRE_DEL_SITIO;
  }, [limpio]);
}

const objetivoDelFoco = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('h1') ??
  document.querySelector<HTMLElement>(TITULO_DE_ENCABEZADO);

/**
 * Alguien está escribiendo. No se le saca el foco: un enlace que persiste entre pantallas (el
 * header) no cuenta, sólo lo que se edita.
 */
function estaEscribiendo(): boolean {
  const activo = document.activeElement;
  return (
    activo instanceof HTMLElement &&
    (activo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(activo.tagName))
  );
}

function enfocar(elemento: HTMLElement): void {
  // Un título no es focusable: `-1` deja que el código lo enfoque sin meterlo en el orden del Tab.
  if (!elemento.hasAttribute('tabindex')) elemento.setAttribute('tabindex', '-1');
  elemento.focus({ preventScroll: true });
}

/**
 * Al cambiar de ruta: el scroll del contenedor vuelve a 0 y el foco va al título de la pantalla.
 *
 * - **No hace nada en el primer render**: una página recién abierta ya está arriba, y robar el foco
 *   a quien está llegando es peor que no moverlo.
 * - **Sólo cuenta el `pathname`.** Cambiar un filtro de la URL (`?temporada=`) no es otra pantalla.
 * - **Si el título todavía no existe** —la pantalla carga datos, o es un chunk perezoso— se espera
 *   a que aparezca, hasta un plazo, y no se enfoca si mientras tanto el usuario se puso a escribir.
 */
export function useAlCambiarDeRuta(pathname: string): void {
  const anterior = useRef(pathname);

  useEffect(() => {
    if (anterior.current === pathname) return;
    anterior.current = pathname;

    const scroll = document.querySelector<HTMLElement>(SCROLL_PRINCIPAL);
    if (scroll) scroll.scrollTop = 0;
    else window.scrollTo({ top: 0 });

    const ya = objetivoDelFoco();
    if (ya) {
      if (!estaEscribiendo()) enfocar(ya);
      return;
    }

    const observador = new MutationObserver(() => {
      const objetivo = objetivoDelFoco();
      if (!objetivo) return;

      observador.disconnect();
      clearTimeout(vencimiento);
      if (!estaEscribiendo()) enfocar(objetivo);
    });
    const vencimiento = setTimeout(() => observador.disconnect(), PLAZO_DEL_TITULO_MS);
    observador.observe(document.body, { childList: true, subtree: true });

    return () => {
      observador.disconnect();
      clearTimeout(vencimiento);
    };
  }, [pathname]);
}
