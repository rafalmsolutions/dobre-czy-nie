// 3.0.15: wybór kategorii do porównania i zamienników. Kategorie bez pliku (404) i o innej postaci (kakao w proszku przy kremie) są pomijane.
import { chromium } from 'playwright';
import fs from 'fs';
import { setup } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
await ctx.route(/\/config\.js$/, r => { let body = fs.readFileSync(new URL('../app/config.js', import.meta.url), 'utf8'); body = body.replace(/offProxyUrl: '[^']*'/, "offProxyUrl: 'https://proxy.test/'").replace(/goatcounter: '[^']*'/, "goatcounter: ''"); r.fulfill({ body, contentType: 'text/javascript' }); });

// Krem jak Nutella: na końcu hierarchii kategoria bez pliku i „kakao w proszku”.
const CODE = '5900000400009';
const CATS = ['en:breakfasts', 'en:spreads', 'en:sweet-spreads', 'en:hazelnut-spreads', 'en:chocolate-spreads', 'en:cocoa-and-hazelnuts-spreads', 'en:cocoa-and-its-products', 'en:confectionary-based-spreads', 'en:cocoa-powders'];
const CREAM = { code: CODE, product_name_pl: 'Krem kakaowo-orzechowy testowy', brands: 'T', nutriscore_grade: 'e', nova_group: 4, additives_tags: [], ingredients_text_pl: 'cukier, olej palmowy, orzechy laskowe 13%, kakao', nutriments: { sugars_100g: 56, salt_100g: 0.1, 'saturated-fat_100g': 10, fat_100g: 31, proteins_100g: 6, 'energy-kcal_100g': 539 }, categories_hierarchy: CATS };
const spread = i => ({ code: String(5900000410000 + i), product_name_pl: 'Krem orzechowy ' + i, brands: 'K', nutriscore_grade: i < 3 ? 'b' : 'e', nova_group: i < 3 ? 1 : 3, additives_tags: [], ingredients_text_pl: i < 3 ? 'orzechy laskowe 90%, kakao' : 'orzechy laskowe, kakao, cukier', nutriments: { sugars_100g: i < 3 ? 3 : 30 + i, salt_100g: 0.1, 'saturated-fat_100g': 5, fat_100g: 30, proteins_100g: 8, 'energy-kcal_100g': 520 }, categories_hierarchy: ['en:spreads', 'en:sweet-spreads', 'en:hazelnut-spreads', 'en:cocoa-and-hazelnuts-spreads'] });
const powder = i => ({ code: String(5900000420000 + i), product_name_pl: 'Kakao w proszku ' + i, brands: 'P', nutriscore_grade: 'a', nova_group: 1, additives_tags: [], ingredients_text_pl: 'kakao 100%', nutriments: { sugars_100g: 1, salt_100g: 0.05, 'saturated-fat_100g': 12, fat_100g: 20, proteins_100g: 20, 'energy-kcal_100g': 380 }, categories_hierarchy: ['en:cocoa-and-its-products', 'en:cocoa-powders'] });
const DATA = { 'en:cocoa-and-hazelnuts-spreads': Array.from({ length: 10 }, (_, i) => spread(i)).concat([CREAM]), 'en:cocoa-powders': Array.from({ length: 12 }, (_, i) => powder(i)) };
const asked = [];
await ctx.route(/proxy\.test\/(search|details)/, r => r.fulfill({ json: { ok: true, products: {} } }));
await ctx.route(/proxy\.test\/category/, r => { const t = new URL(r.request().url()).searchParams.get('tag'); asked.push(t); r.fulfill({ json: { ok: true, products: DATA[t] || [] } }); });
await ctx.route(new RegExp('openfoodfacts\\.org/api/v2/product/' + CODE), r => r.fulfill({ json: { status: 1, product: CREAM } }));
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false })); localStorage.setItem('dcn-d-profile', JSON.stringify({ watch: ['sugar'] })); });
await page.goto('http://localhost:8790/app/index.html#/'); await page.waitForTimeout(800);

// 1. Sama funkcja wyboru (atrapa pobierania).
const r1 = await page.evaluate(async ([cats, data]) => {
  const calls = []; const f = async c => { calls.push(c); return (data[c] || []).map(x => normalizeProduct(x, 'off')); };
  const res = await App.pickCompareCats({ code: 'x', categories: cats }, f);
  return { cats: res.cats, n: res.list.length, calls };
}, [CATS, DATA]);
ok(r1.cats[0] === 'en:cocoa-and-hazelnuts-spreads', 'krem: najwęższa kategoria z danymi tej samej postaci (' + r1.cats.join(', ') + ')');
ok(!r1.cats.includes('en:cocoa-powders') && !r1.cats.includes('en:confectionary-based-spreads'), 'pominięte: kategoria bez pliku i kakao w proszku');
ok(r1.calls[0] === 'en:cocoa-powders' && r1.calls.includes('en:confectionary-based-spreads'), 'sprawdzone po kolei od końca hierarchii (' + r1.calls.join(' → ') + ')');
const r2 = await page.evaluate(async () => {
  const mk = (n, cats) => Array.from({ length: n }, (_, i) => ({ code: 'y' + cats.length + i, categories: cats }));
  const data = { 'en:fruit-yogurts': mk(3, ['en:dairies', 'en:yogurts', 'en:fruit-yogurts']), 'en:yogurts': mk(12, ['en:dairies', 'en:yogurts']) };
  const res = await App.pickCompareCats({ code: 'x', categories: ['en:dairies', 'en:yogurts', 'en:fruit-yogurts'] }, async c => data[c] || []);
  return res.cats;
});
ok(r2.join('|') === 'en:fruit-yogurts|en:yogurts', 'za mało w najwęższej → dobiera nadrzędną (' + r2.join('|') + ')');
const r3 = await page.evaluate(async () => (await App.pickCompareCats({ code: 'x', categories: ['en:foo-bars'] }, async () => [])).cats.length);
ok(r3 === 0, 'brak danych w żadnej kategorii → pusta lista, bez błędu');

// 2. Ekran produktu: porównanie i zamienniki z kremów, bez kakao w proszku.
await page.goto('http://localhost:8790/app/index.html#/p/' + CODE); await page.waitForTimeout(2500);
const cat = await page.innerText('#catBody').catch(() => '');
ok(/z 10 podobnych produktów|niż \d+% z 10/.test(cat), 'porównanie na tle 10 kremów (' + cat.replace(/\s+/g, ' ').slice(0, 110) + ')');
ok(!/Kakao w proszku/.test(cat) && /Krem orzechowy/.test(cat), 'zamienniki: kremy, nie kakao w proszku');
ok(asked.includes('en:cocoa-and-hazelnuts-spreads'), 'pobrana kategoria kremów (' + asked.join(', ') + ')');
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
