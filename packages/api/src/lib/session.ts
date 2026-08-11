/**
 * Sesiones: creación, lectura y destrucción.
 *
 * En la cookie va el token; en la base, su `sha256`. Ver `docs/SECURITY.md` §8.
 */

import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { ObjectId } from 'mongodb';
import type { SessionDoc, SubjectType } from '../db/types.js';
import { env } from '../env.js';
import * as sessionRepo from '../repositories/sessionRepo.js';
import { generateSessionToken, sha256 } from './crypto.js';

export interface SessionSubject {
  readonly type: SubjectType;
  readonly id: ObjectId;
  readonly tournamentId: ObjectId | null;
}

const HORA_MS = 3_600_000;

function ttlMs(type: SubjectType): number {
  const cfg = env();
  return (type === 'admin' ? cfg.SESSION_TTL_HOURS_ADMIN : cfg.SESSION_TTL_HOURS_PATROL) * HORA_MS;
}

/** Crea la sesión, la persiste hasheada y deja la cookie `HttpOnly`. */
export async function startSession(
  c: Context,
  subject: { type: SubjectType; id: ObjectId; tournamentId?: ObjectId | null },
): Promise<void> {
  const cfg = env();
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + ttlMs(subject.type));

  await sessionRepo.create({
    tokenHash: sha256(token),
    subjectType: subject.type,
    subjectId: subject.id,
    tournamentId: subject.tournamentId ?? null,
    expiresAt,
    ip: c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  });

  setCookie(c, cfg.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: cfg.cookieSecure,
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
  });
}

/** Sujeto de la sesión vigente, o `null`. */
export async function readSession(c: Context): Promise<{
  subject: SessionSubject;
  doc: SessionDoc;
} | null> {
  const token = getCookie(c, env().SESSION_COOKIE_NAME);
  if (!token) return null;

  const doc = await sessionRepo.findValidByTokenHash(sha256(token));
  if (!doc) return null;

  return {
    subject: { type: doc.subjectType, id: doc.subjectId, tournamentId: doc.tournamentId },
    doc,
  };
}

/** Cierra la sesión en la base **y** borra la cookie. */
export async function endSession(c: Context): Promise<void> {
  const cfg = env();
  const token = getCookie(c, cfg.SESSION_COOKIE_NAME);

  // Se invalida en la base, no sólo se borra la cookie: si el token se filtró,
  // borrar la cookie del navegador no sirve de nada.
  if (token) await sessionRepo.deleteByTokenHash(sha256(token));

  deleteCookie(c, cfg.SESSION_COOKIE_NAME, { path: '/' });
}

/** Invalida todas las sesiones de un sujeto. */
export function endAllSessionsFor(type: SubjectType, id: ObjectId): Promise<number> {
  return sessionRepo.deleteAllForSubject(type, id);
}
