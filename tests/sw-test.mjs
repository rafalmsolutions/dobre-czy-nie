// Działanie bez internetu po pierwszym otwarciu (service worker).
import { chromium } from 'playwright';
import { setup } from '../tests/e2e-lib.mjs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await setup(ctx);
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8790/');
await p.evaluate(() => navigator.serviceWorker.ready);
await p.waitForTimeout(1500);
const cached = await p.evaluate(async () => (await (await caches.open((await caches.keys())[0])).keys()).length);
await ctx.setOffline(true);
await p.reload(); await p.waitForTimeout(1000);
const screen = await p.evaluate(() => typeof App !== 'undefined' && App.current.screen);
const levels = await p.evaluate(() => typeof App !== 'undefined' && !!(App.cfg.levels && App.cfg.levels.levels));
console.log(cached >= 20 && screen === 'start' && levels && !errs.length ? 'SW: OK' : 'SW: BŁĄD', { cached, screen, levels, errs });
await b.close();
