// Testy wersji 1.0 w przeglądarce: poprawne użycie i złe użycie. Uruchom: node e2e.mjs [sekcja]
import { chromium } from 'playwright';
import { setup, C, YOG } from './lib.mjs';
import fs from 'fs';
const BASE = 'http://localhost:8790/';
const ONLY = process.argv[2] || '';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  ✗ ' + name); } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const browser = await chromium.launch();
async function fresh(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: opts.width || 390, height: 844 }, serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] });
  await setup(ctx, opts);
  // Testy nigdy nie łączą się z prawdziwym pośrednikiem ani statystykami: podmieniamy config.js.
  await ctx.route(/\/config\.js$/, async r => {
    let body = fs.readFileSync(new URL('../config.js', import.meta.url), 'utf8');
    body = body.replace(/offProxyUrl: '[^']*'/, `offProxyUrl: '${opts.proxy ? 'https://proxy.test/' : ''}'`);
    body = body.replace(/goatcounter: '[^']*'/, `goatcounter: '${opts.stats ? 'testdcn' : ''}'`);
    r.fulfill({ body, contentType: 'text/javascript' });
  });
  await ctx.route(/workers\.dev|goatcounter\.com\/count/, r => opts.stats && /goatcounter/.test(r.request().url()) ? r.fallback() : r.abort());
  if (opts.stats) {
    opts.hits = [];
    await ctx.route(/goatcounter\.com\/count/, r => { const u = new URL(r.request().url()); opts.hits.push({ p: u.searchParams.get('p'), e: u.searchParams.get('e') === 'true', url: u.href }); r.fulfill({ status: 200, body: '' }); });
  }
  if (opts.proxy) {
    opts.categoryCalls = 0;
    await ctx.route(/proxy\.test\/category/, async r => {
      opts.categoryCalls++;
      const products = YOG.map(p => ({ code: p.code, product_name: p.product_name_pl, brands: p.brands, nutriscore_grade: p.nutriscore_grade, nova_group: p.nova_group, additives_tags: p.additives_tags || null, allergens_tags: p.allergens_tags || [], nutriments: p.nutriments || {}, categories_hierarchy: p.categories_hierarchy, stores: (p.stores_tags || []).map(x => x[0].toUpperCase() + x.slice(1)) }));
      return r.fulfill({ json: { ok: true, products } });
    });
    opts.edits = [];
    await ctx.route(/proxy\.test\/ocr/, r => r.fulfill({ json: opts.ocrFail ? { ok: false, error: 'no_text' } : { ok: true, text: 'Skład: mleko, truskawki 8%, cukier, kultury bakterii. Należy spożyć przed: 12.11' } }));
    await ctx.route(/proxy\.test\/image/, r => r.fulfill({ json: { ok: true } }));
    await ctx.route(/proxy\.test\/edit/, r => { const b = (r.request().postDataBuffer() || Buffer.alloc(0)).toString('utf8'); opts.edits.push(b); return r.fulfill({ json: { ok: true, saved: [/ingredients_text/.test(b) ? 'ingredients' : 'nutrition'] } }); });
    await ctx.route(/proxy\.test\/product/, async r => {
      opts.proxyCalls = (opts.proxyCalls || 0) + 1;
      const body = r.request().postDataBuffer() || Buffer.alloc(0);
      opts.lastBody = body.toString('latin1');
      const mode = opts.proxyMode || 'ok';
      if (mode === 'ok') return r.fulfill({ json: { ok: true } });
      if (mode === 'reject') return r.fulfill({ status: 400, json: { ok: false, error: 'bad' } });
      return r.fulfill({ status: 502, json: { ok: false } });
    });
  }
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', e => page.errs.push(e.message));
  page.on('dialog', d => { page.errs.push('DIALOG ' + d.message()); d.dismiss(); });
  if (opts.onboarded !== false) {
    await page.addInitScript(o => { if (!localStorage.getItem('dcn-onboarded')) { localStorage.setItem('dcn-onboarded', 'true'); if (o.profile) localStorage.setItem('dcn-profile', JSON.stringify(o.profile)); } }, { profile: opts.profile || null });
  }
  await page.goto(BASE + (opts.hash || ''));
  await page.waitForFunction(() => typeof App !== 'undefined' && App.cfg && App.cfg.levels && App.cfg.levels.levels);
  await page.waitForTimeout(200);
  return { ctx, page, opts };
}
const pts = p => p.evaluate(() => App.game.points);
const txt = (p, sel) => p.locator(sel).first().innerText().catch(() => '');
const go = async (p, hash) => { await p.evaluate(h => { location.hash = h; }, hash); await p.waitForTimeout(250); };
async function closeCelebrations(p) { for (let i = 0; i < 6; i++) { if (await p.locator('#celebrate').isHidden()) return; await p.click('#celebrate [data-act=cel-ok]'); await p.waitForTimeout(80); } }
async function noOverflow(p, name) {
  const w = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(w <= 0, name + ': brak poziomego przewijania (' + w + 'px)');
}
async function noXss(p, name) { ok(!(await p.evaluate(() => window.__xss)), name + ': brak XSS'); }
async function section(name, fn) {
  if (ONLY && !name.toLowerCase().includes(ONLY.toLowerCase())) return;
  const before = fail; console.log('▶ ' + name);
  try { await fn(); } catch (e) { fail++; console.log('  ✗ WYJĄTEK: ' + e.message.split('\n').slice(0,12).join('\n')); }
  console.log(fail === before ? '  ✓ ok' : '  … błędy powyżej');
}

