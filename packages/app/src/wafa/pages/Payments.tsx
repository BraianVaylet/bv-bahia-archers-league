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

import { useCarga } from '@bal/cliente';
import { type BowCategory, formatearMonto } from '@bal/shared';
import { ChipCategoria, useTituloDePagina } from '@bal/ui';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, clasesDeTarjeta, cn, Encabezado, Pantalla, Screen } from '../../components/ui.js';
import { ApiError, conSenal, cuerpo, rpc } from '../../lib/rpc.js';

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
  const carga = useCarga(
    (signal): Promise<ResumenDePagos> =>
      cuerpo(
        rpc.admin.tournaments[':id'].payments.$get(
          { param: { id: tournamentId } },
          conSenal(signal),
        ),
      ),
    [tournamentId],
    { mensajeDeError: 'No se pudieron cargar los pagos. Revisá la conexión.' },
  );
  const resumen = carga.datos;

  // El error de la última acción, aparte del de la carga: marcar un pago que el servidor rechaza no
  // lo borra una recarga que sale bien por otro lado.
  const [errorDeAccion, setErrorDeAccion] = useState<string>();
  const error = errorDeAccion ?? carga.error;

  const marcar = async (participantId: string, paid: boolean) => {
    try {
      // Sólo el booleano: el monto lo pone el servidor leyendo el torneo.
      await rpc.admin.participants[':id'].payment.$post({
        param: { id: participantId },
        json: { paid },
      });
      setErrorDeAccion(undefined);
      await carga.recargar();
    } catch (err) {
      setErrorDeAccion(err instanceof ApiError ? err.message : 'No se pudo marcar el pago.');
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
          className={cn(clasesDeTarjeta({ nivel: 'anidada' }), 'flex flex-col gap-1')}
          data-testid="recaudacion"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-[var(--ink-muted)]">Recaudado</span>
            <span className="font-display text-2xl font-bold tabular-nums">
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
            /*
              **Dos filas, no una.**

              Estaba todo en línea —nombre, categoría, patrulla, estado y
              botón— y en un celular el nombre se truncaba a tres letras para
              hacerle lugar al botón. El admin no puede identificar a quién le
              está cobrando.

              Arriba lo que identifica y el estado; abajo la acción, con el
              ancho completo.
            */
            className={cn(clasesDeTarjeta(), 'flex flex-col gap-2')}
            data-testid={`pago-${p.lastName}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {p.lastName}, {p.firstName}
                </p>
                <p className="text-sm text-[var(--ink-muted)] flex items-center gap-1.5">
                  <ChipCategoria category={p.category} compacto /> · patrulla {p.patrolNumber}
                </p>
              </div>

              {/*
                El estado va acá arriba, con el nombre: es información sobre el
                arquero, no una acción. Y sigue **escrito** además de coloreado
                — «Pagó» en gris y «Pagó» en verde serían lo mismo para quien no
                distingue el color.
              */}
              <span
                data-testid={`estado-pago-${p.lastName}`}
                className={cn(
                  'text-sm font-semibold shrink-0',
                  p.paid ? 'text-[var(--ok)]' : 'text-[var(--danger)]',
                )}
              >
                {p.paid ? 'Pagó' : 'Debe'}
              </span>
            </div>

            {/*
              La acción, sola en su fila y a lo ancho.

              Separarla del estado también resuelve lo que el brief pedía con
              `gap-4`: pegados, el pulgar que va a leer el estado terminaba
              tocando el botón. Ahora ni siquiera están en la misma línea.

              El color usa `--ok` y `--danger`, que ya existen y significan
              «bien» y «mal». No son colores de estaca: la regla 8 reserva los
              TONOS de estaca, y estos dos ya se usaban para lo mismo en toda
              la app.
            */}
            <Button
              ancho
              variante={p.paid ? 'secundario' : 'primario'}
              onClick={() => void marcar(p.id, !p.paid)}
            >
              {p.paid ? 'Desmarcar' : 'Marcar pagado'}
            </Button>
          </li>
        ))}
      </ul>
    </Screen>
  );
}

/** Pantalla completa: el panel con su header y su vuelta atrás. */
export function PaymentsPage({ onVolver }: { readonly onVolver: () => void }) {
  useTituloDePagina('Arqueros y pagos');
  const { id = '' } = useParams();

  return (
    <Pantalla>
      <Encabezado contexto="Administración" titulo="Arqueros y pagos" onVolver={onVolver} />
      <PaymentsPanel tournamentId={id} />
    </Pantalla>
  );
}
