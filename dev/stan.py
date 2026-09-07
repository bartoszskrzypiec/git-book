#!/usr/bin/env python3
"""Synchronizuje znaczniki stanu w index.html z rzeczywistoscia.

    python dev/stan.py

Spis tresci wymienia wszystkie strony od pierwszego dnia, wiec bez znacznika
czytelnik nie ma jak odroznic rozdzialu napisanego od szkieletu - klika
i trafia na pusta strone. Ten skrypt czyta kazda strone, sprawdza, czy jest
w niej jeszcze <!-- TRESC -->, i dopisuje do wiersza spisu odpowiedni stan.

To NIE jest krok budowania. index.html pozostaje plikiem utrzymywanym
recznie; ten skrypt tylko poprawia jedno pole, ktore inaczej rozjezdza sie
przy kazdym napisanym rozdziale. "scaffold.py sprawdz" pilnuje, zeby nie
zostal zapomniany.

Przeniesione bez zmian z optyka_book/dev/stan.py.
"""

import io
import os
import re
import sys

# Narzedzia dev importuja sie nawzajem, a Python cache'uje bytecode. Po edycji
# slowa.py (np. zmianie progu) scaffold.py potrafil wczytac STARY .pyc i
# raportowac nieaktualny wynik - co przy kontroli, ktora ma byc brama przed
# commitem, jest gorsze niz brak kontroli. Zadnych .pyc dla tych skryptow.
sys.dont_write_bytecode = True

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, 'index.html')

GOTOWY = '<span class="stan stan--gotowy">gotowy</span>'
SZKIELET = '<span class="stan">w przygotowaniu</span>'


def czy_napisana(sciezka):
    """Strona jest napisana, gdy nie ma juz w niej znacznika szkieletu."""
    if not os.path.exists(sciezka):
        return False
    return '<!-- TRESC -->' not in io.open(sciezka, encoding='utf-8').read()


def stan_wierszy():
    """Mapa: href wiersza spisu -> True/False (napisana)."""
    html = io.open(INDEX, encoding='utf-8').read()
    out = {}
    for href in re.findall(r'<a class="index-row" href="([^"]+)"', html):
        out[href] = czy_napisana(os.path.join(ROOT, href.replace('/', os.sep)))
    return out


def przelicz(popraw=True):
    html = io.open(INDEX, encoding='utf-8').read()
    stany = stan_wierszy()
    zmiany, rozjazdy = [], []

    def podmien(m):
        href, num_inner = m.group(1), m.group(2)
        czysty = re.sub(r'\s*<span class="stan[^"]*">.*?</span>', '', num_inner).strip()
        chciany = GOTOWY if stany.get(href) else SZKIELET
        obecny = re.search(r'<span class="stan[^"]*">.*?</span>', num_inner)
        if not obecny or obecny.group(0) != chciany:
            (zmiany if popraw else rozjazdy).append(href)
        return ('<a class="index-row" href="%s">\n        <span class="index-num">%s %s</span>\n'
                '        <span class="index-title">' % (href, czysty, chciany))

    # Kotwiczymy na nastepnym <span class="index-title">, bo .index-num moze juz
    # zawierac zagniezdzony <span class="stan"> — bez tej kotwicy niezachlanne
    # (.*?)</span> ucina sie na zamknieciu tego zagniezdzonego spana i kazdy
    # wiersz wyglada na rozjechany.
    nowy = re.sub(
        r'<a class="index-row" href="([^"]+)">\s*<span class="index-num">(.*?)</span>\s*'
        r'<span class="index-title">',
        podmien, html, flags=re.S)

    if popraw:
        if nowy != html:
            io.open(INDEX, 'w', encoding='utf-8', newline='\n').write(nowy)
        gotowe = sum(1 for v in stany.values() if v)
        print('index.html: %d z %d stron oznaczonych jako gotowe (%d wierszy poprawionych)'
              % (gotowe, len(stany), len(zmiany)))
    return rozjazdy


def sprawdz():
    """Uzywane przez scaffold.py sprawdz — zwraca liste rozjechanych wierszy."""
    return przelicz(popraw=False)


if __name__ == '__main__':
    przelicz()
