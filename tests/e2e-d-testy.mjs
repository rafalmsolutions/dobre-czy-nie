// Faza testów (3.0.34): karta „Zaproś do testów” w Profilu, odznaki testerów (Pionier Lupki, Ambasador testów, Głos testera),
// koniec testów (CONFIG.testPhaseUntil) chowa kartę i niezdobyte odznaki. Uruchom: node e2e-d-testy.mjs (serwer na porcie 8790).
import { chromium } from 'playwright';
import fs from 'fs';
import { setup } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const BASE = 'http://localhost:8790/app/index.html';
async function newPage({ until = '2099-12-31', share = 'ok', seed = {} } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
  await ctx.route(/\/app\/config\.js(\?.*)?$/, r => { const body = fs.readFileSync(new URL('../app/config.js', import.meta.url), 'utf8').replace(/testPhaseUntil: '[^']*'/, `testPhaseUntil: '${until}'`).replace(/goatcounter: '[^']*'/, "goatcounter: ''"); r.fulfill({ body, contentType: 'text/javascript' }); });
  const page = await ctx.newPage(); page.errs = []; page.on('pageerror', e => page.errs.push(e.message));
  await page.addInitScript(([share, seed]) => {
    if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-d-perm-asked', 'true'); for (const [k, v] of Object.entries(seed)) localStorage.setItem('dcn-' + k, JSON.stringify(v)); }
    window.__shared = [];
    navigator.share = async d => { if (window.__shareMode === 'abort' || (!window.__shareMode && share === 'abort')) throw new DOMException('x', 'AbortError'); window.__shared.push(d); };
  }, [share, seed]);
  return page;
}
const closeCel = async page => { const names = []; for (let i = 0; i < 10; i++) { if (await page.locator('#celebrate').isHidden().catch(() => true)) break; names.push(await page.innerText('#celHead').catch(() => '')); await page.click('#celebrate [data-act=cel-ok]').catch(() => {}); await page.waitForTimeout(150); } return names; };
const go = async (page, h) => { await page.goto(BASE + h); await page.waitForTimeout(1500); return closeCel(page); };
const game = page => page.evaluate(() => ({ points: App.game.points, unlocked: Object.keys(App.game.unlocked || {}) }));

