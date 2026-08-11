/**
 * Estado de sincronización para la UI.
 *
 * Es lo que le da confianza al líder para seguir usando la app sin señal:
 * nunca queda en la duda de si se guardó. Ver `docs/OFFLINE_SYNC.md` §9.
 */

import { useSyncExternalStore } from 'react';
import { getSyncState, type SyncState, subscribe } from './syncWorker.js';

export function useSyncStatus(): SyncState {
  return useSyncExternalStore(subscribe, getSyncState, getSyncState);
}

/** Texto que ve el líder. Nunca alarmante: sin conexión no es un error. */
export function syncLabel(estado: SyncState): string {
  switch (estado.status) {
    case 'synced':
      return 'Sincronizado';
    case 'pending':
      return `${estado.pending} ${estado.pending === 1 ? 'cambio' : 'cambios'} sin sincronizar`;
    case 'offline':
      return estado.pending > 0
        ? `Sin conexión · ${estado.pending} ${estado.pending === 1 ? 'cambio guardado' : 'cambios guardados'} en el celular`
        : 'Sin conexión';
    case 'error':
      return 'Hay un problema con la sincronización';
  }
}
