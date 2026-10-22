// Poprawki po pierwszym teście w sklepie (2.7.2): kupione zwinięte na półce, ulubione i „często kupujesz”,
// „Skanuj drugi” dodaje do porównania, trafne wyszukiwanie, poprawianie źle odczytanego kodu, produkt bez nazwy,
// pitne produkty mleczne liczone jednakowo. Uruchom: node e2e-d-sklep2.mjs (serwer na porcie 8790).
import { chromium } from 'playwright';
import fs from 'fs';
import { setup, C } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
await ctx.route(/\/config\.js$/, r => { let body = fs.readFileSync(new URL('../app/config.js', import.meta.url), 'utf8'); body = body.replace(/offProxyUrl: '[^']*'/, "offProxyUrl: 'https://proxy.test/'").replace(/goatcounter: '[^']*'/, "goatcounter: ''"); r.fulfill({ body, contentType: 'text/javascript' }); });
const S = { edit: [] };
await ctx.route(/proxy\.test\/edit/, r => { const bd = r.request().postData() || ''; S.edit.push(bd); return r.fulfill({ json: { ok: true, saved: /name="product_name"/.test(bd) ? ['name', 'category'] : ['ingredients', 'nutrition'] } }); });
S.img = []; await ctx.route(/proxy\.test\/image/, r => { S.img.push(r.request().postData() || ''); return r.fulfill({ json: { ok: true } }); });
await ctx.route(/proxy\.test\/ocr/, r => r.fulfill({ json: { ok: false, error: 'no_text' } }));
const P = (name, cats) => ({ code: '', product_name: name, brands: 'Test', nutriscore_grade: 'c', categories_hierarchy: cats || ['en:dairies', 'en:yogurts'], nutriments: { 'energy-kcal_100g': 80, 'saturated-fat_100g': 1.1, sugars_100g: 9.8, salt_100g: 0.08, proteins_100g: 6.5 } });
await ctx.route(/proxy\.test\/search/, r => r.fulfill({ json: { ok: true, products: [
  Object.assign(P('Jogurt pitny truskawkowy'), { code: '5903767003589' }), Object.assign(P('Wiśnia w alkoholu', ['en:sweets']), { code: '5900585000936' }),
  Object.assign(P('Skyr jogurt pitny typu islandzkiego Wiśnia'), { code: '5901939103402' }), Object.assign(P('Jogurt naturalny'), { code: '5900820006938' })] } }));
// Produkt w bazie bez nazwy i zdjęcia (tylko wartości odżywcze)
await ctx.route(new RegExp('openfoodfacts\\.org/api/v2/product/' + C.missing2), r => r.fulfill({ json: { status: 1, product: { code: C.missing2, nutriments: { 'energy-kcal_100g': 50, fat_100g: 1.5, 'saturated-fat_100g': 1, carbohydrates_100g: 4, sugars_100g: 4, proteins_100g: 3, salt_100g: 0.1 } } } }));
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1');
  localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false })); });
const closeCel = async () => { for (let i = 0; i < 10; i++) { if (await page.locator('#celebrate').isHidden().catch(() => true)) return; await page.click('#celebrate [data-act=cel-ok]').catch(() => {}); await page.waitForTimeout(120); } };
const go = async h => { await page.goto('http://localhost:8790/app/index.html' + h); await page.waitForTimeout(1300); await closeCel(); if (await page.locator('#reveal').isVisible().catch(() => false)) await page.click('#reveal [data-act=reveal-close]'); };
const add = async t => { await page.fill('#addItemInput', t); await page.press('#addItemInput', 'Enter'); await page.waitForTimeout(150); };
const tick = async t => { await page.locator(`.sitem:has-text("${t}") input[type=checkbox]`).first().check({ force: true }); await page.waitForTimeout(200); await closeCel(); };

