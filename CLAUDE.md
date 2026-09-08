# CLAUDE.md

Wskazówki dla sesji Claude Code pracujących w tym repozytorium.

## Reguła nadrzędna: zero treści firmowych

**W tej książce nie pojawia się nic o konkretnym pracodawcy.** Żadnej nazwy
studia, żadnych nazw wewnętrznych narzędzi, modułów ani maszyn, żadnych
ścieżek z firmowego drzewa, żadnych prawdziwych numerów zgłoszeń, żadnych
fragmentów wewnętrznego kodu ani dosłownych komunikatów z firmowego serwera.

Nie jest to reguła stylistyczna, tylko warunek istnienia tego repo. Jeśli
przyjdzie Ci do głowy, że „ten jeden konkret bardzo by pomógł" — nie. Każdy
mechanizm, który tu opisujemy, jest wzorcem branżowym i da się opisać
z publicznej dokumentacji gita i GitLaba.

Konwencje zastępcze, stosowane konsekwentnie:

| Zamiast | W książce |
|---|---|
| prawdziwy prefiks zgłoszenia | `ABC-1234` |
| nazwa firmowego narzędzia do budowania | „narzędzie do budowania modułów" |
| ścieżka do firmowego hooka | „hook `update` na serwerze" |
| nazwy maszyn i lokalizacji | „maszyna A" / „maszyna B", „dwie lokalizacje" |

Reguła ma bramkę, nie tylko ten zapis: `dev/scaffold.py sprawdz` przeszukuje
wszystkie strony, `assets/` i `dev/` pod kątem listy z `dev/zakazane.txt`.
Sam plik z listą jest w `.gitignore` — spis zakazanych słów nie ma prawa
wejść do historii repo. Brak tego pliku kontrola zgłasza jako problem, a nie
przepuszcza po cichu.

## Czym jest ta książka

„Git dla Artystów Technicznych" — polskojęzyczna statyczna książka HTML
o tym, dlaczego git zachowuje się tak, jak się zachowuje. Nie jest kursem
i nie jest ściągawką: celem jest **model**, z którego czytelnik wyprowadzi
sobie następny nietypowy komunikat sam, zamiast szukać przepisu.

Czytelnik: artysta techniczny, który używa gita codziennie i przez GUI IDE,
zna podstawy (`add`, `commit`, `push`), a wykłada się na rzeczach
nieoczywistych — odrzucony push, amend, rebase, hook serwerowy, MR, błędy,
które wyglądają jak błędy kodu, a są niedopasowaniem wersji.

30 rozdziałów w sześciu częściach buduje się liniowo; 9 dodatków (A–I) idzie
głębiej. Struktura żyje w `dev/spis.json` — to jedyne źródło prawdy.

To jest projekt żywy, nie jednorazowa publikacja. Nie buduj struktur
generowanych (auto-spisy, szablonowanie), które trzeba by przebudowywać przy
każdej zmianie treści. `dev/scaffold.py` tworzy **brakujące** strony raz
i nigdy nie rusza istniejących — to szkieletownik, nie krok budowania.

## Repozytorium i publikacja

Repo: `bartoszskrzypiec/git-book`, publiczne, live pod
https://bartoszskrzypiec.github.io/git-book/ (Pages z `main` / root,
`.nojekyll` w repo). Książka jest wymieniona na stronie startowej
`learning-materials` razem z resztą rodziny.

**Wszystkie 39 stron otwiera się także prosto z dysku** (`file://`): nie ma
tu ani WebGL-a, ani canvasu, ani rastrów, a silnik widgetów jest skryptem
klasycznym, nie modułem ES — właśnie po to.

Publiczność repozytorium czyni regułę „zero treści firmowych" z góry tego
pliku warunkiem twardym, nie preferencją.

## Konwencje treści

Dziedziczone z `optyka_book` i reszty rodziny:

1. **Rejestr: druga osoba, „ty".** „Zobaczysz", „cofniesz", „wypchniesz".
2. **Krótkie rozdziały: 700–1200 słów, 2–4 sekcje, 2–4 wizualizacje.**
   Świadomie mniej niż w książkach siostrzanych — ta jest czytana między
   zadaniami, a każdy rozdział odpowiada na jedno pytanie. Nadmiar nie ginie:
   dygresje idą do modali „Idź głębiej", duże tematy do dodatków.
   `dev/slowa.py` mierzy, `dev/scaffold.py sprawdz` bramkuje.
3. **Najpierw obserwacja, potem mechanizm.** Rozdział nigdy nie zaczyna się
   od definicji. Kolejność: co widzisz → dlaczego tak jest → co z tym zrobić.
4. **Każdy komunikat gita cytujemy dosłownie**, w bloku `.konsola`, po
   angielsku, bez tłumaczenia w środku bloku. Tłumaczenie idzie w prozie pod
   spodem. Powód: czytelnik porównuje tekst z ekranu znak w znak.
