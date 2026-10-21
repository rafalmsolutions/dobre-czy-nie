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
await page.goto('http://localhost:8790/index.html#/'); await page.waitForTimeout(900);
ok(await page.locator('#hProf').innerText() === 'Twój profil', 'bez domowników: „Twój profil” jak dotąd');
ok(await page.locator('#scr-home .fam-home').count() === 0, 'bez domowników: bez listy rodziny');
ok(await page.locator('#boot').count() === 0, 'testy automatyczne: ekran ładowania od razu znika');

// Dwóch domowników: jeden z alergią, drugi bez ustawień.
await page.evaluate(() => { localStorage.setItem('dcn-d-family', JSON.stringify([{ id: 'f1', name: 'Kuba', p: { allergens: ['nuts'] } }, { id: 'f2', name: 'Ola', p: {} }])); });
await page.reload(); await page.waitForTimeout(900);
ok(await page.locator('#hProf').innerText() === 'Profile rodziny', 'z domownikami: nagłówek „Profile rodziny”');
const rows = await page.$$eval('#scr-home .fam-home-row', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
ok(rows.length === 3, 'trzy osoby: Ty, Kuba, Ola (' + rows.length + ')');
ok(/^Ty\b/.test(rows[0]) && /Cukier/i.test(rows[0]), 'Ty: to, czego pilnujesz ' + rows[0]);
ok(/Kuba/.test(rows[1]) && /orzech/i.test(rows[1]), 'Kuba: „Nie jem: orzechy” ' + rows[1]);
ok(/Ola/.test(rows[2]) && /Nic nie zaznaczono/.test(rows[2]), 'Ola: nic nie zaznaczono');
await page.$eval('#scr-home [data-act=prof-of][data-id=f1]', el => el.click()); await page.waitForTimeout(500);
ok(await page.evaluate(() => location.hash) === '#/profil', '„Zmień” przy Kubie otwiera profil');
ok(/Kuba/.test(await page.locator('#scr-profile h1').innerText()), 'profil otwiera się na Kubie');
ok(await page.locator('#scr-profile input[name=allergens][value=nuts]').isChecked(), 'u Kuby zaznaczone orzechy');

// Ekran ładowania z animacją dla zwykłej przeglądarki (bez znacznika testów automatycznych).
const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push(e.message));
await p2.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); });
await p2.goto('http://localhost:8790/index.html#/'); await p2.waitForTimeout(500);
ok(await p2.locator('#boot').count() === 1 && await p2.locator('#boot .lp-ring').count() === 1, 'ekran ładowania z animowanym znakiem widoczny na starcie');
ok(await p2.evaluate(() => getComputedStyle(document.getElementById('boot')).position) === 'fixed', 'ekran ładowania przykrywa aplikację');
await p2.waitForTimeout(1800);
ok(await p2.locator('#boot').count() === 0, 'po animacji ekran ładowania znika sam');
await p2.reload(); await p2.waitForTimeout(300);
await p2.locator('#boot').click(); await p2.waitForTimeout(400);
ok(await p2.locator('#boot').count() === 0, 'stuknięcie pomija animację');
const p3 = await (await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' })).newPage();
await p3.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); localStorage.setItem('dcn-onboarded', 'true'); });
await p3.goto('http://localhost:8790/index.html#/'); await p3.waitForTimeout(600);
ok(await p3.locator('#boot').count() === 0, '„ogranicz animacje”: bez czekania');
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
