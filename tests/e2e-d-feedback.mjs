// Poprawki po uwagach z 21.10.2026: wynik od razu (bez „Zgadnij” i bez nakładek), wolniejsze odznaki,
// karty i odznaki w jednej zakładce, półka z ilością i odpowiedzią dla rodziny. Uruchom: node e2e-d-feedback.mjs (serwer na porcie 8790).
import { chromium } from 'playwright';
import { setup, C } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
await ctx.route(/workers\.dev\/category/, r => r.fulfill({ json: { products: [] } }));
let forgot = 0; await ctx.route(/workers\.dev\/disc\/forget/, r => { forgot++; return r.fulfill({ json: { ok: true } }); });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
const shots = new URL('./shots/', import.meta.url).pathname;
// Użytkownik, który kiedyś zapisał „Zgadnij” włączone – po poprawce i tak domyślnie wyłączone.
await page.addInitScript(() => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: true }));
  localStorage.setItem('dcn-d-profile', JSON.stringify({ watch: ['sugar'] })); localStorage.setItem('dcn-d-family', JSON.stringify([{ id: 'f1', name: 'Kuba', p: { allergens: ['nuts'] } }])); });

// 1. Po skanie od razu wynik: bez „Zgadnij”, bez nakładek
await page.goto('http://localhost:8790/app/index.html#/p/' + C.nutella); await page.waitForTimeout(1600);
ok(await page.locator('#guessBox').count() === 0, 'bez „Zgadnij” przed wynikiem');
ok(await page.evaluate(() => App.settings.guess === false), '„Zgadnij” wyłączone także u kogoś, kto miał je zapisane');
ok(/Nie dla: Kuba/.test(await page.innerText('#scr-product .fam-ans')), 'od razu odpowiedź dla rodziny');
ok(!(await page.locator('#reveal').isVisible()) && !(await page.locator('#celebrate').isVisible()), 'żadna nakładka nie zasłania wyniku');

// 2. Pięć skanów: najwyżej jedna odznaka
for (const c of [C.milk, C.oil, C.ham, C.vegan]) { await page.goto('http://localhost:8790/app/index.html#/p/' + c); await page.waitForTimeout(1300); }
const got = await page.evaluate(() => Object.keys(App.game.unlocked || {}));
ok(got.length <= 1, 'po 5 skanach najwyżej 1 odznaka: ' + (got.join(', ') || 'brak'));

// 3. Półka: ilość i odpowiedź dla rodziny
await page.goto('http://localhost:8790/app/index.html#/p/' + C.nutella); await page.waitForTimeout(1500);
await page.$eval('[data-act=shelf-add]', e => e.click()); await page.waitForTimeout(300);
await page.goto('http://localhost:8790/app/index.html#/polki'); await page.waitForTimeout(500);
const row = page.locator('.sitem').first();
ok(/1 szt\./.test(await row.innerText()), 'domyślnie 1 szt.');
ok(await row.locator('.famchip[data-t=bad]').count() === 1 && /Kuba/.test(await row.locator('.famchip').innerText()), 'na półce odpowiedź dla rodziny: ✕ Kuba');
await row.locator('[data-act=item-qty]').click(); await page.waitForTimeout(200);
await page.fill('#qtyInput', '1,5'); await page.selectOption('#qtyUnit', 'kg'); await page.click('#qtyForm button[type=submit]'); await page.waitForTimeout(200);
ok(/1,5 kg/.test(await page.locator('.sitem').first().innerText()), 'zmiana ilości: 1,5 kg');
await page.fill('#addItemInput', '2 l mleko'); await page.press('#addItemInput', 'Enter'); await page.waitForTimeout(200);
ok(await page.evaluate(() => { const it = App.shelves.shelves[0].items.find(i => i.name === 'mleko'); return it && it.qty === 2 && it.unit === 'l'; }), 'wpisane „2 l mleko” → mleko, 2 l');
await page.screenshot({ path: shots + 'shelf-qty.png', fullPage: true });

// 4. Karty i odznaki w jednej zakładce
await page.goto('http://localhost:8790/app/index.html#/postepy'); await page.waitForTimeout(700);
ok(await page.locator('#scr-progress .coll-tabs a[aria-current]').innerText().then(t => /Odznaki/.test(t)), 'odznaki: przełącznik Karty | Odznaki');
ok(await page.locator('.tab[data-tab=album][aria-current=page]').count() === 1 && /Kolekcja/.test(await page.locator('.tab[data-tab=album]').innerText()), 'dolne menu: „Kolekcja” zaznaczona przy odznakach');
await page.click('#scr-progress .coll-tabs a[href="#/album"]'); await page.waitForTimeout(500);
ok(await page.locator('#scr-album .coll-tabs a[aria-current]').innerText().then(t => /Karty/.test(t)), 'karty: ten sam przełącznik');
await page.screenshot({ path: shots + 'collection.png' });

// 5. „Usuń wszystkie moje dane” kasuje też dane na serwerze odkrywców
await page.goto('http://localhost:8790/app/index.html#/profil'); await page.waitForTimeout(600);
await page.$eval('[data-act=wipe]', e => e.click()); await page.waitForTimeout(300);
await page.$eval('[data-act=wipe-yes]', e => e.click()); await page.waitForTimeout(2000);
ok(forgot === 1, 'usunięcie danych: zapytanie /disc/forget do serwera');
ok(await page.evaluate(() => !localStorage.getItem('dcn-d-family') && !localStorage.getItem('dcn-d-profile')), 'usunięcie danych: telefon wyczyszczony');
// Znacznik testera z linku: zapamiętany, usunięty z adresu, dopisany do uwag.
await page.goto('http://localhost:8790/app/index.html?t=Paweł%20K#/'); await page.waitForTimeout(800);
ok(await page.evaluate(() => App.tester()) === 'pawelk', 'znacznik testera zapamiętany: ' + await page.evaluate(() => App.tester()));
ok(!/[?&]t=/.test(page.url()) && new URL(page.url()).hash === '#/', 'znacznik usunięty z adresu: ' + page.url());
ok(await page.evaluate(() => decodeURIComponent(App.feedbackHref()).includes('· pawelk') && decodeURIComponent(App.feedbackHref()).includes('tester: pawelk')), 'uwagi z testerem w temacie i treści');
await page.reload(); await page.waitForTimeout(500);
ok(await page.evaluate(() => App.tester()) === 'pawelk', 'znacznik zostaje po ponownym otwarciu');
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
