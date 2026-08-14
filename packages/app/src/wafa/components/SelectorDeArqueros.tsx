/**
 * Elegir arqueros para un torneo.
 *
 * **Estaba dentro del asistente de creación**, que tiene 675 líneas. Se extrajo
 * en `REF2-6` porque hace falta en dos lados: al crear el torneo y al editar
 * sus participantes con el torneo `sin_iniciar` — lo que `REF2-5` dejó
 * pendiente justo por esto.
 *
 * El aviso de composición corre **el mismo algoritmo que el servidor**, así que
 * lo que se ve en vivo no es una aproximación.
 */

import { BOW_CATEGORIES, type BowCategory, CATEGORY_INFO } from '@bal/shared';
import { ChipCategoria } from '@bal/ui';
import { useCallback, useEffect, useState } from 'react';
import { Button, cn, Field } from '../../components/ui.js';
import { ApiError, api } from '../../lib/apiClient.js';
import { type ArqueroElegible, avisoDeComposicion, conteoPorCategoria } from '../wizard.js';

function AltaRapida({ onCreado }: { readonly onCreado: (a: ArqueroElegible) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [category, setCategory] = useState<BowCategory>('razo');
  const [error, setError] = useState<string>();

  const crear = async () => {
    try {
      const r = await api.post<{ archer: ArqueroElegible }>('/admin/archers', {
        firstName,
        lastName,
        category,
      });
      onCreado(r.archer);
      setFirstName('');
      setLastName('');
      setAbierto(false);
      setError(undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el arquero.');
    }
  };

  if (!abierto) {
    return (
      <Button variante="secundario" ancho onClick={() => setAbierto(true)}>
        Arquero nuevo
      </Button>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border p-3 flex flex-col gap-3 bg-[var(--surface)]">
      {/* Se crea sin salir del wizard: mandar al admin al padrón y de vuelta le
          haría perder todo lo cargado. */}
      <h3 className="font-semibold">Arquero nuevo</h3>

      <Field label="Apellido" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      <Field label="Nombre" value={firstName} onChange={(e) => setFirstName(e.target.value)} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoria-nueva" className="text-sm font-medium">
          Categoría
        </label>
        <select
          id="categoria-nueva"
          value={category}
          onChange={(e) => setCategory(e.target.value as BowCategory)}
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
        <Button variante="secundario" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
        <Button ancho disabled={!firstName.trim() || !lastName.trim()} onClick={() => void crear()}>
          Crear y sumar
        </Button>
      </div>
    </div>
  );
}

export interface SelectorDeArquerosProps {
  readonly elegidos: readonly ArqueroElegible[];
  /** Cuántos blancos tiene el recorrido, para el aviso de composición. */
  readonly blancos: number;
  readonly onCambio: (elegidos: ArqueroElegible[]) => void;
}

export function SelectorDeArqueros({
  elegidos: elegidosLista,
  blancos,
  onCambio,
}: SelectorDeArquerosProps) {
  const [padron, setPadron] = useState<ArqueroElegible[]>();
  const [busqueda, setBusqueda] = useState('');

  const cargar = useCallback(async () => {
    const params = busqueda.trim() ? `?q=${encodeURIComponent(busqueda.trim())}` : '';
    try {
      const r = await api.get<{ archers: ArqueroElegible[] }>(`/admin/archers${params}`);
      setPadron(r.archers);
    } catch {
      setPadron([]);
    }
  }, [busqueda]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const elegidos = new Set(elegidosLista.map((a) => a.id));

  const alternar = (a: ArqueroElegible) => {
    onCambio(
      elegidos.has(a.id) ? elegidosLista.filter((x) => x.id !== a.id) : [...elegidosLista, a],
    );
  };

  const aviso = avisoDeComposicion(elegidosLista, blancos);
  const conteo = conteoPorCategoria(elegidosLista);

  /**
   * Agrega los que se están viendo, sin sacar ninguno de los ya elegidos.
   *
   * Con la búsqueda vacía es todo el padrón; con una búsqueda escrita, sólo lo
   * filtrado. Es lo que hace usable inscribir a los 30 de la fecha sin 30
   * toques, que es el caso normal.
   */
  const agregarTodos = () => {
    const nuevos = (padron ?? []).filter((a) => !elegidos.has(a.id));
    if (nuevos.length > 0) onCambio([...elegidosLista, ...nuevos]);
  };

  const faltanPorAgregar = (padron ?? []).filter((a) => !elegidos.has(a.id)).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--ink-muted)]" data-testid="conteo-elegidos">
        {elegidosLista.length} arqueros elegidos
      </p>

      <div className="flex gap-2 flex-wrap">
        <Button variante="secundario" disabled={faltanPorAgregar === 0} onClick={agregarTodos}>
          {busqueda.trim() ? 'Agregar los filtrados' : 'Agregar todos'}
          {faltanPorAgregar > 0 && ` (${faltanPorAgregar})`}
        </Button>

        {elegidosLista.length > 0 && (
          <Button variante="secundario" onClick={() => onCambio([])}>
            Quitar todos
          </Button>
        )}
      </div>

      {conteo.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {conteo.map((c) => (
            <li key={c.category} className="flex items-center gap-1">
              <ChipCategoria category={c.category} compacto />
              <span className="text-sm text-[var(--ink-muted)]">{c.cantidad}</span>
            </li>
          ))}
        </ul>
      )}

      {/* El aviso corre el MISMO algoritmo que el servidor, así que no adivina. */}
      {aviso.nivel !== 'ok' && (
        <p
          role={aviso.nivel === 'error' ? 'alert' : 'status'}
          className={cn(
            'text-sm rounded-[var(--radius-md)] border p-3',
            aviso.nivel === 'error' ? 'text-[var(--danger)]' : 'text-[var(--warn)]',
          )}
        >
          {aviso.mensaje}
        </p>
      )}

      <AltaRapida onCreado={(a) => onCambio([...elegidosLista, a])} />

      <Field
        label="Buscar en el padrón"
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <ul className="flex flex-col gap-1.5">
        {padron?.map((a) => (
          <li key={a.id}>
            <label className="flex items-center gap-3 min-h-[44px] px-3 rounded-[var(--radius-md)] border bg-[var(--surface)]">
              <input
                type="checkbox"
                checked={elegidos.has(a.id)}
                onChange={() => alternar(a)}
                className="w-5 h-5"
              />
              <span className="flex-1">
                {a.lastName}, {a.firstName}
              </span>
              <ChipCategoria category={a.category} compacto />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
