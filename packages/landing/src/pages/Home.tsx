/**
 * Introducción del sitio público.
 *
 * Lo primero que hace falta el día del torneo es **entrar a anotar**, así que el
 * acceso a WAFL va arriba de todo y bien grande. Todo lo demás puede esperar.
 *
 * Ver `docs/FUNCTIONAL.md` §5.1.
 */

import ilustracion from '@bal/shared/assets/arqueria.svg';
import { Link } from 'react-router-dom';
import { Screen } from '../components/ui.js';

export function HomePage() {
  return (
    <Screen>
      {/* Dibujada, no fotografiada: la CSP prohíbe pedidos externos y una foto
          que entrara en el presupuesto de la landing se vería mal. Pesa 2 KB y
          acompaña el tema. */}
      <img src={ilustracion} alt="" className="w-full max-w-md mx-auto pt-6 text-[var(--ink)]" />

      <div>
        <h1 className="font-[var(--font-display)] text-[var(--text-display)] font-bold">
          Liga Bahiense de Arquería
        </h1>
        <p className="pt-1 text-[var(--ink-muted)]">
          Club Bahiense de Arquería · Bahía Blanca. Resultados, rankings y estadísticas de la
          temporada.
        </p>
      </div>

      <nav className="flex flex-col gap-3">
        {/* El líder de patrulla entra por acá, con guantes y apurado. */}
        <a
          href="/app/wafl"
          className="min-h-[56px] flex items-center justify-center rounded-[var(--radius-lg)] bg-[var(--nock)] text-[var(--nock-ink)] font-semibold text-lg"
        >
          Anotar puntajes (líder de patrulla)
        </a>

        <a
          href="/app/wafa"
          className="min-h-[44px] flex items-center justify-center rounded-[var(--radius-md)] border bg-[var(--surface)]"
        >
          Administración
        </a>
      </nav>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/ranking"
          className="rounded-[var(--radius-lg)] border p-4 bg-[var(--surface)] block"
        >
          <h2 className="font-semibold">Ranking de la liga</h2>
          <p className="text-sm text-[var(--ink-muted)]">
            Por categoría, por puntos y por mejor porcentaje.
          </p>
        </Link>

        <Link
          to="/torneos"
          className="rounded-[var(--radius-lg)] border p-4 bg-[var(--surface)] block"
        >
          <h2 className="font-semibold">Torneos</h2>
          <p className="text-sm text-[var(--ink-muted)]">
            Fechas disputadas, podios y estadísticas.
          </p>
        </Link>
      </div>
    </Screen>
  );
}
