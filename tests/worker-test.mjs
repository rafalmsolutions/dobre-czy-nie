// Testy pośrednika (Cloudflare Worker) z podmienionym Open Food Facts.
import worker from '../worker/off-proxy.js';
let pass = 0, fail = 0; const ok = (c, n) => { if (c) pass++; else { fail++; console.log('  ✗ ' + n); } };
const env = { OFF_USER: 'dcn-app', OFF_PASS: 'sekret', OFF_BASE: 'https://world.openfoodfacts.net', OFF_BASIC: 'off:off', ALLOWED_ORIGINS: 'https://app.test' };
let calls = [], exists = false, saveFail = false, searchDown = false;
globalThis.fetch = async (url, init = {}) => {
  const body = init.body instanceof FormData ? Object.fromEntries([...init.body.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : '[file ' + v.type + ' ' + v.size + ']'])) : null;
  calls.push({ url: String(url), headers: init.headers || {}, body });
  if (String(url).includes('/api/v2/product/')) return new Response(JSON.stringify(exists ? { status: 1, product: { product_name: 'Jest' } } : { status: 0 }), { status: exists ? 200 : 404 });
  if (String(url).includes('product_jqm2')) return new Response(JSON.stringify(saveFail ? { status: 0 } : { status: 1, status_verbose: 'fields saved' }));
  if (String(url).startsWith('https://search.openfoodfacts.org/')) {
    if (searchDown) return new Response('down', { status: 503 });
    return new Response(JSON.stringify({ count: 2, hits: [
      { code: '5900197012723', product_name: 'Jogurt grecki', brands: 'Bakoma', nutriscore_grade: 'c', nova_group: 3, ingredients_tags: ['en:milk', 'en:e330'], ingredients_n: 3, nutriments: { 'salt_100g': 0.1, 'sugars_100g': 4, 'energy-kcal_100g': 120, junk_100g: 5 }, categories_tags: ['en:dairies', 'en:yogurts'], stores: ['Biedronka', 'Lidl'], image_front_small_url: 'https://images.openfoodfacts.org/x.jpg' },
      { code: 'abc', product_name: 'zły kod' },
      { code: '5900000000001', product_name: '<b>Bez składu</b>', nova_group: 'x' }
    ] }));
  }
  if (String(url).includes('product_image_upload')) return new Response(JSON.stringify({ status: 'status ok', imgid: 1 }));
  return new Response('?', { status: 500 });
};
const jpg = n => new Blob([new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, ...new Array(n).fill(1)])], { type: 'image/jpeg' });
const ean = p => { const d = p.split('').map(Number); const s = d.reverse().reduce((a, n, i) => a + n * (i % 2 === 0 ? 3 : 1), 0); return p + ((10 - s % 10) % 10); };
const CODE = ean('590000000011');
function form(over = {}) {
  const f = new FormData();
  const v = Object.assign({ code: CODE, product_name: 'Jogurt <b>testowy</b>', lang: 'pl', app_uuid: '0123456789abcdef0123', app_version: '1.0' }, over);
  for (const [k, x] of Object.entries(v)) if (x !== null) f.append(k, x);
  for (const k of ['front', 'ingredients', 'nutrition']) if (over['photo_' + k] !== null) f.append('photo_' + k, over['photo_' + k] || jpg(500), k + '.jpg');
  return f;
}
const req = (f, o = {}) => new Request('https://proxy.test' + (o.path || '/product'), { method: o.method || 'POST', body: o.method === 'OPTIONS' || o.method === 'GET' ? undefined : f, headers: { Origin: o.origin || 'https://app.test', 'CF-Connecting-IP': o.ip || '1.1.1.' + Math.random() } });
const run = async (f, o) => { calls = []; const r = await worker.fetch(req(f, o), o && o.env || env); return { status: r.status, j: await r.json().catch(() => null), h: r.headers }; };

let r = await run(form());
ok(r.status === 200 && r.j.ok && r.j.images === 3, 'poprawne dodanie: 200 i 3 zdjęcia');
const save = calls.find(c => c.url.includes('product_jqm2'));
ok(save && save.body.user_id === 'dcn-app' && save.body.password === 'sekret', 'hasło dodane po stronie serwera');
ok(save.body.product_name_pl === 'Jogurt b testowy /b', 'nazwa oczyszczona z < > (' + save.body.product_name_pl + ')');
ok(save.body.app_name === 'DobreCzyNie' && save.body.app_uuid === '0123456789abcdef0123', 'app_name i app_uuid');
ok(/^DobreCzyNie\/1\.0 \(.+@.+\)$/.test(save.headers['User-Agent']), 'User-Agent z kontaktem');
ok(save.headers.Authorization === 'Basic ' + btoa('off:off'), 'staging: basic auth');
const ups = calls.filter(c => c.url.includes('image_upload'));
ok(ups.length === 3 && ups.map(u => u.body.imagefield).join() === 'front_pl,ingredients_pl,nutrition_pl', 'pola zdjęć');
ok(ups[0].body.imgupload_front_pl && ups[0].body.imgupload_front_pl.startsWith('[file image/jpeg'), 'plik zdjęcia');
ok(!JSON.stringify(r.j).includes('sekret'), 'odpowiedź nie zdradza hasła');
ok(r.h.get('Access-Control-Allow-Origin') === 'https://app.test', 'CORS dla aplikacji');

