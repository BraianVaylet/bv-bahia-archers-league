/**
 * Paso 1 del wizard de creación de torneo: datos generales.
 */

import { useCarga } from '@bal/cliente';
import { Field } from '../../components/ui.js';
import { conSenal, cuerpo, rpc } from '../../lib/rpc.js';
import type { SeasonRow } from '../pages/Seasons.js';
import { type BorradorTorneo, problemaDelLink } from '../wizard.js';
import { CampoDePago } from './CampoDePago.js';

export function PasoDatos({
  borrador,
  onCambio,
}: {
  readonly borrador: BorradorTorneo;
  readonly onCambio: (b: Partial<BorradorTorneo>) => void;
}) {
  const carga = useCarga(
    async (signal): Promise<SeasonRow[]> =>
      (await cuerpo(rpc.admin.seasons.$get(undefined, conSenal(signal)))).seasons,
    [],
  );
  // Si la carga falla, se ve como una lista vacía —«no hay temporadas»—, igual que antes de `useCarga`.
  const temporadas = carga.datos ?? (carga.error === undefined ? undefined : []);

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Nombre"
        value={borrador.name}
        onChange={(e) => onCambio({ name: e.target.value })}
        placeholder="3ª fecha"
        required
      />
      <Field
        label="Fecha"
        type="date"
        value={borrador.date}
        onChange={(e) => onCambio({ date: e.target.value })}
        required
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="temporada" className="text-sm font-medium">
          Temporada
        </label>
        <select
          id="temporada"
          value={borrador.seasonId}
          onChange={(e) => onCambio({ seasonId: e.target.value })}
          className="min-h-[52px] px-4 text-base rounded-[var(--radius-md)] bg-[var(--surface)] border"
          required
        >
          {/* Un `<select>` no puede llevar adentro el indicador: lo dice su primera opción. */}
          <option value="">
            {temporadas === undefined ? 'Cargando las temporadas…' : 'Elegí una temporada'}
          </option>
          {temporadas?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {temporadas?.length === 0 && (
          <p className="text-sm text-[var(--ink-muted)]">
            No hay temporadas cargadas. Creá una antes de armar el torneo.
          </p>
        )}
      </div>

      <Field
        label="Descripción"
        value={borrador.description}
        onChange={(e) => onCambio({ description: e.target.value })}
        placeholder="Opcional"
      />

      {/*
        `FE-36`: el formulario o la planilla donde los arqueros se pre-anotan. La landing lo
        muestra como botón. Se valida con el mismo esquema que el servidor (`problemaDelLink`).
      */}
      <Field
        label="Link de pre-inscripción"
        type="url"
        inputMode="url"
        autoComplete="off"
        value={borrador.registrationUrl}
        onChange={(e) => onCambio({ registrationUrl: e.target.value })}
        placeholder="Opcional · https://…"
        hint="Formulario o planilla donde se pre-anotan los arqueros. La landing muestra un botón."
        error={problemaDelLink(borrador.registrationUrl)}
      />

      <CampoDePago pago={borrador.payment} onCambio={(payment) => onCambio({ payment })} />
    </div>
  );
}
