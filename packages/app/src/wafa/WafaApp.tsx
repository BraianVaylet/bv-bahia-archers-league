/**
 * WAFA — la app del administrador.
 *
 * **La guarda vive acá, en un solo lugar.** Repartir el chequeo de
 * `mustChangePassword` por cada pantalla garantiza que alguna se lo olvide; con
 * una sola puerta, no hay ruta que se escape.
 *
 * Ver `docs/FUNCTIONAL.md` §6 · `docs/SECURITY.md` §3.1.
 */

import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Screen } from '../components/ui.js';
import { ArchersPage } from './pages/Archers.js';
import { ChangePasswordPage } from './pages/ChangePassword.js';
import { HomePage } from './pages/Home.js';
import { LoginPage } from './pages/Login.js';
import { PatrolsPage } from './pages/Patrols.js';
import { PaymentsPage } from './pages/Payments.js';
import { PublishPage } from './pages/Publish.js';
import { RankingPage } from './pages/Ranking.js';
import { SeasonsPage } from './pages/Seasons.js';
import { TournamentPage } from './pages/Tournament.js';
import { TournamentCreatePage } from './pages/TournamentCreate.js';
import { useSesionAdmin } from './sesion.js';

export function WafaApp() {
  const { sesion, refrescar, salir } = useSesionAdmin();
  const navigate = useNavigate();

  // Sin esto la primera pintada mandaría al login a alguien que ya tiene sesión.
  if (sesion.estado === 'cargando') {
    return (
      <Screen>
        <p className="pt-10 text-[var(--ink-muted)]">Cargando…</p>
      </Screen>
    );
  }

  if (sesion.estado === 'anonimo') {
    return <LoginPage onEntro={refrescar} />;
  }

  /**
   * Cambio obligatorio: **ninguna otra ruta existe** mientras esté pendiente.
   * No se redirige desde cada pantalla; directamente no se montan las rutas.
   */
  if (sesion.admin.mustChangePassword) {
    return <ChangePasswordPage obligatorio onCambiado={refrescar} />;
  }

  const alInicio = () => navigate('/wafa');

  return (
    <Routes>
      <Route path="/" element={<HomePage onSalir={() => void salir()} />} />
      <Route path="/arqueros" element={<ArchersPage onVolver={alInicio} />} />
      <Route path="/temporadas" element={<SeasonsPage onVolver={alInicio} />} />
      <Route path="/ranking" element={<RankingPage onVolver={alInicio} />} />
      {/* Recién creado el torneo se va derecho a las patrullas: es lo primero
          que el admin quiere revisar, y lo único editable antes de arrancar. */}
      <Route
        path="/torneos/nuevo"
        element={
          <TournamentCreatePage
            onVolver={alInicio}
            onCreado={(idTorneo) => navigate(`/wafa/torneos/${idTorneo}/patrullas`)}
          />
        }
      />
      <Route path="/torneos/:id" element={<TournamentPage onVolver={alInicio} />} />
      <Route path="/torneos/:id/patrullas" element={<PatrolsPage onVolver={alInicio} />} />
      <Route path="/torneos/:id/publicar" element={<PublishPage onVolver={alInicio} />} />
      <Route path="/torneos/:id/pagos" element={<PaymentsPage onVolver={alInicio} />} />
      <Route
        path="/password"
        element={
          <ChangePasswordPage obligatorio={false} onCambiado={alInicio} onCancelar={alInicio} />
        }
      />
      <Route path="*" element={<Navigate to="/wafa" replace />} />
    </Routes>
  );
}