// 1. W czasie testów: Pionier Lupki po uruchomieniu
let page = await newPage();
let cel = await go(page, '#/');
let g = await game(page);
ok(g.unlocked.includes('pionier-3') && cel.some(c => /Pionier Lupki · złoto/.test(c)), 'w czasie testów: odznaka „Pionier Lupki · złoto” po uruchomieniu (' + cel.join(' | ') + ')');
ok(g.points >= 50, 'Pionier: +50 pkt');
// 2. Profil: karta zaproszenia i znaczek Pioniera
await go(page, '#/profil');
ok(await page.locator('.inv-card').count() === 1 && /Zaproś znajomych do testów/.test(await page.innerText('.inv-card')), 'Profil: karta „Zaproś znajomych do testów”');
ok(/0 z 1/.test(await page.innerText('.inv-prog')), 'postęp zaproszeń: 0 z 1');
ok(/Pionier Lupki · tester od \d\d\.\d{4}/.test(await page.innerText('.inv-pion')), 'znaczek „★ Pionier Lupki · tester od MM.RRRR”');
ok(await page.locator('.pf-index .feedback-link').count() === 1, 'Profil: „Wyślij uwagi o aplikacji” na liście');
// 3. Zaproszenie: okno udostępniania z tekstem i linkiem, odznaka Ambasador brąz
await page.click('[data-act=invite-tests]'); await page.waitForTimeout(500);
const shared = await page.evaluate(() => window.__shared);
ok(shared.length === 1 && /lupka\.app\/testuj/.test(shared[0].text) && /szukamy testerów/.test(shared[0].text), 'zaproszenie: tekst z linkiem lupka.app/testuj');
cel = await closeCel(page);
ok(cel.some(c => /Ambasador testów · brąz/.test(c)), 'po wysłaniu: „Ambasador testów · brąz” (' + cel.join(' | ') + ')');
ok(/1 z 3/.test(await page.innerText('.inv-prog')), 'postęp zaproszeń: 1 z 3');
// Drugie zaproszenie tego samego dnia nie liczy się drugi raz
await page.click('[data-act=invite-tests]'); await page.waitForTimeout(400); cel = await closeCel(page);
ok(!cel.length && /1 z 3/.test(await page.innerText('.inv-prog')) && await page.evaluate(() => App.store.get('d-invite-days', []).length) === 1, 'drugie zaproszenie tego dnia: bez nowej nagrody');
// Anulowane udostępnienie nic nie liczy
await page.evaluate(() => { App.store.set('d-invite-days', ['2026-10-01', '2026-10-02']); window.__shareMode = 'abort'; });
await page.click('[data-act=invite-tests]'); await page.waitForTimeout(400); cel = await closeCel(page);
ok(!cel.length && await page.evaluate(() => App.store.get('d-invite-days', []).length) === 2, 'anulowane udostępnienie: nic się nie liczy');
// Trzeci różny dzień → srebro
await page.evaluate(() => { window.__shareMode = ''; });
await page.click('[data-act=invite-tests]'); await page.waitForTimeout(500); cel = await closeCel(page);
ok(cel.some(c => /Ambasador testów · srebro/.test(c)), 'zaproszenia w 3 różne dni: srebro');
// 4. Głos testera: kliknięcie „Wyślij uwagi” (bez otwierania poczty w teście)
await page.evaluate(() => { const a = document.querySelector('.pf-index .feedback-link'); a.addEventListener('click', e => e.preventDefault()); a.click(); });
await page.waitForTimeout(700); cel = await closeCel(page);
ok(cel.some(c => /Głos testera · brąz/.test(c)), '„Wyślij uwagi”: Głos testera · brąz');
// 5. Odznaki: kategoria „Testy”
await go(page, '#/postepy');
ok(await page.locator('[data-act=ach-cat][data-cat=testy]').count() === 1, 'Odznaki: kategoria „Testy”');
await page.click('[data-act=ach-cat][data-cat=testy]'); await page.waitForTimeout(200);
const medals = await page.locator('#medals .medal-btn').allInnerTexts();
ok(medals.length === 3 && /Pionier Lupki[\s\S]*Złoto/.test(medals.join('|')) && /Ambasador testów[\s\S]*Srebro/.test(medals.join('|')) && /Głos testera[\s\S]*Brąz/.test(medals.join('|')), 'Testy: Pionier (złoto), Ambasador (srebro), Głos testera (brąz) (' + medals.map(m => m.replace(/\n/g, ' ')).join(' / ') + ')');
ok(/Głos testera|Ambasador testów|Pionier Lupki/.test(await page.innerText('#achDetail')), 'po wyborze „Testy” szczegóły pokazują odznakę z tej kategorii');
await page.click('[data-act=ach-pick][data-id=pionier]'); await page.waitForTimeout(200);
ok(/Tylko w czasie testów/.test(await page.innerText('#achDetail')), 'szczegóły odznaki testów: „Tylko w czasie testów”');
// 6. Tryb „Ukryj punkty i nagrody”: bez postępu i znaczka na karcie
await page.evaluate(() => { App.settings.shopMode = true; }); await go(page, '#/profil');
ok(await page.locator('.inv-card').count() === 1 && !(await page.locator('.inv-prog').count()) && !(await page.locator('.inv-pion').count()), 'tryb bez nagród: karta zostaje, bez postępu i znaczka');
ok(!page.errs.length, 'brak błędów JS ' + page.errs.join(' | '));
await page.context().close();

// 7. Przed ekranem powitalnym nie ma Pioniera (nowa osoba w trakcie wprowadzenia)
page = await newPage();
await page.addInitScript(() => { localStorage.removeItem('dcn-onboarded'); });
await page.goto(BASE + '#/'); await page.waitForTimeout(1500);
ok(!(await game(page)).unlocked.includes('pionier-3') && await page.locator('#celebrate').isHidden(), 'w trakcie ekranu powitalnego: bez odznaki i okienka');
await page.context().close();

// 8. Po zakończeniu testów
page = await newPage({ until: '2020-01-01' });
await go(page, '#/profil');
ok(!(await page.locator('.inv-card').count()) && !(await page.locator('.pf-index .feedback-link').count()), 'po testach: bez karty zaproszenia i dodatkowego „Wyślij uwagi”');
ok(!(await game(page)).unlocked.includes('pionier-3'), 'po testach: Pioniera nie da się zdobyć');
await go(page, '#/postepy');
ok(!(await page.locator('[data-act=ach-cat][data-cat=testy]').count()), 'po testach: bez kategorii „Testy”, gdy nic nie zdobyte');
await page.context().close();
// Zdobyta wcześniej odznaka zostaje jako pamiątka
page = await newPage({ until: '2020-01-01', seed: { game: { v: 1, points: 50, drops: 50, spent: 0, level: 1, counters: {}, sets: {}, days: {}, weeks: {}, months: {}, once: {}, unlocked: { 'pionier-3': Date.parse('2026-11-05') }, challenges: {}, inventory: {} } } });
await go(page, '#/postepy');
await page.click('[data-act=ach-cat][data-cat=testy]').catch(() => {}); await page.waitForTimeout(200);
const left = await page.locator('#medals .medal-btn').allInnerTexts();
ok(left.length === 1 && /Pionier Lupki/.test(left[0]), 'po testach: zdobyty Pionier zostaje jako pamiątka (' + left.map(m => m.replace(/\n/g, ' ')).join(' / ') + ')');
ok(!page.errs.length, 'brak błędów JS ' + page.errs.join(' | '));
await page.context().close();
await b.close(); process.exit(bad ? 1 : 0);
