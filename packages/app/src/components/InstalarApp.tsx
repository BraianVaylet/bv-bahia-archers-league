/**
 * Recomendación de instalar la app, desde la puerta de entrada.
 *
 * **No es cosmético.** Instalada, la PWA abre directo en `/app/` y el service
 * worker ya tiene todo precacheado: es la diferencia entre abrir la app en el
 * monte sin señal y quedarse mirando un navegador que no carga.
 *
 * Se ofrece **sólo acá**, en la pantalla de elección de rol. Dentro del
 * recorrido no se interrumpe a nadie con esto.
 */

import { useEffect, useState } from 'react';
import {
  type EstadoDeInstalacion,
  estadoDeInstalacion,
  pareceInstalada,
  pareceIOS,
} from './instalacion.js';
import { Button } from './ui.js';

/** Lo que expone `beforeinstallprompt`, que TypeScript no tipa. */
interface EventoDeInstalacion extends Event {
  prompt: () => Promise<void>;
}

export function InstalarApp() {
  const [evento, setEvento] = useState<EventoDeInstalacion>();
  const [instalada, setInstalada] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    setInstalada(pareceInstalada());

    const alPoderInstalar = (e: Event) => {
      // Sin esto, Chrome muestra su propia barra y la recomendación queda
      // duplicada: una del navegador y otra de la app, diciendo lo mismo.
      e.preventDefault();
      setEvento(e as EventoDeInstalacion);
    };

    /** Si se instala mientras la pantalla está abierta, la oferta desaparece. */
    const alInstalarse = () => {
      setInstalada(true);
      setAbierto(false);
    };

    window.addEventListener('beforeinstallprompt', alPoderInstalar);
    window.addEventListener('appinstalled', alInstalarse);
    return () => {
      window.removeEventListener('beforeinstallprompt', alPoderInstalar);
      window.removeEventListener('appinstalled', alInstalarse);
    };
  }, []);

  const estado: EstadoDeInstalacion = estadoDeInstalacion({
    instalada,
    tieneEvento: evento !== undefined,
    esIOS: pareceIOS(),
  });

  if (estado === 'instalada' || estado === 'nada') return null;

  return (
    <div className="flex flex-col gap-2" data-testid="instalar-app">
      <p className="text-sm text-[var(--ink-muted)]">
        Instalada en el celular, la app <strong>abre sin señal</strong>.
      </p>

      <Button variante="secundario" ancho onClick={() => setAbierto(true)}>
        Instalar la app
      </Button>

      {abierto && (
        <Dialogo onCerrar={() => setAbierto(false)}>
          {estado === 'puede-instalar' ? (
            <>
              <p>
                Se agrega al celular como una app más. Ocupa poco y{' '}
                <strong>funciona sin conexión</strong>: es lo que hace que puedas anotar en el
                monte.
              </p>
              <Button
                ancho
                onClick={() => {
                  void evento?.prompt();
                  setAbierto(false);
                }}
              >
                Instalar ahora
              </Button>
            </>
          ) : (
            /*
              iOS no tiene API para esto: no existe `beforeinstallprompt` y no
              hay forma de disparar la instalación desde la página. Lo único
              honesto es decir dónde tocar.
            */
            <>
              <p>
                En iPhone se agrega a mano, desde Safari:
                <br />
                tocá <strong>Compartir</strong> y después{' '}
                <strong>«Agregar a pantalla de inicio»</strong>.
              </p>
              <p className="text-sm text-[var(--ink-muted)]">
                Tiene que ser Safari. Desde otro navegador la opción no aparece.
              </p>
            </>
          )}

          <Button variante="secundario" ancho onClick={() => setAbierto(false)}>
            Cerrar
          </Button>
        </Dialogo>
      )}
    </div>
  );
}

/**
 * Diálogo mínimo.
 *
 * **Acá sí es un modal**, al revés que el aviso de versión: esto pasa en la
 * puerta de entrada, con el usuario parado, no a mitad de un recorrido. Nada
 * que pueda perderse por interrumpir.
 */
function Dialogo({
  children,
  onCerrar,
}: {
  readonly children: React.ReactNode;
  readonly onCerrar: () => void;
}) {
  /**
   * Escape cierra, y se escucha en el documento.
   *
   * La primera versión ponía el `onKeyDown` —y un click para cerrar— sobre el
   * fondo, que es un `div` sin rol interactivo: **el lint lo marcó con razón**.
   * Un fondo que se comporta como botón no lo anuncia a un lector de pantalla,
   * y quien navega con teclado nunca llega a él.
   *
   * Cerrar tiene su botón, que es la salida accesible; esto es el atajo para
   * quien ya lo espera.
   */
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-30 bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Instalar la app"
        data-testid="dialogo-instalar"
        className="w-full max-w-lg rounded-[var(--radius-lg)] bg-[var(--bg)] border
          p-4 flex flex-col gap-3"
      >
        {children}
      </div>
    </div>
  );
}
