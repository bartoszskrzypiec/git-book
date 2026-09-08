/* ============================================================
   gitgraph.js — mikro-git w pamieci plus rysowanie grafu w SVG.

   Po co to istnieje: cala teza tej ksiazki brzmi "obiekty sa niezmienne,
   wskazniki sie przesuwaja". Zdanie to jest latwe do napisania i trudne do
   uwierzenia, dopoki nie zobaczysz, ze po `commit --amend` stary i nowy
   commit sa RODZENSTWEM — maja tego samego rodzica i zaden nie pochodzi od
   drugiego. Statyczny diagram tego nie pokaze, bo caly efekt polega na
   ruchu: byl jeden wezel, zostaly dwa, a galaz przeskoczyla.

   Dwie warstwy, celowo rozdzielone:
     1. MODEL  — czysty stan (JSON-owalny) i operacje stan -> stan.
     2. WIDOK  — funkcja stan -> string z SVG. Nic nie mutuje.

   Konsekwencja rozdzielenia: cofanie kroku nie odwraca operacji (co jest
   trudne i podatne na bledy), tylko wraca do zapamietanej migawki stanu.
   Dzieki temu "cofnij n razy" daje dokladnie to samo, co "zacznij od nowa",
   a to jest wlasnie ten warunek, ktory najlatwiej zlamac w takim widgecie.

   Zaleznosci: zadne. Modul ES, bez WebGL, bez canvasu. Strona z widgetem
   musi byc serwowana po http — moduly pobierane spod file:// blokuje CORS,
   bo taka strona ma nieprzezroczyste pochodzenie. Gdy import nie przejdzie,
   widget zostawia swoj .gitviz__fallback i rozdzial pozostaje kompletny.
   ============================================================ */

import { SCENARIUSZE } from './scenarios.js';

/* ---------------------------------------------------------------- SHA

   Prawdziwy git liczy SHA-1 z naglowka i tresci obiektu. Nas interesuje
   wylacznie jedna wlasciwosc tego mechanizmu: adres wynika z TRESCI, wiec
   zmiana jednego znaku w opisie daje inny adres. FNV-1a wystarcza, jest
   piecioma linijkami i nie wymaga WebCrypto (ktore jest asynchroniczne
   i niedostepne przez file:// w czesci przegladarek).                    */

