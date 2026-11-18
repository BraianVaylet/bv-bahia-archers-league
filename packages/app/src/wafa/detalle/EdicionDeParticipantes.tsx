/**
 * Cambiar quiénes participan en un torneo que todavía no arrancó.
 *
 * Va aparte del formulario de datos porque **tiene otra consecuencia**: cambia las patrullas. Desde
 * `BE-31` no las rearma —quien entra se suma a una con lugar, quien sale deja la suya, y nadie más
 * se mueve ni cambia de PIN—, pero el admin tiene que revisarlas después (`FE-48`).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, clasesDeTarjeta, cn } from '../../components/ui.js';
import { ApiError, rpc } from '../../lib/rpc.js';
import { SelectorDeArqueros } from '../components/SelectorDeArqueros.js';
import type { ResultadoParticipante } from '../torneo.js';
import type { ArqueroElegible } from '../wizard.js';
import type { Torneo } from './useTorneo.js';

export function EdicionDeParticipantes({
  torneo,
  participantes,
  onCambio,
  onError,
}: {
  readonly torneo: Torneo;
  readonly participantes: readonly ResultadoParticipante[];
  readonly onCambio: () => Promise<void>;
  readonly onError: (mensaje: string) => void;
}) {
  /** Los participantes en edición. `undefined` = el panel está cerrado. */
  const [editandoArqueros, setEditandoArqueros] = useState<ArqueroElegible[]>();
  /** Lo que pasó al guardar: cuántos entraron y salieron (`FE-48`). */
  const [resultado, setResultado] = useState<string>();

  /**
   * El servidor incorpora y quita sin rearmar (`BE-31`). Lo que no cumpla el reglamento queda
   * avisado en el editor de patrullas, y por eso el resultado lleva hasta ahí.
   */
  const guardarArqueros = async () => {
    if (!editandoArqueros) return;
    const antes = new Set(participantes.map((p) => p.archerId));
    const despues = new Set(editandoArqueros.map((a) => a.id));
    const entran = [...despues].filter((id) => !antes.has(id)).length;
    const salen = [...antes].filter((id) => !despues.has(id)).length;
    try {
      await rpc.admin.tournaments[':id'].$patch({
        param: { id: torneo.id },
        json: { archerIds: editandoArqueros.map((a) => a.id) },
      });
      setEditandoArqueros(undefined);
      setResultado(textoDelCambio(entran, salen));
      await onCambio();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'No se pudieron guardar los participantes.');
    }
  };

  if (torneo.status !== 'sin_iniciar') return null;

  return (
    <div className="flex flex-col gap-2">
      <Button
        variante="secundario"
        ancho
        onClick={() =>
          setEditandoArqueros(
            editandoArqueros
              ? undefined
              : participantes.map((p) => ({
                  id: p.archerId,
                  firstName: p.firstName,
                  lastName: p.lastName,
                  category: p.category,
                })),
          )
        }
      >
        {editandoArqueros ? 'Cancelar' : 'Editar participantes'}
      </Button>

      {resultado && !editandoArqueros && (
        <p role="status" className="text-sm" data-testid="aviso-participantes">
          {resultado}{' '}
          <Link to={`/wafa/torneos/${torneo.id}/patrullas`} className="underline font-semibold">
            Revisar las patrullas
          </Link>
        </p>
      )}

      {editandoArqueros && (
        <div
          className={cn(clasesDeTarjeta(), 'flex flex-col gap-3')}
          data-testid="editar-participantes"
        >
          <p className="text-sm text-[var(--ink-muted)]">
            Las patrullas se conservan, con sus PIN: quien entra se suma a una con lugar —o a una
            nueva, si no hay— y quien sale deja la suya. Después revisalas en Patrullas.
          </p>

          <SelectorDeArqueros
            elegidos={editandoArqueros}
            blancos={torneo.targets.length}
            onCambio={setEditandoArqueros}
          />

          <Button
            ancho
            disabled={editandoArqueros.length < 2}
            onClick={() => void guardarArqueros()}
          >
            Guardar participantes
          </Button>
        </div>
      )}
    </div>
  );
}

/** «Entró 1 y salió 2.» Las patrullas no se rearmaron: se dice qué cambió. */
function textoDelCambio(entran: number, salen: number): string {
  const entro = entran === 1 ? 'Entró 1' : `Entraron ${entran}`;
  const salio = salen === 1 ? 'salió 1' : `salieron ${salen}`;
  return `${entro} y ${salio}; las patrullas se conservaron.`;
}
