// Lista zakupów 2.8.0: dyktowanie (rozbijanie wypowiedzi, przycisk mikrofonu), podpowiedzi podczas pisania,
// zamiana ogólnej pozycji („mleko”) na zeskanowany produkt z „Cofnij”. Uruchom: node e2e-d-lista.mjs (serwer na porcie 8790).
import { chromium } from 'playwright';
import fs from 'fs';
import { setup, C } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const URL0 = 'http://localhost:8790/app/index.html';
async function newPage(fakeSpeech) {
  // Chromium ma własne rozpoznawanie mowy: bez fakeSpeech usuwamy je, żeby sprawdzić przeglądarkę bez tego API.
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
  await ctx.route(/\/config\.js$/, r => { const body = fs.readFileSync(new URL('../app/config.js', import.meta.url), 'utf8').replace(/goatcounter: '[^']*'/, "goatcounter: ''"); r.fulfill({ body, contentType: 'text/javascript' }); });
  const page = await ctx.newPage(); page.errs = []; page.on('pageerror', e => page.errs.push(e.message));
  await page.addInitScript(() => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1');
    localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false })); });
  if (!fakeSpeech) await page.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; });
  if (fakeSpeech) await page.addInitScript(said => {
    delete window.SpeechRecognition; window.SpeechRecognition = undefined;
    // Udawane rozpoznawanie mowy: najpierw wynik pośredni, potem końcowy.
    window.webkitSpeechRecognition = class { start() { window.__rec = this; setTimeout(() => { this.onresult && this.onresult({ results: [Object.assign([{ transcript: said.slice(0, 5) }], { isFinal: false })] }); window.__interim = document.getElementById('addItemInput').value; }, 50);
      setTimeout(() => { this.onresult && this.onresult({ results: [Object.assign([{ transcript: said }], { isFinal: true })] }); this.onend && this.onend(); }, 150); } stop() { this.onend && this.onend(); } abort() { } };
  }, fakeSpeech);
  return page;
}
const closeCel = async page => { for (let i = 0; i < 10; i++) { if (await page.locator('#celebrate').isHidden().catch(() => true)) return; await page.click('#celebrate [data-act=cel-ok]').catch(() => {}); await page.waitForTimeout(120); } };
const go = async (page, h) => { await page.goto(URL0 + h); await page.waitForTimeout(1300); await closeCel(page); if (await page.locator('#reveal').isVisible().catch(() => false)) await page.click('#reveal [data-act=reveal-close]'); };
const add = async (page, t) => { await page.fill('#addItemInput', t); await page.press('#addItemInput', 'Enter'); await page.waitForTimeout(150); };
const items = page => page.evaluate(() => App.shelves.shelves.find(s => s.id === App.shelves.active).items.map(i => ({ name: i.name, code: i.code, qty: i.qty, unit: i.unit, checked: i.checked, dept: i.dept })));

// 1. Dyktowanie: rozbijanie wypowiedzi (funkcja czysta, bez mikrofonu)
let page = await newPage();
await go(page, '#/polki');
const sp = await page.evaluate(() => [Shelf.splitSpeech('mleko, chleb i dwa jogurty'), Shelf.splitSpeech('2 kg ziemniaki oraz masło'), Shelf.splitSpeech('pół kilo marchewki a także trzy jabłka')]);
ok(sp[0].length === 3 && sp[0].map(x => x.name).join('|') === 'mleko|chleb|jogurty' && sp[0][2].qty === 2, '„mleko, chleb i dwa jogurty” → 3 pozycje, jogurty ×2');
ok(sp[1].length === 2 && sp[1][0].name === 'ziemniaki' && sp[1][0].qty === 2 && sp[1][0].unit === 'kg' && sp[1][1].name === 'masło', '„2 kg ziemniaki oraz masło” → 2 pozycje, 2 kg');
ok(sp[2].length === 2 && sp[2][0].qty === 0.5 && sp[2][0].unit === 'kg' && sp[2][1].qty === 3, '„pół kilo …” i „a także” → 0,5 kg i 3 szt.');
ok(await page.locator('#micBtn').count() === 0, 'bez rozpoznawania mowy w przeglądarce nie ma przycisku mikrofonu');
const errs1 = page.errs; await page.context().close();

