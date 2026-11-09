LIGA = '/_blob/eac7217a70630c1849567f37fa029721'
CBA = '/_blob/7feb2bebddc261a3ca0459cc42cbae08'
PORTADA = '/_blob/566325a619778cf0b4120417cf5ab998'

def doc(marker, body, style='', title='preview', bodycls=''):
    return f'''{marker}
<!doctype html>
<html lang="es-AR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{title}</title>
<style>
.pv {{ padding: 16px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }}
.pv-col {{ padding: 16px; display: flex; flex-direction: column; gap: 12px; }}
{style}
</style></head>
<body class="{bodycls}">
{body}
</body>
</html>
'''

def cat(slug, label, sm=False):
    return f'<span class="bal-chip bal-chip--cat{" bal-chip--sm" if sm else ""}" style="--chip:var(--cat-{slug})">{{i:categoria-{slug}}}{label}</span>'

def mod(slug, label, pct=None, sm=False):
    p = f' <b>{pct}%</b>' if pct is not None else ''
    icon = {'sala': 'modalidad-sala', 'aire-libre': 'modalidad-aire-libre', 'campo': 'modalidad-campo', '3d': 'modalidad-3d'}[slug]
    return f'<span class="bal-chip bal-chip--mod{" bal-chip--sm" if sm else ""}" style="--chip:var(--mod-{slug})">{{i:{icon}}}{label}{p}</span>'

MODLABEL = {'sala': '18 m', 'aire-libre': 'Aire libre', 'campo': 'Campo', '3d': '3D'}
MODICON = {'sala': 'modalidad-sala', 'aire-libre': 'modalidad-aire-libre', 'campo': 'modalidad-campo', '3d': 'modalidad-3d'}

def modbar(parts):
    track = ''.join(f'<span style="--chip:var(--mod-{s});flex:{p}"></span>' for s, p in parts)
    legend = ''.join(f'<span style="--chip:var(--mod-{s})">{{i:{MODICON[s]}}}{MODLABEL[s]} <b>{p}%</b></span>' for s, p in parts)
    return f'<div class="bal-modbar"><div class="bal-modbar__track" role="img" aria-label="Distribución de modalidades: ' + ', '.join(f'{MODLABEL[s]} {p}%' for s, p in parts) + f'">{track}</div><div class="bal-modbar__legend">{legend}</div></div>'

def status(kind, label, extra=''):
    k = {'vivo': ' bal-status--vivo', 'completo': ' bal-status--completo', 'oficial': ' bal-status--oficial', 'sin': ''}[kind]
    return f'<span class="bal-status{k}{extra}">{label}</span>'

def tcard(st, title, meta, date, parts, foot='Ver resultados', href='#'):
    return f'''<a class="bal-card bal-tcard" href="{href}">
  <div class="bal-tcard__top">{st}<span class="bal-mono bal-muted">{date}</span></div>
  <div><h3 class="bal-tcard__title">{title}</h3><p class="bal-tcard__meta">{meta}</p></div>
  {modbar(parts)}
  <div class="bal-tcard__foot"><span class="bal-muted">{foot}</span><span class="bal-link" style="min-height:auto">{{i:flecha|bal-ico bal-ico--sm}}</span></div>
</a>'''

def ring(total, done, size=120, label=True, start=0, sw=10):
    import math
    r = (size - sw) / 2 - 2
    cx = cy = size / 2
    gap = 4  # grados
    segs = []
    for i in range(total):
        a0 = -90 + i * 360 / total + gap / 2
        a1 = -90 + (i + 1) * 360 / total - gap / 2
        x0, y0 = cx + r * math.cos(math.radians(a0)), cy + r * math.sin(math.radians(a0))
        x1, y1 = cx + r * math.cos(math.radians(a1)), cy + r * math.sin(math.radians(a1))
        large = 1 if (a1 - a0) > 180 else 0
        ok = ' ok' if ((i - start) % total) < done else ''
        segs.append(f'<path class="seg{ok}" style="stroke-width:{sw}" d="M{x0:.2f} {y0:.2f} A{r:.2f} {r:.2f} 0 {large} 1 {x1:.2f} {y1:.2f}"/>')
    lab = f'<div class="bal-ring__label"><strong>{done}/{total}</strong><span>blancos</span></div>' if label else ''
    return f'<div class="bal-ring" role="img" aria-label="{done} de {total} blancos cargados"><svg width="{size}" height="{size}" viewBox="0 0 {size} {size}">{"".join(segs)}<path class="start" d="M{cx-5} 0 h10 l-5 6 z"/></svg>{lab}</div>'

