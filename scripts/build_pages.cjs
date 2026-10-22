#!/usr/bin/env node
/* Lupka – strony dla wyszukiwarek i asystentów AI, budowane razem ze stroną (pages.yml, po pobraniu danych).
   - /jak-liczymy/      metoda oceny; liczby (wagi, progi, kary, liczba dodatków) czytane wprost z app/core.js i app/data.js,
                        więc opis zawsze zgadza się z aplikacją;
   - /lupka-czy-yuka/   porównanie na faktach ze źródłami;
   - /kategorie/ i /kategorie/<nazwa>/  najlepszy skład w kategoriach ze sklepu, z bieżącej kopii bazy (data/c/*.json);
   - /sitemap.xml.
   Użycie: node scripts/build_pages.cjs --data site/data --out site
   Bez danych (brak data/c) powstają tylko strony stałe. Tylko Node, bez bibliotek. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..');
const DATA = arg('data', path.join(ROOT, 'data'));
const OUT = arg('out', ROOT);
const BASE = 'https://lupka.app';

/* ---------- Logika aplikacji (te same pliki co w telefonie) ---------- */
const ctx = { console, Intl, URL };
vm.createContext(ctx);
for (const f of ['data.js', 'core.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'app', f), 'utf8').replace(/^'use strict';/m, ''), ctx, { filename: f });
const C = vm.runInContext(`({ normalizeProduct, analyze, grade, nutrientLevel, foodScore, personalMatch, SHOP_CATEGORIES, ADDITIVES, INCI, WATCH, PROFILE_OPTIONS,
  NUTRI_POINTS, NOVA_POINTS, ADD_PENALTY, CAP_CODES: [...CAP_CODES], CAP_SCORE, SIMPLE_FLOOR, METHOD_VERSION, THRESH, KCAL_T, WATCH_FX, WATCH_CAP, LIMIT_CAP, MATCH_FLOOR,
  MIN_SAMPLE, ALT_MIN_GAIN, SOURCES })`, ctx);
const albumSrc = fs.readFileSync(path.join(ROOT, 'app', 'ui-album.js'), 'utf8');
const LABEL_TIP = vm.runInNewContext('(' + albumSrc.match(/const LABEL_TIP = (\{[\s\S]*?\n {2}\});/)[1] + ')');

/* ---------- Pomocnicze ---------- */
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (v, d = 1) => new Intl.NumberFormat('pl-PL', { maximumFractionDigits: d }).format(v);
const pctOf = (a, b) => b ? Math.round(100 * a / b) : 0;
const MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const MONTHS_NOM = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const dayPl = iso => { const d = new Date(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const monthPl = iso => { const d = new Date(iso); return `${MONTHS_NOM[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const write = (rel, html) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };
const SCORE_STOPS = [[0, '#E5533D'], [25, '#EE8139'], [50, '#F2B43C'], [62, '#D9C13A'], [75, '#A3C23F'], [88, '#62B14B'], [100, '#2E9E55']];
const scoreColor = pct => {
  const p = Math.max(0, Math.min(100, Number(pct) || 0)), hx = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  for (let i = 1; i < SCORE_STOPS.length; i++) if (p <= SCORE_STOPS[i][0]) {
    const [p0, c0] = SCORE_STOPS[i - 1], [p1, c1] = SCORE_STOPS[i], t = (p - p0) / (p1 - p0);
    return '#' + hx(c0).map((x, j) => Math.round(x + (hx(c1)[j] - x) * t).toString(16).padStart(2, '0')).join('');
  }
  return SCORE_STOPS[SCORE_STOPS.length - 1][1];
};
const ring = (pct, size = 56) => `<span class="ring" style="--sc:${scoreColor(pct)};--pdeg:${Math.max(4, Math.round(pct * 3.6))}deg;--s:${size}px"><b>${pct}</b></span>`;
const today = new Date().toISOString();
let meta = null;
try { meta = JSON.parse(fs.readFileSync(path.join(DATA, 'meta.json'), 'utf8')); } catch (e) { /* bez danych: tylko strony stałe */ }
const BUILT = meta && meta.built ? meta.built : today;

/* ---------- Wygląd (jak strona główna) ---------- */
const LOGO = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="i-lupka" viewBox="0 0 100 100"><path d="M68 68L86 86" stroke="#2B2C30" stroke-width="12" stroke-linecap="round"/><circle cx="42" cy="42" r="22" fill="#FFFFFF"/><path d="M50.65 15.37A28 28 0 0 1 37.14 69.57" fill="none" stroke="#2E9E55" stroke-width="12" stroke-linecap="round"/><path d="M21.86 61.45A28 28 0 0 1 14.61 36.18" fill="none" stroke="#E5533D" stroke-width="12" stroke-linecap="round"/><path d="M22.55 21.86A28 28 0 0 1 32.42 15.69" fill="none" stroke="#F2B43C" stroke-width="12" stroke-linecap="round"/></symbol></svg>';
const CSS = `:root{--bg:#E8E9EB;--ink:#2B2C30;--muted:#5E6066;--line:#D7D9DD;--g:#2E9E55;--y:#F2B43C;--r:#E5533D;--f-d:'Montserrat',system-ui,sans-serif;--f-b:'Mulish',system-ui,sans-serif}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--f-b);font-size:17px;line-height:1.6}
a{color:inherit}.wrap{max-width:1200px;margin:0 auto;padding:0 20px}
h1,h2,h3{font-family:var(--f-d);letter-spacing:-.02em;line-height:1.12;margin:0}
h1{font-size:clamp(32px,5vw,50px);font-weight:900;margin:10px 0 16px}
h2{font-size:clamp(23px,3vw,30px);font-weight:800;margin:44px 0 12px}h3{font-size:19px;font-weight:800;margin:24px 0 6px}
p{margin:0 0 14px}ul,ol{margin:0 0 14px;padding-left:22px}li{margin:4px 0}
.kick{font-size:12.5px;font-weight:800;letter-spacing:.12em;color:#26864A;text-transform:uppercase}
.lead{font-size:19px;color:#3E4046}.muted{color:var(--muted)}.small{font-size:14.5px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 20px;border-radius:999px;background:var(--ink);color:#fff;font-weight:800;font-size:15px;text-decoration:none;border:2px solid var(--ink);white-space:nowrap}
.btn.ghost{background:transparent;color:var(--ink)}
header.top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 90%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
header .wrap{display:flex;align-items:center;gap:22px;height:64px}
.logo{display:inline-flex;align-items:center;gap:8px;text-decoration:none}.logo svg{width:32px;height:32px}.logo b{font-family:var(--f-d);font-weight:800;font-size:25px;letter-spacing:-.025em}
nav.links{display:flex;gap:24px;font-weight:800;font-size:15px;flex:1;margin-left:14px}nav.links a{text-decoration:none;opacity:.8}nav.links a:hover,nav.links a[aria-current]{opacity:1}nav.links a[aria-current]{text-decoration:underline;text-underline-offset:6px;text-decoration-thickness:3px}
main{padding:18px 0 40px}.doc{max-width:860px}
.crumbs{font-size:14px;font-weight:700;color:var(--muted);margin-top:10px}.crumbs a{text-decoration:none}.crumbs a:hover{text-decoration:underline}
.card{background:#fff;border-radius:24px;padding:22px 24px;margin:16px 0}
.note{background:#fff;border-left:6px solid var(--y);border-radius:16px;padding:14px 18px;margin:16px 0;font-size:15.5px}
.tbl{width:100%;border-collapse:collapse;background:#fff;border-radius:20px;overflow:hidden;font-size:15.5px;margin:12px 0 18px}
.tbl th,.tbl td{text-align:left;padding:11px 14px;border-bottom:1px solid #ECEDEF;vertical-align:top}.tbl th{font-family:var(--f-d);font-size:13.5px;letter-spacing:.02em;background:#F6F6F7}
.tbl tr:last-child td{border-bottom:0}.tbl td.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.ring{--s:56px;position:relative;flex:none;width:var(--s);height:var(--s);border-radius:50%;background:conic-gradient(var(--sc) var(--pdeg),#DADCE0 0);display:grid;place-items:center}
.ring::before{content:"";position:absolute;inset:6px;border-radius:50%;background:#fff}.ring b{position:relative;font-family:var(--f-d);font-weight:900;font-size:calc(var(--s)*.32)}
.verdicts{display:flex;height:16px;border-radius:999px;overflow:hidden;margin:10px 0 8px;background:#DADCE0}.verdicts i{display:block;height:100%}
.legend{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:14.5px;font-weight:700}.legend span::before{content:"";display:inline-block;width:11px;height:11px;border-radius:50%;background:var(--c);margin-right:7px;vertical-align:-1px}
.plist{list-style:none;padding:0;margin:14px 0;display:grid;gap:10px}
.prod{display:flex;gap:14px;align-items:center;background:#fff;border-radius:20px;padding:12px 16px 12px 12px}
.prod .pos{font-family:var(--f-d);font-weight:900;font-size:15px;color:var(--muted);width:22px;text-align:center;flex:none}
.prod img,.prod .noimg{width:58px;height:58px;border-radius:14px;object-fit:contain;background:#F2F3F4;flex:none}
.prod .t{flex:1;min-width:0}.prod .t b{display:block;font-size:16.5px;line-height:1.3}.prod .t span{display:block;font-size:14px;color:var(--muted);line-height:1.4}
.prod .facts{font-size:13.5px;color:#3E4046;margin-top:3px}.prod .v{font-size:12.5px;font-weight:800;text-align:center;width:84px;flex:none;line-height:1.25}
.prod a.go{font-size:13.5px;font-weight:800}
.tips{display:grid;gap:12px}.tip{background:#fff;border-radius:20px;padding:16px 20px}.tip b{font-family:var(--f-d)}
.cats{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin:12px 0 8px}
.cat{display:flex;gap:12px;align-items:center;background:#fff;border-radius:20px;padding:14px 16px;text-decoration:none}.cat .ct b{display:block;font-size:16.5px}.cat .ct span{display:block;font-size:13.5px;color:var(--muted);line-height:1.4}
.cta{display:flex;flex-wrap:wrap;gap:12px;align-items:center;background:var(--ink);color:#fff;border-radius:26px;padding:22px 24px;margin:28px 0}.cta p{flex:1 1 300px;margin:0;font-weight:700}.cta .btn{background:#fff;color:var(--ink);border-color:#fff}
.vs th:nth-child(2),.vs td:nth-child(2){background:#F1F8F3}
details{background:#fff;border-radius:18px;padding:14px 18px;margin:10px 0}summary{font-weight:800;cursor:pointer}details p{margin:10px 0 0}
.src{font-size:14.5px}.src li{margin:6px 0}
footer{padding:26px 0 50px}footer .wrap{display:flex;justify-content:space-between;align-items:flex-start;gap:16px 26px;border-top:1px solid #CFD1D5;padding-top:24px;flex-wrap:wrap}
footer .links{display:flex;gap:10px 22px;flex-wrap:wrap;font-weight:800;font-size:14.5px}footer .muted{font-weight:700;font-size:14px}
@media (max-width:760px){nav.links{display:none}header .wrap{justify-content:space-between}body{font-size:16.5px}.lead{font-size:17.5px}
.card{padding:18px}.prod{padding:10px 12px 10px 8px;gap:10px}.prod .pos{display:none}.prod img,.prod .noimg{width:50px;height:50px}.prod .v{display:none}.prod .ring{--s:46px!important}
.tbl{font-size:14.5px}.hide-m{display:none}.tbl th,.tbl td{padding:9px 10px}}`;
const NAV = [['/jak-liczymy/', 'Jak liczymy'], ['/kategorie/', 'Kategorie'], ['/lupka-czy-yuka/', 'Lupka czy Yuka'], ['/#pytania', 'Pytania']];
const page = ({ path: p, title, desc, h1, kick, lead, body, ld, crumbs, ogImage }) => `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${BASE}${p}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#E8E9EB">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon-180.png">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Lupka">
<meta property="og:locale" content="pl_PL">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${BASE}${p}">
<meta property="og:image" content="${ogImage || BASE + '/img/og.jpg'}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@800;900&family=Mulish:wght@400;700;800&display=swap">
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [].concat(ld || [], crumbs ? [{ '@type': 'BreadcrumbList', itemListElement: crumbs.map(([u, n], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: BASE + u })) }] : []) }).replace(/</g, '\\u003c')}</script>
</head>
<body>
${LOGO}
<header class="top"><div class="wrap">
  <a class="logo" href="/" aria-label="Lupka – strona główna"><svg><use href="#i-lupka"/></svg><b>lupka</b></a>
  <nav class="links" aria-label="Strony">${NAV.map(([u, n]) => `<a href="${u}"${p.startsWith(u) && u !== '/#pytania' ? ' aria-current="page"' : ''}>${n}</a>`).join('')}</nav>
  <a class="btn" href="/app/">Otwórz aplikację</a>
</div></header>
<main><div class="wrap doc">
${crumbs ? `<nav class="crumbs" aria-label="Okruszki">${crumbs.map(([u, n], i) => i < crumbs.length - 1 ? `<a href="${u}">${esc(n)}</a> › ` : `<span>${esc(n)}</span>`).join('')}</nav>` : ''}
${kick ? `<span class="kick">${kick}</span>` : ''}
<h1>${h1}</h1>
${lead ? `<p class="lead">${lead}</p>` : ''}
${body}
</div></main>
<footer><div class="wrap"><a class="logo" href="/"><svg><use href="#i-lupka"/></svg><b>lupka</b></a>
<span class="links"><a href="/jak-liczymy/">Jak liczymy wynik</a><a href="/kategorie/">Produkty według kategorii</a><a href="/lupka-czy-yuka/">Lupka czy Yuka</a><a href="/privacy.html?z=strona">Polityka prywatności</a><a href="mailto:rafalmsolutions@gmail.com?subject=Lupka">Kontakt</a></span>
<span class="muted">Dane: <a href="https://pl.openfoodfacts.org/">Open Food Facts</a> (ODbL) · © ${new Date(BUILT).getUTCFullYear()} Lupka</span></div></footer>
</body>
</html>
`;
const ORG = { '@type': 'Organization', '@id': BASE + '/#org', name: 'Lupka', url: BASE + '/' };
const cta = (text, href, label) => `<div class="cta"><p>${text}</p><a class="btn" href="${href}">${label}</a></div>`;

/* ---------- 1. Jak liczymy wynik ---------- */
function methodPage() {
  const L = ['bez zastrzeżeń', 'niewielkie zastrzeżenia', 'umiarkowane zastrzeżenia', 'duże zastrzeżenia'];
  const adds = Object.entries(C.ADDITIVES), byLevel = [0, 1, 2, 3].map(l => adds.filter(([, v]) => v[1] === l));
  const ex = l => byLevel[l].slice(0, 4).map(([k, v]) => `${k} (${v[0]})`).join(', ');
  const capNames = C.CAP_CODES.map(k => `${k} ${C.ADDITIVES[k] ? C.ADDITIVES[k][0] : ''}`.trim()).join(', ');
  const T = C.THRESH, f = v => num(v, 2);
  const W = C.WATCH.reduce((m, w) => (m[w.kind] = (m[w.kind] || []).concat(w.label.replace(' (więcej)', '').toLowerCase()), m), {});
  const fx = C.WATCH_FX, cap = C.WATCH_CAP;
  // Przykład liczony tą samą funkcją co w aplikacji.
  const exAdd = [{ code: 'E407', level: C.ADDITIVES.E407[1] }];
  const ex1 = C.foodScore({ nutriscore: 'b', nova: 4, additives: exAdd, additivesKnown: true, simple: false });
  const exAdd2 = 100 - C.ADD_PENALTY[2];
  const ex1g = C.grade(ex1.score).label;
  const sugarHigh = C.THRESH.sugars.food[1];
  const fam = [100, 100, 5], avg = Math.round(fam.reduce((a, b) => a + b, 0) / fam.length);
  const allergens = C.PROFILE_OPTIONS.allergens.map(o => o.label.toLowerCase()).join(', ');
  const inci = Object.values(C.INCI), inciN = [1, 2, 3].map(l => inci.filter(v => v[0] === l).length);
  const body = `
<div class="card"><p style="margin:0"><b>W skrócie.</b> Ocena składu (0–100) jest taka sama dla wszystkich: 60% to wartość odżywcza według Nutri-Score, 30% dodatki do żywności, 10% stopień przetworzenia (NOVA). Dopasowanie do osoby (procent) zaczyna od oceny składu i zmienia ją według jej profilu: czego nie je i czego pilnuje. Wynik rodziny to dopasowanie osoby, której produkt pasuje najsłabiej.</p></div>
<p class="small muted">Metoda w wersji ${esc(C.METHOD_VERSION)}. Liczby na tej stronie są odczytywane wprost z kodu aplikacji przy każdej aktualizacji strony, ostatnio ${dayPl(today)}.</p>

<h2>1. Ocena składu: trzy części</h2>
<div class="scroll"><table class="tbl"><thead><tr><th>Część</th><th>Waga</th><th>Jak liczona</th></tr></thead><tbody>
<tr><td><b>Wartość odżywcza</b> (Nutri-Score)</td><td class="n">60%</td><td>A = ${C.NUTRI_POINTS.a}, B = ${C.NUTRI_POINTS.b}, C = ${C.NUTRI_POINTS.c}, D = ${C.NUTRI_POINTS.d}, E = ${C.NUTRI_POINTS.e} pkt. Gdy w bazie nie ma Nutri-Score, a są wartości odżywcze, liczymy go szacunkowo algorytmem z 2023 r. (bez napojów) i zaznaczamy to przy produkcie.</td></tr>
<tr><td><b>Dodatki do żywności</b></td><td class="n">30%</td><td>Start: 100 pkt. Dodatek z umiarkowanymi zastrzeżeniami odejmuje ${C.ADD_PENALTY[2]} pkt, z dużymi ${C.ADD_PENALTY[3]} pkt. Dodatki bez zastrzeżeń i z niewielkimi zastrzeżeniami <b>nie obniżają oceny</b>, tylko są opisane.</td></tr>
<tr><td><b>Przetworzenie</b> (NOVA)</td><td class="n">10%</td><td>NOVA 1 = ${C.NOVA_POINTS[1]}, NOVA 2 = ${C.NOVA_POINTS[2]}, NOVA 3 = ${C.NOVA_POINTS[3]}, NOVA 4 = ${C.NOVA_POINTS[4]} pkt.</td></tr>
</tbody></table></div>
<p>Gdy brakuje którejś części (np. nie znamy składu), liczymy z pozostałych, proporcjonalnie do ich wag, i oznaczamy ocenę jako częściową. Na listach i w porównaniach bierzemy pod uwagę tylko oceny policzone z co najmniej dwóch części.</p>
<h3>Dwie zasady dodatkowe</h3>
<ul>
<li><b>Limit ${C.CAP_SCORE} pkt</b> tylko dla substancji wycofanych w UE albo z mocnymi dowodami szkodliwości: ${esc(capNames)}. Taki produkt nie może mieć oceny wyższej niż „Od czasu do czasu”.</li>
<li><b>Ochrona prostej żywności:</b> produkt nieprzetworzony (NOVA 1–2) albo z 1–2 składników bez dodatków nie spada poniżej ${C.SIMPLE_FLOOR} pkt za same kalorie czy tłuszcz. Orzechy, oliwa czy ser nie dostają więc najniższego werdyktu.</li>
</ul>
<h3>Przykład</h3>
<p>Produkt z Nutri-Score B, NOVA 4 i jednym dodatkiem z umiarkowanymi zastrzeżeniami (E407, karagen): 60% × ${C.NUTRI_POINTS.b} + 30% × ${exAdd2} + 10% × ${C.NOVA_POINTS[4]} = <b>${ex1.score} pkt</b>, czyli „${esc(ex1g)}”.</p>

<h2>2. Werdykty bez straszenia</h2>
<div class="scroll"><table class="tbl"><thead><tr><th>Ocena składu</th><th>Werdykt</th></tr></thead><tbody>
${[[75, 100], [50, 74], [25, 49], [0, 24]].map(([a, b]) => `<tr><td class="n" style="text-align:left">${a}–${b}</td><td><span style="display:inline-flex;align-items:center;gap:10px">${ring(b, 34)}<b>${esc(C.grade(b).label)}</b></span></td></tr>`).join('')}
</tbody></table></div>
<p>Nie używamy słów „złe”, „szkodliwe” ani „toksyczne”. Liczy się cała dieta, a nie pojedynczy produkt, więc werdykt mówi raczej, jak często po coś sięgać.</p>

<h2>3. Dodatki: liczy się ryzyko, a nie sama obecność</h2>
<p>Mamy opisanych ${adds.length} dodatków do żywności. Każdy ma poziom zastrzeżeń ustalony na podstawie opinii EFSA, klasyfikacji IARC, wytycznych WHO i przepisów UE:</p>
<div class="scroll"><table class="tbl"><thead><tr><th>Poziom</th><th class="n">Dodatków</th><th>Wpływ na ocenę</th><th class="hide-m">Przykłady</th></tr></thead><tbody>
${[0, 1, 2, 3].map(l => `<tr><td><b>${L[l][0].toUpperCase() + L[l].slice(1)}</b></td><td class="n">${byLevel[l].length}</td><td>${C.ADD_PENALTY[l] ? '−' + C.ADD_PENALTY[l] + ' pkt w części „dodatki”' : 'nie obniża'}</td><td class="small hide-m">${esc(ex(l))}</td></tr>`).join('')}
</tbody></table></div>
<p>Glutaminian sodu, lecytyny czy kwas cytrynowy nie obniżają oceny. Dodatek spoza naszej bazy jest pokazywany, ale nie wpływa na wynik. Przy każdym dodatku w aplikacji jest krótki opis i źródło.</p>

<h2>4. Dopasowanie do osoby</h2>
<p>Każdy domownik ma własny profil. Bez profilu dopasowanie równa się ocenie składu. Z profilem zaczynamy od oceny składu i stosujemy dwie listy.</p>
<h3>„Nie jem”: alergeny i diety</h3>
<p>Do wyboru jest ${C.PROFILE_OPTIONS.allergens.length} alergenów z unijnej listy (${esc(allergens)}), diety (${esc(C.PROFILE_OPTIONS.diet.map(o => o.label.toLowerCase()).join(', '))}), a także własne słowa, np. nazwa składnika.</p>
<ul>
<li>Produkt <b>zawiera</b> coś z listy: dopasowanie 0–10% i komunikat „Nie dla: …” z powodem.</li>
<li>„<b>Może zawierać</b>” (śladowe ilości): najwyżej 35%.</li>
<li>W bazie <b>brak składu</b>: najwyżej ${C.LIMIT_CAP.unknown}% i prośba o sprawdzenie etykiety.</li>
</ul>
<h3>„Pilnuję”: składniki do ograniczenia albo zwiększenia</h3>
<div class="scroll"><table class="tbl"><thead><tr><th>Co</th><th>Mało</th><th>Średnio</th><th>Dużo</th></tr></thead><tbody>
<tr><td><b>Ograniczam:</b> ${esc(W.limit.join(', '))}</td><td>+${fx.limit.low} pkt</td><td>${fx.limit.mid} pkt, najwyżej ${cap.mid}%</td><td>${fx.limit.high} pkt, najwyżej ${cap.high}%</td></tr>
<tr><td><b>Unikam:</b> ${esc(W.contains.join(', '))}</td><td colspan="2">nie zawiera: bez zmian</td><td>zawiera: ${fx.contains.yes} pkt, najwyżej ${cap.yes}%</td></tr>
<tr><td><b>Chcę więcej:</b> ${esc(W.more.join(', '))}</td><td>bez zmian</td><td>źródło: +${fx.more.mid} pkt</td><td>+${fx.more.high} pkt</td></tr>
</tbody></table></div>
<p>Gdy brakuje danych o składniku, którego pilnujesz, dopasowanie wynosi najwyżej ${cap.unknown}%. Dzięki górnym granicom produkt z większą ilością cukru czy soli nigdy nie wypada lepiej niż ten sam produkt z mniejszą. Produkt, którego tylko pilnujesz, ma zawsze co najmniej ${C.MATCH_FLOOR}%, czyli więcej niż taki, którego nie jesz.</p>
<h3>Progi „mało” i „dużo” (na 100 g; napoje na 100 ml)</h3>
<div class="scroll"><table class="tbl"><thead><tr><th>Składnik</th><th class="n">Mało: do</th><th class="n">Dużo: powyżej</th></tr></thead><tbody>
<tr><td>Cukry</td><td class="n">${f(T.sugars.food[0])} g (${f(T.sugars.drink[0])} g)</td><td class="n">${f(T.sugars.food[1])} g (${f(T.sugars.drink[1])} g)</td></tr>
<tr><td>Sól</td><td class="n">${f(T.salt.food[0])} g (${f(T.salt.drink[0])} g)</td><td class="n">${f(T.salt.food[1])} g (${f(T.salt.drink[1])} g)</td></tr>
<tr><td>Tłuszcze nasycone</td><td class="n">${f(T['saturated-fat'].food[0])} g (${f(T['saturated-fat'].drink[0])} g)</td><td class="n">${f(T['saturated-fat'].food[1])} g (${f(T['saturated-fat'].drink[1])} g)</td></tr>
<tr><td>Kalorie</td><td class="n">${C.KCAL_T.food[0]} kcal (${C.KCAL_T.drink[0]} kcal)</td><td class="n">${C.KCAL_T.food[1]} kcal (${C.KCAL_T.drink[1]} kcal)</td></tr>
</tbody></table></div>
<p class="small muted">Progi „mało” pochodzą z unijnych oświadczeń żywieniowych (rozporządzenie 1924/2006), progi „dużo” z brytyjskiego oznaczenia kolorami na opakowaniach. Białko: źródło od 5 g, dużo od 10 g na 100 g. Błonnik: źródło od 3 g, dużo od 6 g.</p>

<h2>5. Wynik rodziny: najsłabsza osoba, nie średnia</h2>
<p>Przy kilku osobach Lupka pokazuje wynik każdej z nich i jeden wynik rodziny: dopasowanie osoby, której produkt pasuje najsłabiej. Przykład: płatki owsiane pasują Oli i Ani w 100%, ale Kuba nie je glutenu (5%). Średnia dałaby ${avg}%, czyli „Dobre”, i problem Kuby zginąłby w liczbie. Lupka pokaże 5% i „Nie dla: Kuba · gluten”.</p>
<p>Na zakupy można wyłączyć osoby, dla których dziś się nie kupuje. Wtedy wynik liczy się tylko dla włączonych.</p>

<h2>6. Na tle podobnych produktów i zamienniki</h2>
<p>Przy produkcie pokazujemy, od ilu procent produktów z tej samej kategorii ma lepszą ocenę składu (gdy mamy co najmniej ${C.MIN_SAMPLE} produktów do porównania). Zamiennik musi mieć ocenę wyższą o co najmniej ${C.ALT_MIN_GAIN} pkt i pasować do profilu. Nie proponujemy droższych produktów „bio” tylko dlatego, że są bio.</p>

<h2>7. Kosmetyki</h2>
<p>W kosmetykach oceniamy skład INCI. Mamy opisanych ${inci.length} składników: ${inciN[0]} z niewielkimi, ${inciN[1]} z umiarkowanymi i ${inciN[2]} z dużymi zastrzeżeniami. Składnik z umiarkowanymi zastrzeżeniami odejmuje 15 pkt, z dużymi 40 pkt, a jego obecność ogranicza ocenę do ${C.CAP_SCORE} pkt.</p>

<h2>8. Czego nie robimy</h2>
<ul>
<li>Nie dajemy premii za oznaczenie „bio”. Ekologiczny cukier to dalej cukier.</li>
<li>Nie bierzemy pieniędzy od producentów i nie mamy reklam. Kolejność produktów zależy tylko od oceny.</li>
<li>Nie karzemy za sam dodatek bez względu na ryzyko.</li>
<li>Nie stawiamy diagnoz. Ocena to informacja, nie porada medyczna.</li>
</ul>
<div class="note"><b>Skąd dane i co z błędami.</b> Dane o produktach pochodzą z otwartej bazy <a href="https://pl.openfoodfacts.org/">Open Food Facts</a>, tworzonej przez kupujących. Mogą zawierać błędy, dlatego przy alergii zawsze sprawdź etykietę. Błąd zgłosisz przy produkcie w aplikacji, a brakujące dane uzupełnisz zdjęciem etykiety.</div>

<h2>Zmiany metody</h2>
<div class="scroll"><table class="tbl"><thead><tr><th>Data</th><th>Zmiana</th></tr></thead><tbody>
<tr><td class="n" style="text-align:left">21.10.2026</td><td>Jeden wynik rodziny: dopasowanie osoby, której produkt pasuje najsłabiej. Tak samo na ekranie produktu, na listach i w historii.</td></tr>
<tr><td class="n" style="text-align:left">19.10.2026</td><td>Wersja 2: dodatki według ryzyka, limit tylko dla E171 i azotynów/azotanów, ochrona prostej żywności, nowe werdykty.</td></tr>
</tbody></table></div>

<h2>Źródła</h2>
<ul class="src">${C.SOURCES.map(s => `<li><a href="${esc(s.url)}">${esc(s.label)}</a></li>`).join('')}
<li><a href="https://eur-lex.europa.eu/eli/reg/2006/1924/oj">Rozporządzenie (WE) 1924/2006 w sprawie oświadczeń żywieniowych</a></li>
<li><a href="https://www.santepubliquefrance.fr/en/nutri-score">Nutri-Score (Santé publique France)</a></li></ul>
${cta('Sprawdź, jak to działa na Twoich zakupach.', '/app/', 'Otwórz Lupkę')}`;
  return page({
    path: '/jak-liczymy/', title: 'Jak Lupka liczy wynik – metoda oceny produktów', h1: 'Jak Lupka liczy wynik',
    desc: 'Metoda oceny w Lupce krok po kroku: Nutri-Score, dodatki według ryzyka, przetworzenie NOVA, dopasowanie do alergii i diety oraz wynik dla całej rodziny.',
    kick: 'METODA', lead: 'Każdy produkt dostaje ocenę składu i dopasowanie do każdej osoby w rodzinie. Tu opisujemy dokładnie, skąd biorą się te liczby.', body,
    crumbs: [['/', 'Lupka'], ['/jak-liczymy/', 'Jak liczymy wynik']],
    ld: [ORG, { '@type': 'TechArticle', headline: 'Jak Lupka liczy wynik', inLanguage: 'pl-PL', dateModified: today.slice(0, 10), author: { '@id': BASE + '/#org' }, publisher: { '@id': BASE + '/#org' }, mainEntityOfPage: BASE + '/jak-liczymy/' }]
  });
}

/* ---------- 2. Lupka czy Yuka ---------- */
const YUKA_ASOF = '22.10.2026';
function yukaPage() {
  const rows = [
    ['Wynik dla kilku osób naraz', 'Tak: każdy domownik ma własny profil, a przy produkcie widać wynik każdej osoby i jeden wynik rodziny.', 'Na stronach Yuki nie znaleźliśmy profili dla kilku osób.'],
    ['Ocena żywności', '60% Nutri-Score, 30% dodatki, 10% przetworzenie (NOVA).', '60% Nutri-Score, 30% dodatki, 10% premia za certyfikat bio [1].'],
    ['Dodatki', 'Obniżają ocenę tylko przy umiarkowanych i dużych zastrzeżeniach. Limit 49/100 tylko dla E171 i azotynów/azotanów.', 'Dodatek wysokiego ryzyka ogranicza ocenę do 49/100 [1].'],
    ['Premia za bio', 'Nie.', 'Tak, 10% oceny [1].'],
    ['Wyszukiwanie po nazwie', 'Za darmo.', 'W wersji Premium [2].'],
    ['Działanie bez internetu', 'Za darmo.', 'W wersji Premium [2].'],
    ['Ostrzeżenia o składnikach (np. gluten, olej palmowy)', 'Za darmo: profil „Nie jem” i „Pilnuję”.', 'W wersji Premium [2].'],
    ['Cena', 'Za darmo, bez reklam. Planowany pakiet Lupka Plus (do 10 zł/mies.) z dodatkami, np. rodzina na kilku telefonach.', 'Podstawa za darmo. Premium: na stronie Yuki 15 USD rocznie, do wyboru trzy progi cenowe z tymi samymi funkcjami [2][3].'],
    ['Kosmetyki', 'Tak, ocena składu INCI.', 'Tak.'],
    ['Skąd dane', 'Otwarta baza Open Food Facts; kopia polskich produktów w aplikacji.', 'Własna baza Yuki.'],
    ['Gdzie działa', 'W przeglądarce telefonu (Android, iPhone); Google Play wkrótce. Po polsku.', 'Aplikacja w App Store i Google Play [4].']
  ];
  const body = `
<p class="small muted">Stan na ${YUKA_ASOF}. Informacje o Yuce pochodzą z jej stron (źródła na dole). Jeśli coś się zmieniło, <a href="mailto:rafalmsolutions@gmail.com?subject=Lupka%20czy%20Yuka">napisz do nas</a>, poprawimy.</p>
<div class="card"><p style="margin:0"><b>W skrócie.</b> Obie aplikacje skanują kod kreskowy i oceniają skład podobną metodą opartą na Nutri-Score. Lupka sprawdza produkt jednocześnie dla każdej osoby w rodzinie i za darmo daje wyszukiwanie, działanie bez internetu i ostrzeżenia o składnikach. Yuka jest dłużej na rynku i ma natywne aplikacje w sklepach.</p></div>
<h2>Porównanie</h2>
<div class="scroll"><table class="tbl vs"><thead><tr><th></th><th>Lupka</th><th>Yuka</th></tr></thead><tbody>
${rows.map(([a, b, c]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join('')}
</tbody></table></div>
<h2>Kiedy wybrać Lupkę</h2>
<ul><li>Robisz zakupy dla kilku osób z różnymi potrzebami, np. dziecko z alergią i ktoś, kto pilnuje cukru.</li>
<li>Chcesz wyszukiwania i ostrzeżeń o składnikach bez abonamentu.</li>
<li>Wolisz spokojny ton: „na co dzień” i „od czasu do czasu” zamiast „zły produkt”.</li>
<li>Kupujesz w Polsce i chcesz porównywać produkty z polskich sklepów.</li></ul>
<h2>Kiedy Yuka może być lepsza</h2>
<ul><li>Chcesz aplikacji ze sklepu, sprawdzonej przez miliony osób: w Google Play ma ponad 10 mln pobrań [4].</li>
<li>Często kupujesz za granicą.</li>
<li>Zależy Ci na premii za produkty bio w ocenie.</li></ul>
<h2>Jak liczymy</h2>
<p>Pełny opis metody Lupki, z progami i przykładami: <a href="/jak-liczymy/">Jak Lupka liczy wynik</a>.</p>
<h2>Źródła</h2>
<ol class="src">
<li><a href="https://help.yuka.io/l/en/article/ijzgfvi1jq">Yuka: How are food products rated?</a></li>
<li><a href="https://yuka.io/en/premium-member/">Yuka: Premium</a></li>
<li><a href="https://help.yuka.io/l/en/article/b5wkrfepnp-why-are-there-different-tariffs">Yuka: Why are there different pricing options?</a></li>
<li><a href="https://play.google.com/store/apps/details?id=io.yuka.android">Yuka w Google Play</a></li>
</ol>
<p class="small muted">Yuka jest znakiem towarowym jej właściciela. Lupka nie jest z nią powiązana.</p>
${cta('Sprawdź swoje zakupy dla całej rodziny. Za darmo, bez konta.', '/app/', 'Otwórz Lupkę')}`;
  return page({
    path: '/lupka-czy-yuka/', title: 'Lupka czy Yuka – porównanie skanerów produktów (2026)', h1: 'Lupka czy Yuka?',
    desc: 'Lupka i Yuka obok siebie: metoda oceny, dodatki, premia za bio, wyszukiwanie, tryb offline, cena i wynik dla całej rodziny. Fakty ze źródłami.',
    kick: 'PORÓWNANIE', lead: 'Uczciwe porównanie dwóch skanerów składu: co jest takie samo, co różne i kiedy która aplikacja sprawdzi się lepiej.', body,
    crumbs: [['/', 'Lupka'], ['/lupka-czy-yuka/', 'Lupka czy Yuka']],
    ld: [ORG, { '@type': 'Article', headline: 'Lupka czy Yuka – porównanie skanerów produktów', inLanguage: 'pl-PL', dateModified: '2026-10-22', author: { '@id': BASE + '/#org' }, publisher: { '@id': BASE + '/#org' }, mainEntityOfPage: BASE + '/lupka-czy-yuka/' }]
  });
}

/* ---------- 3. Kategorie ---------- */
const TOP_N = 10, MIN_SCORED = 8;
const FOREIGN = /[éèêëàâäçîïôöûùüßñåøæ]/i;
const EN_WORDS = /\b(the|with|and|of|flakes|drink|rice|coffee|beans|tomatoes|almonds|apricot|peanuts?|organic|natural|sauce|cheese|juice|milk|chocolate|water|tea|whole|peeled|dried|pure|bread|soup|yogurt|yoghurt|cookies|crackers)\b/i;
const looksPolish = name => !FOREIGN.test(name) && !(EN_WORDS.test(name) && !/[ąćęłńóśźż]/i.test(name));
const nameKey = s => slug(s).replace(/-/g, '');
/* Najczęstsze powody niższej oceny w kategorii: każdy z wartością i podpowiedzią, gdzie to sprawdzić na etykiecie. */
const ISSUES = [
  { key: 'sugar', test: r => C.nutrientLevel('sugars', r.pr.nutriments.sugars, r.pr.drink) === 'high', label: r => `dużo cukru (powyżej ${num(C.THRESH.sugars[r ? 'drink' : 'food'][1], 2)} g na 100 ${r ? 'ml' : 'g'})`, tip: 'lowsugar' },
  { key: 'salt', test: r => C.nutrientLevel('salt', r.pr.nutriments.salt, r.pr.drink) === 'high', label: r => `dużo soli (powyżej ${num(C.THRESH.salt[r ? 'drink' : 'food'][1], 2)} g na 100 ${r ? 'ml' : 'g'})`, tip: 'lowsalt' },
  { key: 'sat', test: r => C.nutrientLevel('saturated-fat', r.pr.nutriments.sat, r.pr.drink) === 'high', label: r => `dużo tłuszczów nasyconych (powyżej ${num(C.THRESH['saturated-fat'][r ? 'drink' : 'food'][1], 2)} g na 100 ${r ? 'ml' : 'g'})`, tip: 'lowsat' },
  { key: 'add', test: r => r.an.additives.some(a => a.level >= 2), label: () => 'dodatek z umiarkowanymi lub dużymi zastrzeżeniami', tip: 'noadd' },
  { key: 'nova', test: r => Number(r.pr.nova) === 4, label: () => 'mocne przetworzenie (NOVA 4)', tip: 'nova12' },
  { key: 'palm', test: r => (r.pr.analysis || []).includes('en:palm-oil') || /palmow/i.test(r.pr.ingredients || ''), label: () => 'olej palmowy w składzie', tip: 'nopalm' }
];
function loadCategory(c) {
  const f = path.join(DATA, 'c', c.key.replace(':', '_') + '.json');
  if (!fs.existsSync(f)) return null;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const all = (d.products || []).map(p => { const pr = C.normalizeProduct(p, 'off'); return { pr, an: C.analyze(pr), scans: Number(p.unique_scans_n) || 0 }; });
  const scored = all.filter(r => r.pr.name && r.an.score != null && r.an.parts.length >= 2);
  if (scored.length < MIN_SCORED) return null;
  const seen = new Set();
  const top = scored.filter(r => looksPolish(r.pr.name)).sort((a, b) => b.an.score - a.an.score || b.scans - a.scans)
    .filter(r => { const k = nameKey(r.pr.name) + '|' + nameKey(r.pr.brand); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, TOP_N);
  const v = [0, 0, 0, 0]; scored.forEach(r => v[r.an.score >= 75 ? 0 : r.an.score >= 50 ? 1 : r.an.score >= 25 ? 2 : 3]++);
  const drinks = scored.filter(r => r.pr.drink).length > scored.length / 2;
  const issues = ISSUES.map(i => ({ ...i, n: scored.filter(i.test).length })).filter(i => i.n / scored.length >= 0.15).sort((a, b) => b.n - a.n).slice(0, 3);
  const med = k => { const xs = scored.map(r => r.pr.nutriments[k]).filter(x => x != null).sort((a, b) => a - b); return xs.length >= 5 ? xs[Math.floor(xs.length / 2)] : null; };
  return { c, slug: slug(c.label), count: d.count || all.length, sample: all.length, scored, top, v, drinks, issues, med: { sugars: med('sugars'), salt: med('salt') } };
}
const VCOL = [scoreColor(100), scoreColor(62), scoreColor(37), scoreColor(10)];
const VLAB = ['Dobre na co dzień', 'Dobre', 'Od czasu do czasu', 'Raczej rzadko'];
const lc = s => s.charAt(0).toLowerCase() + s.slice(1);
const nProd = n => `${n} ${n === 1 ? 'produkt' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? 'produkty' : 'produktów'}`;
function categoryPage(k, all) {
  const { c, scored, top, v, drinks, issues, med } = k, n = scored.length, unit = drinks ? '100 ml' : '100 g';
  const name = c.label, best = top[0];
  const goodShare = pctOf(v[0] + v[1], n);
  const facts = r => {
    const nm = r.pr.nutriments, out = [];
    if (nm.sugars != null) out.push(`cukry ${num(nm.sugars)} g`);
    if (nm.salt != null) out.push(`sól ${num(nm.salt, 2)} g`);
    if (nm.proteins != null && nm.proteins >= 5) out.push(`białko ${num(nm.proteins)} g`);
    const ad = r.an.additivesKnown ? r.an.additives.length : null;
    return (out.length ? out.join(' · ') + ` na ${unit}` : '') + (ad == null ? '' : (out.length ? ' · ' : '') + (ad ? `dodatki: ${ad}` : 'bez dodatków'));
  };
  const item = (r, i) => `<li class="prod"><span class="pos">${i + 1}</span>${r.pr.image ? `<img src="${esc(r.pr.image)}" alt="" width="58" height="58" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.className='noimg';this.removeAttribute('src')">` : '<span class="noimg"></span>'}
<span class="t"><b>${esc(r.pr.name)}</b><span>${esc([r.pr.brand, r.pr.quantity].filter(Boolean).join(' · '))}</span><span class="facts">${esc(facts(r))}</span><a class="go" href="/app/#/p/${esc(r.pr.code)}">Sprawdź dla rodziny →</a></span>
${ring(r.an.score, 50)}<span class="v" style="color:color-mix(in srgb,${scoreColor(r.an.score)} 62%,#2B2C30)">${esc(C.grade(r.an.score).label)}</span></li>`;
  const tips = issues.length ? `<h2>Na co patrzeć na etykiecie</h2>
<p>Najczęstsze powody niższej oceny w tej kategorii:</p>
<div class="tips">${issues.map(i => `<div class="tip"><b>${pctOf(i.n, n)}% ma ${esc(i.label(drinks))}.</b><br>${esc(LABEL_TIP[i.tip] || '')}</div>`).join('')}</div>` : '';
  const others = all.filter(x => x !== k && x.c.group === c.group).slice(0, 6);
  const faq = [
    [`Który produkt z kategorii „${name}” ma najlepszy skład?`, best ? `W naszej kopii bazy najwyższą ocenę składu ma ${best.pr.name}${best.pr.brand ? ` (${best.pr.brand})` : ''}: ${best.an.score}/100, „${C.grade(best.an.score).label}”. Pełna lista ${TOP_N} najlepszych jest wyżej.` : ''],
    [`Ile produktów z tej kategorii ma dobrą ocenę?`, `${goodShare}% z ${n} ocenionych produktów ma ocenę co najmniej 50/100 („Dobre” albo „Dobre na co dzień”).`],
    med.sugars != null ? [`Ile cukru mają produkty z kategorii „${name}”?`, `Połowa ocenionych produktów ma najwyżej ${num(med.sugars)} g cukrów na ${unit}. Mało cukru to do ${num(C.THRESH.sugars[drinks ? 'drink' : 'food'][0], 2)} g na ${unit}.`] : null,
    [`Czy ta lista uwzględnia alergie?`, `Nie. To ogólna ocena składu, taka sama dla wszystkich. W aplikacji Lupka ta sama kategoria jest posortowana dla Ciebie i Twojej rodziny: produkty z alergenami, których nie jecie, trafiają na koniec z powodem.`]
  ].filter(Boolean).filter(q => q[1]);
  const body = `
<p class="small muted">Dane: Open Food Facts, kopia z ${dayPl(BUILT)}. Ocenionych produktów: ${n} spośród ${k.sample} najpopularniejszych w Polsce${k.count > k.sample ? ` (w bazie jest ich ${k.count})` : ''}. Kolejność zależy tylko od oceny składu, nikt za nią nie płaci.</p>
<div class="card"><b>Oceny w kategorii „${esc(name)}”</b>
<div class="verdicts" role="img" aria-label="${VLAB.map((l, i) => `${l}: ${pctOf(v[i], n)}%`).join(', ')}">${v.map((x, i) => x ? `<i style="width:${100 * x / n}%;background:${VCOL[i]}"></i>` : '').join('')}</div>
<div class="legend">${VLAB.map((l, i) => `<span style="--c:${VCOL[i]}">${l}: ${pctOf(v[i], n)}%</span>`).join('')}</div></div>
<h2>${TOP_N} produktów z najlepszym składem</h2>
<ol class="plist">${top.map(item).join('')}</ol>
<p class="small muted">Przy równej ocenie wyżej jest produkt częściej skanowany. Wartości na ${unit}. Zdjęcia: Open Food Facts (CC BY-SA). Dane mogą zawierać błędy: przy alergii sprawdź etykietę, a błąd zgłoś przy produkcie w aplikacji.</p>
${cta(`Ta sama lista, ale dla Twojej rodziny: z alergiami i tym, czego pilnujecie.`, `/app/#/lista/${c.key}`, 'Otwórz kategorię w Lupce')}
${tips}
<h2>Pytania</h2>
${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
<p class="small">Jak liczymy ocenę składu: <a href="/jak-liczymy/">metoda Lupki</a>.</p>
${others.length ? `<h2>Podobne kategorie</h2><div class="cats">${others.map(catTile).join('')}</div>` : ''}`;
  const when = monthPl(BUILT);
  return page({
    path: `/kategorie/${k.slug}/`, title: `${name}: które wybrać? Najlepszy skład (${when}) – Lupka`,
    h1: `${esc(name)}: które wybrać?`, kick: 'NAJLEPSZY SKŁAD',
    desc: `${name}: ${TOP_N} produktów z najlepszym składem według Lupki (${when}). Porównanie ${nProd(n)} z polskich sklepów: cukier, sól, dodatki. ${goodShare}% ma ocenę „Dobre” lub lepszą.`,
    lead: `Porównaliśmy ${nProd(n)} z kategorii „${esc(name)}” z polskich sklepów pod kątem wartości odżywczej, dodatków i przetworzenia. ${best ? `Najlepiej wypada ${esc(best.pr.name)}${best.pr.brand ? ` (${esc(best.pr.brand)})` : ''}.` : ''}`,
    body, crumbs: [['/', 'Lupka'], ['/kategorie/', 'Kategorie'], [`/kategorie/${k.slug}/`, name]],
    ld: [ORG, { '@type': 'ItemList', name: `${name} z najlepszym składem`, numberOfItems: top.length, itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: top.map((r, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'Product', name: r.pr.name, ...(r.pr.brand ? { brand: { '@type': 'Brand', name: r.pr.brand } } : {}), gtin: r.pr.code, ...(r.pr.image ? { image: r.pr.image } : {}) } })) }]
  });
}
const catTile = k => `<a class="cat" href="/kategorie/${k.slug}/">${ring(pctOf(k.v[0] + k.v[1], k.scored.length), 46)}<span class="ct"><b>${esc(k.c.label)}</b><span>${k.scored.length} ocenionych · ${pctOf(k.v[0] + k.v[1], k.scored.length)}% dobrych${k.top[0] ? ` · najlepszy: ${esc(k.top[0].pr.name)}` : ''}</span></span></a>`;
const GROUPS = [['dairy', 'Nabiał'], ['breakfast', 'Śniadanie'], ['meat', 'Mięso i ryby'], ['pantry', 'Spiżarnia'], ['ready', 'Dania gotowe i mrożonki'], ['snacks', 'Przekąski i słodycze'], ['drinks', 'Napoje']];
function indexPage(cats) {
  const n = cats.reduce((s, k) => s + k.scored.length, 0);
  const body = `
<p class="small muted">Dane: Open Food Facts, kopia z ${dayPl(BUILT)}. Liczba w kółku to odsetek produktów z oceną „Dobre” lub lepszą.</p>
${GROUPS.map(([g, label]) => { const ks = cats.filter(k => k.c.group === g); return ks.length ? `<h2>${label}</h2><div class="cats">${ks.map(catTile).join('')}</div>` : ''; }).join('')}
<p class="small">Jak liczymy ocenę składu: <a href="/jak-liczymy/">metoda Lupki</a>.</p>
${cta('W aplikacji te same kategorie są posortowane dla Twojej rodziny.', '/app/', 'Otwórz Lupkę')}`;
  return page({
    path: '/kategorie/', title: `Produkty z najlepszym składem według kategorii (${monthPl(BUILT)}) – Lupka`, h1: 'Najlepszy skład w każdej kategorii',
    desc: `Rankingi składu ${cats.length} kategorii produktów z polskich sklepów: jogurty, płatki, wędliny, soki i inne. ${n} ocenionych produktów, dane Open Food Facts.`,
    kick: 'KATEGORIE', lead: `${cats.length} kategorii, ${n} ocenionych produktów z polskich sklepów. W każdej: najlepsze produkty, najczęstsze minusy i na co patrzeć na etykiecie.`, body,
    crumbs: [['/', 'Lupka'], ['/kategorie/', 'Kategorie']],
    ld: [ORG, { '@type': 'CollectionPage', name: 'Najlepszy skład w każdej kategorii', inLanguage: 'pl-PL', dateModified: BUILT.slice(0, 10) }]
  });
}

/* ---------- Zapis ---------- */
const urls = [['/', today], ['/jak-liczymy/', today], ['/lupka-czy-yuka/', '2026-10-22'], ['/privacy.html', '2026-10-21']];
write('jak-liczymy/index.html', methodPage());
write('lupka-czy-yuka/index.html', yukaPage());
let cats = [];
if (fs.existsSync(path.join(DATA, 'c'))) {
  const seenSlug = new Set();
  cats = C.SHOP_CATEGORIES.map(loadCategory).filter(k => k && !seenSlug.has(k.slug) && seenSlug.add(k.slug));
  cats.forEach(k => { write(`kategorie/${k.slug}/index.html`, categoryPage(k, cats)); urls.push([`/kategorie/${k.slug}/`, BUILT]); });
  if (cats.length) { write('kategorie/index.html', indexPage(cats)); urls.push(['/kategorie/', BUILT]); }
}
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, d]) => `  <url><loc>${BASE}${u}</loc><lastmod>${String(d).slice(0, 10)}</lastmod></url>`).join('\n')}\n</urlset>\n`);
console.log(`Strony: jak-liczymy, lupka-czy-yuka, kategorie: ${cats.length}, w mapie strony: ${urls.length}.`);
