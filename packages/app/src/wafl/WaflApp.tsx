/**
 * WAFL — la app del líder de patrulla.
 *
 * La navegación es **estado local, no rutas**: el recorrido es lineal (circuito →
 * blanco → circuito → resultados → firma) y el botón Atrás del navegador no
 * debería poder sacar al líder del medio de una carga.
 *
 * Ver `docs/FUNCTIONAL.md` §7.
 */

import { enlaceEntreApps } from '@bal/shared';
import { useEffect, useState } from 'react';
import { useSalidaBloqueada } from '../components/useSalidaBloqueada.js';
import type { BundleTarget, StoredBundle } from '../offline/db.js';
import { startSyncWorker } from '../offline/syncWorker.js';
import { CircuitPage } from './CircuitPage.js';
import { LoginPage } from './LoginPage.js';
import { ResultsPage } from './ResultsPage.js';
import { logout } from './sesion.js';
import { TargetPage } from './TargetPage.js';

/**
 * Se resuelve una sola vez, al cargar el módulo: el origen no cambia mientras
 * la app está abierta.
 */
const A_LA_LANDING = enlaceEntreApps('landing', import.meta.env.DEV, window.location.href);

type Vista =
  | { readonly nombre: 'circuito' }
  | { readonly nombre: 'blanco'; readonly target: BundleTarget }
  | { readonly nombre: 'resultados' }
  | { readonly nombre: 'cerrado' };

export function WaflApp() {
  const [bundle, setBundle] = useState<StoredBundle>();
  const [vista, setVista] = useState<Vista>({ nombre: 'circuito' });

  /**
   * Los disparadores de sincronización arrancan con la app.
   *
   * Sin esto no hay evento `online`, ni intervalo, ni conteo inicial de
   * pendientes: el outbox se llena y no sale nunca, y el indicador se queda
   * diciendo «Sincronizado». Lo encontró el E2E; ver `BITACORA.md`.
   */
  useEffect(() => startSyncWorker(), []);

  /**
   * **Con sesión, Atrás no saca de la app.**
   *
   * La navegación de WAFL es estado local, así que un solo toque de Atrás
   * mandaba a la pantalla de elección — y volver significaba loguearse otra
   * vez, con el PIN de la planilla, en medio del recorrido. La única salida es
   * cerrar sesión.
   */
  useSalidaBloqueada(bundle !== undefined);

  if (!bundle) return <LoginPage onEntro={setBundle} />;

  const cerrarSesion = async () => {
    await logout();
    setBundle(undefined);
    setVista({ nombre: 'circuito' });
  };

  const alCircuito = () => setVista({ nombre: 'circuito' });

  switch (vista.nombre) {
    case 'blanco':
      return (
        <TargetPage
          target={vista.target}
          participants={bundle.participants}
          onContinuar={alCircuito}
          onVolver={alCircuito}
        />
      );

    case 'resultados':
      return (
        <ResultsPage
          bundle={bundle}
          onVolver={alCircuito}
          onCerrado={() => setVista({ nombre: 'cerrado' })}
        />
      );

    case 'cerrado':
      return (
        <div className="mx-auto w-full max-w-lg px-4 pt-16 text-center flex flex-col gap-4">
          <p className="font-[var(--font-display)] text-[var(--text-display)] font-bold">
            Torneo finalizado
          </p>
          <p className="text-[var(--ink-muted)]">
            Ya está. Los puntajes de tu patrulla quedaron firmados y enviados.
          </p>

          {/* La app de la patrulla no tiene nada más que ofrecer: de acá en
              adelante lo que importa son los resultados, que están en la
              landing. Sin salida, la pantalla es un callejón.

              El enlace no puede ser `/` a secas: en producción sí es la
              landing, pero con `pnpm dev` son dos Vite en puertos distintos y
              se quedaba dentro de la propia PWA. Ver `enlaceEntreApps`. */}
          <a
            href={A_LA_LANDING}
            className="min-h-[52px] px-5 rounded-[var(--radius-md)] bg-[var(--nock)] text-[var(--nock-ink)] font-semibold flex items-center justify-center"
          >
            Ver los resultados de la liga
          </a>
        </div>
      );

    default:
      return (
        <CircuitPage
          bundle={bundle}
          onAbrirBlanco={(target) => setVista({ nombre: 'blanco', target })}
          onResultados={() => setVista({ nombre: 'resultados' })}
          onCerrarSesion={() => void cerrarSesion()}
        />
      );
  }
}
