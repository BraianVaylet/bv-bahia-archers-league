/**
 * Punto de entrada de la PWA (WAFA + WAFL).
 *
 * Ver `docs/ARCHITECTURE.md` §4 y `docs/DESIGN_SYSTEM.md`.
 */

// Primero, y no por orden alfabético: tiene que evaluarse antes de que cargue
// `@bal/shared` (lo arrastra `./App`). Ver `@bal/shared/src/navegador.ts`.
import '@bal/shared/navegador';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
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
