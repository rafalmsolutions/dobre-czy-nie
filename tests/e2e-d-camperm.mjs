// Skaner bez dostępu do aparatu (3.0.28): „Włącz aparat” pyta ponownie, zablokowany aparat → kroki dla telefonu,
// samoczynny start po zmianie uprawnienia, „Zrób zdjęcie kodu” (aparat telefonu), aparat zajęty.
// Uruchom: node e2e-d-camperm.mjs (serwer na porcie 8790). Uprawnienia i getUserMedia podstawione.
import { chromium } from 'playwright';
import { setup } from './lib.mjs';
const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
async function newPage({ perm, fail, twa, ua }) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', userAgent: ua }); await setup(ctx, {});
  const page = await ctx.newPage(); page.errs = []; page.on('pageerror', e => page.errs.push(e.message));
  await page.addInitScript(([perm, fail, twa]) => {
    localStorage.setItem('dcn-onboarded', 'true');
    if (twa) sessionStorage.setItem('dcn-twa', '1');
    // Udawane uprawnienie (window.__perm.state) i aparat, który odmawia (window.__fail = nazwa błędu) albo działa.
    const status = new EventTarget(); status.state = perm; window.__perm = status; window.__fail = fail; window.__failMsg = 'x'; window.__gum = 0;
    navigator.permissions.query = async () => status;
    const md = navigator.mediaDevices, orig = md.getUserMedia.bind(md);
    md.enumerateDevices = async () => [];
    // Czytnik kodów bez sieci (inaczej skaner ładuje ZXing z internetu).
    window.BarcodeDetector = class { static async getSupportedFormats() { return ['ean_13', 'ean_8']; } async detect() { return []; } };
    md.getUserMedia = async () => { window.__gum++; if (window.__fail) throw new DOMException(window.__failMsg, window.__fail); return orig({ video: true }); };
  }, [perm, fail, twa]);
  await page.goto('http://localhost:8790/app/index.html#/'); await page.waitForTimeout(1200);
  return page;
}
const vis = (page, sel) => page.locator(sel).isVisible();
const txt = (page, sel) => page.innerText(sel);

// 1. Pytanie zamknięte albo „Nie zezwalaj” jednorazowo (stan „prompt”): jeden przycisk „Włącz aparat”
let page = await newPage({ perm: 'prompt', fail: 'NotAllowedError' });
await page.click('.tab-scan'); await page.waitForTimeout(500);
ok(/Lupka potrzebuje aparatu/.test(await txt(page, '#scanErrTitle')), 'odmowa: tytuł „Lupka potrzebuje aparatu”');
ok(await vis(page, '#camRetry') && (await txt(page, '#camRetry')) === 'Włącz aparat', 'odmowa: przycisk „Włącz aparat”');
ok(await vis(page, '#camShotBtn') && await page.getAttribute('#codeShot', 'capture') === 'environment', 'odmowa: „Zrób zdjęcie kodu” otwiera aparat telefonu');
ok(!(await vis(page, '#scanErrSteps')), 'odmowa: bez kroków ustawień');
ok(!(await page.locator('#codePhoto').locator('..').isVisible()), 'odmowa: dolny przycisk „Zdjęcie kodu” schowany (jeden przycisk zdjęcia)');
ok(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'camRetry', 'fokus na „Włącz aparat”, nie na polu (bez klawiatury)');
await page.evaluate(() => { window.__fail = ''; window.__perm.state = 'granted'; });
await page.click('#camRetry'); await page.waitForTimeout(700);
ok(!(await vis(page, '#scanErr')) && await vis(page, '#reticle') && await page.evaluate(() => !!document.getElementById('video').srcObject), '„Włącz aparat” po zgodzie: skaner działa');
ok(!page.errs.length, 'brak błędów JS ' + page.errs.join(' | '));
await page.context().close();

