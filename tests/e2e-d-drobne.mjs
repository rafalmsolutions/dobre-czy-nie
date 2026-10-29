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
await page.click('[data-act=start-next]'); await page.waitForTimeout(150); await page.click('[data-act=start-next]'); await page.waitForTimeout(150);
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
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
