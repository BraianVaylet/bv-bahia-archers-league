// Anti-FOUC: aplica el tema oscuro ANTES del primer pintado.
//
// Es un archivo externo, clásico y sin async/defer, a propósito:
//
// - Externo porque la CSP de producción es `script-src 'self'`, sin
//   'unsafe-inline' ni hashes. Inline, el navegador lo bloquea y el tema nunca
//   llega a tiempo: se ve la pantalla en claro y el salto a oscuro cuando monta
//   React.
// - Bloqueante porque tiene que correr antes del primer pintado. Un
//   <script type="module"> o uno con defer se ejecuta después de parsear.
//
// No puede importar nada, así que repite a mano la lógica de `resolverTema`,
// `TEMA_KEY` y `COLOR_DE_BARRA` de @bal/shared. Hay una copia por app
// (`public/theme-init.js` de cada una: Vite sirve cada `public/` bajo su propio
// origen) y tienen que ser idénticas. `packages/shared/tests/tema.test.ts` EJECUTA
// los dos archivos y los compara con `resolverTema`, y compara las copias entre sí.
//
// Ver docs/DESIGN_SYSTEM.md §9 y docs/SECURITY.md §10.
(() => {
  // Cada lectura en su propio try: que falle una no puede anular la otra.
  var guardado = null;
  try {
    guardado = localStorage.getItem('bal_tema');
  } catch (_) {
    // Sin localStorage (modo privado, datos del sitio bloqueados) no se puede
    // recordar la elección, pero eso no es motivo para ignorar el sistema.
  }

  var sistemaOscuro = false;
  try {
    sistemaOscuro = matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (_) {
    // Sin matchMedia se queda en claro, que es el default y el que gana al sol.
  }

  // Un valor guardado que no se reconoce no cuenta como elección.
  var oscuro = guardado === 'dark' || (guardado !== 'light' && sistemaOscuro);
  if (!oscuro) return;

  // Claro es la ausencia del atributo: el CSS sólo mira [data-theme='dark'].
  document.documentElement.setAttribute('data-theme', 'dark');

  var barra = document.querySelector('meta[name=theme-color]');
  if (barra) barra.setAttribute('content', '#16170f');
})();
