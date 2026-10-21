// Przeprowadzka 21.10.2026: dawna wersja D pod głównym adresem, dawna główna w /archiwum/, stary adres /d/ przekierowuje.
// Sprawdza też service workery: główny działa bez internetu i nie kasuje pamięci archiwum. Uruchom: node sw-test.mjs (serwer na porcie 8790).
import { chromium } from 'playwright';
import { setup } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await setup(ctx, {});
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { localStorage.setItem('dcn-onboarded', 'true'); localStorage.setItem('dcn-settings', JSON.stringify({ guess: false })); });
const B = 'http://localhost:8790/';

// 1. Archiwum: dawna aplikacja z paskiem do nowej wersji i własnym service workerem.
await p.goto(B + 'archiwum/'); await p.waitForTimeout(1500);
ok(await p.evaluate(() => typeof App !== 'undefined' && !!(App.cfg.levels && App.cfg.levels.levels)), 'archiwum: aplikacja i konfiguracja z ../config/');
ok(await p.locator('a[href="../"]:has-text("nowej wersji")').count() === 1, 'archiwum: pasek „Przejdź do nowej wersji”');
await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(800);

// 2. Główny adres: nowa aplikacja (album, domownicy, odkrywcy).
await p.goto(B); await p.waitForTimeout(1500);
ok(await p.evaluate(() => typeof App !== 'undefined' && typeof App.albumAdd === 'function' && typeof App.familyView === 'function' && typeof App.discSubmit === 'function'), 'główny adres: nowa aplikacja');
ok(await p.evaluate(() => document.title) === 'Dobre czy nie?', 'tytuł bez „wersja D”');
await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(1500);
const regs = await p.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => new URL(r.scope).pathname).sort());
ok(regs.includes('/') && regs.includes('/archiwum/'), 'dwa service workery: ' + regs.join(', '));
const keys = await p.evaluate(() => caches.keys());
ok(keys.some(k => k.startsWith('dcn-arch-')) && keys.some(k => k.startsWith('dcn-d-2')), 'główny nie kasuje pamięci archiwum: ' + keys.join(', '));

// 3. Bez internetu główna aplikacja dalej się otwiera.
await ctx.setOffline(true);
await p.reload(); await p.waitForTimeout(1200);
ok(await p.evaluate(() => typeof App !== 'undefined' && !!(App.cfg.levels && App.cfg.levels.levels)), 'bez internetu: aplikacja i konfiguracja z pamięci');
await ctx.setOffline(false);

// 4. Stary adres /d/ przenosi na główny z zachowaniem ekranu.
await p.goto(B + 'd/#/album'); await p.waitForTimeout(1200);
ok(new URL(p.url()).pathname === '/' && new URL(p.url()).hash === '#/album', 'stary /d/#/album → ' + p.url());

// 5. Stary service worker z /d/ usuwa się sam.
await p.evaluate(() => navigator.serviceWorker.register('d/sw.js', { scope: 'd/' }).catch(() => null)); await p.waitForTimeout(1500);
const regs2 = await p.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => new URL(r.scope).pathname));
ok(!regs2.includes('/d/'), 'stary service worker /d/ wyrejestrowany: ' + regs2.join(', '));

ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
