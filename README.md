# Git dla Artystów Technicznych

Prywatna, offline'owa książka o tym, **dlaczego git zachowuje się tak, jak
się zachowuje**. Nie kurs i nie ściągawka — celem jest model, z którego
następny nietypowy komunikat da się wyprowadzić samemu.

30 rozdziałów w sześciu częściach, 9 dodatków. Rozdziały są krótkie
(700–1200 słów): to lektura między zadaniami, a każdy rozdział odpowiada na
jedno pytanie.

## Jak czytać

Otwórz `index.html` prosto z dysku. Nic tutaj nie wymaga serwera:
zero rastrów, zero WebGL-a, zero zależności. Widgety `.gitviz` są modułem
ES ładowanym lokalnie, a każda strona jest kompletna także wtedy, gdy widget
się nie uruchomi.

## Co jest w środku poza tekstem

`assets/gitgraph.js` — mikro-git w pamięci plus rysowanie grafu w SVG.
Rysuje dwa panele naraz: Twój dysk i origin. Bez tego nie widać rzeczy,
na której stoi cała książka — że po `commit --amend` stary i nowy commit są
**rodzeństwem**, a nie kolejnymi ogniwami łańcucha.

Scenariusze widgetów to dane (`assets/scenarios.js`), nie kod. Stan
początkowy budują te same operacje co kroki, więc nie da się pokazać stanu,
którego nie dałoby się osiągnąć zwykłymi komendami.

## Narzędzia deweloperskie

```
python dev/scaffold.py szkielet   # tworzy brakujące strony, istniejących nie rusza
python dev/scaffold.py sprawdz    # brama: linki, nawigacja, długość, widgety, treść
python dev/slowa.py               # licznik prozy i wizualizacji
python dev/stan.py                # znaczniki "gotowy" w spisie treści
node dev/test-gitgraph.mjs        # test silnika bez przeglądarki
```

Konwencje i reguły pisania: `CLAUDE.md`.

## Zakres

Książka jest w całości generyczna. Opisuje gita, GitLaba i wzorce spotykane
w dużych repozytoriach — bez odwołań do jakiegokolwiek konkretnego
pracodawcy, jego narzędzi, ścieżek czy komunikatów. `dev/scaffold.py sprawdz`
pilnuje tego automatycznie.