/* 1. Start */
await section('Start i onboarding', async () => {
  const { ctx, page } = await fresh({ onboarded: false });
  ok(await page.evaluate(() => App.current.screen) === 'start', 'nowy użytkownik trafia na start');
  ok(await page.locator('.tabbar').isHidden() || await page.evaluate(() => document.body.classList.contains('no-nav')), 'na starcie brak menu');
  for (const k of ['weight', 'muscle', 'cholesterol', 'pressure']) await page.click(`[data-act=goal][data-k=${k}]`);
  ok((await txt(page, '#startMsg')).includes('najwyżej'), 'limit celów: komunikat');
  ok(await page.locator('[data-act=goal][aria-pressed=true]').count() === 3, 'limit celów: max 3 zaznaczone');
  await page.click('[data-act=goal][data-k=weight]');
  ok(await page.locator('[data-act=goal][aria-pressed=true]').count() === 2, 'odznaczanie celu');
  await page.click('[data-act=start-next]');
  await page.click('label.pchip:has([data-pick="allergens:milk"])');
  await page.click('[data-act=start-back]');
  await page.click('[data-act=start-next]');
  ok(await page.isChecked('[data-pick="allergens:milk"]'), 'wybór zostaje po powrocie');
  await page.click('[data-act=start-next]');
  await page.fill('#startName', '<b>Ania</b>');
  await noOverflow(page, 'start');
  await page.click('[data-act=start-next]');
  await page.waitForTimeout(250);
  ok(await page.evaluate(() => App.current.screen) === 'home', 'po starcie ekran główny');
  ok(!(await page.locator('#scr-home h1 b').count()), 'imię bez HTML');
  ok((await txt(page, '#scr-home h1')).includes('Ania'), 'powitanie imieniem');
  const prof = await page.evaluate(() => App.profile);
  ok(prof.goals.length === 2 && prof.allergens.includes('milk'), 'profil zapisany');
  await page.reload(); await page.waitForTimeout(300);
  ok(await page.evaluate(() => App.current.screen) === 'home', 'po odświeżeniu nie wraca start');
  await page.screenshot({ path: SHOTS + 'e-home.png' });
  ok(!page.errs.length, 'brak błędów JS: ' + page.errs.join(' | '));
  await ctx.close();
  // Pominięcie od razu
  const s = await fresh({ onboarded: false });
  await s.page.click('[data-act=start-skip]'); await s.page.waitForTimeout(200);
  ok(await s.page.evaluate(() => App.current.screen) === 'home', 'pomiń prowadzi na ekran główny');
  await s.ctx.close();
});

/* 2. Wpisywanie kodu */
await section('Kod ręcznie i nawigacja', async () => {
  const { ctx, page } = await fresh();
  for (const [v, frag] of [['', 'Wpisz'], ['abc123', 'samych cyfr'], ['12345', '5 cyfr'], ['1'.repeat(20), 'za długi']]) {
    await page.fill('#homeCode', v); await page.click('#homeForm button');
    ok((await txt(page, '#homeMsg')).includes(frag), 'zły kod "' + v.slice(0, 8) + '": ' + frag);
  }
  ok(await page.evaluate(() => App.current.screen) === 'home', 'zły kod nie zmienia ekranu');
  await page.fill('#homeCode', ' 3017 6204 2200 3 '); await page.click('#homeForm button');
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => location.hash) === '#/p/' + C.nutella, 'kod ze spacjami działa');
  await go(page, '#/cokolwiek');
  ok(await page.evaluate(() => App.current.screen) === 'home', 'nieznany adres → ekran główny');
  await go(page, '#/lista/zly-tag');
  ok(await page.evaluate(() => App.current.screen) === 'home', 'zła kategoria listy → ekran główny');
  await ctx.close();
  const d = await fresh({ hash: '#/p/' + C.oil });
  await d.page.waitForTimeout(500);
  await d.page.click('[data-act=guess][data-v=skip]');
  await d.page.click('[data-act=back]'); await d.page.waitForTimeout(250);
  ok(await d.page.evaluate(() => App.current.screen) === 'home', '„Wróć” przy wejściu z linku prowadzi do aplikacji, nie poza nią');
  await d.ctx.close();
});

/* 3. Produkt, zgadywanie, punkty */
await section('Produkt i zgadywanie', async () => {
  const { ctx, page } = await fresh({ profile: { goals: ['sugar'] } });
  await go(page, '#/p/' + C.nutella); await page.waitForTimeout(500);
  ok(await page.locator('#guessBox').isVisible(), 'pytanie „Zgadnij” przed wynikiem');
  ok(!(await page.locator('#matchBox').count()), 'wynik ukryty przed zgadnięciem');
  const p0 = await pts(page);
  ok(p0 === 2, 'sprawdzenie produktu +2 pkt (jest ' + p0 + ')');
  await page.screenshot({ path: SHOTS + 'e-guess.png' });
  await page.click('[data-act=guess][data-v=bad]'); await page.waitForTimeout(300);
  ok((await txt(page, '.banner')).includes('Trafione'), 'trafiony typ: baner');
  ok(await pts(page) === p0 + 10, 'trafiony typ +10 pkt');
  ok((await txt(page, '#matchLabel')).includes('Raczej nie'), 'dopasowanie: raczej nie dla Ciebie');
  ok((await page.locator('#matchBox .crit').count()) >= 1, 'powody dopasowania widoczne');
  await page.waitForSelector('#catBody .item, #catBody p', { timeout: 4000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: SHOTS + 'e-product.png', fullPage: true });
  // ponowne wejście tego samego dnia: bez pytania i bez punktów
  await go(page, '#/'); await go(page, '#/p/' + C.nutella); await page.waitForTimeout(500);
  ok(!(await page.locator('#guessBox').count()), 'drugi raz tego dnia nie pytamy');
  ok(await pts(page) === p0 + 10, 'ponowne sprawdzenie nie daje punktów');
  // na półkę
  await page.click('[data-act=shelf-add]'); await page.waitForTimeout(150);
  ok(await page.locator('[data-act=shelf-add]').isDisabled(), 'po dodaniu przycisk nieaktywny');
  ok(await pts(page) === p0 + 15, 'dodanie na półkę +5');
  ok(await page.evaluate(c => Shelf.hasCode(App.shelves, c), C.nutella), 'produkt na półce');
  // rozwinięcie wyjaśnienia kilka razy: tylko raz liczone
  for (let i = 0; i < 4; i++) { await page.click('[data-ev=why] summary'); await page.waitForTimeout(50); }
  ok(await page.evaluate(() => App.game.counters.explanation_opened) === 1, 'wyjaśnienie liczone raz dziennie (anty-nabijanie)');
  // pudło
  await go(page, '#/p/' + C.milk); await page.waitForTimeout(500);
  const p1 = await pts(page);
  await page.click('[data-act=guess][data-v=bad]'); await page.waitForTimeout(200);
  ok((await txt(page, '.banner')).includes('pudło'), 'pudło: baner');
  ok(await pts(page) === p1 + 3, 'pudło +3');
  // wyłączenie gry
  await go(page, '#/p/' + C.oil); await page.waitForTimeout(500);
  await page.check('[data-act=no-guess]');
  ok(await page.evaluate(() => App.settings.guess) === false, 'checkbox wyłącza zgadywanie');
  await go(page, '#/p/' + C.ham); await page.waitForTimeout(500);
  ok(!(await page.locator('#guessBox').count()), 'po wyłączeniu nie pytamy');
  ok(!page.errs.length, 'brak błędów JS: ' + page.errs.join(' | '));
  await noOverflow(page, 'produkt');
  await ctx.close();
});

