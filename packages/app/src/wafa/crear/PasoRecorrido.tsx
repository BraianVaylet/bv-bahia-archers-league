/**
 * Paso 2 del wizard de creación de torneo: el recorrido, blanco por blanco.
 */

import {
  MAX_ARROWS_PER_TARGET,
  MIN_ARROWS_PER_TARGET,
  MODALITIES,
  type Modality,
  SCORING,
} from '@bal/shared';
import { IconoBajar, IconoQuitar, IconoSubir } from '@bal/ui';
import { Button, clasesDeTarjeta, cn, Field } from '../../components/ui.js';
import {
  agregarBlanco,
  type BorradorTorneo,
  conModalidad,
  eliminarBlanco,
  maximoDelRecorrido,
  moverBlanco,
} from '../wizard.js';

export function PasoRecorrido({
  borrador,
  onCambio,
}: {
  readonly borrador: BorradorTorneo;
  readonly onCambio: (b: Partial<BorradorTorneo>) => void;
}) {
  const set = (blancos: BorradorTorneo['blancos']) => onCambio({ blancos });

  return (
    <div className="flex flex-col gap-3">
      {/* El máximo posible se recalcula con cada cambio: es el número que hace
          comparable este torneo con los demás, y conviene verlo mientras se arma. */}
      <div
        className={cn(clasesDeTarjeta({ nivel: 'anidada' }), 'flex items-baseline justify-between')}
        data-testid="maximo-posible"
      >
        <span className="text-sm text-[var(--ink-muted)]">Máximo posible</span>
        <span className="font-[var(--font-display)] text-2xl font-bold tabular-nums">
          {maximoDelRecorrido(borrador.blancos)}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {borrador.blancos.map((b, i) => (
          <li
            key={b.index}
            className={cn(clasesDeTarjeta(), 'flex flex-col gap-2')}
            data-testid={`blanco-${b.index}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">Blanco {b.index}</span>

              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label={`Subir el blanco ${b.index}`}
                  disabled={i === 0}
                  onClick={() => set(moverBlanco(borrador.blancos, b.index, -1))}
                  className="min-h-[44px] min-w-[44px] rounded-[var(--radius-sm)] border disabled:opacity-40"
                >
                  <IconoSubir />
                </button>
                <button
                  type="button"
                  aria-label={`Bajar el blanco ${b.index}`}
                  disabled={i === borrador.blancos.length - 1}
                  onClick={() => set(moverBlanco(borrador.blancos, b.index, 1))}
                  className="min-h-[44px] min-w-[44px] rounded-[var(--radius-sm)] border disabled:opacity-40"
                >
                  <IconoBajar />
                </button>
                <button
                  type="button"
                  aria-label={`Eliminar el blanco ${b.index}`}
                  disabled={borrador.blancos.length === 1}
                  onClick={() => set(eliminarBlanco(borrador.blancos, b.index))}
                  className="min-h-[44px] min-w-[44px] rounded-[var(--radius-sm)] border disabled:opacity-40"
                >
                  <IconoQuitar />
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 flex flex-col gap-1.5">
                <label htmlFor={`modalidad-${b.index}`} className="text-sm font-medium">
                  Modalidad
                </label>
                <select
                  id={`modalidad-${b.index}`}
                  value={b.modality}
                  onChange={(e) =>
                    set(
                      borrador.blancos.map((x) =>
                        x.index === b.index ? conModalidad(x, e.target.value as Modality) : x,
                      ),
                    )
                  }
                  className="min-h-[52px] px-3 text-base rounded-[var(--radius-md)] bg-[var(--surface)] border"
                >
                  {MODALITIES.map((m) => (
                    <option key={m} value={m}>
                      {SCORING[m].label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-28">
                <Field
                  label="Flechas"
                  id={`flechas-${b.index}`}
                  type="number"
                  min={MIN_ARROWS_PER_TARGET}
                  max={MAX_ARROWS_PER_TARGET}
                  value={b.arrows}
                  onChange={(e) =>
                    set(
                      borrador.blancos.map((x) =>
                        x.index === b.index ? { ...x, arrows: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
              </div>
            </div>

            <Field
              label="Descripción"
              id={`descripcion-${b.index}`}
              value={b.description ?? ''}
              onChange={(e) =>
                set(
                  borrador.blancos.map((x) =>
                    x.index === b.index ? { ...x, description: e.target.value || null } : x,
                  ),
                )
              }
              placeholder="Opcional — «Jabalí», «bajada larga»…"
            />
          </li>
        ))}
      </ul>

      <Button variante="secundario" ancho onClick={() => set(agregarBlanco(borrador.blancos))}>
        Agregar blanco
      </Button>
    </div>
  );
}
