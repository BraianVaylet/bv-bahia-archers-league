/**
 * Shell de la PWA.
 *
 * Dos aplicaciones en un mismo build, bajo el scope `/app/` del service worker:
 * WAFA para el admin y WAFL para el líder de patrulla.
 *
 * Ver `docs/ARCHITECTURE.md` §2.
 */

import {
  AnillosDeFondo,
  IconoEditar,
  IconoPanel,
  IndicadorDeAmbiente,
  Logo,
  useTituloDePagina,
} from '@bal/ui';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Cargando } from './components/Cargando.js';
import { InstalarApp } from './components/InstalarApp.js';
import { NavegacionAccesible } from './components/NavegacionAccesible.js';
import { RegistroDeVersion } from './components/registroDeVersion.js';
import { TarjetaDeRol } from './components/TarjetaDeRol.js';
import { Screen } from './components/ui.js';
import { VolverALaLiga } from './components/VolverALaLiga.js';

/**
 * Las dos apps se cargan **cuando se entra a ellas** (`REF6-8` / `P-5`).
 *
 * Con el `import` estático, el líder de patrulla —que tiene la peor señal de todo el
 * torneo— bajaba el panel completo del administrador, y el admin bajaba el scoring.
 * `docs/TECHNICAL.md` §5 lo pide: «entrar como líder no descarga el código de
 * administración».
 *
 * Sin señal sigue funcionando: el service worker precachea **todos** los `.js` del
 * build, los de cada app incluidos, al instalarse.
 */
const WafaApp = lazy(() => import('./wafa/WafaApp.js').then((m) => ({ default: m.WafaApp })));
const WaflApp = lazy(() => import('./wafl/WaflApp.js').then((m) => ({ default: m.WaflApp })));

/**
 * Lo que se ve mientras baja el chunk de la app elegida. Casi siempre sale de la caché del service
 * worker y no se llega a ver nada: `Cargando` espera antes de mostrarse.
 */
function AbriendoLaApp() {
  return (
    <Screen>
      <Cargando forma="pantalla" texto="Abriendo la app…" />
    </Screen>
  );
}

/** El service worker está montado en `/app/`, así que el router también. */
const BASENAME = '/app';

/**
 * La puerta de la PWA (`REF7-7` / `P-1`, `DISENO.md` §5.3): quién sos y qué hace cada app.
 *
 * Antes eran un título y dos botones, y el de administrador, gris, parecía deshabilitado. Ahora a
 * la izquierda (arriba en el celular) va la banda `monte` con la promesa de la app, y a la derecha
 * la pregunta con dos tarjetas que dicen qué hace cada una. La de líder es la principal.
 *
 * Sin encabezado ni pie: es la entrada, no una pantalla de trabajo.
 */
