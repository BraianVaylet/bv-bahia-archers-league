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

import { useCarga } from '@bal/cliente';
import { ChipCategoria } from '@bal/ui';
import { useState } from 'react';
import { Button, cn, Field } from '../../components/ui.js';
import { conSenal, cuerpo, rpc } from '../../lib/rpc.js';
import { FormularioDeArquero } from '../padron/FormularioDeArquero.js';
import { aCuerpoDeArquero, BORRADOR_VACIO, type Borrador } from '../padron/tipos.js';
import { type ArqueroElegible, avisoDeComposicion, conteoPorCategoria } from '../wizard.js';

/**
 * Alta de un arquero sin salir del wizard: mandar al admin al padrón y de vuelta le haría perder
 * todo lo cargado.
 *
 * **Usa el mismo formulario y el mismo cuerpo que el padrón** (`FE-39`). Tenía su propia copia,
 * anterior a `FE-29`, que no pedía sexo ni DNI: los arqueros creados acá nacían incompletos y
 * quedaban afuera del ranking Femenino/Masculino.
 *
 * El error del servidor (un DNI repetido, por ejemplo) lo muestra el formulario, que queda abierto
 * con lo tipeado. Los elegidos no se tocan hasta que el alta sale bien.
 */
function AltaRapida({ onCreado }: { readonly onCreado: (a: ArqueroElegible) => void }) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <Button variante="secundario" ancho onClick={() => setAbierto(true)}>
        Arquero nuevo
      </Button>
    );
  }

  const crear = async (b: Borrador) => {
    const r = await cuerpo(rpc.admin.archers.$post({ json: aCuerpoDeArquero(b) }));
    onCreado(r.archer);
    setAbierto(false);
  };

  return (
    <FormularioDeArquero
      inicial={BORRADOR_VACIO}
      onGuardar={crear}
      onCancelar={() => setAbierto(false)}
      nivelDeTitulo="h3"
      textoDeGuardar="Crear y sumar"
    />
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
  const [busqueda, setBusqueda] = useState('');

  const carga = useCarga(
    async (signal) => {
      const query = busqueda.trim() ? { q: busqueda.trim() } : {};
      const r = await cuerpo(rpc.admin.archers.$get({ query }, conSenal(signal)));
      return r.archers satisfies readonly ArqueroElegible[];
    },
    [busqueda],
    // Buscar es el mismo padrón con otra consulta: la lista se queda mientras llega la nueva.
    { conservarDatos: true },
  );
  // Si el padrón no carga, se ve vacío —no hay a quién elegir— en vez de mostrar uno viejo.
  const padron = carga.error === undefined ? carga.datos : [];

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
