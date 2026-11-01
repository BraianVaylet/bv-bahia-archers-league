/**
 * Desbloquear la firma de un arquero que se fue sin firmar.
 *
 * El motivo es obligatorio y queda en el audit log: desbloquear una firma es saltarse el
 * control que valida el puntaje.
 */

import { useState } from 'react';
import { Button } from '../../components/ui.js';
import { ApiError, api } from '../../lib/apiClient.js';
import type { ResultadoParticipante } from '../torneo.js';

export function DesbloquearFirma({
  participante,
  onHecho,
}: {
  readonly participante: ResultadoParticipante;
  readonly onHecho: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string>();

  const desbloquear = async () => {
    try {
      await api.post(`/admin/participants/${participante.id}/signature/unlock`, {
        reason: motivo.trim(),
      });
      setAbierto(false);
      setMotivo('');
      onHecho();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo desbloquear.');
    }
  };

  if (!abierto) {
    return (
      <Button variante="secundario" onClick={() => setAbierto(true)}>
        Desbloquear firma
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border p-3">
      <label className="text-sm" htmlFor={`motivo-${participante.id}`}>
        Por qué {participante.lastName} no firma
      </label>
      <textarea
        id={`motivo-${participante.id}`}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={2}
        className="px-3 py-2 text-base rounded-[var(--radius-md)] bg-[var(--surface)] border"
        placeholder="Se fue antes de cerrar el circuito."
      />

      {error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button variante="secundario" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
        <Button
          ancho
          variante="peligro"
          disabled={motivo.trim().length < 5}
          onClick={() => void desbloquear()}
        >
          Desbloquear
        </Button>
      </div>
    </div>
  );
}
