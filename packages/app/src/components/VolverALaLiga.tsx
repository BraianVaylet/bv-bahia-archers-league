/**
 * La salida de la PWA al sitio público: «Ver resultados y rankings».
 *
 * La usan la puerta `/app` y los dos logins. Sin esto la puerta es un callejón para el que llegó
 * por error — y desde `ref-3` el botón Atrás ya no saca de la app.
 *
 * `enlaceEntreApps` porque en producción la landing es `/` y con `pnpm dev` es otro puerto.
 *
 * `REF7-7` le cambió la piel (`DISENO.md` §5.3): un enlace en el verde que se lee, con la flecha de
 * volver, en lugar de un subrayado gris.
 */

import { enlaceEntreApps, IconoVolver } from '@bal/ui';
import { cn } from './ui.js';

export const A_LA_LANDING = enlaceEntreApps('landing', import.meta.env.DEV, window.location.href);

export interface VolverALaLigaProps {
  readonly children?: string;
  readonly className?: string;
  /** Centrado en los logins; al principio de la línea en la puerta. */
  readonly alinear?: 'centro' | 'inicio';
}

export function VolverALaLiga({
  children = 'Ver resultados y rankings',
  className,
  alinear = 'centro',
}: VolverALaLigaProps) {
  return (
    <a
      href={A_LA_LANDING}
      className={cn(
        'min-h-[44px] flex items-center gap-1 font-semibold text-[var(--nock-text)]',
        'hover:underline underline-offset-[3px]',
        alinear === 'centro' ? 'justify-center' : 'justify-start self-start',
        className,
      )}
    >
      <IconoVolver size={18} />
      {children}
    </a>
  );
}