C = {}

C['Button'] = ('<!-- @dsCard group="Acciones" height=220 subtitle="primario · secundario · fantasma · peligro" -->', '''
<div class="pv-col">
 <div class="pv" style="padding:0">
  <button class="bal-btn bal-btn--primario">Crear torneo</button>
  <button class="bal-btn bal-btn--secundario">{i:arqueros}Arqueros</button>
  <button class="bal-btn bal-btn--fantasma">Cancelar</button>
  <button class="bal-btn bal-btn--peligro">{i:accion-eliminar}Eliminar patrulla</button>
 </div>
 <div class="pv" style="padding:0">
  <button class="bal-btn bal-btn--primario bal-btn--sm">Publicar</button>
  <button class="bal-btn bal-btn--secundario bal-btn--sm">{i:accion-copiar}Copiar credenciales</button>
  <button class="bal-btn bal-btn--primario" disabled>Resultados finales</button>
 </div>
 <div style="max-width:360px"><button class="bal-btn bal-btn--primario bal-btn--block">Continuar{i:flecha}</button></div>
</div>''')

C['IconButton'] = ('<!-- @dsCard group="Acciones" height=88 -->', '''
<div class="pv">
 <button class="bal-iconbtn" aria-label="Cambiar a tema oscuro">{i:accion-luna}</button>
 <button class="bal-iconbtn" aria-label="Cerrar sesión">{i:accion-salir}</button>
 <button class="bal-iconbtn" aria-label="Editar torneo">{i:accion-editar}</button>
 <button class="bal-iconbtn" aria-label="Subir el blanco 3">{i:accion-subir}</button>
 <button class="bal-iconbtn" aria-label="Bajar el blanco 3">{i:accion-bajar}</button>
</div>''')

C['Field'] = ('<!-- @dsCard group="Formularios" height=280 -->', '''
<div class="pv-col" style="max-width:420px">
 <div class="bal-field"><label for="u">Usuario de patrulla</label><input class="bal-input" id="u" value="patrulla-03" autocomplete="username" spellcheck="false"><p class="bal-hint">Lo encontrás en la credencial que te dio el admin.</p></div>
 <div class="bal-field"><label for="p">PIN</label><input class="bal-input" id="p" value="48" inputmode="numeric" aria-invalid="true" aria-describedby="pe"><p class="bal-error" id="pe" role="alert">{i:accion-aviso|bal-ico bal-ico--sm}El PIN tiene 4 dígitos.</p></div>
</div>''')

C['StakeChip'] = ('<!-- @dsCard group="Datos" height=72 subtitle="semántica reservada" -->', '''
<div class="pv">
 <span class="bal-stake" style="--stake:var(--stake-roja)">Estaca Roja</span>
 <span class="bal-stake" style="--stake:var(--stake-azul)">Estaca Azul</span>
 <span class="bal-stake" style="--stake:var(--stake-amarilla)">Estaca Amarilla</span>
 <span class="bal-stake" style="--stake:var(--stake-naranja)">Estaca Naranja</span>
</div>''')

