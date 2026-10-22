// Moje sklepy: wybór w profilu, sklep dopisywany przy dodawaniu i uzupełnianiu produktu, pytanie „Kupujesz to w:” po skanie.
// Uruchom: node e2e-d-stores.mjs (serwer na porcie 8790).
import { chromium } from 'playwright';
import fs from 'fs';
import { setup, C } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const shots = new URL('./shots/', import.meta.url).pathname;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const S = { edit: [], product: [] };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
await ctx.route(/\/config\.js$/, r => { let body = fs.readFileSync(new URL('../app/config.js', import.meta.url), 'utf8'); body = body.replace(/offProxyUrl: '[^']*'/, "offProxyUrl: 'https://proxy.test/'").replace(/goatcounter: '[^']*'/, "goatcounter: ''"); r.fulfill({ body, contentType: 'application/javascript' }); });
const form = r => (r.request().postDataBuffer() || Buffer.alloc(0)).toString('utf8');
const field = (body, name) => { const m = body.match(new RegExp('name="' + name + '"\\r\\n\\r\\n([^\\r]*)')); return m ? m[1] : null; };
await ctx.route(/proxy\.test\/category/, r => r.fulfill({ json: { products: [] } }));
await ctx.route(/proxy\.test\/product/, r => { S.product.push(form(r)); r.fulfill({ json: { ok: true } }); });
await ctx.route(/proxy\.test\/ocr/, r => r.fulfill({ json: { ok: true, text: 'mleko pasteryzowane, żywe kultury bakterii jogurtowych, białka mleka' } }));
await ctx.route(/proxy\.test\/edit/, r => { const f = form(r); S.edit.push(f); const saved = []; if (field(f, 'ingredients_text')) saved.push('ingredients'); if (field(f, 'nutriments')) saved.push('nutrition'); if (field(f, 'store')) saved.push('store'); r.fulfill({ json: { ok: true, saved } }); });
await ctx.route(/proxy\.test\/disc\//, r => r.fulfill({ json: { ok: true, found: false, items: [] } }));
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false })); localStorage.setItem('dcn-d-stores', JSON.stringify(['lidl', 'biedronka'])); });
const pts = () => page.evaluate(() => App.game.points);
const txt = async sel => (await page.locator(sel).innerText().catch(() => '')) || '';
const go = async code => { await page.goto('http://localhost:8790/app/index.html#/'); await page.waitForTimeout(200); await page.goto('http://localhost:8790/app/index.html#/p/' + code); await page.waitForTimeout(1500); };

// 1. Profil: „Gdzie robisz zakupy”
await page.goto('http://localhost:8790/app/index.html#/profil'); await page.waitForTimeout(600);
ok(await page.locator('input[name=mystore][value=lidl]').isChecked() && await page.locator('input[name=mystore][value=biedronka]').isChecked(), 'profil: zaznaczone moje sklepy');
await page.locator('label.pchip:has(input[name=mystore][value=dino])').click(); await page.waitForTimeout(200);
ok(await page.evaluate(() => App.myStores().join()) === 'biedronka,lidl,dino' || await page.evaluate(() => App.myStores().includes('dino')), 'profil: dodanie sklepu zapisane od razu');
await page.locator('label.pchip:has(input[name=mystore][value=dino])').click(); await page.waitForTimeout(200);

// 2. Po skanie: „Kupujesz to w:” – jedno stuknięcie
await go(C.milk);
ok(await page.locator('#storeBox').isVisible(), 'produkt bez mojego sklepu: pytanie „Kupujesz to w:”');
await page.locator('#storeBox').screenshot({ path: shots + 'store-ask.png' });
const p0 = await pts();
await page.$eval('#storeBox [data-act=store-tag][data-k=lidl]', e => e.click()); await page.waitForTimeout(500);
ok(S.edit.length === 1 && field(S.edit[0], 'store') === 'lidl' && field(S.edit[0], 'code') === C.milk, 'sklep wysłany do pośrednika');
ok(/Dziękujemy/.test(await txt('#storeBox')) && await pts() === p0 + 2, 'podziękowanie i +2 pkt');
await go(C.milk);
ok(await page.locator('#storeBox [data-act=store-tag]').count() === 0, 'drugi raz już nie pytamy');
await go(C.ham);
await page.$eval('#storeBox [data-act=store-skip]', e => e.click()); await page.waitForTimeout(200);
await go(C.ham);
ok(await page.locator('#storeBox').count() === 0 && S.edit.length === 1, '„Nie teraz”: bez wysyłki i bez kolejnego pytania');

// 3. Dodanie brakującego produktu: sklep podpowiedziany, bez dodatkowego kroku
await page.goto('http://localhost:8790/app/index.html#/p/' + C.missing); await page.waitForTimeout(1800);
ok(await page.locator('#addForm input[name=addStore][value=biedronka]').isChecked(), 'dodawanie: pierwszy z moich sklepów zaznaczony');
await page.evaluate(c => { App.findCodes = async () => [c]; }, C.missing);
await page.fill('#addName', 'Jogurt testowy 2%');
for (const k of ['front', 'ingredients', 'nutrition']) { await page.setInputFiles(`[data-photo=${k}]`, { name: k + '.png', mimeType: 'image/png', buffer: PNG }); await page.waitForTimeout(250); }
await page.locator('label.pchip:has(input[name=addStore][value=lidl])').click();
await page.$eval('#addSend', e => e.click()); await page.waitForTimeout(900);
ok(S.product.length === 1 && field(S.product[0], 'store') === 'lidl', 'nowy produkt wysłany ze zmienionym sklepem: Lidl');
await page.waitForSelector('#cmpIngr', { timeout: 5000 }).catch(() => { });
ok(await page.locator('#completeBox .store-pick').count() === 0, 'uzupełnianie po dodaniu: sklep już zapisany, bez pytania');

// 4. Uzupełnianie składu istniejącego produktu: sklep jedzie razem ze składem
await go(C.oil);
if (await page.locator('[data-act=complete]').count()) {
  await page.$eval('[data-act=complete]', e => e.click());
  await page.waitForSelector('#cmpIngr', { timeout: 5000 });
  ok(await page.locator('#completeBox .store-pick input[value=biedronka]').isChecked(), 'uzupełnianie: wybór sklepu w nagłówku, pierwszy z moich zaznaczony');
  const n0 = S.edit.length;
  await page.fill('#cmpIngr', 'mleko pasteryzowane, żywe kultury bakterii jogurtowych, białka mleka'); await page.$eval('[data-cmp=save-ingr]', e => e.click()); await page.waitForTimeout(600);
  ok(S.edit.length === n0 + 1 && field(S.edit[n0], 'store') === 'biedronka' && field(S.edit[n0], 'ingredients_text'), 'skład zapisany razem ze sklepem');
  ok(await page.evaluate(c => App.storeTagged(c), C.oil), 'sklep zapamiętany przy produkcie');
} else ok(false, 'produkt bez składu: przycisk „Uzupełnij”');

// 5. Bez moich sklepów nic się nie pojawia
await page.evaluate(() => App.setMyStores([]));
await go(C.vegan);
ok(await page.locator('#storeBox').count() === 0, 'bez moich sklepów: bez pytania o sklep');

ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
