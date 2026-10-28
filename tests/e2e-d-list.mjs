// Lista „Najlepsze” (2.3.2): ten sam wynik co po otwarciu produktu (dociąganie pełnych danych), wybór osoby z rodziny,
// ocet spirytusowy to nie alkohol, długie nazwy bez łamania słów. Uruchom: node e2e-d-list.mjs (serwer na porcie 8790).
import { chromium } from 'playwright';
import { setup } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
// Wyszukiwarka (źródło listy) ma gulasz bez wartości odżywczych i bez składu; pełne dane są dopiero w karcie produktu.
const LIST = [
  { code: '5900000002001', product_name: 'Gulasz wieprzowy', brands: 'Testowy', nutriscore_grade: 'c', nova_group: 4, additives_tags: ['en:e621'], allergens_tags: ['en:gluten'], traces_tags: [], ingredients_analysis_tags: [], labels_tags: [], nutriments: {}, categories_hierarchy: ['en:prepared-meats'], stores: [] },
  { code: '5900000002002', product_name: 'Pasta z orzechami i szynką', brands: 'Testowy', nutriscore_grade: 'a', nova_group: 1, additives_tags: [], allergens_tags: ['en:nuts'], traces_tags: [], ingredients_analysis_tags: [], labels_tags: [], nutriments: { 'salt_100g': 0.1, 'sugars_100g': 1, 'saturated-fat_100g': 1 }, categories_hierarchy: ['en:prepared-meats'], stores: [] },
  { code: '5900000002003', product_name: 'Szynka gotowana', brands: 'Testowy', nutriscore_grade: 'a', nova_group: 1, additives_tags: [], allergens_tags: [], traces_tags: [], ingredients_analysis_tags: [], labels_tags: [], nutriments: { 'salt_100g': 0.2, 'sugars_100g': 1, 'saturated-fat_100g': 1 }, categories_hierarchy: ['en:prepared-meats'], stores: [] }
];
const DETAIL = {
  '5900000002001': { code: '5900000002001', product_name_pl: 'Gulasz wieprzowy', brands: 'Testowy', quantity: '300 g', image_front_small_url: 'https://images.openfoodfacts.org/images/products/590/000/000/2001/front_pl.3.200.jpg', nutriscore_grade: 'c', nova_group: 4, additives_tags: ['en:e621'], allergens_tags: ['en:gluten'], categories_hierarchy: ['en:prepared-meats'],
    ingredients_text_pl: 'mięso wieprzowe (30%), sos: woda, mąka pszenna (gluten), sól, musztarda (woda, gorczyca, ocet spirytusowy, cukier, sól), przyprawy',
    nutriments: { 'energy-kcal_100g': 120, 'fat_100g': 6, 'saturated-fat_100g': 1.5, 'sugars_100g': 2, 'salt_100g': 1.3, 'proteins_100g': 9 } }
};
let detailCalls = 0;
await ctx.route(/workers\.dev\/category/, r => r.fulfill({ json: { ok: true, products: LIST } }));
const full = code => DETAIL[code] || Object.assign({}, LIST.find(x => x.code === code), { product_name_pl: (LIST.find(x => x.code === code) || {}).product_name, ingredients_text_pl: 'mięso, sól' });
// Pełne dane dla listy: pośrednik /details (jedno zapytanie na kilka produktów).
await ctx.route(/workers\.dev\/details/, r => {
  const codes = new URL(r.request().url()).searchParams.get('codes').split(','); detailCalls++;
  return r.fulfill({ json: { ok: true, failed: 0, products: Object.fromEntries(codes.map(c => [c, full(c)])) } });
});
// Ekran produktu: Open Food Facts na żywo.
await ctx.route(/openfoodfacts\.org\/api\/v2\/product\/59000000020/, r => {
  const code = (r.request().url().match(/product\/(\d+)/) || [])[1];
  return r.fulfill({ json: { status: 1, product: full(code) } });
});
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => {
  if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1');
  localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false }));
  localStorage.setItem('dcn-d-profile', JSON.stringify({ watch: ['salt'], avoid: ['alcohol'] }));
  localStorage.setItem('dcn-d-family', JSON.stringify([{ id: 'f1', name: 'Kuba', p: { allergens: ['nuts'] } }]));
});
const rows = () => page.$$eval('#shopList .item', it => it.map(x => ({ name: x.querySelector('.t1').textContent, pct: (x.querySelector('.pct') || {}).textContent, t2: x.querySelector('.t2').textContent })));
await page.goto('http://localhost:8790/app/index.html#/lista/en:prepared-meats'); await page.waitForTimeout(2500);
for (let i = 0; i < 6; i++) { if (await page.locator('#celebrate').isHidden()) break; await page.$eval('#celebrate [data-act=cel-ok]', e => e.click()); await page.waitForTimeout(150); }

