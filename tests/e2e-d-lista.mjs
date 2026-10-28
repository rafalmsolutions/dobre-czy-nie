// Lista zakupów 2.8.0–2.8.2: dyktowanie (rozbijanie wypowiedzi także bez przecinków, ciągłe słuchanie z pauzami, przycisk mikrofonu), podpowiedzi podczas pisania,
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
  if (fakeSpeech) await page.addInitScript(() => {
    delete window.SpeechRecognition; window.SpeechRecognition = undefined;
    // Udawane rozpoznawanie mowy. window.__speech: kolejka sesji (jedna na każde start()), każda to lista kroków:
    // { at: ms, results: [[tekst, końcowy?], …], index } – zdarzenie wyniku; { at, end: true } – przeglądarka sama kończy; { at, error }.
    window.__speech = []; window.__starts = 0;
    window.webkitSpeechRecognition = class {
      start() { window.__starts++; window.__rec = this; this.timers = []; const steps = window.__speech.shift() || [];
        steps.forEach(st => this.timers.push(setTimeout(() => {
          if (st.end) { this.end(); return; }
          if (st.error) { this.onerror && this.onerror({ error: st.error }); if (st.error !== 'no-speech') this.end(); return; }
          const results = st.results.map(([t, f]) => Object.assign([{ transcript: t }], { isFinal: !!f }));
          this.onresult && this.onresult({ results, resultIndex: st.index || 0 });
          (window.__inputs = window.__inputs || []).push(document.getElementById('addItemInput') && document.getElementById('addItemInput').value);
        }, st.at))); }
      end() { if (this.ended) return; this.ended = true; this.timers.forEach(clearTimeout); this.onend && this.onend(); }
      stop() { setTimeout(() => this.end(), 30); }
      abort() { this.end(); }
    };
  });
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
const sp2 = await page.evaluate(() => ['pomidory ziemniaki banany', 'chleb żytni masło orzechowe', 'pasta do zębów płyn do naczyń', 'mleko 2 litry chleb', 'mleko przecinek chleb'].map(t => Shelf.splitSpeech(t).map(x => x.name + (x.qty !== 1 || x.unit !== 'szt' ? ' ' + x.qty + x.unit : '')).join('|')));
ok(sp2.join(' / ') === 'pomidory|ziemniaki|banany / chleb żytni|masło orzechowe / pasta do zębów|płyn do naczyń / mleko 2l|chleb / mleko|chleb', 'bez przecinków: dzielimy po nazwach produktów, nie po przymiotnikach i przyimkach (' + sp2.join(' / ') + ')');
ok(await page.locator('#micBtn').count() === 0, 'bez rozpoznawania mowy w przeglądarce nie ma przycisku mikrofonu');
const errs1 = page.errs; await page.context().close();

