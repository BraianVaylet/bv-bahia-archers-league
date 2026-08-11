/**
 * Entrada y salida de WAFL.
 *
 * El bundle se descarga **una sola vez**, al entrar. A partir de ahí la app
 * completa el recorrido sin red. Ver `docs/OFFLINE_SYNC.md` §5.1.
 */

import { api } from '../lib/apiClient.js';
import {
  type BundleParticipant,
  type BundleTarget,
  clearAll,
  getDb,
  readBundle,
  type StoredBundle,
  type StoredScore,
  saveBundle,
} from '../offline/db.js';

interface BundleResponse {
  tournament: {
    id: string;
    name: string;
    date: string;
    maxPossibleScore: number;
    targets: BundleTarget[];
  };
  patrol: {
    id: string;
    number: number;
    startTargetIndex: number;
    status: string;
    targetsCompleted: number;
  };
  participants: BundleParticipant[];
  scores: { participantId: string; targetIndex: number; arrows: string[]; total: number }[];
  signatures: { participantId: string; signedAt: string }[];
  serverTime: string;
}

export interface LoginInput {
  readonly tournamentId: string;
  readonly username: string;
  readonly pin: string;
}

/**
 * Entra y descarga el recorrido completo.
 *
 * Es la **única** vez que WAFL necesita conexión, además del cierre.
 */
export async function login(input: LoginInput): Promise<StoredBundle> {
  await api.post('/auth/patrol/login', input);
  return descargarBundle();
}

/** Trae el bundle y lo persiste, midiendo el desfase de reloj. */
export async function descargarBundle(): Promise<StoredBundle> {
  const res = await api.get<BundleResponse>('/wafl/bundle');

  // El desfase se mide ANTES de guardar nada: todo lo que se escriba después
  // lleva el reloj ya corregido. Ver docs/OFFLINE_SYNC.md §4.
  const clockSkewMs = new Date(res.serverTime).getTime() - Date.now();

  const bundle: StoredBundle = {
    tournament: res.tournament,
    patrol: res.patrol,
    participants: res.participants,
    fetchedAt: Date.now(),
    clockSkewMs,
  };

  await saveBundle(bundle);
  await sembrarPuntajes(res, clockSkewMs);
  await pedirAlmacenamientoPersistente();

  return bundle;
}

/**
 * Vuelca los puntajes que ya estaban en el servidor.
 *
 * Sirve para el caso del líder que cambia de dispositivo: entra en otro celu y
 * recupera lo que ya había cargado. Ver `docs/OFFLINE_SYNC.md` §10, escenario 7.
 */
async function sembrarPuntajes(res: BundleResponse, clockSkewMs: number): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['scores', 'signatures'], 'readwrite');
  const ahora = Date.now() + clockSkewMs;

  for (const s of res.scores) {
    const existente = await tx.objectStore('scores').get([s.participantId, s.targetIndex]);
    // Lo local sólo se pisa si ya está sincronizado: un puntaje pendiente es
    // más nuevo que lo que el servidor conoce.
    if (existente && existente.syncState !== 'synced') continue;

    const score: StoredScore = {
      participantId: s.participantId,
      targetIndex: s.targetIndex,
      arrows: s.arrows,
      total: s.total,
      innerCount: 0,
      xCount: 0,
      tenCount: 0,
      mCount: 0,
      clientUpdatedAt: ahora,
      syncState: 'synced',
    };
    await tx.objectStore('scores').put(score);
  }

  for (const f of res.signatures) {
    await tx.objectStore('signatures').put({
      participantId: f.participantId,
      pngDataUrl: '',
      clientUpdatedAt: new Date(f.signedAt).getTime(),
      syncState: 'synced',
    });
  }

  await tx.done;
}

/**
 * Pide que el navegador no desaloje IndexedDB.
 *
 * Sin esto, el navegador puede borrar los datos bajo presión de almacenamiento
 * —a mitad del torneo—. Ver `docs/OFFLINE_SYNC.md` §11.
 */
async function pedirAlmacenamientoPersistente(): Promise<void> {
  if (!navigator.storage?.persist) return;
  if (await navigator.storage.persisted()) return;
  await navigator.storage.persist();
}

/**
 * Entra sin conexión, reusando el bundle guardado.
 *
 * Sólo si corresponde al mismo torneo: los datos de otro torneo no sirven.
 */
export async function entrarConBundleLocal(tournamentId: string): Promise<StoredBundle | null> {
  const bundle = await readBundle();
  return bundle?.tournament.id === tournamentId ? bundle : null;
}

/** Cierra sesión y borra todo lo local. */
export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } catch {
    // Sin red igual se limpia: los datos locales no deben quedar en un celu
    // prestado sólo porque no había señal.
  }
  await clearAll();
}
