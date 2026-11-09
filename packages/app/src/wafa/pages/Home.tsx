/**
 * Home de WAFA.
 *
 * Los torneos van agrupados por estado, con **el que está en proceso arriba**:
 * si hay un torneo corriendo, es lo único que le importa al admin en ese momento.
 *
 * Ver `docs/FUNCTIONAL.md` §6.2.
 */

import { useCarga } from '@bal/cliente';
import { ESTADO_DE_TORNEO, type ParteDeModalidad, type TournamentStatus } from '@bal/shared';
import { TarjetaDeTorneo, useTituloDePagina } from '@bal/ui';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CerrarSesion } from '../../components/CerrarSesion.js';
import { botonClases, Encabezado, EnlaceInterno, Pantalla, Screen } from '../../components/ui.js';
import { conSenal, cuerpo, rpc } from '../../lib/rpc.js';

export interface TournamentRow {
  readonly id: string;
  readonly name: string;
  readonly date: string;
  readonly status: TournamentStatus;
  readonly targetCount: number;
  readonly patrolCount: number;
  readonly participantCount: number;
  readonly maxPossibleScore: number;
  /** Qué proporción del recorrido es de cada modalidad. La calcula el servidor. */
  readonly modalities?: readonly ParteDeModalidad[];
}

/**
 * Orden de los grupos: primero lo que está pasando ahora.
 *
 * El texto de cada uno sale de `ESTADO_DE_TORNEO`, no de una copia local: estos
 * títulos estaban escritos acá y otra vez en la ficha del torneo, con palabras
 * distintas para el mismo estado.
 */
const ORDEN: readonly TournamentStatus[] = ['en_proceso', 'sin_iniciar', 'completado', 'publicado'];

/** Qué hay que hacer con un torneo que todavía no arrancó. */
const ACCION_DEL_ADMIN: Partial<Record<TournamentStatus, string>> = {
  sin_iniciar: 'Armar patrullas',
};

function TarjetaTorneo({ torneo }: { readonly torneo: TournamentRow }) {
  return (
    <TarjetaDeTorneo
      torneo={torneo}
      href={`/wafa/torneos/${torneo.id}`}
      enlace={EnlaceInterno}
      accion={ACCION_DEL_ADMIN[torneo.status]}
    />
  );
}

export function HomePage({ onSalir }: { readonly onSalir: () => void }) {
  useTituloDePagina('Inicio');
  const [cerrando, setCerrando] = useState(false);
  const carga = useCarga(
    async (signal): Promise<TournamentRow[]> =>
      (await cuerpo(rpc.admin.tournaments.$get({ query: {} }, conSenal(signal)))).tournaments,
    [],
    { mensajeDeError: 'No se pudieron cargar los torneos. Revisá la conexión.' },
  );
  const torneos = carga.datos;
  const error = carga.error;

  return (
    <Pantalla>
      <Encabezado titulo="WAFA" onCerrarSesion={() => setCerrando(true)} />

      <Screen>
        <nav className="pt-4 flex flex-col gap-2">
          <Link to="/wafa/torneos/nuevo" className={botonClases({ ancho: true })}>
            Crear torneo
          </Link>
          <div className="flex gap-2">
            <Link
              to="/wafa/arqueros"
              className={botonClases({ variante: 'secundario', ancho: true, className: 'flex-1' })}
            >
              Arqueros
            </Link>
            <Link
              to="/wafa/temporadas"
              className={botonClases({ variante: 'secundario', ancho: true, className: 'flex-1' })}
            >
              Temporadas
            </Link>
          </div>

          <Link to="/wafa/ranking" className={botonClases({ variante: 'secundario', ancho: true })}>
            Ranking de la liga
          </Link>
        </nav>

        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        {torneos === undefined && !error && <p className="text-[var(--ink-muted)]">Cargando…</p>}

        {torneos?.length === 0 && (
          <p className="text-[var(--ink-muted)]">Todavía no hay torneos. Empezá creando uno.</p>
        )}

        {torneos !== undefined &&
          torneos.length > 0 &&
          ORDEN.map((status) => {
            const info = ESTADO_DE_TORNEO[status];
            const delGrupo = torneos.filter((t) => t.status === status);

            return (
              <section key={status} className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  {info.plural}
                </h2>

                {delGrupo.length === 0 ? (
                  <p className="text-sm text-[var(--ink-muted)]">{info.vacio}</p>
                ) : (
                  delGrupo.map((t) => <TarjetaTorneo key={t.id} torneo={t} />)
                )}
              </section>
            );
          })}

        {/*
          **La única salida de WAFA.**

          Estaba en el header, como un «Salir» de un toque. Desde que Atrás ya
          no saca de la app, ésta es la puerta — y una puerta que se toca sin
          querer al lado del título es peor que ninguna. Pide dos toques, igual
          que eliminar un torneo.
        */}
        <CerrarSesion onCerrar={onSalir} abierto={cerrando} onAbiertoChange={setCerrando} />
      </Screen>
    </Pantalla>
  );
}
