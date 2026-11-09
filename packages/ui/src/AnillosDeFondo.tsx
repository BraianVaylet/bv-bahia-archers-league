/**
 * Los anillos concéntricos de fondo de la banda `monte` (`REF7-6`, `DISENO.md` §1 y §5.1).
 *
 * **Son decoración y no portan información**: van `aria-hidden` y no tienen datos. Así no se rompe
 * la regla de `DESIGN_SYSTEM.md` §6.5, que reserva el `AnilloDeRecorrido` —el anillo **con
 * datos**— a sus tres lugares. Los usan el hero de la landing y el panel de la puerta `/app`.
 *
 * Cinco círculos en `--monte-line`, y el interior en `--monte-accent` al 50%: la cara del blanco de
 * campo, vista de lejos. El tamaño y la posición los pone quien los usa (`className`): en el hero
 * se salen por arriba a la derecha.
 */

import { cn } from './cn.js';

/** Estáticos: se arman una vez y no en cada render. */
const CIRCULOS = (
  <>
    <circle cx="400" cy="400" r="390" />
    <circle cx="400" cy="400" r="310" />
    <circle cx="400" cy="400" r="230" />
    <circle cx="400" cy="400" r="150" />
    <circle
      cx="400"
      cy="400"
      r="70"
      className="stroke-[var(--monte-accent)] [stroke-width:3] opacity-50"
    />
  </>
);

export function AnillosDeFondo({ className }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 800 800"
      aria-hidden="true"
      focusable="false"
      className={cn(
        'pointer-events-none absolute fill-none stroke-[var(--monte-line)] [stroke-width:2]',
        className,
      )}
    >
      {CIRCULOS}
    </svg>
  );
}
