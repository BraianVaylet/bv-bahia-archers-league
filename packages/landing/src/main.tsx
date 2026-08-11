/**
 * Punto de entrada del sitio público.
 *
 * Scaffold de `INF-2`. Las secciones reales —introducción, rankings, torneos y
 * fichas de arquero— se construyen en `FE-17`..`FE-20`.
 *
 * Ver `docs/FUNCTIONAL.md` §5.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('No se encontró el elemento #root');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