C['ChipCategoria'] = ('<!-- @dsCard group="Datos" height=120 subtitle="píldora" -->', '<div class="pv">' + ''.join(cat(s, l) for s, l in [('recurvo', 'Recurvo olímpico'), ('compuesto', 'Compuesto libre'), ('cazador', 'Compuesto cazador'), ('razo', 'Razo'), ('tradicional', 'Tradicional'), ('longbow', 'Longbow'), ('escuela', 'Escuela'), ('principiantes', 'Principiantes')]) + cat('recurvo', 'Recurvo', True) + '</div>')

C['ChipModalidad'] = ('<!-- @dsCard group="Datos" height=88 subtitle="rectángulo" -->', '<div class="pv">' + mod('sala', '18 m') + mod('aire-libre', 'Aire libre') + mod('campo', 'Campo') + mod('3d', '3D', 33) + mod('3d', '3D', sm=True) + '</div>')

C['BadgeEstado'] = ('<!-- @dsCard group="Datos" height=72 subtitle="estado del torneo" -->', '<div class="pv">' + status('sin', 'Sin iniciar') + status('vivo', 'En curso') + status('completo', 'Esperando publicación') + status('oficial', 'Resultados oficiales') + '</div>')

C['ModalityBar'] = ('<!-- @dsCard group="Datos" height=100 subtitle="nuevo" -->', '<div class="pv-col" style="max-width:420px">' + modbar([('campo', 33), ('3d', 33), ('sala', 17), ('aire-libre', 17)]) + '</div>')

C['CircuitRing'] = ('<!-- @dsCard group="Datos" height=170 subtitle="elemento de firma" -->', '<div class="pv" style="gap:32px">' + ring(6, 2) + ring(14, 9, 120) + '<div style="display:flex;gap:12px;align-items:center">' + ring(6, 4, 44, False, sw=6) + '<span class="bal-muted" style="font-size:14px">Patrulla 2 · 4 de 6</span></div></div>')

C['RankingTable'] = ('<!-- @dsCard group="Datos" height=380 subtitle="ranking de la liga" -->', '''
<div class="pv-col" style="max-width:640px">
<table class="bal-rank">
 <thead><tr><th>#</th><th>Arquero</th><th>Fechas</th><th class="pts">Puntos</th></tr></thead>
 <tbody>
  <tr class="podio"><td class="pos"><span>1</span></td><td><a href="#">Esquivel, Julián</a></td><td class="bal-mono">3/3</td><td class="pts">94,2%</td></tr>
  <tr class="podio"><td class="pos"><span>2</span></td><td><a href="#">Ferreyra, Camila</a></td><td class="bal-mono">3/3</td><td class="pts">91,8%</td></tr>
  <tr class="podio"><td class="pos"><span>3</span></td><td><a href="#">Gauna, Martín</a></td><td class="bal-mono">2/3</td><td class="pts">88,5%</td></tr>
  <tr><td class="pos">4</td><td><a href="#">Ibarra, Lucía</a></td><td class="bal-mono">3/3</td><td class="pts">85,0%</td></tr>
  <tr><td class="pos">5</td><td><a href="#">Paz, Tomás</a></td><td class="bal-mono">2/3</td><td class="pts">79,4%</td></tr>
 </tbody>
</table></div>''')

C['Tarjeta'] = ('<!-- @dsCard group="Contenedores" height=150 subtitle="base · anidada" -->', '''
<div class="pv" style="align-items:stretch">
 <div class="bal-card bal-card--amplia" style="width:260px"><strong>Base</strong><p class="bal-muted" style="margin:4px 0 0;font-size:14px">surface + borde line, radius-lg.</p></div>
 <div class="bal-card bal-card--amplia bal-card--anidada" style="width:260px"><strong>Anidada</strong><p class="bal-muted" style="margin:4px 0 0;font-size:14px">surface-2, dentro de otra tarjeta.</p></div>
</div>''')

