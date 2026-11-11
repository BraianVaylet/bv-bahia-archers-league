/**
 * Qué manda el formulario de «Editar» de la ficha (`FE-32`).
 *
 * Fuera del componente porque es lógica, no dibujo (y adentro le subía la complejidad por encima
 * de lo que acepta Biome): **sólo lo que el estado permite** (`camposEditables`, `SH-11`) **y lo
 * que cambió**. El servidor rechaza el pedido entero si sobra un campo (`BE-24`), y el audit log no
 * tiene por qué anotar un cambio que no hubo.
 */

import { camposEditables } from '@bal/shared';
import { linkParaEnviar } from '../wizard.js';
import type { Torneo } from './useTorneo.js';

const SIN_PAGO = { required: false, amount: 0 } as const;

export interface CuerpoDeEdicion {
  name: string;
  date: string;
  registrationUrl?: string | null;
  description?: string;
  payment?: { required: boolean; amount: number };
}

/** El cuerpo del `PATCH`: `torneo` es lo que hay guardado, `editando` lo que tiene el formulario. */
export function cuerpoDeEdicion(torneo: Torneo, editando: Torneo): CuerpoDeEdicion {
  const editables = camposEditables(torneo.status);
  const cuerpo: CuerpoDeEdicion = {
    name: editando.name.trim(),
    date: editando.date.slice(0, 10),
  };

  const link = linkParaEnviar(editando.registrationUrl ?? '');
  if (editables.has('registrationUrl') && link !== (torneo.registrationUrl ?? null)) {
    cuerpo.registrationUrl = link;
  }

  const descripcion = (editando.description ?? '').trim();
  if (editables.has('description') && descripcion !== (torneo.description ?? '').trim()) {
    cuerpo.description = descripcion;
  }

  const antes = torneo.payment ?? SIN_PAGO;
  const pago = editando.payment ?? antes;
  if (
    editables.has('payment') &&
    (pago.required !== antes.required || pago.amount !== antes.amount)
  ) {
    cuerpo.payment = { ...pago };
  }

  return cuerpo;
}

/** Se marcó que se cobra pero falta el monto (en un estado que edita el pago). */
export function faltaElMonto(editando: Torneo): boolean {
  const pago = editando.payment;
  return (
    camposEditables(editando.status).has('payment') && pago?.required === true && !(pago.amount > 0)
  );
}