// 1. Półka: kupione zwinięte na dole
await go('#/polki');
for (const t of ['mleko', 'chleb', 'masło']) await add(t);
await tick('mleko');
ok(await page.locator('#shelfItems .sitem').count() === 2 && !(await page.locator('#boughtBox').getAttribute('open') !== null), 'kupione znika z listy działów, zwinięte w „W koszyku”');
ok(/W koszyku: 1/.test(await page.innerText('#boughtBox summary')), 'licznik kupionych');
await page.click('#boughtBox summary'); await page.waitForTimeout(150);
ok(await page.locator('#boughtBox .sitem.checked').count() === 1, 'po rozwinięciu widać kupione (można odznaczyć)');
// „Często kupujesz”: druga zakupiona „mleko” → szybkie dodawanie
await page.click('[data-act=shelf-clear]'); await page.waitForTimeout(200);
await add('mleko'); await tick('mleko'); await page.click('[data-act=shelf-clear]'); await page.waitForTimeout(200);
ok(await page.locator('.quick-add [data-act=qadd]:has-text("mleko")').count() === 1, '„Szybko dodaj”: mleko kupione 2 razy');
await page.click('.quick-add [data-act=qadd]:has-text("mleko")'); await page.waitForTimeout(200);
ok(await page.locator('#shelfItems .sitem:has-text("mleko")').count() === 1 && await page.locator('.quick-add [data-act=qadd]:has-text("mleko")').count() === 0, 'stuknięcie dodaje na półkę i znika z podpowiedzi');
// Ulubione
await go('#/p/' + C.milk);
await page.click('[data-act=fav-toggle]'); await page.waitForTimeout(150);
ok(await page.getAttribute('[data-act=fav-toggle]', 'aria-pressed') === 'true', 'serce: produkt w ulubionych');
await go('#/polki');
ok(await page.locator('.quick-add [data-act=qadd]:has-text("♥")').count() === 1, '„Szybko dodaj”: ulubiony produkt z sercem');
await page.click('.quick-add [data-act=qadd]:has-text("♥")'); await page.waitForTimeout(200);
ok(await page.evaluate(c => App.shelves.shelves.some(s => s.items.some(i => i.code === c && !i.checked)), C.milk), 'ulubiony dodany na półkę z kodem produktu');

// 2. Porównanie: „Porównaj” przy produkcie, potem skan drugiego → ekran porównania
await page.evaluate(() => App.cmpClear());
await go('#/p/' + C.nutella);
await page.click('[data-act=cmp-prod]'); await page.waitForTimeout(200);
await page.evaluate(c => { App.closeScanner(true); App.openCode(c); }, C.milk); await page.waitForTimeout(1600);
ok(await page.evaluate(() => location.hash) === '#/porownaj' && await page.evaluate(() => App.cmp.length) === 2, 'drugi zeskanowany produkt od razu w porównaniu (' + await page.evaluate(() => location.hash) + ')');
await page.evaluate(() => App.cmpClear());

// 3. Wyszukiwarka: tylko produkty ze wszystkimi słowami (odmiana: wiśnia/wiśniowy)
await go('#/szukaj/' + encodeURIComponent('jogurt pitny wiśnia')); await page.waitForTimeout(1200);
const found = await page.$$eval('#srchRes .srch-item .t1', l => l.map(x => x.textContent));
ok(found.length === 1 && /Wiśnia/.test(found[0]), 'jogurt pitny wiśnia → tylko skyr pitny wiśnia (' + found.join(' | ') + ')');

// 4. Źle odczytany kod: poprawienie cyfr na ekranie „nie znamy”
await go('#/p/' + C.missing);
ok(await page.inputValue('#fixCode') === C.missing, 'nieznany kod: pole z zeskanowanymi cyframi do poprawienia');
await page.fill('#fixCode', C.milk); await page.press('#fixCode', 'Enter'); await page.waitForTimeout(1200);
ok(await page.evaluate(() => location.hash) === '#/p/' + C.milk, 'poprawiony kod otwiera produkt');

