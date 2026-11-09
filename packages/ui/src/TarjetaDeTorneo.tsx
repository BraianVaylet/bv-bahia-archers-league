/**
 * La tarjeta de un torneo en un listado (`REF7-4`). Es el `TournamentCard` de
 * `docs/post/ref-7/DISENO.md` §4.8.
 *
 * **Estaba escrita dos veces**, en el listado de la landing y en el inicio de WAFA, con dos
 * jerarquías distintas: en una el nombre y la fecha competían por el mismo renglón, en la otra la
 * fecha iba sola abajo. Y en las dos el estado era una píldora rellena que pesaba más que el nombre.
 *
 * Arriba el estado y la fecha; después el nombre y qué tan grande es; la barra de modalidades; y
 * un pie que dice qué vas a encontrar al entrar. Toda la tarjeta es un enlace.
 */

import { formatearFechaCorta, type TournamentStatus } from '@bal/shared';
import type { ReactNode } from 'react';
import { BarraDeModalidades, type ParteDeLaBarra } from './BarraDeModalidades.js';
import { BadgeEstado } from './Chips.js';
import { cn } from './cn.js';
import { type ComponenteDeEnlace, EnlaceNativo } from './enlace.js';
import { IconoFlecha } from './iconos/navegacion.js';
import { clasesDeTarjeta } from './Tarjeta.js';

export interface ResumenDeTorneo {
  readonly id: string;
  readonly name: string;
  readonly date: string;
  readonly status: TournamentStatus;
  readonly targetCount: number;
  readonly participantCount: number;
  /** El listado público no lo trae: sin el dato, no se escribe. */
  readonly patrolCount?: number;
  /** Una respuesta vieja en caché no lo trae: la tarjeta sigue en pie sin la barra. */
  readonly modalities?: readonly ParteDeLaBarra[];
}

export interface TarjetaDeTorneoProps {
  readonly torneo: ResumenDeTorneo;
  readonly href: string;
  /** El texto del estado para el visitante («En curso», «Resultados oficiales»). */
  readonly publico?: boolean | undefined;
  /** Qué vas a encontrar al entrar. Si no se pasa, sale del estado. */
  readonly accion?: string | undefined;
  /** Reemplaza al pie entero: en WAFA, un torneo en proceso muestra un anillo por patrulla. */
  readonly pie?: ReactNode;
  readonly enlace?: ComponenteDeEnlace;
  readonly className?: string;
}

const ACCION_POR_ESTADO: Readonly<Partial<Record<TournamentStatus, string>>> = {
  en_proceso: 'Ver en vivo',
  publicado: 'Podios y estadísticas',
};

export function TarjetaDeTorneo({
  torneo,
  href,
  publico,
  accion,
  pie,
  enlace: Enlace = EnlaceNativo,
  className,
}: TarjetaDeTorneoProps) {
  const tamaño = [
    `${torneo.targetCount} blancos`,
    `${torneo.participantCount} arqueros`,
    torneo.patrolCount === undefined ? null : `${torneo.patrolCount} patrullas`,
  ]
    .filter(Boolean)
    .join(' · ');
  const textoDelPie = accion ?? ACCION_POR_ESTADO[torneo.status];

  return (
    <Enlace
      href={href}
      data-testid={`torneo-${torneo.id}`}
      className={cn(
        clasesDeTarjeta({ densidad: 'ninguna', enlace: true }),
        'p-5 flex flex-col gap-3 text-[var(--ink)]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <BadgeEstado status={torneo.status} publico={publico} />
        <span className="font-mono text-mono text-[var(--ink-muted)]">
          {formatearFechaCorta(torneo.date)}
        </span>
      </div>

      <div>
        <h3 className="text-h3">{torneo.name}</h3>
        <p className="mt-0.5 text-sm text-[var(--ink-muted)]">{tamaño}</p>
      </div>

      <BarraDeModalidades modalidades={torneo.modalities ?? []} />

      {pie ??
        (textoDelPie ? (
          <div className="flex items-center justify-between pt-3 border-t text-sm text-[var(--ink-muted)]">
            {textoDelPie}
            <IconoFlecha size={18} className="text-[var(--nock-text)]" />
          </div>
        ) : null)}
    </Enlace>
  );
}
