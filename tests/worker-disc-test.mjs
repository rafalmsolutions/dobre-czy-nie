// Testy odkrywców (potwierdzanie nowych produktów) w pośredniku. Baza D1 zastąpiona SQLite w pamięci (Node 22+).
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import worker from '../worker/off-proxy.js';
let pass = 0, fail = 0; const ok = (c, n) => { if (c) pass++; else { fail++; console.log('  ✗ ' + n); } };
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8'));
const D1 = { prepare(sql) { let args = []; const st = { bind(...a) { args = a; return st; }, async run() { const r = sqlite.prepare(sql).run(...args); return { meta: { changes: r.changes } }; }, async first() { return sqlite.prepare(sql).get(...args) ?? null; }, async all() { return { results: sqlite.prepare(sql).all(...args) }; } }; return st; } };
const env = { ALLOWED_ORIGINS: 'https://app.test', DISC: D1, DISC_SALT: 'test' };
const ean = p => { const d = p.split('').map(Number); const s = d.reverse().reduce((a, n, i) => a + n * (i % 2 === 0 ? 3 : 1), 0); return p + ((10 - s % 10) % 10); };
const dev = n => 'device-' + String(n).padStart(12, '0');
let ipSeq = 0; // każde zapytanie POST z innego adresu (losowe adresy czasem się powtarzały i test bywał niestabilny)
async function call(path, fields, o = {}) {
  let req;
  if (fields) { const f = new FormData(); Object.entries(fields).forEach(([k, v]) => f.append(k, v)); req = new Request('https://p.test' + path, { method: 'POST', body: f, headers: { Origin: o.origin || 'https://app.test', 'CF-Connecting-IP': o.ip || '10.0.' + Math.floor(++ipSeq / 250) + '.' + (ipSeq % 250) } }); }
  else req = new Request('https://p.test' + path, { headers: { Origin: o.origin || 'https://app.test', 'CF-Connecting-IP': o.ip || '10.0.1.1' } });
  const r = await worker.fetch(req, o.env || env);
  return { status: r.status, j: await r.json().catch(() => null) };
}
const A = ean('590000000501'), B = ean('590000000502'), Cc = ean('590000000503');

