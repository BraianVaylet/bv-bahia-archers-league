/**
 * Logger estructurado (`REF6-13` / `B-5`).
 *
 * **Una línea JSON por evento**, con la hora, el nivel y un nombre de evento estable. El día del
 * torneo, si la sincronización anda lenta, la pregunta es «cuántas ops trae cada lote, cuánto tarda
 * y cuántas se rechazan»: con texto libre no se puede buscar eso, con campos sí.
 *
 * - **Respeta `LOG_LEVEL`**, que se validaba en `env.ts` sin filtrar nada. Se lee cuando se escribe,
 *   no al importar: así un cambio de configuración (o un test) se nota en la línea siguiente.
 * - **Nunca lanza.** Un log que tira una excepción tira abajo la request que quería contar.
 * - **Cada nivel sale por su `console`**: Railway separa stdout de stderr.
 */

import { env } from '../env.js';

export type Nivel = 'debug' | 'info' | 'warn' | 'error';

const ORDEN: Record<Nivel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type Campos = Readonly<Record<string, unknown>>;

export interface Logger {
  readonly debug: (evento: string, campos?: Campos) => void;
  readonly info: (evento: string, campos?: Campos) => void;
  readonly warn: (evento: string, campos?: Campos) => void;
  readonly error: (evento: string, campos?: Campos) => void;
}

export interface OpcionesDelLogger {
  /** El nivel mínimo que se escribe. Es una función: se consulta en cada línea. */
  readonly nivel: () => Nivel;
  readonly escribir?: (nivel: Nivel, linea: string) => void;
  readonly ahora?: () => Date;
}

/** Un `Error` no se serializa con `JSON.stringify` (sale `{}`): se pasa a sus campos. */
const comoJson = (_clave: string, valor: unknown): unknown =>
  valor instanceof Error ? { name: valor.name, message: valor.message, stack: valor.stack } : valor;

const porConsole: Record<Nivel, (linea: string) => void> = {
  // biome-ignore lint/suspicious/noConsole: el logger es el único lugar donde se escribe a console; el resto de la API pasa por él.
  debug: (l) => console.debug(l),
  info: (l) => console.info(l),
  warn: (l) => console.warn(l),
  error: (l) => console.error(l),
};

export function crearLogger(opciones: OpcionesDelLogger): Logger {
  const {
    nivel: nivelMinimo,
    escribir = (n, l) => porConsole[n](l),
    ahora = () => new Date(),
  } = opciones;

  const emitir = (nivel: Nivel, evento: string, campos: Campos = {}): void => {
    try {
      if (ORDEN[nivel] < ORDEN[nivelMinimo()]) return;

      // Los campos primero: no pueden pisar la hora, el nivel ni el evento.
      const linea = JSON.stringify(
        { ...campos, t: ahora().toISOString(), nivel, evento },
        comoJson,
      );
      escribir(nivel, linea);
    } catch {
      // Campos que no se pueden serializar (referencias circulares): se pierde el detalle, no la línea.
      try {
        escribir(
          nivel,
          JSON.stringify({
            t: ahora().toISOString(),
            nivel,
            evento,
            logError: 'campos no serializables',
          }),
        );
      } catch {
        // Nada más que hacer: un log no puede romper a quien lo llama.
      }
    }
  };

  return {
    debug: (evento, campos) => emitir('debug', evento, campos),
    info: (evento, campos) => emitir('info', evento, campos),
    warn: (evento, campos) => emitir('warn', evento, campos),
    error: (evento, campos) => emitir('error', evento, campos),
  };
}

/** El logger de la API: nivel de `LOG_LEVEL`, salida por `console`. */
export const log: Logger = crearLogger({
  nivel: () => {
    try {
      return env().LOG_LEVEL;
    } catch {
      // Sin configuración válida no hay nivel que leer, y el error de configuración ya lo informa
      // quien arranca. `info` es el valor por defecto de `LOG_LEVEL`.
      return 'info';
    }
  },
});