function Elegir() {
  useTituloDePagina();
  return (
    <div className="grid min-[760px]:grid-cols-2 min-[760px]:min-h-[calc(100dvh_-_var(--reserva-aviso-de-ambiente))]">
      <aside className="relative overflow-hidden bg-[var(--monte)] text-[var(--monte-ink)] flex flex-col justify-between gap-8 px-4 pt-6 pb-8 min-[760px]:p-12">
        {/*
          Decorativos, y **lejos del texto**: en la primera versión cruzaban el titular. Los valores
          de la spec (760px) sólo dejan libre la marca con el panel de 640px o más (pantalla de
          1280); en el celular y entre 760 y 1280 van más chicos, sobre la esquina. Medido a 360,
          390, 768, 1024 y 1280.
        */}
        <AnillosDeFondo className="w-[280px] h-[280px] -right-[150px] -top-[190px] min-[760px]:w-[400px] min-[760px]:h-[400px] min-[760px]:-right-[200px] min-[760px]:-top-[350px] min-[1280px]:w-[760px] min-[1280px]:h-[760px] min-[1280px]:-right-[380px] min-[1280px]:-top-[300px]" />

        <div className="relative flex items-center gap-3">
          <Logo size={44} className="shrink-0" />
          <span className="font-display font-bold leading-[1.1]">
            Liga Bahiense
            <small className="block font-sans [font-stretch:100%] [font-variation-settings:normal] text-[13px] font-medium text-[var(--monte-muted)]">
              de Arquería
            </small>
          </span>
        </div>

        <div className="relative">
          <h2 className="font-display mb-3 max-w-[480px] text-[30px] leading-none font-extrabold tracking-[-0.02em] min-[760px]:text-[44px]">
            Anotá, sincronizá y <em className="not-italic text-[var(--monte-accent)]">publicá</em>.
          </h2>
          <p className="max-w-[420px] text-[15px] text-[var(--monte-muted)] min-[760px]:text-base">
            La app del día del torneo. Guarda todo en el celular y envía cuando hay señal.
          </p>
        </div>
      </aside>

      <main className="flex flex-col px-4 pt-6 pb-8 min-[760px]:justify-center min-[760px]:px-8 min-[760px]:py-12">
        <div className="mx-auto w-full max-w-[440px] flex flex-col gap-3">
          <p className="font-mono text-eyebrow uppercase text-[var(--ink-muted)]">Ingresar</p>
          <h1 className="font-display mt-2 mb-2 text-2xl leading-[1.1] font-bold min-[760px]:mb-4 min-[760px]:text-display">
            ¿Cómo entrás hoy?
          </h1>

          <TarjetaDeRol
            principal
            a="/wafl"
            titulo="Soy líder de patrulla"
            descripcion="Anotá los puntajes del recorrido."
            icono={IconoEditar}
            etiqueta="Funciona sin señal"
          />
          <TarjetaDeRol
            a="/wafa"
            titulo="Soy administrador"
            descripcion="Torneos, patrullas, padrón y publicación."
            icono={IconoPanel}
          />

          {/*
            La salida al sitio público. Va **después** de los dos roles: quien abre `/app/` viene a
            entrar, no a mirar resultados. Pero sin esto la pantalla es un callejón para el que
            llegó por error — y desde `ref-3` el botón Atrás ya no saca de la app.
          */}
          <VolverALaLiga alinear="inicio" className="mt-4" />

          <div className="mt-3">
            <InstalarApp />
          </div>

          <p className="mt-8 text-xs text-[var(--ink-muted)]">Círculo Bahiense de Arquería</p>
        </div>
      </main>
    </div>
  );
}

export function App() {
  return (
    <>
      {/*
        «Estás en modo desarrollo», arriba de todo y en las tres pantallas: la puerta, WAFA y WAFL.
        Afuera del router por lo mismo que `RegistroDeVersion`: no depende de la ruta. Lee el
        ambiente del `<html>`, que viene en el `index.html` precacheado: sin fetch, también sin
        señal. En producción no dibuja nada.
      */}
      <IndicadorDeAmbiente />
      <BrowserRouter basename={BASENAME}>
        <NavegacionAccesible />
        <Suspense fallback={<AbriendoLaApp />}>
          <Routes>
            <Route path="/" element={<Elegir />} />
            <Route path="/wafl/*" element={<WaflApp />} />
            <Route path="/wafa/*" element={<WafaApp />} />
          </Routes>
        </Suspense>
      </BrowserRouter>

      {/*
        **Afuera del router, y no por comodidad.**

        Que haya versión nueva no depende de en qué pantalla esté el usuario, y
        montarlo por ruta lo desmontaría al navegar — perdiendo el «ahora no»
        que acaba de elegir.

        Y hay un motivo más fuerte: `BrowserRouter` con un `basename` que no
        coincide con la URL **no renderiza absolutamente nada**, ni siquiera los
        hijos que no son rutas. Hoy la PWA siempre se sirve bajo `/app/`, así
        que coincide; pero atar el aviso de actualización a que el routing esté
        bien configurado es acoplar dos cosas que no tienen nada que ver.
      */}
      <RegistroDeVersion />
    </>
  );
}