// 2. Zablokowany w aplikacji z Google Play: kroki przez „Ustawienia witryny”, bez pytania przeglądarki
page = await newPage({ perm: 'denied', fail: 'NotAllowedError', twa: true, ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
await page.click('.tab-scan'); await page.waitForTimeout(500);
ok(/zablokowany/.test(await txt(page, '#scanErrTitle')), 'zablokowany: tytuł „Aparat jest zablokowany dla Lupki”');
ok(await page.evaluate(() => window.__gum) === 0, 'zablokowany: nie pytamy przeglądarki na próżno');
const steps = await txt(page, '#scanErrSteps');
ok(await vis(page, '#scanErrSteps') && /ikonę Lupki/.test(steps) && /Ustawienia witryny/.test(steps) && /Zezwalaj/.test(steps), 'aplikacja z Play: 3 kroki przez „Ustawienia witryny” (' + steps.replace(/\n/g, ' / ') + ')');
ok((await txt(page, '#camRetry')) === 'Sprawdź ponownie', 'zablokowany: przycisk „Sprawdź ponownie”');
// Użytkownik zmienił uprawnienie w ustawieniach: skaner rusza sam
await page.evaluate(() => { window.__fail = ''; window.__perm.state = 'granted'; window.__perm.dispatchEvent(new Event('change')); });
await page.waitForTimeout(700);
ok(!(await vis(page, '#scanErr')) && await page.evaluate(() => !!document.getElementById('video').srcObject), 'po odblokowaniu w ustawieniach skaner włącza się sam');
ok(!page.errs.length, 'brak błędów JS ' + page.errs.join(' | '));
await page.context().close();

// 3. Przeglądarka na Androidzie i iPhone: inne kroki
page = await newPage({ perm: 'denied', fail: 'NotAllowedError', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
await page.click('.tab-scan'); await page.waitForTimeout(400);
ok(/adresu strony/.test(await txt(page, '#scanErrSteps')), 'Chrome na Androidzie: kroki przez ikonę obok adresu');
await page.context().close();
page = await newPage({ perm: 'denied', fail: 'NotAllowedError', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
await page.click('.tab-scan'); await page.waitForTimeout(400);
ok(/Safari → Aparat/.test(await txt(page, '#scanErrSteps')), 'iPhone: kroki przez Ustawienia → Safari → Aparat');
await page.context().close();

// 4. Aparat zajęty przez inną aplikację
page = await newPage({ perm: 'granted', fail: 'NotReadableError' });
await page.click('.tab-scan'); await page.waitForTimeout(400);
ok(/niedostępny/.test(await txt(page, '#scanErrTitle')) && (await txt(page, '#camRetry')) === 'Spróbuj ponownie', 'aparat zajęty: „Aparat jest teraz niedostępny” i „Spróbuj ponownie”');
// Zdjęcie aparatem telefonu trafia do odczytu kodu
await page.evaluate(() => { window.__decoded = 0; App.decodeImageFile = async () => { window.__decoded++; }; });
await page.setInputFiles('#codeShot', { name: 'kod.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) });
await page.waitForTimeout(200);
ok(await page.evaluate(() => window.__decoded) === 1, '„Zrób zdjęcie kodu”: zdjęcie trafia do odczytu kodu');
// Ponowne otwarcie skanera chowa przyciski błędu
await page.evaluate(() => { window.__fail = ''; App.closeScanner(true); }); await page.click('.tab-scan'); await page.waitForTimeout(600);
ok(!(await vis(page, '#camRetry')) && !(await vis(page, '#camShotBtn')) && !(await vis(page, '#scanErr')) && await page.locator('#codePhoto').locator('..').isVisible(), 'kolejne otwarcie z działającym aparatem: bez komunikatu i przycisków');
ok(!page.errs.length, 'brak błędów JS ' + page.errs.join(' | '));
await page.context().close();
// 5. Android nie daje aparatu samej przeglądarce („Permission denied by system”): kroki w ustawieniach telefonu dla Chrome
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
page = await newPage({ perm: 'prompt', fail: 'NotAllowedError', twa: true, ua: ANDROID });
await page.evaluate(() => { window.__failMsg = 'Permission denied by system'; });
await page.click('.tab-scan'); await page.waitForTimeout(500);
const sys = await txt(page, '#scanErrSteps');
ok(/Chrome nie ma dostępu do aparatu/.test(await txt(page, '#scanErrTitle')) && /Aplikacje → Chrome/.test(sys) && /Uprawnienia → Aparat/.test(sys), 'blokada w Androidzie: „Chrome nie ma dostępu do aparatu” i kroki w ustawieniach telefonu (' + sys.replace(/\n/g, ' / ') + ')');
ok(!(await vis(page, '#camShotBtn')) && await page.locator('#codePhoto').locator('..').isVisible() && (await txt(page, '#camRetry')) === 'Sprawdź ponownie', 'blokada w Androidzie: zamiast aparatu telefonu – wybór zdjęcia z galerii, „Sprawdź ponownie”');
ok(!page.errs.length, 'brak błędów JS ' + page.errs.join(' | '));
await page.context().close();

// 5b. Android: odmowa bez pytania (natychmiast), mimo stanu „prompt” → kroki w ustawieniach telefonu, nie migający przycisk
page = await newPage({ perm: 'prompt', fail: 'NotAllowedError', twa: true, ua: ANDROID });
await page.click('.tab-scan'); await page.waitForTimeout(500);
ok(/Chrome nie ma dostępu do aparatu/.test(await txt(page, '#scanErrTitle')) && /Ustawienia witryny/.test(await txt(page, '#scanErrSteps')), 'Android, natychmiastowa odmowa bez pytania: kroki dla Chrome (+ „Ustawienia witryny”)');
await page.context().close();
// 5c. Android: odmowa po czasie (użytkownik zamknął pytanie) → „Włącz aparat”; druga odmowa → kroki
page = await newPage({ perm: 'prompt', fail: '', ua: ANDROID });
await page.evaluate(() => { const md = navigator.mediaDevices, g = md.getUserMedia; md.getUserMedia = async c => { await new Promise(r => setTimeout(r, 900)); throw new DOMException('Permission denied', 'NotAllowedError'); }; });
await page.click('.tab-scan'); await page.waitForTimeout(1400);
ok(/Lupka potrzebuje aparatu/.test(await txt(page, '#scanErrTitle')), 'Android, zamknięte pytanie: „Włącz aparat”');
await page.click('#camRetry'); await page.waitForTimeout(1400);
ok(/Chrome nie ma dostępu do aparatu/.test(await txt(page, '#scanErrTitle')), 'Android, druga odmowa po „Włącz aparat”: kroki w ustawieniach telefonu');
await page.context().close();

// 6. „Zdjęcie składu”, gdy aparat się nie otwiera (nic się nie dzieje): po 2 s podpowiedź i „Wybierz z galerii”
page = await newPage({ perm: 'granted', fail: '', ua: ANDROID });
await page.evaluate(() => { window.__ocr = 0; App.runOcr = async () => { window.__ocr++; }; });
await page.evaluate(() => { const s = document.createElement('span'); s.style.cssText = 'position:fixed;top:120px;left:20px;z-index:999'; s.innerHTML = '<input type="file" id="ingPhoto" accept="image/*" capture="environment">'; document.body.appendChild(s); });
page.on('filechooser', () => {}); // atrapa: okno wyboru „nie otwiera się” (strona nie traci fokusu)
await page.click('#ingPhoto'); await page.waitForTimeout(2400);
const toast = await txt(page, '#toast');
ok(/Aparat się nie otworzył/.test(toast) && /Aplikacje → Chrome → Uprawnienia → Aparat/.test(toast) && /Wybierz z galerii/.test(toast), 'zdjęcie składu bez aparatu: podpowiedź zamiast ciszy (' + toast + ')');
const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#toast [data-act=photo-gallery]')]);
ok(!(await fc.element().getAttribute('capture')), '„Wybierz z galerii” otwiera wybór pliku bez wymuszonego aparatu');
await fc.setFiles({ name: 'sklad.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) }); await page.waitForTimeout(300);
ok(await page.evaluate(() => window.__ocr) === 1, 'zdjęcie z galerii trafia do odczytu składu');
// Gdy aparat się otworzył (strona traci widoczność), podpowiedzi nie ma
await page.evaluate(() => { document.getElementById('toast').hidden = true; });
await page.click('#ingPhoto'); await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.waitForTimeout(2400);
ok(await page.locator('#toast').isHidden(), 'aparat się otworzył: bez podpowiedzi');
ok(!page.errs.length, 'brak błędów JS ' + page.errs.join(' | '));
await page.context().close();
// 7. Mikrofon (dyktowanie) bez zgody na Androidzie: dokładne kroki dla Chrome
page = await newPage({ perm: 'granted', fail: '', ua: ANDROID });
await page.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; window.SpeechRecognition = undefined; window.webkitSpeechRecognition = class { start() { setTimeout(() => { this.onerror && this.onerror({ error: 'not-allowed' }); this.onend && this.onend(); }, 30); } stop() { } abort() { } }; });
await page.goto('http://localhost:8790/app/index.html?mic=1#/polki'); await page.waitForTimeout(1300);
await page.click('#micBtn'); await page.waitForTimeout(300);
const mic = await txt(page, '#itemMsg');
ok(/Aplikacje → Chrome → Uprawnienia → Mikrofon → Zezwalaj/.test(mic) && /Ustawienia witryny/.test(mic) && await page.isEnabled('#addItemInput'), 'mikrofon bez zgody na Androidzie: kroki dla Chrome i „Ustawienia witryny” (' + mic + ')');
ok(!page.errs.length, 'brak błędów JS ' + page.errs.join(' | '));
await page.context().close();
await b.close(); process.exit(bad ? 1 : 0);
