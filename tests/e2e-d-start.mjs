// 3.0.7: pierwsze uruchomienie w stylu Profilu: imię i dla kogo, cele (kafelki), czego nie jesz (lista), domownicy.
// Uruchom: node e2e-d-start.mjs (serwer na porcie 8790).
import { chromium } from 'playwright';
import { setup } from './lib.mjs';
const b = await chromium.launch(); let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await setup(ctx, {});
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:8790/app/index.html#/'); await page.waitForTimeout(1000);
ok(await page.locator('#scr-start.on').count() === 1, 'bez ustawień: ekran startowy');
ok(/Krok 1 z 3/.test(await page.innerText('#scr-start')) && /możesz zmienić później w Profilu/.test(await page.innerText('#scr-start')), 'krok 1: 3 kroki i informacja o Profilu');
await page.fill('#startName', 'Ola'); await page.click('[data-act=start-mode][data-v=fam]'); await page.waitForTimeout(150);
ok(/Krok 1 z 4/.test(await page.innerText('#scr-start')) && await page.inputValue('#startName') === 'Ola', '„dla rodziny”: 4 kroki, imię zostaje');
await page.click('[data-act=start-next]'); await page.waitForTimeout(150);
ok(/ważne, Ola/.test(await page.innerText('#startTitle')) && await page.locator('.goal-grid [data-act=goal]').count() === 8, 'krok 2: cele jako kafelki');
await page.click('[data-act=goal][data-k=sugar]');
await page.click('[data-act=start-next]'); await page.waitForTimeout(150);
await page.locator('label.ck-row:has([data-pick="diet:vegetarian"])').click();
await page.click('[data-act=start-back]'); await page.click('[data-act=start-next]'); await page.waitForTimeout(150);
ok(await page.locator('[data-pick="diet:vegetarian"]').isChecked(), 'krok 3: wybór zostaje po powrocie');
await page.click('[data-act=start-next]'); await page.waitForTimeout(150);
await page.click('[data-act=start-person][data-i=new]'); await page.click('[data-act=start-person-save]'); await page.waitForTimeout(100);
ok(/Wpisz imię/.test(await page.innerText('#obPMsg')), 'nowa osoba: imię wymagane');
await page.fill('#obPName', 'Kuba'); await page.locator('.ls-sheet label.ck-row:has([data-pick="allergens:gluten"])').click(); await page.click('[data-act=start-person-save]'); await page.waitForTimeout(150);
ok(/Kuba/.test(await page.innerText('#scr-start')) && /✕ gluten/.test(await page.innerText('#scr-start')) && /Jak liczymy dopasowanie/.test(await page.innerText('#scr-start')), 'krok 4: Kuba na liście, „Jak liczymy dopasowanie”');
await page.click('[data-act=start-person][data-i="0"]'); await page.fill('#obPName', 'Jakub'); await page.click('[data-act=start-person-save]'); await page.waitForTimeout(100);
await page.click('[data-act=start-person][data-i=new]'); await page.fill('#obPName', 'Ania'); await page.click('[data-act=start-person-save]');
await page.click('[data-act=start-person][data-i="1"]'); await page.click('[data-act=start-person-del]'); await page.waitForTimeout(100);
await page.click('[data-act=start-next]'); await page.waitForTimeout(600);
const st = await page.evaluate(() => ({ h: location.hash, fam: App.family.map(f => f.name + ':' + f.p.allergens.join()), diet: App.profile.diet, goals: App.profile.goals, name: App.userName(), on: App.store.get('onboarded') }));
ok(st.h === '#/' && st.on && st.name === 'Ola' && st.goals.join() === 'sugar' && st.diet.includes('vegetarian'), 'zapis: imię, cel, dieta');
ok(st.fam.join('|') === 'Jakub:gluten', 'domownicy zapisani (zmiana imienia, usunięcie): ' + st.fam.join('|'));
// Ponowny start z rodziną: osoby wczytane, „tylko dla siebie” ich nie usuwa
await page.evaluate(() => { location.hash = '#/start'; }); await page.waitForTimeout(400);
ok(await page.locator('[data-act=start-mode][data-v=fam][aria-checked=true]').count() === 1, 'ponowny start: tryb rodzinny rozpoznany');
await page.click('[data-act=start-skip]'); await page.waitForTimeout(300);
ok(await page.evaluate(() => App.family.length) === 1, '„Pomiń” nie usuwa domowników');
ok(!errs.length, 'brak błędów JS ' + errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
