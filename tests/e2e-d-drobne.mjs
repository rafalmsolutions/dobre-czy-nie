// 3.0.16: drobne poprawki z testu: błąd imienia znika, podpowiedź +10 pkt po kupieniu listy, odznaki ze stopniami, napoje roślinne,
// forma bezosobowa w skanerze, liczba produktów na liście kategorii, nazwy wyborów w pierwszym uruchomieniu dla czytnika ekranu.
import { chromium } from 'playwright';
import fs from 'fs';
import { setup, C, YOG } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
await ctx.route(/\/config\.js$/, r => { let body = fs.readFileSync(new URL('../app/config.js', import.meta.url), 'utf8'); body = body.replace(/offProxyUrl: '[^']*'/, "offProxyUrl: 'https://proxy.test/'").replace(/goatcounter: '[^']*'/, "goatcounter: ''"); r.fulfill({ body, contentType: 'text/javascript' }); });
// Kategoria jogurtów + jeden produkt bez danych do oceny (tylko nazwa).
const NODATA = { code: '5900000500004', product_name_pl: 'Jogurt bez danych', categories_hierarchy: ['en:yogurts'] };
await ctx.route(/proxy\.test\/(search|details)/, r => r.fulfill({ json: { ok: true, products: {} } }));
await ctx.route(/proxy\.test\/category/, r => r.fulfill({ json: { ok: true, products: YOG.concat([NODATA]) } }));
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
const go = async h => { await page.goto('http://localhost:8790/app/index.html' + h); await page.waitForTimeout(900); };

// 9. Pierwsze uruchomienie: wybory mają nazwy dla czytnika ekranu.
await go('#/start');
ok(await page.getByRole('radio', { name: /Tylko dla siebie/ }).count() === 1 && await page.getByRole('radio', { name: /Dla siebie i domowników/ }).count() === 1, 'krok 1: oba wybory mają nazwy dla czytnika ekranu');
await page.getByRole('radio', { name: /Dla siebie i domowników/ }).click(); await page.click('[data-act=start-next]'); await page.waitForTimeout(200);
ok(await page.getByRole('button', { name: /Mniej cukru/ }).count() === 1, 'krok 2: kafel celu ma nazwę („Mniej cukru: …”)');
// 1. „Nowa osoba”: błąd znika po wpisaniu imienia.
await page.click('[data-act=start-next]'); await page.waitForTimeout(150);
// 3.0.20: nazwy na liście jak diety („Bez laktozy”), a w podsumowaniu „✕ wieprzowina”.
const s3 = await page.innerText('#scr-start');
ok(/Bez wieprzowiny/.test(s3) && /Bez alkoholu/.test(s3) && !/\bWieprzowina\b|\bAlkohol\b/.test(s3), 'krok 3: „Bez wieprzowiny”, „Bez alkoholu”');
// 3.0.20: listy zwijane; w nagłówku podsumowanie zaznaczonych.
ok(await page.locator('#scr-start details.pf-fold[open]').count() === 2, 'krok 3: dwie zwijane listy, na start rozwinięte');
await page.locator('label.ck-row', { hasText: 'Bez wieprzowiny' }).click(); await page.waitForTimeout(100);
ok((await page.locator('#scr-start .pf-fold .fold-sum').nth(1).innerText()) === 'Bez wieprzowiny', 'podsumowanie listy po zaznaczeniu: „Bez wieprzowiny”');
await page.locator('#scr-start .pf-fold summary').first().click(); await page.waitForTimeout(100);
ok(await page.locator('#scr-start details.pf-fold[open]').count() === 1, 'stuknięcie w nagłówek zwija listę');
await page.click('[data-act=start-next]'); await page.waitForTimeout(150);
ok(/✕ wieprzowina/.test(await page.innerText('#scr-start')), 'krok 4: w podsumowaniu „✕ wieprzowina”');
await page.click('[data-act=start-person][data-i="new"]'); await page.waitForTimeout(150);
await page.click('[data-act=start-person-save]'); await page.waitForTimeout(100);
ok(await page.innerText('#obPMsg') === 'Wpisz imię albo pseudonim.', 'puste imię: komunikat');
await page.type('#obPName', 'Kuba'); await page.waitForTimeout(100);
ok(await page.innerText('#obPMsg') === '', 'po wpisaniu imienia komunikat znika');
await page.fill('#obPName', ''); await page.type('#obPName', ' '); await page.waitForTimeout(50);
await page.click('[data-act=start-person-save]'); await page.waitForTimeout(100);
ok(await page.innerText('#obPMsg') === 'Wpisz imię albo pseudonim.', 'same spacje: komunikat wraca przy zapisie');
await page.click('[data-act=start-skip]').catch(() => {}); await page.waitForTimeout(300);

// 5. Skaner: forma bezosobowa.
const cp = await page.evaluate(() => App.codeProblem('123'));
ok(/^Wpisano 3 cyfry\./.test(cp), 'kod za krótki: „' + cp + '”');

// 2. + 4. Lista: napój roślinny w „Napoje”, podpowiedź +10 pkt znika po odhaczeniu wszystkiego.
await go('#/polki');
for (const n of ['mleko owsiane', 'mleko', 'chleb']) { await page.fill('#addItemInput', n); await page.press('#addItemInput', 'Enter'); await page.waitForTimeout(150); }
const depts = await page.evaluate(() => App.shelves.shelves.find(s => s.id === App.shelves.active).items.map(i => i.name + ':' + i.dept));
ok(depts.includes('mleko owsiane:drinks') && depts.includes('mleko:dairy'), 'mleko owsiane → Napoje, mleko → Nabiał (' + depts.join(', ') + ')');
ok(/Napoje/.test(await page.innerText('#shelfItems')), 'na liście nagłówek działu „Napoje”');
ok(await page.locator('.shop-pts').count() === 1, 'lista z rzeczami do kupienia: podpowiedź widoczna');
for (let i = 0; i < 3; i++) { await page.locator('[data-act=item-toggle]').first().click(); await page.waitForTimeout(200); }
ok(await page.locator('#allBought').count() === 1 && await page.locator('.shop-pts').count() === 0, 'cała lista w koszyku: bez podpowiedzi „+10 pkt”');

// 3. Pasek odznak: kilka stopni tej samej odznaki → „Mój profil · brąz, srebro”.
await go('#/p/' + C.milk);
await page.evaluate(() => { App.pendingCard = null; App.celebrate([{ type: 'achievement', id: 'profil-1', name: 'Mój profil' }, { type: 'achievement', id: 'profil-2', name: 'Mój profil' }]); }); await page.waitForTimeout(400);
const rw = (await page.innerText('#rwBar').catch(() => '')).replace(/\s+/g, ' ');
ok(/Nowe odznaki/.test(rw) && /Mój profil · brąz, srebro/.test(rw) && !/Mój profil, Mój profil/.test(rw), 'pasek odznak: „' + rw.slice(0, 60) + '”');
await page.evaluate(() => { App.dropCelebrations(); App.rewardBar(); });

// 8. Lista kategorii: ta sama liczba na przycisku sklepu i w zdaniu, pominięte nazwane wprost.
await go('#/lista/en:yogurts'); await page.waitForTimeout(1500);
const sw = await page.innerText('.store-sw').catch(() => ''), txt = await page.innerText('#listBody').catch(() => '');
const nBtn = (sw.match(/(\d+) produkt/) || [])[1], nTxt = (txt.match(/sprawdziliśmy (\d+) produkt/i) || [])[1];
ok(nBtn && nBtn === nTxt, `liczba na przycisku (${nBtn}) = liczba w zdaniu (${nTxt})`);
ok(/1 pominęliśmy – za mało danych/.test(txt), 'produkt bez danych nazwany jako pominięty');
// 3.0.17 (11): komunikat o limicie celów w stopce nad „Dalej”, widoczny bez przewijania.
await page.evaluate(() => localStorage.removeItem('dcn-onboarded'));
await go('#/start'); await page.reload(); await page.waitForTimeout(800); // pełne przeładowanie: nowy szkic startu
await page.click('[data-act=start-next]'); await page.waitForTimeout(200);
ok(await page.locator('#startMsg').isHidden(), 'krok 2 bez nadmiaru: komunikat ukryty');
for (const k of await page.$$eval('[data-act=goal]', l => l.slice(0, 4).map(e => e.dataset.k))) { await page.click(`[data-act=goal][data-k="${k}"]`); await page.waitForTimeout(120); }
const lim = await page.evaluate(() => { const m = document.getElementById('startMsg'), r = m.getBoundingClientRect(); return { t: m.textContent, inFoot: !!m.closest('.ob-foot'), vis: r.top >= 0 && r.bottom <= innerHeight && !m.hidden }; });
ok(/najwyżej 3 cele/.test(lim.t) && lim.inFoot && lim.vis, 'czwarty cel: komunikat nad „Dalej”, na ekranie (' + JSON.stringify(lim) + ')');
const g0 = (await page.$$eval('[data-act=goal][aria-pressed=true]', l => l.map(e => e.dataset.k)))[0];
await page.click(`[data-act=goal][data-k="${g0}"]`); await page.waitForTimeout(120);
ok(await page.locator('#startMsg').isHidden(), 'po odznaczeniu celu komunikat znika');

// 3.0.20: Profil → Wykluczenia: lista z zaznaczeniami zwinięta (podsumowanie w nagłówku), pusta rozwinięta; zapis działa ze zwiniętej.
await page.evaluate(() => { localStorage.setItem('dcn-onboarded', 'true'); App.profile = cleanProfile({ allergens: ['nuts'] }); App.saveProfile(); });
await go('#/profil/wykluczenia'); await page.reload(); await page.waitForTimeout(900);
for (let i = 0; i < 10; i++) { if (await page.locator('#celebrate').isHidden()) break; await page.$eval('#celebrate [data-act=cel-ok]', e => e.click()); await page.waitForTimeout(150); }
const folds = await page.$$eval('#scr-profile .pf-excl details.pf-fold', l => l.map(d => [d.open, d.querySelector('.fold-sum').textContent]));
ok(folds.length === 3 && folds[0][0] === false && folds[0][1] === 'Orzechy' && folds[1][0] === true && folds[1][1] === 'nic nie zaznaczono' && folds[2][0] === false, 'wykluczenia (alergeny, dieta, słodziki): ' + JSON.stringify(folds));
await page.locator('#scr-profile .pf-fold summary').nth(2).click(); await page.waitForTimeout(100);
await page.locator('#scr-profile label.ck-row', { hasText: 'Erytrytol' }).click(); await page.waitForTimeout(700);
ok(await page.evaluate(() => App.profile.avoid.includes('sw-erythritol')) && (await page.locator('#scr-profile .pf-fold .fold-sum').nth(2).innerText()) === 'Erytrytol', '3.0.23: słodzik „Erytrytol” zapisany, podsumowanie listy');await page.locator('#scr-profile label.ck-row', { hasText: 'Bez alkoholu' }).click(); await page.waitForTimeout(700);
ok(await page.evaluate(() => App.profile.avoid.includes('alcohol')) && (await page.locator('#scr-profile .pf-fold .fold-sum').nth(1).innerText()) === 'Bez alkoholu', 'zaznaczenie zapisane, podsumowanie „Bez alkoholu”');

const exclTxt = await page.textContent('#scr-profile .pf-excl'); // textContent: lista alergenów jest tu zwinięta
ok(/alergia: także „może zawierać”/.test(exclTxt) && /bez „może zawierać”/.test(exclTxt), '3.0.22: wyjaśnienie różnicy alergen „Mleko” / dieta „Bez mleka i przetworów”');

// 3.0.17 (10): kafle kategorii na 375 px – nazwa nie nachodzi na strzałkę.
await page.setViewportSize({ width: 375, height: 812 });
await page.evaluate(() => localStorage.setItem('dcn-onboarded', 'true'));
await go('#/najlepsze');
const over = await page.evaluate(() => [...document.querySelectorAll('.cat-link')].filter(a => { const g = a.querySelector('.grow'), r = a.querySelector('.arr'); return g.scrollWidth > g.clientWidth + 1 || g.getBoundingClientRect().right > r.getBoundingClientRect().left + 1; }).map(a => a.textContent.trim()));
ok(!over.length, '375 px: żadna nazwa kategorii nie nachodzi na strzałkę (' + (over.join(', ') || 'brak') + ')');
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
