/**
 * Enlaces que cruzan de una aplicación a la otra.
 *
 * **En producción un solo origen sirve las dos**: la landing en `/`, la PWA en
 * `/app/`. Un enlace relativo alcanza, y tiene que ser relativo: el mismo
 * contenedor se sirve desde el dominio que le pongan, y una URL absoluta en el
 * build lo ataría a uno. Ver `packages/api/src/middleware/estaticos.ts`.
 *
 * **En desarrollo son dos Vite en puertos distintos**, y ahí el enlace relativo
 * miente: un `/` desde la PWA se queda en la PWA. Es lo que hacía que el botón
 * de «Ver los resultados de la liga» no llevara a ningún lado mientras se
 * probaba con `pnpm dev`.
 *
 * No es una regla del deporte, pero es un dato único del despliegue y las dos
 * aplicaciones lo necesitan: escrito en cada una, se separan.
 */

export type AplicacionDestino = 'app' | 'landing';

/** Los puertos de `vite.config.ts` de cada frontend. */
export const PUERTOS_DE_DESARROLLO: Readonly<Record<AplicacionDestino, number>> = {
  app: 5173,
  landing: 5174,
};

/** Dónde vive cada aplicación cuando un solo origen sirve todo. */
const RUTA: Readonly<Record<AplicacionDestino, string>> = {
  app: '/app/',
  landing: '/',
};

/**
 * @param destino  A cuál de las dos aplicaciones se quiere ir.
 * @param dev      `import.meta.env.DEV` de quien llama.
 * @param origen   `location.href` — de ahí salen el protocolo y el host.
 */
export function enlaceEntreApps(destino: AplicacionDestino, dev: boolean, origen: string): string {
  if (!dev) return RUTA[destino];

  // Se conserva el host en vez de escribir `localhost`: la PWA se prueba desde
  // el celular contra la IP de la máquina, y ahí `localhost` es el celular.
  const url = new URL(origen);
  url.port = String(PUERTOS_DE_DESARROLLO[destino]);
  url.pathname = RUTA[destino];
  url.search = '';
  url.hash = '';
  return url.toString();
}
