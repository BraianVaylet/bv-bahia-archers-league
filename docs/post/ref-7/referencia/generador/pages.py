from components import *

RINGS_BG = '''<svg class="rings" viewBox="0 0 800 800" aria-hidden="true">
<circle cx="400" cy="400" r="390"/><circle cx="400" cy="400" r="310"/><circle cx="400" cy="400" r="230"/><circle cx="400" cy="400" r="150"/><circle class="c" cx="400" cy="400" r="70"/></svg>'''

LANDING_CSS = '''
.wrap { max-width: 1200px; margin: 0 auto; padding: 0 var(--space-4); }
.hero { position: relative; overflow: hidden; background: var(--monte); color: var(--monte-ink); }
.hero .rings { position: absolute; width: 900px; height: 900px; right: -260px; top: -200px; fill: none; stroke: var(--monte-line); stroke-width: 2; }
.hero .rings .c { stroke: var(--monte-accent); stroke-width: 3; opacity: .5; }
.hero__in { position: relative; display: grid; grid-template-columns: 1.05fr 1fr; gap: var(--space-12); align-items: center; padding: var(--space-16) var(--space-4); max-width: 1200px; margin: 0 auto; }
.hero .bal-eyebrow { color: var(--monte-muted); }
.hero h1 { margin: var(--space-4) 0 var(--space-4); font-size: 64px; line-height: .95; font-weight: 800; letter-spacing: -0.02em; }
.hero h1 em { font-style: normal; color: var(--monte-accent); }
.hero p.lead { margin: 0; max-width: 480px; font-size: 18px; line-height: 1.55; color: var(--monte-muted); }
.hero .ctas { display: flex; gap: var(--space-3); flex-wrap: wrap; margin-top: var(--space-8); }
.hero__media { position: relative; }
.hero__media img { display: block; width: 100%; height: auto; aspect-ratio: 4/3.2; object-fit: cover; border-radius: var(--radius-lg); }
.live { position: absolute; left: -32px; bottom: -28px; width: 320px; background: var(--surface); color: var(--ink); border-radius: var(--radius-lg); border: 1px solid var(--line); box-shadow: var(--shadow-float); padding: var(--space-4); display: grid; grid-template-columns: auto 1fr; gap: var(--space-4); align-items: center; }
.live h3 { margin: 6px 0 2px; font-size: 16px; line-height: 1.3; }
.live p { margin: 0; font-size: 13px; color: var(--ink-muted); }
.how { padding-top: var(--space-16); padding-bottom: var(--space-12); }
.how__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-6); margin-top: var(--space-6); }
.how__item { border-top: 2px solid var(--ink); padding-top: var(--space-4); }
.how__item .n { font-family: var(--font-mono); font-size: 12px; color: var(--ink-muted); }
.how__item h3 { margin: var(--space-2) 0 var(--space-1); font-size: 20px; }
.how__item p { margin: 0; color: var(--ink-muted); font-size: 15px; }
.sec { padding-top: var(--space-12); padding-bottom: var(--space-12); }
.sec h2 { margin: var(--space-2) 0 var(--space-6); font-size: 32px; line-height: 1.1; }
.tgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); }
.rank { display: grid; grid-template-columns: 320px 1fr; gap: var(--space-8); align-items: start; }
.rank__tabs { display: flex; flex-direction: column; gap: var(--space-1); }
.rank__tabs a { display: flex; align-items: center; justify-content: space-between; min-height: 48px; padding: 0 var(--space-3); border-radius: var(--radius-md); text-decoration: none; color: var(--ink); }
.rank__tabs a:hover { background: var(--surface-2); }
.rank__tabs a[aria-current="true"] { background: var(--nock-soft); font-weight: 600; }
.rank__tabs .bal-mono { color: var(--ink-muted); }
.mods { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); }
.mod { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: var(--space-6) var(--space-4); }
.mod .glyph { width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--surface-2); color: var(--chip); display: grid; place-items: center; }
.mod .glyph .bal-ico { width: 26px; height: 26px; }
.mod h3 { margin: var(--space-4) 0 var(--space-1); font-size: 18px; }
.mod p { margin: 0; font-size: 14px; color: var(--ink-muted); }
.mod .tokens { margin-top: var(--space-3); display: flex; flex-wrap: wrap; gap: 4px; }
.mod .tokens span { font-family: var(--font-mono); font-size: 12px; font-weight: 600; min-width: 28px; height: 24px; padding: 0 6px; border-radius: var(--radius-sm); border: 1px solid var(--line); display: inline-flex; align-items: center; justify-content: center; }
.join { margin: var(--space-12) 0 var(--space-16); background: var(--nock-soft); border-radius: var(--radius-lg); padding: var(--space-12) var(--space-8); display: flex; justify-content: space-between; align-items: center; gap: var(--space-6); }
.join h2 { margin: 0 0 var(--space-2); font-size: 32px; line-height: 1.1; }
.join p { margin: 0; max-width: 520px; color: var(--ink); }
@media (max-width: 760px) {
  .bal-nav { display: none; }
  .bal-brand small { display: none; }
  .hero__in { grid-template-columns: 1fr; gap: var(--space-8); padding: var(--space-12) var(--space-4) var(--space-16); }
  .hero h1 { font-size: 40px; }
  .hero p.lead { font-size: 16px; }
  .hero .ctas { flex-direction: column; }
  .hero .ctas .bal-btn { width: 100%; }
  .hero__media img { aspect-ratio: 4/3; }
  .hero .rings { width: 560px; height: 560px; right: -260px; top: -140px; }
  .live { left: 12px; right: 12px; width: auto; bottom: -40px; }
  .how { padding-top: var(--space-16); }
  .how__grid, .tgrid, .mods { grid-template-columns: 1fr; }
  .mods { grid-template-columns: 1fr 1fr; }
  .rank { grid-template-columns: 1fr; gap: var(--space-4); }
  .rank__tabs { flex-direction: row; overflow-x: auto; }
  .rank__tabs a { white-space: nowrap; }
  .rank__tabs .bal-mono { display: none; }
  .sec h2, .join h2 { font-size: 26px; }
  .join { flex-direction: column; align-items: flex-start; padding: var(--space-8) var(--space-6); }
  .join .bal-btn { width: 100%; }
}
'''

