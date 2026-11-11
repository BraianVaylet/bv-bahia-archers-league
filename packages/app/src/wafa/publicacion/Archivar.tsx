/**
 * Archivar o desarchivar un torneo publicado, con su motivo (`FE-35`, `BE-26`).
 *
 * Archivar **no despublica**: el torneo sigue publicado, pero sale del ranking de la temporada y
 * deja de verse en la página pública (decisiones 4 y 5 de la Fase 9). Se dice exactamente eso
 * antes de hacerlo, igual que `Despublicar`, y se pide el motivo: queda en el audit log.
 */

import { useState } from 'react';
import { Button, clasesDeTarjeta, cn } from '../../components/ui.js';
import { ApiError, rpc } from '../../lib/rpc.js';

export function Archivar({
  id,
  archivado,
  onHecho,
}: {
  readonly id: string;
  readonly archivado: boolean;
  readonly onHecho: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string>();

  const accion = archivado ? 'Desarchivar' : 'Archivar';

  const enviar = async () => {
    try {
      const pedido = { param: { id }, json: { reason: motivo.trim() } };
      await (archivado
        ? rpc.admin.tournaments[':id'].unarchive.$post(pedido)
        : rpc.admin.tournaments[':id'].archive.$post(pedido));
      setAbierto(false);
      setMotivo('');
      onHecho();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `No se pudo ${accion.toLowerCase()}.`);
    }
  };

  if (!abierto) {
    return (
      <Button variante="secundario" ancho onClick={() => setAbierto(true)}>
        {accion}
      </Button>
    );
  }

  const idMotivo = archivado ? 'motivo-desarchivar' : 'motivo-archivar';

  return (
    <div className={cn(clasesDeTarjeta({ nivel: 'transparente' }), 'flex flex-col gap-2')}>
      {/* Qué pasa exactamente, no un "¿estás seguro?" genérico. */}
      <p className="text-sm text-[var(--warn)]">
        {archivado ? (
          <>
            Desarchivar lo devuelve: vuelve a sumar al ranking de la temporada y a verse en la
            página pública.
          </>
        ) : (
          <>
            Archivar lo deja publicado, pero <strong>sale del ranking</strong> de la temporada y{' '}
            <strong>deja de verse en la página pública</strong>. Los puntajes no se borran, y se
            puede desarchivar.
          </>
        )}
      </p>

      <label className="text-sm" htmlFor={idMotivo}>
        {archivado ? 'Por qué lo desarchivás' : 'Por qué lo archivás'}
      </label>
      <textarea
        id={idMotivo}
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
        <Button ancho disabled={motivo.trim().length < 5} onClick={() => void enviar()}>
          {accion}
        </Button>
      </div>
    </div>
  );
}
