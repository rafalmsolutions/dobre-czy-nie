// 3.0.13: zaproszenie do testów w Google Play na Starcie – tylko Android w zwykłej przeglądarce.
import { chromium } from 'playwright';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { setup } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const shots = fileURLToPath(new URL('./shots/', import.meta.url)); fs.mkdirSync(shots, { recursive: true });

const open = async ({ ua, referrer, standalone } = {}) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', ...(ua ? { userAgent: ua } : {}) }); await setup(ctx, {});
  await ctx.route(/\/config\.js$/, r => { const body = fs.readFileSync(new URL('../app/config.js', import.meta.url), 'utf8').replace(/goatcounter: '[^']*'/, "goatcounter: ''"); r.fulfill({ body, contentType: 'text/javascript' }); });
  const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => { console.log('ERR', e.message); page.errors.push(e); });
  await page.addInitScript(() => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-name', '"Ola"'); });
  // Referrer tylko przy pierwszym otwarciu (jak w TWA); przy przeładowaniu znika.
  if (referrer) await page.addInitScript(r => { if (sessionStorage.getItem('ref')) return; sessionStorage.setItem('ref', '1'); Object.defineProperty(document, 'referrer', { get: () => r }); }, referrer);
  if (standalone) await page.addInitScript(() => { const mm = window.matchMedia.bind(window); window.matchMedia = q => /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q); });
  await page.goto('http://localhost:8790/app/index.html#/'); await page.waitForTimeout(1000);
  return { ctx, page };
};
const shown = page => page.locator('.d-testbn').count().then(n => n > 0);

// Android w przeglądarce: karta widoczna, pod wyszukiwarką i nad przełącznikiem „Kupujesz dla”.
{ const { ctx, page } = await open({ ua: ANDROID });
  ok(await shown(page), 'Android w przeglądarce: karta widoczna');
  ok(await page.evaluate(() => { const bn = document.querySelector('.d-testbn'), s = document.getElementById('homeSearch'); return !!bn && s.compareDocumentPosition(bn) & Node.DOCUMENT_POSITION_FOLLOWING; }), 'karta pod polem wyszukiwania');
  ok(/Masz Androida\? Pomóż Lupce trafić do Google Play/.test(await page.innerText('.d-testbn')) && /Dołącz do testów – 2 minuty/.test(await page.innerText('.d-testbn')), 'teksty karty');
  ok(await page.getAttribute('.d-testbn-go', 'href') === 'https://lupka.app/testuj/', 'karta prowadzi do lupka.app/testuj/');
  ok(!/pkt/.test(await page.innerText('.d-testbn')), 'bez punktów');
  await page.screenshot({ path: shots + 'testbanner.png' });
  await page.click('.d-testbn-x'); await page.waitForTimeout(200);
  ok(!(await shown(page)), '× chowa kartę');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'homeSearch', 'po × fokus na wyszukiwarce');
  await page.reload(); await page.waitForTimeout(800);
  ok(!(await shown(page)), 'po × karta nie wraca po przeładowaniu');
  ok(!page.errors.length, 'brak błędów JS');
  await ctx.close(); }

// Aplikacja z Google Play (TWA): referrer android-app://app.lupka przy starcie – karta ukryta, także po przeładowaniu bez referrera.
{ const { ctx, page } = await open({ ua: ANDROID, referrer: 'android-app://app.lupka/' });
  ok(!(await shown(page)), 'TWA (referrer android-app://app.lupka): karta niewidoczna');
  await page.reload(); await page.waitForTimeout(800);
  ok(!(await shown(page)) && await page.evaluate(() => document.referrer === ''), 'TWA po przeładowaniu (referrer pusty): nadal niewidoczna');
  await ctx.close(); }

// Komputer, iPhone, zainstalowana PWA – bez karty.
{ const { ctx, page } = await open({}); ok(!(await shown(page)), 'komputer: karta niewidoczna'); await ctx.close(); }
{ const { ctx, page } = await open({ ua: IPHONE }); ok(!(await shown(page)), 'iPhone: karta niewidoczna'); await ctx.close(); }
{ const { ctx, page } = await open({ ua: ANDROID, standalone: true }); ok(!(await shown(page)), 'zainstalowana PWA (display-mode: standalone): karta niewidoczna'); await ctx.close(); }

await b.close(); process.exit(bad ? 1 : 0);
