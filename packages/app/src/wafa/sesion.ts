/**
 * Sesión de administrador.
 *
 * WAFA funciona **online**. A diferencia de WAFL, acá no hay nada que guardar
 * localmente: el admin trabaja en el club, con wifi, antes o después del torneo.
 *
 * Ver `docs/FUNCTIONAL.md` §6.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/apiClient.js';

export interface Admin {
  readonly id: string;
  readonly username: string;
  /**
   * Con esto en `true` el admin **no puede hacer nada** salvo cambiar el
   * password. Lo aplica el servidor, y la interfaz lo refleja. Ver
   * `docs/SECURITY.md` §3.1.
   */
  readonly mustChangePassword: boolean;
}

export type EstadoSesion =
  | { readonly estado: 'cargando' }
  | { readonly estado: 'anonimo' }
  | { readonly estado: 'autenticado'; readonly admin: Admin };

export async function login(username: string, password: string): Promise<Admin> {
  const { admin } = await api.post<{ admin: Admin }>('/auth/admin/login', { username, password });
  return admin;
}

export async function cambiarPassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/auth/admin/password', { currentPassword, newPassword });
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

async function leerSesion(): Promise<Admin | null> {
  try {
    const { admin } = await api.get<{ admin: Admin | null }>('/auth/me');
    return admin;
  } catch {
    // Un 401 no es un error de la app: es el estado normal de quien no entró.
    return null;
  }
}

/**
 * Estado de la sesión de admin.
 *
 * Arranca en `cargando` a propósito: si arrancara en `anonimo`, la primera
 * pintada mandaría al login a alguien que ya tiene sesión.
 */
export function useSesionAdmin(): {
  sesion: EstadoSesion;
  refrescar: () => Promise<void>;
  salir: () => Promise<void>;
} {
  const [sesion, setSesion] = useState<EstadoSesion>({ estado: 'cargando' });

  const refrescar = useCallback(async () => {
    const admin = await leerSesion();
    setSesion(admin ? { estado: 'autenticado', admin } : { estado: 'anonimo' });
  }, []);

  const salir = useCallback(async () => {
    try {
      await logout();
    } finally {
      // Aunque falle la red, la sesión local se corta: quedarse "adentro" con
      // una sesión que el servidor ya no reconoce sólo confunde.
      setSesion({ estado: 'anonimo' });
    }
  }, []);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  return { sesion, refrescar, salir };
}