C['SectionHeader'] = ('<!-- @dsCard group="Contenedores" height=96 subtitle="nuevo" -->', '''
<div class="pv-col" style="max-width:520px">
 <div class="bal-section-head"><span class="bal-eyebrow">En proceso</span><span class="bal-count">1</span></div>
 <div class="bal-section-head"><span class="bal-eyebrow">Fechas de la temporada</span><span class="bal-count">3</span><a class="bal-link" href="#">Ver todas{i:flecha|bal-ico bal-ico--sm}</a></div>
</div>''')

C['TournamentCard'] = ('<!-- @dsCard group="Contenedores" height=270 -->',
  '<div class="pv" style="align-items:stretch">' +
  '<div style="width:360px">' + tcard(status('vivo', 'En curso'), '3ª fecha · Sierra de la Ventana', '6 blancos · 8 arqueros · 3 patrullas', '08/08/2026', [('campo', 33), ('3d', 33), ('sala', 17), ('aire-libre', 17)], 'Ver en vivo') + '</div>' +
  '<div style="width:360px">' + tcard(status('oficial', 'Resultados oficiales'), '2ª fecha · Predio CBA', '4 blancos · 12 arqueros', '12/07/2026', [('sala', 50), ('3d', 50)], 'Podios y estadísticas') + '</div></div>')

C['RoleCard'] = ('<!-- @dsCard group="Contenedores" height=250 subtitle="puerta /app" -->', '''
<div class="pv-col" style="max-width:440px">
 <a class="bal-role bal-role--principal" href="#"><span class="bal-role__icon">{i:accion-editar}</span><span><p class="bal-role__title">Soy líder de patrulla</p><p class="bal-role__desc">Anotá los puntajes del recorrido.</p><span class="bal-role__tag">Funciona sin señal</span></span><span class="bal-role__chev">{i:chevron}</span></a>
 <a class="bal-role" href="#"><span class="bal-role__icon">{i:panel}</span><span><p class="bal-role__title">Soy administrador</p><p class="bal-role__desc">Torneos, patrullas, padrón y publicación.</p></span><span class="bal-role__chev">{i:chevron}</span></a>
</div>''')

SITEBAR = '''<header class="bal-sitebar"><div class="bal-sitebar__in">
 <a class="bal-brand" href="#"><img src="''' + LIGA + '''" alt=""><span>Liga Bahiense<small>de Arquería</small></span></a>
 <nav class="bal-nav" aria-label="Principal"><a href="#" aria-current="page">Inicio</a><a href="#">Ranking</a><a href="#">Torneos</a><a href="#">Sumate</a></nav>
 <div class="bal-sitebar__end"><button class="bal-iconbtn" aria-label="Cambiar a tema oscuro">{i:accion-luna}</button><a class="bal-btn bal-btn--secundario bal-btn--sm" href="#">Ingresar</a></div>
</div></header>'''

C['SiteHeader'] = ('<!-- @dsCard group="Navegación" height=96 width=1200 subtitle="landing" -->', SITEBAR)

C['AppHeader'] = ('<!-- @dsCard group="Navegación" height=150 subtitle="WAFA · WAFL" -->', '''
<div style="max-width:420px;display:flex;flex-direction:column;gap:12px;padding:12px 0">
<header class="bal-appbar"><img src="''' + LIGA + '''" alt="" width="28" height="28"><div class="bal-appbar__title"><span>Administración</span><strong>Inicio</strong></div><div class="bal-appbar__end"><button class="bal-iconbtn" aria-label="Cambiar a tema oscuro">{i:accion-luna}</button><button class="bal-iconbtn" aria-label="Cerrar sesión">{i:accion-salir}</button></div></header>
<header class="bal-appbar"><button class="bal-appbar__back">{i:volver}Blancos</button><div class="bal-appbar__title"><span>Blanco 1 de 6</span><strong>Jabalí</strong></div><div class="bal-appbar__end"><button class="bal-sync bal-sync--ok" aria-live="polite">{i:accion-tilde}Al día</button></div></header>
</div>''')

