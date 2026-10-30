// 3.0.19: brakujące wartości odżywcze wyliczone z innych – widać je w tabeli i w rachunku z podpisem „wyliczone: …”.
import { chromium } from 'playwright';
import fs from 'fs';
import { setup } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
await ctx.route(/\/config\.js$/, r => { let body = fs.readFileSync(new URL('../app/config.js', import.meta.url), 'utf8'); body = body.replace(/offProxyUrl: '[^']*'/, "offProxyUrl: 'https://proxy.test/'").replace(/goatcounter: '[^']*'/, "goatcounter: ''"); r.fulfill({ body, contentType: 'text/javascript' }); });
await ctx.route(/proxy\.test\//, r => r.fulfill({ json: { ok: true, products: [] } }));
// Olej: w bazie brak cukrów (węglowodany 0) i soli – cukry wyliczone, sól nadal „brak danych”.
const OIL = '5900000800003', WATER = '5900000800010';
const prods = {
  [OIL]: { code: OIL, product_name_pl: 'Olej rzepakowy', brands: 'T', nutriscore_grade: 'b', nova_group: 2, additives_tags: [], ingredients_text_pl: 'olej rzepakowy 100%', nutriments: { 'energy-kcal_100g': 900, fat_100g: 100, 'saturated-fat_100g': 7, carbohydrates_100g: 0, proteins_100g: 0 }, categories_hierarchy: ['en:fats', 'en:vegetable-oils'] },
  [WATER]: { code: WATER, product_name_pl: 'Woda mineralna', brands: 'T', nutriscore_grade: 'a', nova_group: 1, additives_tags: [], ingredients_text_pl: 'naturalna woda mineralna', nutriments: { 'energy-kcal_100g': 0, fat_100g: 0, carbohydrates_100g: 0, proteins_100g: 0, sodium_100g: 0.004 }, categories_hierarchy: ['en:beverages', 'en:waters'] }
};
await ctx.route(/openfoodfacts\.org\/api\/v2\/product\/(\d+)/, r => { const c = r.request().url().match(/product\/(\d+)/)[1]; return prods[c] ? r.fulfill({ json: { status: 1, product: prods[c] } }) : r.fallback(); });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false })); localStorage.setItem('dcn-d-profile', JSON.stringify({ watch: ['sugar', 'salt', 'satfat'] })); });
const go = async h => { await page.goto('http://localhost:8790/app/index.html' + h); await page.waitForTimeout(1300); await page.evaluate(() => { App.dropCelebrations && App.dropCelebrations(); App.rewardBar && App.rewardBar(); }); };

await go('#/p/' + OIL);
const nut = (await page.innerText('table.nut').catch(() => '')).replace(/\s+/g, ' ');
ok(/Cukry.*0 g.*wyliczone: węglowodany 0 g/.test(nut), 'olej, tabela: „Cukry 0 g, wyliczone: węglowodany 0 g” (' + nut + ')');
ok(!/Sól/.test(nut), 'olej, tabela: soli nie zgadujemy (brak wiersza)');
const bill = (await page.innerText('.bill').catch(() => '')).replace(/\s+/g, ' ');
ok(/Sól brak danych/.test(bill) && /wyliczone: węglowodany 0 g/.test(bill), 'olej, rachunek: cukier wyliczony, sól „brak danych” (' + bill.slice(0, 200) + ')');
await go('#/p/' + WATER);
const nut2 = (await page.innerText('table.nut').catch(() => '')).replace(/\s+/g, ' ');
ok(/Sól.*0,01 g wyliczone: sód 0,004 g/.test(nut2) && /nasycone.*wyliczone: tłuszcz 0 g/.test(nut2), 'woda, tabela: sól z sodu, nasycone z tłuszczu (' + nut2 + ')');
ok(/Wartości „wyliczone” nie są wpisane w bazie/.test(await page.innerText('#scr-product')), 'objaśnienie pod tabelą');
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
