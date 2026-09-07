/* Test silnika bez przegladarki.
 *
 *     node dev/test-gitgraph.mjs
 *
 * Sprawdza cztery rzeczy, po jednej na kazdy sposob, w jaki taki widget
 * potrafi sie zepsuc po cichu:
 *
 *   1. Kazdy scenariusz przechodzi wszystkie kroki bez wyjatku.
 *   2. Rysunek nie jest pusty i nie ma w nim "undefined" ani "NaN"
 *      (najczestszy objaw zlego ukladu: wspolrzedna policzona z null-a).
 *   3. Przejscie scenariusza dwa razy daje IDENTYCZNY wynik — skroty licza
 *      sie z tresci, wiec kazda niedeterministyczna wartosc (data, licznik)
 *      wyszlaby tutaj.
 *   4. Cofniecie do kroku zerowego daje dokladnie stan poczatkowy. To jest
 *      ten warunek, ktory najlatwiej zlamac, gdy cofanie odwraca operacje
 *      zamiast wracac do migawki.
 */

import { SCENARIUSZE } from '../assets/scenarios.js';
import { wykonaj, pustyStan, rysuj, createGitGraph } from '../assets/gitgraph.js';

/* Atrapa DOM-u — tyle, ile dotyka createGitGraph. Nie udaje przegladarki;
 * ma tylko sprawdzic okablowanie: czy strzalki chodza w obie strony, czy
 * przyciski sa wlaczane i wylaczane, i czy cofniecie do zera odtwarza
 * rysunek co do znaku. To ostatnie jest cala umowa tego widgetu. */
function atrapa(scenariusz) {
  const el = (klasa, dane = {}) => ({
    klasa, dataset: dane, dzieci: [], sluchacze: [],
    innerHTML: '', textContent: '', disabled: false,
    classList: { add() {}, remove() {} },
    addEventListener(_, fn) { this.sluchacze.push(fn); },
    klik() { this.sluchacze.forEach((f) => f()); }
  });
  const host = el('gitviz', { gitScenario: scenariusz });
  host.stage = el('gitviz__stage');
  host.label = el('label');
  host.licznik = el('licznik');
  host.out = el('out');
  host.prev = el('btn', { gitStep: 'prev' });
  host.next = el('btn', { gitStep: 'next' });
  host.opAmend = el('btn', { gitOp: 'amend' });
  host.querySelector = (sel) => ({
    '.gitviz__stage': host.stage, '[data-git-label]': host.label,
    '.licznik': host.licznik, '[data-git-out]': host.out,
    '[data-git-step="prev"]': host.prev, '[data-git-step="next"]': host.next
  }[sel] || null);
  host.querySelectorAll = () => [host.opAmend];
  return host;
}

function przejdz(nazwa, scen) {
  let st = pustyStan(!!scen.remote);
  for (const k of scen.start || []) st = wykonaj(st, k);
  const migawki = [JSON.stringify(st)];
  const rysunki = [rysuj(st)];
  for (const k of scen.kroki || []) {
    st = wykonaj(st, k);
    migawki.push(JSON.stringify(st));
    rysunki.push(rysuj(st));
  }
  return { migawki, rysunki };
}

let problemy = 0;
const zglos = (m) => { console.log('  BLAD: ' + m); problemy++; };

for (const [nazwa, scen] of Object.entries(SCENARIUSZE)) {
  const kroki = (scen.kroki || []).length;
  let a, b;
  try {
    a = przejdz(nazwa, scen);
    b = przejdz(nazwa, scen);
  } catch (e) {
    console.log(nazwa.padEnd(16) + ' -- wyjatek');
    zglos(nazwa + ': ' + e.message);
    continue;
  }

  a.rysunki.forEach((svg, i) => {
    // Scenariusz moze zaczynac sie od pustego repozytorium (lancuch), wiec
    // brak wezlow jest bledem tylko wtedy, gdy obiekty w ogole sa.
    const puste = Object.keys(JSON.parse(a.migawki[i]).lokalne.objects).length === 0;
    if (!puste && !svg.includes('<circle')) zglos(`${nazwa} krok ${i}: rysunek bez wezlow`);
    if (/undefined|NaN/.test(svg)) zglos(`${nazwa} krok ${i}: undefined/NaN w SVG`);
  });

  if (JSON.stringify(a.migawki) !== JSON.stringify(b.migawki)) {
    zglos(`${nazwa}: dwa przejscia daja rozne stany (niedeterminizm)`);
  }
  if (a.migawki[0] !== b.migawki[0]) zglos(`${nazwa}: rozny stan poczatkowy`);

  // Cofniecie do zera = stan poczatkowy. W widgecie realizowane migawkami,
  // wiec tutaj sprawdzamy dokladnie to zalozenie.
  if (a.migawki[0] !== JSON.stringify(JSON.parse(a.migawki[0]))) {
    zglos(`${nazwa}: stan poczatkowy nie jest JSON-owalny`);
  }

  const ostatni = JSON.parse(a.migawki[a.migawki.length - 1]);
  const ileObiektow = Object.keys(ostatni.lokalne.objects).length;
  console.log(`${nazwa.padEnd(16)} ${String(kroki).padStart(2)} krokow  `
    + `${String(ileObiektow).padStart(2)} obiektow  `
    + `${ostatni.lokalne.osierocone.length} osieroconych`);
}

/* --- okablowanie widgetu ------------------------------------------------ */

console.log('');
for (const [nazwa, scen] of Object.entries(SCENARIUSZE)) {
  const host = atrapa(nazwa);
  const w = createGitGraph(host);
  if (!w.ok) { zglos(`${nazwa}: createGitGraph nie wystartowal`); continue; }

  const svgStart = host.stage.innerHTML;
  if (!host.prev.disabled) zglos(`${nazwa}: strzalka wstecz aktywna na kroku 0`);

  const ile = (scen.kroki || []).length;
  // Porownujemy KAZDY krok z punktem wyjscia, nie tylko ostatni. Scenariusz
  // moze celowo wracac tam, skad wyszedl — w "reflog" powrot do stanu
  // poczatkowego jest cala puenta — wiec warunkiem jest, zeby po drodze
  // cokolwiek sie ruszylo, a nie zeby koniec roznil sie od poczatku.
  let ruszylo = false;
  for (let i = 0; i < ile; i++) {
    host.next.klik();
    if (host.stage.innerHTML !== svgStart) ruszylo = true;
  }
  if (!host.next.disabled) zglos(`${nazwa}: strzalka dalej aktywna na ostatnim kroku`);
  if (ile && !ruszylo) zglos(`${nazwa}: rysunek nie zmienil sie ani razu mimo ${ile} krokow`);

  for (let i = 0; i < ile; i++) host.prev.klik();
  if (host.stage.innerHTML !== svgStart) {
    zglos(`${nazwa}: cofniecie do kroku 0 nie odtwarza stanu poczatkowego`);
  }
  if (host.licznik.textContent !== '0 / ' + ile) {
    zglos(`${nazwa}: licznik pokazuje "${host.licznik.textContent}"`);
  }
}
console.log('Okablowanie widgetu: strzalki, blokady, powrot do stanu zero.');

console.log('');
if (problemy) {
  console.log(`ZNALEZIONO ${problemy} problemow`);
  process.exit(1);
}
console.log(`Wszystkie ${Object.keys(SCENARIUSZE).length} scenariuszy przechodza czysto.`);
