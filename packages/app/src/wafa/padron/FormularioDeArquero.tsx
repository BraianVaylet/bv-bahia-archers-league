/**
 * Alta y edición de un arquero del padrón.
 *
 * **Es el único formulario de arquero de WAFA** (`FE-39`): lo usan el padrón y el alta rápida del
 * wizard de torneo. Antes el wizard tenía su propia copia, anterior a `FE-29`, que no pedía ni sexo
 * ni DNI.
 */

import { BOW_CATEGORIES, type BowCategory, CATEGORY_INFO, SEXES } from '@bal/shared';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { Button, clasesDeTarjeta, cn, Field } from '../../components/ui.js';
import { ApiError } from '../../lib/apiClient.js';
import { type Borrador, ETIQUETA_DE_SEXO } from './tipos.js';

export function FormularioDeArquero({
  inicial,
  onGuardar,
  onCancelar,
  nivelDeTitulo: Titulo = 'h2',
  textoDeGuardar = 'Guardar',
}: {
  readonly inicial: Borrador;
  readonly onGuardar: (b: Borrador) => Promise<void>;
  readonly onCancelar: () => void;
  /** En el padrón es una sección de la página; dentro de un paso del wizard, una subsección. */
  readonly nivelDeTitulo?: 'h2' | 'h3';
  /** Qué dice el botón: en el wizard, guardar también suma al arquero a los elegidos. */
  readonly textoDeGuardar?: string;
}) {
  /*
    Ids propios por instancia: con un `id` fijo, dos formularios en la misma página (o uno al lado
    de otro control con el mismo id) asociarían la etiqueta al control equivocado.
  */
  const idCategoria = useId();
  const nombreSexo = useId();
  const [borrador, setBorrador] = useState(inicial);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  /**
   * Al abrirse, el foco va al primer campo. Es lo que lo trae a la vista: `focus()`
   * scrollea hasta el campo, y el formulario de edición se abre donde estaba el
   * arquero, que puede estar muy abajo en el padrón. Con lector de pantalla, además,
   * anuncia que se abrió algo en vez de dejar el foco en un botón que ya no existe.
   */
  const formulario = useRef<HTMLFormElement>(null);
  useEffect(() => {
    formulario.current?.querySelector('input')?.focus();
  }, []);

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
      ref={formulario}
      onSubmit={(e) => void enviar(e)}
      className={cn(clasesDeTarjeta(), 'flex flex-col gap-3')}
    >
      <Titulo className="font-semibold">{inicial.id ? 'Editar arquero' : 'Nuevo arquero'}</Titulo>

      <Field
        label="Apellido"
        name="lastName"
        autoComplete="family-name"
        value={borrador.lastName}
        onChange={(e) => setBorrador({ ...borrador, lastName: e.target.value })}
        required
      />
      <Field
        label="Nombre"
        name="firstName"
        autoComplete="given-name"
        value={borrador.firstName}
        onChange={(e) => setBorrador({ ...borrador, firstName: e.target.value })}
        required
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={idCategoria} className="text-sm font-medium">
          Categoría
        </label>
        <select
          id={idCategoria}
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

      {/*
        Sexo y DNI (`FE-29`), opcionales: decisión 6 — el padrón viejo no se
        fuerza a completarse, así que acá tampoco se bloquea el guardado si
        quedan en blanco. El aviso en el listado es lo que de verdad señala
        a quién le falta, no esto.
      */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium">Sexo</legend>
        <div className="flex gap-2">
          {SEXES.map((sexo) => (
            <label
              key={sexo}
              className={cn(
                'flex-1 min-h-[52px] flex items-center justify-center rounded-[var(--radius-md)] border cursor-pointer',
                borrador.sex === sexo && 'bg-[var(--nock)] text-[var(--nock-ink)] font-semibold',
              )}
            >
              <input
                type="radio"
                name={nombreSexo}
                value={sexo}
                checked={borrador.sex === sexo}
                onChange={() => setBorrador({ ...borrador, sex: sexo })}
                className="sr-only"
              />
              {ETIQUETA_DE_SEXO[sexo]}
            </label>
          ))}
        </div>
      </fieldset>

      {/*
        Sólo dígitos, filtrados al tipear. Sin `maxLength`: el atributo nativo
        trunca el valor crudo antes de este `onChange`, así que con letras
        intercaladas corta antes de filtrarlas (ver `FE-27`). El tope de 8 lo
        pone el `.slice(0, 8)` sobre el valor ya filtrado.
      */}
      <Field
        label="DNI"
        name="dni"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={borrador.dni}
        onChange={(e) =>
          setBorrador({ ...borrador, dni: e.target.value.replace(/\D/g, '').slice(0, 8) })
        }
      />

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
          {textoDeGuardar}
        </Button>
      </div>
    </form>
  );
}