/* 4. Profil a dopasowanie, bezpieczeństwo */
await section('Alergie, brak danych, XSS', async () => {
  const { ctx, page } = await fresh({ profile: { allergens: ['milk'], diet: ['vegan'] } });
  await page.evaluate(() => { App.settings.guess = false; App.saveSettings(); });
  await go(page, '#/p/' + C.milk); await page.waitForTimeout(500);
  const pct = await page.evaluate(() => App.currentProduct().pm.pct);
  ok(pct != null && pct <= 10, 'alergen w składzie: dopasowanie ≤10% (' + pct + ')');
  await go(page, '#/p/' + C.vegan); await page.waitForTimeout(500);
  await go(page, '#/p/' + C.empty); await page.waitForTimeout(500);
  ok((await txt(page, '#matchLabel')).includes('Za mało danych'), 'brak danych: uczciwy komunikat');
  await go(page, '#/p/' + C.xss); await page.waitForTimeout(600);
  await page.hover('#scr-product').catch(() => { });
  await noXss(page, 'produkt');
  await go(page, '#/p/' + C.weird); await page.waitForTimeout(500);
  ok(await page.locator('#scr-product h1').count() === 1, 'dziwne dane z bazy nie psują ekranu');
  await go(page, '#/'); await page.waitForTimeout(200);
  await noXss(page, 'historia');
  ok(!page.errs.length, 'brak błędów JS: ' + page.errs.join(' | '));
  await ctx.close();
});

/* 5. Błędy sieci */
await section('Błędy sieci i brak produktu', async () => {
  const { ctx, page } = await fresh();
  for (const [code, frag] of [[C.err500, 'chwilowy problem'], [C.err429, 'Za dużo'], [C.badjson, 'chwilowy problem'], [C.half, 'chwilowy problem']]) {
    await go(page, '#/p/' + code); await page.waitForSelector('#notFound', { timeout: 8000 }).catch(() => {});
    ok((await txt(page, '#notFound h1')).includes(frag), 'błąd ' + code.slice(-2) + ': ' + frag);
    ok(await page.locator('[data-act=retry]').count() === 1, 'przycisk „Spróbuj ponownie”');
  }
  await page.click('[data-act=retry]'); await page.waitForTimeout(2500);
  ok(await page.locator('#notFound').count() === 1, 'ponowienie nadal pokazuje błąd zamiast się wysypać');
  // offline: zapisany wynik
  await page.evaluate(() => { App.settings.guess = false; App.saveSettings(); });
  await go(page, '#/p/' + C.oil); await page.waitForTimeout(500);
  await go(page, '#/');
  await ctx.setOffline(true);
  await go(page, '#/p/' + C.oil); await page.waitForTimeout(500);
  ok(await page.locator('#matchBox').count() === 1, 'offline: zapisany wynik');
  await go(page, '#/p/' + C.ham); await page.waitForTimeout(500);
  ok((await txt(page, '#notFound h1')).includes('offline'), 'offline bez zapisu: komunikat');
  await ctx.setOffline(false);
  await ctx.setOffline(false);
  // chwilowy błąd bazy przy pierwszym zapytaniu: cicha ponowna próba, bez okna błędu
  const fo = { offFailOnce: true };
  const f1 = await fresh(fo);
  await go(f1.page, '#/p/' + C.missing); await f1.page.waitForSelector('#notFound', { timeout: 8000 });
  ok((await txt(f1.page, '#notFound h1')).includes('jeszcze nie znamy'), 'chwilowy błąd bazy: od razu „nie znamy”, bez okna błędu');
  await f1.ctx.close();
  // brak produktu bez pośrednika: instrukcja
  await go(page, '#/p/' + C.missing); await page.waitForTimeout(600);
  ok((await txt(page, '#notFound h1')).includes('jeszcze nie znamy'), 'brak produktu: zachęta');
  ok(await page.locator('#addCta').count() === 1, 'nagroda odkrywcy widoczna');
  ok(await page.locator('a[href*="org.openfoodfacts.scanner"]').count() === 1, 'bez pośrednika: link do aplikacji OFF');
  await page.screenshot({ path: SHOTS + 'e-missing.png', fullPage: true });
  // zła suma kontrolna
  await go(page, '#/p/5901234123458'); await page.waitForTimeout(600);
  ok((await txt(page, '#notFound')).includes('suma kontrolna') || (await txt(page, '#scr-product')).includes('suma kontrolna'), 'zła suma kontrolna: podpowiedź');
  // ocena składu z etykiety
  await go(page, '#/p/' + C.missing2); await page.waitForTimeout(600);
  await page.click('#ingDetails summary');
  await page.click('[data-act=rate-ing]');
  ok((await txt(page, '#ingMsg')).includes('Wpisz skład'), 'pusty skład: komunikat');
  await page.fill('#ingText', 'cukier, olej palmowy, E250, mleko w proszku');
  await page.click('[data-act=rate-ing]'); await page.waitForTimeout(300);
  ok(await page.locator('#matchBox').count() === 1, 'ocena składu wpisanego ręcznie');
  ok(!page.errs.length, 'brak błędów JS: ' + page.errs.join(' | '));
  await ctx.close();
});

