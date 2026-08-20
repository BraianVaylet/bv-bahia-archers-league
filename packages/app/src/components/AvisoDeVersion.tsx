/**
 * Aviso de que hay una versión nueva.
 *
 * **Es la mitad que le faltaba a la regla 7.** `registerType: 'prompt'` estaba
 * bien puesto en `vite.config.ts` desde siempre, pero nadie escuchaba: el
 * service worker nuevo se descargaba, quedaba en `waiting` esperando un mensaje
 * `SKIP_WAITING` que ningún código mandaba, y el usuario se quedaba con la
 * versión que tenía. En una PWA instalada, que casi no se cierra, eso es *para
 * siempre*.
 *
 * **Una barra, nunca un modal.** Recargar a mitad de un recorrido es
 * exactamente lo que la regla 7 prohíbe, así que esto no puede tapar la
 * pantalla ni robar el foco: informa y espera. Actualizar es siempre una
 * decisión del usuario, y no actualizar es una respuesta válida.
 */

import { Button } from './ui.js';

export interface AvisoDeVersionProps {
  readonly visible: boolean;
  readonly onActualizar: () => void;
  readonly onDespues: () => void;
}

export function AvisoDeVersion({ visible, onActualizar, onDespues }: AvisoDeVersionProps) {
  if (!visible) return null;

  return (
    /*
      **`z-10`, no más.** El pad de firma es un `fixed inset-0` en `z-20`: con
      un z mayor, esta barra se le pondría encima justo cuando el arquero está
      firmando, que es el peor momento posible para ofrecerle nada.

      Queda por encima del contenido y puede llegar a tapar una barra de
      acción. Se acepta porque aparece sólo cuando hay versión nueva y se va
      con un toque — y porque la alternativa, empujar el contenido, obliga a
      cambiar el alto en las doce pantallas.
    */
    <div
      role="status"
      data-testid="aviso-version"
      className="fixed inset-x-0 bottom-0 z-10 border-t bg-[var(--surface-2)]
        px-4 py-3 flex flex-col gap-2 print:hidden"
    >
      <p className="text-sm">
        Hay una <strong>versión nueva</strong> de la app. Se instala en un segundo.
      </p>

      {/*
        «Ahora no» va primero en el DOM y con el mismo peso visual: en medio de
        un torneo la respuesta correcta casi siempre es esa, y la que se toca
        sin mirar tiene que ser la que no interrumpe.
      */}
      <div className="flex gap-2">
        <Button variante="secundario" ancho onClick={onDespues}>
          Ahora no
        </Button>
        <Button ancho onClick={onActualizar}>
          Actualizar
        </Button>
      </div>
    </div>
  );
}
