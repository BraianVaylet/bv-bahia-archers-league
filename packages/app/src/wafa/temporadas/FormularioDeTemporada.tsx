/**
 * Alta de una temporada.
 */

import { type FormEvent, useState } from 'react';
import { Button, clasesDeTarjeta, cn, Field } from '../../components/ui.js';
import { ApiError, rpc } from '../../lib/rpc.js';
import { validarTemporada } from './validar.js';

export function FormularioDeTemporada({
  onCreada,
  onError,
}: {
  /** Recarga la lista. Se espera: el botón sigue deshabilitado hasta que llega. */
  readonly onCreada: () => Promise<void>;
  readonly onError: (mensaje: string) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Se valida al tipear pero sólo se muestra con algo escrito: un formulario
  // vacío que ya está en rojo no informa, molesta.
  const problema = nombre || desde || hasta ? validarTemporada(nombre, desde, hasta) : undefined;

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);

    try {
      await rpc.admin.seasons.$post({
        json: { name: nombre.trim(), startsAt: desde, endsAt: hasta },
      });
      setNombre('');
      setDesde('');
      setHasta('');
      await onCreada();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'No se pudo crear. Revisá la conexión.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void crear(e)}
      className={cn(clasesDeTarjeta(), 'mt-4 flex flex-col gap-3')}
    >
      <h2 className="font-semibold">Nueva temporada</h2>

      <Field
        label="Nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Liga Bahiense 2026"
        required
      />
      <Field
        label="Desde"
        type="date"
        value={desde}
        onChange={(e) => setDesde(e.target.value)}
        required
      />
      <Field
        label="Hasta"
        type="date"
        value={hasta}
        onChange={(e) => setHasta(e.target.value)}
        error={problema}
        required
      />

      <Button type="submit" ancho ocupado={enviando} disabled={!nombre || problema !== undefined}>
        Crear
      </Button>
    </form>
  );
}
