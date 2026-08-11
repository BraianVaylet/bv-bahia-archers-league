/**
 * Temporadas de la liga.
 *
 * Una temporada agrupa torneos para el ranking. Puede haber varias en paralelo y
 * pueden cruzar años. Ver `docs/FUNCTIONAL.md` §6.5.
 */

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Button, Field, Screen } from '../../components/ui.js';
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
      <header className="sticky top-0 z-10 bg-[var(--bg)] border-b px-4 py-2 flex items-center gap-3">
        <button type="button" onClick={onVolver} className="min-h-[44px] text-left">
          ← Inicio
        </button>
        <span className="font-semibold">Temporadas</span>
      </header>

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
              <p className="font-semibold">{t.name}</p>
              <p className="text-sm text-[var(--ink-muted)]">
                {t.startsAt.slice(0, 10)} → {t.endsAt.slice(0, 10)}
              </p>
            </li>
          ))}
        </ul>
      </Screen>
    </div>
  );
}
