/**
 * La inscripción de un torneo: si se cobra y cuánto (`FE-32`).
 *
 * Lo usan el paso 1 del wizard y el formulario de edición de la ficha: era el mismo bloque escrito
 * en un solo lugar, y la ficha lo necesitaba igual. El monto es del torneo, uno solo para todos;
 * quién pagó se marca después, desde el detalle. Ver `docs/SECURITY.md` §2.
 */

import { formatearMonto } from '@bal/shared';
import { Field } from '../../components/ui.js';

export interface Pago {
  readonly required: boolean;
  readonly amount: number;
}

export function CampoDePago({
  pago,
  onCambio,
}: {
  readonly pago: Pago;
  readonly onCambio: (pago: Pago) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">Inscripción</legend>

      <label className="flex items-center gap-2 min-h-[44px]">
        <input
          type="checkbox"
          checked={pago.required}
          onChange={(e) =>
            // Al desmarcar, el monto se va con la casilla: uno que sobrevive apagado reaparece al
            // volver a marcarla, y el torneo termina cobrando sin que nadie lo haya decidido.
            onCambio(
              e.target.checked ? { ...pago, required: true } : { required: false, amount: 0 },
            )
          }
          className="w-5 h-5"
        />
        Este torneo cobra inscripción
      </label>

      {pago.required && (
        <Field
          label="Monto por arquero"
          type="number"
          min={1}
          step={1}
          value={pago.amount === 0 ? '' : String(pago.amount)}
          onChange={(e) => onCambio({ required: true, amount: Number(e.target.value) || 0 })}
          hint={
            pago.amount > 0
              ? `${formatearMonto(pago.amount)} por arquero`
              : 'En pesos, sin centavos.'
          }
        />
      )}
    </fieldset>
  );
}
