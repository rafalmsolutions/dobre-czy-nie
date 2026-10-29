// 3.0.11: Samsung/Android oddaje słowa jako osobne końcowe wyniki – łączymy je do pauzy; edycja nazwy wpisanej rzeczy.
import { chromium } from 'playwright';
import fs from 'fs';
import { setup } from './lib.mjs';
import { fileURLToPath } from 'url';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
await ctx.route(/\/config\.js$/, r => { const body = fs.readFileSync(new URL('../app/config.js', import.meta.url), 'utf8').replace(/goatcounter: '[^']*'/, "goatcounter: ''"); r.fulfill({ body, contentType: 'text/javascript' }); });
const page = await ctx.newPage(); page.on('pageerror', e => console.log('ERR', e.message));
await page.addInitScript(() => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false })); });
await page.addInitScript(() => {
  delete window.SpeechRecognition; window.SpeechRecognition = undefined; window.__speech = [];
  window.webkitSpeechRecognition = class { start() { this.t = []; const steps = window.__speech.shift() || [];
    steps.forEach(st => this.t.push(setTimeout(() => { if (st.end) { this.end(); return; } const results = st.results.map(([t, f]) => Object.assign([{ transcript: t }], { isFinal: !!f })); this.onresult && this.onresult({ results, resultIndex: st.index || 0 }); }, st.at))); }
    end() { if (this.ended) return; this.ended = true; this.t.forEach(clearTimeout); this.onend && this.onend(); } stop() { this.end(); } abort() { this.end(); } };
});
await page.goto('http://localhost:8790/app/index.html#/polki'); await page.waitForTimeout(1200);
await page.evaluate(() => { App.dictIdleMs = 3000; App.dictPauseMs = 400; });
const items = () => page.evaluate(() => App.shelves.shelves.find(s => s.id === App.shelves.active).items.map(i => i.name));
// Każde słowo jako osobny wynik końcowy (index rośnie), krótkie przerwy między słowami, potem dłuższa pauza i drugi produkt.
await page.evaluate(() => { window.__speech = [[
  { at: 50, results: [['herbata', true]] }, { at: 250, results: [['herbata', true], [' zielona', true]], index: 1 }, { at: 450, results: [['herbata', true], [' zielona', true], [' Teekanne', true]], index: 2 },
  { at: 1200, results: [['herbata', true], [' zielona', true], [' Teekanne', true], [' ogórki', true]], index: 3 }, { at: 1350, results: [['herbata', true], [' zielona', true], [' Teekanne', true], [' ogórki', true], [' kiszone', true]], index: 4 }]]; });
await page.click('#micBtn'); await page.waitForTimeout(600);
ok((await items()).length === 0 && /herbata zielona Teekanne/.test(await page.inputValue('#addItemInput')), 'w trakcie słowa czekają w polu, nic nie trafia na listę osobno');
await page.waitForTimeout(500);
ok((await items()).join('|') === 'herbata zielona Teekanne', 'po pauzie jedna pozycja: ' + (await items()).join('|'));
await page.waitForTimeout(1000);
ok((await items()).join('|') === 'herbata zielona Teekanne|ogórki kiszone', 'ogórki kiszone jako jedna pozycja: ' + (await items()).join('|'));
ok(await page.evaluate(() => document.getElementById('itemMsg').classList.contains('msg-info')), 'komunikat „Dodano…” jako informacja, nie błąd');
await page.click('#micBtn'); await page.waitForTimeout(300);
// Edycja nazwy: stuknięcie w nazwę otwiera pole nazwy, ilość i jednostkę.
await page.click('.t1-edit:has-text("herbata zielona Teekanne")'); await page.waitForTimeout(200);
ok(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'itemNameInput', 'stuknięcie w nazwę: fokus w polu nazwy');
await page.fill('#itemNameInput', 'herbata zielona'); await page.fill('#qtyInput', '2'); await page.click('#qtyForm button[type=submit]'); await page.waitForTimeout(200);
const it = await page.evaluate(() => App.shelves.shelves.find(s => s.id === App.shelves.active).items.find(i => i.name === 'herbata zielona'));
ok(it && it.qty === 2, 'nazwa i ilość zapisane razem');
await page.click('.t1-edit:has-text("herbata zielona")'); await page.fill('#itemNameInput', 'ogórki kiszone'); await page.click('#qtyForm button[type=submit]'); await page.waitForTimeout(200);
ok(/już jest na tej liście/.test(await page.innerText('#itemEditMsg')), 'zmiana na nazwę, która już jest: komunikat, bez duplikatu');
await page.fill('#itemNameInput', ''); await page.click('#qtyForm button[type=submit]'); await page.waitForTimeout(150);
ok(/Wpisz nazwę/.test(await page.innerText('#itemEditMsg')), 'pusta nazwa: komunikat');
await page.fill('#itemNameInput', 'jabłka'); await page.click('#qtyForm button[type=submit]'); await page.waitForTimeout(200);
ok(await page.evaluate(() => { const i = App.shelves.shelves.find(s => s.id === App.shelves.active).items.find(x => x.name === 'jabłka'); return i && i.dept === 'veg'; }), 'po zmianie nazwy dział liczy się od nowa (jabłka → warzywa i owoce)');
await page.screenshot({ path: fileURLToPath(new URL('./shots/', import.meta.url)) + 'edit-item.png' });
await b.close(); process.exit(bad ? 1 : 0);
