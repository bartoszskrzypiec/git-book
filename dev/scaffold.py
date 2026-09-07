#!/usr/bin/env python3
"""
Narzedzie deweloperskie. NIE jest krokiem budowania — ksiazka to statyczne
pliki HTML i nic ich nie generuje w locie.

Robi dwie rzeczy:

  python dev/scaffold.py szkielet   — tworzy BRAKUJACE strony z pelnym
        naglowkiem, nawigacja i stopka, zostawiajac w srodku znacznik
        <!-- TRESC -->. Istniejacych plikow NIE RUSZA, nigdy. Tresc pisze
        sie potem recznie, w miejscu.

  python dev/scaffold.py sprawdz    — kontrola spojnosci: martwe linki,
        zgodnosc nawigacji gornej z dolna, obustronna zgodnosc EXT OF
        z blokami "Idz glebiej", brakujace bloki obowiazkowe, dlugosc
        rozdzialu, widgety .gitviz bez scenariusza, tresci firmowe.

Przy czterdziestu stronach z recznie utrzymywana nawigacja "sprawdz"
to jedyny sposob, zeby zlapac literowke w linku "Nastepny".

Zaadaptowane z optyka_book/dev/scaffold.py. Roznice: nie ma katalogu
matematyka/ ani niczego 3D (zadnego viz3d.css, sky3d-fallback.js), nie ma
kontroli wzorow, jest kontrola widgetow .gitviz i kontrola zakazanych slow.
"""

import json
import os
import re
import sys

# Narzedzia dev importuja sie nawzajem, a Python cache'uje bytecode. Po edycji
# slowa.py (np. zmianie progu) scaffold.py potrafil wczytac STARY .pyc i
# raportowac nieaktualny wynik - co przy kontroli, ktora ma byc brama przed
# commitem, jest gorsze niz brak kontroli. Zadnych .pyc dla tych skryptow.
sys.dont_write_bytecode = True

# Konsola Windows startuje w cp1250 i wywraca sie na pierwszej lepszej
# strzalce, a tresc ksiazki jest ich pelna. Bez tego "sprawdz" potrafi
# przerwac raport w polowie wyjatkiem zamiast pokazac problemy.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPIS = json.load(open(os.path.join(ROOT, 'dev', 'spis.json'), encoding='utf-8'))

FONTS = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700'
    '&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">'
)
MARKA = SPIS['marka']


def head(title, depth=1):
    up = '../' * depth
    return (
        '<!DOCTYPE html>\n<html lang="pl">\n<head>\n'
        '<meta charset="UTF-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        f'<title>{title}</title>\n'
        f'{FONTS}\n'
        f'<link rel="stylesheet" href="{up}assets/style.css">\n'
        f'<link rel="stylesheet" href="{up}assets/widgets.css">\n'
        f'<link rel="stylesheet" href="{up}assets/gitviz.css">\n'
        '</head>\n<body>\n'
    )


def topnav(links, depth=1):
    up = '../' * depth
    inner = '\n  '.join(f'<a href="{h}">{t}</a>' for t, h in links)
    return (
        '<nav class="topnav">\n'
        f'  <a class="topnav__brand" href="{up}index.html">{MARKA[0]} <span>{MARKA[1]}</span></a>\n'
        f'  <div class="topnav__links">\n  {inner}\n  </div>\n'
        '</nav>\n'
    )


def readout(chips):
    inner = ''.join(f'<span>{c}</span>' for c in chips)
    return f'  <div class="viewport-readout">\n    {inner}\n  </div>\n'


def deeper_block(items, depth=1):
    """Blok 'Idz glebiej'. Budowany z odwrotnosci mapy EXT OF."""
    if not items:
        return ''
    up = '../' * depth
    rows = '\n    '.join(
        f'<a href="{up}dodatki/{d["slug"]}.html">Dodatek {d["l"].upper()} — {d["tytul"]}</a>'
        for d in items
    )
    return ('  <div class="deeper">\n'
            '    <div class="deeper-label">Idź głębiej</div>\n'
            f'    {rows}\n  </div>\n')


