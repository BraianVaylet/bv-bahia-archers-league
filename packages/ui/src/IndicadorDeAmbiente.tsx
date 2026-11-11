/**
 * La barra «estás en modo desarrollo», de lado a lado, arriba del encabezado de la landing, WAFA
 * y WAFL. En producción no se dibuja nada.
 *
 * **De dónde sale el ambiente.** No del build: `vite build` corre siempre en modo `production` y
 * la imagen de Docker es la misma para los dos ambientes de Railway, que sólo difieren en el
 * `NODE_ENV` del contenedor. Lo escribe en el `<html>` quien entrega el documento:
 *
 * - en Railway, la API (`packages/api/src/middleware/estaticos.ts`, `marcarAmbiente`);
 * - en `pnpm dev`, el Vite de cada frontend (`vite.config.ts`, plugin `ambiente-de-desarrollo`).
 *
 * **Sin fetch.** La UI de WAFL no lee de respuestas HTTP y tiene que arrancar sin red: su
 * `index.html` es el que precacheó el service worker, y el ambiente viaja adentro.
 *
 * **El alto lo reserva el CSS**, no este componente: `tokens.css` define
 * `--reserva-aviso-de-ambiente` a partir del mismo atributo, y las pantallas de alto fijo
 * (`h-dvh` en la PWA) lo descuentan. Así no hay un frame con la pantalla corrida.
 *
 * Colores de `monte`: una banda oscura en los dos temas, que no se confunde con el encabezado ni
 * con una estaca (semántica reservada) ni con un error (`--danger`). No tiene nada que tocar.
 */

/** El atributo del `<html>` que dice en qué ambiente corre el servidor que entregó la página. */
const ATRIBUTO = 'data-ambiente';

/** El ambiente que escribió en el documento quien lo sirvió, o `null` si no dice. */
export function leerAmbiente(): string | null {
  if (typeof document === 'undefined') return null;
  return document.documentElement.getAttribute(ATRIBUTO);
}

export interface IndicadorDeAmbienteProps {
  /** Por omisión, el del documento. Existe para las pruebas y para quien ya lo sepa. */
  readonly ambiente?: string | null;
}

export function IndicadorDeAmbiente({ ambiente = leerAmbiente() }: IndicadorDeAmbienteProps) {
  // Sólo `development`: ante un valor desconocido, o ninguno, no se avisa nada. Una barra de
  // desarrollo en producción alarmaría a quien está compitiendo.
  if (ambiente !== 'development') return null;

  return (
    <div
      data-indicador-ambiente
      className="w-full h-[var(--alto-aviso-de-ambiente)] shrink-0 flex items-center justify-center px-4 bg-[var(--monte)] text-[var(--monte-accent)] border-b border-[var(--monte-accent)] font-mono text-eyebrow uppercase print:hidden"
    >
      <span className="truncate">Estás en modo desarrollo</span>
    </div>
  );
}