/* 6. Dodawanie produktu przez pośrednika */
await section('Dodaj brakujący produkt', async () => {
  const o = { proxy: true, proxyMode: 'ok' };
  const { ctx, page } = await fresh(o);
  await go(page, '#/p/' + C.missing); await page.waitForTimeout(600);
  ok(await page.locator('#addForm').count() === 1, 'z pośrednikiem: formularz dodawania');
  await page.click('#addSend');
  ok((await txt(page, '#addMsg')).includes('nazwę'), 'bez nazwy: komunikat');
  await page.fill('#addName', 'Jogurt testowy');
  await page.click('#addSend');
  ok((await txt(page, '#addMsg')).includes('Brakuje zdjęcia'), 'bez zdjęć: komunikat');
  await page.setInputFiles('[data-photo=front]', { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
  await page.waitForTimeout(200);
  ok((await txt(page, '#addMsg')).includes('nie jest zdjęcie'), 'plik nie-zdjęcie: odrzucony');
  for (const k of ['front', 'ingredients', 'nutrition']) { await page.setInputFiles(`[data-photo=${k}]`, { name: k + '.png', mimeType: 'image/png', buffer: PNG }); await page.waitForTimeout(250); }
  ok((await txt(page, '#photoCount')).includes('3 z 3'), '3 zdjęcia gotowe');
  const p0 = await pts(page);
  await page.click('#addSend'); await page.waitForTimeout(600);
  ok(o.proxyCalls === 1, 'jedno wysłanie do pośrednika');
  ok(/name="code"[\s\S]*?\d{13}/.test(o.lastBody) && o.lastBody.includes('photo_front') && !/password|user_id/i.test(o.lastBody), 'wysyłamy kod i zdjęcia, bez haseł');
  ok(await page.locator('#celebrate').isVisible(), 'gratulacje na pełny ekran');
  ok((await txt(page, '#celebrate')).includes('Odkrywca'), 'odznaka Odkrywca');
  await page.screenshot({ path: SHOTS + 'e-celebrate.png' });
  await page.keyboard.press('Tab');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.dataset.act === 'cel-ok'), 'fokus zostaje w gratulacjach');
  await closeCelebrations(page);
  ok(await pts(page) >= p0 + 100, 'nagroda: +50 i odznaka +50 (' + (await pts(page) - p0) + ')');
  ok(await page.evaluate(() => App.game.inventory.seed_golden_carrot === 1), 'złota marchewka w nagrodach');
  ok(await page.locator('#addDone').count() === 1, 'podziękowanie po wysłaniu');
  // krok 2: skład odczytany ze zdjęcia, do sprawdzenia
  await page.waitForSelector('#cmpIngr', { timeout: 5000 });
  ok(await page.inputValue('#cmpIngr') === 'mleko, truskawki 8%, cukier, kultury bakterii', 'skład z OCR bez „Skład:” i daty (' + await page.inputValue('#cmpIngr') + ')');
  await page.screenshot({ path: SHOTS + 'e-complete-ingr.png', fullPage: true });
  const p1 = await pts(page);
  await page.click('[data-cmp=save-ingr]'); await page.waitForTimeout(400);
  ok(o.edits.length === 1 && /ingredients_text/.test(o.edits[0]) && !/password/.test(o.edits[0]), 'skład wysłany do pośrednika');
  ok(await pts(page) === p1 + 10, 'skład: +10 pkt');
  // krok 3: wartości odżywcze
  await page.waitForSelector('[data-nut=energy-kcal]');
  await page.fill('[data-nut=energy-kcal]', '95'); await page.fill('[data-nut=fat]', '2,5'); await page.fill('[data-nut=saturated-fat]', '4');
  await page.click('[data-cmp=save-nut]');
  ok((await txt(page, '#cmpNutMsg')).length > 0, 'wartości: brakujące albo sprzeczne dane, komunikat');
  for (const [k, v] of [['saturated-fat', '1,6'], ['carbohydrates', '14'], ['sugars', '13'], ['proteins', '3,2'], ['salt', '0,1']]) await page.fill(`[data-nut=${k}]`, v);
  await page.click('[data-cmp=save-nut]'); await page.waitForTimeout(400);
  ok(o.edits.length === 2 && decodeURIComponent(o.edits[1]).includes('"saturated-fat":1.6'), 'wartości wysłane z przecinkiem zamienionym na kropkę');
  ok(await pts(page) === p1 + 20, 'wartości: +10 pkt');
  await page.waitForSelector('#completeBox [data-act=retry]');
  await page.click('#completeBox [data-act=retry]'); await page.waitForTimeout(3500);
  ok(await page.locator('#matchBox').count() === 1 && await page.locator('#addedNote').count() === 1, 'od razu ocena z wpisanych danych i informacja o kilku minutach');
  ok((await txt(page, '#scr-product')).includes('Pełny skład'), 'skład widoczny przy produkcie');
  await page.screenshot({ path: SHOTS + 'e-added-product.png', fullPage: true });
  // ponowny skan tego samego kodu: produkt z danymi, nie „Ojej…”
  await go(page, '#/'); await go(page, '#/p/' + C.missing); await page.waitForTimeout(3500);
  ok(await page.locator('#notFound').count() === 0 && await page.locator('#addedNote').count() === 1, 'ponowny skan: produkt zamiast „Ojej…”');
  // drugi raz ten sam kod: bez punktów
  await page.evaluate(code => App.sendAdd({ id: 'x', code, name: 'Jogurt', lang: 'pl', uuid: App.appUuid(), photos: {} }), C.missing);
  ok(await page.evaluate(() => App.game.counters.product_added) === 1, 'ten sam kod nie daje drugiej nagrody');
  // odrzucenie
  o.proxyMode = 'reject';
  await go(page, '#/p/' + C.missing2); await page.waitForTimeout(600);
  await page.fill('#addName', 'Inny');
  for (const k of ['front', 'ingredients', 'nutrition']) { await page.setInputFiles(`[data-photo=${k}]`, { name: k + '.png', mimeType: 'image/png', buffer: PNG }); await page.waitForTimeout(200); }
  await page.click('#addSend'); await page.waitForTimeout(500);
  ok((await txt(page, '#addMsg')).includes('nie przyjęła'), 'odrzucenie: komunikat');
  ok(await page.locator('#addSend').isEnabled(), 'po odrzuceniu można poprawić');
  // awaria: kolejka i ponowne wysłanie
  o.proxyMode = 'fail';
  await page.click('#addSend'); await page.waitForTimeout(500);
  ok((await txt(page, '#addMsg')).includes('wyślemy'), 'awaria: zapisane do wysłania');
  o.proxyMode = 'ok';
  await page.evaluate(() => App.flushAdds()); await page.waitForTimeout(600);
  ok(await page.evaluate(() => App.game.counters.product_added) === 2, 'kolejka wysłana po powrocie sieci');
  ok(!page.errs.length, 'brak błędów JS: ' + page.errs.join(' | '));
  await ctx.close();
});

/* 6b. Uzupełnianie produktu z bazy, któremu brakuje danych */
await section('Uzupełnij istniejący produkt', async () => {
  const o = { proxy: true, ocrFail: true };
  const { ctx, page } = await fresh(o);
  await page.evaluate(() => { App.settings.guess = false; App.saveSettings(); });
  await go(page, '#/p/' + C.oil); await page.waitForTimeout(800);
  ok(await page.locator('[data-act=complete]').count() === 1, 'brak składu: przycisk „Uzupełnij”');
  await page.click('[data-act=complete]'); await page.waitForTimeout(500);
  ok(await page.locator('[data-complete-photo=ingredients]').count() === 1, 'brak zdjęcia składu: prośba o zdjęcie');
  await page.fill('#cmpIngr', 'oliwa z oliwek extra virgin 100%');
  await page.click('[data-cmp=save-ingr]'); await page.waitForTimeout(500);
  ok(o.edits.length === 1, 'skład zapisany');
  ok(await page.locator('[data-nut=energy-kcal]').count() === 0, 'wartości już były: bez drugiego kroku');
  ok((await page.$eval('#scr-product', e => e.textContent)).includes('oliwa z oliwek extra virgin 100%'), 'skład od razu w produkcie');
  ok(await page.locator('[data-act=complete]').count() === 0, 'po uzupełnieniu karta znika');
  await go(page, '#/p/' + C.nutella); await page.waitForTimeout(800);
  ok(await page.locator('[data-act=complete]').count() === 0, 'pełny produkt: bez karty');
  ok(!page.errs.length, 'brak błędów JS: ' + page.errs.join(' | '));
  await ctx.close();
});