def rozdzial_page(ch, prev_ch, next_ch, dodatki_for):
    links = [('Spis treści', '../index.html')]
    if prev_ch:
        links.append(('← Poprzedni', f'{prev_ch["slug"]}.html'))
    if next_ch:
        links.append(('Następny →', f'{next_ch["slug"]}.html'))

    nav_rows = []
    if prev_ch:
        nav_rows.append(f'      <a class="nav-prev" href="{prev_ch["slug"]}.html">← Poprzedni</a>')
    nav_rows.append('      <a class="nav-toc" href="../index.html">Spis treści</a>')
    if next_ch:
        nav_rows.append(f'      <a class="nav-next" href="{next_ch["slug"]}.html">Następny →</a>')

    return (
        head(f'Rozdział {ch["nr"]} — {ch["tytul"]}')
        + topnav(links)
        + '\n<div class="page">\n\n'
        + readout(ch['readout'])
        + f'\n  <div class="eyebrow">Rozdział {ch["nr"]} / {ch["eyebrow"]}</div>\n'
        + f'  <h1>{ch["tytul"]}</h1>\n'
        + f'  <p class="subtitle">{ch["hook"]}</p>\n\n'
        + '  <!-- TRESC -->\n\n'
        + deeper_block(dodatki_for)
        + '\n  <div class="site-nav chapter-nav">\n'
        + '\n'.join(nav_rows)
        + '\n  </div>\n\n'
        + '</div>\n\n'
        + '<script src="../assets/interactive.js"></script>\n'
        + '</body>\n</html>\n'
    )


def dodatek_page(d, ch_by_nr):
    first = ch_by_nr[d['ext'][0]]
    ext_label = 'EXT OF · ' + ', '.join(f'R.{n}' for n in d['ext'])
    chips = ['Dodatek ' + d['l'].upper(), 'Poziom · głębiej',
             'Format · referencja', ext_label]
    links = [('← Spis treści', '../index.html')]
    return (
        head(f'Dodatek {d["l"].upper()} — {d["tytul"]}')
        + topnav(links)
        + '\n<div class="page">\n\n'
        + readout(chips)
        + f'\n  <div class="eyebrow">Dodatek {d["l"].upper()} / Głębiej</div>\n'
        + f'  <h1>{d["tytul"]}</h1>\n'
        + f'  <p class="subtitle">{d["opis"]}</p>\n\n'
        + '  <!-- TRESC -->\n\n'
        + '  <div class="site-nav">\n'
        + '    <a href="../index.html">← Spis treści</a>\n'
        + f'    <a href="../rozdzialy/{first["slug"]}.html">↑ Rozdział {first["nr"]}: {first["tytul"]}</a>\n'
        + '  </div>\n\n'
        + '</div>\n\n'
        + '<script src="../assets/interactive.js"></script>\n'
        + '</body>\n</html>\n'
    )


def reverse_ext():
    """Mapa: numer rozdzialu -> lista dodatkow, ktore go rozwijaja."""
    m = {}
    for d in SPIS['dodatki']:
        for n in d['ext']:
            m.setdefault(n, []).append(d)
    return m


def cmd_szkielet():
    # Puste katalogi nie sa sledzone przez gita, wiec na swiezym klonie
    # moze ich nie byc. Tworzymy je tutaj zamiast trzymac .gitkeep.
    for sub in ('rozdzialy', 'dodatki'):
        os.makedirs(os.path.join(ROOT, sub), exist_ok=True)

    rozdz = SPIS['rozdzialy']
    ch_by_nr = {c['nr']: c for c in rozdz}
    rev = reverse_ext()
    made, skipped = [], []

    for i, ch in enumerate(rozdz):
        path = os.path.join(ROOT, 'rozdzialy', ch['slug'] + '.html')
        if os.path.exists(path):
            skipped.append(ch['slug'])
            continue
        prev_ch = rozdz[i - 1] if i > 0 else None
        next_ch = rozdz[i + 1] if i < len(rozdz) - 1 else None
        open(path, 'w', encoding='utf-8', newline='\n').write(
            rozdzial_page(ch, prev_ch, next_ch, rev.get(ch['nr'], [])))
        made.append(ch['slug'])

    for d in SPIS['dodatki']:
        path = os.path.join(ROOT, 'dodatki', d['slug'] + '.html')
        if os.path.exists(path):
            skipped.append(d['slug'])
            continue
        open(path, 'w', encoding='utf-8', newline='\n').write(dodatek_page(d, ch_by_nr))
        made.append(d['slug'])

    print(f'utworzone: {len(made)}, pominiete (juz istnieja): {len(skipped)}')
    for s in made:
        print('  +', s)