function skrot(tekst) {
  let h = 0x811c9dc5;
  for (let i = 0; i < tekst.length; i++) {
    h ^= tekst.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // 32 bity to 8 znakow hex; git skraca do 7 i my tez.
  const a = h.toString(16).padStart(8, '0');
  const b = Math.imul(h ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  return (a + b.toString(16).padStart(8, '0')).slice(0, 7);
}

function shaCommita(c) {
  // Dokladnie te pola, ktore w prawdziwym gicie wchodza do skrotu: drzewo,
  // rodzice, autor, wiadomosc. Brak daty jest celowy — chcemy, zeby ten sam
  // scenariusz dawal zawsze te same skroty i zeby zrzuty ekranu sie zgadzaly.
  return skrot([c.drzewo, c.parents.join(' '), c.autor, c.msg].join('\n'));
}

/* ---------------------------------------------------------------- MODEL */

function pustyStan(zRemote) {
  const st = {
    lokalne: { objects: {}, refs: {}, head: { typ: 'galaz', cel: 'master' }, osierocone: [] },
    // Origin nie ma HEAD-a w zadnym sensie, ktory by nas tu interesowal:
    // to gole refy i obiekty. Brak pola jest celowy, nie przeoczeniem.
    origin: zRemote ? { objects: {}, refs: {}, osierocone: [] } : null,
    out: [],
    opis: ''
  };
  return st;
}

const klon = (st) => JSON.parse(JSON.stringify(st));

function shaHEAD(repo) {
  if (!repo.head) return null;                // origin: same refy, bez HEAD-a
  if (repo.head.typ === 'odczepiony') return repo.head.cel;
  return repo.refs[repo.head.cel] || null;
}

function ustawHEAD(repo, sha) {
  if (repo.head.typ === 'odczepiony') repo.head.cel = sha;
  else repo.refs[repo.head.cel] = sha;
}

/** Czy `przodek` lezy na sciezce rodzicow `potomek`? To jest CALY warunek
 *  fast-forward: push przechodzi tylko wtedy, gdy commit lezacy na serwerze
 *  jest przodkiem tego, ktory wysylasz. */
function jestPrzodkiem(repo, przodek, potomek) {
  if (!przodek) return true;                 // pusta galaz na serwerze
  const stos = [potomek], widziane = new Set();
  while (stos.length) {
    const s = stos.pop();
    if (!s || widziane.has(s)) continue;
    if (s === przodek) return true;
    widziane.add(s);
    const c = repo.objects[s];
    if (c) stos.push(...c.parents);
  }
  return false;
}

function lancuch(repo, od, doWylacznie) {
  // Lista commitow od `od` wstecz, az do (bez) `doWylacznie`. Uzywane przez
  // rebase i przez liczenie "ile commitow przede mna".
  const wynik = [];
  let s = od;
  while (s && s !== doWylacznie) {
    const c = repo.objects[s];
    if (!c) break;
    wynik.push(c);
    s = c.parents[0];
  }
  return wynik.reverse();
}

function nowyCommit(repo, { msg, drzewo, parents, autor }) {
  const c = {
    msg,
    drzewo: drzewo || 'drzewo-' + msg.length,
    parents: parents || [],
    autor: autor || 'ty'
  };
  c.sha = shaCommita(c);
  repo.objects[c.sha] = c;
  return c;
}

function osiagalneZ(repo, korzenie) {
  const zbior = new Set(), stos = korzenie.filter(Boolean);
  while (stos.length) {
    const s = stos.pop();
    if (!s || zbior.has(s) || !repo.objects[s]) continue;
    zbior.add(s);
    stos.push(...repo.objects[s].parents);
  }
  return zbior;
}

/** Osierocony = taki, do ktorego nie prowadzi juz zaden ref ani HEAD.
 *
 *  Liczymy to od nowa po KAZDEJ operacji, zamiast dopisywac commity do listy
 *  w miejscu, gdzie wypadaja spod galezi. Pierwsza wersja robila to drugie
 *  i mylila sie dokladnie tam, gdzie widget ma najwiecej do pokazania:
 *  przy powrocie resetem na stary SHA commity wracaly pod galaz, ale nadal
 *  byly rysowane jako porzucone. Osiagalnosc jest definicja, wiec liczmy
 *  definicje.
 *
 *  Kolejnosc listy to kolejnosc powstawania obiektow, dzieki czemu
 *  "reflog:0" oznacza commit porzucony ostatnio — czyli ten, ktory czytelnik
 *  zobaczylby na gorze `git reflog`.                                        */
function przeliczOsierocone(repo) {
  if (!repo) return;
  const korzenie = Object.values(repo.refs);
  if (repo.head && repo.head.typ === 'odczepiony') korzenie.push(repo.head.cel);
  const zywe = osiagalneZ(repo, korzenie);
  repo.osierocone = Object.keys(repo.objects).filter((s) => !zywe.has(s));
}

/** Kopiuje do drugiego repozytorium tylko to, co jest osiagalne z podanego
 *  commita. Push wysyla obiekty potrzebne do odtworzenia galezi, a nie
 *  wszystko, co masz na dysku — inaczej Twoje porzucone commity ladowalyby
 *  na serwerze. */
function skopiujOsiagalne(zRepo, doRepo, sha) {
  osiagalneZ(zRepo, [sha]).forEach((s) => {
    doRepo.objects[s] = JSON.parse(JSON.stringify(zRepo.objects[s]));
  });
}

/* --------------------------------------------------------- OPERACJE

   Kazda operacja dostaje stan (juz sklonowany) i argumenty, mutuje stan
   i dopisuje do st.out linie, ktore czytelnik zobaczylby w terminalu.
   Zwraca opis kroku albo nic.                                            */

const linia = (st, klasa, tekst) => st.out.push({ klasa, tekst });

const OPERACJE = {
  commit(st, a) {
    const r = st.lokalne;
    const rodzic = shaHEAD(r);
    const c = nowyCommit(r, { msg: a.msg, drzewo: a.drzewo, parents: rodzic ? [rodzic] : [] });
    ustawHEAD(r, c.sha);
    linia(st, 'cmd', 'git commit -m "' + a.msg + '"');
    linia(st, '', '[' + (r.head.cel) + ' ' + c.sha + '] ' + a.msg);
    return 'Nowy commit ' + c.sha + '. Galaz przesunieta na niego.';
  },

  amend(st, a) {
    const r = st.lokalne;
    const stary = r.objects[shaHEAD(r)];
    if (!stary) return 'Nie ma czego poprawiac.';
    const c = nowyCommit(r, {
      msg: a.msg != null ? a.msg : stary.msg,
      drzewo: a.drzewo != null ? a.drzewo : stary.drzewo,
      parents: stary.parents
    });
    ustawHEAD(r, c.sha);
    linia(st, 'cmd', 'git commit --amend' + (a.msg ? ' -m "' + a.msg + '"' : ''));
    linia(st, '', '[' + r.head.cel + ' ' + c.sha + '] ' + c.msg);
    return 'Zbudowany NOWY commit ' + c.sha + ' z tym samym rodzicem. Stary '
      + stary.sha + ' zostal bez galezi.';
  },

  branch(st, a) {
    const r = st.lokalne;
    r.refs[a.nazwa] = shaHEAD(r);
    linia(st, 'cmd', 'git branch ' + a.nazwa);
    return 'Nowa karteczka ' + a.nazwa + ' z tym samym adresem co HEAD.';
  },

  switch(st, a) {
    const r = st.lokalne;
    if (r.refs[a.nazwa] === undefined) {
      linia(st, 'err', "error: pathspec '" + a.nazwa + "' did not match any file(s) known to git");
      return 'Nie ma takiej galezi.';
    }
    r.head = { typ: 'galaz', cel: a.nazwa };
    linia(st, 'cmd', 'git switch ' + a.nazwa);
    linia(st, 'ok', "Switched to branch '" + a.nazwa + "'");
    return 'HEAD wskazuje teraz na ' + a.nazwa + '.';
  },

  merge(st, a) {
    const r = st.lokalne;
    const moj = shaHEAD(r), obcy = r.refs[a.nazwa];
    if (jestPrzodkiem(r, moj, obcy)) {
      ustawHEAD(r, obcy);
      linia(st, 'cmd', 'git merge ' + a.nazwa);
      linia(st, 'ok', 'Fast-forward');
      return 'Nic do scalania — wystarczylo przesunac karteczke.';
    }
    const c = nowyCommit(r, { msg: "Merge branch '" + a.nazwa + "'", parents: [moj, obcy] });
    ustawHEAD(r, c.sha);
    linia(st, 'cmd', 'git merge ' + a.nazwa);
    linia(st, '', "Merge made by the 'ort' strategy.");
    return 'Nowy commit ' + c.sha + ' z DWOJGIEM rodzicow. Nic nie zostalo przepisane.';
  },

  rebase(st, a) {
    const r = st.lokalne;
    const baza = r.refs[a.na] !== undefined ? r.refs[a.na] : a.na;
    const moje = lancuch(r, shaHEAD(r), wspolnyPrzodek(r, shaHEAD(r), baza));
    let na = baza;
    for (const c of moje) {
      const nowy = nowyCommit(r, { msg: c.msg, drzewo: c.drzewo, parents: [na] });
      na = nowy.sha;
    }
    ustawHEAD(r, na);
    linia(st, 'cmd', 'git rebase ' + a.na);
    linia(st, 'ok', 'Successfully rebased and updated refs/heads/' + r.head.cel + '.');
    return moje.length + ' commit(y) zbudowane od nowa na szczycie ' + a.na
      + '. Kazdy ma nowy SHA.';
  },

  reset(st, a) {
    const r = st.lokalne;
    const cel = rozwiazCel(r, a.cel);
    ustawHEAD(r, cel);
    linia(st, 'cmd', 'git reset --' + (a.tryb || 'hard') + ' ' + a.cel);
    linia(st, '', 'HEAD is now at ' + cel);
    return 'Karteczka przesunieta na ' + cel + '. Nic nie zostalo usuniete.';
  },

  cherryPick(st, a) {
    const r = st.lokalne;
    const zrodlo = r.objects[rozwiazCel(r, a.ktory)];
    if (!zrodlo) return 'Nie ma takiego commita.';
    const c = nowyCommit(r, {
      msg: zrodlo.msg, drzewo: zrodlo.drzewo, parents: [shaHEAD(r)]
    });
    ustawHEAD(r, c.sha);
    linia(st, 'cmd', 'git cherry-pick ' + a.ktory);
    linia(st, '', '[' + r.head.cel + ' ' + c.sha + '] ' + c.msg);
    return 'KOPIA commita, nie ten sam commit: ' + zrodlo.sha + ' -> ' + c.sha + '.';
  },

  revert(st, a) {
    const r = st.lokalne;
    const zrodlo = r.objects[rozwiazCel(r, a.ktory || 'HEAD')];
    const c = nowyCommit(r, {
      msg: 'Revert "' + (zrodlo ? zrodlo.msg : '?') + '"', parents: [shaHEAD(r)]
    });
    ustawHEAD(r, c.sha);
    linia(st, 'cmd', 'git revert ' + (a.ktory || 'HEAD'));
    linia(st, '', '[' + r.head.cel + ' ' + c.sha + '] ' + c.msg);
    return 'Historia rosnie do przodu: nowy commit odwracajacy zmiane.';
  },

  fetch(st) {
    const r = st.lokalne, o = st.origin;
    if (!o) return 'Brak zdalnego repozytorium w tym scenariuszu.';
    for (const [nazwa, sha] of Object.entries(o.refs)) {
      skopiujOsiagalne(o, r, sha);
      r.refs['origin/' + nazwa] = sha;
    }
    linia(st, 'cmd', 'git fetch');
    return 'Zaktualizowane refy origin/*. Twoje galezie nie ruszyly sie ani o krok.';
  },

  push(st) {
    const r = st.lokalne, o = st.origin;
    if (!o) return 'Brak zdalnego repozytorium w tym scenariuszu.';
    const nazwa = r.head.cel, moj = shaHEAD(r), tam = o.refs[nazwa];
    linia(st, 'cmd', 'git push');
    if (!jestPrzodkiem(r, tam, moj)) {
      linia(st, 'err', ' ! [rejected]        ' + nazwa + ' -> ' + nazwa + ' (non-fast-forward)');
      linia(st, 'err', 'error: failed to push some refs');
      linia(st, '', 'hint: Updates were rejected because the tip of your current branch is behind');
      return 'Odmowa. Twoj commit nie jest potomkiem tego, ktory lezy na origin.';
    }
    skopiujOsiagalne(r, o, moj);
    o.refs[nazwa] = moj;
    r.refs['origin/' + nazwa] = moj;
    linia(st, 'ok', '   ' + (tam || '(nowa)') + '..' + moj + '  ' + nazwa + ' -> ' + nazwa);
    return 'Ref na serwerze przesuniety do przodu.';
  },

  /** Commit zrobiony przez KOGOS INNEGO, prosto na serwerze. W prawdziwym
   *  swiecie to jest czyjs push; z Twojego punktu widzenia zdarza sie sam
   *  i bez uprzedzenia, wiec w widgecie tez jest jedna operacja. */
  serwerCommit(st, a) {
    const o = st.origin;
    if (!o) return 'Brak zdalnego repozytorium w tym scenariuszu.';
    const galaz = a.galaz || 'master';
    const rodzic = o.refs[galaz];
    const c = nowyCommit(o, {
      msg: a.msg, parents: rodzic ? [rodzic] : [], autor: a.autor || 'ktos inny'
    });
    o.refs[galaz] = c.sha;
    linia(st, 'komentarz', '(ktos inny wypchnal ' + c.sha + ' na ' + galaz + ')');
    return 'Na serwerze pojawil sie commit, o ktorym jeszcze nie wiesz.';
  },

  pushForce(st, a) {
    const r = st.lokalne, o = st.origin;
    if (!o) return 'Brak zdalnego repozytorium w tym scenariuszu.';
    const nazwa = r.head.cel, moj = shaHEAD(r), tam = o.refs[nazwa];
    const zLease = a && a.lease;
    linia(st, 'cmd', 'git push --force' + (zLease ? '-with-lease' : ''));
    skopiujOsiagalne(r, o, moj);
    o.refs[nazwa] = moj;
    r.refs['origin/' + nazwa] = moj;
    linia(st, 'ok', ' + ' + (tam || '(nowa)') + '...' + moj + '  ' + nazwa + ' -> ' + nazwa
      + ' (forced update)');
    return 'Ref na serwerze ustawiony na Twoj SHA. Stary commit przestal byc wskazywany.';
  }
};

function rozwiazCel(repo, cel) {
  if (cel === 'HEAD') return shaHEAD(repo);
  // "reflog:0" to ostatni commit, ktory stracil galaz — czyli dokladnie to,
  // co czytelnik odczytalby z `git reflog` i wkleil do `git reset --hard`.
  // Scenariusz nie moze podac SHA na sztywno, bo skroty licza sie z tresci.
  const rl = /^reflog:(\d+)$/.exec(cel);
  if (rl) {
    const lista = repo.osierocone || [];
    return lista[lista.length - 1 - Number(rl[1])];
  }
  const m = /^HEAD~(\d+)$/.exec(cel);
  if (m) {
    let s = shaHEAD(repo);
    for (let i = 0; i < Number(m[1]) && s; i++) s = (repo.objects[s].parents || [])[0];
    return s;
  }
  if (repo.refs[cel] !== undefined) return repo.refs[cel];
  return cel;
}

function wspolnyPrzodek(repo, a, b) {
  const przodkowie = new Set();
  let s = a;
  while (s) { przodkowie.add(s); s = (repo.objects[s] || { parents: [] }).parents[0]; }
  s = b;
  while (s) { if (przodkowie.has(s)) return s; s = (repo.objects[s] || { parents: [] }).parents[0]; }
  return null;
}

function wykonaj(stan, krok) {
  const st = klon(stan);
  st.out = [];
  const fn = OPERACJE[krok.op];
  if (!fn) { st.opis = 'Nieznana operacja: ' + krok.op; return st; }
  const opis = fn(st, krok.args || {});
  przeliczOsierocone(st.lokalne);
  przeliczOsierocone(st.origin);
  st.opis = krok.opis || opis || '';
  return st;
}

/* ---------------------------------------------------------------- WIDOK */

const KOL = { obiekt: '#e8a33d', ref: '#4fc3c0', przepis: '#9c82d8',
  serwer: '#6e93be', tekst: '#ecebe4', dim: '#8b909b', ramka: '#2a2f38',
  tlo: '#20242c', panel: '#1b1e24' };

const SZER_KOL = 128;   // odstep miedzy pokoleniami commitow
const WYS_PASA = 74;    // odstep miedzy pasmami (galeziami)
const R = 19;           // promien wezla

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function widoczne(repo) {
  const zbior = new Set();
  const stos = Object.values(repo.refs).concat(repo.osierocone || []);
  if (repo.head && repo.head.typ === 'odczepiony') stos.push(repo.head.cel);
  while (stos.length) {
    const s = stos.pop();
    if (!s || zbior.has(s) || !repo.objects[s]) continue;
    zbior.add(s);
    stos.push(...repo.objects[s].parents);
  }
  return [...zbior].map((s) => repo.objects[s]);
}

/** Uklad: kolumna = pokolenie (dlugosc najdluzszej sciezki do korzenia),
 *  pasmo = proba utrzymania commita w pasmie jego pierwszego rodzica.
 *  Dzieki temu amend rysuje rodzenstwo jeden pod drugim, w tej samej
 *  kolumnie — czyli dokladnie tak, jak jest naprawde. */
function uklad(repo) {
  const commits = widoczne(repo);
  const gl = {};
  const glebokosc = (s, sciezka = new Set()) => {
    if (gl[s] != null) return gl[s];
    if (sciezka.has(s)) return 0;
    sciezka.add(s);
    const c = repo.objects[s];
    gl[s] = !c || !c.parents.length ? 0
      : Math.max(...c.parents.map((p) => glebokosc(p, sciezka))) + 1;
    return gl[s];
  };
  commits.forEach((c) => glebokosc(c.sha));

  const kolumny = {};
  commits.forEach((c) => { (kolumny[gl[c.sha]] = kolumny[gl[c.sha]] || []).push(c.sha); });

  const pasmo = {};
  Object.keys(kolumny).map(Number).sort((a, b) => a - b).forEach((d) => {
    const zajete = new Set();
    kolumny[d].forEach((s) => {
      const rodzic = repo.objects[s].parents[0];
      const chce = rodzic != null && pasmo[rodzic] != null ? pasmo[rodzic] : null;
      if (chce != null && !zajete.has(chce)) { pasmo[s] = chce; zajete.add(chce); }
    });
    kolumny[d].forEach((s) => {
      if (pasmo[s] != null) return;
      let l = 0;
      while (zajete.has(l)) l++;
      pasmo[s] = l;
      zajete.add(l);
    });
  });

  return { commits, gl, pasmo, maxGl: Math.max(0, ...Object.values(gl)),
    maxPasmo: Math.max(0, ...Object.values(pasmo)) };
}

function refyDla(repo) {
  const mapa = {};
  for (const [nazwa, sha] of Object.entries(repo.refs)) {
    if (!sha) continue;
    (mapa[sha] = mapa[sha] || []).push(nazwa);
  }
  return mapa;
}

function rysujRepo(repo, opcje) {
  const { commits, gl, pasmo, maxGl } = uklad(repo);
  const refy = refyDla(repo);
  const headSha = shaHEAD(repo);
  const x = (s) => opcje.x0 + 40 + gl[s] * SZER_KOL;
  const y = (s) => opcje.y0 + 46 + pasmo[s] * WYS_PASA;
  const czesci = [];

  // Krawedzie najpierw, zeby wezly lezaly na nich.
  commits.forEach((c) => {
    c.parents.forEach((p) => {
      if (!repo.objects[p]) return;
      const x1 = x(c.sha) - R, y1 = y(c.sha), x2 = x(p) + R, y2 = y(p);
      const przygaszona = (repo.osierocone || []).includes(c.sha);
      const sr = (x1 + x2) / 2;
      const d = y1 === y2
        ? `M ${x1} ${y1} L ${x2} ${y2}`
        : `M ${x1} ${y1} C ${sr} ${y1}, ${sr} ${y2}, ${x2} ${y2}`;
      czesci.push(`<path d="${d}" fill="none" stroke="${KOL.ramka}" stroke-width="2"`
        + (przygaszona ? ' stroke-dasharray="4 4"' : '') + ' />');
    });
  });

  commits.forEach((c) => {
    const cx = x(c.sha), cy = y(c.sha);
    const osierocony = (repo.osierocone || []).includes(c.sha);
    const kolor = osierocony ? KOL.dim : KOL.obiekt;
    const przezr = osierocony ? 0.45 : 1;
    czesci.push(`<g opacity="${przezr}">`
      + `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${KOL.panel}" stroke="${kolor}" stroke-width="2"/>`
      + `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="IBM Plex Mono, monospace"`
      + ` font-size="10" fill="${kolor}">${esc(c.sha)}</text>`
      + `<text x="${cx}" y="${cy + R + 15}" text-anchor="middle" font-family="IBM Plex Mono, monospace"`
      + ` font-size="9.5" fill="${KOL.dim}">${esc(skrocOpis(c.msg))}</text>`
      + '</g>');
    if (osierocony) {
      czesci.push(`<text x="${cx}" y="${cy - R - 10}" text-anchor="middle"`
        + ` font-family="IBM Plex Mono, monospace" font-size="9" fill="${KOL.dim}">`
        + 'tylko w reflogu</text>');
    }

    // Etykiety refow nad wezlem, jedna pod druga.
    (refy[c.sha] || []).forEach((nazwa, i) => {
      const zdalny = nazwa.startsWith('origin/');
      const kol = zdalny ? KOL.serwer : KOL.ref;
      const ey = cy - R - 12 - i * 19;
      const szer = nazwa.length * 6.6 + 14;
      czesci.push(`<g><rect x="${cx - szer / 2}" y="${ey - 11}" width="${szer}" height="16" rx="8"`
        + ` fill="none" stroke="${kol}" stroke-width="1"/>`
        + `<text x="${cx}" y="${ey + 1}" text-anchor="middle" font-family="IBM Plex Mono, monospace"`
        + ` font-size="9.5" fill="${kol}">${esc(nazwa)}</text></g>`);
    });
  });

  // HEAD jako osobna odznaka przy wskazywanym refie.
  if (headSha && repo.objects[headSha]) {
    const ile = (refy[headSha] || []).length;
    const cx = x(headSha), cy = y(headSha) - R - 12 - ile * 19;
    czesci.push(`<g><rect x="${cx - 27}" y="${cy - 11}" width="54" height="16" rx="8"`
      + ` fill="${KOL.obiekt}" opacity="0.14"/>`
      + `<text x="${cx}" y="${cy + 1}" text-anchor="middle" font-family="IBM Plex Mono, monospace"`
      + ` font-size="9.5" fill="${KOL.obiekt}">HEAD</text></g>`);
  }

  return { svg: czesci.join('\n'), maxGl, maxPasmo: Math.max(0, ...Object.values(pasmo)) };
}

function skrocOpis(msg) {
  const czysty = String(msg);
  return czysty.length > 18 ? czysty.slice(0, 17) + '…' : czysty;
}

function rysuj(stan) {
  const panele = [];
  const l = rysujRepo(stan.lokalne, { x0: 0, y0: 34 });
  let wysokosc = 34 + 46 + (l.maxPasmo + 1) * WYS_PASA;
  panele.push(`<text x="8" y="18" font-family="IBM Plex Mono, monospace" font-size="10"`
    + ` letter-spacing="1" fill="${KOL.dim}">TWOJ DYSK</text>`);
  panele.push(l.svg);

  let szerKol = l.maxGl;
  if (stan.origin) {
    const yLinii = wysokosc + 8;
    panele.push(`<line x1="0" y1="${yLinii}" x2="100%" y2="${yLinii}" stroke="${KOL.ramka}"`
      + ' stroke-width="1" stroke-dasharray="3 5"/>');
    const o = rysujRepo(stan.origin, { x0: 0, y0: yLinii + 24 });
    panele.push(`<text x="8" y="${yLinii + 20}" font-family="IBM Plex Mono, monospace"`
      + ` font-size="10" letter-spacing="1" fill="${KOL.serwer}">ORIGIN</text>`);
    panele.push(o.svg);
    wysokosc = yLinii + 24 + 46 + (o.maxPasmo + 1) * WYS_PASA;
    szerKol = Math.max(szerKol, o.maxGl);
  }

  const szerokosc = 60 + (szerKol + 1) * SZER_KOL;
  return `<svg viewBox="0 0 ${szerokosc} ${wysokosc}" xmlns="http://www.w3.org/2000/svg"`
    + ' role="img" aria-label="Graf commitow">' + panele.join('\n') + '</svg>';
}

/* ---------------------------------------------------------------- WIDGET */

const ETYKIETY = {
  commit: 'git commit', amend: 'git commit --amend', branch: 'git branch',
  switch: 'git switch', merge: 'git merge', rebase: 'git rebase',
  reset: 'git reset', cherryPick: 'git cherry-pick', revert: 'git revert',
  fetch: 'git fetch', push: 'git push', pushForce: 'git push --force'
};

export function createGitGraph(host) {
  const nazwa = host.dataset.gitScenario;
  const scen = SCENARIUSZE[nazwa];
  if (!scen) return { ok: false };

  // Stan poczatkowy budujemy tymi samymi operacjami co kroki — jedna sciezka
  // kodu, wiec nie da sie napisac scenariusza, ktory startuje ze stanu
  // nieosiagalnego zwyklymi komendami.
  let bazowy = pustyStan(!!scen.remote);
  (scen.start || []).forEach((k) => { bazowy = wykonaj(bazowy, k); });
  bazowy.out = [];
  bazowy.opis = scen.opisStartu || 'Stan wyjsciowy.';

  const stany = [bazowy];
  let kursor = 0;

  const stage = host.querySelector('.gitviz__stage');
  const label = host.querySelector('[data-git-label]');
  const licznik = host.querySelector('.licznik');
  const out = host.querySelector('[data-git-out]');
  const btnPrev = host.querySelector('[data-git-step="prev"]');
  const btnNext = host.querySelector('[data-git-step="next"]');

  function odswiez() {
    const st = stany[kursor];
    if (stage) stage.innerHTML = rysuj(st);
    if (label) label.textContent = st.opis;
    if (licznik) licznik.textContent = kursor + ' / ' + (scen.kroki ? scen.kroki.length : 0);
    if (out) {
      out.innerHTML = st.out.length
        ? st.out.map((w) => `<span class="${w.klasa}">${esc(w.tekst)}</span>`).join('\n')
        : '<span class="komentarz">—</span>';
    }
    if (btnPrev) btnPrev.disabled = kursor === 0;
    if (btnNext) btnNext.disabled = !scen.kroki || kursor >= scen.kroki.length;
  }

  function krokDalej() {
    if (!scen.kroki || kursor >= scen.kroki.length) return;
    // Kroki liczymy raz i zapamietujemy migawke; cofanie to powrot do niej,
    // nie odwracanie operacji.
    if (stany.length <= kursor + 1) stany.push(wykonaj(stany[kursor], scen.kroki[kursor]));
    kursor++;
    odswiez();
  }

  function krokWstecz() {
    if (kursor === 0) return;
    kursor--;
    odswiez();
  }

  function uruchom(op) {
    if (op === 'reset-widget') {
      kursor = 0;
      stany.length = 1;
      odswiez();
      return;
    }
    const args = (scen.argumenty && scen.argumenty[op]) || {};
    stany.length = kursor + 1;
    stany.push(wykonaj(stany[kursor], { op, args }));
    kursor++;
    odswiez();
  }

  if (btnPrev) btnPrev.addEventListener('click', krokWstecz);
  if (btnNext) btnNext.addEventListener('click', krokDalej);
  host.querySelectorAll('[data-git-op]').forEach((b) => {
    b.addEventListener('click', () => uruchom(b.dataset.gitOp));
  });

  host.classList.add('is-live');
  odswiez();
  return { ok: true, run: uruchom, step: krokDalej, reset: () => uruchom('reset-widget') };
}

/** Montuje wszystkie widgety na stronie. Strony wolaja tylko to. */
export function montuj(root = document) {
  root.querySelectorAll('.gitviz[data-git-scenario]').forEach((host) => {
    try {
      createGitGraph(host);
    } catch (e) {
      // Widget, ktory sie wywroci, ma zostawic swoj blok zastepczy widoczny,
      // a nie pusta ramke. Reszta strony jest kompletna bez niego.
      host.classList.remove('is-live');
      console.error('gitgraph:', e);
    }
  });
}

/* Wystawione dla dev/test-gitgraph.mjs. Model nie dotyka DOM-u, wiec da sie
   przejsc kazdy scenariusz w node i sprawdzic, czy sie nie wywraca i czy
   jest deterministyczny — bez przegladarki. */
export { ETYKIETY, wykonaj, pustyStan, rysuj, skrot };
