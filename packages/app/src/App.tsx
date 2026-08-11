/**
 * Shell de la PWA.
 *
 * Dos aplicaciones en un mismo build, bajo el scope `/app/` del service worker:
 * WAFA para el admin y WAFL para el líder de patrulla.
 *
 * Ver `docs/ARCHITECTURE.md` §2.
 */

import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { Button, Screen } from './components/ui.js';
import { WafaApp } from './wafa/WafaApp.js';
import { WaflApp } from './wafl/WaflApp.js';

/** El service worker está montado en `/app/`, así que el router también. */
const BASENAME = '/app';

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
    </Screen>
  );
}

export function App() {
  return (
    <BrowserRouter basename={BASENAME}>
      <Routes>
        <Route path="/" element={<Elegir />} />
        <Route path="/wafl/*" element={<WaflApp />} />
        <Route path="/wafa/*" element={<WafaApp />} />
      </Routes>
    </BrowserRouter>
  );
}
