/**
 * Temporadas de la liga.
 *
 * Una temporada agrupa torneos para el ranking. Puede haber varias en paralelo y
 * pueden cruzar años. Ver `docs/FUNCTIONAL.md` §6.5.
 */

import { formatearRango } from '@bal/shared';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Button, Encabezado, Field, Screen } from '../../components/ui.js';
import { ApiError, api } from '../../lib/apiClient.js';

export interface SeasonRow {
  readonly id: string;
  readonly name: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: string;
}

/** Motivo por el que la temporada no se puede guardar, o `undefined` si se puede. */
export function validarTemporada(nombre: string, desde: string, hasta: string): string | undefined {
  if (nombre.trim().length < 3) return 'El nombre necesita al menos 3 caracteres.';
  if (!desde || !hasta) return 'Faltan las fechas.';
  if (new Date(hasta) <= new Date(desde)) return 'La temporada no puede terminar antes de empezar.';
  return undefined;
}

export function SeasonsPage({ onVolver }: { readonly onVolver: () => void }) {
  const [temporadas, setTemporadas] = useState<SeasonRow[]>();
  const [nombre, setNombre] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await api.get<{ seasons: SeasonRow[] }>('/admin/seasons');
      setTemporadas(r.seasons);
      setError(undefined);
    } catch {
      setError('No se pudieron cargar las temporadas. Revisá la conexión.');
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiarEstado = async (t: SeasonRow, reabrir: boolean) => {
    try {
      await api.post(`/admin/seasons/${t.id}/${reabrir ? 'restore' : 'archive'}`);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado.');
    }
  };

  // Se valida al tipear pero sólo se muestra con algo escrito: un formulario
  // vacío que ya está en rojo no informa, molesta.
  const problema = nombre || desde || hasta ? validarTemporada(nombre, desde, hasta) : undefined;

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);

    try {
      await api.post('/admin/seasons', { name: nombre.trim(), startsAt: desde, endsAt: hasta });
      setNombre('');
      setDesde('');
      setHasta('');
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear. Revisá la conexión.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col min-h-dvh">
      <Encabezado titulo="Temporadas" onVolver={onVolver} />

      <Screen>
        <form
          onSubmit={(e) => void crear(e)}
          className="mt-4 flex flex-col gap-3 rounded-[var(--radius-lg)] border p-3 bg-[var(--surface)]"
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

          <Button type="submit" ancho disabled={enviando || !nombre || problema !== undefined}>
            Crear
          </Button>
        </form>

        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        {temporadas?.length === 0 && (
          <p className="text-[var(--ink-muted)]">Todavía no hay temporadas.</p>
        )}

        <ul className="flex flex-col gap-2">
          {temporadas?.map((t) => (
            <li
              key={t.id}
              className="rounded-[var(--radius-lg)] border p-3 bg-[var(--surface)]"
              data-testid={`temporada-${t.id}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold">{t.name}</p>
                {/* El estado va escrito, no sólo en el color del botón. */}
                <span className="text-sm px-2 py-0.5 rounded-full bg-[var(--surface-2)] shrink-0">
                  {t.status === 'cerrada' ? 'Cerrada' : 'Activa'}
                </span>
              </div>

              <p className="text-sm text-[var(--ink-muted)]">
                {formatearRango(t.startsAt, t.endsAt)}
              </p>

              {/* Cerrar no borra ni congela nada: es una marca para saber cuál
                  está en curso cuando hay varias, que es el caso a fin de año. */}
              <div className="flex gap-2 pt-2">
                <Button
                  variante="secundario"
                  onClick={() => void cambiarEstado(t, t.status === 'cerrada')}
                >
                  {t.status === 'cerrada' ? 'Reabrir' : 'Cerrar'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Screen>
    </div>
  );
}
