// Adresy od 22.10.2026: lupka.app/ = strona, /app/ = aplikacja, /archiwum/ = dawna aplikacja, /d/ i /strona/ przekierowują.
// Sprawdza też service workery: aplikacja działa bez internetu, nie kasuje pamięci archiwum, stary service worker z „/” sprząta po sobie.
// Uruchom: node sw-test.mjs (serwer na porcie 8790).
import { chromium } from 'playwright';
import { setup } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'pl-PL' }); await setup(ctx, {});
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false })); });
const B = 'http://localhost:8790/';

// 0. Dawny service worker z „/” (aplikacja przed przenosinami) z jego pamięcią.
await p.goto(B + 'privacy.html'); await p.waitForTimeout(300);
await p.evaluate(async () => { const c = await caches.open('dcn-d-2.4.1'); await c.put('/stary', new Response('x')); });

// 1. Archiwum: dawna aplikacja z paskiem do nowej wersji i własnym service workerem.
await p.goto(B + 'archiwum/'); await p.waitForTimeout(1500);
ok(await p.evaluate(() => typeof App !== 'undefined' && !!(App.cfg.levels && App.cfg.levels.levels)), 'archiwum: aplikacja i konfiguracja z ../config/');
ok(await p.locator('a[href="../app/"]:has-text("nowej wersji")').count() === 1, 'archiwum: pasek „Przejdź do nowej wersji” prowadzi do /app/');
await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(800);

// 2. /app/: aplikacja (album, domownicy, odkrywcy), konfiguracja i kopia bazy z katalogu głównego.
await p.goto(B + 'app/'); await p.waitForTimeout(1500);
ok(await p.evaluate(() => typeof App !== 'undefined' && typeof App.albumAdd === 'function' && typeof App.familyView === 'function' && typeof App.discSubmit === 'function'), '/app/: aplikacja');
ok(await p.evaluate(() => !!(App.cfg.levels && App.cfg.levels.levels && App.cfg.achievements)), '/app/: konfiguracja z ../config/ i własne odznaki');
ok(await p.evaluate(() => document.title) === 'Lupka', 'tytuł: Lupka');
await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(1500);
const regs = await p.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => new URL(r.scope).pathname).sort());
ok(regs.includes('/app/') && regs.includes('/archiwum/'), 'service workery: ' + regs.join(', '));
let keys = await p.evaluate(() => caches.keys());
ok(keys.some(k => k.startsWith('dcn-arch-')) && keys.some(k => k.startsWith('lupka-')), 'aplikacja nie kasuje pamięci archiwum: ' + keys.join(', '));
ok(!keys.includes('dcn-d-2.4.1'), 'aplikacja usuwa pamięć sprzed przenosin');

// 3. Bez internetu aplikacja dalej się otwiera.
await ctx.setOffline(true);
await p.reload(); await p.waitForTimeout(1200);
ok(await p.evaluate(() => typeof App !== 'undefined' && !!(App.cfg.levels && App.cfg.levels.levels)), 'bez internetu: aplikacja i konfiguracja z pamięci');
await ctx.setOffline(false);

// 4. Stare adresy: /d/ i /#/p/… przenoszą do /app/ z zachowaniem ekranu, /strona/ na stronę.
await p.goto(B + 'd/#/album'); await p.waitForTimeout(1200);
ok(new URL(p.url()).pathname === '/app/' && new URL(p.url()).hash === '#/album', 'stary /d/#/album → ' + p.url());
await p.goto(B + '#/p/3017620422003'); await p.waitForTimeout(1200);
ok(new URL(p.url()).pathname === '/app/' && new URL(p.url()).hash === '#/p/3017620422003', 'stary link lupka.app/#/p/… → ' + p.url());
await p.goto(B + 'strona/'); await p.waitForTimeout(800);
ok(new URL(p.url()).pathname === '/', '/strona/ → strona główna');

