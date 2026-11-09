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
import { NavegacionAccesible } from './components/NavegacionAccesible.js';
import { A_LA_APP, Encabezado, EnlaceInterno } from './components/ui.js';
import { ProveedorDeTemporadas, useTemporadaActiva } from './lib/temporada.js';
import { ArcherPage } from './pages/Archer.js';
import { ArcherRegisterPage } from './pages/ArcherRegister.js';
import { HomePage } from './pages/Home.js';
import { RankingPage } from './pages/Ranking.js';
import { ScorecardPage } from './pages/Scorecard.js';
import { TournamentPage, TournamentsPage } from './pages/Tournaments.js';

/** El pie, con la temporada activa que comparte `ProveedorDeTemporadas`. */
function PieDelSitio() {
  const temporada = useTemporadaActiva();
  return <Footer enlace={EnlaceInterno} hrefApp={A_LA_APP} temporada={temporada?.name ?? null} />;
}

export function App() {
  return (
    <ProveedorDeTemporadas>
      <BrowserRouter>
        <NavegacionAccesible />

        {/*
        **Un documento, no una app** (`REF7-5` / `L-2`). Scrollea la página entera: el encabezado
        es sticky y el pie va al final, después del contenido.

        Hasta `REF7-5` era `h-dvh overflow-hidden` con el medio scrolleando entre un encabezado y
        un pie fijos, como la PWA. En una landing eso no tiene sentido y el pie se comía ~80px de
        alto útil. `min-h-dvh` + `flex-1` en el `main` sólo hace que, en una página corta, el pie
        quede abajo de la ventana en vez de flotar en el medio.

        Al navegar, `useAlCambiarDeRuta` lleva la ventana arriba: no hay contenedor de scroll.
      */}
        <div className="min-h-dvh flex flex-col">
          <Encabezado />

          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/alta" element={<ArcherRegisterPage />} />
              <Route path="/ranking" element={<RankingPage />} />
              <Route path="/torneos" element={<TournamentsPage />} />
              <Route path="/torneos/:id" element={<TournamentPage />} />
              <Route path="/torneos/:id/participantes/:participantId" element={<ScorecardPage />} />
              <Route path="/arqueros/:id" element={<ArcherPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          {/* Uno solo para todo el sitio, al final del documento. */}
          <PieDelSitio />
        </div>
      </BrowserRouter>
    </ProveedorDeTemporadas>
  );
}
