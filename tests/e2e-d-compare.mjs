// Porównanie i wyszukiwanie (2.4.0). Uruchom: node e2e-d-compare.mjs (serwer na porcie 8790).
import { chromium } from 'playwright';
import { setup, YOG, C } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
const BYCODE = Object.fromEntries(YOG.map(y => [y.code, y]));
let searchCalls = 0, lastQ = '';
await ctx.route(/workers\.dev\/search/, r => { searchCalls++; const q = new URL(r.request().url()).searchParams.get('q'); lastQ = q;
  const list = /jogurt|skyr/.test(q) ? YOG.filter(y => /jogurt|skyr/i.test(y.product_name_pl)) : [];
  return r.fulfill({ json: { ok: true, q, count: list.length, products: list } }); });
await ctx.route(/workers\.dev\/details/, r => { const codes = new URL(r.request().url()).searchParams.get('codes').split(','); return r.fulfill({ json: { ok: true, products: Object.fromEntries(codes.map(c => [c, BYCODE[c] || null])), failed: 0 } }); });
await ctx.route(/workers\.dev\/category/, r => r.fulfill({ json: { ok: true, products: YOG } }));
await ctx.route(/openfoodfacts\.org\/api\/v2\/product\/(\d+)/, r => { const c = r.request().url().match(/product\/(\d+)/)[1]; if (BYCODE[c]) return r.fulfill({ json: { status: 1, product: BYCODE[c] } }); return r.fallback(); });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => {
  if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1');
  localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false }));
  localStorage.setItem('dcn-d-profile', JSON.stringify({ watch: ['sugar'] }));
  localStorage.setItem('dcn-d-family', JSON.stringify([{ id: 'f1', name: 'Kuba', p: { allergens: ['milk'] } }]));
});
const closeCel = async () => { for (let i = 0; i < 10; i++) { if (await page.locator('#celebrate').isHidden()) return; await page.$eval('#celebrate [data-act=cel-ok]', e => e.click()); await page.waitForTimeout(120); } };
await page.goto('http://localhost:8790/index.html#/'); await page.waitForTimeout(800); await closeCel();
ok(await page.locator('#homeSearch').count() === 1, 'ekran główny: pole „Szukaj produktu”');
await page.click('#homeSearch'); await page.waitForTimeout(400);
ok(await page.evaluate(() => location.hash) === '#/szukaj' && await page.locator('#srchQ').count() === 1, 'otwiera ekran wyszukiwania');
await page.fill('#srchQ', 'jogurt'); await page.waitForTimeout(1500);
const rows = await page.$$eval('#srchRes .srch-item', l => l.map(x => ({ n: x.querySelector('.t1').textContent, p: (x.querySelector('.pct') || {}).textContent, l: x.querySelector('.srch-lbl').textContent })));
ok(searchCalls === 1 && lastQ === 'jogurt', 'jedno zapytanie do pośrednika po chwili pisania (' + searchCalls + ')');
ok(rows.length >= 3, 'wyniki: ' + rows.map(r => r.n + ' ' + r.p).join(' | '));
ok(rows.length && /✕/.test(rows[rows.length - 1].p) && /Nie dla: Kuba/.test(rows[rows.length - 1].l), 'produkty z mlekiem (Kuba) na końcu z powodem');
ok(!/✕/.test(rows[0].p), 'pierwszy wynik pasuje wszystkim');
ok(await page.locator('#srchRes .srch-cats a[href="#/lista/en:yogurts"]').count() === 1, 'skrót do kategorii „Jogurty”');
ok(await page.evaluate(() => location.hash) === '#/szukaj/jogurt', 'zapytanie w adresie');
ok(!(await page.evaluate(() => window.__xss)), 'nazwy produktów bez wstrzykiwania HTML');
// ⇄ dodaje do porównania, pasek nad menu.
await page.$$eval('#srchRes [data-act=cmp-toggle]', l => l[0].click()); await page.waitForTimeout(200);
ok(await page.locator('#cmpBar').isVisible() && /1 produkt/.test(await page.innerText('#cmpBar')), 'pasek: „W porównaniu: 1 produkt”');
await page.$$eval('#srchRes [data-act=cmp-toggle]', l => l[1].click()); await page.waitForTimeout(200);
ok(/Porównujesz 2/.test(await page.innerText('#cmpBar')), 'pasek: „Porównujesz 2 produkty”');
await page.click('#cmpBar a[href="#/porownaj"]'); await page.waitForTimeout(500);
ok(await page.locator('#scr-compare .cmp-card').count() === 2, 'porównanie: dwie kolumny');
ok(await page.locator('#cmpBar').isHidden(), 'na ekranie porównania bez paska');
const verdict = await page.innerText('#scr-compare .cmp-verdict');
ok(/Lepszy wybór|Podobnie|Żaden|Za mało danych/.test(verdict), 'werdykt: ' + verdict.replace(/\n/g, ' · '));
ok(await page.locator('#scr-compare .cmp-who [data-who]').count() === 3, 'wybór osoby: Wszyscy, Ty, Kuba');
ok(/CO JE RÓŻNI/.test(await page.innerText('#scr-compare')) && /Cukier/.test(await page.innerText('#scr-compare')), 'tabela „Co je różni” z cukrem (Ty pilnujesz)');
ok(/Kuba: nie je/.test(await page.innerText('#scr-compare')), 'wiersz „Kuba: nie je”');
// Wynik kolumny = wynik z „Ostatnio sprawdzone”/listy (A.groupMatch).
const consistent = await page.evaluate(() => App.cmp.every(x => { const g = App.groupMatch(x.p, analyze(x.p)); const card = [...document.querySelectorAll('#scr-compare .cmp-card')].find(c => c.getAttribute('href') === '#/p/' + x.code); const t = card.querySelector('.cmp-badge b').textContent; return g.status === 'fail' ? t === '✕' : g.pct == null ? t === '?' : t === g.pct + '%'; }));
ok(consistent, 'wynik kolumny = wynik rodziny (ten sam co na liście i w historii)');
await page.click('#scr-compare [data-act=cmp-who][data-who=me]'); await page.waitForTimeout(200);
ok(await page.locator('#scr-compare .cmp-badge span').first().innerText() === 'dla Ciebie', 'po wyborze „Ty”: wynik dla Ciebie');
// Usuń jeden → zostaje 1, ekran prosi o drugi.
await page.$$eval('#scr-compare [data-act=cmp-remove]', l => l[0].click()); await page.waitForTimeout(200);
ok(/Dodaj drugi produkt/.test(await page.innerText('#scr-compare')), 'po usunięciu: „Dodaj drugi produkt”');
// Porównaj z ekranu produktu + podpowiedź po drugim skanie z tej samej kategorii.
await page.evaluate(() => App.cmpClear());
await page.goto('http://localhost:8790/index.html#/p/' + YOG[0].code); await page.waitForTimeout(1500); await closeCel();
await page.goto('http://localhost:8790/index.html#/p/' + YOG[5].code); await page.waitForTimeout(1500); await closeCel();
ok(await page.locator('#cmpSug').count() === 1 && /Skyr/.test(await page.innerText('#cmpSug')), 'podpowiedź: „Przed chwilą sprawdziłeś: Skyr naturalny · Porównaj”');
await page.click('#cmpSug [data-act=cmp-pair]'); await page.waitForTimeout(500);
ok(await page.evaluate(() => location.hash) === '#/porownaj' && await page.locator('#scr-compare .cmp-card').count() === 2, 'podpowiedź otwiera porównanie dwóch produktów');
await page.goto('http://localhost:8790/index.html#/p/' + YOG[1].code); await page.waitForTimeout(1500); await closeCel();
const pb = page.locator('#scr-product [data-act=cmp-prod]');
ok(await pb.count() === 1, 'ekran produktu: przycisk „Porównaj”');
await pb.click(); await page.waitForTimeout(500);
ok(await page.evaluate(() => location.hash) === '#/porownaj' && await page.locator('#scr-compare .cmp-card').count() === 3, 'trzeci produkt: porównanie trzech');
await page.reload(); await page.waitForTimeout(800);
ok(await page.locator('#scr-compare .cmp-card').count() === 3, 'porównanie zostaje po odświeżeniu (w telefonie)');
// Lista kategorii: przycisk ⇄ przy produktach.
await page.evaluate(() => localStorage.setItem('dcn-d-listwho', JSON.stringify('me')));
await page.goto('http://localhost:8790/index.html#/lista/en:yogurts'); await page.waitForTimeout(1500);
ok(await page.locator('#scr-list [data-act=cmp-toggle]').count() > 0, 'lista: przycisk ⇄ przy produktach');
// Brak wyników.
await page.goto('http://localhost:8790/index.html#/szukaj/xyzq'); await page.waitForTimeout(1200);
ok(/Nie znaleźliśmy/.test(await page.innerText('#srchRes')), 'brak wyników: zachęta do zeskanowania i dodania');
// Komputer: układ bez przewijania w bok.
await page.setViewportSize({ width: 1280, height: 900 }); await page.goto('http://localhost:8790/index.html#/porownaj'); await page.waitForTimeout(600);
ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'komputer: bez przewijania w bok');
await page.setViewportSize({ width: 360, height: 760 }); await page.waitForTimeout(300);
ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'telefon 360 px: trzy kolumny mieszczą się');
await page.screenshot({ path: process.env.SHOT || '/tmp/cmp.png', fullPage: true });
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
