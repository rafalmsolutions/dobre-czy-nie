// Osoby na zakupy (2.3.4): wyłączanie domowników (także siebie) na ekranie głównym; wyłączeni nie liczą się przy produkcie ani na liście.
// Plus: medal zamiast truskawki przy ukończonym wyzwaniu. Uruchom: node e2e-d-shop.mjs (serwer na porcie 8790).
import { chromium } from 'playwright';
import { setup, C, SEARCH } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
await ctx.route(/workers\.dev\/category/, r => r.fulfill({ json: { products: /hazelnut|sweet-spreads/.test(r.request().url()) ? (SEARCH['en:hazelnut-spreads'] || []) : [] } }));
await ctx.route(/workers\.dev\/details/, r => r.fulfill({ json: { products: {} } }));
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => {
  if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1');
  localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false }));
  localStorage.setItem('dcn-d-profile', JSON.stringify({ watch: ['sugar'] }));
  localStorage.setItem('dcn-d-family', JSON.stringify([{ id: 'f1', name: 'Kuba', p: { allergens: ['nuts'] } }, { id: 'f2', name: 'Ola', p: {} }]));
});
const closeCel = async () => { for (let i = 0; i < 10; i++) { if (await page.locator('#celebrate').isHidden()) return; await page.click('#celebrate [data-act=cel-ok]'); await page.waitForTimeout(120); } };
const sw = id => page.locator(`#scr-home [data-act=shop-on][data-id=${id}]`);
await page.goto('http://localhost:8790/app/index.html#/'); await page.waitForTimeout(900); await closeCel();
await page.click('#scr-home [data-act=who-sheet]'); await page.waitForTimeout(300);
ok(await page.locator('#scr-home .who-ck').count() === 3, 'panel „Dla kogo kupujesz?”: każda osoba (3)');
ok((await page.$$eval('#scr-home .who-ck', l => l.map(x => x.getAttribute('aria-checked')))).every(x => x === 'true'), 'na start wszyscy włączeni');
await sw('f2').click(); await page.waitForTimeout(300);
ok(await sw('f2').getAttribute('aria-checked') === 'false' && /Wybrane: 2/.test(await page.innerText('#scr-home .seg')), 'wyłączenie Oli: odznaczona, przełącznik „Wybrane: 2”');
ok((await page.evaluate(() => JSON.parse(localStorage.getItem('dcn-d-shopoff')) || [])).join() === 'f2', 'wybór zapamiętany');
ok(await page.evaluate(() => document.activeElement && document.activeElement.dataset.id) === 'f2', 'fokus zostaje na przełączniku');

await page.goto('http://localhost:8790/app/index.html#/p/' + C.nutella); await page.waitForTimeout(1600); await closeCel();
let circ = await page.$$eval('#scr-product .fam-circles .fam-c', l => l.map(x => x.dataset.id));
ok(circ.length === 2 && !circ.includes('f2'), 'produkt: kółka tylko włączonych osób ' + circ.join(','));
ok(/Nie liczymy: Ola/.test(await page.innerText('#famOff').catch(() => '')), 'produkt: informacja, kogo nie liczymy');

// Wyłączam siebie: zostaje tylko Kuba.
await page.goto('http://localhost:8790/app/index.html#/'); await page.waitForTimeout(600);
await sw('me').click(); await page.waitForTimeout(300);
await sw('f1').click(); await page.waitForTimeout(300);
ok(await sw('f1').getAttribute('aria-checked') === 'true', 'ostatniej włączonej osoby nie da się wyłączyć');
ok(/Przynajmniej jedna osoba/.test(await page.innerText('body')), 'komunikat: ktoś musi zostać');
await page.goto('http://localhost:8790/app/index.html#/p/' + C.nutella); await page.waitForTimeout(1600); await closeCel();
const ans = await page.innerText('#scr-product .fam-ans').catch(() => '');
circ = await page.$$eval('#scr-product .fam-circles .fam-c', l => l.map(x => x.dataset.id));
ok(/Nie dla: Kuba/.test(ans) && circ.join() === 'f1', 'tylko Kuba: wynik dla Kuby, jedno kółko (' + ans.replace(/\n/g, ' | ') + ')');
ok((await page.innerText('#matchBox')).includes('Dlaczego dla: Kuba'), 'tylko Kuba: rachunek dla Kuby');
ok(/Ciebie/.test(await page.innerText('#famOff')) && /Ola/.test(await page.innerText('#famOff')), 'nie liczymy: Ciebie i Oli');
const pd = await page.$eval('#scr-product .d-plate', e => getComputedStyle(e).getPropertyValue('--pdeg').trim()).catch(() => '');
ok(/deg$/.test(pd), 'obręcz = wynik Kuby (' + pd + ')');

