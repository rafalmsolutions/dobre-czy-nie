// Zrzuty aplikacji do strony promującej: produkty bez prawdziwych marek, zdjęcia = talerze kategorii z aplikacji.
// Uruchom z katalogu tests/: node landshots.mjs <folder_wyjściowy>  (serwer na 8790)
import { chromium } from 'playwright';
import fs from 'fs';
const OUT = process.argv[2], APP = '/home/claude/dobre-czy-nie/';
const ean = p => { const d = p.split('').map(Number); const s = d.reverse().reduce((a, n, i) => a + n * (i % 2 === 0 ? 3 : 1), 0); return p + ((10 - s % 10) % 10); };
const img = (code, cat) => ({ image_front_small_url: `https://images.openfoodfacts.org/images/products/${code}/front_pl.200.jpg`, image_front_url: `https://images.openfoodfacts.org/images/products/${code}/front_pl.400.jpg`, _cat: cat });
const mk = (n, o) => { const code = ean(n); return Object.assign({ code }, img(code, o.cat), o); };
const P = [
  mk('590777000001', { cat: 'quarks', product_name_pl: 'Skyr naturalny', brands: 'Mleczarnia Dolina', quantity: '150 g', nutriscore_grade: 'a', nova_group: 1, additives_tags: [], allergens_tags: ['en:milk'], ingredients_text_pl: 'mleko odtłuszczone, żywe kultury bakterii', nutriments: { 'energy-kcal_100g': 63, sugars_100g: 3.5, salt_100g: 0.1, 'saturated-fat_100g': 0.1, proteins_100g: 11, fat_100g: 0.2 }, categories_hierarchy: ['en:dairies', 'en:yogurts'] }),
  mk('590777000002', { cat: 'yogurts', product_name_pl: 'Jogurt grecki truskawkowy', brands: 'Mleczarnia Dolina', quantity: '400 g', nutriscore_grade: 'c', nova_group: 4, additives_tags: ['en:e1422', 'en:e120'], allergens_tags: ['en:milk'], ingredients_text_pl: 'mleko, śmietanka, cukier, truskawki 8%, skrobia modyfikowana, koncentrat buraka', nutriments: { 'energy-kcal_100g': 139, sugars_100g: 13, salt_100g: 0.12, 'saturated-fat_100g': 6.1, proteins_100g: 3.5, fat_100g: 9 }, categories_hierarchy: ['en:dairies', 'en:yogurts'] }),
  mk('590777000003', { cat: 'yogurts', product_name_pl: 'Jogurt naturalny 2%', brands: 'Zielona Łąka', quantity: '180 g', nutriscore_grade: 'a', nova_group: 1, additives_tags: [], allergens_tags: ['en:milk'], ingredients_text_pl: 'mleko, żywe kultury bakterii', nutriments: { 'energy-kcal_100g': 60, sugars_100g: 4.5, salt_100g: 0.1, 'saturated-fat_100g': 1.3, proteins_100g: 4.3, fat_100g: 2 }, categories_hierarchy: ['en:dairies', 'en:yogurts'] }),
  mk('590777000004', { cat: 'breakfast-cereals', product_name_pl: 'Płatki owsiane górskie', brands: 'Młyn Pod Lasem', quantity: '500 g', nutriscore_grade: 'a', nova_group: 1, additives_tags: [], allergens_tags: ['en:gluten'], ingredients_text_pl: 'płatki owsiane 100%', nutriments: { 'energy-kcal_100g': 372, sugars_100g: 1.2, salt_100g: 0.01, 'saturated-fat_100g': 1.3, proteins_100g: 13, fiber_100g: 10, fat_100g: 7 }, categories_hierarchy: ['en:cereals', 'en:breakfast-cereals'] }),
  mk('590777000005', { cat: 'milks', product_name_pl: 'Jogurt pitny malinowy', brands: 'Zielona Łąka', quantity: '250 g', nutriscore_grade: 'c', nova_group: 4, additives_tags: ['en:e440'], allergens_tags: ['en:milk'], ingredients_text_pl: 'mleko, cukier, maliny 5%, pektyny', nutriments: { 'energy-kcal_100g': 82, sugars_100g: 11, salt_100g: 0.1, 'saturated-fat_100g': 1, proteins_100g: 3, fat_100g: 1.5 }, categories_hierarchy: ['en:dairies', 'en:yogurts'] }),
  mk('590777000006', { cat: 'cheeses', product_name_pl: 'Ser twarogowy półtłusty', brands: 'Mleczarnia Dolina', quantity: '250 g', nutriscore_grade: 'b', nova_group: 1, additives_tags: [], allergens_tags: ['en:milk'], ingredients_text_pl: 'mleko, kultury bakterii', nutriments: { 'energy-kcal_100g': 133, sugars_100g: 3.2, salt_100g: 0.1, 'saturated-fat_100g': 2.6, proteins_100g: 18, fat_100g: 4 }, categories_hierarchy: ['en:dairies', 'en:cheeses'] }),
  mk('590777000007', { cat: 'breakfast-cereals', product_name_pl: 'Płatki owsiane bezglutenowe', brands: 'Młyn Pod Lasem', quantity: '400 g', nutriscore_grade: 'a', nova_group: 1, additives_tags: [], allergens_tags: [], labels_tags: ['en:no-gluten'], ingredients_text_pl: 'płatki owsiane bezglutenowe 100%', nutriments: { 'energy-kcal_100g': 375, sugars_100g: 1, salt_100g: 0.01, 'saturated-fat_100g': 1.2, proteins_100g: 12.5, fiber_100g: 9.5, fat_100g: 7 }, categories_hierarchy: ['en:cereals', 'en:breakfast-cereals'] }),
];
const BY = Object.fromEntries(P.map(p => [p.code, p]));

