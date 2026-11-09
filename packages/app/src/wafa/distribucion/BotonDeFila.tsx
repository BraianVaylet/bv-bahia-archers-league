import { clasesDeBotonIcono, type Icono } from '@bal/ui';

/**
 * Botón de sólo ícono de una fila de arquero.
 *
 * El ícono va `aria-hidden` y el nombre lo pone `aria-label`: un símbolo sin
 * nombre no dice nada en un lector de pantalla, y anunciarlo *además* del
 * `aria-label` diría dos cosas.
 */
export function BotonDeFila({
  icono: Icono,
  etiqueta,
  onClick,
  disabled,
}: {
  readonly icono: Icono;
  readonly etiqueta: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={etiqueta}
      className={clasesDeBotonIcono()}
    >
      <Icono />
    </button>
  );
}
