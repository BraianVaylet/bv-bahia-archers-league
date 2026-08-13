/**
 * Conmutador de tema claro/oscuro.
 *
 * **Estaba duplicado carácter por carácter** entre la PWA y la landing. El
 * comentario de la landing decía «repetido a propósito, la landing no comparte
 * bundle con la app de administración» — y eso sigue siendo cierto: son dos
 * builds separados. Lo que cambió es que ahora la copia la hace el bundler a
 * partir de una sola fuente, en vez de hacerla una persona a mano.
 *
 * Ver `docs/DESIGN_SYSTEM.md` §10.
 */

import { alternarTema, COLOR_DE_BARRA, resolverTema, TEMA_KEY, type Tema } from '@bal/shared';
import { useEffect, useState } from 'react';
import { cn } from './cn.js';
import { IconoLuna, IconoSol } from './iconos/acciones.js';

/**
 * `matchMedia` puede no existir: navegadores viejos, y jsdom sin configurar.
 *
 * **La consulta está aislada acá a propósito.** Antes se llamaba dentro del
 * `try` de `temaInicial` *y de nuevo en su `catch`*: cuando `matchMedia`
 * faltaba, el `catch` volvía a tirar y el error salía sin atrapar. Como el
 * conmutador vive en el header, eso no dejaba sin botón — **rompía la pantalla
 * entera**. Un camino de respaldo que repite la llamada que falló no es un
 * respaldo.
 */
function prefiereOscuro(): boolean {
  try {
    return matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/**
 * Lee el tema inicial de `localStorage`, cayendo en la preferencia del sistema.
 *
 * Se calcula **al construir el estado**, no en un efecto: el script anti-FOUC
 * de `index.html` ya pintó el documento con este mismo criterio, y arrancar con
 * otro valor haría exactamente el parpadeo que ese script evita.
 */
function temaInicial(): Tema {
  try {
    return resolverTema(localStorage.getItem(TEMA_KEY), prefiereOscuro());
  } catch {
    // Sin `localStorage` —modo privado de algunos navegadores— se sigue el
    // sistema. No poder recordar la elección no es motivo para ignorarla.
    return resolverTema(null, prefiereOscuro());
  }
}

const NOMBRE: Record<Tema, string> = { light: 'claro', dark: 'oscuro' };

export function BotonTema({ className }: { readonly className?: string }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', COLOR_DE_BARRA[tema]);

    try {
      localStorage.setItem(TEMA_KEY, tema);
    } catch {
      /* Sin `localStorage` el tema vale para esta sesión y nada más. */
    }
  }, [tema]);

  const siguiente = alternarTema(tema);
  const Icono = tema === 'dark' ? IconoSol : IconoLuna;

  return (
    <button
      type="button"
      onClick={() => setTema(siguiente)}
      aria-label={`Cambiar a tema ${NOMBRE[siguiente]}`}
      className={cn(
        'min-h-[44px] min-w-[44px] rounded-[var(--radius-sm)] border',
        'flex items-center justify-center shrink-0 print:hidden',
        className,
      )}
    >
      <Icono />
    </button>
  );
}
