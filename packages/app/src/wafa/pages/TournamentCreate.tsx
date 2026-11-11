/**
 * Wizard de creación de torneo.
 *
 * Cuatro pasos. **Se puede volver a cualquiera desde la revisión**: el admin arma el recorrido en
 * el club, con gente alrededor, y se equivoca. Rehacer todo por un blanco mal cargado no es una
 * opción.
 *
 * Acá quedan el estado del borrador y la navegación entre pasos (`REF6-11` / `C-1`): cada paso
 * vive en `wafa/crear/`.
 *
 * Ver `docs/FUNCTIONAL.md` §6.3.
 */

import { useTituloDePagina } from '@bal/ui';
import { useState } from 'react';
import { Button, cn, Encabezado, Pantalla, Screen } from '../../components/ui.js';
import { ApiError, cuerpo, rpc } from '../../lib/rpc.js';
import { PasoDatos } from '../crear/PasoDatos.js';
import { PasoParticipantes } from '../crear/PasoParticipantes.js';
import { PasoRecorrido } from '../crear/PasoRecorrido.js';
import { PasoRevision } from '../crear/PasoRevision.js';
import {
  type BorradorTorneo,
  borradorVacio,
  cuerpoDeCreacion,
  problemaDelPaso,
} from '../wizard.js';

const PASOS = ['Datos', 'Recorrido', 'Participantes', 'Revisión'] as const;

export interface TournamentCreatePageProps {
  readonly onVolver: () => void;
  readonly onCreado: (tournamentId: string) => void;
}

export function TournamentCreatePage({ onVolver, onCreado }: TournamentCreatePageProps) {
  useTituloDePagina('Nuevo torneo');
  const [paso, setPaso] = useState(1);
  const [borrador, setBorrador] = useState<BorradorTorneo>(borradorVacio);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [confirmandoSalir, setConfirmandoSalir] = useState(false);

  const cambiar = (parcial: Partial<BorradorTorneo>) => setBorrador((b) => ({ ...b, ...parcial }));

  /**
   * «Atrás» pide un segundo toque si hay algo que perder.
   *
   * Cuatro pasos —nombre, hasta 60 blancos, hasta 200 arqueros— perdidos por
   * un toque de más en el botón del header es demasiado para no avisar. Se
   * reusa el texto del propio botón para el segundo toque, en vez de un
   * párrafo aparte: no hay dónde ponerlo en el header, y es el mismo patrón de
   * dos toques que ya usa el resto de la app, sin `confirm()` ni modal.
   */
  const hayProgreso = JSON.stringify(borrador) !== JSON.stringify(borradorVacio());
  const volver = () => {
    if (hayProgreso && !confirmandoSalir) {
      setConfirmandoSalir(true);
      return;
    }
    onVolver();
  };

  const problema = problemaDelPaso(paso, borrador);

  const confirmar = async () => {
    setError(undefined);
    setEnviando(true);

    try {
      const r = await cuerpo(rpc.admin.tournaments.$post({ json: cuerpoDeCreacion(borrador) }));
      onCreado(r.tournament.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear. Revisá la conexión.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Pantalla>
      <Encabezado
        contexto="Administración"
        titulo="Crear torneo"
        onVolver={volver}
        textoVolver={confirmandoSalir ? 'Se pierde todo, ¿seguro?' : 'Inicio'}
      />

      <Screen>
        <ol className="pt-4 flex gap-1.5" aria-label="Pasos">
          {PASOS.map((nombre, i) => (
            <li
              key={nombre}
              aria-current={paso === i + 1 ? 'step' : undefined}
              className={cn(
                'flex-1 text-center text-xs py-2 rounded-[var(--radius-sm)]',
                paso === i + 1
                  ? 'bg-[var(--nock)] text-[var(--nock-ink)] font-semibold'
                  : 'bg-[var(--surface-2)] text-[var(--ink-muted)]',
              )}
            >
              {nombre}
            </li>
          ))}
        </ol>

        {paso === 1 && <PasoDatos borrador={borrador} onCambio={cambiar} />}
        {paso === 2 && (
          <PasoRecorrido blancos={borrador.blancos} onCambio={(blancos) => cambiar({ blancos })} />
        )}
        {paso === 3 && <PasoParticipantes borrador={borrador} onCambio={cambiar} />}
        {paso === 4 && <PasoRevision borrador={borrador} onIrA={setPaso} />}

        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
      </Screen>

      <div className="shrink-0 px-4 py-4 bg-[var(--bg)] border-t flex flex-col gap-2">
        {problema && paso !== 4 && (
          <p className="text-sm text-[var(--ink-muted)] text-center">{problema}</p>
        )}

        <div className="flex gap-2">
          {paso > 1 && (
            <Button variante="secundario" onClick={() => setPaso(paso - 1)}>
              Atrás
            </Button>
          )}

          {paso < 4 ? (
            <Button ancho disabled={problema !== undefined} onClick={() => setPaso(paso + 1)}>
              Continuar
            </Button>
          ) : (
            <Button ancho ocupado={enviando} onClick={() => void confirmar()}>
              {enviando ? 'Creando…' : 'Crear torneo'}
            </Button>
          )}
        </div>
      </div>
    </Pantalla>
  );
}