/* 7. Zamienniki */
await section('Zamień na lepsze', async () => {
  const { ctx, page } = await fresh({ profile: { goals: ['sugar'] } });
  await page.evaluate(() => { App.settings.guess = false; App.saveSettings(); });
  await go(page, '#/p/' + C.nutella); await page.waitForTimeout(500);
  await page.waitForSelector('#catBody [data-act=swap-alt]', { timeout: 4000 });
  const pcts = await page.$$eval('#catBody .item.alt .pct', els => els.map(e => parseInt(e.textContent)));
  ok(pcts.length && pcts.every(v => v >= 50), 'zamienniki tylko z dobrym dopasowaniem (' + pcts + ')');
  const p0 = await pts(page);
  await page.click('#catBody [data-act=swap-alt]'); await page.waitForTimeout(200);
  ok(await pts(page) === p0 + 15, 'zamiana +15');
  ok(await page.evaluate(() => App.shelves.shelves[0].items.length) === 1, 'zamiennik na półce');
  await go(page, '#/'); await page.waitForTimeout(200);
  await noOverflow(page, 'ekran główny');
  await page.screenshot({ path: SHOTS + 'e-home-swap.png', fullPage: true });
  ok(!page.errs.length, 'brak błędów JS: ' + page.errs.join(' | '));
  await ctx.close();
});

/* 8. Półki */
await section('Półki', async () => {
  const { ctx, page } = await fresh();
  await go(page, '#/polki');
  await page.click('#addItemForm button');
  ok((await txt(page, '#itemMsg')).includes('Wpisz'), 'pusta rzecz: komunikat');
  for (const n of ['mleko', 'chleb', 'jabłka']) { await page.fill('#addItemInput', n); await page.press('#addItemInput', 'Enter'); await page.waitForTimeout(80); }
  await page.fill('#addItemInput', '  MLEKO '); await page.press('#addItemInput', 'Enter');
  ok((await txt(page, '#itemMsg')).includes('już jest'), 'duplikat: komunikat');
  ok(await page.inputValue('#addItemInput') === '  MLEKO ', 'po błędzie tekst zostaje w polu');
  ok(await page.locator('.dept-h').count() >= 2, 'rzeczy ułożone wg działów');
  await page.fill('#addItemInput', '<img src=x onerror="window.__xss=21">'); await page.press('#addItemInput', 'Enter');
  await noXss(page, 'półka');
  await page.click('.sitem:has-text("img") [data-act=item-remove]');
  const p0 = await pts(page);
  for (const id of await page.$$eval('[data-act=item-toggle]', els => els.map(e => e.dataset.id))) { await page.check(`[data-act=item-toggle][data-id="${id}"]`); await page.waitForTimeout(80); }
  await closeCelebrations(page);
  ok(await pts(page) >= p0 + 10, 'cała lista kupiona: +10 i odznaka');
  ok(await page.evaluate(() => App.game.counters.list_completed) === 1, 'lista ukończona liczona raz');
  await page.uncheck('[data-act=item-toggle] >> nth=0'); await page.check('[data-act=item-toggle] >> nth=0'); await page.waitForTimeout(100);
  ok(await page.evaluate(() => App.game.counters.list_completed) === 1, 'odhaczanie w kółko nie nabija punktów');
  await page.click('[data-act=shelf-clear]');
  ok(await page.locator('.sitem').count() === 0, 'usuń kupione');
  // nowe półki do limitu
  for (const n of ['Grill', 'grill', '', 'Impreza']) {
    await page.click('[data-act=shelf-new]').catch(() => { });
    if (await page.locator('#newShelfName').count()) { await page.fill('#newShelfName', n); await page.press('#newShelfName', 'Enter'); await page.waitForTimeout(80); }
  }
  ok(await page.evaluate(() => App.shelves.shelves.length) === 3, '3 darmowe półki');
  await page.click('[data-act=shelf-new]');
  ok(await page.locator('#shelfLimit').isVisible(), 'limit półek: informacja o Plus');
  await page.screenshot({ path: SHOTS + 'e-shelves-limit.png' });
  await page.click('[data-act=shelf-cancel]');
  // zmiana nazwy na istniejącą
  await page.click('[data-act=shelf-rename]'); await page.fill('#renameInput', 'Grill'); await page.press('#renameInput', 'Enter');
  ok((await txt(page, '#shelfMsg')).length > 0, 'nazwa zajęta: komunikat');
  // usuwanie
  await page.click('[data-act=shelf-delete]'); await page.click('[data-act=shelf-delete-no]');
  ok(await page.evaluate(() => App.shelves.shelves.length) === 3, '„Zostaw” nie usuwa');
  for (let i = 0; i < 4; i++) { await page.click('[data-act=shelf-delete]'); await page.click('[data-act=shelf-delete-yes]'); await page.waitForTimeout(80); }
  ok(await page.evaluate(() => App.shelves.shelves.length) === 1, 'zawsze zostaje jedna półka');
  // udostępnianie
  await page.fill('#addItemInput', 'banany'); await page.press('#addItemInput', 'Enter');
  await page.click('[data-act=shelf-share]'); await page.waitForTimeout(200);
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok(clip.includes('banany'), 'udostępnij: lista w schowku');
  await noOverflow(page, 'półki');
  await page.reload(); await page.waitForTimeout(300);
  ok(await page.locator('.sitem').count() === 1, 'półka przetrwała odświeżenie');
  ok(!page.errs.length, 'brak błędów JS: ' + page.errs.join(' | '));
  await page.screenshot({ path: SHOTS + 'e-shelves.png', fullPage: true });
  await ctx.close();
});

