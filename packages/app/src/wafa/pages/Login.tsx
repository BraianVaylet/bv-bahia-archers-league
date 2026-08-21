/**
 * Login de administrador.
 *
 * Ver `docs/FUNCTIONAL.md` §6.1.
 */

import { Logo } from '@bal/ui';
import { type FormEvent, useState } from 'react';
import { Button, Field, Screen } from '../../components/ui.js';
import { VolverALaLiga } from '../../components/VolverALaLiga.js';
import { ApiError } from '../../lib/apiClient.js';
import { login } from '../sesion.js';
import { RecuperarPassword } from './RecuperarPassword.js';

export interface LoginPageProps {
  readonly onEntro: () => void | Promise<void>;
}

export function LoginPage({ onEntro }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [recuperando, setRecuperando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setEnviando(true);

    try {
      await login(username, password);
      await onEntro();
    } catch (err) {
      // El mensaje del servidor no distingue si el usuario existe: repetirlo tal
      // cual evita que la interfaz filtre lo que el backend cuida.
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar. Revisá la red.');
    } finally {
      setEnviando(false);
    }
  };

  if (recuperando) {
    return (
      <RecuperarPassword
        onVolver={() => setRecuperando(false)}
        onRecuperado={() => {
          setRecuperando(false);
          // No se entra solo: el que recuperó acaba de elegir el password y
          // tiene que probarlo. Entrar por él escondería un error de tipeo.
          setError(undefined);
        }}
      />
    );
  }

  return (
    <Screen>
      <div className="pt-10 pb-2">
        <h1 className="font-[var(--font-display)] text-[var(--text-display)] font-bold flex items-center gap-3">
          <Logo size={40} className="shrink-0" />
          WAFA
        </h1>
        <p className="text-[var(--ink-muted)]">Administración de la Liga Bahiense</p>
      </div>

      <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4">
        <Field
          label="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          required
        />

        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        <Button type="submit" ancho disabled={enviando || !username || !password}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </Button>

        {/*
          La salida para el que se olvidó la clave.

          Discreta y debajo del botón: no es el camino normal. Pero tiene que
          estar acá — no hay recupero por mail ni un segundo administrador, y
          descubrirlo el día del torneo sin esto significa quedarse afuera.
        */}
        <Button variante="secundario" ancho onClick={() => setRecuperando(true)}>
          Olvidé mi password
        </Button>
      </form>

      {/*
        La salida al sitio público, desde el login.

        Quien abre la PWA sin credenciales —o se equivocó de app— quedaba
        encerrado en un formulario que no puede completar. Va **después** del
        botón de entrar: el que vino a entrar entra, y el que se perdió tiene
        por dónde salir.
      */}
      <VolverALaLiga />
    </Screen>
  );
}
