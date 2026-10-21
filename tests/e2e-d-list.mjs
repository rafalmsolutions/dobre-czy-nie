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
  '5900000002001': { code: '5900000002001', product_name_pl: 'Gulasz wieprzowy', brands: 'Testowy', quantity: '300 g', nutriscore_grade: 'c', nova_group: 4, additives_tags: ['en:e621'], allergens_tags: ['en:gluten'], categories_hierarchy: ['en:prepared-meats'],
    ingredients_text_pl: 'mięso wieprzowe (30%), sos: woda, mąka pszenna (gluten), sól, musztarda (woda, gorczyca, ocet spirytusowy, cukier, sól), przyprawy',
    nutriments: { 'energy-kcal_100g': 120, 'fat_100g': 6, 'saturated-fat_100g': 1.5, 'sugars_100g': 2, 'salt_100g': 1.3, 'proteins_100g': 9 } }
};
let detailCalls = 0;
await ctx.route(/workers\.dev\/category/, r => r.fulfill({ json: { ok: true, products: LIST } }));
await ctx.route(/openfoodfacts\.org\/api\/v2\/product\/59000000020/, r => {
  const code = (r.request().url().match(/product\/(\d+)/) || [])[1]; detailCalls++;
  const d = DETAIL[code] || Object.assign({}, LIST.find(x => x.code === code), { product_name_pl: (LIST.find(x => x.code === code) || {}).product_name, ingredients_text_pl: 'mięso, sól' });
  return r.fulfill({ json: { status: 1, product: d } });
});
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => {
  if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1');
  localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false }));
  localStorage.setItem('dcn-d-profile', JSON.stringify({ watch: ['salt'], avoid: ['alcohol'] }));
  localStorage.setItem('dcn-d-family', JSON.stringify([{ id: 'f1', name: 'Kuba', p: { allergens: ['nuts'] } }]));
});
const rows = () => page.$$eval('#shopList .item', it => it.map(x => ({ name: x.querySelector('.t1').textContent, pct: (x.querySelector('.pct') || {}).textContent, t2: x.querySelector('.t2').textContent })));
await page.goto('http://localhost:8790/index.html#/lista/en:prepared-meats'); await page.waitForTimeout(2500);
for (let i = 0; i < 6; i++) { if (await page.locator('#celebrate').isHidden()) break; await page.$eval('#celebrate [data-act=cel-ok]', e => e.click()); await page.waitForTimeout(150); }

ok(detailCalls >= 1, 'lista dociąga pełne dane produktów (' + detailCalls + ')');
ok(await page.locator('#listDet').count() === 0, 'po dociągnięciu znika napis „Sprawdzam pełne dane”');
ok(await page.locator('.list-who [data-who]').count() === 3, 'wybór osoby: Cała rodzina, Ty, Kuba (' + await page.locator('.list-who [data-who]').count() + ')');
ok(await page.locator('.list-who [aria-pressed=true]').innerText() === 'Cała rodzina', 'domyślnie cała rodzina');
let r = await rows();
ok(!r.some(x => /orzech/i.test(x.name)), 'cała rodzina: bez produktu z orzechami (Kuba ma alergię)');
ok(r.some(x => /Szynka/.test(x.name) && /Pasuje wszystkim/.test(x.t2)), 'cała rodzina: „Pasuje wszystkim” przy szynce');
const gul = r.find(x => /Gulasz/.test(x.name));
// Profil pilnuje soli: 1,3 g to „średnio” (−10). Bez pełnych danych lista pokazywała wyżej.
await page.$eval('.list-who [data-who=me]', e => e.click()); await page.waitForTimeout(800);
r = await rows();
ok(r.some(x => /orzech/i.test(x.name)), 'wybór „Ty”: produkt z orzechami wraca (Ty nie masz alergii)');
const gulMe = r.find(x => /Gulasz/.test(x.name));
await page.goto('http://localhost:8790/index.html#/p/5900000002001'); await page.waitForTimeout(1500);
const badge = (await page.locator('#scr-product .d-badge b, #scr-product .fam-ans').first().innerText()).trim();
const bill = (await page.locator('#scr-product .bill-sum b').first().innerText().catch(() => '')).trim();
const pctDetail = (bill.match(/\d+%/) || [])[0];
ok(gulMe && pctDetail && gulMe.pct.trim() === pctDetail, `gulasz: lista ${gulMe && gulMe.pct} = szczegóły ${pctDetail}`);
ok(!/Alkohol/.test(await page.locator('#scr-product').innerText()), 'gulasz z octem spirytusowym: bez „Alkohol nie pasuje”');
const fit = await page.$eval('#scr-product .d-title h1', h => ({ sw: h.scrollWidth, cw: h.clientWidth }));
ok(fit.sw <= fit.cw + 1, `długa nazwa mieści się bez łamania słowa (${fit.sw} ≤ ${fit.cw})`);
await page.setViewportSize({ width: 1280, height: 900 }); await page.reload(); await page.waitForTimeout(1500);
const fit2 = await page.$eval('#scr-product .d-title h1', h => ({ sw: h.scrollWidth, cw: h.clientWidth }));
ok(fit2.sw <= fit2.cw + 1, `komputer: długa nazwa mieści się (${fit2.sw} ≤ ${fit2.cw})`);
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://localhost:8790/index.html#/lista/en:prepared-meats'); await page.waitForTimeout(1200);
const xs = await page.$$eval('#shopList .item .pct', p => p.map(e => Math.round(e.getBoundingClientRect().left)));
ok(xs.length >= 2 && new Set(xs).size === 1, 'procenty w jednej kolumnie ' + xs.join(','));
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
