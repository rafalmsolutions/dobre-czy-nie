// Album odkryć z polowaniem (wersja D): miejsca z warunkami, zgodność z profilem, odsłonięcie, plakat, pełna strona.
// Uruchom: node e2e-d-album.mjs (serwer na porcie 8790).
import { chromium } from 'playwright';
import { setup, C } from './lib.mjs';
import { fileURLToPath } from 'url';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const shots = fileURLToPath(new URL('./shots/', import.meta.url));
const ean = p => { const d = p.split('').map(Number); const s = d.reverse().reduce((a, n, i) => a + n * (i % 2 === 0 ? 3 : 1), 0); return p + ((10 - s % 10) % 10); };
// 31 popularnych jogurtów: zwykłe, naturalne, skyry, bio, bez laktozy, owocowe.
const Y = [];
const add = (n, f) => { for (let i = 0; i < n; i++) Y.push(Object.assign({ code: ean('59100000' + String(Y.length).padStart(4, '0')), brands: 'Testowa', categories_hierarchy: ['en:dairies', 'en:yogurts'], allergens_tags: ['en:milk'], ingredients_analysis_tags: ['en:vegetarian'] }, f(i))); };
add(10, i => ({ product_name_pl: 'Jogurt zwykły ' + i, nutriscore_grade: 'c', nova_group: 4, additives_tags: ['en:e407'], nutriments: { sugars_100g: 10, salt_100g: 0.2, fat_100g: 3.5 } }));
add(6, i => ({ product_name_pl: 'Jogurt naturalny ' + i, nutriscore_grade: 'a', nova_group: 1, additives_tags: [], nutriments: { sugars_100g: 4, salt_100g: 0.1, fat_100g: 3 }, categories_hierarchy: ['en:dairies', 'en:yogurts', 'en:plain-yogurts'] }));
add(3, i => ({ product_name_pl: 'Skyr ' + i, nutriscore_grade: 'a', nova_group: 1, additives_tags: [], nutriments: { sugars_100g: 3.5, proteins_100g: 11, salt_100g: 0.1, fat_100g: 0.2 }, categories_hierarchy: ['en:dairies', 'en:yogurts', 'en:skyrs'] }));
add(2, i => ({ product_name_pl: 'Jogurt bio ' + i, nutriscore_grade: 'b', nova_group: 3, additives_tags: [], labels_tags: ['en:organic'], nutriments: { sugars_100g: 6, salt_100g: 0.1 } }));
add(2, i => ({ product_name_pl: 'Jogurt bez laktozy ' + i, nutriscore_grade: 'b', nova_group: 3, additives_tags: ['en:e1105'], labels_tags: ['en:no-lactose'], nutriments: { sugars_100g: 6, salt_100g: 0.1 } }));
add(8, i => ({ product_name_pl: 'Jogurt truskawkowy ' + i, nutriscore_grade: 'c', nova_group: 4, additives_tags: ['en:e1442'], nutriments: { sugars_100g: 13, salt_100g: 0.1 }, categories_hierarchy: ['en:dairies', 'en:yogurts', 'en:fruit-yogurts'] }));

const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
await ctx.route(/workers\.dev\/category/, r => r.fulfill({ json: { products: Y } }));
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
const closeCel = async () => { for (let i = 0; i < 10; i++) { if (await page.locator('#celebrate').isHidden()) return; await page.click('#celebrate [data-act=cel-ok]'); await page.waitForTimeout(120); } };
await page.addInitScript(() => {
  if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1');
  localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false }));
  localStorage.removeItem('dcn-d-album');
});