// Udawany mikrofon: wynik trafia na półkę, z działem i ilością
page = await newPage('mleko, chleb i dwa jogurty');
await go(page, '#/polki');
ok(await page.locator('#micBtn').count() === 1, 'z rozpoznawaniem mowy jest przycisk mikrofonu');
await page.click('#micBtn'); await page.waitForTimeout(500);
let it = await items(page);
ok(await page.evaluate(() => window.__interim) === 'mleko', 'wynik pośredni widać w polu podczas mówienia');
ok(it.length === 3 && it.find(i => i.name === 'jogurty' && i.qty === 2) && it.find(i => i.name === 'mleko').dept !== 'other', 'dyktowanie: 3 rzeczy na półce, jogurty ×2, mleko w swoim dziale (' + JSON.stringify(it) + ')');
ok(/Dodano 3 rzeczy: mleko, chleb, jogurty ×2/.test(await page.innerText('#itemMsg')), 'komunikat „Dodano 3 rzeczy: …” (' + await page.innerText('#itemMsg') + ')');
ok(await page.inputValue('#addItemInput') === '', 'pole wyczyszczone po dodaniu');
await page.evaluate(() => { window.webkitSpeechRecognition.prototype.start = function () { setTimeout(() => { this.onerror && this.onerror({ error: 'not-allowed' }); this.onend && this.onend(); }, 30); }; });
await page.click('#micBtn'); await page.waitForTimeout(200);
ok(/zgody na mikrofon/.test(await page.innerText('#itemMsg')) && await page.isEnabled('#addItemInput'), 'brak zgody na mikrofon: krótki komunikat, pole działa');
const errs2 = page.errs; await page.context().close();

// 2. Podpowiedzi podczas pisania
page = await newPage();
await go(page, '#/p/' + C.milk);
await page.click('[data-act=fav-toggle]'); await page.waitForTimeout(150);
await page.evaluate(() => App.store.set('d-bought', { 'n:jogurt pitny': { name: 'jogurt pitny', code: null, n: 3, at: Date.now() }, 'n:chleb': { name: 'chleb', code: null, n: 2, at: Date.now() } }));
await go(page, '#/polki');
await page.locator('#addItemInput').pressSequentially('j'); await page.waitForTimeout(100);
ok(await page.locator('#addSuggest').isHidden(), 'jedna litera: bez podpowiedzi');
await page.locator('#addItemInput').pressSequentially('og'); await page.waitForTimeout(150);
const sugs = await page.locator('#addSuggest [role=option]').allInnerTexts();
ok(sugs.length === 2 && /♥/.test(sugs[0]) && /Jogurt naturalny/.test(sugs[0]) && /↻/.test(sugs[1]), '„jog”: najpierw ulubiony jogurt z ♥, potem często kupowany ↻ (' + sugs.join(' / ') + ')');
ok(await page.getAttribute('#addItemInput', 'aria-expanded') === 'true', 'pole ogłasza rozwiniętą listę');
await page.press('#addItemInput', 'ArrowDown'); await page.waitForTimeout(50);
ok(await page.getAttribute('#addItemInput', 'aria-activedescendant') === 'sug-0' && await page.getAttribute('#sug-0', 'aria-selected') === 'true', 'strzałka w dół zaznacza pierwszą podpowiedź');
await page.press('#addItemInput', 'Escape'); await page.waitForTimeout(50);
ok(await page.locator('#addSuggest').isHidden(), 'Escape zamyka listę');
await page.fill('#addItemInput', ''); await page.locator('#addItemInput').pressSequentially('jog'); await page.waitForTimeout(150);
await page.click('#sug-0'); await page.waitForTimeout(200);
it = await items(page);
ok(it.length === 1 && it[0].code === C.milk && it[0].name === 'Jogurt naturalny', 'stuknięcie w podpowiedź dodaje produkt z kodem');
await page.locator('#addItemInput').pressSequentially('jog'); await page.waitForTimeout(150);
ok(!(await page.locator('#addSuggest [role=option]').allInnerTexts()).some(t => /Jogurt naturalny/.test(t)), 'to, co już leży na półce, nie jest podpowiadane');
await page.fill('#addItemInput', 'chl'); await page.locator('#addItemInput').press('Enter'); await page.waitForTimeout(150);
it = await items(page);
ok(it.some(i => i.name === 'chl' && !i.code), 'Enter bez wyboru dodaje pozycję ogólną, jak dotąd');
await page.locator('#addItemInput').pressSequentially('chle'); await page.waitForTimeout(100);
await page.press('#addItemInput', 'ArrowDown'); await page.press('#addItemInput', 'Enter'); await page.waitForTimeout(150);
it = await items(page);
ok(it.some(i => i.name === 'chleb'), 'strzałka + Enter dodaje wybraną podpowiedź');
const errs3 = page.errs; await page.context().close();