def landing():
    t1 = tcard(status('vivo', 'En curso'), '3ª fecha · Sierra de la Ventana', '6 blancos · 8 arqueros · 3 patrullas', '08/08/2026', [('campo', 33), ('3d', 33), ('sala', 17), ('aire-libre', 17)], 'Ver en vivo')
    t2 = tcard(status('oficial', 'Resultados oficiales'), '2ª fecha · Predio CBA', '4 blancos · 12 arqueros', '12/07/2026', [('sala', 50), ('3d', 50)], 'Podios y estadísticas')
    t3 = tcard(status('oficial', 'Resultados oficiales'), '1ª fecha · Apertura', '5 blancos · 10 arqueros', '14/06/2026', [('aire-libre', 40), ('campo', 40), ('sala', 20)], 'Podios y estadísticas')
    tabs = ''.join(f'<a href="#"{" aria-current=\"true\"" if i == 0 else ""}><span style="display:flex;gap:10px;align-items:center;color:var(--cat-{s})">{{i:categoria-{s}}}<span style="color:var(--ink)">{l}</span></span><span class="bal-mono">{n}</span></a>' for i, (s, l, n) in enumerate([('recurvo', 'Recurvo olímpico', 14), ('compuesto', 'Compuesto libre', 9), ('cazador', 'Compuesto cazador', 6), ('tradicional', 'Tradicional', 7), ('longbow', 'Longbow', 4), ('razo', 'Razo', 5)]))
    rank = C['RankingTable'][1].replace('<div class="pv-col" style="max-width:640px">', '<div>')
    mods = [('sala', 'Sala 18 m', 'Bajo techo, cara de 10 zonas.', ['X', '10', '9', '8', '…', 'M']),
            ('aire-libre', 'Aire libre', 'Distancia larga según la estaca.', ['X', '10', '9', '…', '1', 'M']),
            ('campo', 'Juego de campo', 'Cara negra con centro amarillo.', ['X6', '6', '5', '4', '3', '2', '1', 'M']),
            ('3d', '3D', 'Siluetas de animales en el monte.', ['11', '10', '8', '5', 'M'])]
    modsh = ''.join(f'<div class="mod" style="--chip:var(--mod-{s})"><div class="glyph">{{i:{MODICON[s]}}}</div><h3>{t}</h3><p>{d}</p><div class="tokens">' + ''.join(f'<span>{x}</span>' for x in tk) + '</div></div>' for s, t, d, tk in mods)
    body = SITEBAR + f'''
<main>
<section class="hero">
 {RINGS_BG}
 <div class="hero__in">
  <div>
   <span class="bal-eyebrow">Temporada 2026 · Bahía Blanca</span>
   <h1 class="bal-display">La liga de <em>arquería</em> de Bahía&nbsp;Blanca.</h1>
   <p class="lead">Un torneo por mes, un recorrido por el predio. Seguí los resultados en vivo, los podios de cada fecha y el ranking de tu categoría.</p>
   <div class="ctas"><a class="bal-btn bal-btn--primario bal-btn--lg" href="#">Ver el ranking{{i:flecha}}</a><a class="bal-btn bal-btn--sobre-monte bal-btn--lg" href="#">Torneos</a></div>
  </div>
  <div class="hero__media">
   <img src="{PORTADA}" alt="" width="1120" height="630">
   <a class="live" href="#" style="text-decoration:none">{ring(6, 2, 76, False, sw=8)}<div>{status('vivo', 'En curso')}<h3>3ª fecha · Sierra de la Ventana</h3><p>3 patrullas en el recorrido</p></div></a>
  </div>
 </div>
</section>

<section class="how wrap" aria-labelledby="como">
 <span class="bal-eyebrow" id="como">Cómo se juega</span>
 <div class="how__grid">
  <div class="how__item"><span class="n">01</span><h3>Un recorrido multitarget</h3><p>Cada fecha es una vuelta por el predio con blancos de sala, aire libre, campo y 3D.</p></div>
  <div class="how__item"><span class="n">02</span><h3>En patrullas</h3><p>Grupos de 2 a 4 arqueros. El líder anota los puntajes desde el celular, con o sin señal.</p></div>
  <div class="how__item"><span class="n">03</span><h3>Ranking por categoría</h3><p>Suman las mejores fechas de la temporada, normalizadas para comparar recorridos distintos.</p></div>
 </div>
</section>

<section class="sec wrap" aria-labelledby="fechas">
 <div class="bal-section-head"><span class="bal-eyebrow">Fechas de la temporada</span><span class="bal-count">3</span><a class="bal-link" href="#">Ver todas{{i:flecha|bal-ico bal-ico--sm}}</a></div>
 <h2 class="bal-display" id="fechas">Torneos</h2>
 <div class="tgrid">{t1}{t2}{t3}</div>
</section>

<section class="sec wrap" aria-labelledby="ranking">
 <div class="bal-section-head"><span class="bal-eyebrow">Ranking de la liga</span><a class="bal-link" href="#">Ranking completo{{i:flecha|bal-ico bal-ico--sm}}</a></div>
 <h2 class="bal-display" id="ranking">Quién va adelante</h2>
 <div class="rank"><nav class="rank__tabs" aria-label="Categorías">{tabs}</nav>{rank}</div>
</section>

<section class="sec wrap" aria-labelledby="modalidades">
 <div class="bal-section-head"><span class="bal-eyebrow">Modalidades</span></div>
 <h2 class="bal-display" id="modalidades">Cuatro escenarios, un recorrido</h2>
 <div class="mods">{modsh}</div>
</section>

<section class="wrap"><div class="join">
 <div><h2 class="bal-display">Sumate al padrón</h2><p>Dejá tus datos y el club revisa tu alta antes de habilitarla. Después ya podés competir en la próxima fecha.</p></div>
 <a class="bal-btn bal-btn--primario bal-btn--lg" href="#">Sumarme al padrón{{i:flecha}}</a>
</div></section>
</main>
''' + FOOTER
    return body

