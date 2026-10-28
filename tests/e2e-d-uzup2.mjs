// 2.8.3: lista „Uzupełnij dane” chowa produkty, które w bazie mają już skład i wartości (indeks wyszukiwarki OFF bywa nieaktualny),
// a po uzupełnieniu produktu wynik i kółka domowników odświeżają się danymi z bazy bez przeładowania strony.
import { chromium } from 'playwright';
import fs from 'fs';
import { setup, C } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
await ctx.route(/\/config\.js$/, r => { let body = fs.readFileSync(new URL('../app/config.js', import.meta.url), 'utf8'); body = body.replace(/offProxyUrl: '[^']*'/, "offProxyUrl: 'https://proxy.test/'").replace(/goatcounter: '[^']*'/, "goatcounter: ''"); r.fulfill({ body, contentType: 'text/javascript' }); });
// 1. Lista misji
const A1 = '5900531000980', A2 = '5900000000999', A3 = '5900000000998';
await ctx.route(/uzupelnij\.json/, r => r.fulfill({ json: { built: '2026-10-23', count: 3, items: [{ c: A1, n: 'Serek wiejski', b: 'X', i: '', s: 9, k: 's' }, { c: A2, n: 'Jogurt', b: 'Y', i: '', s: 8, k: 'sw' }, { c: A3, n: 'Kefir', b: 'Z', i: '', s: 7, k: 'w' }], names: [] } }));
await ctx.route(/proxy\.test\/details/, r => r.fulfill({ json: { ok: true, failed: 0, products: { [A1]: { code: A1, ingredients_text_pl: 'twaróg, śmietanka', nutriments: {} }, [A2]: { code: A2, ingredients_text_pl: 'mleko', nutriments: {} }, [A3]: { code: A3, nutriments: {} } } } }));
// 2. Produkt do uzupełnienia: po zapisie baza zwraca rozpoznany skład (wegański)
let saved = false;
await ctx.route(/proxy\.test\/edit/, r => { saved = true; return r.fulfill({ json: { ok: true, saved: ['ingredients'] } }); });
await ctx.route(/proxy\.test\/ocr/, r => r.fulfill({ json: { ok: false, error: 'no_text' } }));
await ctx.route(new RegExp('openfoodfacts\\.org/api/v2/product/' + C.missing2), r => r.fulfill({ json: { status: 1, product: Object.assign({ code: C.missing2, product_name_pl: 'Dżem testowy', categories_hierarchy: ['en:jams'], image_front_url: 'https://images.openfoodfacts.org/x.jpg',
  nutriments: { 'energy-kcal_100g': 200, sugars_100g: 45, salt_100g: 0, 'saturated-fat_100g': 0.1, fat_100g: 0.5, proteins_100g: 0.5 } },
  saved ? { ingredients_text_pl: 'maliny, cukier, pektyny', ingredients_analysis_tags: ['en:vegan', 'en:vegetarian', 'en:palm-oil-free'], additives_tags: ['en:e440'], allergens_tags: [], nova_group: 3 } : {}) } }));
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false }));
  localStorage.setItem('dcn-d-profile', JSON.stringify({ watch: ['sugar'] })); localStorage.setItem('dcn-d-family', JSON.stringify([{ id: 'f1', name: 'Ania', p: { diet: ['vegan'] } }])); });
await page.goto('http://localhost:8790/app/index.html#/uzupelnij'); await page.waitForTimeout(1800);
if (await page.locator('[data-fill=tab-data]').count()) { await page.click('[data-fill=tab-data]'); await page.waitForTimeout(600); }
const items = await page.$$eval('#fillList .fill-item .t1', l => l.map(x => x.textContent));
const t2 = await page.$$eval('#fillList .fill-item .t2', l => l.map(x => x.textContent));
ok(!items.includes('Serek wiejski') && items.includes('Jogurt') && items.includes('Kefir'), 'lista: produkt uzupełniony w bazie schowany (' + items.join(', ') + ')');
ok(t2.some(t => /Jogurt|Y/.test(t) && /wartości/.test(t) && !/skład/.test(t)), 'lista: jogurtowi brakuje już tylko wartości (' + t2.join(' | ') + ')');
await page.goto('http://localhost:8790/app/index.html#/p/' + C.missing2); await page.waitForTimeout(1800);
const circ = () => page.$eval('.fam-circles', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
const before = await circ();
await page.click('[data-act=complete]'); await page.waitForTimeout(700);
await page.fill('#cmpIngr', 'maliny, cukier, pektyny'); await page.click('[data-cmp=save-ingr]'); await page.waitForTimeout(1200);
const mid = await circ();
await page.waitForTimeout(3000);
const after = await circ();
ok(/\? Ania/.test(before) && !/\? Ania/.test(after) && /\d+% Ania/.test(after), `kółka domowników odświeżone po zapisie bez przeładowania (${before} → ${mid} → ${after})`);
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
