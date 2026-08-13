/**
 * Padrón de arqueros.
 *
 * **Eliminar no es lo mismo que archivar.** Un arquero que participó de un
 * torneo no se puede borrar: su histórico y su lugar en los rankings dependen de
 * que siga existiendo. La pantalla lo dice antes de que el admin lo intente, no
 * después.
 *
 * Ver `docs/FUNCTIONAL.md` §6.4.
 */

import { BOW_CATEGORIES, type BowCategory, CATEGORY_INFO } from '@bal/shared';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Button, Encabezado, Field, Screen } from '../../components/ui.js';
import { ApiError, api } from '../../lib/apiClient.js';

export interface ArcherRow {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly category: BowCategory;
  readonly archived: boolean;
  /** Participó de algún torneo, así que **no se puede borrar**. */
  readonly participated: boolean;
  /** En cuántos torneos jugó. Distingue al que compite del que está en el padrón. */
  readonly tournamentCount: number;
}

interface Borrador {
  readonly id?: string;
  firstName: string;
  lastName: string;
  category: BowCategory;
}

const BORRADOR_VACIO: Borrador = { firstName: '', lastName: '', category: 'razo' };

// ── Formulario ───────────────────────────────────────────────────────────────

function ArcherForm({
  inicial,
  onGuardar,
  onCancelar,
}: {
  readonly inicial: Borrador;
  readonly onGuardar: (b: Borrador) => Promise<void>;
  readonly onCancelar: () => void;
}) {
  const [borrador, setBorrador] = useState(inicial);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setEnviando(true);

    try {
      await onGuardar(borrador);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar. Revisá la conexión.');
    } finally {
      setEnviando(false);
    }
  };

  const completo = borrador.firstName.trim() !== '' && borrador.lastName.trim() !== '';

  return (
    <form
      onSubmit={(e) => void enviar(e)}
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border p-3 bg-[var(--surface)]"
    >
      <h2 className="font-semibold">{inicial.id ? 'Editar arquero' : 'Nuevo arquero'}</h2>

      <Field
        label="Apellido"
        value={borrador.lastName}
        onChange={(e) => setBorrador({ ...borrador, lastName: e.target.value })}
        required
      />
      <Field
        label="Nombre"
        value={borrador.firstName}
        onChange={(e) => setBorrador({ ...borrador, firstName: e.target.value })}
        required
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoria" className="text-sm font-medium">
          Categoría
        </label>
        <select
          id="categoria"
          value={borrador.category}
          onChange={(e) => setBorrador({ ...borrador, category: e.target.value as BowCategory })}
          className="min-h-[52px] px-4 text-base rounded-[var(--radius-md)] bg-[var(--surface)] border"
        >
          {BOW_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_INFO[c].label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button variante="secundario" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" ancho disabled={enviando || !completo}>
          Guardar
        </Button>
      </div>
    </form>
  );
}

// ── Fila ─────────────────────────────────────────────────────────────────────