// 1. Strona z 10 miejscami
await page.goto('http://localhost:8790/app/index.html#/album/en:yogurts'); await page.waitForTimeout(1500); await closeCel();
await page.screenshot({ path: shots + 'hunt-page.png', fullPage: true });
const slots = await page.evaluate(() => App.slotsOf('en:yogurts'));
ok(slots && slots.length === 10, 'strona ma 10 miejsc');
ok(!slots.some(s => s.id.startsWith('any')) && slots.filter(s => s.tier === 'zwykla').length <= 2, 'bez darmowego „dowolnego produktu”, najwyżej 2 zwykłe miejsca: ' + slots.map(s => s.tier).join(','));
ok(slots.filter(s => s.secret).length === 1 && !slots.find(s => s.secret).tier.startsWith('leg'), 'jedno tajne miejsce, nie legendarne');
ok(new Set(slots.map(s => s.id)).size === 10, 'miejsca się nie powtarzają');
ok(slots.some(s => s.tier === 'rzadka') && slots.some(s => s.tier === 'epicka'), 'są miejsca rzadkie i epickie: ' + slots.map(s => s.label + '/' + s.tier).join(', '));
ok(slots.every((s, i) => i === 0 || ['zwykla', 'rzadka', 'epicka', 'legendarna'].indexOf(s.tier) >= ['zwykla', 'rzadka', 'epicka', 'legendarna'].indexOf(slots[i - 1].tier)), 'miejsca od najłatwiejszych do najtrudniejszych');
ok(await page.locator('#scr-albumpage .ap-empty').count() === 10, '10 pustych miejsc na ekranie');
ok((await page.innerText('#scr-albumpage')).includes('Tajne miejsce'), 'tajne miejsce widoczne jako „Tajne miejsce”');
ok(await page.locator('#scr-albumpage .gal').count() === 1, 'plakat na stronie Jogurty');
// Wskazówki do etykiet: stuknięcie w puste miejsce mówi, jak sprawdzić warunek na opakowaniu.
const tipBtn = page.locator('#scr-albumpage button[data-act=slot-tip]').first();
ok(await page.locator('#scr-albumpage button[data-act=slot-tip]').count() >= 8, 'puste miejsca (poza tajnymi) mają „jak sprawdzić?”');
await tipBtn.click(); await page.waitForTimeout(300);
ok(await page.locator('#slotTip').isVisible() && /etykiecie/.test(await page.innerText('#slotTip')) && (await page.innerText('#slotTip')).length > 60, 'wskazówka do etykiety: ' + (await page.innerText('#slotTip')).slice(0, 90));
await tipBtn.click(); await page.waitForTimeout(200);
ok(await page.locator('#slotTip').isHidden(), 'drugie stuknięcie chowa wskazówkę');
ok(await page.locator('[data-act=gal-demo]').count() === 0, 'bez testowego przycisku „odsłoń cały plakat”');

// 2. Wypełniamy wszystko poza miejscem, które zajmie skan jogurtu naturalnego
const target = await page.evaluate(raw => {
  const p = normalizeProduct(raw, 'off'), slots = App.slotsOf('en:yogurts');
  const t = slots.filter(s => App.slotTest(s, p)).sort((a, b) => a.share - b.share)[0];
  slots.forEach((s, i) => { if (s.id !== t.id) App.album.cards['5919' + String(i).padStart(9, '0')] = { c: '5919' + String(i).padStart(9, '0'), k: 'en:yogurts', slot: s.id, r: s.tier, h: false, s: false, w: false, n: 'Jogurt ' + i, b: 'X', i: '', t: Date.now() - 1e5 + i }; });
  App.albumSave(); return t;
}, { code: C.milk, product_name_pl: 'Jogurt naturalny', nutriscore_grade: 'a', nova_group: 1, additives_tags: [], allergens_tags: ['en:milk'], nutriments: { sugars_100g: 4.5, salt_100g: 0.1 }, categories_hierarchy: ['en:dairies', 'en:yogurts', 'en:plain-yogurts'], ingredients_analysis_tags: ['en:palm-oil-free', 'en:non-vegan', 'en:vegetarian'] });
ok(target && target.share < 1, 'skan trafi na najtrudniejsze pasujące miejsce: ' + (target && target.label));

// 3. Skan → odsłonięcie → pełna strona → plakat
const pts0 = await page.evaluate(() => App.game.points);
await page.goto('http://localhost:8790/app/index.html#/p/' + C.milk); await page.waitForTimeout(1800);
ok(!(await page.locator('#reveal').isVisible()) && !(await page.locator('#celebrate').isVisible()), 'po skanie: nic nie zasłania wyniku');
ok(await page.locator('#rwBar').isVisible() && /Nowa karta/.test(await page.innerText('#rwBar')), 'po skanie: pasek „Nowa karta · Odbierz”: ' + (await page.innerText('#rwBar').catch(() => '')).replace(/\n/g, ' | '));
ok(await page.locator('#scr-product .fam-ans, #scr-product .d-badge').count() >= 1, 'wynik widoczny od razu');
ok(await page.evaluate(() => App.game.points) > pts0, 'punkty za kartę od razu po skanie');
await page.screenshot({ path: shots + 'hunt-bar.png' });
await page.click('#rwBar [data-act=rw-open]'); await page.waitForTimeout(400);
ok(await page.locator('#reveal').isVisible(), '„Odbierz”: odsłonięcie karty');
ok((await page.innerText('#reveal')).includes(target.secret ? '???' : target.label), 'na odwrocie karty nazwa miejsca');
await page.screenshot({ path: shots + 'hunt-back.png' });
await page.click('[data-act=reveal-flip]', { force: true }); await page.waitForTimeout(300); await page.waitForTimeout(900);
await page.screenshot({ path: shots + 'hunt-front.png' });
ok(await page.evaluate(([c, t]) => App.album.cards[c] && App.album.cards[c].slot === t, [C.milk, target.id]), 'karta zajęła właściwe miejsce');
ok((await page.innerText('#reveal')).includes('1 na'), 'opis rzadkości „1 na …”');
ok(/Na etykiecie:/.test(await page.innerText('#reveal')), 'odsłonięta karta: „Na etykiecie: …”');
ok(await page.locator('[data-act=reveal-page]').count() === 1, 'ostatnie miejsce: przycisk „Dalej” do pełnej strony');
await closeCel(); await page.click('[data-act=reveal-page]'); await page.waitForTimeout(900);
ok((await page.innerText('#reveal')).toLowerCase().includes('ukończona') && await page.locator('#reveal .gal.full').count() === 1, 'gratulacje i odsłonięty plakat');
await page.screenshot({ path: shots + 'hunt-done.png' });
await page.click('#reveal [data-act=reveal-album]'); await page.waitForTimeout(900);
ok(await page.locator('#scr-albumpage .gal.full .gal-t.open').count() === 10, 'strona: plakat odsłonięty w całości');

