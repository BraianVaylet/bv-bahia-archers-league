/**
 * Despublicar un torneo ya publicado, con su motivo.
 */

import { useState } from 'react';
import { Button, clasesDeTarjeta, cn } from '../../components/ui.js';
import { ApiError, rpc } from '../../lib/rpc.js';

export function Despublicar({
  id,
  onHecho,
}: {
  readonly id: string;
  readonly onHecho: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string>();

  const despublicar = async () => {
    try {
      await rpc.admin.tournaments[':id'].unpublish.$post({
        param: { id },
        json: { reason: motivo.trim() },
      });
      setAbierto(false);
      onHecho();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo despublicar.');
    }
  };

  if (!abierto) {
    return (
      <Button variante="secundario" ancho onClick={() => setAbierto(true)}>
        Despublicar
      </Button>
    );
  }

  return (
    <div className={cn(clasesDeTarjeta({ nivel: 'transparente' }), 'flex flex-col gap-2')}>
      {/* Se dice exactamente qué revierte, no un "¿estás seguro?" genérico. */}
      <p className="text-sm text-[var(--warn)]">
        Despublicar saca este torneo de la liga: el promedio de cada arquero se recalcula
        <strong> sin él</strong>, y los resultados dejan de verse en la página pública. Los puntajes
        cargados no se borran, y se puede volver a publicar.
      </p>

      <label className="text-sm" htmlFor="motivo-despublicar">
        Por qué lo despublicás
      </label>
      <textarea
        id="motivo-despublicar"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={2}
        className="px-3 py-2 text-base rounded-[var(--radius-md)] bg-[var(--surface)] border"
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
          onClick={() => void despublicar()}
        >
          Despublicar
        </Button>
      </div>
    </div>
  );
}
