// Skaner: wybór tylnego aparatu z autofokusem (telefony z kilkoma aparatami), ciągła ostrość, lekki zoom, stuknięcie = ostrość.
// Uruchom: node e2e-d-camera.mjs (serwer na porcie 8790). Aparat udawany przez Chromium, możliwości aparatów podstawione.
import { chromium } from 'playwright';
import { setup } from './lib.mjs';
const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
let bad = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) bad++; };
const run = async (cams, saved) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', permissions: ['camera'] }); await setup(ctx, {});
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(([cams, saved]) => {
    localStorage.setItem('dcn-onboarded', 'true'); if (saved) localStorage.setItem('dcn-d-cam', JSON.stringify(saved));
    window.__cam = { opened: [], applied: [] };
    const md = navigator.mediaDevices, orig = md.getUserMedia.bind(md);
    md.enumerateDevices = async () => cams.map(c => ({ kind: 'videoinput', deviceId: c.id, label: c.label, groupId: 'g' }));
    md.getUserMedia = async cons => {
      const want = cons.video.deviceId ? cons.video.deviceId.exact : cams[0].id, cam = cams.find(c => c.id === want);
      if (!cam) throw new DOMException('no', 'OverconstrainedError');
      window.__cam.opened.push(want);
      const st = await orig({ video: true }), t = st.getVideoTracks()[0];
      t.getCapabilities = () => Object.assign({ deviceId: cam.id }, cam.caps);
      t.applyConstraints = async c => { window.__cam.applied.push(JSON.stringify(c)); };
      return st;
    };
  }, [cams, saved]);
  await page.goto('http://localhost:8790/app/index.html#/'); await page.waitForTimeout(1200);
  await page.evaluate(() => App.openScanner()); await page.waitForTimeout(1500);
  const r = await page.evaluate(() => Object.assign({}, window.__cam, { cam: JSON.parse(localStorage.getItem('dcn-d-cam') || '""'), err: !document.getElementById('scanErr').hidden && /aparat/.test(document.getElementById('scanErrTitle').textContent) }));
  await page.click('#scanner', { position: { x: 200, y: 500 } }); await page.waitForTimeout(200);
  r.afterTap = await page.evaluate(() => window.__cam.applied.slice());
  await page.evaluate(() => App.closeScanner(true)); r.errs = errs; await ctx.close(); return r;
};
const AF = { focusMode: ['continuous', 'single-shot', 'manual'], zoom: { min: 1, max: 8 } }, FIXED = { focusMode: ['manual'] };
// 1. Domyślny aparat bez autofokusa (szerokokątny), drugi z autofokusem → wybieramy drugi i zapamiętujemy
let r = await run([{ id: 'wide', label: 'camera2 2, facing back', caps: FIXED }, { id: 'main', label: 'camera2 0, facing back', caps: AF }, { id: 'selfie', label: 'camera2 1, facing front', caps: AF }]);
ok(r.opened.join(',') === 'wide,main' && r.cam === 'main' && !r.err, 'aparat bez autofokusa zamieniony na tylny z autofokusem (' + r.opened.join(',') + ')');
ok(r.applied.some(a => /continuous/.test(a) && /"zoom":1.5/.test(a)), 'ciągła ostrość i zoom 1,5×');
ok(r.afterTap.some(a => /single-shot/.test(a)), 'stuknięcie w obraz: ponowne ustawienie ostrości');
// 2. Zapamiętany aparat: od razu właściwy, bez przełączania
r = await run([{ id: 'wide', label: 'camera2 2, facing back', caps: FIXED }, { id: 'main', label: 'camera2 0, facing back', caps: AF }], 'main');
ok(r.opened.join(',') === 'main', 'zapamiętany aparat otwierany od razu');
// 3. Telefon bez informacji o ostrości (np. iPhone): bez przełączania, skaner działa
r = await run([{ id: 'ios', label: 'Back Camera', caps: {} }, { id: 'ios2', label: 'Back Ultra Wide Camera', caps: {} }]);
ok(r.opened.join(',') === 'ios' && !r.err && !r.applied.length, 'bez informacji o ostrości: aparat systemowy, bez zmian');
// 4. Żaden aparat nie ma autofokusa: wracamy do domyślnego
r = await run([{ id: 'a', label: 'back a', caps: FIXED }, { id: 'b', label: 'back b', caps: FIXED }]);
ok(r.opened[r.opened.length - 1] === 'a' && !r.err, 'bez autofokusa w żadnym: domyślny aparat');
ok(!r.errs.length, 'brak błędów JS ' + r.errs.join(' | '));
await b.close(); process.exit(bad ? 1 : 0);
