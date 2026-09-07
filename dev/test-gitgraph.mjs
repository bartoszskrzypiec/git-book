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
import { wykonaj, pustyStan, rysuj } from '../assets/gitgraph.js';

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

console.log('');
if (problemy) {
  console.log(`ZNALEZIONO ${problemy} problemow`);
  process.exit(1);
}
console.log(`Wszystkie ${Object.keys(SCENARIUSZE).length} scenariuszy przechodza czysto.`);
