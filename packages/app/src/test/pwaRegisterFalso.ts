/**
 * Doble de `virtual:pwa-register/react` para los tests.
 *
 * El módulo real lo genera `vite-plugin-pwa` al construir y **no existe fuera
 * de Vite**, así que sin esto cualquier test que toque el árbol de la app
 * explotaría al resolver el import.
 *
 * Se alias-ea en `vitest.config.ts`. Que exista es lo que permite probar que el
 * aviso de versión está **conectado** al service worker, y no sólo escrito.
 */

import { useState } from 'react';

/** Lo que devuelve el `useRegisterSW` de verdad, en lo que se usa acá. */
export interface RegistroSW {
  readonly needRefresh: [boolean, (v: boolean) => void];
  readonly updateServiceWorker: (recargar?: boolean) => Promise<void>;
}

/** Espía: cada llamada a `updateServiceWorker` queda registrada acá. */
export const actualizaciones: (boolean | undefined)[] = [];

let arrancaConVersionNueva = false;

/** Lo que el test decide antes de renderizar. */
export function configurarRegistroSW({ hayVersionNueva }: { hayVersionNueva: boolean }): void {
  arrancaConVersionNueva = hayVersionNueva;
}

export function reiniciarRegistroSW(): void {
  arrancaConVersionNueva = false;
  actualizaciones.length = 0;
}

export function useRegisterSW(): RegistroSW {
  const [needRefresh, setNeedRefresh] = useState(arrancaConVersionNueva);

  return {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker: (recargar?: boolean) => {
      actualizaciones.push(recargar);
      return Promise.resolve();
    },
  };
}
