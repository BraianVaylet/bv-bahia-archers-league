import os, json, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from icons_extra import render
from components import C, doc
from pages import PAGES
from readmes import R
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'salida')  # previews en formato Design System
names = []
for n, (marker, body) in C.items():
    os.makedirs(f'{root}/{n}', exist_ok=True)
    open(f'{root}/{n}/preview.html', 'w').write(render(doc(marker, body, title=n)))
    names.append(n)
for n, (marker, fn, css) in PAGES.items():
    os.makedirs(f'{root}/{n}', exist_ok=True)
    open(f'{root}/{n}/preview.html', 'w').write(render(doc(marker, fn(), style=css, title=n)))
    names.append(n)
for n in names:
    open(f'{root}/{n}/README.md', 'w').write(f'# {n}\n\n' + R[n])
missing = [n for n in names if n not in R]
print(len(names), 'missing readmes', missing)
# leftover placeholders?
import re, glob
for f in glob.glob(f'{root}/*/preview.html'):
    t = open(f).read()
    if re.search(r'\{i:', t) or '{{' in t: print('PLACEHOLDER', f)