// Udawany mikrofon
page = await newPage(true);
await go(page, '#/polki');
await page.evaluate(() => { App.dictIdleMs = 900; });
ok(await page.locator('#micBtn').count() === 1, 'z rozpoznawaniem mowy jest przycisk mikrofonu');
const speak = sessions => page.evaluate(x => { window.__speech = x; window.__starts = 0; }, sessions);
const msg = () => page.innerText('#itemMsg');
// a) Bez przecinków („pomidory ziemniaki banany”), przeglądarka sama kończy po pauzie → słuchamy dalej, koniec po ciszy
await speak([[{ at: 50, results: [['pomidory ziem', false]] }, { at: 120, results: [['pomidory ziemniaki banany', true]] }, { at: 200, end: true }], [{ at: 300, error: 'no-speech' }]]);
await page.click('#micBtn'); await page.waitForTimeout(100);
ok(await page.evaluate(() => (window.__inputs || []).includes('pomidory ziem')), 'wynik pośredni widać w polu podczas mówienia');
await page.waitForTimeout(250);
let it = await items(page);
ok(it.map(i => i.name).join('|') === 'pomidory|ziemniaki|banany' && it.every(i => i.dept === 'veg'), '„pomidory ziemniaki banany” bez przecinków → 3 pozycje w warzywach (' + it.map(i => i.name).join('|') + ')');
ok(await page.getAttribute('#micBtn', 'aria-pressed') === 'true' && await page.evaluate(() => window.__starts) === 2, 'po pauzie przeglądarka skończyła, a my słuchamy dalej (wznowione rozpoznawanie)');
ok(/Słucham dalej/.test(await msg()), 'w trakcie: „Słucham dalej… Stuknij mikrofon, gdy skończysz.”');
await page.waitForTimeout(1100);
ok(await page.getAttribute('#micBtn', 'aria-pressed') === 'false' && /Dodano 3 rzeczy: pomidory, ziemniaki, banany\./.test(await msg()), 'po ciszy koniec słuchania i podsumowanie (' + await msg() + ')');
ok(await page.inputValue('#addItemInput') === '', 'pole wyczyszczone po dodaniu');
// b) Pauzy między produktami: każdy fragment od razu na półce; koniec stuknięciem
await page.evaluate(() => { const st = App.shelves; st.shelves[0].items = []; App.saveShelves(); App.render(); }); await page.waitForTimeout(150);
await speak([[{ at: 50, results: [['mleko', true]] }, { at: 400, results: [['mleko', true], [' chleb żytni', true]], index: 1 }, { at: 500, end: true }], [{ at: 100, results: [['dwa jogurty naturalne', true]] }]]);
await page.click('#micBtn'); await page.waitForTimeout(200);
ok((await items(page)).map(i => i.name).join('|') === 'mleko', 'pierwszy produkt na półce od razu, w trakcie mówienia');
await page.waitForTimeout(600);
await page.click('#micBtn'); await page.waitForTimeout(200);
it = await items(page);
ok(it.map(i => i.name).join('|') === 'mleko|chleb żytni|jogurty naturalne' && it[2].qty === 2, 'z pauzami: mleko, chleb żytni, jogurty naturalne ×2 (' + it.map(i => i.name + '×' + i.qty).join('|') + ')');
ok(await page.getAttribute('#micBtn', 'aria-pressed') === 'false' && /Dodano 3 rzeczy/.test(await msg()), 'stuknięcie mikrofonu kończy dyktowanie');
// c) Android powtarza wcześniejsze słowa w kolejnym wyniku
await speak([[{ at: 50, results: [['masło', true]] }, { at: 150, results: [['masło', true], ['masło ser żółty', true]], index: 1 }, { at: 250, results: [['masło', true], ['masło ser żółty', true], ['masło ser żółty', true]], index: 2 }]]);
await page.click('#micBtn'); await page.waitForTimeout(400); await page.click('#micBtn'); await page.waitForTimeout(200);
it = await items(page);
ok(it.filter(i => i.name === 'masło').length === 1 && it.filter(i => i.name === 'ser żółty').length === 1 && it.length === 5, 'powtórzone słowa (Android) nie dodają rzeczy dwa razy (' + it.map(i => i.name).join('|') + ')');
// d) Cisza od początku
await speak([[{ at: 100, error: 'no-speech' }, { at: 150, end: true }], [], []]);
await page.click('#micBtn'); await page.waitForTimeout(1300);
ok(/Nic nie usłyszeliśmy/.test(await msg()) && await page.getAttribute('#micBtn', 'aria-pressed') === 'false', 'bez słów: po ciszy komunikat „Nic nie usłyszeliśmy”');
// e) Brak zgody na mikrofon
await speak([[{ at: 30, error: 'not-allowed' }]]);
await page.click('#micBtn'); await page.waitForTimeout(200);
ok(/zgody na mikrofon/.test(await msg()) && await page.isEnabled('#addItemInput') && await page.getAttribute('#micBtn', 'aria-pressed') === 'false', 'brak zgody na mikrofon: krótki komunikat, pole działa');
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