// 4. Ponowny skan i produkt bez wolnego miejsca
await page.goto('http://localhost:8790/app/index.html#/'); await page.waitForTimeout(400);
await page.goto('http://localhost:8790/app/index.html#/p/' + C.milk); await page.waitForTimeout(1200);
ok(!(await page.locator('#reveal').isVisible()), 'ponowny skan: bez nowej karty');
const r1 = await page.evaluate(raw => App.albumAdd(normalizeProduct(raw, 'off')), Object.assign({}, Y[0], { code: ean('591900000999') }));
ok(r1 && r1.noSlot, 'pełna strona: kolejny jogurt nie zajmuje miejsca');

// 5. Zgodność z profilem
const r2 = await page.evaluate(raw => { App.profile = cleanProfile({ watch: ['sugar'] }); return App.albumAdd(normalizeProduct(raw, 'off')); }, { code: ean('591900000888'), product_name_pl: 'Jogurt słodki', categories_hierarchy: ['en:dairies', 'en:yogurts'], nutriscore_grade: 'e', nova_group: 4, additives_tags: [], nutriments: { sugars_100g: 30 } });
ok(r2 && r2.incompatible, 'dużo cukru przy „Pilnuję cukru”: nie trafia do albumu');
ok(await page.evaluate(() => { App.profile = cleanProfile({ diet: ['vegan'] }); return App.pageHidden('en:yogurts') && !App.albumPages().some(p => p.key === 'en:yogurts'); }), 'dieta wegańska: strona Jogurty ukryta');
await page.evaluate(() => { App.profile = cleanProfile({}); });

// 6. Album: polowanie tygodnia i lista stron
await page.goto('http://localhost:8790/app/index.html#/album'); await page.waitForTimeout(800); await closeCel();
await page.screenshot({ path: shots + 'hunt-album.png', fullPage: true });
ok((await page.innerText('#scr-album')).includes('Polowanie tygodnia'), 'album: polowanie tygodnia');

// 7. Stare karty (bez miejsc) trafiają na miejsca przy pierwszym otwarciu strony
const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx2, {});
await ctx2.route(/workers\.dev\/category/, r => r.fulfill({ json: { products: Y } }));
const p2 = await ctx2.newPage(); p2.on('pageerror', e => errs.push(e.message));
await p2.addInitScript(y => {
  if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1');
  localStorage.setItem('dcn-onboarded', 'true');
  const cards = { [y[16].code]: { c: y[16].code, k: 'en:yogurts', r: 'epicka', h: false, s: false, w: false, n: 'Skyr 0', b: '', i: '', t: 1 }, '5900000000000': { c: '5900000000000', k: 'en:yogurts', r: 'zwykla', n: 'Nieznany', t: 2 } };
  localStorage.setItem('dcn-d-album', JSON.stringify({ cards, done: {}, weeks: {} })); localStorage.setItem('dcn-d-album-v', '2');
}, Y);
await p2.goto('http://localhost:8790/app/index.html#/album/en:yogurts'); await p2.waitForTimeout(1800);
const mig = await p2.evaluate(c => ({ skyr: App.album.cards[c], unknown: App.album.cards['5900000000000'] }), Y[16].code);
ok(mig.skyr && mig.skyr.slot && !mig.skyr.legacy, 'stara karta skyru dostała miejsce: ' + (mig.skyr && mig.skyr.slot));
ok(!mig.unknown, 'stara karta bez danych produktu usunięta');
// podpowiedź do tajnego miejsca po 5 skanach
await p2.evaluate(() => { App.album.seen['en:yogurts'] = 5; App.albumSave(); });
await p2.goto('http://localhost:8790/app/index.html#/album'); await p2.waitForTimeout(300);
await p2.goto('http://localhost:8790/app/index.html#/album/en:yogurts'); await p2.waitForTimeout(900);
ok((await p2.innerText('#scr-albumpage')).includes('Podpowiedź: chodzi o'), 'podpowiedź do tajnego miejsca po 5 skanach');

ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
