/**
 * Shell de la PWA.
 *
 * Dos aplicaciones en un mismo build, bajo el scope `/app/` del service worker:
 * WAFA para el admin y WAFL para el líder de patrulla.
 *
 * Ver `docs/ARCHITECTURE.md` §2.
 */

import { useTituloDePagina } from '@bal/ui';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { InstalarApp } from './components/InstalarApp.js';
import { NavegacionAccesible } from './components/NavegacionAccesible.js';
import { RegistroDeVersion } from './components/registroDeVersion.js';
import { botonClases, Screen } from './components/ui.js';
import { VolverALaLiga } from './components/VolverALaLiga.js';

/**
 * Las dos apps se cargan **cuando se entra a ellas** (`REF6-8` / `P-5`).
 *
 * Con el `import` estático, el líder de patrulla —que tiene la peor señal de todo el
 * torneo— bajaba el panel completo del administrador, y el admin bajaba el scoring.
 * `docs/TECHNICAL.md` §5 lo pide: «entrar como líder no descarga el código de
 * administración».
 *
 * Sin señal sigue funcionando: el service worker precachea **todos** los `.js` del
 * build, los de cada app incluidos, al instalarse.
 */
const WafaApp = lazy(() => import('./wafa/WafaApp.js').then((m) => ({ default: m.WafaApp })));
const WaflApp = lazy(() => import('./wafl/WaflApp.js').then((m) => ({ default: m.WaflApp })));

/** Lo que se ve mientras baja el chunk de la app elegida: casi nada, y en español. */
function Cargando() {
  return (
    <Screen>
      <p role="status" className="pt-12 text-[var(--ink-muted)]">
        Cargando…
      </p>
    </Screen>
  );
}

/** El service worker está montado en `/app/`, así que el router también. */
const BASENAME = '/app';

function Elegir() {
  useTituloDePagina();
  return (
    <Screen>
      <div className="pt-12 pb-4">
        <h1 className="font-display text-[var(--text-display)] font-bold">
          Liga Bahiense de Arquería
        </h1>
      </div>

      <Link to="/wafl" className={botonClases({ ancho: true })}>
        Soy líder de patrulla
      </Link>

      <Link to="/wafa" className={botonClases({ variante: 'secundario', ancho: true })}>
        Soy administrador
      </Link>

      {/*
        La salida al sitio público.

        Va **después** de los dos roles: quien abre `/app/` viene a entrar, no a
        mirar resultados. Pero sin esto la pantalla es un callejón para el que
        llegó por error — y desde `ref-3` el botón Atrás ya no saca de la app.

        `enlaceEntreApps` porque en producción la landing es `/` y con
        `pnpm dev` es otro puerto.
      */}
      <VolverALaLiga />

      <InstalarApp />
    </Screen>
  );
}

export function App() {
  return (
    <>
      <BrowserRouter basename={BASENAME}>
        <NavegacionAccesible />
        <Suspense fallback={<Cargando />}>
          <Routes>
            <Route path="/" element={<Elegir />} />
            <Route path="/wafl/*" element={<WaflApp />} />
            <Route path="/wafa/*" element={<WafaApp />} />
          </Routes>
        </Suspense>
      </BrowserRouter>

      {/*
        **Afuera del router, y no por comodidad.**

        Que haya versión nueva no depende de en qué pantalla esté el usuario, y
        montarlo por ruta lo desmontaría al navegar — perdiendo el «ahora no»
        que acaba de elegir.

        Y hay un motivo más fuerte: `BrowserRouter` con un `basename` que no
        coincide con la URL **no renderiza absolutamente nada**, ni siquiera los
        hijos que no son rutas. Hoy la PWA siempre se sirve bajo `/app/`, así
        que coincide; pero atar el aviso de actualización a que el routing esté
        bien configurado es acoplar dos cosas que no tienen nada que ver.
      */}
      <RegistroDeVersion />
    </>
  );
}