PUERTA_CSS = '''
html, body { height: 100%; }
.gate { min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr; }
.gate__side { position: relative; overflow: hidden; background: var(--monte); color: var(--monte-ink); padding: var(--space-12); display: flex; flex-direction: column; justify-content: space-between; }
.gate__side .rings { position: absolute; width: 760px; height: 760px; right: -380px; top: -300px; fill: none; stroke: var(--monte-line); stroke-width: 2; }
.gate__side .rings .c { stroke: var(--monte-accent); stroke-width: 3; opacity: .5; }
.gate__brand { position: relative; display: flex; align-items: center; gap: 12px; }
.gate__brand img { width: 44px; height: 44px; }
.gate__brand span { font-family: var(--font-display); font-stretch: 125%; font-variation-settings: "wdth" 125; font-weight: 700; line-height: 1.1; }
.gate__brand small { display: block; font-family: var(--font-sans); font-variation-settings: normal; font-stretch: 100%; font-weight: 500; font-size: 13px; color: var(--monte-muted); }
.gate__claim { position: relative; }
.gate__claim h2 { margin: 0 0 var(--space-3); font-size: 44px; line-height: 1; font-weight: 800; letter-spacing: -0.02em; max-width: 480px; }
.gate__claim h2 em { font-style: normal; color: var(--monte-accent); }
.gate__claim p { margin: 0; color: var(--monte-muted); max-width: 420px; }
.gate__main { display: flex; flex-direction: column; justify-content: center; padding: var(--space-12) var(--space-8); }
.gate__box { width: 100%; max-width: 440px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--space-3); }
.gate__box h1 { margin: var(--space-2) 0 var(--space-4); font-size: 32px; line-height: 1.1; }
.gate__more { display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-4); }
.install { margin-top: var(--space-6); display: flex; gap: var(--space-3); align-items: center; padding: var(--space-3) var(--space-4); border: 1px dashed var(--line-strong); border-radius: var(--radius-lg); }
.install p { margin: 0; flex: 1; font-size: 14px; }
.install p strong { display: block; font-size: 15px; }
.install .bal-muted { font-size: 13px; }
.gate__foot { display: flex; justify-content: space-between; margin-top: var(--space-8); font-size: 12px; color: var(--ink-muted); }
@media (max-width: 760px) {
  .gate { grid-template-columns: 1fr; min-height: 0; }
  .gate__side { padding: var(--space-6) var(--space-4) var(--space-8); gap: var(--space-8); }
  .gate__side .rings { width: 420px; height: 420px; right: -200px; top: -200px; }
  .gate__claim h2 { font-size: 30px; }
  .gate__claim p { font-size: 15px; }
  .gate__main { padding: var(--space-6) var(--space-4) var(--space-8); justify-content: flex-start; }
  .gate__box h1 { font-size: 24px; margin-bottom: var(--space-2); }
  .install .bal-btn { padding: 0 12px; }
}
'''

