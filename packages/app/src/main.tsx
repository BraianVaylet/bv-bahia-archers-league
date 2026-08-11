/**
 * Punto de entrada de la PWA (WAFA + WAFL).
 *
 * Scaffold de `INF-2`. El bootstrap real —Tailwind, tokens del design system,
 * tema claro/oscuro anti-FOUC, service worker con `registerType: 'prompt'` y
 * routing por rol— se construye en `FE-1` y `FE-3`.
 *
 * Ver `docs/ARCHITECTURE.md` §4 y `docs/DESIGN_SYSTEM.md`.
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
