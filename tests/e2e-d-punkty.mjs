// 3.0.18: punkty za listę tylko za przygotowaną listę (min. 3 rzeczy na liście od 30 min), raz dziennie; bez +5 pkt za produkt,
// który komuś z kupujących nie pasuje; ser bez składu dla weganina → „nie pasuje” z powodem z kategorii; tryb bez punktów chowa dopiski.
import { chromium } from 'playwright';
import fs from 'fs';
import { setup, C } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
await ctx.route(/\/config\.js$/, r => { let body = fs.readFileSync(new URL('../app/config.js', import.meta.url), 'utf8'); body = body.replace(/offProxyUrl: '[^']*'/, "offProxyUrl: 'https://proxy.test/'").replace(/goatcounter: '[^']*'/, "goatcounter: ''"); r.fulfill({ body, contentType: 'text/javascript' }); });
await ctx.route(/proxy\.test\//, r => r.fulfill({ json: { ok: true, products: [] } }));
const CHEESE = '5900000600007';
await ctx.route(new RegExp('openfoodfacts\\.org/api/v2/product/' + CHEESE), r => r.fulfill({ json: { status: 1, product: { code: CHEESE, product_name_pl: 'Pecorino biologico', brands: 'T', nutriscore_grade: 'd', nutriments: { fat_100g: 39, 'saturated-fat_100g': 29, salt_100g: 1.9, sugars_100g: 0.1, proteins_100g: 18 }, categories_hierarchy: ['en:dairies', 'en:fermented-foods', 'en:fermented-milk-products', 'en:cheeses', 'en:sheep-cheeses'] } } }));
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false }));
  localStorage.setItem('dcn-d-profile', JSON.stringify({ allergens: ['nuts'], diet: ['vegan'] })); });
const go = async h => { await page.goto('http://localhost:8790/app/index.html' + h); await page.waitForTimeout(1300); };
const pts = () => page.evaluate(() => App.game.points);
const closeCel = () => page.evaluate(() => { App.dropCelebrations && App.dropCelebrations(); App.rewardBar && App.rewardBar(); });

// 13. Ser bez składu dla weganina.
await go('#/p/' + CHEESE); await closeCel();
const hero = await page.innerText('#scr-product').catch(() => '');
const bill = await page.innerText('.bill').catch(() => '');
ok(/raczej nie dla Ciebie/i.test(hero) && /Wegańska\s*nie pasuje/.test(bill) && /to ser \(kategoria w bazie\)/.test(bill), 'ser bez składu, weganin: „raczej nie dla Ciebie”, w rachunku „Wegańska nie pasuje – to ser (kategoria w bazie)” (' + bill.replace(/\s+/g, ' ').slice(0, 160) + ')');

// 14a. Produkt, który nie pasuje (orzechy): przycisk bez „+5 pkt”, dodanie bez punktów.
await go('#/p/' + C.nutella); await closeCel();
ok((await page.innerText('[data-act=shelf-add]')).trim() === 'Na listę', 'niepasujący produkt: przycisk „Na listę” bez „(+5 pkt)”');
let p0 = await pts(); await page.click('[data-act=shelf-add]'); await page.waitForTimeout(300);
ok(await pts() === p0, `niepasujący produkt na liście: bez punktów (${p0} → ${await pts()})`);
// Pasujący produkt: „+5 pkt” zostaje.
await page.evaluate(() => { App.profile = cleanProfile({}); App.saveProfile(); });
await go('#/p/' + C.oil); await closeCel();
ok(/\(\+5 pkt\)/.test(await page.innerText('[data-act=shelf-add]')), 'produkt bez przeciwwskazań: „Na listę (+5 pkt)”');
p0 = await pts(); await page.click('[data-act=shelf-add]'); await page.waitForTimeout(300);
ok(await pts() === p0 + 5, `pasujący produkt na liście: +5 pkt (${p0} → ${await pts()})`);

// 14b. Cała lista: rzeczy dopisane i od razu odhaczone – bez punktów.
const fresh = async (ageMin, name) => page.evaluate(([ageMin, name]) => {
  const id = 's' + Math.random().toString(36).slice(2, 8), t = Date.now() - ageMin * 60000;
  App.shelves.shelves.push({ id, name, created: t, items: ['mleko', 'chleb', 'jabłka'].map((n, i) => ({ id: id + i, name: n, code: null, pct: null, dept: 'other', checked: false, checkedAt: null, qty: 1, unit: 'szt', fam: null, added: t })) });
  App.shelves.active = id; App.saveShelves();
}, [ageMin, name]);
const tickAll = async () => { for (let i = 0; i < 3; i++) { await page.locator('[data-act=item-toggle]:not(:checked)').first().click(); await page.waitForTimeout(200); } };
await fresh(0, 'Szybka'); await go('#/polki');
ok(/30 min/.test(await page.innerText('.shop-pts')) && !/w sklepie/.test(await page.innerText('.shop-pts')), 'podpowiedź: warunek 30 min, bez obietnicy „w sklepie” (' + (await page.innerText('.shop-pts')).trim() + ')');
p0 = await pts(); await tickAll();
ok(await pts() === p0, `lista dopisana i od razu odhaczona: bez punktów (${p0} → ${await pts()})`);
// Lista przygotowana 31 min wcześniej: +10 pkt.
await fresh(31, 'Przygotowana'); await go('#/'); await go('#/polki');
p0 = await pts(); await tickAll();
ok(await pts() === p0 + 10, `lista z rzeczami sprzed 31 min: +10 pkt (${p0} → ${await pts()})`);
// Druga taka lista tego samego dnia: bez punktów.
await fresh(45, 'Druga'); await go('#/'); await go('#/polki');
p0 = await pts(); await tickAll();
ok(await pts() === p0, `druga lista tego samego dnia: bez punktów (${p0} → ${await pts()})`);

// Tryb bez punktów: bez dopisków.
await page.evaluate(() => { const s = App.store.get('settings', {}); }); await go('#/profil/ustawienia');
await page.check('#setShop'); await page.waitForTimeout(300);
await fresh(31, 'Cicha'); await go('#/'); await go('#/polki');
ok(await page.locator('.shop-pts').count() === 0, 'tryb bez punktów: bez podpowiedzi o punktach');
await go('#/p/' + C.milk);
ok(!/pkt/.test(await page.innerText('[data-act=shelf-add]')), 'tryb bez punktów: przycisk bez „pkt”');
// 12. Znaczek przy braku danych: bez „?”, z podpisem, dla kogo brakuje danych (dopełniacz).
await page.evaluate(() => { App.family = [{ id: 'f1', name: 'Kuba', p: cleanProfile({ allergens: ['gluten'] }) }]; App.saveFamily(); App.shopAll(); });
await go('#/p/' + CHEESE); await closeCel();
const badge = (await page.innerText('.d-hside .d-badge').catch(() => '')).replace(/\s+/g, ' ').trim();
ok(/^brak danych dla Kuby$/.test(badge) && !/\?/.test(badge), 'znaczek: „' + badge + '” (bez „?”)');
ok(await page.evaluate(() => App.forWhomGen([{ id: 'me' }, { id: 'f1', name: 'Kuba' }]) === 'dla Ciebie i Kuby' && App.forWhomGen([{ id: 'a', name: 'X' }, { id: 'b', name: 'Y' }, { id: 'c', name: 'Z' }]) === 'dla 3 osób'), 'podpis: „dla Ciebie i Kuby”, „dla 3 osób”');
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