/* 9. Postępy i profil */
await section('Postępy i profil', async () => {
  const { ctx, page } = await fresh();
  await go(page, '#/postepy');
  ok(await page.locator('#medals .medal-btn').count() === 9, '9 odznak wersji 1.0');
  await page.click('[data-act=ach-cat][data-cat=baza]');
  ok(await page.locator('#medals .medal-btn').count() === 2, 'filtr kategorii');
  await page.click('[data-act=ach-pick] >> nth=1');
  ok((await txt(page, '#achDetail')).length > 5, 'szczegóły odznaki');
  await noOverflow(page, 'postępy');
  await go(page, '#/profil');
  for (const k of ['weight', 'muscle', 'cholesterol', 'pressure']) await page.click(`[data-act=prof-goal][data-k=${k}]`);
  ok(await page.locator('[data-act=prof-goal][aria-pressed=true]').count() === 3, 'profil: limit celów');
  await page.click('[data-act=add-custom]');
  ok((await txt(page, '#customMsg')).length > 0, 'pusty własny składnik: komunikat');
  await page.fill('#customInput', 'czosnek'); await page.press('#customInput', 'Enter');
  await page.fill('#customInput', 'Czosnek'); await page.press('#customInput', 'Enter');
  ok((await txt(page, '#customMsg')).length > 0, 'duplikat składnika: komunikat');
  ok(await page.evaluate(() => App.current.screen) === 'profile', 'Enter w polu składnika nie zapisuje profilu');
  await page.fill('#customInput', 'kakao');
  await page.click('label.pchip:has(input[name=allergens][value=nuts])');
  await page.fill('#profName', 'Ola');
  await page.click('#profileForm button[type=submit]'); await page.waitForTimeout(300);
  const prof = await page.evaluate(() => App.profile);
  ok(prof.custom.includes('czosnek') && prof.custom.includes('kakao'), 'wpisany, niedodany składnik też zapisany');
  ok(prof.allergens.includes('nuts') && prof.goals.length === 3, 'zapis profilu');
  ok(await page.evaluate(() => App.current.screen) === 'home', 'po zapisie ekran główny');
  ok((await txt(page, '#scr-home h1')).includes('Ola'), 'nowe imię');
  // zapis bez przycisku: zmiana i wyjście z ekranu
  await go(page, '#/profil');
  await page.click('label.pchip:has(input[name=allergens][value=eggs])');
  await page.click('[data-act=prof-goal][data-k=muscle]');
  ok(await page.locator('#saveState.on').count() === 1, 'informacja „Zapisano”');
  await page.fill('#profName', 'Ewa'); await page.waitForTimeout(700);
  await page.click('.tab[data-tab=home]'); await page.waitForTimeout(300);
  const p2 = await page.evaluate(() => [App.profile, App.userName()]);
  ok(p2[0].allergens.includes('eggs') && !p2[0].goals.includes('muscle') && p2[1] === 'Ewa', 'zmiany zapisane bez przycisku (' + JSON.stringify([p2[0].allergens, p2[0].goals, p2[1]]) + ')');
  await page.reload(); await page.waitForTimeout(300);
  ok(await page.evaluate(() => App.profile.allergens.includes('eggs')), 'zapis przetrwał odświeżenie');
  // usuwanie danych
  await go(page, '#/profil');
  await page.click('[data-act=wipe]'); await page.click('[data-act=wipe-no]');
  ok(await page.evaluate(() => !!localStorage.getItem('dcn-profile')), '„Zostaw” nie usuwa danych');
  await page.click('[data-act=wipe]');
  await Promise.all([page.waitForEvent('load'), page.click('[data-act=wipe-yes]')]);
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => App.current.screen) === 'start', 'po usunięciu danych start od nowa');
  ok(await page.evaluate(() => App.game.points) === 0, 'punkty wyzerowane');
  ok(!page.errs.length, 'brak błędów JS: ' + page.errs.join(' | '));
  await ctx.close();
});

/* 10. Zgłoszenia, skaner, dialogi */
await section('Zgłoszenia i skaner', async () => {
  const { ctx, page } = await fresh();
  await page.evaluate(() => { App.settings.guess = false; App.saveSettings(); });
  await go(page, '#/p/' + C.oil); await page.waitForTimeout(500);
  await page.click('[data-act=report]');
  ok(await page.locator('#reportDlg').isVisible(), 'okno zgłoszenia');
  await page.click('#repSend');
  ok((await txt(page, '#repMsg')).includes('Wybierz'), 'bez powodu: komunikat');
  await page.check('input[name=repReason][value=other]'); await page.click('#repSend');
  ok((await txt(page, '#repMsg')).includes('Opisz'), '„Inny” bez opisu: komunikat');
  await page.fill('#repComment', 'Na opakowaniu jest inaczej');
  ok((await txt(page, '#repCount')).startsWith('26'), 'licznik znaków');
  await page.fill('#repEmail', 'zly@adres'); await page.click('#repSend');
  ok((await txt(page, '#repMsg')).includes('niepełny'), 'zły e-mail: komunikat');
  await page.fill('#repEmail', '');
  await page.click('#repSend'); await page.waitForTimeout(200);
  ok((await txt(page, '#repMsg')).includes('pocztę'), 'zgłoszenie: otwieramy pocztę');
  await page.keyboard.press('Escape');
  await page.click('[data-act=how]').catch(async () => { await page.click('[data-ev=why] summary'); await page.click('[data-act=how]'); });
  ok(await page.locator('#howDlg').isVisible(), 'okno „Jak oceniamy”');
  await page.click('#howDlg [data-act=close-dlg]');
  // skaner (brak aparatu w teście)
  await page.click('.tab-scan'); await page.waitForTimeout(500);
  ok(await page.locator('#scanner').isVisible(), 'skaner się otwiera');
  ok(await page.locator('#scanErr').isVisible(), 'bez aparatu: komunikat i wpisywanie ręczne');
  await page.fill('#scanCode', 'abc'); await page.press('#scanCode', 'Enter');
  ok((await txt(page, '#scanMsg')).length > 0, 'skaner: zły kod');
  ok(await page.locator('#scanner').isVisible(), 'skaner zostaje przy złym kodzie');
  await page.setInputFiles('#codePhoto', { name: 'k.png', mimeType: 'image/png', buffer: PNG }); await page.waitForTimeout(1200);
  ok((await txt(page, '#scanMsg')).length > 0, 'zdjęcie bez kodu: komunikat');
  await page.keyboard.press('Escape');
  ok(await page.locator('#scanner').isHidden(), 'Escape zamyka skaner');
  await page.click('.tab-scan'); await page.waitForTimeout(300);
  await page.fill('#scanCode', C.ham); await page.press('#scanCode', 'Enter'); await page.waitForTimeout(600);
  ok(await page.locator('#scanner').isHidden() && await page.evaluate(() => App.current.arg) === C.ham, 'kod wpisany w skanerze otwiera produkt');
  ok(!page.errs.length, 'brak błędów JS: ' + page.errs.join(' | '));
  await ctx.close();
});