// 5. Strona główna: strona promująca, przycisk do /app/.
await p.goto(B); await p.waitForTimeout(1000);
await p.evaluate(() => { location.hash = '#/p/3017620422003'; }); await p.waitForTimeout(1200);
ok(new URL(p.url()).pathname === '/app/', 'zmiana adresu na stronie na #/p/… też przenosi do /app/');
await p.goto(B); await p.waitForTimeout(1000);
ok(/PRZYJRZYJ/i.test(await p.locator('h1').innerText()) && await p.locator('a.btn[href="/app/"]').count() >= 2, 'główny adres: strona z „Otwórz Lupkę” → /app/');

// 6. Stary service worker z „/” zastąpiony sprzątaczem: wyrejestrowuje się, pamięć aplikacji zostaje.
await p.evaluate(() => navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null)); await p.waitForTimeout(2000);
const regs2 = await p.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => new URL(r.scope).pathname));
ok(!regs2.includes('/'), 'stary service worker z „/” wyrejestrowany: ' + regs2.join(', '));
keys = await p.evaluate(() => caches.keys());
ok(keys.some(k => k.startsWith('lupka-')) && keys.some(k => k.startsWith('dcn-arch-')), 'pamięć aplikacji i archiwum zostaje: ' + keys.join(', '));

// 7. Stary service worker z /d/ usuwa się sam.
await p.goto(B + 'app/'); await p.waitForTimeout(800);
await p.evaluate(() => navigator.serviceWorker.register('/d/sw.js', { scope: '/d/' }).catch(() => null)); await p.waitForTimeout(1500);
const regs3 = await p.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => new URL(r.scope).pathname));
ok(!regs3.includes('/d/'), 'stary service worker /d/ wyrejestrowany: ' + regs3.join(', '));

// 8. Polityka prywatności: powrót tam, skąd przyszedłeś.
await p.goto(B + 'privacy.html?z=strona'); await p.waitForTimeout(300);
ok(await p.locator('#back').innerText() === '← Wróć na stronę Lupki' && await p.locator('#back').getAttribute('href') === '/', 'polityka ze strony: „Wróć na stronę Lupki”');
await p.goto(B + 'privacy.html?z=app'); await p.waitForTimeout(300);
ok(await p.locator('#back').innerText() === '← Wróć do aplikacji' && await p.locator('#back').getAttribute('href') === '/app/', 'polityka z aplikacji: „Wróć do aplikacji”');
ok(/Rafał Mokrowiecki/.test(await p.innerText('body')) && !/\[data\]|\[imię/.test(await p.innerText('body')), 'polityka: administrator i data uzupełnione');

// 9. Wyszukiwarki i asystenci AI: robots.txt, mapa strony, llms.txt, dane strukturalne, aplikacja i archiwum poza wynikami.
for (const f of ['robots.txt', 'sitemap.xml', 'llms.txt', 'img/og.jpg']) ok((await p.request.get(B + f)).ok(), 'plik dla wyszukiwarek: ' + f);
await p.goto(B); await p.waitForTimeout(300);
const seo = await p.evaluate(() => ({ t: document.title, c: document.querySelector('link[rel=canonical]')?.href, r: document.querySelector('meta[name=robots]')?.content,
  ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => { try { return JSON.parse(s.textContent)['@graph'].map(g => g['@type']).join(','); } catch (e) { return 'BŁĄD'; } }).join('|') }));
ok(/skaner produktów/.test(seo.t) && seo.c === 'https://lupka.app/' && /^index/.test(seo.r), 'strona: tytuł, canonical, indeksowanie');
ok(seo.ld === 'Organization,WebSite,WebApplication,FAQPage', 'strona: dane strukturalne ' + seo.ld);
for (const u of ['app/', 'archiwum/']) { await p.goto(B + u); await p.waitForTimeout(500); ok(await p.evaluate(() => document.querySelector('meta[name=robots]')?.content) === 'noindex', u + ' poza wynikami wyszukiwania'); }

ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
