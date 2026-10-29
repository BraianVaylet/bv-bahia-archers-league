/**
 * Alta pública de arquero (autoregistro).
 *
 * **No inscribe a nada.** El arquero queda `pendiente` hasta que el club lo
 * aprueba desde WAFA (`BE-22`) — por eso la confirmación dice exactamente eso,
 * nunca «ya estás anotado». Es la primera pantalla de la landing que escribe.
 *
 * La validación es la **misma** que corre el servidor: `ArcherSelfRegisterSchema`
 * viene de `@bal/shared`, no una copia a mano que pueda desalinearse.
 *
 * Ver `docs/FUNCTIONAL.md` §5.5 · `docs/SECURITY.md` §15.
 */

import {
  ArcherSelfRegisterSchema,
  BOW_CATEGORIES,
  type BowCategory,
  CATEGORY_INFO,
  SEXES,
  type Sex,
} from '@bal/shared';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { clasesDeTarjeta, cn, Screen } from '../components/ui.js';
import { ApiError, post } from '../lib/api.js';

interface Borrador {
  readonly firstName: string;
  readonly lastName: string;
  readonly dni: string;
  readonly sex: Sex | '';
  readonly category: BowCategory;
}

const VACIO: Borrador = { firstName: '', lastName: '', dni: '', sex: '', category: 'razo' };

const ETIQUETA_DE_SEXO: Record<Sex, string> = { femenino: 'Femenino', masculino: 'Masculino' };

/** Junta los mensajes de Zod en uno solo: varios campos pueden fallar a la vez. */
function mensajesDe(issues: readonly { message: string }[]): string {
  return [...new Set(issues.map((i) => i.message))].join(' ');
}

/** De qué campo del schema a qué `id` del DOM, para llevar el foco ahí al fallar. */
const ID_DEL_CAMPO: Record<string, string> = {
  lastName: 'apellido',
  firstName: 'nombre',
  dni: 'dni',
  category: 'categoria',
};

/**
 * El orden **visual** del formulario, no el del schema.
 *
 * `ArcherSelfRegisterSchema` declara `firstName` antes que `lastName`, pero
 * en la pantalla Apellido va primero. Tomar `issues[0]` a secas enfocaría
 * Nombre con los dos campos vacíos — técnicamente "un error", pero no el que
 * se ve arriba de todo.
 */
const ORDEN_VISUAL = ['lastName', 'firstName', 'dni', 'sex', 'category'];

/**
 * Lleva el foco al primer campo que falló, en el orden en que aparece en
 * pantalla.
 *
 * El error ya se lee —`role="alert"` lo anuncia—, pero sin esto el foco se
 * queda en el botón «Enviar»: quien usa el teclado o un lector de pantalla
 * tiene que ir a buscar a mano cuál de los cinco campos fue. `sex` no tiene
 * un `id` propio porque es un grupo de radios, no un input.
 */
function enfocarPrimerError(issues: readonly { path: readonly PropertyKey[] }[]): void {
  const fallados = new Set(issues.map((i) => i.path[0]));
  const campo = ORDEN_VISUAL.find((c) => fallados.has(c));

  if (campo === 'sex') {
    document.querySelector<HTMLInputElement>('input[name="sexo"]')?.focus();
    return;
  }
  if (campo) {
    document.getElementById(ID_DEL_CAMPO[campo] ?? '')?.focus();
  }
}

