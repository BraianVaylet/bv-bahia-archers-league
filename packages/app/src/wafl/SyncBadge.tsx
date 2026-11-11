/**
 * Indicador de sincronización.
 *
 * Siempre visible en el encabezado. Es lo que le da confianza al líder para
 * seguir usando la app sin señal: nunca queda en la duda de si se guardó.
 *
 * **Nunca bloquea.** Sincronizar es de fondo, por definición.
 * Ver `docs/OFFLINE_SYNC.md` §9.
 *
 * `REF7-4` sólo le cambió la piel (`DISENO.md` §4.11): una píldora con borde y
 * un ícono por estado, en lugar del punto de color. El ícono hace que el estado
 * no dependa sólo del color. Los textos y la lógica siguen siendo los de
 * `syncLabel`.
 */

import { type Icono, IconoAviso, IconoSincronizar, IconoSinSenal, IconoTilde } from '@bal/ui';
import { cn } from '../components/ui.js';
import type { SyncStatus } from '../offline/syncWorker.js';
import { syncLabel, useSyncStatus } from '../offline/useSyncStatus.js';

const ESTILO: Readonly<Record<SyncStatus, { readonly color: string; readonly icono: Icono }>> = {
  synced: { color: 'text-[var(--ok)]', icono: IconoTilde },
  pending: { color: 'text-[var(--warn)]', icono: IconoSincronizar },
  offline: { color: 'text-[var(--ink-muted)]', icono: IconoSinSenal },
  error: { color: 'text-[var(--danger)]', icono: IconoAviso },
};

export function SyncBadge() {
  const estado = useSyncStatus();
  const { color, icono: IconoDelEstado } = ESTILO[estado.status];
  const texto = syncLabel(estado);

  return (
    <p
      // El total de pendientes cambia solo: se anuncia sin robar el foco.
      aria-live="polite"
      // Con un motivo de error largo, el texto se trunca a la vista: completo queda en el DOM (lo lee
      // el lector de pantalla) y en el `title`. Sin tope, desbordaba el encabezado a 360px.
      title={texto}
      className={cn(
        'inline-flex items-center gap-1.5 min-h-[44px] max-w-[min(14rem,45vw)] px-3 rounded-[var(--radius-full)] border',
        'text-[13px] font-semibold leading-tight',
        color,
      )}
      data-testid="sync-badge"
      data-status={estado.status}
    >
      <IconoDelEstado size={16} className="shrink-0" />
      <span className="min-w-0 truncate">{texto}</span>
    </p>
  );
}