/* 11. Listy „Najlepsze” */
await section('Listy najlepszych', async () => {
  const o = {};
  const { ctx, page } = await fresh(o);
  await page.click('a[href="#/najlepsze"] >> nth=0'); await page.waitForTimeout(250);
  ok(await page.evaluate(() => App.current.screen) === 'cats', 'osobny ekran kategorii');
  ok(await page.locator('.cat-link').count() >= 40, 'co najmniej 40 kategorii (' + await page.locator('.cat-link').count() + ')');
  await page.fill('#catSearch', 'ser');
  const vis = await page.$$eval('.cat-link:not([hidden])', els => els.map(e => e.textContent.replace('›', '').trim()));
  ok(vis.includes('Sery') && vis.includes('Twarogi i serki') && vis.length === 2, 'szukanie kategorii (' + vis.join(', ') + ')');
  await page.fill('#catSearch', 'xyzq');
  ok(await page.locator('#catNone').isVisible(), 'brak wyników: komunikat');
  await page.fill('#catSearch', '');
  await noOverflow(page, 'kategorie');
  await page.screenshot({ path: SHOTS + 'e-cats.png', fullPage: true });
  await page.click('.cat-link[href="#/lista/en:yogurts"]'); await page.waitForTimeout(600);
  ok(o.searchCalls === 1, 'jedno zapytanie na kategorię (było ' + o.searchCalls + ')');
  ok(await page.locator('#shopList .item').count() >= 3, '„Wszystkie sklepy” pokazuje produkty');
  ok((await txt(page, '[data-act=list-store][data-store=all]')).includes('Wszystkie'), 'przycisk wszystkie sklepy');
  ok(await page.locator('[data-act=list-store][data-store=lidl]').count() === 1 && await page.locator('[data-act=list-store][data-store=dino]').count() === 0, 'sklepy tylko z produktami, z liczbą');
  await noXss(page, 'lista');
  await page.click('[data-act=list-store][data-store=lidl]'); await page.waitForTimeout(250);
  const names = await page.$$eval('#shopList .t1', els => els.map(e => e.textContent));
  ok(names.length >= 1 && names.every(n => /Skyr|truskawk/.test(n)), 'filtr Lidl (' + names + ')');
  ok(o.searchCalls === 1, 'zmiana sklepu bez nowego zapytania');
  await page.click('[data-act=list-store][data-store=all]'); await page.waitForTimeout(200);
  const p0 = await pts(page);
  await page.click('#shopList [data-act=shelf-add-code] >> nth=0');
  ok(await pts(page) === p0 + 5, 'dodanie z listy +5');
  await page.screenshot({ path: SHOTS + 'e-list.png', fullPage: true });
  await noOverflow(page, 'lista');
  // kategoria bez dobrych produktów: najlepsze z dostępnych
  await go(page, '#/lista/en:hazelnut-spreads');
  await go(page, '#/lista/en:sweet-spreads'); await page.waitForTimeout(500);
  ok((await txt(page, '#listBody')).includes('nie ma jeszcze produktów') || (await txt(page, '#listBody')).length > 10, 'pusta kategoria: komunikat');
  ok(!page.errs.length, 'brak błędów JS: ' + page.errs.join(' | '));
  await ctx.close();
  // wyszukiwarka niedostępna: jedna automatyczna próba, potem przycisk
  const f = await fresh({ searchFail: true, hash: '#/lista/en:cheeses' });
  await f.page.waitForTimeout(7000);
  ok(f.opts.searchCalls === 2, 'awaria: jedna automatyczna ponowna próba (' + f.opts.searchCalls + ')');
  ok(await f.page.locator('#listBody [data-act=list-store]').count() === 1, 'awaria: przycisk ponów');
  f.opts.searchFail = false;
  await f.page.click('#listBody [data-act=list-store]'); await f.page.waitForTimeout(600);
  ok(!(await f.page.locator('#listBody .sk').count()), 'po ponowieniu treść zamiast szkieletu');
  await f.ctx.close();
  // z pośrednikiem: lista z /category
  const pr = await fresh({ proxy: true, hash: '#/lista/en:yogurts' });
  await pr.page.waitForTimeout(600);
  ok(pr.opts.categoryCalls === 1 && pr.opts.searchCalls === 0, 'z pośrednikiem: zapytanie do pośrednika, nie do starej wyszukiwarki');
  ok(await pr.page.locator('#shopList .item').count() >= 1, 'z pośrednikiem: produkty');
  ok((await txt(pr.page, '#listBody')).includes('Sklep:'), 'sklep przy produkcie');
  await pr.ctx.close();
});

/* 11b. Bez celów: ocena ogólna; zdjęcie; porównanie */
await section('Bez celów, zdjęcie, porównanie', async () => {
  const o = { searchDelay: 1500 };
  const { ctx, page } = await fresh(o);
  await go(page, '#/p/' + C.nutella); await page.waitForTimeout(500);
  ok((await txt(page, '#guessBox h2')).trim() === 'Zgadnij: dobre czy nie?', 'bez celów: pytanie bez „dla Ciebie”');
  await page.click('[data-act=guess][data-v=skip]'); await page.waitForTimeout(200);
  ok((await txt(page, '#matchBox')).includes('OCENA OGÓLNA') && !(await txt(page, '#matchBox')).includes('dopasowanie'), 'bez celów: ocena ogólna zamiast dopasowania');
  ok(await page.locator('#generalNote a[href="#/profil"]').count() === 1, 'bez celów: zachęta do ustawienia celów');
  // wielokrotne klikanie „Spróbuj ponownie” nie mnoży zapytań
  const before = o.searchCalls;
  for (let i = 0; i < 4; i++) await page.evaluate(() => App.retryCategory());
  await page.waitForTimeout(6000);
  ok(o.searchCalls - before <= 3, 'porównanie: brak zalewu zapytań (' + (o.searchCalls - before) + ')');
  ok(await page.locator('#catBody .pctl, #catBody p').count() >= 1 && !(await page.locator('#catBody .sk').count()), 'porównanie się wyświetla');
  // zdjęcie
  await page.click('[data-act=photo-open]'); await page.waitForTimeout(200);
  ok(await page.locator('#photoDlg').isVisible(), 'zdjęcie na pełny ekran');
  ok(/400\.jpg/.test(await page.getAttribute('#photoBox img', 'src')), 'duże zdjęcie');
  await page.screenshot({ path: SHOTS + 'e-photo.png' });
  await page.click('[data-act=photo-report]'); await page.waitForTimeout(150);
  ok(await page.locator('#reportDlg').isVisible() && await page.isChecked('input[name=repReason][value=photo]'), 'zgłoszenie złego zdjęcia');
  await page.keyboard.press('Escape');
  ok(!page.errs.length, 'brak błędów JS: ' + page.errs.join(' | '));
  await ctx.close();
  // cel „mniej soli”: szynka 2,4 g soli nie może być dobra
  const s = await fresh({ profile: { goals: ['pressure'] } });
  await s.page.evaluate(() => { App.settings.guess = false; App.saveSettings(); });
  await go(s.page, '#/p/' + C.ham); await s.page.waitForTimeout(500);
  const pmh = await s.page.evaluate(() => App.currentProduct().pm);
  ok(pmh.pct <= 45 && (await txt(s.page, '#matchBox')).includes('najwyżej 45%'), 'cel mniej soli: dużo soli = najwyżej 45% z wyjaśnieniem');
  await s.ctx.close();
});

