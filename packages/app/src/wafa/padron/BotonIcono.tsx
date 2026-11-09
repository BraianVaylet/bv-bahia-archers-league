import { clasesDeBotonIcono, type Icono } from '@bal/ui';

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
      className={clasesDeBotonIcono(peligro ? 'text-[var(--danger)]' : undefined)}
    >
      <Icono />
    </button>
  );
}