const b = await chromium.launch();
const URL0 = 'http://localhost:8790/app/index.html';
const HIDE = '#celebrate,#rwBar,#toast,.toast,#reveal,.plusfly,.plus-fly{display:none !important}';
async function mkctx(state, rec) {
  const opts = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion: 'no-preference', locale: 'pl-PL' };
  if (state) opts.storageState = state;
  if (rec) opts.recordVideo = { dir: OUT, size: { width: 780, height: 1688 } };
  const ctx = await b.newContext(opts);
  await ctx.route(/goatcounter|fonts\.(googleapis|gstatic)|jsdelivr|unpkg/, r => /fonts/.test(r.request().url()) ? r.continue().catch(() => r.abort()) : r.abort());
await ctx.route(/\/images\/products\/(\d+)\//, r => { const c = r.request().url().match(/products\/(\d+)\//)[1]; const p = BY[c]; return r.fulfill({ body: fs.readFileSync(APP + 'app/img/cat/' + (p ? p._cat : 'yogurts') + '.webp'), contentType: 'image/webp' }); });
await ctx.route(/openfoodfacts\.org\/api\/v2\/product\/(\d+)/, r => { const c = r.request().url().match(/product\/(\d+)/)[1]; return BY[c] ? r.fulfill({ json: { status: 1, product: BY[c] } }) : r.fulfill({ status: 404, json: { status: 0 } }); });
await ctx.route(/workers\.dev\/search/, r => r.fulfill({ json: { ok: true, products: P.filter(p => /jogurt|skyr/i.test(p.product_name_pl)) } }));
await ctx.route(/workers\.dev\/details/, r => { const codes = new URL(r.request().url()).searchParams.get('codes').split(','); return r.fulfill({ json: { ok: true, products: Object.fromEntries(codes.map(c => [c, BY[c] || null])), failed: 0 } }); });
await ctx.route(/workers\.dev\/category/, r => { const tag = new URL(r.request().url()).searchParams.get('tag'); return r.fulfill({ json: { ok: true, products: P.filter(p => p.categories_hierarchy.includes(tag)) } }); });
await ctx.route(/workers\.dev\/(check|disc)/, r => r.fulfill({ json: { ok: true } }));
await ctx.route(/\/data\/(meta|c\/|p\/)/, r => r.fulfill({ status: 404, body: 'nie ma' }));

  return ctx;
}
// Rozgrzewka: profil, rodzina, odwiedzone produkty (bez „nowa karta” w nagraniu).
let ctx = await mkctx(null, false); let page = await ctx.newPage();
await page.addInitScript(() => { if (localStorage.getItem('dcn-onboarded')) return;
  localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false, sound: false, stats: false })); localStorage.setItem('dcn-name', JSON.stringify('Ola'));
  localStorage.setItem('dcn-d-profile', JSON.stringify({ goals: ['sugar'], watch: ['sugar', 'satfat'] }));
  localStorage.setItem('dcn-d-family', JSON.stringify([{ id: 'f1', name: 'Ania', p: { watch: ['sugar'] } }, { id: 'f2', name: 'Kuba', p: { allergens: ['gluten'], watch: ['protein'] } }]));
  localStorage.setItem('dcn-d-focus', JSON.stringify('me')); });
