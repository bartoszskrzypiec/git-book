#!/usr/bin/env python3
"""Wstawia tresc w miejsce znacznika <!-- TRESC --> na gotowej stronie.

    python dev/wstaw.py rozdzialy/rozdzial-13-amend.html tresc.html

Nie generuje strony i nie dotyka naglowka ani nawigacji — te powstaja raz,
w scaffold.py, i sa potem utrzymywane recznie. Ten skrypt istnieje tylko po
to, zeby nie przepisywac szkieletu przy kazdym pisanym rozdziale.

Odmawia pracy, gdy znacznika juz nie ma: nadpisanie napisanego rozdzialu
bylo najlatwiejszym sposobem na strate godziny pracy.
"""
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if len(sys.argv) != 3:
    print(__doc__)
    sys.exit(2)

strona = os.path.join(ROOT, sys.argv[1].replace('/', os.sep))
html = io.open(strona, encoding='utf-8').read()
if '<!-- TRESC -->' not in html:
    print('ODMOWA: %s nie ma juz znacznika <!-- TRESC -->' % sys.argv[1])
    sys.exit(1)

tresc = io.open(sys.argv[2], encoding='utf-8').read().rstrip('\n')
nowy = html.replace('  <!-- TRESC -->', tresc)

# Strona z widgetem potrzebuje silnika. Dopisujemy import tutaj, zamiast
# pamietac o nim przy kazdym rozdziale — zapomniany import daje pusta ramke,
# ktora wyglada dokladnie jak widget bez scenariusza.
SILNIK = ('<script type="module">\n'
          "  import { montuj } from '../assets/gitgraph.js';\n"
          '  montuj();\n'
          '</script>\n')
if 'class="gitviz"' in nowy and 'gitgraph.js' not in nowy:
    nowy = nowy.replace('</body>', SILNIK + '</body>')

io.open(strona, 'w', encoding='utf-8', newline='\n').write(nowy)
print('wstawione: %s (%d znakow)%s' % (
    sys.argv[1], len(tresc), '  + silnik gitgraph' if SILNIK in nowy else ''))
