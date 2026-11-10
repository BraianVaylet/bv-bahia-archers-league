/**
 * Detalle y seguimiento de un torneo.
 *
 * La pantalla cambia según el estado. En proceso es una **pantalla de mirar**: el admin sigue el
 * avance desde el club mientras las patrullas caminan.
 *
 * Es sólo la composición (`REF6-11` / `C-1`): los datos salen de `useTorneo` y cada acción vive
 * en su componente de `wafa/detalle/`.
 *
 * Ver `docs/FUNCTIONAL.md` §6.7.
 */

import { formatearFecha } from '@bal/shared';
import { BadgeEstado, useTituloDePagina } from '@bal/ui';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { botonClases, Encabezado, Pantalla, Screen } from '../../components/ui.js';
import { ControlesDeEstado } from '../detalle/ControlesDeEstado.js';
import { EdicionDelTorneo } from '../detalle/EdicionDelTorneo.js';
import { EdicionDeParticipantes } from '../detalle/EdicionDeParticipantes.js';
import { ParticipantesDelTorneo } from '../detalle/ParticipantesDelTorneo.js';
import { RecorridoDelTorneo } from '../detalle/RecorridoDelTorneo.js';
import { TarjetaDePatrulla } from '../detalle/TarjetaDePatrulla.js';
import { useTorneo } from '../detalle/useTorneo.js';
import { useRefrescoPeriodico } from '../refrescoPeriodico.js';
import { avanceDePatrullas } from '../torneo.js';

export function TournamentPage({ onVolver }: { readonly onVolver: () => void }) {
  const { id = '' } = useParams();
  const {
    torneo,
    patrullas,
    participantes,
    bloqueados,
    error: errorDeCarga,
    recargar,
  } = useTorneo(id);
  useTituloDePagina(torneo?.name ?? 'Torneo');

  /**
   * El error de la última acción, aparte del de la carga: un refresco automático que sale bien no
   * puede borrar el motivo por el que el servidor rechazó lo que el admin acaba de hacer.
   */
  const [errorDeAccion, setErrorDeAccion] = useState<string>();
  const error = errorDeAccion ?? errorDeCarga;

  /** Algo cambió en el servidor: se vuelve a cargar, y lo que había fallado ya no corre. */
  const alCambiar = () => {
    setErrorDeAccion(undefined);
    return recargar();
  };

  // Sólo un torneo en curso cambia solo: ahí las patrullas están anotando.
  useRefrescoPeriodico(() => void recargar({ silencioso: true }), torneo?.status === 'en_proceso');

  const avances = torneo ? avanceDePatrullas(patrullas, participantes, torneo.targets.length) : [];

  return (
    <Pantalla>
      <Encabezado contexto="Administración" titulo="Torneo" onVolver={onVolver} />

      <Screen>
        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        {torneo === undefined && !error && <p className="text-[var(--ink-muted)]">Cargando…</p>}

        {torneo && (
          <>
            <div className="pt-2">
              <h1 className="font-display text-display font-bold">{torneo.name}</h1>
              <p className="text-[var(--ink-muted)]" data-testid="estado">
                <BadgeEstado status={torneo.status} compacto /> · {formatearFecha(torneo.date)} ·{' '}
                {torneo.participantCount} arqueros · máximo {torneo.maxPossibleScore}
              </p>
            </div>

            <nav className="flex flex-col gap-2">
              <Link
                to={`/wafa/torneos/${id}/patrullas`}
                className={botonClases({ variante: 'secundario', ancho: true })}
              >
                Patrullas y credenciales
              </Link>

              <Link
                to={`/wafa/torneos/${id}/pagos`}
                className={botonClases({ variante: 'secundario', ancho: true })}
              >
                Arqueros y pagos
              </Link>

              <ControlesDeEstado torneo={torneo} onCambio={alCambiar} onError={setErrorDeAccion} />

              <EdicionDelTorneo
                torneo={torneo}
                onCambio={alCambiar}
                onError={setErrorDeAccion}
                onEliminado={onVolver}
              />

              <EdicionDeParticipantes
                torneo={torneo}
                participantes={participantes}
                onCambio={alCambiar}
                onError={setErrorDeAccion}
              />
            </nav>

            {torneo.status !== 'sin_iniciar' && (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  Avance
                </h2>

                {avances.map((a) => (
                  <TarjetaDePatrulla
                    key={a.number}
                    avance={a}
                    puedeDesbloquear={torneo.status === 'en_proceso'}
                    onCambio={() => void alCambiar()}
                  />
                ))}
              </section>
            )}

            <RecorridoDelTorneo torneo={torneo} bloqueados={bloqueados} />

            {participantes.length > 0 && torneo.status !== 'sin_iniciar' && (
              <ParticipantesDelTorneo
                participantes={participantes}
                totalBlancos={torneo.targets.length}
              />
            )}
          </>
        )}
      </Screen>
    </Pantalla>
  );
}
