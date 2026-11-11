/**
 * Home de WAFA.
 *
 * Los torneos van agrupados por estado, con **el que está en proceso arriba**:
 * si hay un torneo corriendo, es lo único que le importa al admin en ese momento.
 *
 * Ver `docs/FUNCTIONAL.md` §6.2.
 */

import { useCarga } from '@bal/cliente';
import {
  BOW_CATEGORIES,
  ESTADO_DE_TORNEO,
  type ParteDeModalidad,
  type TournamentStatus,
} from '@bal/shared';
import {
  type Icono,
  IconoAgregar,
  IconoArqueros,
  IconoCalendario,
  IconoPodio,
  RotuloDeSeccion,
  TarjetaDeTorneo,
  useTituloDePagina,
} from '@bal/ui';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CerrarSesion } from '../../components/CerrarSesion.js';
import {
  botonClases,
  clasesDeTarjeta,
  cn,
  Encabezado,
  EnlaceInterno,
  Pantalla,
  Screen,
} from '../../components/ui.js';
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
  /** Archivado (`BE-26`): sigue publicado, pero no suma al ranking ni se ve en la landing. */
  readonly archived?: boolean;
}

/**
 * Orden de los grupos: primero lo que está pasando ahora.
 *
 * El texto de cada uno sale de `ESTADO_DE_TORNEO`, no de una copia local: estos
 * títulos estaban escritos acá y otra vez en la ficha del torneo, con palabras
 * distintas para el mismo estado.
 */
const ORDEN: readonly TournamentStatus[] = ['en_proceso', 'sin_iniciar', 'completado', 'publicado'];

/**
 * Los tres accesos del inicio, con su dato **si no hace falta pedir nada para tenerlo**
 * (`DISENO.md` §5.4): no se agrega ningún endpoint para esto. Las categorías son del dominio; la
 * cantidad de arqueros y la temporada activa piden una consulta, así que van sólo con el nombre.
 */
const ACCESOS: readonly { a: string; nombre: string; icono: Icono; dato?: string }[] = [
  { a: '/wafa/arqueros', nombre: 'Arqueros', icono: IconoArqueros },
  { a: '/wafa/temporadas', nombre: 'Temporadas', icono: IconoCalendario },
  {
    a: '/wafa/ranking',
    nombre: 'Ranking',
    icono: IconoPodio,
    dato: `${BOW_CATEGORIES.length} categorías`,
  },
];

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
      // `FE-35`: un archivado lo dice con texto y un tono neutro; nada de colores de estaca (regla 8).
      {...(torneo.archived
        ? {
            pie: (
              <span className="inline-flex items-center rounded-full border px-2.5 h-7 text-sm text-[var(--ink-muted)]">
                Archivado · no suma ni se ve en la landing
              </span>
            ),
          }
        : {})}
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
  const [verArchivados, setVerArchivados] = useState(false);
  const archivados = torneos?.filter((t) => t.archived).length ?? 0;
  const hayArchivados = archivados > 0;

  return (
    <Pantalla>
      <Encabezado
        contexto="Administración"
        titulo="Inicio"
        onCerrarSesion={() => setCerrando(true)}
      />

      <Screen>
        {/*
          Un solo primario y tres accesos compactos (`REF7-9` / `W-1`). Antes eran cuatro botones de
          52px —tres del mismo gris— que ocupaban media pantalla antes del primer torneo.
        */}
        <nav aria-label="Administración" className="pt-4 flex flex-col gap-2">
          <Link to="/wafa/torneos/nuevo" className={botonClases({ ancho: true })}>
            <IconoAgregar />
            Crear torneo
          </Link>
          <div className="grid grid-cols-3 gap-2">
            {ACCESOS.map(({ a, nombre, icono: Icono, dato }) => (
              <Link
                key={a}
                to={a}
                className={cn(
                  clasesDeTarjeta({ densidad: 'ninguna', enlace: true }),
                  'min-h-[88px] p-3 flex flex-col justify-between gap-2',
                )}
              >
                <Icono className="text-[var(--nock-text)]" />
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold leading-tight">{nombre}</span>
                  {dato ? (
                    <span className="font-mono text-[11px] text-[var(--ink-muted)]">{dato}</span>
                  ) : null}
                </span>
              </Link>
            ))}
          </div>
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
            // `FE-35`: los archivados quedan fuera salvo que se pida verlos.
            const delGrupo = torneos.filter(
              (t) => t.status === status && (verArchivados || !t.archived),
            );
            const conFiltro = status === 'publicado' && hayArchivados;

            return (
              <section key={status} className="flex flex-col gap-3">
                <RotuloDeSeccion titulo={info.plural} cantidad={delGrupo.length} />

                {conFiltro && (
                  <label className="flex items-center gap-2 min-h-[44px] text-sm">
                    <input
                      type="checkbox"
                      checked={verArchivados}
                      onChange={(e) => setVerArchivados(e.target.checked)}
                      className="w-5 h-5"
                    />
                    Ver archivados ({archivados})
                  </label>
                )}

                {delGrupo.length === 0 ? (
                  // Un grupo vacío dice qué va a aparecer, no sólo que no hay nada (§5.4).
                  <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)] px-4 py-3 text-sm text-[var(--ink-muted)]">
                    {info.vacio}
                  </p>
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
