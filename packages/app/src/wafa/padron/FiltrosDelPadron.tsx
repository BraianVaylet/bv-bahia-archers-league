/**
 * Búsqueda y filtros del padrón.
 */

import { BOW_CATEGORIES, type BowCategory, CATEGORY_INFO } from '@bal/shared';
import { Field } from '../../components/ui.js';

export function FiltrosDelPadron({
  busqueda,
  onBusqueda,
  categoria,
  onCategoria,
  verArchivados,
  onVerArchivados,
  verPendientes,
  onVerPendientes,
}: {
  readonly busqueda: string;
  readonly onBusqueda: (v: string) => void;
  readonly categoria: BowCategory | '';
  readonly onCategoria: (v: BowCategory | '') => void;
  readonly verArchivados: boolean;
  readonly onVerArchivados: (marcado: boolean) => void;
  readonly verPendientes: boolean;
  readonly onVerPendientes: (marcado: boolean) => void;
}) {
  return (
    <>
      <Field
        label="Buscar"
        type="search"
        value={busqueda}
        onChange={(e) => onBusqueda(e.target.value)}
        placeholder="Apellido, nombre o DNI"
      />

      {/* El filtro es del cliente y no del servidor: el padrón entero son cientos de arqueros, ya
          está en memoria, y así responde sin viaje. */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="filtro-categoria" className="text-sm font-medium">
          Filtrar por categoría
        </label>
        <select
          id="filtro-categoria"
          value={categoria}
          onChange={(e) => onCategoria(e.target.value as BowCategory | '')}
          className="min-h-[52px] px-4 text-base rounded-[var(--radius-md)] bg-[var(--surface)] border"
        >
          <option value="">Todas</option>
          {BOW_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_INFO[c].label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 min-h-[44px]">
        <input
          type="checkbox"
          checked={verArchivados}
          onChange={(e) => onVerArchivados(e.target.checked)}
          className="w-5 h-5"
        />
        <span>Ver archivados</span>
      </label>

      {/* FE-30: la cola de BE-22. Pendientes y archivados no se combinan: marcar uno destilda el
          otro. */}
      <label className="flex items-center gap-2 min-h-[44px]">
        <input
          type="checkbox"
          checked={verPendientes}
          onChange={(e) => onVerPendientes(e.target.checked)}
          className="w-5 h-5"
        />
        <span>Ver pendientes de aprobar</span>
      </label>
    </>
  );
}
