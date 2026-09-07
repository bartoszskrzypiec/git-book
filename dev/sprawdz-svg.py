#!/usr/bin/env python3
"""Kontrola geometrii diagramow.

    python dev/sprawdz-svg.py

Ksiazka ma szescdziesiat inline'owych SVG pisanych recznie. Etykieta
z wspolrzedna poza viewBox nie powoduje bledu - po prostu nie widac jej
w przegladarce, a przy przegladaniu strony wzrokiem latwo to przeoczyc,
bo brakujacy tekst nie rzuca sie w oczy tak jak tekst nadmiarowy.

Sprawdza dla kazdego <svg>:
  1. czy jest viewBox,
  2. czy wspolrzedne <text>, <rect> i <circle> mieszcza sie w jego granicach,
  3. czy prawy brzeg tekstu (oszacowany z dlugosci i font-size) nie wystaje.

Punkt 3 jest oszacowaniem, nie pomiarem - dlatego wypisuje ostrzezenia,
a nie bledy. Szerokosc znaku w IBM Plex Mono to okolo 0,6 em.
"""
import io
import os
import re
import sys

sys.dont_write_bytecode = True
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SZEROKOSC_ZNAKU = 0.6          # w em, dla fontu monospace


def strony():
    for sub in ('rozdzialy', 'dodatki'):
        d = os.path.join(ROOT, sub)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if f.endswith('.html'):
                yield os.path.join(d, f)
    idx = os.path.join(ROOT, 'index.html')
    if os.path.exists(idx):
        yield idx


def liczba(tag, nazwa):
    m = re.search(r'\b%s="(-?[\d.]+)"' % nazwa, tag)
    return float(m.group(1)) if m else None


def sprawdz_svg(svg, rel, nr, bledy, ostrzezenia):
    m = re.search(r'viewBox="([\d.\- ]+)"', svg)
    if not m:
        bledy.append('%s svg#%d: brak viewBox' % (rel, nr))
        return
    x0, y0, w, h = [float(v) for v in m.group(1).split()]
    x1, y1 = x0 + w, y0 + h

    for tag in re.findall(r'<(?:text|rect|circle)\b[^>]*>', svg):
        x = liczba(tag, 'x') if '<text' in tag or '<rect' in tag else liczba(tag, 'cx')
        y = liczba(tag, 'y') if '<text' in tag or '<rect' in tag else liczba(tag, 'cy')
        if x is None or y is None:
            continue
        r = liczba(tag, 'r') or 0
        if not (x0 - 1 <= x - r and x + r <= x1 + 1):
            bledy.append('%s svg#%d: x=%g poza viewBox 0..%g  %s'
                         % (rel, nr, x, x1, tag[:52]))
        if not (y0 - 1 <= y - r and y + r <= y1 + 1):
            bledy.append('%s svg#%d: y=%g poza viewBox 0..%g  %s'
                         % (rel, nr, y, y1, tag[:52]))

    # Prawy brzeg tekstu. Tekst wysrodkowany (text-anchor="middle") liczymy
    # od polowy szerokosci, zwykly - od punktu zaczepienia.
    for tag, tresc in re.findall(r'(<text\b[^>]*>)(.*?)</text>', svg, re.S):
        x = liczba(tag, 'x')
        if x is None:
            continue
        fs = liczba(tag, 'font-size') or 12
        czysty = re.sub(r'<[^>]+>', '', tresc)
        czysty = re.sub(r'&[a-z#0-9]+;', 'x', czysty).strip()
        szer = len(czysty) * fs * SZEROKOSC_ZNAKU
        prawy = x + szer / 2 if 'middle' in tag else x + szer
        if prawy > x1 + 2:
            ostrzezenia.append('%s svg#%d: tekst siega ~%.0f przy viewBox %g  "%s"'
                               % (rel, nr, prawy, x1, czysty[:44]))


def main():
    bledy, ostrzezenia, ile = [], [], 0
    for path in strony():
        html = io.open(path, encoding='utf-8').read()
        rel = os.path.relpath(path, ROOT)
        for nr, svg in enumerate(re.findall(r'<svg\b.*?</svg>', html, re.S), 1):
            ile += 1
            sprawdz_svg(svg, rel, nr, bledy, ostrzezenia)

    if ostrzezenia:
        print('%d ostrzezen (oszacowanie szerokosci tekstu, nie blokuja):\n'
              % len(ostrzezenia))
        for o in ostrzezenia:
            print(' ', o)
        print()

    if bledy:
        print('ZNALEZIONO %d problemow w %d diagramach:\n' % (len(bledy), ile))
        for b in bledy:
            print(' ', b)
        sys.exit(1)
    print('Sprawdzone %d diagramow: wszystkie wspolrzedne w granicach viewBox.' % ile)


if __name__ == '__main__':
    main()
