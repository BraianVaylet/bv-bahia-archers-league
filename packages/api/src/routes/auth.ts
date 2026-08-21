/**
 * Rutas de autenticación.
 *
 * Ver `docs/TECHNICAL.md` §3.1.
 */

import {
  AdminLoginSchema,
  ChangePasswordSchema,
  PatrolLoginSchema,
  RecoverAdminSchema,
} from '@bal/shared';
import { Hono } from 'hono';
import { endSession } from '../lib/session.js';
import { currentAdminId, requireAdmin } from '../middleware/auth.js';
import { ensureCsrfCookie } from '../middleware/csrf.js';
import { parseJsonBody } from '../middleware/validate.js';
import * as authService from '../services/authService.js';
import * as patrolAuthService from '../services/patrolAuthService.js';

export const auth = new Hono()
  /** Asegura la cookie CSRF antes de la primera mutación del frontend. */
  .get('/csrf', (c) => c.json({ csrfToken: ensureCsrfCookie(c) }))

  .post('/admin/login', async (c) => {
    const input = await parseJsonBody(c, AdminLoginSchema);
    return c.json({ admin: await authService.loginAdmin(c, input) });
  })

  /**
   * Cambio de password. Se permite con `mustChangePassword` activo: es
   * justamente la única ruta que tiene que estar accesible en ese estado.
   */
  .post('/admin/password', requireAdmin({ allowWhileMustChangePassword: true }), async (c) => {
    const input = await parseJsonBody(c, ChangePasswordSchema);
    await authService.changeAdminPassword(c, currentAdminId(c), input);
    return c.json({ ok: true });
  })

  /**
   * Recuperación del password del admin con el código de entorno.
   *
   * **Sin sesión, a propósito**: quien la usa es justamente el que no puede
   * entrar. Lo que la protege es el código —que sólo conoce quien tenga acceso
   * al panel del proveedor— más el rate limit de `/api/auth/*`, que es el mismo
   * que frena la fuerza bruta contra el login.
   */
  .post('/admin/recover', async (c) => {
    const input = await parseJsonBody(c, RecoverAdminSchema);
    await authService.recoverAdminPassword(input);
    return c.json({ ok: true });
  })

  .post('/patrol/login', async (c) => {
    const input = await parseJsonBody(c, PatrolLoginSchema);
    return c.json({ patrol: await patrolAuthService.loginPatrol(c, input) });
  })

  .get('/me', requireAdmin({ allowWhileMustChangePassword: true }), async (c) => {
    return c.json({ admin: await authService.getAdminInfo(currentAdminId(c)) });
  })

  .post('/logout', async (c) => {
    await endSession(c);
    return c.json({ ok: true });
  });
