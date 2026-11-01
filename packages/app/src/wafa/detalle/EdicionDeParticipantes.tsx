/**
 * Cambiar quiénes participan en un torneo que todavía no arrancó.
 *
 * Va aparte del formulario de datos porque **tiene otra consecuencia**: cambiar la lista rearma
 * las patrullas y les cambia el PIN. Meterlo en el mismo «Guardar cambios» que el nombre haría que
 * corregir una tilde reimprima las planillas.
 */

import { useState } from 'react';
import { Button, clasesDeTarjeta, cn } from '../../components/ui.js';
import { ApiError, api } from '../../lib/apiClient.js';
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

  /**
   * **Rearma las patrullas**, y eso lo hace el servidor: las patrullas se derivan de la lista de
   * arqueros y de las restricciones del dominio, así que agregar a alguien sin rehacerlas daría una
   * patrulla de cinco o una 100 % escuela. Los PIN cambian, y por eso se avisa antes.
   */
  const guardarArqueros = async () => {
    if (!editandoArqueros) return;
    try {
      await api.patch(`/admin/tournaments/${torneo.id}`, {
        archerIds: editandoArqueros.map((a) => a.id),
      });
      setEditandoArqueros(undefined);
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

      {editandoArqueros && (
        <div
          className={cn(clasesDeTarjeta(), 'flex flex-col gap-3')}
          data-testid="editar-participantes"
        >
          <p className="text-sm text-[var(--warn)]">
            Cambiar quiénes participan <strong>rearma las patrullas</strong> y les cambia el PIN. Si
            ya imprimiste las planillas, hay que reimprimirlas.
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
