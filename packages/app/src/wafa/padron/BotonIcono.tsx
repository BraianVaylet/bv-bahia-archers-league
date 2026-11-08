import type { Icono } from '@bal/ui';
import { cn } from '../../components/ui.js';

/**
 * Botón de sólo ícono.
 *
 * El glifo va `aria-hidden` y el nombre lo pone `aria-label`: un símbolo sin
 * nombre no dice nada en un lector de pantalla, y anunciarlo *además* del
 * `aria-label` diría dos cosas. Ver `docs/DESIGN_SYSTEM.md` §10.
 */
export function BotonIcono({
  icono: Icono,
  etiqueta,
  onClick,
  disabled,
  peligro,
}: {
  readonly icono: Icono;
  readonly etiqueta: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly peligro?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'min-h-[44px] min-w-[44px] rounded-[var(--radius-md)] border',
        'flex items-center justify-center',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        peligro ? 'text-[var(--danger)]' : 'bg-[var(--surface-2)]',
      )}
    >
      <Icono />
    </button>
  );
}
