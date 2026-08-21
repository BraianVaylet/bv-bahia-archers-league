/**
 * La salida al sitio público, desde adentro de la PWA.
 *
 * **Estaba escrita dos veces** —en la elección de rol y en la pantalla de
 * torneo finalizado— y con los dos logins iban a ser cuatro. Es el mismo
 * arranque de la tarjeta que `REF5-2` tuvo que deshacer 29 veces.
 *
 * El destino se resuelve **una sola vez, al cargar el módulo**: el origen no
 * cambia mientras la app está abierta. Y no puede ser `/` a secas — en
 * producción sí es la landing, pero con `pnpm dev` son dos Vite en puertos
 * distintos y el enlace se quedaría dentro de la propia PWA.
 */

import { enlaceEntreApps } from '@bal/shared';
import { cn } from './ui.js';

export const A_LA_LANDING = enlaceEntreApps('landing', import.meta.env.DEV, window.location.href);

export interface VolverALaLigaProps {
  readonly children?: string;
  readonly className?: string;
}

/**
 * Enlace discreto, con objetivo táctil de 44 px.
 *
 * Discreto a propósito: quien abre la PWA viene a entrar, no a mirar
 * resultados. Pero sin esta salida la pantalla es un callejón para el que llegó
 * por error — y desde `ref-3` el botón Atrás ya no saca de la app.
 */
export function VolverALaLiga({
  children = 'Ver resultados y rankings',
  className,
}: VolverALaLigaProps) {
  return (
    <a
      href={A_LA_LANDING}
      className={cn(
        'min-h-[44px] flex items-center justify-center',
        'text-[var(--ink-muted)] underline',
        className,
      )}
    >
      {children}
    </a>
  );
}
