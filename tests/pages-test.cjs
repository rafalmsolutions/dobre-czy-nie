// Strony dla wyszukiwarek (scripts/build_pages.cjs): budowa na małej próbce danych. Uruchom: node tests/pages-test.cjs
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lupka-pages-')), data = path.join(tmp, 'data'), out = path.join(tmp, 'site');
fs.mkdirSync(path.join(data, 'c'), { recursive: true });
fs.writeFileSync(path.join(data, 'meta.json'), JSON.stringify({ built: '2026-10-22T07:00:00Z', products: 12 }));
const prod = (i, o) => Object.assign({ code: String(5900000000000 + i), product_name: 'Jogurt naturalny ' + i, brands: 'Marka ' + i, quantity: '150 g', nutriscore_grade: 'abcde'[i % 5], nova_group: 1 + (i % 4),
  additives_tags: i % 3 ? [] : ['en:e407'], nutriments: { 'sugars_100g': i * 2, 'salt_100g': 0.1 }, categories_hierarchy: ['en:dairies', 'en:yogurts'], unique_scans_n: 20 - i }, o);
const products = Array.from({ length: 12 }, (_, i) => prod(i + 1)).concat([prod(13, { product_name: 'Yaourt nature' }), prod(14, { product_name: 'Jogurt naturalny 1', brands: 'Marka 1' })]);
fs.writeFileSync(path.join(data, 'c', 'en_yogurts.json'), JSON.stringify({ tag: 'en:yogurts', count: 300, products }));
const log = execFileSync('node', [path.join(__dirname, '..', 'scripts', 'build_pages.cjs'), '--data', data, '--out', out]).toString();
ok(/kategorie: 1/.test(log), 'budowa: ' + log.trim());
const read = f => fs.readFileSync(path.join(out, f), 'utf8');
const m = read('jak-liczymy/index.html'), y = read('lupka-czy-yuka/index.html'), k = read('kategorie/jogurty/index.html'), idx = read('kategorie/index.html'), sm = read('sitemap.xml');
ok(/60% to wartość odżywcza/.test(m) && /Limit 49 pkt/.test(m) && /E250 azotyn sodu/.test(m) && /−15 pkt/.test(m), 'metoda: wagi, limit i kary z kodu aplikacji');
ok(/<link rel="canonical" href="https:\/\/lupka.app\/jak-liczymy\/">/.test(m) && /"BreadcrumbList"/.test(m), 'metoda: canonical i okruszki');
ok(/W wersji Premium/.test(y) && /help.yuka.io/.test(y), 'Yuka: porównanie ze źródłami');
const items = (k.match(/<li class="prod">/g) || []).length;
ok(items === 10, 'kategoria: 10 produktów (' + items + ')');
ok(!/Yaourt/.test(k), 'kategoria: bez nazw w obcym języku');
ok((k.match(/Jogurt naturalny 1</g) || []).length === 1, 'kategoria: bez powtórek');
ok(/"ItemList"/.test(k) && /\/app\/#\/lista\/en:yogurts/.test(k) && /\/app\/#\/p\/59000000000/.test(k), 'kategoria: ItemList, link do listy i do produktu w aplikacji');
ok(/Porównaliśmy \d+ produkt/.test(k) && !/\d+ jogurty/.test(k), 'kategoria: poprawna odmiana');
JSON.parse(k.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
ok(/kategorie\/jogurty\//.test(idx), 'indeks kategorii');
ok(['/', '/jak-liczymy/', '/lupka-czy-yuka/', '/kategorie/', '/kategorie/jogurty/', '/privacy.html'].every(u => sm.includes(`<loc>https://lupka.app${u}</loc>`)), 'mapa strony');
// Bez danych: tylko strony stałe, bez błędu.
const out2 = path.join(tmp, 'site2');
execFileSync('node', [path.join(__dirname, '..', 'scripts', 'build_pages.cjs'), '--data', path.join(tmp, 'brak'), '--out', out2]);
ok(fs.existsSync(path.join(out2, 'jak-liczymy/index.html')) && !fs.existsSync(path.join(out2, 'kategorie')), 'bez danych: tylko strony stałe');
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
