/**
 * Pagos de inscripción de un torneo.
 *
 * **La recaudación se deriva** —pagos × monto— y la calcula el servidor. Acá
 * sólo se muestra: un total sumado en el cliente puede diferir del que ve el
 * tesorero, y son el mismo número.
 *
 * El monto nunca viaja al marcar un pago: se manda `{ paid }` y nada más.
 * Ver `docs/SECURITY.md` §2.
 */

import { type BowCategory, formatearMonto } from '@bal/shared';
import { ChipCategoria } from '@bal/ui';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, cn, Encabezado, Pantalla, Screen } from '../../components/ui.js';
import { ApiError, api } from '../../lib/apiClient.js';

export interface ResumenDePagos {
  readonly payment: { readonly required: boolean; readonly amount: number };
  readonly paidCount: number;
  readonly collected: number;
  readonly participants: readonly {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly category: BowCategory;
    readonly patrolNumber: number;
    readonly paid: boolean;
  }[];
}

export function PaymentsPanel({ tournamentId }: { readonly tournamentId: string }) {
  const [resumen, setResumen] = useState<ResumenDePagos>();
  const [error, setError] = useState<string>();

  const cargar = useCallback(async () => {
    try {
      setResumen(await api.get<ResumenDePagos>(`/admin/tournaments/${tournamentId}/payments`));
      setError(undefined);
    } catch {
      setError('No se pudieron cargar los pagos. Revisá la conexión.');
    }
  }, [tournamentId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const marcar = async (participantId: string, paid: boolean) => {
    try {
      // Sólo el booleano: el monto lo pone el servidor leyendo el torneo.
      await api.post(`/admin/participants/${participantId}/payment`, { paid });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo marcar el pago.');
    }
  };

  return (
    <Screen>
      {error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {resumen === undefined && !error && <p className="text-[var(--ink-muted)]">Cargando…</p>}

      {resumen && !resumen.payment.required && (
        <p className="text-[var(--ink-muted)]" data-testid="sin-inscripcion">
          Este torneo no cobra inscripción.
        </p>
      )}

      {resumen?.payment.required && (
        <div
          className="rounded-[var(--radius-lg)] border p-3 bg-[var(--surface-2)] flex flex-col gap-1"
          data-testid="recaudacion"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-[var(--ink-muted)]">Recaudado</span>
            <span className="font-[var(--font-display)] text-2xl font-bold tabular-nums">
              {formatearMonto(resumen.collected)}
            </span>
          </div>
          <p className="text-sm text-[var(--ink-muted)]">
            {resumen.paidCount} de {resumen.participants.length} pagaron ·{' '}
            {formatearMonto(resumen.payment.amount)} por arquero
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {resumen?.participants.map((p) => (
          <li
            key={p.id}
            className="rounded-[var(--radius-lg)] border p-3 flex items-center justify-between gap-3 bg-[var(--surface)]"
            data-testid={`pago-${p.lastName}`}
          >
            <div className="min-w-0">
              <p className="truncate font-medium">
                {p.lastName}, {p.firstName}
              </p>
              <p className="text-sm text-[var(--ink-muted)] flex items-center gap-1.5">
                <ChipCategoria category={p.category} compacto /> · patrulla {p.patrolNumber}
              </p>
            </div>

            {/*
              El estado va **escrito** además de coloreado: «Pagó» en gris y
              «Pagó» en verde serían lo mismo para quien no ve el color.

              Y separado del botón con aire de sobra: pegados, el pulgar que va
              a leer el estado termina tocando el botón. `gap-4` en vez de
              `gap-2`, que es lo que pide el brief.

              Usa `--ok` y `--danger`, que ya existen y significan «bien» y
              «mal». No son colores de estaca: la regla 8 reserva los TONOS de
              estaca, y estos dos ya se usaban para lo mismo en toda la app.
            */}
            <div className="flex items-center gap-4 shrink-0">
              <span
                data-testid={`estado-pago-${p.lastName}`}
                className={cn(
                  'text-sm font-semibold',
                  p.paid ? 'text-[var(--ok)]' : 'text-[var(--danger)]',
                )}
              >
                {p.paid ? 'Pagó' : 'Debe'}
              </span>
              <Button
                variante={p.paid ? 'secundario' : 'primario'}
                onClick={() => void marcar(p.id, !p.paid)}
              >
                {p.paid ? 'Desmarcar' : 'Marcar pagado'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Screen>
  );
}

/** Pantalla completa: el panel con su header y su vuelta atrás. */
export function PaymentsPage({ onVolver }: { readonly onVolver: () => void }) {
  const { id = '' } = useParams();

  return (
    <Pantalla>
      <Encabezado titulo="Arqueros y pagos" onVolver={onVolver} />
      <PaymentsPanel tournamentId={id} />
    </Pantalla>
  );
}
