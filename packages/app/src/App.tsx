/**
 * Shell de la PWA.
 *
 * Dos aplicaciones en un mismo build, bajo el scope `/app/` del service worker:
 * WAFA para el admin y WAFL para el líder de patrulla.
 *
 * Ver `docs/ARCHITECTURE.md` §2.
 */

import { enlaceEntreApps } from '@bal/shared';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { InstalarApp } from './components/InstalarApp.js';
import { RegistroDeVersion } from './components/registroDeVersion.js';
import { Button, Screen } from './components/ui.js';
import { WafaApp } from './wafa/WafaApp.js';
import { WaflApp } from './wafl/WaflApp.js';

/** El service worker está montado en `/app/`, así que el router también. */
const BASENAME = '/app';

/** En producción es la raíz; con `pnpm dev`, el Vite de la landing. */
const A_LA_LANDING = enlaceEntreApps('landing', import.meta.env.DEV, window.location.href);

function Elegir() {
  return (
    <Screen>
      <div className="pt-12 pb-4">
        <h1 className="font-[var(--font-display)] text-[var(--text-display)] font-bold">
          Liga Bahiense de Arquería
        </h1>
      </div>

      <Link to="/wafl">
        <Button ancho>Soy líder de patrulla</Button>
      </Link>

      <Link to="/wafa">
        <Button variante="secundario" ancho>
          Soy administrador
        </Button>
      </Link>

      {/*
        La salida al sitio público.

        Va **después** de los dos roles: quien abre `/app/` viene a entrar, no a
        mirar resultados. Pero sin esto la pantalla es un callejón para el que
        llegó por error — y desde `ref-3` el botón Atrás ya no saca de la app.

        `enlaceEntreApps` porque en producción la landing es `/` y con
        `pnpm dev` es otro puerto.
      */}
      <a
        href={A_LA_LANDING}
        className="min-h-[44px] flex items-center justify-center text-[var(--ink-muted)] underline"
      >
        Ver resultados y rankings
      </a>

      <InstalarApp />
    </Screen>
  );
}

export function App() {
  return (
    <>
      <BrowserRouter basename={BASENAME}>
        <Routes>
          <Route path="/" element={<Elegir />} />
          <Route path="/wafl/*" element={<WaflApp />} />
          <Route path="/wafa/*" element={<WafaApp />} />
        </Routes>
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
