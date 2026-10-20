// Album odkryć (wersja D): odsłonięcie karty, punkty, pełna strona, szkic. Uruchom: node e2e-d-album.mjs (serwer na porcie 8790).
import { chromium } from 'playwright';
import { setup, C } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
const page = await ctx.newPage();
const closeCel = async () => { for (let i = 0; i < 8; i++) { if (await page.locator('#celebrate').isHidden()) return; await page.click('#celebrate [data-act=cel-ok]'); await page.waitForTimeout(120); } }; const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(c => {
  if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1');
  localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false }));
  const cards = {}; for (let i = 0; i < 9; i++) cards['590000000090' + i] = { c: '590000000090' + i, k: 'en:yogurts', r: i === 2 ? 'rzadka' : 'zwykla', h: i === 5, s: false, w: false, n: 'Jogurt testowy ' + (i + 1), b: 'Marka', i: '', sc: 500, t: Date.now() - 1e6 + i };
  localStorage.setItem('dcn-d-album', JSON.stringify({ cards, done: {}, weeks: {} }));
});
await page.goto('http://localhost:8790/d/index.html#/p/' + C.nutella); await page.waitForTimeout(1500);
ok(await page.locator('#reveal').isVisible(), 'po skanie: nakładka nowej karty');
await page.screenshot({ path: new URL('./shots/', import.meta.url).pathname + 'rv-back.png' });
await closeCel(); const pts0 = await page.evaluate(() => App.game.points);
await closeCel(); await page.click('[data-act=reveal-flip]', { force: true }); await page.waitForTimeout(300); await closeCel(); await page.waitForTimeout(900);
await page.screenshot({ path: new URL('./shots/', import.meta.url).pathname + 'rv-front.png' });
const pts1 = await page.evaluate(() => App.game.points);
ok(pts1 > pts0, `odsłonięcie daje punkty (${pts0} → ${pts1})`);
ok(await page.evaluate(c => !!App.album.cards[c], C.nutella), 'karta w albumie');
const dist = await page.evaluate(() => { const n = { zwykla: 0, rzadka: 0, epicka: 0 }; for (let i = 0; i < 4000; i++) n[App.cardRarity({ code: String(5900000100000 + i), scans: [0, 1, 3, 40][i % 4] })]++; return n; });
ok(dist.epicka > 160 && dist.epicka < 400 && dist.rzadka > 700 && dist.rzadka < 1100, `rzadkość: ok. 6% epickich i 23% rzadkich (${JSON.stringify(dist)})`);
ok(await page.evaluate(() => { let lo = 0, hi = 0; for (let i = 0; i < 3000; i++) { if (App.cardRarity({ code: String(5900000200000 + i), scans: 0 }) !== 'zwykla') lo++; if (App.cardRarity({ code: String(5900000200000 + i), scans: 500 }) !== 'zwykla') hi++; } return lo > hi; }), 'rzadko skanowane częściej dają rzadkie karty');
await page.click('.rv-btns [data-act=reveal-close]'); await page.waitForTimeout(300);
ok(!(await page.locator('#reveal').isVisible()), 'zamknięcie nakładki');
// ten sam produkt drugi raz: bez nakładki
await page.goto('http://localhost:8790/d/index.html#/'); await page.waitForTimeout(500);
await page.goto('http://localhost:8790/d/index.html#/p/' + C.nutella); await page.waitForTimeout(1200);
ok(!(await page.locator('#reveal').isVisible()), 'ponowny skan: bez nowej karty');
// 10. jogurt → pełna strona
await page.goto('http://localhost:8790/d/index.html#/p/' + C.milk); await page.waitForTimeout(1500);
await closeCel(); await page.click('[data-act=reveal-flip]', { force: true }); await page.waitForTimeout(300); await closeCel(); await page.waitForTimeout(800);
ok(await page.locator('[data-act=reveal-page]').count() === 1, 'dziesiąta karta: przycisk „Dalej” do pełnej strony');
await closeCel(); await page.click('[data-act=reveal-page]'); await page.waitForTimeout(900);
await page.screenshot({ path: new URL('./shots/', import.meta.url).pathname + 'rv-page.png' });
ok((await page.innerText('#reveal')).toLowerCase().includes('ukończona'), 'gratulacje za pełną stronę');
ok(await page.evaluate(() => !!App.album.done['en:yogurts']), 'strona oznaczona jako pełna');
await page.click('#reveal [data-act=reveal-album]'); await page.waitForTimeout(700);
await page.screenshot({ path: new URL('./shots/', import.meta.url).pathname + 'al-page.png', fullPage: true });
ok((await page.innerText('#scr-albumpage')).toLowerCase().includes('jogurty'), 'strona albumu Jogurty');
ok(await page.locator('#scr-albumpage .gal.full .gal-t.open').count() === 10, 'Galeria: pełna strona Jogurty = obraz odsłonięty w całości');
await page.goto('http://localhost:8790/d/index.html#/album'); await page.waitForTimeout(700);
await page.screenshot({ path: new URL('./shots/', import.meta.url).pathname + 'al.png', fullPage: true });
ok((await page.innerText('#scr-album')).includes('KARTA TYGODNIA'), 'album z kartą tygodnia');
await page.goto('http://localhost:8790/d/index.html#/'); await page.waitForTimeout(700);
await page.screenshot({ path: new URL('./shots/', import.meta.url).pathname + 'al-home.png' });
// szkic
await page.goto('http://localhost:8790/d/index.html#/p/' + C.msg); await page.waitForTimeout(1500);
await closeCel(); await page.click('[data-act=reveal-flip]', { force: true }); await page.waitForTimeout(300); await closeCel(); await page.waitForTimeout(800);
ok(await page.evaluate(c => App.album.cards[c] && App.album.cards[c].s === true, C.msg), 'produkt bez wartości: szkic');
await page.screenshot({ path: new URL('./shots/', import.meta.url).pathname + 'rv-sketch.png' });
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