5. **Zero rastrów.** Wszystko to inline SVG albo widget `.gitviz`.
6. **Nazwy komend i refów zostają po angielsku** i nie odmieniają się —
   `git rebase`, `origin/master`, `HEAD`. To nazwy własne.

## Semantyka kolorów

Te same heksy co w rodzinie, znaczenia własne — spójne we wszystkich
wizualizacjach, żeby czytelnik przestał potrzebować legendy:

| Token | Znaczy tutaj |
|---|---|
| `--amber` `#e8a33d` | **obiekt** — commit, drzewo, blob. To, co ma SHA i jest niezmienne |
| `--cyan` `#4fc3c0` | **wskaźnik** — gałąź, HEAD, tag, `origin/*`. To, co się przesuwa |
| `--violet` `#9c82d8` | **przepisanie historii** — amend, rebase, reset, force push. Także afordancja dodatków |
| `--raster` `#6e93be` | **serwer** — origin, hook, MR, CI, druga maszyna |
| `--alarm` `#d2685a` | **odmowa** — komunikat błędu. Wyłącznie w `.konsola` i `.uwaga`, nigdy w prozie |

Praktyczna konsekwencja: na każdym rysunku commit jest bursztynowy, karteczka
z nazwą gałęzi cyjanowa, a wszystko, co przepisuje historię — fioletowe.
Inline SVG wpisuje te heksy na sztywno; `var()` nie działa w atrybutach
prezentacyjnych SVG.

W prozie używaj klas nazwanych znaczeniem, nie kolorem: `.term-obiekt`,
`.term-ref`, `.term-przepis`, `.term-serwer`. Stare nazwy (`.term-amber`
i spółka) nadal działają, ale nowy tekst pisze się tak, żeby w źródle było
widać, o czym mowa.

## Bez systemu budowania

Czyste statyczne HTML/CSS/JS. Bez npm, bez `package.json`, bez bundlera, bez
testów jednostkowych, bez lintera. Żeby „uruchomić", otwórz plik.

Bez wyjątków: **każda strona działa też spod `file://`**, razem z widgetami.
`gitgraph.js` i `scenarios.js` są **skryptami klasycznymi**, nie modułami ES,
i to jest decyzja świadoma. Pierwsza wersja była modułem — a moduły pobierane
spod `file://` blokuje CORS, bo taka strona ma nieprzezroczyste pochodzenie.
Skutek był taki, że książka otwarta z dysku traciła wszystkie widgety.
Nie zamieniaj tego z powrotem na `import`/`export`.

Kolejność ładowania ma znaczenie: `scenarios.js` **przed** `gitgraph.js`,
bo silnik czyta scenariusze z globalnej przestrzeni `GITBOOK` w chwili
wczytania. `dev/scaffold.py sprawdz` pilnuje obecności obu i ich kolejności.

Gdyby skrypt się nie wczytał, widget zostawia swój blok `.gitviz__fallback`
i **strona pozostaje kompletna bez niego**. To jest warunek, nie życzenie:
żaden akapit nie może zależeć od tego, że widget zadziałał.

## Struktura

```
index.html                              — spis treści, tylko w katalogu głównym
rozdzialy/rozdzial-NN-slug.html         — 30 rozdziałów, NN od 01 do 30
dodatki/dodatek-x-slug.html             — 9 dodatków, x = a–i
assets/style.css                        — motyw tej książki (tokeny, układ, bloki)
assets/widgets.css                      — [toolkit] kopia z learning-materials
assets/interactive.js                   — [toolkit] modale + .vec[data-tip]
assets/gitviz.css                       — warstwa komponentu .gitviz (lokalna)
assets/gitgraph.js                      — silnik: mikro-git + rysowanie SVG
assets/scenarios.js                     — scenariusze widgetów, same dane
dev/spis.json                           — struktura książki, źródło prawdy
dev/scaffold.py                         — szkielet | sprawdz
dev/slowa.py                            — licznik prozy i wizualizacji
dev/stan.py                             — synchronizuje znaczniki w spisie treści
dev/test-gitgraph.js                    — test silnika bez przeglądarki
dev/sprawdz-svg.py                      — geometria diagramów (viewBox)
dev/wstaw.py                            — wstawia treść w miejsce znacznika
dev/zakazane.txt                        — lista zakazanych słów (w .gitignore)
```

Sześć części, w kolejności zależności — **nic nie pojawia się, zanim nie ma
czym tego wyjaśnić**: obiekt przed SHA, SHA przed amendem, ref przed
fast-forwardem, fast-forward przed force pushem, hook przed MR-em.

I Model · II Codzienna praca · III Zmiana zdania · IV Serwer i zespół ·
V Git w dużym projekcie · VI Kiedy jest źle

## Toolkit — kopiowany, nie pisany tutaj