function Fila({
  arquero,
  onEditar,
  onArchivar,
  onRestaurar,
  onEliminar,
}: {
  readonly arquero: ArcherRow;
  readonly onEditar: () => void;
  readonly onArchivar: () => void;
  readonly onRestaurar: () => void;
  readonly onEliminar: () => void;
}) {
  return (
    <li
      className="rounded-[var(--radius-lg)] border p-3 flex flex-col gap-2 bg-[var(--surface)]"
      data-testid={`arquero-${arquero.lastName}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">
          {arquero.lastName}, {arquero.firstName}
        </span>
        {/* La categoría resaltada: decide estaca y podio, y es lo que el admin
            busca de un vistazo al armar un torneo. */}
        <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-[var(--surface-2)] shrink-0">
          {CATEGORY_INFO[arquero.category].label}
        </span>
      </div>

      <p className="text-sm text-[var(--ink-muted)]">
        {arquero.tournamentCount === 0
          ? 'Todavía no jugó ningún torneo'
          : `${arquero.tournamentCount} ${arquero.tournamentCount === 1 ? 'torneo jugado' : 'torneos jugados'}`}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button variante="secundario" onClick={onEditar}>
          Editar
        </Button>

        {arquero.archived ? (
          <Button variante="secundario" onClick={onRestaurar}>
            Restaurar
          </Button>
        ) : (
          <Button variante="secundario" onClick={onArchivar}>
            Archivar
          </Button>
        )}

        <Button variante="peligro" onClick={onEliminar} disabled={arquero.participated}>
          Eliminar
        </Button>
      </div>

      {/* La explicación va siempre que el botón esté deshabilitado: un botón gris
          sin motivo es una pared, no una respuesta. */}
      {arquero.participated && (
        <p className="text-sm text-[var(--ink-muted)]">
          Ya participó de un torneo, así que no se puede eliminar sin romper su histórico y los
          rankings. Archivalo: deja de aparecer al armar torneos nuevos y conserva todo.
        </p>
      )}
    </li>
  );
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

export function ArchersPage({ onVolver }: { readonly onVolver: () => void }) {
  const [arqueros, setArqueros] = useState<ArcherRow[]>();
  const [busqueda, setBusqueda] = useState('');
  const [verArchivados, setVerArchivados] = useState(false);
  const [categoria, setCategoria] = useState<BowCategory | ''>('');
  const [editando, setEditando] = useState<Borrador>();
  const [error, setError] = useState<string>();

  const cargar = useCallback(async () => {
    const params = new URLSearchParams();
    if (verArchivados) params.set('archived', 'true');
    if (busqueda.trim()) params.set('q', busqueda.trim());

    try {
      const r = await api.get<{ archers: ArcherRow[] }>(
        `/admin/archers${params.size > 0 ? `?${params}` : ''}`,
      );
      setArqueros(r.archers);
      setError(undefined);
    } catch {
      setError('No se pudo cargar el padrón. Revisá la conexión.');
    }
  }, [busqueda, verArchivados]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const accion = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la acción.');
    }
  };

  // El filtro se aplica sobre lo que ya llegó: la búsqueda y el archivado sí
  // viajan al servidor porque necesitan el índice.
  const visibles = arqueros?.filter((a) => categoria === '' || a.category === categoria);

  const guardar = async (b: Borrador) => {
    const cuerpo = { firstName: b.firstName, lastName: b.lastName, category: b.category };
    await (b.id ? api.patch(`/admin/archers/${b.id}`, cuerpo) : api.post('/admin/archers', cuerpo));
    setEditando(undefined);
    await cargar();
  };

  return (
    <div className="flex flex-col min-h-dvh">
      <Encabezado titulo="Arqueros" onVolver={onVolver} />

      <Screen>
        {editando ? (
          <div className="pt-4">
            <ArcherForm
              inicial={editando}
              onGuardar={guardar}
              onCancelar={() => setEditando(undefined)}
            />
          </div>
        ) : (
          <div className="pt-4">
            <Button ancho onClick={() => setEditando(BORRADOR_VACIO)}>
              Nuevo arquero
            </Button>
          </div>
        )}

        <Field
          label="Buscar"
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Apellido o nombre"
        />

        {/* El filtro es del cliente y no del servidor: el padrón entero son
            cientos de arqueros, ya está en memoria, y así responde sin viaje. */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filtro-categoria" className="text-sm font-medium">
            Filtrar por categoría
          </label>
          <select
            id="filtro-categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as BowCategory | '')}
            className="min-h-[52px] px-4 text-base rounded-[var(--radius-md)] bg-[var(--surface)] border"
          >
            <option value="">Todas</option>
            {BOW_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_INFO[c].label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 min-h-[44px]">
          <input
            type="checkbox"
            checked={verArchivados}
            onChange={(e) => setVerArchivados(e.target.checked)}
            className="w-5 h-5"
          />
          <span>Ver archivados</span>
        </label>

        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        {arqueros === undefined && !error && <p className="text-[var(--ink-muted)]">Cargando…</p>}

        {visibles?.length === 0 && (
          <p className="text-[var(--ink-muted)]">
            {busqueda.trim()
              ? 'Ningún arquero coincide con la búsqueda.'
              : verArchivados
                ? 'No hay arqueros archivados.'
                : 'El padrón está vacío.'}
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {visibles?.map((a) => (
            <Fila
              key={a.id}
              arquero={a}
              onEditar={() =>
                setEditando({
                  id: a.id,
                  firstName: a.firstName,
                  lastName: a.lastName,
                  category: a.category,
                })
              }
              onArchivar={() => void accion(() => api.post(`/admin/archers/${a.id}/archive`))}
              onRestaurar={() => void accion(() => api.post(`/admin/archers/${a.id}/restore`))}
              onEliminar={() => void accion(() => api.del(`/admin/archers/${a.id}`))}
            />
          ))}
        </ul>
      </Screen>
    </div>
  );
}
