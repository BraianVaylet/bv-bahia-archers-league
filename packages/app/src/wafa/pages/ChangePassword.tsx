/**
 * Cambio de password.
 *
 * Con `mustChangePassword` activo es la **única** pantalla accesible. El
 * servidor lo impone y la interfaz lo refleja: no hay salida ni menú.
 *
 * Ver `docs/FUNCTIONAL.md` §6.1 · `docs/SECURITY.md` §3.1.
 */

import { MIN_PASSWORD_LENGTH } from '@bal/shared';
import { type FormEvent, useState } from 'react';
import { Button, Field, Screen } from '../../components/ui.js';
import { ApiError } from '../../lib/apiClient.js';
import { cambiarPassword } from '../sesion.js';

export interface ChangePasswordPageProps {
  /** `true` cuando el cambio es obligatorio: sin salida ni cancelar. */
  readonly obligatorio: boolean;
  readonly onCambiado: () => void | Promise<void>;
  readonly onCancelar?: () => void;
}

/** Mensaje de por qué el password nuevo no sirve, o `undefined` si sirve. */
export function validarPassword(actual: string, nuevo: string): string | undefined {
  if (nuevo.length < MIN_PASSWORD_LENGTH) {
    return `Tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (nuevo === actual) {
    return 'Tiene que ser distinto del actual.';
  }
  return undefined;
}

export function ChangePasswordPage({
  obligatorio,
  onCambiado,
  onCancelar,
}: ChangePasswordPageProps) {
  const [actual, setActual] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  // Se valida en el cliente Y en el servidor. El cliente para explicarlo al
  // tipear; el servidor porque es el único que decide. Ver docs/SECURITY.md §7.
  const problema = nuevo ? validarPassword(actual, nuevo) : undefined;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setEnviando(true);

    try {
      await cambiarPassword(actual, nuevo);
      await onCambiado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar. Revisá la red.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Screen>
      <div className="pt-10 pb-2">
        <h1 className="font-[var(--font-display)] text-[var(--text-display)] font-bold">
          Cambiar password
        </h1>
        {obligatorio && (
          <p className="text-[var(--ink-muted)]">
            Es tu primer ingreso. Antes de seguir, elegí un password propio.
          </p>
        )}
      </div>

      <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4">
        <Field
          label="Password actual"
          type="password"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          autoComplete="current-password"
          required
        />

        <Field
          label="Password nuevo"
          type="password"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          autoComplete="new-password"
          hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`}
          error={problema}
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
          disabled={enviando || !actual || !nuevo || problema !== undefined}
        >
          {enviando ? 'Guardando…' : 'Guardar'}
        </Button>

        {/* Sin salida cuando es obligatorio: no hay a dónde ir hasta cambiarlo. */}
        {!obligatorio && onCancelar && (
          <Button variante="secundario" ancho onClick={onCancelar}>
            Cancelar
          </Button>
        )}
      </form>
    </Screen>
  );
}
