// Odkrywcy (wersja D): sprawdzenia przy dodawaniu, zgłoszenie do potwierdzenia, „Czy trzymasz ten produkt?”, nagrody, ekran odkryć.
// Uruchom: node e2e-d-disc.mjs (serwer na porcie 8790).
import { chromium } from 'playwright';
import fs from 'fs';
import { setup, C } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const shots = new URL('./shots/', import.meta.url).pathname;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const S = { miss: [], submit: [], votes: [], product: { found: true, status: 'pending', name: 'Jogurt odkryty', nick: 'Ola', mine: false, voted: false, canVote: true }, mine: { ok: true, trusted: false, confirmed: 0, rejected: 0, items: [] } };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
await ctx.route(/\/config\.js$/, r => { let body = fs.readFileSync(new URL('../config.js', import.meta.url), 'utf8'); body = body.replace(/offProxyUrl: '[^']*'/, "offProxyUrl: 'https://proxy.test/'").replace(/goatcounter: '[^']*'/, "goatcounter: ''"); r.fulfill({ body, contentType: 'text/javascript' }); });
const form = r => (r.request().postDataBuffer() || Buffer.alloc(0)).toString('utf8');
await ctx.route(/proxy\.test\/category/, r => r.fulfill({ json: { products: [] } }));
await ctx.route(/proxy\.test\/product/, r => r.fulfill({ json: { ok: true } }));
await ctx.route(/proxy\.test\/ocr/, r => r.fulfill({ json: { ok: true, text: 'Skład: mleko pasteryzowane, żywe kultury bakterii jogurtowych, białka mleka, skrobia kukurydziana' } }));
await ctx.route(/proxy\.test\/edit/, r => r.fulfill({ json: { ok: true, saved: ['x'] } }));
await ctx.route(/proxy\.test\/disc\/miss/, r => { S.miss.push(form(r)); r.fulfill({ json: { ok: true } }); });
await ctx.route(/proxy\.test\/disc\/submit/, r => { S.submit.push(form(r)); r.fulfill({ json: { ok: true, status: 'pending', trusted: false, wanted: false } }); });
await ctx.route(/proxy\.test\/disc\/product/, r => r.fulfill({ json: Object.assign({ ok: true }, S.product) }));
await ctx.route(/proxy\.test\/disc\/vote/, r => { S.votes.push(form(r)); r.fulfill({ json: { ok: true, counted: true, status: 'pending', reward: 5 } }); });
await ctx.route(/proxy\.test\/disc\/mine/, r => r.fulfill({ json: S.mine }));
await ctx.route(/proxy\.test\/disc\/wanted/, r => r.fulfill({ json: { ok: true, items: [{ code: '5900000000999', n: 7 }] } }));
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
const closeCel = async () => { for (let i = 0; i < 12; i++) { if (await page.locator('#celebrate').isHidden()) return; await page.click('#celebrate [data-act=cel-ok]'); await page.waitForTimeout(120); } };
await page.addInitScript(() => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false })); });
const pts = () => page.evaluate(() => App.game.points);
const txt = async sel => (await page.locator(sel).innerText().catch(() => '')) || '';

