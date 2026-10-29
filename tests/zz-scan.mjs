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

const CAM = '/tmp/claude-0/-home-claude/07632f31-2a99-502c-9748-df180a60fea6/scratchpad/v2/cam/cam.y4m';
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + CAM] });
const URL0 = 'http://localhost:8790/app/index.html';
const HIDE = '#celebrate,#rwBar,#toast,.toast,#reveal,.plusfly,.plus-fly,.rwbar{display:none !important}';
const ctx = await b.newContext({ recordVideo: { dir: OUT + '/rec', size: { width: 390, height: 844 } }, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: 'block', locale: 'pl-PL', permissions: ['camera'] });
await ctx.route(/goatcounter|fonts\.(googleapis|gstatic)|jsdelivr|unpkg/, r => /fonts/.test(r.request().url()) ? r.continue().catch(() => r.abort()) : r.abort());
await ctx.route(/\/images\/products\/(\d+)\//, r => { const c = r.request().url().match(/products\/(\d+)\//)[1]; const p = BY[c]; return r.fulfill({ body: fs.readFileSync(APP + 'app/img/cat/' + (p ? p._cat : 'yogurts') + '.webp'), contentType: 'image/webp' }); });
await ctx.route(/openfoodfacts\.org\/api\/v2\/product\/(\d+)/, r => { const c = r.request().url().match(/product\/(\d+)/)[1]; return BY[c] ? r.fulfill({ json: { status: 1, product: BY[c] } }) : r.fulfill({ status: 404, json: { status: 0 } }); });
await ctx.route(/workers\.dev\/search/, r => r.fulfill({ json: { ok: true, products: P.filter(p => /jogurt|skyr/i.test(p.product_name_pl)) } }));
await ctx.route(/workers\.dev\/details/, r => { const codes = new URL(r.request().url()).searchParams.get('codes').split(','); return r.fulfill({ json: { ok: true, products: Object.fromEntries(codes.map(c => [c, BY[c] || null])), failed: 0 } }); });
await ctx.route(/workers\.dev\/category/, r => { const tag = new URL(r.request().url()).searchParams.get('tag'); return r.fulfill({ json: { ok: true, products: P.filter(p => p.categories_hierarchy.includes(tag)) } }); });
await ctx.route(/workers\.dev\/(check|disc)/, r => r.fulfill({ json: { ok: true } }));
await ctx.route(/\/data\/(meta|c\/|p\/)/, r => r.fulfill({ status: 404, body: 'nie ma' }));

const page = await ctx.newPage(); page.on('pageerror', e => console.log('ERR', e.message));
await page.addInitScript(() => { window.BarcodeDetector = class { static async getSupportedFormats() { return ['ean_13', 'ean_8', 'upc_a', 'upc_e']; } constructor() { } async detect() { return window.__found ? [{ rawValue: '5907770000047', format: 'ean_13', boundingBox: { x: 200, y: 600, width: 330, height: 160 } }] : []; } }; });
await page.addInitScript(() => { if (localStorage.getItem('dcn-onboarded')) return;
  localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false, sound: false, stats: false })); localStorage.setItem('dcn-name', JSON.stringify('Ola'));
  localStorage.setItem('dcn-d-profile', JSON.stringify({ goals: ['sugar'], watch: ['sugar', 'satfat'] }));
  localStorage.setItem('dcn-d-family', JSON.stringify([{ id: 'f1', name: 'Ania', p: { watch: ['sugar'] } }, { id: 'f2', name: 'Kuba', p: { allergens: ['gluten'], watch: ['protein'] } }]));
  localStorage.setItem('dcn-d-focus', JSON.stringify('me')); });
for (const c of [P[3].code, P[0].code]) { await page.goto(URL0 + '#/p/' + c); await page.waitForTimeout(1200); }
await page.goto(URL0 + '#/'); await page.addStyleTag({ content: HIDE }); await page.waitForTimeout(1500);
const mark = () => page.evaluate(() => new Promise(r => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#ff00ff'; document.body.appendChild(d); setTimeout(() => { d.remove(); requestAnimationFrame(() => requestAnimationFrame(r)); }, 200); }));
await mark(); await page.waitForTimeout(500);
await page.click('[data-act=scan]'); await page.waitForTimeout(2300);
await page.evaluate(() => { window.__found = true; }); await page.waitForTimeout(2200);
await mark(); await page.waitForTimeout(300);
const v = page.video(); await ctx.close(); console.log(await v.path());
await b.close();
