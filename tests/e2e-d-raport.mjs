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
// 3.0.2: wyszukiwarka i porównanie w kategorii z tym samym skyrem bez składu
const SKYR = { code: C.missing2, product_name_pl: 'Skyr 0% tłuszczu', brands: 'Pilos', nutriscore_grade: 'a', nutriments: { 'energy-kcal_100g': 63, sugars_100g: 3.5, salt_100g: 0.1, 'saturated-fat_100g': 0.1, fat_100g: 0.2, proteins_100g: 12 }, categories_hierarchy: ['en:dairies', 'en:yogurts', 'en:skyrs'] };
const SIM = Array.from({ length: 12 }, (_, i) => ({ code: String(5900000300000 + i), product_name_pl: 'Skyr ' + i, brands: 'X', nutriscore_grade: 'c', nova_group: 3, ingredients_text_pl: 'mleko, cukier', additives_tags: [], nutriments: { sugars_100g: 9, salt_100g: 0.1, 'saturated-fat_100g': 2, fat_100g: 3, proteins_100g: 8, 'energy-kcal_100g': 90 }, categories_hierarchy: ['en:dairies', 'en:yogurts', 'en:skyrs'] }));
await ctx.route(/proxy\.test\/search/, r => r.fulfill({ json: { ok: true, products: [SKYR] } }));
await ctx.route(/proxy\.test\/category/, r => r.fulfill({ json: { ok: true, products: SIM.concat([SKYR]) } }));
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false })); localStorage.setItem('dcn-d-profile', JSON.stringify({ watch: ['processing'] })); });
const go = async h => { await page.goto('http://localhost:8790/app/index.html' + h); await page.waitForTimeout(1600); };
const shot = async n => { if (SH) await page.screenshot({ path: `${SH}/${n}.png` }); };

