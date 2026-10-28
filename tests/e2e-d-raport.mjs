// 2.9.0: poprawki po teście konsumenckim. Skaner bez pasków, zwinięty pasek nagrody, „dane niepełne” przy wyniku i w porównaniu,
// szybka ścieżka na ekranie „nie znamy”, tryb zakupowy, zamienniki o tym samym zastosowaniu. Uruchom: node e2e-d-raport.mjs (serwer 8790).
import { chromium } from 'playwright';
import fs from 'fs';
import { setup, C } from './lib.mjs';
const SH = process.env.SHOTS;
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
await ctx.route(/\/config\.js$/, r => { let body = fs.readFileSync(new URL('../app/config.js', import.meta.url), 'utf8'); body = body.replace(/offProxyUrl: '[^']*'/, "offProxyUrl: 'https://proxy.test/'").replace(/goatcounter: '[^']*'/, "goatcounter: ''"); r.fulfill({ body, contentType: 'text/javascript' }); });
await ctx.route(/proxy\.test\/(category|search|details)/, r => r.fulfill({ json: { ok: true, products: [] } }));
// Skyr bez składu (jak Pilos): są wartości odżywcze i Nutri-Score, brak składu i NOVA
await ctx.route(new RegExp('openfoodfacts\\.org/api/v2/product/' + C.missing2), r => r.fulfill({ json: { status: 1, product: { code: C.missing2, product_name_pl: 'Skyr 0% tłuszczu', brands: 'Pilos', nutriscore_grade: 'a',
  nutriments: { 'energy-kcal_100g': 63, sugars_100g: 3.5, salt_100g: 0.1, 'saturated-fat_100g': 0.1, fat_100g: 0.2, proteins_100g: 12 }, categories_hierarchy: ['en:dairies', 'en:yogurts', 'en:skyrs'] } } }));
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false })); localStorage.setItem('dcn-d-profile', JSON.stringify({ watch: ['processing'] })); });
const go = async h => { await page.goto('http://localhost:8790/app/index.html' + h); await page.waitForTimeout(1600); };
const shot = async n => { if (SH) await page.screenshot({ path: `${SH}/${n}.png` }); };

// 3. Wynik przy brakach danych
await go('#/p/' + C.missing2); await shot('po-03-produkt');
ok(/Dane niepełne/.test(await page.innerText('.d-hside')) && /składu/.test(await page.innerText('.d-gaps')), 'brak składu: „Dane niepełne” przy wyniku');
ok(/^Wstępnie:/.test(await page.innerText('#matchLabel').catch(() => '')), 'etykieta wyniku: „Wstępnie: …”');
await go('#/p/' + C.milk);
ok(await page.locator('.d-gaps').count() === 0, 'pełne dane: bez ostrzeżenia');
// porównanie
await page.evaluate(([a, b2]) => { App.cmpClear(); App.cmpAdd(a); App.cmpAdd(b2); }, await page.evaluate(([x, y]) => [JSON.parse(localStorage.getItem('dcn-cache'))[x].p, JSON.parse(localStorage.getItem('dcn-cache'))[y].p], [C.milk, C.missing2]));
await go('#/porownaj'); await shot('po-03-porownanie');
const ctext = await page.innerText('#scr-compare');
ok(/Pełniejsze dane/.test(ctext) && !/Lepszy wybór/.test(ctext) && /dane niepełne: brak składu/.test(ctext), 'porównanie: „Pełniejsze dane” zamiast „Lepszy wybór”');
// 1. Skaner bez pasków (porównanie aktywne)
await go('#/p/' + C.missing2);
await page.evaluate(() => App.openScanner()); await page.waitForTimeout(500);
ok(await page.evaluate(() => { const r = document.getElementById('cmpBar'); return r.hidden || getComputedStyle(r).display === 'none'; }), 'skaner: pasek porównania schowany');
await page.evaluate(() => App.closeScanner(true)); await page.evaluate(() => App.cmpClear());
// 2. Pasek nagrody zwija się
await page.evaluate(() => { App.pendingCard = null; App.celebrate([{ type: 'level', name: 'Test', level: 2 }]); });
await page.waitForTimeout(300);
const wide = await page.evaluate(() => document.getElementById('rwBar').getBoundingClientRect().width);
await page.waitForTimeout(4300);
const narrow = await page.evaluate(() => document.getElementById('rwBar').getBoundingClientRect().width);
ok(wide > 300 && narrow < 160, `pasek nagrody zwija się do przycisku (${wide | 0} → ${narrow | 0} px)`); await shot('po-02-pasek');
await page.evaluate(() => { App.dropCelebrations(); App.rewardBar(); });
// 4. Ekran „nie znamy”: najpierw szybka ocena składu
await go('#/p/' + C.missing); await shot('po-04-nie-znamy');
const order = await page.evaluate(() => { const a = document.getElementById('ingDetails'), c = document.getElementById('addCta'); return a && c ? !!(a.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING) : false; });
ok(order && /Szybko/.test(await page.innerText('#ingDetails summary')), 'nie znamy: „Szybko: oceń skład” przed dodawaniem do bazy');
// 5. Tryb zakupowy
await go('#/profil');
await page.check('#setShop'); await page.click('#profileForm [type=submit]'); await page.waitForTimeout(400);
ok(await page.evaluate(() => App.quiet()), 'tryb zakupowy zapisany');
await go('#/p/' + C.milk);
ok(await page.locator('#scr-product .pill [data-hud=points]').count() === 0, 'tryb zakupowy: bez licznika punktów');
await page.evaluate(() => App.celebrate([{ type: 'level', name: 'Test', level: 3 }])); await page.waitForTimeout(300);
ok(await page.evaluate(() => document.getElementById('rwBar').hidden && document.getElementById('celebrate').hidden), 'tryb zakupowy: bez gratulacji i paska nagród');
await go('#/'); await shot('po-05-start');
ok(await page.locator('.d-prog').count() === 0, 'tryb zakupowy: bez karty postępów na starcie');
// 6. Zamienniki o tym samym zastosowaniu
const su = await page.evaluate(() => [
  App.sameUse({ categories: ['en:breakfasts', 'en:spreads', 'en:sweet-spreads', 'en:cocoa-and-hazelnuts-spreads'] }, { categories: ['en:spreads', 'en:sweet-spreads', 'en:fruit-preserves', 'en:plum-butters'] }),
  App.sameUse({ categories: ['en:breakfasts', 'en:spreads', 'en:sweet-spreads', 'en:cocoa-and-hazelnuts-spreads'] }, { categories: ['en:sweet-spreads', 'en:cocoa-and-hazelnuts-spreads'] }),
  App.sameUse({ categories: ['en:spreads'] }, { categories: ['en:jams'] })]);
ok(su[0] === false && su[1] === true && su[2] === true, 'zamiennik: krem kakaowy ≠ powidła, krem ↔ krem (' + su + ')');
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
