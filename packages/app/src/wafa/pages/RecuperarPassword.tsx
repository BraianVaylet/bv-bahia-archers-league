/**
 * Recuperar el password del administrador.
 *
 * **Es la única salida si el admin se olvida la clave.** No hay recupero por
 * mail —la liga no guarda mails de nadie— ni un segundo administrador que pueda
 * rescatarlo.
 *
 * La primera versión de esto reseteaba el password al arrancar el servidor,
 * cuando cambiaba `ADMIN_INITIAL_PASSWORD`. Era inútil en el único momento en
 * que hace falta: **el día del torneo**, donde nadie va a esperar un redeploy.
 *
 * Ahora esa variable funciona como **código de recuperación**: se ingresa acá y
 * habilita elegir un password nuevo, sin tocar el deploy. Sólo la conoce quien
 * tenga acceso al panel del proveedor.
 */

import { MIN_PASSWORD_LENGTH } from '@bal/shared';
import { type FormEvent, useState } from 'react';
import { Button, Field, Screen } from '../../components/ui.js';
import { ApiError, api } from '../../lib/apiClient.js';

export interface RecuperarPasswordProps {
  readonly onVolver: () => void;
  readonly onRecuperado: () => void;
}

export function RecuperarPassword({ onVolver, onRecuperado }: RecuperarPasswordProps) {
  const [codigo, setCodigo] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setEnviando(true);

    try {
      await api.post('/auth/admin/recover', { recoverySecret: codigo, newPassword: nuevo });
      onRecuperado();
    } catch (err) {
      /*
        El mensaje del servidor no distingue si falló el código o el password.
        Repetirlo tal cual evita que la interfaz filtre lo que el backend cuida.
      */
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar. Revisá la red.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Screen>
      <div className="pt-10 pb-2">
        <h1 className="font-[var(--font-display)] text-[var(--text-display)] font-bold">
          Recuperar el acceso
        </h1>
      </div>

      <p className="text-[var(--ink-muted)]">
        Hace falta el <strong>código de recuperación</strong> del servidor. Lo tiene quien
        administra el despliegue: es el valor de <code>ADMIN_INITIAL_PASSWORD</code>.
      </p>

      <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4">
        <Field
          label="Código de recuperación"
          type="password"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          required
        />

        <Field
          label="Password nuevo"
          type="password"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          // `new-password` y no `current-password`: es el que se está creando.
          autoComplete="new-password"
          spellCheck={false}
          hint={`Al menos ${MIN_PASSWORD_LENGTH} caracteres.`}
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
          disabled={enviando || !codigo || nuevo.length < MIN_PASSWORD_LENGTH}
        >
          {enviando ? 'Guardando…' : 'Guardar el password nuevo'}
        </Button>

        <Button variante="secundario" ancho onClick={onVolver}>
          Volver al ingreso
        </Button>
      </form>
    </Screen>
  );
}
