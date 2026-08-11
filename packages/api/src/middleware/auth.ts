/**
 * Autenticación y autorización por rol.
 *
 * Ver `docs/SECURITY.md` §4.
 */

import type { Context, MiddlewareHandler } from 'hono';
import type { ObjectId } from 'mongodb';
import { AppError } from '../lib/errors.js';
import { readSession, type SessionSubject } from '../lib/session.js';
import * as userRepo from '../repositories/userRepo.js';

declare module 'hono' {
  interface ContextVariableMap {
    subject: SessionSubject;
  }
}

/** Sujeto de la sesión. Sólo válido dentro de una ruta protegida. */
export function currentSubject(c: Context): SessionSubject {
  const subject = c.get('subject');
  if (!subject) throw new AppError('UNAUTHORIZED');
  return subject;
}

/** Id del admin de la sesión. Lanza si la sesión no es de admin. */
export function currentAdminId(c: Context): ObjectId {
  const subject = currentSubject(c);
  if (subject.type !== 'admin') throw new AppError('FORBIDDEN');
  return subject.id;
}

/**
 * Exige sesión de administrador.
 *
 * Además bloquea toda ruta que no sea el cambio de password mientras el usuario
 * tenga `mustChangePassword`: el password con el que se hizo el deploy no puede
 * quedar como password permanente. Ver `docs/SECURITY.md` §3.1.
 */
export const requireAdmin = (
  options: { allowWhileMustChangePassword?: boolean } = {},
): MiddlewareHandler => {
  return async (c, next) => {
    const sesion = await readSession(c);
    if (!sesion || sesion.subject.type !== 'admin') {
      throw new AppError('UNAUTHORIZED');
    }

    if (!options.allowWhileMustChangePassword) {
      const user = await userRepo.findById(sesion.subject.id);
      if (user?.mustChangePassword) {
        throw new AppError('FORBIDDEN', {
          message: 'Tenés que cambiar tu password antes de seguir.',
          details: { mustChangePassword: true },
        });
      }
    }

    c.set('subject', sesion.subject);
    return next();
  };
};

/** Exige sesión de patrulla. La sesión trae su `patrolId` y su `tournamentId`. */
export const requirePatrol = (): MiddlewareHandler => async (c, next) => {
  const sesion = await readSession(c);
  if (!sesion || sesion.subject.type !== 'patrol') {
    throw new AppError('UNAUTHORIZED');
  }

  c.set('subject', sesion.subject);
  return next();
};
