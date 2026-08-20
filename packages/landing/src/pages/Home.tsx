/**
 * Introducción del sitio público.
 *
 * Lo primero que hace falta el día del torneo es **entrar**, así que el acceso a
 * la PWA va arriba de todo y bien grande. Todo lo demás puede esperar.
 *
 * Ver `docs/FUNCTIONAL.md` §5.1.
 */

import { enlaceEntreApps } from '@bal/shared';
import portada from '@bal/shared/assets/portada.webp';
import { Link } from 'react-router-dom';
import { clasesDeTarjeta, cn, Screen } from '../components/ui.js';

/** En producción es `/app/`; con `pnpm dev`, el Vite de la PWA. */
const A_LA_APP = enlaceEntreApps('app', import.meta.env.DEV, window.location.href);

export function HomePage() {
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
        <h1 className="font-[var(--font-display)] text-[var(--text-display)] font-bold">
          Liga Bahiense de Arquería
        </h1>
        <p className="pt-1 text-[var(--ink-muted)]">
          Club Bahiense de Arquería · Bahía Blanca. Resultados, rankings y estadísticas de la
          temporada.
        </p>
      </div>

      {/*
        **Una sola puerta.** Antes había dos botones —«Anotar puntajes» y
        «Administración»— y obligaban a la landing a explicar una división que
        no es suya: quién sos lo pregunta la app, que ya tiene esa pantalla.

        Dos botones acá significaban además dos lugares donde mantener el
        nombre de cada rol, y ya se habían separado del que usa la app
        («Anotar puntajes» contra «Soy líder de patrulla»).

        El costo es un toque más para el líder de patrulla el día del torneo.
        Se acepta porque entra una vez y después la PWA queda instalada, que
        abre directo en `/app/`.
      */}
      <nav className="flex flex-col gap-3">
        <a
          href={A_LA_APP}
          className="min-h-[56px] flex items-center justify-center rounded-[var(--radius-lg)] bg-[var(--nock)] text-[var(--nock-ink)] font-semibold text-lg"
        >
          Ingresar
        </a>
        <p className="text-sm text-[var(--ink-muted)] text-center">
          Para líderes de patrulla y administración.
        </p>
      </nav>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/ranking" className={cn(clasesDeTarjeta({ densidad: 'amplia' }), 'block')}>
          <h2 className="font-semibold">Ranking de la liga</h2>
          <p className="text-sm text-[var(--ink-muted)]">
            Por categoría, por puntos y por mejor porcentaje.
          </p>
        </Link>

        <Link to="/torneos" className={cn(clasesDeTarjeta({ densidad: 'amplia' }), 'block')}>
          <h2 className="font-semibold">Torneos</h2>
          <p className="text-sm text-[var(--ink-muted)]">
            Fechas disputadas, podios y estadísticas.
          </p>
        </Link>
      </div>
    </Screen>
  );
}