// 3. Wynik przy brakach danych
await go('#/p/' + C.missing2); await shot('po-03-produkt'); if (SH) await page.screenshot({ path: SH + '/po-03-pelny.png', fullPage: true });
ok(/Wynik wstępny/.test(await page.innerText('.d-hside')) && /Brakuje składu produktu/.test(await page.innerText('.d-gaps')), 'brak składu: „Wynik wstępny” przy wyniku');
const bill = await page.innerText('.bill').catch(() => ''), det = await page.innerText('.card.score').catch(() => '');
ok(/Ocena składu[\s\S]*brak danych/.test(bill) && !/\b100\b/.test(bill) && /Brak danych/.test(det), 'brak składu: „Ocena składu: brak danych” zamiast 100 (' + bill.replace(/\s+/g, ' ').slice(0, 80) + ')');
ok(/^Wstępnie:/.test(await page.innerText('#matchLabel').catch(() => '')), 'etykieta wyniku: „Wstępnie: …”');
await page.waitForTimeout(1500);
const catTxt = await page.innerText('#catBody').catch(() => '');
ok(/Bez porównania w kategorii/.test(catTxt) && !/lepszą ocenę niż|lepszych wyborów/.test(catTxt), 'brak składu: bez „lepszy niż X%” na tle podobnych (' + catTxt.replace(/\s+/g, ' ').slice(0, 90) + ')');
await go('#/szukaj/skyr'); await page.waitForTimeout(1200);
ok(/Wstępnie:/.test(await page.innerText('#srchRes').catch(() => '')), 'wyszukiwarka: „Wstępnie: …” przy produkcie bez składu');
await go('#/p/' + C.milk);
ok(await page.locator('.d-gaps').count() === 0, 'pełne dane: bez ostrzeżenia');
// porównanie
await page.evaluate(([a, b2]) => { App.cmpClear(); App.cmpAdd(a); App.cmpAdd(b2); }, await page.evaluate(([x, y]) => [JSON.parse(localStorage.getItem('dcn-cache'))[x].p, JSON.parse(localStorage.getItem('dcn-cache'))[y].p], [C.milk, C.missing2]));
await go('#/porownaj'); await shot('po-03-porownanie'); if (SH) await page.screenshot({ path: SH + '/po-03-por-pelny.png', fullPage: true });
const ctext = await page.innerText('#scr-compare');
ok(/ma pełniejsze dane/.test(ctext) && !/Lepszy wybór/.test(ctext) && /wynik wstępny: brak składu/.test(ctext) && /nie możemy go w pełni ocenić/.test(ctext) && !/pełniejsze dane \(\d+%\)/.test(ctext), 'porównanie: „ma pełniejsze dane”, bez procentu w nagłówku');
ok(/Ocena składu[\s\S]{0,80}brak danych/.test(ctext), 'porównanie: ocena składu „brak danych”');
// Pasek porównania: ostatnie informacje da się przewinąć ponad niego, a przycisk nagrody się chowa
await go('#/p/' + C.milk);
await page.evaluate(() => { App.celebrate([{ type: 'level', name: 'Test', level: 2 }]); App.cmpBar(); }); await page.waitForTimeout(300);
await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(400);
const geo = await page.evaluate(() => { const bar = document.getElementById('cmpBar').getBoundingClientRect(), rw = document.getElementById('rwBar'); const els = [...document.querySelectorAll('#scr-product .wrap > *')].filter(e => e.offsetHeight); const last = els[els.length - 1].getBoundingClientRect(); return [last.bottom, bar.top, getComputedStyle(rw).display]; });
ok(geo[0] <= geo[1] + 1 && geo[2] === 'none', `porównanie aktywne: treść kończy się nad paskiem, przycisk nagrody schowany (${geo.map(v => typeof v === 'number' ? v | 0 : v)})`);
await page.evaluate(() => { App.dropCelebrations(); App.rewardBar(); });
await go('#/');
ok(/wynik wstępny/.test(await page.innerText('#scr-home')), 'historia: „wynik wstępny” przy produkcie bez składu');
// 1. Skaner bez pasków (porównanie aktywne)
await go('#/p/' + C.missing2);
await page.evaluate(() => App.openScanner()); await page.waitForTimeout(500);
ok(await page.evaluate(() => { const r = document.getElementById('cmpBar'); return r.hidden || getComputedStyle(r).display === 'none'; }), 'skaner: pasek porównania schowany');
await page.evaluate(() => App.closeScanner(true)); await page.evaluate(() => { App.cmpClear(); App.cmpBar(); });
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
await go('#/profil/ustawienia');
await page.check('#setShop'); await page.waitForTimeout(400);
ok(await page.evaluate(() => App.quiet()), 'tryb zakupowy zapisany');
await go('#/p/' + C.milk);
ok(await page.locator('#scr-product .pill [data-hud=points]').count() === 0, 'tryb zakupowy: bez licznika punktów');
await page.evaluate(() => App.celebrate([{ type: 'level', name: 'Test', level: 3 }])); await page.waitForTimeout(300);
ok(await page.evaluate(() => document.getElementById('rwBar').hidden && document.getElementById('celebrate').hidden), 'tryb zakupowy: bez gratulacji i paska nagród');
await go('#/p/' + C.missing2);
ok(!/\+\d+ pkt/.test(await page.innerText('#scr-product')), 'tryb zakupowy: produkt bez „+N pkt” (sklep, uzupełnianie, zdjęcie)');
await go('#/'); await shot('po-05-start');
ok(await page.locator('.d-prog').count() === 0, 'start: bez karty postępów (jest w Kartach)');
// 6. Zamienniki o tym samym zastosowaniu
const su = await page.evaluate(() => [
  App.sameUse({ categories: ['en:breakfasts', 'en:spreads', 'en:sweet-spreads', 'en:cocoa-and-hazelnuts-spreads'] }, { categories: ['en:spreads', 'en:sweet-spreads', 'en:fruit-preserves', 'en:plum-butters'] }),
  App.sameUse({ categories: ['en:breakfasts', 'en:spreads', 'en:sweet-spreads', 'en:cocoa-and-hazelnuts-spreads'] }, { categories: ['en:spreads', 'en:sweet-spreads', 'en:cocoa-and-hazelnuts-spreads'] }),
  App.sameUse({ categories: ['en:spreads'] }, { categories: ['en:spreads', 'en:jams'] }),
  App.sameUse({ categories: ['en:breakfasts', 'en:spreads', 'en:sweet-spreads', 'en:cocoa-and-its-products', 'en:hazelnut-spreads', 'en:chocolate-spreads', 'en:cocoa-and-hazelnuts-spreads'] }, { categories: ['en:cocoa-and-its-products', 'en:cocoa-powders'] }),
  App.sameUse({ categories: ['en:beverages', 'en:juices'] }, { categories: ['en:juices'] })]);
ok(su[0] === false && su[1] === true && su[2] === true && su[3] === false && su[4] === false, 'zamiennik: krem kakaowy ≠ powidła ani kakao w proszku, krem ↔ krem, napój tylko za napój (' + su + ')');
// 3.0.2: Preferencje – autozapis i „Gotowe”
await go('#/profil/preferencje');
ok(await page.locator('.pf-pref [type=submit]').innerText() === 'Gotowe' && /zapisują się od razu/.test(await page.innerText('.pf-pref')), 'preferencje: „Gotowe” i informacja o autozapisie');
// 3.0.2: lista liczy wynik rodziny na nowo (stary zielony wpis nie zostaje)
await page.evaluate(code => { App.family = [{ id: 'f1', name: 'Wega', p: cleanProfile({ diet: ['vegan'] }) }]; App.saveFamily(); App.shopAll();
  App.shelves.shelves[0].items = [{ id: 'x1', name: 'Mleko', code, dept: 'dairy', checked: false, qty: 1, unit: 'szt', pct: 100, fam: { t: 'ok', h: 'Pasuje wszystkim' }, added: Date.now() }]; App.saveShelves(); }, C.milk);
await go('#/polki');
const row = await page.innerText('#shelfItems').catch(() => '');
ok(/nie dla: Wega/i.test(row) && !/pasuje wszystkim/.test(row), 'lista: wynik dla rodziny przeliczony od razu (' + row.replace(/\s+/g, ' ').slice(0, 60) + ')');
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