C['SyncBadge'] = ('<!-- @dsCard group="Navegación" height=72 subtitle="cuatro estados" -->', '''
<div class="pv">
 <button class="bal-sync bal-sync--ok">{i:accion-tilde}Al día</button>
 <button class="bal-sync bal-sync--pendiente">{i:sincronizar}3 por enviar</button>
 <button class="bal-sync bal-sync--offline">{i:sin-senal}Sin señal · 12 guardados</button>
 <button class="bal-sync bal-sync--error">{i:accion-aviso}No se pudo enviar</button>
</div>''')

FOOTER = '''<footer class="bal-footer">
 <div class="bal-footer__in">
  <div><div class="bal-footer__logos"><img class="bal-cba" src="''' + CBA + '''" alt="Círculo Bahiense de Arquería"><img src="''' + LIGA + '''" alt=""></div>
   <p class="bal-muted" style="max-width:340px;font-size:14px;margin:12px 0 0">Liga Bahiense de Arquería. Un torneo por mes en Bahía Blanca: recorridos multitarget con sala, aire libre, campo y 3D.</p></div>
  <div><h4 class="bal-eyebrow">La liga</h4><ul><li><a href="#">Ranking</a></li><li><a href="#">Torneos</a></li><li><a href="#">Sumate al padrón</a></li></ul></div>
  <div><h4 class="bal-eyebrow">Acceso</h4><ul><li><a href="#">Líderes de patrulla</a></li><li><a href="#">Administración</a></li></ul></div>
 </div>
 <div class="bal-footer__legal"><span>Círculo Bahiense de Arquería · Bahía Blanca</span><span class="bal-mono">Temporada 2026</span></div>
</footer>'''

C['Footer'] = ('<!-- @dsCard group="Navegación" height=320 width=1200 subtitle="estático, al final del documento" -->', FOOTER)

UNITS = '''
<div class="bal-unit bal-unit--activa"><div><p class="bal-unit__name">Esquivel, Julián</p><div class="bal-unit__sub"><span class="bal-mono">UNIDAD A · TIRA 1º</span><span class="bal-stake" style="--stake:var(--stake-azul);height:24px;font-size:12px">Estaca Azul</span></div></div><div class="bal-unit__total"><strong aria-live="polite">11</strong><span>total</span></div><div class="bal-arrows"><span class="bal-arrow bal-arrow--llena">11</span><span class="bal-arrow bal-arrow--siguiente" aria-label="Flecha 2, siguiente"></span></div></div>
<div class="bal-unit"><div><p class="bal-unit__name">Ferreyra, Camila</p><div class="bal-unit__sub"><span class="bal-mono">UNIDAD A</span><span class="bal-stake" style="--stake:var(--stake-azul);height:24px;font-size:12px">Estaca Azul</span></div></div><div class="bal-unit__total"><strong>—</strong><span>total</span></div><div class="bal-arrows"><span class="bal-arrow"></span><span class="bal-arrow"></span></div></div>'''

C['UnitCard'] = ('<!-- @dsCard group="Scoring" height=300 subtitle="unidad de tiro + flechas" -->', '<div class="pv-col" style="max-width:420px">' + UNITS + '</div>')

KEYPAD = '''<div class="bal-keypad">
 <div class="bal-keypad__grid"><button class="bal-key bal-key--centro">11</button><button class="bal-key">10</button><button class="bal-key">8</button><button class="bal-key">5</button><button class="bal-key bal-key--m" aria-label="Errada (M)">M</button></div>
 <div class="bal-keypad__cta"><button class="bal-btn bal-btn--primario bal-btn--block" disabled>Continuar</button></div>
 <p class="bal-keypad__hint">Falta cargar: Esquivel (1), Ferreyra, Gauna</p>
</div>'''

C['ScoreKeypad'] = ('<!-- @dsCard group="Scoring" height=300 subtitle="3D · grilla" -->', '<div style="max-width:420px;padding-top:16px">' + KEYPAD + '</div>')
