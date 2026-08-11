/**
 * Indicador de sincronización.
 *
 * Siempre visible en el encabezado. Es lo que le da confianza al líder para
 * seguir usando la app sin señal: nunca queda en la duda de si se guardó.
 *
 * **Nunca bloquea.** Sincronizar es de fondo, por definición.
 * Ver `docs/OFFLINE_SYNC.md` §9.
 */

import { cn } from '../components/ui.js';
import { syncLabel, useSyncStatus } from '../offline/useSyncStatus.js';

const COLORES: Record<string, string> = {
  synced: 'text-[var(--ok)]',
  pending: 'text-[var(--warn)]',
  offline: 'text-[var(--ink-muted)]',
  error: 'text-[var(--danger)]',
};

export function SyncBadge() {
  const estado = useSyncStatus();

  return (
    <p
      // El total de pendientes cambia solo: se anuncia sin robar el foco.
      aria-live="polite"
      className={cn('flex items-center gap-1.5 text-sm', COLORES[estado.status])}
      data-testid="sync-badge"
      data-status={estado.status}
    >
      <span aria-hidden="true" className="w-2 h-2 rounded-full bg-current shrink-0" />
      {syncLabel(estado)}
    </p>
  );
}