// 3. Zamiana ogólnej pozycji na zeskanowany produkt
page = await newPage();
await go(page, '#/polki');
for (const t of ['2 l mleko', 'chleb', 'jogurt']) await add(page, t);
await page.evaluate(() => App.addToShelf({ code: '5900000000999', name: 'Mleko 2%', categories: ['en:dairies', 'en:milks'] }, { pct: 80 }));
await page.waitForTimeout(250);
it = await items(page);
ok(it.length === 3 && it[0].code === '5900000000999' && it[0].name === 'Mleko 2%' && it[0].checked && it[0].qty === 2 && it[0].unit === 'l' && !it.some(i => i.name === 'mleko'), '„mleko” zamienione na „Mleko 2%”: ta sama ilość i miejsce, w koszyku (' + JSON.stringify(it[0]) + ')');
const toast = await page.innerText('#toast');
ok(/Zamieniono „mleko” na Mleko 2% · w koszyku/.test(toast) && /Cofnij/.test(toast), 'komunikat o zamianie z „Cofnij” (' + toast + ')');
ok(await page.evaluate(() => (App.store.get('d-bought', {})['5900000000999'] || {}).n === 1), 'produkt zapisany w „często kupujesz”');
ok(await page.locator('#boughtBox .sitem:has-text("Mleko 2%")').count() === 1, 'półka przerysowana: produkt w „W koszyku”');
await page.click('#toast [data-act=undo-generic]'); await page.waitForTimeout(200);
it = await items(page);
ok(it.length === 3 && it[0].name === 'mleko' && !it[0].code && !it[0].checked && it[0].qty === 2 && !it.some(i => i.code === '5900000000999'), '„Cofnij” przywraca „mleko” (nieodhaczone) i usuwa produkt');
ok(await page.evaluate(() => !App.store.get('d-bought', {})['5900000000999']), 'cofnięcie usuwa wpis z „często kupujesz”');
// Przez ekran produktu: „jogurt” (kategoria) ↔ Jogurt naturalny
await go(page, '#/p/' + C.milk);
await page.click('#scr-product [data-act=shelf-add]'); await page.waitForTimeout(250);
it = await items(page);
ok(it.find(i => i.code === C.milk && i.checked) && !it.some(i => i.name === 'jogurt'), 'ekran produktu „Na półkę”: „jogurt” zamieniony na „Jogurt naturalny”');
// Niepasujący produkt: nowa pozycja
await page.evaluate(() => App.addToShelf({ code: '5900000000888', name: 'Ketchup łagodny', categories: ['en:ketchup'] }, null));
await page.waitForTimeout(150);
it = await items(page);
ok(it.length === 4 && it.find(i => i.code === '5900000000888' && !i.checked) && it.some(i => i.name === 'mleko') && it.some(i => i.name === 'chleb'), 'niepasujący produkt dodaje się jako nowa pozycja');
ok(![...errs1, ...errs2, ...errs3, ...page.errs].length, 'brak błędów JS ' + [...errs1, ...errs2, ...errs3, ...page.errs].join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
