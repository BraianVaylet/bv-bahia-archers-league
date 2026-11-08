import json, os, re
ICONS = json.load(open(os.path.join(os.path.dirname(__file__), 'iconos.json')))
# Glifos nuevos (no existen en @bal/ui): mismo estilo, 24px, trazo 1.8.
EXTRA = {
  'chevron': '<path d="m9 6 6 6-6 6"/>',
  'flecha': '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  'volver': '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
  'sincronizar': '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M4 4v4h4M20 20v-4h-4"/>',
  'sin-senal': '<path d="M3 3l18 18"/><path d="M8.5 6.3A6 6 0 0 1 17.7 10H18a4 4 0 0 1 2.3 7.3"/><path d="M16 19H7a5 5 0 0 1-2.2-9.5"/>',
  'panel': '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  'podio': '<path d="M3 20h18"/><path d="M5 20v-6h4.5v6"/><path d="M9.5 20V8h5v12"/><path d="M14.5 20v-9H19v9"/>',
  'arqueros': '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  'calendario': '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  'lugar': '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  'instalar': '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  'patrulla': '<path d="M12 3v4"/><circle cx="12" cy="13" r="7"/><circle cx="12" cy="13" r="3"/>',
}
def ico(name, cls='bal-ico'):
    inner = ICONS.get(name) or EXTRA[name]
    return f'<svg class="{cls}" viewBox="0 0 24 24" aria-hidden="true">{inner}</svg>'
def render(s):
    return re.sub(r'\{i:([a-z0-9-]+)(?:\|([a-z- ]+))?\}', lambda m: ico(m.group(1), m.group(2) or 'bal-ico'), s)
