// Anti-FOUC: aplica el tema ANTES del primer pintado.
//
// Va inline en el <head> con hash en la CSP, no con 'unsafe-inline'.
// Ver docs/DESIGN_SYSTEM.md §9 y docs/SECURITY.md §10.
(() => {
  try {
    const guardado = localStorage.getItem('bal-theme');
    const oscuro =
      guardado === 'dark' ||
      (guardado !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    document.documentElement.dataset.theme = oscuro ? 'dark' : 'light';
  } catch {
    // localStorage bloqueado: el tema claro es el default, que es el que gana
    // bajo el sol.
    document.documentElement.dataset.theme = 'light';
  }
})();
