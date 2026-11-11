/**
 * El indicador de carga de WAFA y WAFL: **uno solo**, para que todas las esperas se vean igual.
 *
 * Antes había un «Cargando…» gris suelto en cinco pantallas, sin decir qué cargaba ni anunciarse,
 * y otras seis que se quedaban en blanco hasta que llegaba la respuesta.
 *
 * Tres decisiones:
 *
 * - **Demora antes de mostrar nada** (`DEMORA_DE_CARGA_MS`). La mayoría de las cargas son
 *   instantáneas: el chunk de la app sale de la caché del service worker, y WAFL lee de IndexedDB.
 *   Un indicador que aparece y desaparece en 40 ms es un parpadeo, no información. Si la espera es
 *   real, aparece; si no, no se ve nunca.
 * - **Dice qué se está cargando.** «Cargando el padrón…», no «Cargando…».
 * - **El esqueleto tiene la forma del contenido** —tarjetas en una lista, título y bloque en un
 *   detalle—, así lo que llega cae en el mismo lugar en vez de empujar la pantalla. Está oculto
 *   para el lector de pantalla, que oye el texto, y su pulso sólo corre con movimiento permitido.
 *
 * **No es un indicador de guardado.** Anotar un puntaje no espera nada (`docs/OFFLINE_SYNC.md` §12):
 * esto se usa para *leer*, nunca después de tocar una flecha.
 */

import { useEffect, useState } from 'react';
import { clasesDeTarjeta, cn } from './ui.js';

/**
 * Cuánto se espera antes de mostrar el indicador. Por debajo de ~200 ms una carga se percibe como
 * instantánea; por encima de ~300 ms, sin señal de vida, parece colgada.
 */
export const DEMORA_DE_CARGA_MS = 250;

/**
 * - `lista`: tarjetas fantasma, para las listas de torneos, arqueros, temporadas.
 * - `detalle`: un título y un bloque, para la pantalla de un torneo.
 * - `linea`: sólo el texto, para lo que vive dentro de otra cosa (un desplegable, un pie).
 * - `pantalla`: el texto solo, para cuando todavía no hay nada que dibujar (la sesión, el chunk).
 */
export type FormaDeCarga = 'lista' | 'detalle' | 'linea' | 'pantalla';

export interface PropsDeCargando {
  /** Qué se está cargando, como frase entera: «Cargando los torneos…». */
  readonly texto: string;
  readonly forma?: FormaDeCarga;
  /** Cuántas tarjetas fantasma dibuja la forma `lista`. */
  readonly filas?: number;
}

/** `true` pasada la demora. El temporizador se cancela si el componente se va antes. */
function usePasoLaDemora(): boolean {
  const [paso, setPaso] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPaso(true), DEMORA_DE_CARGA_MS);
    return () => clearTimeout(t);
  }, []);

  return paso;
}

/** Un renglón fantasma. `--surface-2` es neutro: ningún color con significado (ni de estaca). */
function Barra({ className }: { readonly className: string }) {
  return (
    <span className={cn('block rounded-[var(--radius-sm)] bg-[var(--surface-2)]', className)} />
  );
}

function Esqueleto({
  forma,
  filas,
}: {
  readonly forma: 'lista' | 'detalle';
  readonly filas: number;
}) {
  const clases = 'flex flex-col gap-3 motion-safe:animate-pulse';

  if (forma === 'detalle') {
    return (
      // `pt-2`, como el `h1` de las pantallas de detalle: el título llega donde estaba su fantasma.
      <div data-testid="esqueleto" aria-hidden="true" className={cn(clases, 'pt-2')}>
        <Barra className="h-8 w-3/5" />
        <Barra className="h-4 w-2/5" />
        <div className={cn(clasesDeTarjeta(), 'flex flex-col gap-2.5')}>
          <Barra className="h-4 w-4/5" />
          <Barra className="h-4 w-3/5" />
          <Barra className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div data-testid="esqueleto" aria-hidden="true" className={clases}>
      {Array.from({ length: filas }, (_, i) => (
        // El índice es la identidad: las tarjetas fantasma no cambian de orden ni de cantidad.
        // biome-ignore lint/suspicious/noArrayIndexKey: ver el comentario de arriba
        <div key={i} className={cn(clasesDeTarjeta(), 'flex flex-col gap-2')}>
          <Barra className="h-4 w-2/3" />
          <Barra className="h-3 w-2/5" />
        </div>
      ))}
    </div>
  );
}

export function Cargando({ texto, forma = 'lista', filas = 3 }: PropsDeCargando) {
  const visible = usePasoLaDemora();

  return (
    // La región existe desde el primer render, vacía: un lector de pantalla anuncia los cambios de
    // una región que ya conocía, no la que aparece de golpe con el texto adentro.
    <div role="status" className={cn('flex flex-col gap-3', forma === 'pantalla' && 'pt-12')}>
      {visible && (
        <>
          {(forma === 'lista' || forma === 'detalle') && <Esqueleto forma={forma} filas={filas} />}
          {/* Sola en la pantalla, la frase es todo lo que hay: va al tamaño del texto, no al de nota. */}
          <p className={cn('text-[var(--ink-muted)]', forma !== 'pantalla' && 'text-sm')}>
            {texto}
          </p>
        </>
      )}
    </div>
  );
}
