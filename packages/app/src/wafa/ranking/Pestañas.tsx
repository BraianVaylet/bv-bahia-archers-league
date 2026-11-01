import { cn } from '../../components/ui.js';
import { VISTAS, type Vista } from './tipos.js';

/**
 * Una sola tira de pestañas arriba de todas las categorías, no una por
 * tarjeta. Mismo componente que la landing, duplicado por la misma razón que
 * el resto del JSX de este archivo: no comparten bundle. Ver `docs/FUNCTIONAL.md` §5.2.
 */
export function Pestañas({
  vista,
  onElegir,
}: {
  readonly vista: Vista;
  readonly onElegir: (v: Vista) => void;
}) {
  return (
    <div role="tablist" aria-label="Ver ranking" className="flex gap-2">
      {VISTAS.map((v) => (
        <button
          key={v.key}
          type="button"
          role="tab"
          aria-selected={vista === v.key}
          onClick={() => onElegir(v.key)}
          className={cn(
            'flex-1 min-h-[52px] rounded-[var(--radius-md)] border',
            vista === v.key
              ? 'bg-[var(--nock)] text-[var(--nock-ink)] font-semibold'
              : 'bg-[var(--surface)]',
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