r = await run(form(), { origin: 'https://zly.test' }); ok(r.status === 403 && !r.h.get('Access-Control-Allow-Origin'), 'obca strona: 403');
r = await run(form(), { origin: 'https://zly.test', method: 'OPTIONS' }); ok(r.status === 403, 'obca strona: preflight 403');
r = await run(form(), { method: 'OPTIONS' }); ok(r.status === 204, 'preflight 204');
r = await run(null, { method: 'GET' }); ok(r.status === 405, 'GET: 405');
r = await run(null, { method: 'GET', path: '/health' }); ok(r.status === 200, '/health');
r = await run(null, { method: 'GET', path: '/x' }); ok(r.status === 404, 'zły adres: 404');
r = await run(form({ code: '5900000000115' })); ok(r.status === 400 && r.j.error === 'code', 'zła suma kontrolna');
r = await run(form({ code: 'abc' })); ok(r.status === 400, 'kod z liter');
r = await run(form({ product_name: ' a ' })); ok(r.j.error === 'name', 'za krótka nazwa');
r = await run(form({ app_uuid: 'x' })); ok(r.j.error === 'uuid', 'zły uuid');
r = await run(form({ photo_nutrition: null })); ok(r.j.error === 'photo_missing', 'brak zdjęcia');
r = await run(form({ photo_front: new Blob(['<script>alert(1)</script>'.repeat(10)], { type: 'image/jpeg' }) })); ok(r.j.error === 'photo_type', 'nie-obraz udający jpg');
r = await run(form({ photo_front: jpg(7 * 1024 * 1024) })); ok(r.j.error === 'photo_size' || r.status === 413, 'za duże zdjęcie');
r = await run(form({ lang: '"><x' })); ok(r.status === 200 && calls.find(c => c.url.includes('jqm2')).body.lang === 'pl', 'zły język → pl');
exists = true; r = await run(form()); ok(r.status === 409 && !calls.some(c => c.url.includes('jqm2')), 'istniejący produkt nie jest nadpisywany'); exists = false;
saveFail = true; r = await run(form()); ok(r.status === 502 && !calls.some(c => c.url.includes('image_upload')), 'błąd zapisu: 502 bez wysyłki zdjęć'); saveFail = false;
r = await run(form(), { env: Object.assign({}, env, { OFF_PASS: '' }) }); ok(r.status === 500 && r.j.error === 'not_configured', 'brak hasła w ustawieniach');
let last; for (let i = 0; i < 41; i++) last = await run(form(), { ip: '9.9.9.9' });
ok(last.status === 429, 'limit 40 zapytań na godzinę z jednego adresu');
// Kategorie
r = await run(null, { method: 'GET', path: '/category?tag=en:yogurts' });
ok(r.status === 200 && r.j.ok && r.j.products.length === 2, 'kategoria: 200 i produkty z poprawnym kodem');
const sq = calls.find(c => c.url.startsWith('https://search.openfoodfacts.org/'));
ok(sq && decodeURIComponent(sq.url).includes('categories_tags:"en:yogurts" AND countries_tags:"en:poland"'), 'kategoria: zapytanie o Polskę');
ok(sq && /^DobreCzyNie\//.test(sq.headers['User-Agent']), 'kategoria: User-Agent');
const p0 = r.j.products[0], p1 = r.j.products[1];
ok(p0.additives_tags.join() === 'en:e330' && p0.stores.join() === 'Biedronka,Lidl' && p0.categories_hierarchy.includes('en:yogurts'), 'kategoria: dodatki, sklepy, kategorie');
ok(p0.nutriments.salt_100g === 0.1 && !('junk_100g' in p0.nutriments), 'kategoria: tylko potrzebne wartości odżywcze');
ok(p1.additives_tags === null && p1.nova_group === null, 'kategoria: brak składu = dodatki nieznane');
ok(r.h.get('Access-Control-Allow-Origin') === 'https://app.test', 'kategoria: CORS');
r = await run(null, { method: 'GET', path: '/category?tag=en:yogurts"%20OR%201' }); ok(r.status === 400, 'kategoria: zły tag');
r = await run(null, { method: 'GET', path: '/category?tag=en:yogurts', origin: 'https://zly.test' }); ok(r.status === 403, 'kategoria: obca strona');
searchDown = true; r = await run(null, { method: 'GET', path: '/category?tag=en:yogurts' }); ok(r.status === 502 && calls.filter(c => c.url.includes('search.openfoodfacts')).length === 2, 'kategoria: awaria wyszukiwarki, jedna ponowna próba'); searchDown = false;
// Uzupełnianie: OCR, zdjęcie, skład i wartości
let existing = { ingredients_text_pl: '', nutriments: {} };
const origFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes('/cgi/ingredients.pl')) { calls.push({ url: u, headers: init.headers || {} }); return new Response(JSON.stringify({ status: 0, ingredients_text_from_image: 'mleko, <b>kultury</b> bakterii' })); }
  if (u.includes('/api/v2/product/') && u.includes('ingredients_text')) { calls.push({ url: u }); return new Response(JSON.stringify({ status: 1, product: existing })); }
  return origFetch(url, init);
};
const ef = o => { const f = new FormData(); for (const [k, v] of Object.entries(Object.assign({ code: CODE, lang: 'pl', app_uuid: '0123456789abcdef0123', app_version: '1.0' }, o))) if (v !== null) f.append(k, v); return f; };
r = await run(ef({}), { path: '/ocr' }); ok(r.status === 200 && r.j.ok && r.j.text === 'mleko, b kultury /b bakterii', 'OCR składu: tekst oczyszczony (' + JSON.stringify(r.j) + ')');
ok(calls.some(c => c.url.includes('id=ingredients_pl&process_image=1')), 'OCR: właściwe pole zdjęcia');
r = await run(ef({ code: '123' }), { path: '/ocr' }); ok(r.status === 400, 'OCR: zły kod');
r = await run(ef({ ingredients_text: 'mleko, kultury bakterii' }), { path: '/edit' });
let save2 = calls.find(c => c.url.includes("jqm2"));
ok(r.status === 200 && r.j.saved.join() === 'ingredients' && save2.body.ingredients_text_pl === 'mleko, kultury bakterii' && save2.body.password === 'sekret', 'skład zapisany kontem aplikacji');
r = await run(ef({ nutriments: JSON.stringify({ 'energy-kcal': 63, fat: 0.2, 'saturated-fat': 0.1, carbohydrates: 4, sugars: 4, proteins: 11, salt: 0.1 }) }), { path: '/edit' });
save2 = calls.find(c => c.url.includes('jqm2'));
ok(r.status === 200 && save2.body['nutriment_energy-kcal'] === '63' && save2.body['nutriment_energy-kcal_unit'] === 'kcal' && save2.body.nutriment_salt_unit === 'g' && save2.body.nutrition_data_per === '100g', 'wartości odżywcze zapisane na 100 g');
for (const [bad, why] of [[{ 'energy-kcal': 2000 }, 'za dużo kcal'], [{ 'energy-kcal': 100, fat: 10, 'saturated-fat': 20 }, 'nasycone > tłuszcz'], [{ 'energy-kcal': 100, sugars: 50, carbohydrates: 10 }, 'cukry > węglowodany'], [{ 'energy-kcal': 100, xyz: 1 }, 'nieznane pole'], [{ fat: 1 }, 'bez kalorii'], [{ 'energy-kcal': 100, fat: 60, carbohydrates: 60 }, 'suma > 100 g']]) {
  r = await run(ef({ nutriments: JSON.stringify(bad) }), { path: '/edit' }); ok(r.status === 400 && r.j.error === 'nutriments', 'złe wartości: ' + why);
}
r = await run(ef({ nutriments: 'nie-json' }), { path: '/edit' }); ok(r.status === 400, 'wartości: zły JSON');
r = await run(ef({}), { path: '/edit' }); ok(r.status === 400 && r.j.error === 'empty', 'pusta edycja');
existing = { ingredients_text_pl: 'już jest', nutriments: { 'energy-kcal_100g': 50 } };
r = await run(ef({ ingredients_text: 'nowy skład', nutriments: JSON.stringify({ 'energy-kcal': 63 }) }), { path: '/edit' });
ok(r.status === 409 && !calls.some(c => c.url.includes('jqm2')), 'nie nadpisujemy istniejących danych');
existing = { ingredients_text_pl: '', nutriments: {} };
r = await run(ef({ field: 'ingredients' }), { path: '/image' }); ok(r.status === 400, 'zdjęcie: brak pliku');
const fi = ef({ field: 'ingredients' }); fi.append('photo', jpg(500), 'i.jpg');
r = await run(fi, { path: '/image' }); ok(r.status === 200 && calls.some(c => c.url.includes('image_upload') && c.body.imagefield === 'ingredients_pl'), 'zdjęcie składu do istniejącego produktu');
const fx = ef({ field: 'selfie' }); fx.append('photo', jpg(500), 'i.jpg');
r = await run(fx, { path: '/image' }); ok(r.status === 400 && r.j.error === 'field', 'zdjęcie: złe pole');
r = await run(ef({}), { path: '/edit', origin: 'https://zly.test' }); ok(r.status === 403, 'edycja z obcej strony: 403');
console.log(`Pośrednik: ${pass} OK, ${fail} błędów`); process.exit(fail ? 1 : 0);
