/**
 * Login de WAFL.
 *
 * Es la **única** vez que la app necesita red, además del cierre. Al entrar baja
 * el recorrido completo y a partir de ahí funciona sin señal.
 *
 * Si el bundle ya está guardado en el dispositivo, se puede entrar **sin
 * conexión**: el líder que ya arrancó el recorrido no queda afuera de su propio
 * torneo porque se le cayó el wifi.
 *
 * Ver `docs/FUNCTIONAL.md` §7.1 · `docs/OFFLINE_SYNC.md` §5.1.
 */

import { formatearFechaCorta } from '@bal/shared';
import cba from '@bal/shared/assets/cba.webp';
import { Logo } from '@bal/ui';
import { type FormEvent, useEffect, useState } from 'react';
import { Button, cn, Field, Screen } from '../components/ui.js';
import { ApiError, api } from '../lib/apiClient.js';
import type { StoredBundle } from '../offline/db.js';
import { readBundle } from '../offline/db.js';
import { entrarConBundleLocal, login } from './sesion.js';

interface TorneoAbierto {
  readonly id: string;
  readonly name: string;
  readonly date: string;
}

export interface LoginPageProps {
  readonly onEntro: (bundle: StoredBundle) => void;
}

/** Antigüedad del bundle guardado, en palabras. */
export function antiguedadDe(fetchedAt: number, ahora: number = Date.now()): string {
  const horas = Math.floor((ahora - fetchedAt) / 3_600_000);
  if (horas < 1) return 'hace menos de una hora';
  if (horas < 24) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;

  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

/** Lo mínimo que la botonera necesita de cada patrulla del torneo. */
interface PatrullaDelTorneo {
  readonly number: number;
  readonly username: string;
}

export function LoginPage({ onEntro }: LoginPageProps) {
  const [torneos, setTorneos] = useState<TorneoAbierto[]>();
  const [tournamentId, setTournamentId] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [guardado, setGuardado] = useState<StoredBundle>();
  const [patrullas, setPatrullas] = useState<PatrullaDelTorneo[]>([]);

  useEffect(() => {
    // El bundle guardado se lee primero: es lo que permite entrar sin señal, y
    // la pantalla tiene que ofrecerlo antes de pedir credenciales.
    void readBundle().then(setGuardado);

    api
      .get<{ tournaments: (TorneoAbierto & { status: string })[] }>('/public/tournaments')
      .then((r) => setTorneos(r.tournaments.filter((t) => t.status === 'en_proceso')))
      .catch(() => setTorneos([]));
  }, []);

  /**
   * Las patrullas del torneo elegido, para la botonera.
   *
   * Si falla —sin señal en el club— se queda vacía y el campo de texto sigue
   * estando: quedarse sin botonera **y** sin campo sería quedarse afuera del
   * torneo.
   */
  useEffect(() => {
    setUsername('');
    if (!tournamentId) {
      setPatrullas([]);
      return;
    }

    let vigente = true;
    api
      .get<{ tournament: { patrols: PatrullaDelTorneo[] } }>(`/public/tournaments/${tournamentId}`)
      .then((r) => {
        if (vigente) setPatrullas(r.tournament.patrols);
      })
      .catch(() => {
        if (vigente) setPatrullas([]);
      });

    // Cambiar de torneo dos veces rápido dejaría la respuesta de la primera
    // pisando a la segunda.
    return () => {
      vigente = false;
    };
  }, [tournamentId]);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setEnviando(true);

    try {
      onEntro(await login({ tournamentId, username, pin }));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No hay conexión. Si ya descargaste el recorrido, podés entrar con los datos del celular.',
      );
    } finally {
      setEnviando(false);
    }
  };

  const entrarSinRed = async () => {
    if (!guardado) return;

    const bundle = await entrarConBundleLocal(guardado.tournament.id);
    if (bundle) onEntro(bundle);
  };

  return (
    <Screen>
      <div className="pt-10 pb-2">
        <h1 className="font-[var(--font-display)] text-[var(--text-display)] font-bold flex items-center gap-3">
          <Logo size={40} className="shrink-0" />
          WAFL
        </h1>
        <p className="text-[var(--ink-muted)]">Planilla de patrulla</p>

        {/*
          Los dos logos, con su nombre escrito. Es la pantalla donde el líder
          confirma que abrió la app de la liga y no otra cosa — y la única que
          ve antes de tener el recorrido descargado.
        */}
        <p className="pt-3 flex items-center gap-2 text-sm text-[var(--ink-muted)]">
          <Logo size={20} className="shrink-0" />
          Liga Bahiense
          <img src={cba} alt="" width={20} height={20} className="shrink-0" />
          Círculo Bahiense de Arquería
        </p>
      </div>

      {guardado && (
        <section className="rounded-[var(--radius-lg)] border p-3 flex flex-col gap-2 bg-[var(--surface)]">
          <p className="font-semibold">{guardado.tournament.name}</p>
          <p className="text-sm text-[var(--ink-muted)]">
            Patrulla {guardado.patrol.number} · descargado {antiguedadDe(guardado.fetchedAt)}
          </p>
          <Button ancho onClick={() => void entrarSinRed()}>
            Seguir sin conexión
          </Button>
        </section>
      )}

      <form onSubmit={(e) => void entrar(e)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="torneo" className="text-sm font-medium">
            Torneo
          </label>
          <select
            id="torneo"
            value={tournamentId}
            onChange={(e) => setTournamentId(e.target.value)}
            className="min-h-[52px] px-4 text-base rounded-[var(--radius-md)] bg-[var(--surface)] border"
            required
          >
            <option value="">Elegí el torneo</option>
            {torneos?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {formatearFechaCorta(t.date)}
              </option>
            ))}
          </select>

          {torneos?.length === 0 && (
            <p className="text-sm text-[var(--ink-muted)]">
              No hay ningún torneo en curso. El admin tiene que iniciarlo primero.
            </p>
          )}
        </div>

        {/* Un botón por patrulla: tipear `patrulla3` con guantes, al sol y con
            el celular en una mano es la parte más lenta de entrar, y la que más
            se equivoca. El campo de texto queda igual debajo — si la lista no
            llegó por falta de señal, quedarse sin las dos cosas sería quedarse
            afuera del torneo. */}
        {patrullas.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium pb-1">Tu patrulla</legend>

            <div className="flex flex-wrap gap-2">
              {patrullas.map((p) => (
                <button
                  key={p.username}
                  type="button"
                  aria-pressed={username === p.username}
                  onClick={() => setUsername(p.username)}
                  className={cn(
                    'min-h-[56px] min-w-[72px] px-4 rounded-[var(--radius-md)] border',
                    'text-base font-semibold',
                    username === p.username
                      ? 'bg-[var(--nock)] text-[var(--nock-ink)]'
                      : 'bg-[var(--surface)]',
                  )}
                >
                  Patrulla {p.number}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <Field
          label="Patrulla"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="patrulla3"
          autoCapitalize="none"
          autoComplete="username"
          required
        />

        <Field
          label="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          // `inputMode` y no `type=number`: el teclado numérico sin las flechitas
          // de incremento, que en un PIN no significan nada.
          inputMode="numeric"
          autoComplete="one-time-code"
          hint="Seis dígitos. Te lo da el admin."
          required
        />

        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        <Button
          type="submit"
          ancho
          disabled={enviando || !tournamentId || !username || pin.length !== 6}
        >
          {enviando ? 'Descargando el recorrido…' : 'Entrar'}
        </Button>
      </form>
    </Screen>
  );
}