for (const c of [P[0].code, P[4].code, P[2].code, P[1].code, P[5].code, P[6].code, P[3].code]) { await page.goto(URL0 + '#/p/' + c); await page.waitForTimeout(1300); }
await page.goto(URL0 + '#/'); await page.waitForTimeout(800);
await page.evaluate(() => { App.cmpClear && App.cmpClear(); });
const state = await ctx.storageState(); await ctx.close();
const times = {};
async function scene(name, setup, act) {
  const c = await mkctx(state, true); const p = await c.newPage(); const t0 = Date.now();
  await p.addStyleTag({ content: HIDE }).catch(() => {});
  await setup(p); await p.addStyleTag({ content: HIDE }); await p.waitForTimeout(400);
  const mark = () => p.evaluate(() => new Promise(r => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#ff00ff'; document.body.appendChild(d); setTimeout(() => { d.remove(); requestAnimationFrame(() => requestAnimationFrame(r)); }, 200); }));
  await mark(); const ts = Date.now(); await act(p); const te = Date.now(); await mark(); await p.waitForTimeout(300);
  const v = p.video(); await c.close(); const path = await v.path();
  times[name] = { file: path, start: (ts - t0) / 1000, end: (te - t0) / 1000 };
}
const H = (p, h) => p.evaluate(h => { location.hash = h; }, h);
const scroll = (p, dy, ms) => p.evaluate(([dy, ms]) => new Promise(r => { const y0 = scrollY, t0 = performance.now(); const f = t => { const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, y0 + dy * e); k < 1 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); }), [dy, ms]);
// 1. Skan płatków: z ekranu Start na produkt, potem przewinięcie do wyjaśnienia.
await scene('s1', async p => { await p.goto(URL0 + '#/'); await p.waitForTimeout(1200); },
  async p => { await p.waitForTimeout(700); await H(p, '#/p/' + P[3].code); await p.waitForTimeout(2600); await scroll(p, 330, 1200); await p.waitForTimeout(900); });
// 2. Bez Kuby: Start → Wybierz… → odznacz Kubę → Gotowe → płatki.
await scene('s2', async p => { await p.goto(URL0 + '#/'); await p.waitForTimeout(1200); },
  async p => { await p.waitForTimeout(500); await p.click('[data-act=who-sheet]'); await p.waitForTimeout(700); await p.click('[data-act=shop-on][data-id=f2]'); await p.waitForTimeout(600);
    await p.click('.ls-sheet [data-act=who-close]'); await p.waitForTimeout(700); await H(p, '#/p/' + P[3].code); await p.waitForTimeout(2300); });
// 3. Porównanie: jogurt truskawkowy już w porównaniu, na skyrze „Porównaj”, przewinięcie do „Dla kogo”.
await scene('s3', async p => { await p.goto(URL0 + '#/p/' + P[1].code); await p.waitForTimeout(1300); await p.$eval('#scr-product [data-act=cmp-prod]', e => e.click()); await p.waitForTimeout(500); await p.goto(URL0 + '#/p/' + P[0].code); await p.waitForTimeout(1800); await p.evaluate(() => scrollTo(0, 0)); },
  async p => { await p.waitForTimeout(600); await p.$eval('#scr-product [data-act=cmp-prod]', e => e.click()); await p.waitForTimeout(1800); await scroll(p, 420, 1300); await p.waitForTimeout(1000); });
// 4. Lista: wpisanie kilku rzeczy naraz.
await scene('s4', async p => { await p.goto(URL0 + '#/polki'); await p.waitForTimeout(1300); },
  async p => { await p.waitForTimeout(400); await p.click('#addItemInput'); for (const t of ['mleko', 'chleb żytni', 'jabłka', 'jogurt naturalny']) { await p.locator('#addItemInput').pressSequentially(t, { delay: 55 }); await p.waitForTimeout(150); await p.press('#addItemInput', 'Enter'); await p.waitForTimeout(450); } await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.waitForTimeout(1600); });
// 5. Album.
await scene('s5', async p => { await p.goto(URL0 + '#/album'); await p.waitForTimeout(1800); },
  async p => { await p.waitForTimeout(900); await scroll(p, 380, 1500); await p.waitForTimeout(1000); });
fs.writeFileSync(OUT + '/times.json', JSON.stringify(times, null, 1));
console.log(JSON.stringify(times));
await b.close();
