/**
 * Rehacer el recorrido de un torneo desde la ficha (`FE-32`).
 *
 * Usa el mismo editor que el paso 2 del wizard (`PasoRecorrido`). **Sólo cuando el torneo se puede
 * rearmar entero** —`camposEditables` incluye a los participantes, es decir, sin iniciar—:
 * cambiar cuántos blancos hay rearma las patrullas y les cambia el PIN (`BE-24`/`FE-32`), y con el
 * torneo en marcha las patrullas ya están en el predio. En proceso, el servidor deja tocar blancos
 * sin puntajes, pero eso pide mostrar cuáles están bloqueados blanco por blanco: queda fuera de
 * este editor.
 *
 * Si cambia la cantidad de blancos, se dice antes de guardar.
 */

import { camposEditables } from '@bal/shared';
import { useState } from 'react';
import { Button, clasesDeTarjeta, cn } from '../../components/ui.js';
import { ApiError, rpc } from '../../lib/rpc.js';
import { PasoRecorrido } from '../crear/PasoRecorrido.js';
import type { BlancoBorrador } from '../wizard.js';
import type { Torneo } from './useTorneo.js';

export function EdicionDelRecorrido({
  torneo,
  onCambio,
  onError,
}: {
  readonly torneo: Torneo;
  readonly onCambio: () => Promise<void>;
  readonly onError: (mensaje: string) => void;
}) {
  const [blancos, setBlancos] = useState<BlancoBorrador[]>();
  const [guardando, setGuardando] = useState(false);

  const editables = camposEditables(torneo.status);
  if (!editables.has('targets') || !editables.has('archerIds')) return null;

  const abrir = () =>
    setBlancos(
      torneo.targets.map((t) => ({
        index: t.index,
        modality: t.modality,
        arrows: t.arrows,
        description: t.description ?? null,
      })),
    );

  const guardar = async () => {
    if (!blancos) return;
    setGuardando(true);
    try {
      await rpc.admin.tournaments[':id'].$patch({
        param: { id: torneo.id },
        json: { targets: blancos.map((b) => ({ ...b })) },
      });
      setBlancos(undefined);
      await onCambio();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'No se pudo guardar el recorrido.');
    } finally {
      setGuardando(false);
    }
  };

  if (!blancos) {
    return (
      <Button variante="secundario" ancho onClick={abrir}>
        Editar recorrido
      </Button>
    );
  }

  const cambiaLaCantidad = blancos.length !== torneo.targets.length;

  return (
    <section
      aria-label="Editar recorrido"
      className={cn(clasesDeTarjeta({ nivel: 'transparente' }), 'flex flex-col gap-3')}
    >
      <PasoRecorrido blancos={blancos} onCambio={setBlancos} />

      {cambiaLaCantidad && (
        <p className="text-sm text-[var(--warn)]" role="status">
          Cambia la cantidad de blancos: se rearman las patrullas y les cambia el PIN. Si ya
          imprimiste las credenciales, hay que reimprimirlas. Los pagos marcados se conservan.
        </p>
      )}

      <div className="flex gap-2">
        <Button variante="secundario" onClick={() => setBlancos(undefined)}>
          Cancelar
        </Button>
        <Button ancho disabled={guardando} onClick={() => void guardar()}>
          {guardando ? 'Guardando…' : 'Guardar recorrido'}
        </Button>
      </div>
    </section>
  );
}
