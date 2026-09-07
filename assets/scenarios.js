/* ============================================================
   scenarios.js — scenariusze dla widgetow .gitviz

   Kazdy scenariusz to dane, nie kod. Dzieki temu rozdzial wstawia widget
   samym HTML-em (data-git-scenario="amend") i nie ma na stronie ani jednej
   linii JavaScriptu, ktora moglaby sie rozjechac z silnikiem.

   Pola:
     remote      — czy scena ma origin (drugi panel pod kreska)
     opisStartu  — zdanie opisujace stan wyjsciowy
     start       — operacje budujace stan poczatkowy, wykonywane po cichu
     kroki       — operacje przechodzone strzalkami, kazda z opisem
     argumenty   — argumenty dla przyciskow recznych (data-git-op)

   Operacje sa te same w start i w kroki, bo to jedna sciezka kodu
   w gitgraph.js — nie da sie zbudowac stanu, ktorego czytelnik nie
   moglby osiagnac zwyklymi komendami.

   Nazwy galezi i zgloszen sa fikcyjne (ABC-1234). Patrz CLAUDE.md.
   ============================================================ */

const PODSTAWA = [
  { op: 'commit', args: { msg: 'Konfiguracja projektu' } },
  { op: 'commit', args: { msg: 'Wczytywanie sceny' } }
];

