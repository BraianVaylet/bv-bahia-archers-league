/**
 * Sitio público.
 *
 * **Sin service worker**: es una página de lectura que tiene que abrir rápido en
 * un celular con señal mala, y no debe arrastrar el bundle de administración.
 *
 * Ver `docs/ARCHITECTURE.md` §3.
 */

import { enlaceEntreApps, Footer } from '@bal/ui';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { NavegacionAccesible } from './components/NavegacionAccesible.js';
import { Encabezado, EnlaceInterno } from './components/ui.js';
import { ArcherPage } from './pages/Archer.js';
import { ArcherRegisterPage } from './pages/ArcherRegister.js';
import { HomePage } from './pages/Home.js';
import { RankingPage } from './pages/Ranking.js';
import { ScorecardPage } from './pages/Scorecard.js';
import { TournamentPage, TournamentsPage } from './pages/Tournaments.js';

/** El acceso a la PWA desde el pie: en desarrollo vive en otro puerto. */
const A_LA_APP = enlaceEntreApps('app', import.meta.env.DEV, window.location.href);

export function App() {
  return (
    <BrowserRouter>
      <NavegacionAccesible />

      {/*
        Header arriba, pie abajo, y **sólo el medio scrollea**.

        `h-dvh` y no `min-h-dvh`: con el mínimo, la página crece y los dos se
        van con el scroll. Y `dvh` y no `vh` porque en un celular `vh` mide la
        ventana con la barra del navegador retraída, así que sobra alto justo
        abajo, que es donde está el pie.
      */}
      <div className="flex flex-col h-dvh overflow-hidden">
        <Encabezado />

        <main data-scroll-principal className="flex-1 min-h-0 overflow-y-auto">
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

          {/*
            Uno solo para todo el sitio, y **al final del contenido**, no fijo
            abajo (`REF7-4`): el pie nuevo tiene columnas y fijo se comería
            media pantalla. `REF7-5` saca el alto fijo y la página pasa a ser
            un documento; hasta entonces, el pie scrollea con el medio.
          */}
          <Footer enlace={EnlaceInterno} hrefApp={A_LA_APP} />
        </main>
      </div>
    </BrowserRouter>
  );
}
