/**
 * Lo recaudado en una temporada, torneo por torneo y el total.
 */

import { formatearMonto } from '@bal/shared';
import { useState } from 'react';
import { api } from '../../lib/apiClient.js';

interface RecaudacionTemporada {
  readonly collected: number;
  readonly tournaments: readonly {
    readonly id: string;
    readonly name: string;
    readonly paidCount: number;
    readonly participantCount: number;
    readonly collected: number;
  }[];
}

/**
 * Lo recaudado en la temporada.
 *
 * **Se pide al abrirlo, no al cargar la lista.** Con cinco temporadas serían
 * cinco consultas para mostrar un número que casi nunca se mira: se entra a
 * esta pantalla para cerrar una temporada, no para revisar la caja.
 *
 * El total lo calcula el servidor a partir de los pagos y el monto de cada
 * torneo. Ver `SECURITY.md` §2: el monto nunca viaja desde el cliente.
 */
export function Recaudacion({ seasonId }: { readonly seasonId: string }) {
  const [datos, setDatos] = useState<RecaudacionTemporada>();
  const [error, setError] = useState<string>();

  const cargar = async () => {
    if (datos) return;
    try {
      setDatos(await api.get<RecaudacionTemporada>(`/admin/seasons/${seasonId}/collection`));
    } catch {
      setError('No se pudo cargar la recaudación.');
    }
  };

  return (
    <details className="pt-2 text-sm" onToggle={() => void cargar()}>
      <summary className="min-h-[44px] flex items-center cursor-pointer text-[var(--ink-muted)]">
        Recaudación
      </summary>

      {error && (
        <p role="alert" className="text-[var(--danger)]">
          {error}
        </p>
      )}

      {datos && (
        <div className="flex flex-col gap-1.5 pb-2" data-testid={`recaudacion-${seasonId}`}>
          {datos.tournaments.length === 0 ? (
            <p className="text-[var(--ink-muted)]">Esta temporada todavía no tiene torneos.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-1">
                {datos.tournaments.map((t) => (
                  <li key={t.id} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">{t.name}</span>
                    <span className="text-[var(--ink-muted)] shrink-0 tabular-nums">
                      {t.paidCount}/{t.participantCount} · {formatearMonto(t.collected)}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="flex items-baseline justify-between gap-3 border-t pt-1.5 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatearMonto(datos.collected)}</span>
              </p>
            </>
          )}
        </div>
      )}
    </details>
  );
}