export const SCENARIUSZE = {

  /* R.2 — commit jest obiektem: lancuch rosnie, nic sie nie nadpisuje. */
  lancuch: {
    remote: false,
    opisStartu: 'Puste repozytorium. Kliknij strzalke w prawo.',
    start: [],
    kroki: [
      { op: 'commit', args: { msg: 'Pierwszy commit' },
        opis: 'Pierwszy commit nie ma rodzica. Jest korzeniem.' },
      { op: 'commit', args: { msg: 'Wczytywanie sceny' },
        opis: 'Drugi commit wskazuje na pierwszy. Strzalka biegnie do TYLU.' },
      { op: 'commit', args: { msg: 'Eksport cache' },
        opis: 'Trzeci wskazuje na drugi. Historia to lancuch wskaznikow, nie lista zmian.' }
    ],
    argumenty: { commit: { msg: 'Kolejna zmiana' } }
  },

  /* R.3 — adres wynika z tresci. Ten sam opis daje ten sam SHA. */
  adresZTresci: {
    remote: false,
    opisStartu: 'Jeden commit. Zwroc uwage na jego SHA.',
    start: [{ op: 'commit', args: { msg: 'Dodaj eksporter' } }],
    kroki: [
      { op: 'amend', args: { msg: 'Dodaj eksporter kamer' },
        opis: 'Zmienilismy TYLKO opis. SHA jest inny — bo skrot liczy sie z tresci.' },
      { op: 'amend', args: { msg: 'Dodaj eksporter' },
        opis: 'Wracamy do pierwotnego opisu i SHA wraca do pierwotnej wartosci. Adres to funkcja tresci, nie licznik.' }
    ],
    argumenty: { amend: { msg: 'Inny opis' } }
  },

  /* R.4 — galaz to karteczka z adresem. */
  karteczka: {
    remote: false,
    opisStartu: 'Dwa commity na master. HEAD wskazuje na master.',
    start: PODSTAWA,
    kroki: [
      { op: 'branch', args: { nazwa: 'ABC-1234' },
        opis: 'Nowa galaz. Zaden commit nie powstal — to tylko druga karteczka z tym samym adresem.' },
      { op: 'switch', args: { nazwa: 'ABC-1234' },
        opis: 'HEAD przeskoczyl na ABC-1234. Pliki na dysku sie nie zmienily, bo adres jest ten sam.' },
      { op: 'commit', args: { msg: 'Nowa funkcja' },
        opis: 'Dopiero teraz galezie sie rozjechaly: ABC-1234 poszla dalej, master zostal.' }
    ],
    argumenty: { commit: { msg: 'Kolejna zmiana' }, branch: { nazwa: 'proba' } }
  },

  /* R.5 i R.13 — rodzenstwo, czyli o co chodzi w amendzie. */
  rodzenstwo: {
    remote: false,
    opisStartu: 'Trzy commity w linii prostej.',
    start: PODSTAWA.concat([{ op: 'commit', args: { msg: 'Eksport cache' } }]),
    kroki: [
      { op: 'amend', args: { msg: 'Eksport cache do USD' },
        opis: 'Nowy commit ma tego samego rodzica co stary. To RODZENSTWO — zaden nie pochodzi od drugiego.' }
    ],
    argumenty: { amend: { msg: 'Jeszcze inny opis' }, commit: { msg: 'Poprawka' } }
  },

  /* R.13 — pelna scena: amend na wypchnietej galezi. Serce ksiazki. */
  amend: {
    remote: true,
    opisStartu: 'Galaz ABC-1234 z jednym Twoim commitem, juz wypchnieta na origin.',
    start: PODSTAWA.concat([
      { op: 'branch', args: { nazwa: 'ABC-1234' } },
      { op: 'switch', args: { nazwa: 'ABC-1234' } },
      { op: 'commit', args: { msg: 'odaj wyszukiwarke' } },
      { op: 'push' }
    ]),
    kroki: [
      { op: 'amend', args: { msg: '[ABC-1234] Dodaj wyszukiwarke' },
        opis: 'Poprawiony opis zbudowal nowy commit. Origin nadal wskazuje stary — panele sie rozjechaly.' },
      { op: 'push',
        opis: 'Odmowa: non-fast-forward. Twoj commit nie jest potomkiem tego z serwera, tylko jego rodzenstwem.' },
      { op: 'pushForce',
        opis: 'Wymuszony push ustawia ref na Twoj SHA. Stary commit przestaje byc wskazywany przez cokolwiek.' }
    ],
    argumenty: {
      amend: { msg: '[ABC-1234] Dodaj wyszukiwarke' },
      commit: { msg: 'Popraw opis' },
      pushForce: { lease: true }
    }
  },

  /* R.10 — merge kontra rebase, ta sama sytuacja wyjsciowa. */
  mergeCzyRebase: {
    remote: false,
    opisStartu: 'Twoja galaz i master wyszly z tego samego commita i obie poszly dalej.',
    start: PODSTAWA.concat([
      { op: 'branch', args: { nazwa: 'ABC-1234' } },
      { op: 'switch', args: { nazwa: 'ABC-1234' } },
      { op: 'commit', args: { msg: 'Twoja zmiana' } },
      { op: 'switch', args: { nazwa: 'master' } },
      { op: 'commit', args: { msg: 'Cudza zmiana' } },
      { op: 'switch', args: { nazwa: 'ABC-1234' } }
    ]),
    kroki: [
      { op: 'merge', args: { nazwa: 'master' },
        opis: 'Merge: nowy commit z dwojgiem rodzicow. Twoj commit ma nadal ten sam SHA.' }
    ],
    argumenty: { merge: { nazwa: 'master' }, rebase: { na: 'master' } }
  },

  /* R.14 i R.25 — rebase przepisuje, nie przenosi. */
  rebase: {
    remote: false,
    opisStartu: 'Twoja galaz odbita kilka commitow temu. Master poszedl dalej.',
    start: PODSTAWA.concat([
      { op: 'branch', args: { nazwa: 'ABC-1234' } },
      { op: 'switch', args: { nazwa: 'ABC-1234' } },
      { op: 'commit', args: { msg: 'Twoja zmiana' } },
      { op: 'switch', args: { nazwa: 'master' } },
      { op: 'commit', args: { msg: 'Cudza zmiana' } },
      { op: 'commit', args: { msg: 'Zmiana w bibliotece' } },
      { op: 'switch', args: { nazwa: 'ABC-1234' } }
    ]),
    kroki: [
      { op: 'rebase', args: { na: 'master' },
        opis: 'Twoj commit zbudowany od nowa na szczycie mastera. Ma NOWY SHA; stary zostal bez galezi.' }
    ],
    argumenty: { rebase: { na: 'master' }, merge: { nazwa: 'master' } }
  },

  /* R.15 — reset przesuwa karteczke, nie usuwa commitow. */
  reset: {
    remote: false,
    opisStartu: 'Trzy commity na galezi.',
    start: PODSTAWA.concat([{ op: 'commit', args: { msg: 'Commit do cofniecia' } }]),
    kroki: [
      { op: 'reset', args: { cel: 'HEAD~1', tryb: 'hard' },
        opis: 'Galaz cofnieta o jeden. Commit nie zniknal — stracil tylko karteczke i czeka w reflogu.' }
    ],
    argumenty: { reset: { cel: 'HEAD~1', tryb: 'hard' }, revert: { ktory: 'HEAD' } }
  },

  /* R.16 — dlaczego push bywa odrzucony. */
  fastForward: {
    remote: true,
    opisStartu: 'Galaz wypchnieta na origin. Oba panele pokazuja to samo.',
    start: PODSTAWA.concat([{ op: 'push' }]),
    kroki: [
      { op: 'commit', args: { msg: 'Kolejna zmiana' },
        opis: 'Nowy commit jest POTOMKIEM tego z serwera. To jest warunek fast-forward.' },
      { op: 'push',
        opis: 'Push przechodzi: ref na serwerze przesuwa sie do przodu i nic nie ginie.' },
      { op: 'reset', args: { cel: 'HEAD~1', tryb: 'hard' },
        opis: 'A teraz cofamy galaz. Serwer jest przed nami.' },
      { op: 'push',
        opis: 'Odmowa. Commit na serwerze nie jest przodkiem tego, co wysylasz.' }
    ],
    argumenty: { push: {}, pushForce: { lease: true }, commit: { msg: 'Zmiana' } }
  },

  /* R.18 — reflog jako siatka bezpieczenstwa. */
  reflog: {
    remote: false,
    opisStartu: 'Trzy commity. Zapamietaj SHA ostatniego.',
    start: PODSTAWA.concat([{ op: 'commit', args: { msg: 'Praca calego dnia' } }]),
    kroki: [
      { op: 'reset', args: { cel: 'HEAD~2', tryb: 'hard' },
        opis: 'Reset o dwa commity wstecz. Wyglada, jakby praca zniknela — ale wezly wciaz sa na rysunku.' },
      { op: 'reset', args: { cel: 'reflog:0', tryb: 'hard' },
        opis: 'Reset na SHA odczytany z reflogu przywraca wszystko. Nic nie bylo utracone.' }
    ],
    argumenty: { reset: { cel: 'HEAD~1', tryb: 'hard' } }
  },

  /* R.19 — cherry-pick robi kopie, nie przenosi. */
  cherryPick: {
    remote: false,
    opisStartu: 'Commit z poprawka wyladowal na zlej galezi.',
    start: PODSTAWA.concat([
      { op: 'branch', args: { nazwa: 'ABC-1234' } },
      { op: 'commit', args: { msg: 'Pilna poprawka' } },
      { op: 'switch', args: { nazwa: 'ABC-1234' } }
    ]),
    kroki: [
      { op: 'cherryPick', args: { ktory: 'master' },
        opis: 'Powstala KOPIA o innym SHA. Oryginal zostal tam, gdzie byl — to dwa osobne obiekty.' }
    ],
    argumenty: { cherryPick: { ktory: 'master' } }
  },

  /* R.9 — fetch aktualizuje tylko refy origin/*. */
  fetch: {
    remote: true,
    opisStartu: 'Ktos wypchnal commit na serwer. Ty jeszcze o tym nie wiesz.',
    start: PODSTAWA.concat([
      { op: 'push' },
      { op: 'serwerCommit', args: { msg: 'Cudza zmiana', galaz: 'master' } }
    ]),
    kroki: [
      { op: 'fetch',
        opis: 'fetch przesunal tylko ref origin/master. Twoja galaz stoi dokladnie tam, gdzie stala.' },
      { op: 'merge', args: { nazwa: 'origin/master' },
        opis: 'Dopiero scalenie rusza Twoja galaz. To wlasnie robi pull: fetch, a potem to.' }
    ],
    argumenty: { fetch: {}, merge: { nazwa: 'origin/master' }, rebase: { na: 'origin/master' } }
  }
};