ok(detailCalls === 1, 'lista pobiera pełne dane jednym zapytaniem do pośrednika (' + detailCalls + ')');
ok(await page.locator('#listDet').count() === 0, 'pełne dane wszystkich produktów: bez ostrzeżenia');
ok(await page.locator('.list-who [data-who]').count() === 3, 'wybór osoby: Cała rodzina, Ty, Kuba (' + await page.locator('.list-who [data-who]').count() + ')');
ok(await page.locator('.list-who [aria-pressed=true]').innerText() === 'Cała rodzina', 'domyślnie cała rodzina');
let r = await rows();
ok(!r.some(x => /orzech/i.test(x.name)), 'cała rodzina: bez produktu z orzechami (Kuba ma alergię)');
ok(r.some(x => /Szynka/.test(x.name) && /Pasuje (wszystkim|Wam obojgu)/.test(x.t2)), "cała rodzina: „Pasuje Wam obojgu” przy szynce");
const gul = r.find(x => /Gulasz/.test(x.name));
// Przełączanie osób wiele razy: zawsze te same listy, bez nowych pobrań, „Cała rodzina” ⊆ lista każdej osoby.
const snap = async who => { await page.$eval(`.list-who [data-who="${who}"]`, e => e.click()); await page.waitForTimeout(250); return (await rows()).map(x => x.name + ' ' + x.pct).join('|'); };
const first = { all: await snap('all'), me: await snap('me'), f1: await snap('f1') };
let same = true; for (let i = 0; i < 3; i++) for (const w of ['f1', 'all', 'me']) if (await snap(w) !== first[w]) same = false;
ok(same, 'przełączanie osób tam i z powrotem: zawsze te same listy');
ok(detailCalls === 1, 'przełączanie osób niczego nie pobiera (' + detailCalls + ')');
const names = t => t.split('|').filter(Boolean).map(x => x.replace(/ \d+%$/, ''));
ok(names(first.all).every(n => names(first.me).includes(n) && names(first.f1).includes(n)), 'cała rodzina ⊆ Ty i ⊆ Kuba');
await page.$eval('.list-who [data-who="all"]', e => e.click()); await page.waitForTimeout(250);
// Profil pilnuje soli: 1,3 g to „średnio” (−10). Bez pełnych danych lista pokazywała wyżej.
await page.$eval('.list-who [data-who=me]', e => e.click()); await page.waitForTimeout(800);
r = await rows();
ok(r.some(x => /orzech/i.test(x.name)), 'wybór „Ty”: produkt z orzechami wraca (Ty nie masz alergii)');
const gulMe = r.find(x => /Gulasz/.test(x.name));
await page.goto('http://localhost:8790/app/index.html#/p/5900000002001'); await page.waitForTimeout(1500);
const badge = (await page.locator('#scr-product .d-badge b, #scr-product .fam-ans').first().innerText()).trim();
const bill = (await page.locator('#scr-product .bill-sum b').first().innerText().catch(() => '')).trim();
const pctDetail = (bill.match(/\d+%/) || [])[0];
ok(gulMe && pctDetail && gulMe.pct.trim() === pctDetail, `gulasz: lista ${gulMe && gulMe.pct} = szczegóły ${pctDetail}`);
ok(!/Alkohol/.test(await page.locator('#scr-product').innerText()), 'gulasz z octem spirytusowym: bez „Alkohol nie pasuje”');
// Jeden wynik dla włączonych osób (najniższy): obręcz talerza = kwadrat z procentem = lista „Cała rodzina” = „Ostatnio sprawdzone”.
const ring = async () => page.evaluate(() => { const p = document.querySelector('#scr-product .d-plate'); const s = p && p.getAttribute('style') || ''; const m = s.match(/--pdeg:(\d+)deg/); const b = document.querySelector('#scr-product .fam-verdict .d-badge b'); return { deg: m ? +m[1] : null, pct: b ? parseInt(b.textContent) : null }; });
const gulAll = (first.all.split('|').find(x => /Gulasz/.test(x)) || '').match(/(\d+)%$/);
let rg = await ring();
ok(rg.pct != null && Math.abs(rg.deg - Math.max(4, Math.round(rg.pct * 3.6))) <= 1, `obręcz = kwadrat z wynikiem rodziny (${rg.deg}° ↔ ${rg.pct}%)`);
ok(gulAll && +gulAll[1] === rg.pct, `kwadrat = lista „Cała rodzina” (${gulAll && gulAll[1]}% ↔ ${rg.pct}%)`);
const other = await page.$$eval('#scr-product .fam-c', b => { const x = b.find(e => !e.classList.contains('on')); return x ? x.dataset.id : null; });
if (other) { await page.$eval(`#scr-product .fam-c[data-id="${other}"]`, e => e.click()); await page.waitForTimeout(400); }
const rg2 = await ring();
ok(other && rg2.deg === rg.deg && rg2.pct === rg.pct, `stuknięcie osoby zmienia tylko rachunek, wynik rodziny zostaje (${rg2.deg}°, ${rg2.pct}%)`);
await page.goto('http://localhost:8790/app/index.html#/'); await page.waitForTimeout(700);
const histPct = async () => page.$$eval('#scr-home .recent .rc', it => { const x = it.find(e => /Gulasz/.test(e.textContent)); return x ? parseInt(x.querySelector('.pct').textContent) : null; });
ok(await histPct() === rg.pct, `„Ostatnio sprawdzone” = wynik rodziny (${await histPct()}% ↔ ${rg.pct}%)`);
// Tylko Ty na zakupach: wszędzie Twój wynik.
await page.evaluate(() => App.setShopOn('f1', false)); await page.goto('http://localhost:8790/app/index.html#/p/5900000002001'); await page.waitForTimeout(400);
await page.goto('http://localhost:8790/app/index.html#/'); await page.waitForTimeout(500);
ok(await histPct() === parseInt(gulMe.pct), `tylko Ty: „Ostatnio sprawdzone” = Twój wynik (${await histPct()}% ↔ ${gulMe.pct})`);
await page.evaluate(() => App.shopAll());
await page.goto('http://localhost:8790/app/index.html#/p/5900000002001'); await page.waitForTimeout(1200);
const fit = await page.$eval('#scr-product .d-title h1', h => ({ sw: h.scrollWidth, cw: h.clientWidth }));
ok(fit.sw <= fit.cw + 1, `długa nazwa mieści się bez łamania słowa (${fit.sw} ≤ ${fit.cw})`);
await page.setViewportSize({ width: 1280, height: 900 }); await page.reload(); await page.waitForTimeout(1500);
const fit2 = await page.$eval('#scr-product .d-title h1', h => ({ sw: h.scrollWidth, cw: h.clientWidth }));
ok(fit2.sw <= fit2.cw + 1, `komputer: długa nazwa mieści się (${fit2.sw} ≤ ${fit2.cw})`);
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://localhost:8790/app/index.html#/lista/en:prepared-meats'); await page.waitForTimeout(1200);
ok(detailCalls === 1, 'powrót do listy: pełne dane z telefonu, bez nowego pobrania (' + detailCalls + ')');
const xs = await page.$$eval('#shopList .item .pct', p => p.map(e => Math.round(e.getBoundingClientRect().left)));
ok(xs.length >= 2 && new Set(xs).size === 1, 'procenty w jednej kolumnie ' + xs.join(','));
// Baza na żywo się spóźnia, a produkt nie ma składu: pełne dane przez pośrednika (nie kopia bazy) i przycisk „Pomóż uzupełnić”.
DETAIL['5900000002009'] = { code: '5900000002009', product_name_pl: 'Jogurt typu greckiego', brands: 'Testowy', nutriscore_grade: 'a', nova_group: 3, categories_hierarchy: ['en:yogurts'], ingredients_text_pl: '', nutriments: { 'sugars_100g': 3.9, 'salt_100g': 0.1, 'saturated-fat_100g': 1.6 } };
await ctx.route(/openfoodfacts\.org\/api\/v2\/product\/5900000002009/, async r => { await new Promise(res => setTimeout(res, 6000)); r.fulfill({ json: { status: 1, product: DETAIL['5900000002009'] } }).catch(() => { }); });
const t0 = Date.now();
await page.goto('http://localhost:8790/app/index.html#/p/5900000002009'); await page.waitForSelector('#scr-product .d-title h1', { timeout: 8000 }).catch(() => { });
ok(Date.now() - t0 < 5500, 'wolna baza: wynik po ' + (Date.now() - t0) + ' ms, bez czekania na nią');
ok(await page.locator('#snapNote').count() === 0, 'wolna baza: pełne dane z pośrednika, nie kopia bazy');
ok(await page.locator('#completeBox').count() === 1, 'brak składu: jest przycisk „Pomóż uzupełnić”');
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