def puerta():
    roles = C['RoleCard'][1].replace('<div class="pv-col" style="max-width:440px">', '').rsplit('</div>', 1)[0]
    return f'''<div class="gate">
 <aside class="gate__side">
  {RINGS_BG}
  <div class="gate__brand"><img src="{LIGA}" alt=""><span>Liga Bahiense<small>de Arquería</small></span></div>
  <div class="gate__claim"><h2 class="bal-display">Anotá, sincronizá y <em>publicá</em>.</h2><p>La app del día del torneo. Guarda todo en el celular y envía cuando hay señal.</p></div>
 </aside>
 <main class="gate__main"><div class="gate__box">
  <span class="bal-eyebrow">Ingresar</span>
  <h1 class="bal-display">¿Cómo entrás hoy?</h1>
  {roles}
  <div class="gate__more"><a class="bal-link" href="#">{{i:volver|bal-ico bal-ico--sm}}Ver resultados y rankings</a></div>
  <div class="install"><span style="color:var(--nock-text)">{{i:instalar|bal-ico bal-ico--lg}}</span><p><strong>Instalá la app</strong><span class="bal-muted">Abre directo acá y funciona sin señal.</span></p><button class="bal-btn bal-btn--secundario bal-btn--sm">Instalar</button></div>
  <div class="gate__foot"><span>Círculo Bahiense de Arquería</span><span class="bal-mono">v2026.11</span></div>
 </div></main>
</div>'''

WAFA_CSS = '''
.scr { padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-6); }
.quick { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); }
.quick a { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-2); min-height: 88px; padding: var(--space-3); border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--surface); text-decoration: none; color: var(--ink); font-weight: 600; font-size: 15px; }
.quick a .bal-ico { color: var(--nock-text); }
.quick a small { font-family: var(--font-mono); font-weight: 400; font-size: 11px; color: var(--ink-muted); }
.grp { display: flex; flex-direction: column; gap: var(--space-3); }
.empty { padding: var(--space-4); border: 1px dashed var(--line-strong); border-radius: var(--radius-lg); color: var(--ink-muted); font-size: 14px; }
.patrols { display: flex; gap: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--line); }
.patrols div { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-muted); }
'''