/* 11c. Własna kopia bazy (data/) */
await section('Kopia bazy', async () => {
  // Baza na żywo wolna: najpierw kopia, potem pełne dane.
  const o = { snapshot: true, offSlow: 4500 };
  const { ctx, page } = await fresh(o);
  await page.evaluate(() => { App.settings.guess = false; App.saveSettings(); });
  const t0 = Date.now();
  await go(page, '#/p/' + C.nutella);
  await page.waitForSelector('#matchBox', { timeout: 6000 });
  const ms = Date.now() - t0;
  ok(ms < 4000, 'produkt z kopii w mniej niż 4 s (' + ms + ' ms)');
  ok(await page.locator('#snapNote').count() === 1, 'informacja o danych z kopii');
  await page.waitForSelector('#catBody .pctl, #catBody .item, #catBody p', { timeout: 5000 });
  ok(o.searchCalls === 0, 'porównanie bez wyszukiwarki OFF (' + o.searchCalls + ')');
  await page.waitForFunction(() => !document.getElementById('snapNote'), null, { timeout: 8000 });
  ok((await txt(page, '#scr-product')).includes('Pełny skład'), 'po odpowiedzi bazy pełny skład');
  ok(await page.evaluate(() => App.game.counters.product_checked) === 1, 'punkty za sprawdzenie tylko raz');
  // Lista z kopii: od razu, bez wyszukiwarki.
  const t1 = Date.now();
  await go(page, '#/lista/en:yogurts');
  await page.waitForSelector('#shopList .item', { timeout: 3000 });
  ok(Date.now() - t1 < 2000 && o.searchCalls === 0, 'lista z kopii od razu');
  // Kategoria, której nie ma w kopii (mniej niż 5 produktów): szybka odpowiedź zamiast czekania.
  await go(page, '#/lista/en:pizzas'); await page.waitForTimeout(400);
  ok((await txt(page, '#listBody')).includes('nie ma jeszcze produktów'), 'brak kategorii w kopii: od razu komunikat');
  ok(!page.errs.length, 'brak błędów JS: ' + page.errs.join(' | '));
  await ctx.close();
  // Baza na żywo nie działa: produkt i tak się otwiera.
  const d = await fresh({ snapshot: true, offDown: true });
  await d.page.evaluate(() => { App.settings.guess = false; App.saveSettings(); });
  await go(d.page, '#/p/' + C.milk); await d.page.waitForTimeout(3500);
  ok(await d.page.locator('#matchBox').count() === 1, 'baza na żywo nie działa: produkt z kopii');
  ok(await d.page.locator('#notFound').count() === 0, 'bez komunikatu o błędzie');
  await go(d.page, '#/p/' + C.missing); await d.page.waitForTimeout(3500);
  ok(await d.page.locator('#notFound').count() === 1, 'produktu nie ma nigdzie: komunikat');
  await d.ctx.close();
});

/* 11d. Statystyki i uwagi */
await section('Statystyki i uwagi', async () => {
  const o = { stats: true, onboarded: false };
  const { ctx, page } = await fresh(o);
  await page.click('[data-act=start-skip]'); await page.waitForTimeout(300);
  const ev = () => o.hits.filter(h => h.e).map(h => h.p), views = () => o.hits.filter(h => !h.e).map(h => h.p);
  ok(ev().includes('nowa-instalacja') && ev().includes('aktywny-tydzien-1'), 'pierwsze otwarcie i tydzień 1 (' + ev() + ')');
  ok(views().includes('/start') && views().includes('/home'), 'odsłony ekranów (' + views() + ')');
  await page.evaluate(() => { App.settings.guess = false; App.saveSettings(); });
  for (const c of [C.nutella, C.milk, C.oil, C.ham, C.msg]) { await go(page, '#/p/' + c); await page.waitForTimeout(600); }
  await go(page, '#/p/' + C.missing); await page.waitForTimeout(700);
  ok(ev().filter(x => x === 'skan-znaleziony').length === 5 && ev().includes('skan-brak'), 'skany znalezione i brak (' + ev().join(',') + ')');
  ok(o.hits.every(h => !/\d{8,}/.test(h.url.replace(/rnd=[^&]*/, ''))), 'bez kodów kreskowych w statystykach');
  ok(o.hits.every(h => !/Ania|milk|mleko/i.test(h.p)), 'bez danych z profilu');
  ok((await txt(page, '#toast')).includes('5 produktów') && /^mailto:/.test(await page.getAttribute('#toast a', 'href')), 'po 5 produktach prośba o uwagi');
  await go(page, '#/profil');
  const href = await page.getAttribute('#feedbackBtn', 'href');
  ok(/^mailto:rafalmsolutions@gmail\.com\?subject=/.test(href) && decodeURIComponent(href).includes('Co przeszkadzało'), 'przycisk „Wyślij uwagi” z szablonem');
  // wyłączenie statystyk
  await page.uncheck('#setStats'); await page.waitForTimeout(200);
  const n = o.hits.length;
  await go(page, '#/polki'); await go(page, '#/p/' + C.nutella); await page.waitForTimeout(600);
  ok(o.hits.length === n, 'po wyłączeniu nic nie wysyłamy');
  ok(!page.errs.length, 'brak błędów JS: ' + page.errs.join(' | '));
  await ctx.close();
  // bez kodu GoatCounter: brak przełącznika i brak wysyłek
  const d = await fresh({ hash: '#/profil' });
  ok(await d.page.locator('#setStats').count() === 0, 'bez konfiguracji: brak przełącznika statystyk');
  await d.ctx.close();
});

/* 12. Zepsute dane i wąski ekran */
await section('Zepsute dane i mały telefon', async () => {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, serviceWorkers: 'block' });
  await setup(ctx);
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('dcn-onboarded', 'true');
    localStorage.setItem('dcn-game', '{"points":"9999999999","counters":{"guess_right":"x"},"sets":{"product_checked":[1,2,null]},"days":7}');
    localStorage.setItem('dcn-shelves', '{"shelves":[{"id":1,"name":null,"items":"zle"}],"active":"nie"}');
    localStorage.setItem('dcn-profile', '{"goals":["xxx","sugar","sugar"],"allergens":"milk","custom":[1,{"a":2}]}');
    localStorage.setItem('dcn-history', 'nie-json');
    localStorage.setItem('dcn-cfg', '[]');
  });
  await page.goto(BASE); await page.waitForTimeout(800);
  ok(await page.evaluate(() => App.current.screen) === 'home', 'zepsute dane: aplikacja startuje');
  for (const h of ['#/polki', '#/postepy', '#/profil', '#/p/' + C.nutella]) { await go(page, h); await page.waitForTimeout(400); await noOverflow(page, '320px ' + h); }
  ok(!errs.length, 'brak błędów JS: ' + errs.join(' | '));
  await page.screenshot({ path: SHOTS + 'e-320.png', fullPage: true });
  await ctx.close();
});

await browser.close();
console.log(`\nWynik: ${pass} OK, ${fail} błędów`);
process.exit(fail ? 1 : 0);
