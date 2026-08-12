/**
 * Sitio público.
 *
 * **Sin service worker**: es una página de lectura que tiene que abrir rápido en
 * un celular con señal mala, y no debe arrastrar el bundle de administración.
 *
 * Ver `docs/ARCHITECTURE.md` §3.
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Encabezado } from './components/ui.js';
import { ArcherPage } from './pages/Archer.js';
import { HomePage } from './pages/Home.js';
import { RankingPage } from './pages/Ranking.js';
import { TournamentPage, TournamentsPage } from './pages/Tournaments.js';

export function App() {
  return (
    <BrowserRouter>
      <Encabezado />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/torneos" element={<TournamentsPage />} />
        <Route path="/torneos/:id" element={<TournamentPage />} />
        <Route path="/arqueros/:id" element={<ArcherPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
