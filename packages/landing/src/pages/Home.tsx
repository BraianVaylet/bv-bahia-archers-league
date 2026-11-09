/**
 * Introducción del sitio público.
 *
 * **El acceso a la PWA ya no está acá** (`REF7-5` / `L-4`): vive en el
 * encabezado, en todas las páginas (`Encabezado`). Sigue siendo una sola puerta
 * —quién sos lo pregunta la app—; lo que cambió es dónde está. La portada nueva
 * llega con `REF7-6`.
 *
 * Ver `docs/FUNCTIONAL.md` §5.1.
 */

import { useTituloDePagina } from '@bal/ui';
import portada from '@bal/ui/assets/portada.webp';
import { Link } from 'react-router-dom';
import { clasesDeTarjeta, cn, Screen } from '../components/ui.js';

export function HomePage() {
  useTituloDePagina('Resultados y ranking');
  return (
    <Screen>
      {/*
        La foto de portada, ya optimizada por `scripts/imagenes.mjs`: el
        original pesa 2,7 MB y esto 131 KB.

        `alt` vacío porque es decorativa: el título de abajo dice de qué liga se
        trata. Con `alt` describiéndola, un lector de pantalla leería una
        descripción de la foto antes del nombre de la liga.

        Carga **eager** y con `width`/`height`: es lo primero que se ve, y sin
        dimensiones el texto salta cuando la imagen llega — en un celular con
        señal mala eso pasa siempre.
      */}
      <img
        src={portada}
        alt=""
        width={1120}
        height={630}
        className="w-full rounded-[var(--radius-lg)] mt-6 aspect-[16/9] object-cover"
      />

      <div>
        <h1 className="font-display text-display font-bold">Liga Bahiense de Arquería</h1>
        <p className="pt-1 text-[var(--ink-muted)]">
          Club Bahiense de Arquería · Bahía Blanca. Resultados, rankings y estadísticas de la
          temporada.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/ranking" className={cn(clasesDeTarjeta({ densidad: 'amplia' }), 'block')}>
          <h2 className="font-semibold">Ranking de la liga</h2>
          <p className="text-sm text-[var(--ink-muted)]">Por categoría, mejor de N torneos.</p>
        </Link>

        <Link to="/torneos" className={cn(clasesDeTarjeta({ densidad: 'amplia' }), 'block')}>
          <h2 className="font-semibold">Torneos</h2>
          <p className="text-sm text-[var(--ink-muted)]">
            Fechas disputadas, podios y estadísticas.
          </p>
        </Link>

        {/* Alta pública (`FE-27`): no inscribe a nada, queda pendiente de que
            el club la apruebe. Va acá y no en el header: es una acción puntual,
            no un destino que alguien visite seguido. */}
        <Link
          to="/alta"
          className={cn(clasesDeTarjeta({ densidad: 'amplia' }), 'block sm:col-span-2')}
        >
          <h2 className="font-semibold">Sumarte al padrón</h2>
          <p className="text-sm text-[var(--ink-muted)]">
            Dejá tus datos. El club revisa cada alta antes de habilitarla.
          </p>
        </Link>
      </div>
    </Screen>
  );
}