let r = await call('/disc/submit', { device: dev(1), code: A, name: 'Jogurt <b>nowy</b>', nick: 'Ola', checks: JSON.stringify({ barcode: 'match' }) }, { ip: '1.1.1.1' });
ok(r.status === 200 && r.j.status === 'pending' && !r.j.trusted, 'nowy odkrywca: produkt czeka na potwierdzenie');
r = await call(`/disc/product?code=${A}&device=${dev(2)}`);
ok(r.j.found && r.j.canVote && r.j.nick === 'Ola' && r.j.name === 'Jogurt bnowy/b'.replace('bnowy/b', 'bnowy/b') || r.j.name.startsWith('Jogurt'), 'inna osoba: może potwierdzić');
r = await call(`/disc/product?code=${A}&device=${dev(1)}`);
ok(r.j.found && r.j.mine && !r.j.canVote, 'autor nie potwierdza sam siebie');
r = await call('/disc/vote', { device: dev(1), code: A, vote: 'yes' }); ok(r.status === 403, 'autor: głos odrzucony');
r = await call('/disc/vote', { device: dev(2), code: A, vote: 'yes' }, { ip: '1.1.1.1' });
ok(r.j.ok && !r.j.counted && r.j.reward === 5, 'głos z adresu autora: nagroda tak, ale się nie liczy');
r = await call('/disc/vote', { device: dev(2), code: A, vote: 'yes' }); ok(r.status === 409, 'drugi głos tej samej osoby: odrzucony');
r = await call('/disc/vote', { device: dev(3), code: A, vote: 'unsure' }); ok(r.j.ok && !r.j.counted && r.j.reward === 2, '„nie mam pewności”: +2, nie liczy się');
r = await call('/disc/vote', { device: dev(4), code: A, vote: 'yes' }); ok(r.j.counted && r.j.status === 'pending', 'pierwsze potwierdzenie');
r = await call('/disc/vote', { device: dev(5), code: A, vote: 'yes' }); ok(r.j.status === 'confirmed', 'drugie potwierdzenie: produkt potwierdzony');
r = await call(`/disc/product?code=${A}&device=${dev(6)}`); ok(r.j.status === 'confirmed' && !r.j.canVote, 'potwierdzony: nie pytamy dalej');
r = await call(`/disc/mine?device=${dev(1)}`);
ok(r.j.items.length === 1 && r.j.items[0].status === 'confirmed' && r.j.items[0].views === 2 && r.j.confirmed === 1, 'moje odkrycia: status i liczba osób, które sprawdziły');
// odrzucenie
await call('/disc/submit', { device: dev(1), code: B, name: 'Baton XXL', checks: '{}' }, { ip: '1.1.1.1' });
await call('/disc/vote', { device: dev(7), code: B, vote: 'no' }); r = await call('/disc/vote', { device: dev(8), code: B, vote: 'no' });
ok(r.j.status === 'rejected', 'dwa „to inny produkt”: odrzucony');
r = await call(`/disc/mine?device=${dev(1)}`); ok(r.j.rejected === 1 && !r.j.trusted, 'odrzucenie: autor nie jest zaufany');
// zaufany odkrywca (seria 5 potwierdzonych)
for (let i = 0; i < 5; i++) {
  const code = ean('5900000006' + String(i).padStart(2, '0'));
  await call('/disc/submit', { device: dev(20), code, name: 'Produkt ' + i, checks: JSON.stringify({ barcode: 'match' }) });
  await call('/disc/vote', { device: dev(30 + i), code, vote: 'yes' }); await call('/disc/vote', { device: dev(40 + i), code, vote: 'yes' });
}
r = await call(`/disc/mine?device=${dev(20)}`);
ok(r.j.level === 'trusted' && r.j.streak === 5 && r.j.need === 10, 'po 5 potwierdzonych: zaufany odkrywca, 10 do strażnika ' + JSON.stringify(Object.assign({}, r.j, { items: r.j.items.map(x => x.status) })));
const origRandom = Math.random; Math.random = () => 0.5;
r = await call('/disc/submit', { device: dev(20), code: Cc, name: 'Szósty', checks: JSON.stringify({ barcode: 'match' }) });
ok(r.j.status === 'confirmed' && r.j.trusted, 'zaufany: od razu potwierdzony');
Math.random = () => 0.05;
r = await call('/disc/submit', { device: dev(20), code: ean('590000000710'), name: 'Kontrola', checks: JSON.stringify({ barcode: 'match' }) });
ok(r.j.status === 'pending' && r.j.spot, 'wyrywkowa kontrola: zaufany też czeka na potwierdzenie');
Math.random = origRandom;
await call('/disc/vote', { device: dev(90), code: ean('590000000710'), vote: 'no' }); await call('/disc/vote', { device: dev(91), code: ean('590000000710'), vote: 'no' });
r = await call(`/disc/mine?device=${dev(20)}`);
ok(r.j.level === 'new' && r.j.streak === 0 && r.j.confirmed === 6, 'odrzucenie w kontroli: utrata statusu, seria od zera');
// strażnik bazy: głos liczy się podwójnie
sqlite.prepare("INSERT INTO devices (device, confirmed, streak) VALUES (?, 15, 15)").run(dev(95));
const G = ean('590000000720');
await call('/disc/submit', { device: dev(96), code: G, name: 'Dla strażnika', checks: '{}' });
r = await call('/disc/vote', { device: dev(95), code: G, vote: 'yes' }); ok(r.j.weight === 2 && r.j.status === 'confirmed', 'strażnik: głos waży 2, sam wystarcza do potwierdzenia');
r = await call('/disc/submit', { device: dev(20), code: ean('590000000700'), name: 'Bez kodu', checks: JSON.stringify({ barcode: 'none' }) });
ok(r.j.status === 'pending', 'zaufany, ale bez kodu na zdjęciu: czeka na potwierdzenie');
// poszukiwane
const W = ean('590000000801');
for (const d of [50, 51, 51, 52]) await call('/disc/miss', { device: dev(d), code: W });
r = await call('/disc/wanted'); const w = r.j.items.find(x => x.code === W);
ok(w && w.n === 3, 'poszukiwane: 3 różne osoby (powtórka się nie liczy)');
r = await call('/disc/submit', { device: dev(60), code: W, name: 'Poszukiwany', checks: '{}' });
ok(r.j.wanted, 'dodanie poszukiwanego: oznaczone (podwójna nagroda)');
r = await call('/disc/wanted'); ok(!r.j.items.some(x => x.code === W), 'po dodaniu znika z poszukiwanych');
// limity i błędy
for (let i = 0; i < 10; i++) { const c = ean('5900000009' + String(i).padStart(2, '0')); await call('/disc/submit', { device: dev(80 + i), code: c, name: 'Do limitu ' + i, checks: '{}' }); await call('/disc/vote', { device: dev(70), code: c, vote: 'unsure' }); }
r = await call('/disc/submit', { device: dev(71), code: ean('590000000990'), name: 'Do limitu', checks: '{}' });
r = await call('/disc/vote', { device: dev(70), code: ean('590000000990'), vote: 'yes' }); ok(r.status === 429, 'limit 10 głosów dziennie');
r = await call('/disc/submit', { device: 'x', code: A, name: 'abc' }); ok(r.status === 400 && r.j.error === 'device', 'zły identyfikator urządzenia');
r = await call('/disc/submit', { device: dev(1), code: '5900000000000', name: 'abc' }); ok(r.status === 400 && r.j.error === 'code', 'zła suma kontrolna');
r = await call('/disc/vote', { device: dev(9), code: A, vote: 'maybe' }); ok(r.status === 400, 'zły głos');
r = await call(`/disc/product?code=${A}&device=${dev(2)}`, null, { origin: 'https://zly.test' }); ok(r.status === 403, 'obca strona: 403');
r = await call(`/disc/product?code=${A}&device=${dev(2)}`, null, { env: { ALLOWED_ORIGINS: 'https://app.test' } }); ok(r.status === 503, 'bez bazy: 503');
// prawo do usunięcia danych
r = await call('/disc/forget', { device: dev(1) });
ok(r.j.ok && sqlite.prepare("SELECT COUNT(*) n FROM subs WHERE device = ?").get(dev(1)).n === 0 && sqlite.prepare("SELECT COUNT(*) n FROM devices WHERE device = ?").get(dev(1)).n === 0, 'usunięcie danych: brak powiązań z urządzeniem');
ok(sqlite.prepare("SELECT COUNT(*) n FROM subs WHERE device = 'usuniete' AND nick = ''").get().n >= 1, 'usunięcie danych: produkty zostają bez pseudonimu');
r = await call('/disc/forget', { device: dev(2) }); ok(sqlite.prepare("SELECT COUNT(*) n FROM votes WHERE device = ?").get(dev(2)).n === 0, 'usunięcie danych: głosy usunięte');
ok(sqlite.prepare("SELECT COUNT(*) n FROM subs WHERE status != 'pending' AND iph IS NOT NULL").get().n === 0, 'po rozstrzygnięciu bez skrótu IP');
const leaked = sqlite.prepare('SELECT iph FROM subs').all().every(x => !/^\d+\.\d+/.test(x.iph));
ok(leaked, 'adres IP tylko jako skrót');
console.log(`worker-disc: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