export function ArcherRegisterPage() {
  const [borrador, setBorrador] = useState(VACIO);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);

    const resultado = ArcherSelfRegisterSchema.safeParse(borrador);
    if (!resultado.success) {
      setError(mensajesDe(resultado.error.issues));
      enfocarPrimerError(resultado.error.issues);
      return;
    }

    setEnviando(true);
    try {
      await post('/archers', resultado.data);
      setHecho(true);
    } catch (err) {
      // El error del servidor se muestra tal cual, sin reinterpretarlo: es el
      // caso del DNI repetido, y no hay nada que agregar que ya no diga.
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar. Revisá la conexión.');
    } finally {
      setEnviando(false);
    }
  };

  if (hecho) {
    return (
      <Screen>
        <div className="pt-6">
          <h1 className="font-[var(--font-display)] text-[var(--text-display)] font-bold">
            Alta recibida
          </h1>
        </div>

        {/*
          **Nunca «ya estás anotado».** Todavía no lo está: falta que el club
          revise el pedido desde WAFA (`BE-22`). Decir menos que esto haría
          creer que ya puede competir.
        */}
        <p role="status" className={clasesDeTarjeta({ densidad: 'amplia' })}>
          Tu alta como{' '}
          <strong>
            {borrador.lastName}, {borrador.firstName}
          </strong>{' '}
          quedó <strong>pendiente de que el club la revise</strong>. Una vez aprobada vas a poder
          sumarte a un torneo.
        </p>

        <Link to="/" className="underline">
          Volver al inicio
        </Link>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="pt-6">
        <h1 className="font-[var(--font-display)] text-[var(--text-display)] font-bold">
          Sumarte al padrón
        </h1>
        <p className="pt-1 text-[var(--ink-muted)]">
          Completá tus datos. Un admin del club revisa cada alta antes de que quede disponible para
          anotarte a un torneo.
        </p>
      </div>

      <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="apellido" className="text-sm font-medium">
            Apellido
          </label>
          <input
            id="apellido"
            name="lastName"
            type="text"
            autoComplete="family-name"
            value={borrador.lastName}
            onChange={(e) => setBorrador({ ...borrador, lastName: e.target.value })}
            className="min-h-[44px] px-3 rounded-[var(--radius-md)] border bg-[var(--surface)]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nombre" className="text-sm font-medium">
            Nombre
          </label>
          <input
            id="nombre"
            name="firstName"
            type="text"
            autoComplete="given-name"
            value={borrador.firstName}
            onChange={(e) => setBorrador({ ...borrador, firstName: e.target.value })}
            className="min-h-[44px] px-3 rounded-[var(--radius-md)] border bg-[var(--surface)]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="dni" className="text-sm font-medium">
            DNI
          </label>
          {/*
            Sólo dígitos, como el PIN de patrulla en WAFL: filtrar al tipear
            evita el error de formato en vez de explicarlo después.

            Sin `maxLength` a propósito: el atributo nativo trunca el valor
            **crudo** antes de que este `onChange` lo filtre, así que tipear
            "30ab123cd456" con `maxLength={8}` corta en el octavo carácter
            crudo ("30ab123c") y deja sólo 5 dígitos tras filtrar las letras.
            El tope de 8 ya lo pone el `.slice(0, 8)` de abajo, sobre el valor
            ya filtrado.
          */}
          <input
            id="dni"
            name="dni"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={borrador.dni}
            onChange={(e) =>
              setBorrador({ ...borrador, dni: e.target.value.replace(/\D/g, '').slice(0, 8) })
            }
            className="min-h-[44px] px-3 rounded-[var(--radius-md)] border bg-[var(--surface)]"
          />
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium">Sexo</legend>
          <div className="flex gap-2">
            {SEXES.map((sexo) => (
              <label
                key={sexo}
                className={cn(
                  'flex-1 min-h-[44px] flex items-center justify-center rounded-[var(--radius-md)] border cursor-pointer',
                  borrador.sex === sexo && 'bg-[var(--nock)] text-[var(--nock-ink)] font-semibold',
                )}
              >
                <input
                  type="radio"
                  name="sexo"
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

        <div className="flex flex-col gap-1.5">
          <label htmlFor="categoria" className="text-sm font-medium">
            Categoría
          </label>
          <select
            id="categoria"
            value={borrador.category}
            onChange={(e) => setBorrador({ ...borrador, category: e.target.value as BowCategory })}
            className="min-h-[44px] px-3 rounded-[var(--radius-md)] border bg-[var(--surface)]"
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

        <button
          type="submit"
          disabled={enviando}
          className="min-h-[56px] rounded-[var(--radius-lg)] bg-[var(--nock)] text-[var(--nock-ink)] font-semibold text-lg disabled:opacity-60"
        >
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
    </Screen>
  );
}