# ---------------------------------------------------------------- sprawdz

def all_pages():
    pages = []
    for sub in ('rozdzialy', 'dodatki'):
        d = os.path.join(ROOT, sub)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if f.endswith('.html'):
                pages.append(os.path.join(d, f))
    idx = os.path.join(ROOT, 'index.html')
    if os.path.exists(idx):
        pages.append(idx)
    return pages


def cmd_sprawdz():
    problems = []
    rozdz = SPIS['rozdzialy']
    rev = reverse_ext()

    # 1. martwe linki wzgledne
    for path in all_pages():
        html = open(path, encoding='utf-8').read()
        base = os.path.dirname(path)
        for href in re.findall(r'href="([^"#:]+\.html)(?:#[^"]*)?"', html):
            target = os.path.normpath(os.path.join(base, href))
            if not os.path.exists(target):
                problems.append(f'MARTWY LINK  {os.path.relpath(path, ROOT)} -> {href}')

    # 2. nawigacja gorna musi zgadzac sie z dolna
    for i, ch in enumerate(rozdz):
        path = os.path.join(ROOT, 'rozdzialy', ch['slug'] + '.html')
        if not os.path.exists(path):
            problems.append(f'BRAK PLIKU   rozdzialy/{ch["slug"]}.html')
            continue
        html = open(path, encoding='utf-8').read()
        prev_s = rozdz[i - 1]['slug'] + '.html' if i > 0 else None
        next_s = rozdz[i + 1]['slug'] + '.html' if i < len(rozdz) - 1 else None
        # Liczymy w DWOCH konkretnych blokach, nie na calej stronie. Proza
        # rozdzialu legalnie odsyla do sasiadow ("w nastepnym rozdziale
        # zajmiemy sie..."), a liczenie globalne uznawalo kazdy taki odsylacz
        # za zdublowana nawigacje.
        bloki = {}
        mt = re.search(r'<nav class="topnav">.*?</nav>', html, re.S)
        bloki['topnav'] = mt.group(0) if mt else None
        ms = re.search(r'<div class="site-nav[^"]*">.*?</div>', html, re.S)
        bloki['site-nav'] = ms.group(0) if ms else None

        for nazwa, tresc in bloki.items():
            if tresc is None:
                problems.append(f'NAWIGACJA    R.{ch["nr"]}: brak bloku {nazwa}')

        for label, slug in (('Poprzedni', prev_s), ('Nastepny', next_s)):
            if slug is None:
                continue
            for nazwa, tresc in bloki.items():
                if tresc is None:
                    continue
                n = tresc.count(f'href="{slug}"')
                if n != 1:
                    problems.append(
                        f'NAWIGACJA    R.{ch["nr"]}: link {label} ({slug}) w bloku '
                        f'{nazwa} wystepuje {n}x, a powinien 1x')

    # 3. EXT OF <-> "Idz glebiej", obustronnie
    for d in SPIS['dodatki']:
        path = os.path.join(ROOT, 'dodatki', d['slug'] + '.html')
        if not os.path.exists(path):
            problems.append(f'BRAK PLIKU   dodatki/{d["slug"]}.html')
            continue
        html = open(path, encoding='utf-8').read()
        if 'EXT OF' not in html:
            problems.append(f'BRAK EXT OF  dodatki/{d["slug"]}.html')

    for ch in rozdz:
        path = os.path.join(ROOT, 'rozdzialy', ch['slug'] + '.html')
        if not os.path.exists(path):
            continue
        html = open(path, encoding='utf-8').read()
        for d in rev.get(ch['nr'], []):
            if d['slug'] not in html:
                problems.append(
                    f'BRAK ODNOSNIKA R.{ch["nr"]} nie linkuje do Dodatku {d["l"].upper()}, '
                    f'ktory deklaruje EXT OF R.{ch["nr"]}')

    # 4. bloki obowiazkowe w rozdzialach
    wymagane = [('TL;DR', 'TL;DR'), ('Z praktyki', 'Z praktyki'),
                ('Slowniczek', 'Słowniczek'), ('Co dalej', 'Co dalej')]
    for ch in rozdz:
        path = os.path.join(ROOT, 'rozdzialy', ch['slug'] + '.html')
        if not os.path.exists(path):
            continue
        html = open(path, encoding='utf-8').read()
        if '<!-- TRESC -->' in html:
            problems.append(f'PUSTY        R.{ch["nr"]} {ch["slug"]} — sam szkielet, brak tresci')
            continue
        for label, needle in wymagane:
            if needle not in html:
                problems.append(f'BRAK BLOKU   R.{ch["nr"]}: {label}')

    # 4b. dodatek bez tresci
    for d in SPIS['dodatki']:
        path = os.path.join(ROOT, 'dodatki', d['slug'] + '.html')
        if not os.path.exists(path):
            continue
        html = open(path, encoding='utf-8').read()
        if '<!-- TRESC -->' in html or 'class="section"' not in html:
            problems.append(
                f'PUSTY        Dodatek {d["l"].upper()} {d["slug"]} — sam szkielet, brak tresci')

    # 5. modal wymaga hosta na stronie
    for path in all_pages():
        html = open(path, encoding='utf-8').read()
        if 'data-modal-target' in html and 'id="modal-overlay"' not in html:
            problems.append(f'MODAL BEZ HOSTA {os.path.relpath(path, ROOT)}')
        if 'data-modal-target' in html and 'interactive.js' not in html:
            problems.append(f'MODAL BEZ JS    {os.path.relpath(path, ROOT)}')

    # 6. widget .gitviz wymaga scenariusza i silnika
    #    Miejsce po kontroli fallbackow 3D z ksiazek siostrzanych. Widget bez
    #    data-git-scenario renderuje sie jako pusta ramka, a strona bez
    #    gitgraph.js — jako pusta ramka na kazdym widgecie naraz. Oba bledy
    #    wygladaja identycznie w przegladarce i oba latwo przeoczyc.
    scen_path = os.path.join(ROOT, 'assets', 'scenarios.js')
    scen_src = open(scen_path, encoding='utf-8').read() if os.path.exists(scen_path) else ''
    for path in all_pages():
        html = open(path, encoding='utf-8').read()
        rel = os.path.relpath(path, ROOT)
        widgety = re.findall(r'<div class="gitviz"([^>]*)>', html)
        if not widgety:
            continue
        if 'gitgraph.js' not in html:
            problems.append(f'BRAK SILNIKA {rel}: sa widgety .gitviz, brak importu gitgraph.js')
        for atrybuty in widgety:
            m = re.search(r'data-git-scenario="([^"]+)"', atrybuty)
            if not m:
                problems.append(f'BEZ SCENARIUSZA {rel}: .gitviz bez data-git-scenario')
                continue
            nazwa = m.group(1)
            if not re.search(r'\b' + re.escape(nazwa) + r'\s*:', scen_src):
                problems.append(
                    f'NIEZNANY SCENARIUSZ {rel}: "{nazwa}" nie istnieje w assets/scenarios.js')

    # 6b. .subsection musi lezec wewnatrz .section
    for path in all_pages():
        html = open(path, encoding='utf-8').read()
        stos = []
        for m in re.finditer(r'<div([^>]*)>|</div>', html):
            if m.group(0) == '</div>':
                if stos:
                    stos.pop()
                continue
            kl = re.search(r'class="([^"]*)"', m.group(1) or '')
            klasy = kl.group(1).split() if kl else []
            if 'subsection' in klasy and 'section' not in stos:
                problems.append(
                    f'PODSEKCJA    {os.path.relpath(path, ROOT)}: .subsection poza .section '
                    f'(znak {m.start()})')
            stos.append('section' if 'section' in klasy else '-')

    # 6c. napisany rozdzial musi miescic sie w zalozonym przedziale
    #     Prog jest brama, nie kosmetyka: w ksiazce siostrzanej trzy commity
    #     zadeklarowaly osiagniety cel, bo liczbe wpisano z pamieci.
    try:
        import slowa
        for ch in rozdz:
            path = os.path.join(ROOT, 'rozdzialy', ch['slug'] + '.html')
            if not os.path.exists(path):
                continue
            if '<!-- TRESC -->' in open(path, encoding='utf-8').read():
                continue                      # szkielet, liczy go kontrola 4
            sl, wiz = slowa.zlicz(path)
            if not (slowa.CEL_SLOW[0] <= sl <= slowa.CEL_SLOW[1]):
                problems.append(
                    f'DLUGOSC      R.{ch["nr"]}: {sl} slow, cel '
                    f'{slowa.CEL_SLOW[0]}-{slowa.CEL_SLOW[1]}')
            if not (slowa.CEL_WIZ[0] <= wiz <= slowa.CEL_WIZ[1]):
                problems.append(
                    f'WIZUALIZACJE R.{ch["nr"]}: {wiz}, cel '
                    f'{slowa.CEL_WIZ[0]}-{slowa.CEL_WIZ[1]}')
    except Exception as e:
        problems.append(f'DLUGOSC      nie udalo sie sprawdzic: {e}')

    # 7. znaczniki stanu w spisie tresci musza zgadzac sie z rzeczywistoscia
    try:
        import stan
        for href in stan.sprawdz():
            problems.append(
                f'STAN W SPISIE index.html: wiersz {href} ma zly znacznik '
                f'(napraw: python dev/stan.py)')
    except Exception as e:
        problems.append(f'STAN W SPISIE nie udalo sie sprawdzic: {e}')

    # 8. divy musza sie domykac
    #    Przegladarka wybacza nadmiarowy </div> i strona wyglada poprawnie,
    #    wiec taki blad potrafi przelezec przez cala sesje niezauwazony.
    for path in all_pages():
        html = open(path, encoding='utf-8').read()
        glebokosc, nadmiar = 0, None
        for m in re.finditer(r'<div\b[^>]*>|</div>', html):
            glebokosc += 1 if m.group(0).startswith('<div') else -1
            if glebokosc < 0 and nadmiar is None:
                nadmiar = html[:m.start()].count('\n') + 1
                break
        rel = os.path.relpath(path, ROOT)
        if nadmiar is not None:
            problems.append(f'DIVY         {rel}: nadmiarowy zamykajacy div w linii {nadmiar}')
        elif glebokosc != 0:
            problems.append(f'DIVY         {rel}: {glebokosc} niedomknietych div')

    # 9. ZERO TRESCI FIRMOWYCH
    #    Regula naczelna tej ksiazki (patrz CLAUDE.md) ma brame, nie tylko
    #    zapis. Lista slow siedzi w dev/zakazane.txt, ktory jest w .gitignore
    #    — sam plik z lista nie ma prawa wpasc do historii repo.
    #    Brak listy to problem, nie ciche przejscie: kontrola, ktora po cichu
    #    nic nie sprawdza, jest gorsza niz jej brak.
    lista = os.path.join(ROOT, 'dev', 'zakazane.txt')
    if not os.path.exists(lista):
        problems.append('BRAK LISTY   dev/zakazane.txt nie istnieje — kontrola tresci '
                        'firmowych nie ma czego szukac')
    else:
        zakazane = [w.strip().lower() for w in open(lista, encoding='utf-8')
                    if w.strip() and not w.lstrip().startswith('#')]
        cele = all_pages() + [os.path.join(ROOT, f) for f in ('CLAUDE.md', 'README.md')]
        for sub in ('assets', 'dev'):
            d = os.path.join(ROOT, sub)
            if os.path.isdir(d):
                cele += [os.path.join(d, f) for f in sorted(os.listdir(d))
                         if f.endswith(('.js', '.css', '.json', '.py'))]
        for path in cele:
            if not os.path.exists(path):
                continue
            tekst = open(path, encoding='utf-8', errors='replace').read().lower()
            for w in zakazane:
                if w in tekst:
                    problems.append(
                        f'TRESC FIRMOWA {os.path.relpath(path, ROOT)}: zakazane slowo '
                        f'na pozycji {tekst.index(w)}')

    if problems:
        print(f'ZNALEZIONO {len(problems)} problemow:\n')
        for p in problems:
            print(' ', p)
        sys.exit(1)
    print('Wszystko spojne: linki, nawigacja, EXT OF, bloki, dlugosc, widgety, tresc.')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'sprawdz'
    if cmd == 'szkielet':
        cmd_szkielet()
    elif cmd == 'sprawdz':
        cmd_sprawdz()
    else:
        print(__doc__)
        sys.exit(2)
