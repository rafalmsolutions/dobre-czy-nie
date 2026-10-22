// Uzupełnianie bazy (2.7.0): lista „Uzupełnij dane” (zdjęcia są w bazie, tekstu brak), odczyt tabeli wartości ze zdjęcia,
// jeden ekran skład + wartości, kategoria podpowiadana z nazwy przy dodawaniu. Uruchom: node e2e-d-fill.mjs (serwer na porcie 8790).
import { chromium } from 'playwright';
import fs from 'fs';
import { setup, C } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
const S = { edit: [], ocr: [] };
await ctx.route(/\/config\.js$/, r => { let body = fs.readFileSync(new URL('../app/config.js', import.meta.url), 'utf8'); body = body.replace(/offProxyUrl: '[^']*'/, "offProxyUrl: 'https://proxy.test/'").replace(/goatcounter: '[^']*'/, "goatcounter: ''"); r.fulfill({ body, contentType: 'text/javascript' }); });
await ctx.route(/\/data\/uzupelnij\.json/, r => r.fulfill({ json: { built: '2026-10-22', count: 2, items: [{ c: C.missing2, n: 'Olej testowy', b: 'Marka', i: '', s: 50, k: 'sw' }, { c: C.milk, n: 'Mleko testowe', b: '', i: '', s: 20, k: 'w' }] } }));
await ctx.route(/proxy\.test\/ocr/, async r => {
  const f = r.request().postData() || ''; S.ocr.push(f);
  if (/name="field"\s+nutrition/.test(f)) return r.fulfill({ json: { ok: true, text: 'Wartość odżywcza w 100 g\nWartość energetyczna 3404 kJ / 828 kcal\nTłuszcz 92 g\nw tym kwasy tłuszczowe nasycone 7 g\nWęglowodany 0 g\nw tym cukry 0 g\nBiałko 0 g\nSól 0 g' } });
  return r.fulfill({ json: { ok: true, text: 'Skład: olej rzepakowy 100%. Przechowywać w suchym miejscu.' } });
});
await ctx.route(/proxy\.test\/edit/, r => { S.edit.push(r.request().postData() || ''); return r.fulfill({ json: { ok: true, saved: ['ingredients', 'nutrition'] } }); });
// Produkt bez składu i wartości, ze zdjęciami w bazie
await ctx.route(new RegExp('openfoodfacts\\.org/api/v2/product/' + C.missing2), r => r.fulfill({ json: { status: 1, product: { code: C.missing2, product_name_pl: 'Olej testowy', brands: 'Marka', categories_hierarchy: ['en:vegetable-oils'],
  image_ingredients_url: 'https://images.openfoodfacts.org/images/products/x/ingredients_pl.400.jpg', image_nutrition_url: 'https://images.openfoodfacts.org/images/products/x/nutrition_pl.400.jpg' } } }));
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1');
  localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false })); });
await page.goto('http://localhost:8790/app/index.html#/album'); await page.waitForTimeout(900);
ok(await page.locator('#scr-album .fill-banner[href="#/uzupelnij"]').count() === 1, 'Kolekcja: wejście „Uzupełnij dane”');
await page.click('#scr-album .fill-banner'); await page.waitForTimeout(800);
const items = await page.$$eval('#scr-fill .fill-item', l => l.map(x => x.innerText.replace(/\s+/g, ' ')));
ok(items.length === 2 && /Olej testowy/.test(items[0]) && /skład i wartości/.test(items[0]) && /\+20/.test(items[0]), 'lista: najpopularniejsze, co brakuje i ile punktów ' + items[0]);
await page.click('#scr-fill .fill-item >> nth=0'); await page.waitForTimeout(2500);
const closeCel = async () => { for (let i = 0; i < 10; i++) { if (await page.locator('#celebrate').isHidden().catch(() => true)) return; await page.click('#celebrate [data-act=cel-ok]').catch(() => {}); await page.waitForTimeout(120); } };
await closeCel(); if (await page.locator('#reveal').isVisible().catch(() => false)) await page.click('#reveal [data-act=reveal-close]');
const both = await page.locator('#completeBoth').count(), single = await page.locator('#completeIngr, #completeNut').count();
ok(both === 1 || single >= 1, 'z listy: od razu otwarte uzupełnianie (' + both + '/' + single + ')');
if (both) {
  ok(await page.inputValue('#cmpIngr') === 'olej rzepakowy 100%', 'skład odczytany ze zdjęcia, bez „Skład:” i przechowywania');
  ok(await page.inputValue('[data-nut=energy-kcal]') === '828' && await page.inputValue('[data-nut=fat]') === '92' && await page.inputValue('[data-nut=saturated-fat]') === '7', 'wartości odczytane z tabeli (kcal, tłuszcz, nasycone)');
  ok(await page.locator('[data-nut].ocr').count() >= 7, 'odczytane pola zaznaczone do sprawdzenia');
  await page.click('[data-cmp=save-both]'); await page.waitForTimeout(700);
  ok(S.edit.length === 1 && /ingredients_text/.test(S.edit[0]) && /828/.test(S.edit[0]), 'jeden zapis: skład i wartości razem');
  ok(await page.evaluate(c => (JSON.parse(localStorage.getItem('dcn-d-fill')) || {}).done.includes(c), C.missing2), 'produkt oznaczony jako uzupełniony');
}
await page.goto('http://localhost:8790/app/index.html#/uzupelnij'); await page.waitForTimeout(600);
ok(!/Olej testowy/.test(await page.innerText('#scr-fill')), 'uzupełniony znika z listy');

// Dodawanie: kategoria z nazwy
await page.goto('http://localhost:8790/app/index.html#/p/' + C.missing); await page.waitForTimeout(1500);
if (await page.locator('#addName').count()) {
  await page.fill('#addName', 'Napój owsiany bez cukru'); await page.waitForTimeout(100);
  ok(await page.inputValue('#addCat') === 'en:plant-based-milk-alternatives', 'kategoria podpowiedziana: napój owsiany → napoje roślinne');
  await page.fill('#addName', 'Jogurt naturalny 2%'); await page.waitForTimeout(100);
  ok(await page.inputValue('#addCat') === 'en:yogurts', 'kategoria podpowiedziana: jogurt');
  await page.selectOption('#addCat', 'en:quarks'); await page.fill('#addName', 'Skyr waniliowy'); await page.waitForTimeout(100);
  ok(await page.inputValue('#addCat') === 'en:quarks', 'wybór ręczny nie jest nadpisywany');
} else ok(false, 'formularz dodawania');
ok(await page.evaluate(() => [App.guessCategory('Płatki owsiane górskie'), App.guessCategory('Szynka konserwowa'), App.guessCategory('Zupa pomidorowa'), App.guessCategory('Coś dziwnego')].join()) === 'en:breakfast-cereals,en:prepared-meats,en:soups,', 'zgadywanie kategorii z nazw');
const col = await page.evaluate(() => App.parseNutText('Wartość odżywcza\nWartość energetyczna\nTłuszcz\nw tym kwasy tłuszczowe nasycone\nWęglowodany\nw tym cukry\nBiałko\nSól\n100 ml\n180 kJ / 43 kcal\n0,1 g\n0 g\n10,5 g\n10,2 g\n<0,5 g\n0,01 g'));
ok(col.per === 'ml' && col.values['energy-kcal'] === 43 && col.values.sugars === 10.2 && col.values.salt === 0.01 && col.values.proteins === 0.5, 'tabela odczytana kolumnami (napój na 100 ml) ' + JSON.stringify(col));
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