// 1. Brak produktu: anonimowe zgłoszenie do „Poszukiwanych”
await page.goto('http://localhost:8790/index.html#/p/' + C.missing); await page.waitForTimeout(2000); await closeCel();
ok(S.miss.length === 1 && S.miss[0].includes(C.missing), 'brak produktu: zgłoszony do „Poszukiwanych”');
ok((await txt('#addCta')).includes('+10 od razu') && (await txt('#addCta')).includes('Złota karta'), 'nagroda odkrywcy: +10 od razu, +50 po potwierdzeniu');
// 2. Sprawdzenia przy dodawaniu
await page.fill('#addName', 'kurwa jogurt'); await page.click('#addSend', { force: true });
ok((await txt('#addMsg')).includes('żart'), 'nazwa z wulgaryzmem odrzucona');
await page.evaluate(() => { App.findCodes = async () => ['5901234123457']; });
await page.fill('#addName', 'Jogurt testowy 2%');
for (const k of ['front', 'ingredients', 'nutrition']) { await page.setInputFiles(`[data-photo=${k}]`, { name: k + '.png', mimeType: 'image/png', buffer: PNG }); await page.waitForTimeout(250); }
ok((await txt('#addCode')).includes('inny produkt'), 'kod na zdjęciu inny niż skan: ostrzeżenie');
await page.click('#addSend', { force: true }); await page.waitForTimeout(300);
ok(S.submit.length === 0 && (await txt('#addMsg')).includes('nie zgadza'), 'inny kod na zdjęciu: wysyłka zablokowana');
await page.screenshot({ path: shots + 'disc-other.png', fullPage: true });
await page.evaluate(c => { App.findCodes = async () => [c]; }, C.missing);
await page.setInputFiles('[data-photo=nutrition]', { name: 'n.png', mimeType: 'image/png', buffer: PNG }); await page.waitForTimeout(300);
ok((await txt('#addCode')).includes('zgadza się'), 'kod zgadza się ze skanem');
const p0 = await pts();
await page.click('#addSend', { force: true }); await page.waitForTimeout(900); await closeCel();
ok(S.submit.length === 1 && S.submit[0].includes('"barcode":"match"') && S.submit[0].includes(C.missing), 'zgłoszenie do potwierdzenia z wynikiem sprawdzenia kodu');
ok(await page.evaluate(c => App.disc.items[c] && App.disc.items[c].status === 'pending', C.missing), 'odkrycie zapisane jako „czeka na potwierdzenie”');
ok(await pts() >= p0 + 10, 'od razu +10 pkt (' + (await pts() - p0) + ')');
// 3. Skład niezgodny ze zdjęciem i kalorie, które się nie sumują
await page.waitForSelector('#cmpIngr', { timeout: 5000 });
await page.fill('#cmpIngr', 'czekolada, orzechy laskowe, karmel, sól morska, wanilia'); await page.click('[data-cmp=save-ingr]'); await page.waitForTimeout(200);
ok((await txt('#cmpIngrMsg')).includes('różni się'), 'zmyślony skład: odrzucony');
await page.fill('#cmpIngr', 'mleko pasteryzowane, żywe kultury bakterii jogurtowych, białka mleka'); await page.click('[data-cmp=save-ingr]'); await page.waitForTimeout(500);
await page.waitForSelector('[data-nut=energy-kcal]');
const fillNut = async v => { for (const [k, x] of Object.entries(v)) await page.fill(`[data-nut=${k}]`, String(x)); };
await fillNut({ 'energy-kcal': 450, fat: 2, 'saturated-fat': 1, carbohydrates: 5, sugars: 4, proteins: 2, salt: 0.1 });
await page.click('[data-cmp=save-nut]'); await page.waitForTimeout(200);
ok((await txt('#cmpNutMsg')).includes('nie pasują'), 'kalorie niezgodne z makroskładnikami: komunikat');
await fillNut({ 'energy-kcal': 61 }); await page.click('[data-cmp=save-nut]'); await page.waitForTimeout(500);
ok(!(await txt('#cmpNutMsg')).includes('nie pasują'), 'poprawne wartości: zapisane');
// 4. Kolejna osoba: pytanie tylko po skanie aparatem
await page.goto('http://localhost:8790/index.html#/'); await page.waitForTimeout(300);
await page.goto('http://localhost:8790/index.html#/p/' + C.milk); await page.waitForTimeout(1500); await closeCel();
if (await page.locator('#reveal').isVisible()) await page.click('#reveal [data-act=reveal-close]');
ok(await page.locator('#discAsk').count() === 0, 'kod wpisany ręcznie: bez pytania o potwierdzenie');
await page.goto('http://localhost:8790/index.html#/'); await page.waitForTimeout(300);
await page.evaluate(c => App.markCameraScan(c), C.oil);
await page.goto('http://localhost:8790/index.html#/p/' + C.oil); await page.waitForTimeout(1500); await closeCel();
if (await page.locator('#reveal').isVisible()) await page.click('#reveal [data-act=reveal-close]');
ok(await page.locator('#discAsk').isVisible(), 'po skanie aparatem: „Czy trzymasz ten produkt?”');
ok((await txt('#discAsk')).includes('Ola'), 'widać pseudonim odkrywcy');
await page.locator('#discAsk').screenshot({ path: shots + 'disc-ask.png' });
const p1 = await pts();
await page.click('#discAsk [data-v=no]'); await page.waitForTimeout(500); await closeCel();
ok(S.votes.length === 1 && S.votes[0].includes('no'), 'odpowiedź „nie” wysłana');
ok(await pts() === p1 + 5, '„nie” też daje +5 pkt');
ok((await txt('#discBox')).includes('Zgłoszenie przyjęte'), 'podziękowanie po odpowiedzi');
// 5. Synchronizacja: potwierdzenie i osoby, które sprawdziły
S.mine = { ok: true, trusted: false, confirmed: 1, rejected: 0, items: [{ code: C.missing, name: 'Jogurt testowy 2%', status: 'confirmed', views: 3, wanted: 0, at: Date.now() }] };
const p2 = await pts();
await page.evaluate(() => App.discSync(true)); await page.waitForTimeout(600); await closeCel();
ok(await pts() >= p2 + 53, 'potwierdzone odkrycie: +50 i +1 za każdą z 3 osób (' + (await pts() - p2) + ')');
await page.evaluate(() => App.discSync(true)); await page.waitForTimeout(300);
ok(await pts() >= p2 + 53 && await pts() <= p2 + 53 + 60, 'ponowna synchronizacja nie płaci drugi raz');
// 5b. Awans na zaufanego odkrywcę
S.mine = Object.assign({}, S.mine, { trusted: true, level: 'trusted', streak: 5, need: 10, confirmed: 5 });
const p3 = await pts();
await page.evaluate(() => App.discSync(true)); await page.waitForTimeout(600);
if (await page.locator('#rwBar').isVisible()) { await page.click('#rwBar [data-act=rw-open]'); await page.waitForTimeout(400); } // na ekranie produktu gratulacje czekają na pasku
for (let i = 0; i < 8 && await page.locator('#celebrate').isVisible() && !(await txt('#celebrate')).includes('Zaufany odkrywca'); i++) { await page.click('#celebrate [data-act=cel-ok]'); await page.waitForTimeout(150); }
ok(await page.locator('#celebrate').isVisible() && (await txt('#celebrate')).includes('Zaufany odkrywca'), 'awans: odznaka „Zaufany odkrywca” na pełny ekran');
await page.screenshot({ path: shots + 'disc-trusted.png' });
await closeCel();
ok(await pts() >= p3 + 100, 'awans: +100 pkt (' + (await pts() - p3) + ')');
await page.evaluate(() => App.discSync(true)); await page.waitForTimeout(300);
ok(await pts() < p3 + 200, 'awans nagradzany tylko raz');
// 6. Ekran „Twoje odkrycia”
await page.goto('http://localhost:8790/index.html#/odkrycia'); await page.waitForTimeout(900); await closeCel();
const d = await txt('#scr-discoveries');
ok(d.includes('Jogurt testowy 2%') && d.includes('potwierdzone') && d.includes('5900000000999'), 'odkrycia: moje produkty i lista „Poszukiwane”');
ok(d.includes('Zaufany odkrywca') && d.includes('5 z 15'), 'odkrycia: stopień i postęp do strażnika bazy');
await page.screenshot({ path: shots + 'disc-page.png', fullPage: true });
await page.goto('http://localhost:8790/index.html#/album'); await page.waitForTimeout(600);
ok((await txt('#scr-album')).includes('Twoje odkrycia'), 'album: wejście do „Twoich odkryć”');
// 7. Funkcje sprawdzające
ok(await page.evaluate(() => App.ocrMatch('mleko pasteryzowane, kultury bakterii jogurtowych, białka mleka, skrobia', 'mleko pasteryzowane, kultury bakterii jogurtowych') >= 0.5 && App.ocrMatch('mleko pasteryzowane kultury bakterii jogurtowych białka', 'czekolada orzechy karmel') < 0.35), 'porównanie składu ze zdjęciem');
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