// 5. Produkt bez nazwy i zdjęcia: najpierw nazwa (i kategoria), potem reszta
await go('#/p/' + C.missing2);
ok(/nazwy/.test(await page.innerText('#completeBox')), 'produkt bez nazwy: zachęta do uzupełnienia nazwy');
await page.click('[data-act=complete]'); await page.waitForTimeout(300);
ok(await page.locator('#completeBasic #cmpName').count() === 1 && await page.locator('#completeBasic #cmpCat').count() === 1, 'pierwszy krok: nazwa i kategoria');
await page.fill('#cmpName', 'Kefir naturalny 2%'); await page.waitForTimeout(100);
ok(await page.inputValue('#cmpCat') === 'en:yogurts', 'kategoria podpowiedziana z nazwy');
await page.click('[data-cmp=save-basic]'); await page.waitForTimeout(800);
ok(S.edit.length && /Kefir naturalny 2%/.test(S.edit[S.edit.length - 1]) && /en:yogurts/.test(S.edit[S.edit.length - 1]), 'nazwa i kategoria zapisane');
ok(await page.locator('#completeIngr, #completeBoth').count() >= 1, 'potem skład');

// 6. Pitne produkty mleczne: identyczne wartości → identyczna ocena, mimo różnych ocen w bazie
const sc = await page.evaluate(() => { const nm = { 'energy-kcal_100g': 80, fat_100g: 1.5, 'saturated-fat_100g': 1.1, sugars_100g: 9.8, salt_100g: 0.08, proteins_100g: 6.5 };
  const mk = (name, ns, cats) => normalizeProduct({ code: '1', product_name: name, nutriscore_grade: ns, nova_group: 4, additives_tags: [], ingredients_text_pl: 'mleko, cukier', nutriments: nm, categories_hierarchy: cats }, 'off');
  const a = analyze(mk('Skyr jogurt pitny Wiśnia', 'e', ['en:dairies', 'en:yogurts', 'en:yogurt-drinks'])), b2 = analyze(mk('Skyr jogurt pitny', 'b', ['en:dairies', 'en:yogurts', 'en:skyrs'])), c = analyze(mk('Skyr truskawkowy', 'b', ['en:dairies', 'en:yogurts']));
  return [a.score, b2.score, a.nutriscoreBeverage, c.nutriscoreBeverage, c.score]; });
ok(sc[0] === sc[1] && sc[2] === true && sc[3] === false, 'skyr pitny wiśnia i truskawka: ta sama ocena (' + sc.join(',') + ')');
// 6b. Produkt z nazwą, bez zdjęcia: jedno stuknięcie wysyła zdjęcie przodu
await go('#/p/' + C.ham);
ok(await page.locator('#frontBox [data-front-photo]').count() === 1, 'brakuje tylko zdjęcia: przycisk „Zrób zdjęcie opakowania”');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
await page.setInputFiles('[data-front-photo]', { name: 'p.png', mimeType: 'image/png', buffer: png }); await page.waitForTimeout(1200);
ok(S.img.length === 1 && /name="field"\r?\n\r?\nfront/.test(S.img[0]) && /Dziękujemy/.test(await page.innerText('#completeBox')), 'zdjęcie przodu wysłane, podziękowanie');
await go('#/p/' + C.ham);
ok(await page.locator('[data-front-photo]').count() === 0, 'po wysłaniu nie prosimy drugi raz');

// 7. Kafelki „Twoja kolekcja” prowadzą do zestawień kart
await go('#/album');
await page.click('.al-stats a.holo'); await page.waitForTimeout(400);
ok(await page.evaluate(() => location.hash) === '#/album/blyszczace' && /błyszczące/i.test(await page.innerText('#scr-albumpage h1')), 'kafelek „błyszczące” otwiera zestawienie');
await go('#/album/karty');
ok(await page.locator('#scr-albumpage .ap-slot').count() === await page.evaluate(() => Object.values(App.album.cards).filter(c => !c.legacy).length), 'wszystkie karty: tyle samo co na kafelku');
await go('#/album/pelne');
ok(/10 miejsc/.test(await page.innerText('#scr-albumpage')) || await page.locator('#scr-albumpage .al-page').count() > 0, 'pełne strony: lista albo wyjaśnienie');
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
