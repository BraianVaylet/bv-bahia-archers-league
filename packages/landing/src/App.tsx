/**
 * Sitio público.
 *
 * **Sin service worker**: es una página de lectura que tiene que abrir rápido en
 * un celular con señal mala, y no debe arrastrar el bundle de administración.
 *
 * Ver `docs/ARCHITECTURE.md` §3.
 */

import { Footer } from '@bal/ui';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Encabezado } from './components/ui.js';
import { ArcherPage } from './pages/Archer.js';
import { HomePage } from './pages/Home.js';
import { RankingPage } from './pages/Ranking.js';
import { TournamentPage, TournamentsPage } from './pages/Tournaments.js';

export function App() {
  return (
    <BrowserRouter>
      {/*
        Header arriba, pie abajo, y **sólo el medio scrollea**.

        `h-dvh` y no `min-h-dvh`: con el mínimo, la página crece y los dos se
        van con el scroll. Y `dvh` y no `vh` porque en un celular `vh` mide la
        ventana con la barra del navegador retraída, así que sobra alto justo
        abajo, que es donde está el pie.
      */}
      <div className="flex flex-col h-dvh overflow-hidden">
        <Encabezado />

        <main className="flex-1 min-h-0 overflow-y-auto">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/ranking" element={<RankingPage />} />
            <Route path="/torneos" element={<TournamentsPage />} />
            <Route path="/torneos/:id" element={<TournamentPage />} />
            <Route path="/arqueros/:id" element={<ArcherPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Uno solo para todo el sitio: es una app de lectura con una sola
            columna, y el pie es el mismo en las cinco páginas. */}
        <Footer className="shrink-0 mt-0" />
      </div>
    </BrowserRouter>
  );
}
