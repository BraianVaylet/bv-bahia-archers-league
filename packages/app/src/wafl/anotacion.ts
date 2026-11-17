/**
 * Qué pasa con un toque del teclado, decidido en el momento (`FE-45`).
 *
 * Funciones puras, sin I/O. No son reglas de negocio —el puntaje lo deriva el servidor y lo valida
 * `@bal/shared`—: deciden **a quién** va un toque y qué se ve en pantalla mientras IndexedDB
 * escribe. Antes eso se decidía al final de cada escritura, y los toques que llegaban en el medio
 * iban al arquero ya completo y se descartaban en silencio.
 */

/** Lo que se ve: las flechas de cada arquero en este blanco y a quién se le está anotando. */
export interface EstadoDeAnotacion {
  readonly flechas: ReadonlyMap<string, readonly string[]>;
  readonly seleccionado: string;
}

export interface ContextoDelBlanco {
  /** Los arqueros en el orden en que se muestran: es el orden en que se pasa al siguiente. */
  readonly participantes: readonly string[];
  readonly flechasPorBlanco: number;
  readonly firmados: ReadonlySet<string>;
}

export type ResultadoDeToque =
  | { readonly ok: true; readonly estado: EstadoDeAnotacion; readonly destinatario: string }
  | { readonly ok: false; readonly motivo: 'firmado' | 'completo' };

const cuantas = (estado: EstadoDeAnotacion, id: string) => estado.flechas.get(id)?.length ?? 0;

/** El primero, en el orden de la pantalla, al que todavía le faltan flechas y no firmó. */
export function siguienteQueFalta(
  estado: EstadoDeAnotacion,
  contexto: ContextoDelBlanco,
  excepto: string,
): string | undefined {
  return contexto.participantes.find(
    (id) =>
      id !== excepto &&
      !contexto.firmados.has(id) &&
      cuantas(estado, id) < contexto.flechasPorBlanco,
  );
}

/**
 * Anota un toque al seleccionado y, si con eso lo completa, pasa al siguiente que falte **en el
 * mismo paso**: el toque que viene detrás ya encuentra al arquero correcto.
 */
export function aplicarToque(
  estado: EstadoDeAnotacion,
  token: string,
  contexto: ContextoDelBlanco,
): ResultadoDeToque {
  const destinatario = estado.seleccionado;
  if (contexto.firmados.has(destinatario)) return { ok: false, motivo: 'firmado' };

  const previas = estado.flechas.get(destinatario) ?? [];
  if (previas.length >= contexto.flechasPorBlanco) return { ok: false, motivo: 'completo' };

  const flechas = new Map(estado.flechas).set(destinatario, [...previas, token]);
  const conLaFlecha: EstadoDeAnotacion = { flechas, seleccionado: destinatario };

  const completo = previas.length + 1 === contexto.flechasPorBlanco;
  const siguiente = completo ? siguienteQueFalta(conLaFlecha, contexto, destinatario) : undefined;

  return {
    ok: true,
    destinatario,
    estado: siguiente ? { ...conLaFlecha, seleccionado: siguiente } : conLaFlecha,
  };
}

/** Saca la última flecha de un arquero. No cambia a quién se le está anotando. */
export function aplicarBorrado(
  estado: EstadoDeAnotacion,
  participantId: string,
): EstadoDeAnotacion {
  const previas = estado.flechas.get(participantId) ?? [];
  if (previas.length === 0) return estado;
  return {
    ...estado,
    flechas: new Map(estado.flechas).set(participantId, previas.slice(0, -1)),
  };
}
