/**
 * El plugin de Vite que marca el `index.html` como desarrollo en `pnpm dev`.
 *
 * En Railway el ambiente lo escribe la API (`packages/api/src/middleware/estaticos.ts`,
 * `marcarAmbiente`) a partir de su `NODE_ENV`. En local cada frontend corre en su Vite y no hay
 * API de por medio: sin esto, `pnpm dev` no mostraría la barra «estás en modo desarrollo».
 *
 * `apply: 'serve'`: el build no lo aplica, porque el build no sabe en qué ambiente va a correr.
 *
 * Es una entrada aparte de `@bal/ui` (`@bal/ui/vite`) porque la carga Node al leer el
 * `vite.config.ts`, y el índice trae React y assets que Node no sabe importar. Sin dependencia de
 * `vite`: el tipo es estructural y alcanza para que `plugins` lo acepte.
 */

export interface PluginDeAmbiente {
  readonly name: string;
  readonly apply: 'serve';
  transformIndexHtml(html: string): string;
}

export function ambienteDeDesarrollo(): PluginDeAmbiente {
  return {
    name: 'bal:ambiente-de-desarrollo',
    apply: 'serve',
    transformIndexHtml: (html) =>
      html.replace(/<html(?=[\s>])/, '<html data-ambiente="development"'),
  };
}
