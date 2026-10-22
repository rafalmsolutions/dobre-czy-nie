// Ekran główny i ekran ładowania (2.3.1): profile całej rodziny na „Dla Ciebie”, edycja profilu konkretnej osoby,
// animowany ekran ładowania trzymany do końca animacji (poza testami i „ogranicz animacje”). Uruchom: node e2e-d-home.mjs (serwer na porcie 8790).
import { chromium } from 'playwright';
import { setup } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => {
  if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1');
  localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false }));
  localStorage.setItem('dcn-d-profile', JSON.stringify({ watch: ['sugar'] }));
});
await page.goto('http://localhost:8790/app/index.html#/'); await page.waitForTimeout(900);
// 2.6.0: najpierw zakupy. Bez domowników jedna linijka „Pilnujesz: …”, bez historii duży przycisk „Skanuj”.
ok(/Pilnujesz:\s*cukier/i.test(await page.locator('#scr-home .who-solo').innerText()), 'bez domowników: „Pilnujesz: cukier” w jednej linijce');
ok(await page.locator('#scr-home .who-row').count() === 0, 'bez domowników: bez wiersza „Dla kogo dziś kupujesz?”');
ok(await page.locator('#scr-home .d-scanbtn').count() === 1 && await page.locator('#hHist').count() === 0, 'pierwsze wejście: duży „Skanuj”, bez pustej sekcji „Ostatnio sprawdzone”');
ok(await page.locator('#scr-home .d-prog').count() === 1 && await page.locator('#scr-home .level-card, #scr-home .al-week').count() === 0, 'nagrody w jednej karcie postępów');
ok(await page.locator('#homeCode').count() === 0, 'bez osobnej sekcji „Nie masz aparatu?” (kod wpisuje się w wyszukiwarkę)');
const order = await page.$$eval('#scr-home .wrap > *', l => l.map(e => e.id || e.className.split(' ')[0]));
ok(order.indexOf('homeSearch') > -1 && order.indexOf('homeSearch') < order.indexOf('panel'), 'szukaj nad nagrodami: ' + order.join(','));
ok(await page.locator('#boot').count() === 0, 'testy automatyczne: ekran ładowania od razu znika');

// Dwóch domowników: jeden z alergią, drugi bez ustawień. Plus historia: znika duży przycisk, „Ostatnio sprawdzone” wyżej.
await page.evaluate(() => { localStorage.setItem('dcn-d-family', JSON.stringify([{ id: 'f1', name: 'Kuba', p: { allergens: ['nuts'] } }, { id: 'f2', name: 'Ola', p: {} }]));
  localStorage.setItem('dcn-history', JSON.stringify([{ code: '3017620422003', name: 'Krem orzechowy', pct: 30, level: 'poor', t: Date.now() }])); });
await page.reload(); await page.waitForTimeout(900);
ok(await page.locator('#hProf').innerText() === 'Dla kogo dziś kupujesz?', 'z domownikami: „Dla kogo dziś kupujesz?”');
const rows = await page.$$eval('#scr-home .who-p', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
ok(rows.length === 3, 'trzy osoby w jednym wierszu: Ty, Kuba, Ola (' + rows.length + ')');
ok(/^R?\s*Ty\b/.test(rows[0].replace(/^T /, '')) && /cukier/i.test(rows[0]), 'Ty: to, czego pilnujesz ' + rows[0]);
ok(/Kuba/.test(rows[1]) && /✕ orzechy/i.test(rows[1]), 'Kuba: „✕ orzechy” ' + rows[1]);
ok(/Ola/.test(rows[2]) && /bez ustawień/.test(rows[2]), 'Ola: bez ustawień');
const h = await page.evaluate(() => { const y = id => document.getElementById(id).getBoundingClientRect().top; return { who: y('hProf'), hist: y('hHist'), best: y('hBest') }; });
ok(h.who < h.hist && h.hist < h.best && h.hist < 700, 'kolejność: dla kogo → ostatnio sprawdzone (na pierwszym ekranie) → najlepsze');
ok(await page.locator('#scr-home .d-scanbtn').count() === 0 && await page.locator('#scr-home .d-hi').count() === 1, 'z historią: powitanie zamiast dużego przycisku (skan na dolnym pasku)');
await page.click('#scr-home a[href="#/profil"]'); await page.waitForTimeout(500);
ok(await page.evaluate(() => location.hash) === '#/profil', '„Profile” otwiera zakładkę Profil (szczegóły każdej osoby)');

// Ekran ładowania z animacją dla zwykłej przeglądarki (bez znacznika testów automatycznych).
const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push(e.message));
await p2.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); });
await p2.goto('http://localhost:8790/app/index.html#/'); await p2.waitForTimeout(500);
ok(await p2.locator('#boot').count() === 1 && await p2.locator('#boot .lp-ring').count() === 1, 'ekran ładowania z animowanym znakiem widoczny na starcie');
ok(await p2.evaluate(() => getComputedStyle(document.getElementById('boot')).position) === 'fixed', 'ekran ładowania przykrywa aplikację');
await p2.waitForTimeout(1800);
ok(await p2.locator('#boot').count() === 0, 'po animacji ekran ładowania znika sam');
await p2.reload(); await p2.waitForTimeout(300);
await p2.locator('#boot').click(); await p2.waitForTimeout(400);
ok(await p2.locator('#boot').count() === 0, 'stuknięcie pomija animację');
const p3 = await (await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' })).newPage();
await p3.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); localStorage.setItem('dcn-onboarded', 'true'); });
await p3.goto('http://localhost:8790/app/index.html#/'); await p3.waitForTimeout(600);
ok(await p3.locator('#boot').count() === 0, '„ogranicz animacje”: bez czekania');
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