// Tylko ja: zwykły widok jednej osoby, z informacją kogo nie liczymy.
await page.evaluate(() => { App.setShopOn('me', true); App.setShopOn('f1', false); });
await page.evaluate(() => App.rerenderProduct()); await page.waitForTimeout(300);
ok(await page.locator('#scr-product .fam-ans').count() === 0 && await page.locator('#scr-product .d-badge').count() === 1, 'tylko Ty: zwykły wynik „dla Ciebie”');
ok(/Kuba, Ola/.test(await page.innerText('#famOff').catch(() => '')), 'tylko Ty: widać, że Kuby i Oli nie liczymy');
await page.click('#famOff [data-act=shop-all]'); await page.waitForTimeout(400);
ok(await page.locator('#scr-product .fam-circles .fam-c').count() === 3 && await page.locator('#famOff').count() === 0, '„Licz wszystkich” przywraca całą rodzinę');

// „Ostatnio sprawdzone” liczy się dla włączonych osób, tak samo jak kwadrat i obręcz na ekranie produktu.
const famPct = async () => page.$eval('#scr-product .fam-verdict .d-badge b', e => parseInt(e.textContent)).catch(() => null);
const myPct = async () => page.$eval('#scr-product .d-verdict .d-badge b', e => parseInt(e.textContent)).catch(() => null);
const hist = async () => { await page.goto('http://localhost:8790/app/index.html#/'); await page.waitForTimeout(500); return page.$$eval('#scr-home .recent .rc', it => { const x = it.find(e => /Krem orzechowy/.test(e.textContent)); return x ? parseInt(x.querySelector('.pct').textContent) : null; }); };
await page.goto('http://localhost:8790/app/index.html#/p/' + C.nutella); await page.waitForTimeout(1200); await closeCel();
const fAll = await famPct(), hAll = await hist();
ok(fAll != null && fAll <= 10 && hAll === fAll, `cała rodzina (Kuba: orzechy): kwadrat ${fAll}% = „Ostatnio sprawdzone” ${hAll}%`);
await page.evaluate(() => { App.setShopOn('f1', false); App.setShopOn('f2', false); });
await page.goto('http://localhost:8790/app/index.html#/p/' + C.nutella); await page.waitForTimeout(1200); await closeCel();
const mOnly = await myPct(), hMe = await hist();
ok(mOnly != null && mOnly !== fAll && hMe === mOnly, `tylko Ty: kwadrat ${mOnly}% = „Ostatnio sprawdzone” ${hMe}%`);
await page.evaluate(() => App.shopAll());

// Lista: przy wyłączonej Oli wybór osób bez Oli, „Wszyscy wybrani”.
await page.evaluate(() => App.setShopOn('f2', false));
await page.goto('http://localhost:8790/app/index.html#/lista/en:sweet-spreads'); await page.waitForTimeout(2500);
const who = await page.$$eval('#scr-list .list-who [data-act=list-who]', l => l.map(x => x.dataset.who + ':' + x.innerText.trim()));
ok(who.length === 3 && !who.some(x => x.startsWith('f2')) && /^all:Wszyscy wybrani/.test(who[0]), 'lista: wybór bez wyłączonej osoby ' + who.join(' | '));
ok(/Nie liczymy: Ola/.test(await page.innerText('#scr-list').catch(() => '')), 'lista: informacja, kogo nie liczymy');

// Wyzwanie tygodnia: medal zamiast paczki nasion truskawki.
await page.evaluate(() => App.celebrate([{ type: 'challenge', name: 'Zgadnij 5 razy: dobre czy nie?', points: 50 }]));
await page.waitForTimeout(400);
const cel = await page.$eval('#celebrate', e => e.innerHTML);
ok(!/strawberry|truskaw/i.test(cel) && /Kolekcji/.test(cel), 'wyzwanie ukończone: medal, bez truskawki, wskazówka gdzie je widać');
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