def wafa():
    t_live = f'''<a class="bal-card bal-tcard" href="#">
  <div class="bal-tcard__top">{status('vivo', 'En curso')}<span class="bal-mono bal-muted">08/08/2026</span></div>
  <div><h3 class="bal-tcard__title">3ª fecha · Sierra de la Ventana</h3><p class="bal-tcard__meta">6 blancos · 8 arqueros · 3 patrullas</p></div>
  <div class="patrols"><div>{ring(6, 4, 36, False, sw=5)}P1 · 4/6</div><div>{ring(6, 2, 36, False, start=2, sw=5)}P2 · 2/6</div><div>{ring(6, 5, 36, False, start=4, sw=5)}P3 · 5/6</div></div>
</a>'''
    t_next = tcard(status('sin', 'Sin iniciar'), '4ª fecha · Predio CBA', '5 blancos · 10 arqueros · 3 patrullas', '13/09/2026', [('sala', 40), ('3d', 40), ('campo', 20)], 'Armar patrullas')
    return f'''<header class="bal-appbar"><img src="{LIGA}" alt="" width="28" height="28"><div class="bal-appbar__title"><span>Administración</span><strong>Inicio</strong></div><div class="bal-appbar__end"><button class="bal-iconbtn" aria-label="Cambiar a tema oscuro">{{i:accion-luna}}</button><button class="bal-iconbtn" aria-label="Cerrar sesión">{{i:accion-salir}}</button></div></header>
<main class="scr">
 <button class="bal-btn bal-btn--primario bal-btn--block">{{i:accion-agregar}}Crear torneo</button>
 <nav class="quick" aria-label="Secciones">
  <a href="#">{{i:arqueros}}Arqueros<small>42 · 2 altas</small></a>
  <a href="#">{{i:calendario}}Temporadas<small>2026</small></a>
  <a href="#">{{i:podio}}Ranking<small>8 categorías</small></a>
 </nav>
 <section class="grp"><div class="bal-section-head"><span class="bal-eyebrow">En proceso</span><span class="bal-count">1</span></div>{t_live}</section>
 <section class="grp"><div class="bal-section-head"><span class="bal-eyebrow">Sin iniciar</span><span class="bal-count">1</span></div>{t_next}</section>
 <section class="grp"><div class="bal-section-head"><span class="bal-eyebrow">Esperando publicación</span><span class="bal-count">0</span></div><p class="empty">Cuando una patrulla cierre su circuito, el torneo aparece acá para publicar.</p></section>
</main>'''

WAFL_CSS = '''
body { display: flex; flex-direction: column; min-height: 100vh; }
.thead { padding: var(--space-4) var(--space-4) var(--space-2); display: flex; align-items: center; gap: var(--space-4); }
.thead .num { font-family: var(--font-display); font-stretch: 125%; font-variation-settings: "wdth" 125; font-weight: 800; font-size: 56px; line-height: 1; }
.thead .meta { display: flex; flex-direction: column; gap: 6px; }
.thead .meta span { font-size: 14px; color: var(--ink-muted); }
.list { flex: 1; padding: var(--space-2) var(--space-4) var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); }
.dock { position: sticky; bottom: 0; }
'''

def wafl():
    return f'''<header class="bal-appbar"><button class="bal-appbar__back">{{i:volver}}Blancos</button><div class="bal-appbar__title"><span>Patrulla 1</span><strong>3ª fecha</strong></div><div class="bal-appbar__end"><button class="bal-sync bal-sync--ok" aria-live="polite">{{i:accion-tilde}}Al día</button></div></header>
<div class="thead"><span class="num" aria-label="Blanco 1">1</span><div class="meta">{mod('3d', '3D')}<span>2 flechas · Jabalí · 1 de 6</span></div></div>
<main class="list">{UNITS}
<div class="bal-unit"><div><p class="bal-unit__name">Gauna, Martín</p><div class="bal-unit__sub"><span class="bal-mono">UNIDAD B</span><span class="bal-stake" style="--stake:var(--stake-roja);height:24px;font-size:12px">Estaca Roja</span></div></div><div class="bal-unit__total"><strong>—</strong><span>total</span></div><div class="bal-arrows"><span class="bal-arrow"></span><span class="bal-arrow"></span></div></div>
</main>
<div class="dock">{KEYPAD}</div>'''

PAGES = {
  'Landing': ('<!-- @dsCard group="Pantallas" page height=3000 width=1280 subtitle="landing / · escritorio" -->', landing, LANDING_CSS),
  'LandingMovil': ('<!-- @dsCard group="Pantallas" page height=3900 width=390 subtitle="landing / · celular" -->', landing, LANDING_CSS),
  'Puerta': ('<!-- @dsCard group="Pantallas" page height=820 width=1280 subtitle="/app · escritorio" -->', puerta, PUERTA_CSS),
  'PuertaMovil': ('<!-- @dsCard group="Pantallas" page height=1040 width=390 subtitle="/app · celular" -->', puerta, PUERTA_CSS),
  'WafaInicio': ('<!-- @dsCard group="Pantallas" page height=1080 width=390 subtitle="Admin · inicio (cambios simples)" -->', wafa, WAFA_CSS),
  'WaflBlanco': ('<!-- @dsCard group="Pantallas" page height=920 width=390 subtitle="Líder · blanco (cambios simples)" -->', wafl, WAFL_CSS),
}