`assets/widgets.css` i `assets/interactive.js` to kopie z
`learning-materials`. Przed zmianą któregokolwiek przeczytaj tam
`docs/INTEGRATION.md`, a przed ponownym skopiowaniem — `CHANGELOG.md`.

`assets/style.css` definiuje własne tokeny i **aliasuje** je na kontrakt
toolkitu w `:root` (`--text-muted`, `--accent`, `--bg-elevated`, `--radius`,
`--code-bg`, `--viz-a/b/grid/bg`). **Aliasuj, nigdy nie zmieniaj nazw, które
czyta toolkit** — inaczej następna kopia po cichu się rozjedzie.

`gitgraph.js`, `scenarios.js` i `gitviz.css` są **lokalne dla tej książki**.
Nie kopiuj ich do `learning-materials` — silnik trafiłby tam dopiero wtedy,
gdyby zechciała go druga książka, zgodnie z zasadą tamtego repo.

## Widgety `.gitviz`

Strona wstawia widget samym HTML-em i nie ma na sobie ani jednej linii
logiki:

```html
<div class="gitviz" data-git-scenario="amend">
  <div class="gitviz__head">
    <p class="gitviz__title">Amend na wypchniętej gałęzi</p>
    <p class="gitviz__sub">Klikaj strzałkę w prawo.</p>
  </div>
  <div class="gitviz__stage">
    <div class="gitviz__fallback">
      <strong>Ten widget potrzebuje JavaScriptu</strong>
      <span>Akapit obok jest kompletny bez niego.</span>
    </div>
  </div>
  <div class="gitviz__steps">
    <button data-git-step="prev" aria-label="Krok wstecz">←</button>
    <span data-git-label></span>
    <span class="licznik"></span>
    <button data-git-step="next" aria-label="Krok dalej">→</button>
  </div>
  <pre class="gitviz__out" data-git-out></pre>
  <p class="gitviz__note">Po co tu jest ten widget, jednym zdaniem.</p>
</div>
```

na końcu strony, raz — w tej kolejności, bez żadnego kodu na stronie
(silnik montuje się sam na `DOMContentLoaded`, tak jak `interactive.js`):

```html
<script src="../assets/scenarios.js"></script>
<script src="../assets/gitgraph.js"></script>
```

Zasady:

- Scenariusz musi istnieć w `assets/scenarios.js` — `sprawdz` to weryfikuje.
- Nowy scenariusz to **dane, nie kod**: operacje `start` (po cichu) plus
  `kroki` (przechodzone strzałkami). Ta sama ścieżka kodu, więc nie da się
  zbudować stanu nieosiągalnego zwykłymi komendami.
- Przyciski `data-git-op` są opcjonalne — dodawaj je tam, gdzie czytelnik ma
  coś **sam** wypróbować, a nie tam, gdzie ma obejrzeć historię.
- **Widget tylko wtedy, gdy coś się rusza.** Statyczny obrazek (trzy drzewa,
  anatomia `.git/`, tabela decyzyjna) to zwykły inline SVG. Widget rysujący
  jeden nieruchomy graf jest gorszy od diagramu.

## Weryfikacja przed każdym commitem

1. `python dev/scaffold.py sprawdz` — musi przejść czysto. Bramkuje długość,
   nawigację, `EXT OF`, bloki obowiązkowe, domknięcie `<div>`, scenariusze
   widgetów i **treści firmowe**.
2. `node dev/test-gitgraph.js` po każdej zmianie w silniku albo
   scenariuszach. Sprawdza determinizm i to, że cofanie wraca do migawki.
3. `node --check` na dotkniętych plikach JS.
4. Otwórz stronę z dysku: brak błędów w konsoli, brak przewijania w poziomie
   przy 360 px, żadnej etykiety SVG poza `viewBox`.
5. **Nigdy nie wpisuj liczby słów do commita** — napisz, że `sprawdz`
   przechodzi. Liczby wpisywane z pamięci bywały nieprawdziwe.

## Komendy w treści

Każda komenda i każdy jej output cytowany w książce ma być **uruchomiony**
w jednorazowym repozytorium, a nie napisany z pamięci. Git formatuje
komunikaty w sposób, którego nie da się wiarygodnie odtworzyć z głowy,
a czytelnik porównuje je znak w znak. Skróty SHA w cytatach maskuj do
siedmiu znaków hex i nie udawaj, że są prawdziwe akurat u czytelnika.

## Praca z gitem w tym repo

Commituj po każdej logicznej całości, bez pytania. Wiadomości commitów
w ASCII (bez polskich znaków), żeby ominąć problemy z kodowaniem konsoli
Windows; **treść stron** zawsze z pełną, poprawną polską diakrytyką.
Nie przepisuj historii tego repo bez pytania — w repozytorium o gicie
byłoby to szczególnie niezręczne.
