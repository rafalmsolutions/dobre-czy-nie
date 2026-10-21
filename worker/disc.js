/* Lupka – odkrywcy: potwierdzanie nowych produktów przez kolejne osoby (Cloudflare D1, baza „dcn-odkrywcy”).

   POST /disc/submit  device, code, name, nick?, checks?  → nowy produkt dodany przez aplikację czeka na potwierdzenie
   GET  /disc/product?code&device                         → czy produkt czeka na potwierdzenie i czy to urządzenie może je dać
   POST /disc/vote    device, code, vote=yes|no|unsure    → „Czy trzymasz ten produkt?”
   GET  /disc/mine?device                                 → moje odkrycia: status, ile osób je sprawdziło, czy jestem zaufany
   POST /disc/miss    device, code                        → ktoś zeskanował kod, którego nie ma w bazie
   GET  /disc/wanted                                      → „Poszukiwane”: kody, których szukało najwięcej osób
   POST /disc/forget  device                              → usunięcie danych urządzenia (głosy, odwiedziny, statystyki);
                                                            dodane produkty zostają bez powiązania z urządzeniem i bez pseudonimu
   Prywatność: skrót adresu IP trzymamy tylko do rozstrzygnięcia (potwierdzony/odrzucony), dzienne liczniki – 30 dni.

   Zasady: 2 potwierdzenia „tak” → produkt potwierdzony; 2 × „nie” → odrzucony. Głos z tego samego adresu IP co autor się nie liczy.
   Stopnie (seria = potwierdzone od ostatniego odrzucenia; odrzucenie zeruje serię):
   - zaufany odkrywca (seria ≥ 5): produkty potwierdzone od razu, jeśli kod był widoczny na zdjęciu; mniej więcej co 10. trafia
     do wyrywkowej kontroli (zwykłe potwierdzenie przez innych);
   - strażnik bazy (seria ≥ 15): jak wyżej, a jego „tak”/„nie” przy cudzych produktach liczy się podwójnie.
   Urządzenie = losowy identyfikator aplikacji (bez konta). Adres IP przechowujemy tylko jako skrót. */

const UUID_RE = /^[a-z0-9-]{16,64}$/;
const LIMITS = { submit: 10, vote: 10, miss: 40 };
const NEED = 2;
const TRUSTED = 5, GUARDIAN = 15, SPOT = 0.1;

const clean = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const day = () => new Date().toISOString().slice(0, 10);
async function ipHash(ip, salt) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(salt || 'dcn') + '|' + ip));
  return [...new Uint8Array(d)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function bump(db, device, kind) {
  const d = day();
  await db.prepare('INSERT INTO daily (device, day, kind, n) VALUES (?, ?, ?, 1) ON CONFLICT(device, day, kind) DO UPDATE SET n = n + 1').bind(device, d, kind).run();
  const row = await db.prepare('SELECT n FROM daily WHERE device = ? AND day = ? AND kind = ?').bind(device, d, kind).first();
  return (row && row.n) || 1;
}
async function trustOf(db, device) {
  const d = await db.prepare('SELECT confirmed, rejected, disagree, streak FROM devices WHERE device = ?').bind(device).first();
  const c = (d && d.confirmed) || 0, r = (d && d.rejected) || 0, x = (d && d.disagree) || 0, st = (d && d.streak) || 0;
  const level = st >= GUARDIAN ? 'guardian' : st >= TRUSTED ? 'trusted' : 'new';
  return { confirmed: c, rejected: r, disagree: x, streak: st, level, trusted: level !== 'new', need: level === 'new' ? TRUSTED - st : level === 'trusted' ? GUARDIAN - st : 0 };
}
const confirmDevice = (db, device) => db.prepare('INSERT INTO devices (device, confirmed, streak) VALUES (?, 1, 1) ON CONFLICT(device) DO UPDATE SET confirmed = confirmed + 1, streak = streak + 1').bind(device).run();
async function settle(db, code, status, author) {
  await db.prepare('UPDATE subs SET status = ?, iph = NULL WHERE code = ?').bind(status, code).run(); // skrót IP już niepotrzebny
  if (status === 'confirmed') await confirmDevice(db, author);
  else await db.prepare('INSERT INTO devices (device, rejected, streak) VALUES (?, 1, 0) ON CONFLICT(device) DO UPDATE SET rejected = rejected + 1, streak = 0').bind(author).run();
  const wrong = status === 'confirmed' ? 'no' : 'yes';
  await db.prepare('INSERT INTO devices (device, disagree) SELECT device, 1 FROM votes WHERE code = ? AND vote = ? AND counted = 1 ON CONFLICT(device) DO UPDATE SET disagree = disagree + 1').bind(code, wrong).run();
  await db.prepare('UPDATE votes SET iph = NULL WHERE code = ?').bind(code).run();
}
const DAY_MS = 864e5;
/* Sprzątanie: dzienne liczniki starsze niż 30 dni (uruchamiane przy części zapytań, bez osobnego harmonogramu). */
async function tidy(db) {
  const old = new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10);
  await db.prepare('DELETE FROM daily WHERE day < ?').bind(old).run();
}

export async function disc(request, env, url, reply) {
  const db = env.DISC;
  if (!db) return reply(503, { ok: false, error: 'not_configured' });
  const path = url.pathname.slice(5); // bez „/disc”
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  let f = null;
  if (request.method === 'POST') { try { f = await request.formData(); } catch (e) { return reply(400, { ok: false, error: 'form' }); } }
  const get = k => f ? f.get(k) : url.searchParams.get(k);
  const device = String(get('device') || '');
  const code = String(get('code') || '').replace(/\D/g, '');
  const needDevice = () => UUID_RE.test(device);

  if (path === '/wanted' && request.method === 'GET') {
    const r = await db.prepare('SELECT m.code AS code, m.n AS n FROM misses m LEFT JOIN subs s ON s.code = m.code WHERE m.n >= 2 AND s.code IS NULL ORDER BY m.n DESC, m.last DESC LIMIT 20').all();
    return reply(200, { ok: true, items: (r.results || []).map(x => ({ code: x.code, n: x.n })) });
  }
  if (!needDevice()) return reply(400, { ok: false, error: 'device' });
  if (Math.random() < 0.02) await tidy(db).catch(() => { });

  if (path === '/forget' && request.method === 'POST') {
    for (const t of ['votes', 'views', 'miss_dev', 'daily', 'devices']) await db.prepare(`DELETE FROM ${t} WHERE device = ?`).bind(device).run();
    await db.prepare("UPDATE subs SET device = 'usuniete', nick = '', iph = NULL WHERE device = ?").bind(device).run();
    return reply(200, { ok: true });
  }

  if (path === '/mine' && request.method === 'GET') {
    const r = await db.prepare('SELECT code, name, status, views, wanted, at FROM subs WHERE device = ? ORDER BY at DESC LIMIT 200').bind(device).all();
    return reply(200, Object.assign({ ok: true, items: r.results || [] }, await trustOf(db, device)));
  }
  if (!validCode(code)) return reply(400, { ok: false, error: 'code' });

  if (path === '/product' && request.method === 'GET') {
    const s = await db.prepare('SELECT device, nick, name, status, at FROM subs WHERE code = ?').bind(code).first();
    if (!s) return reply(200, { ok: true, found: false });
    const mine = s.device === device;
    if (!mine) {
      const ins = await db.prepare('INSERT OR IGNORE INTO views (code, device) VALUES (?, ?)').bind(code, device).run();
      if (ins.meta && ins.meta.changes) await db.prepare('UPDATE subs SET views = views + 1 WHERE code = ?').bind(code).run();
    }
    const v = await db.prepare('SELECT vote FROM votes WHERE code = ? AND device = ?').bind(code, device).first();
    return reply(200, { ok: true, found: true, status: s.status, name: s.name, nick: s.nick || '', mine, voted: !!v, canVote: s.status === 'pending' && !mine && !v });
  }
  if (path === '/miss' && request.method === 'POST') {
    if (await bump(db, device, 'miss') > LIMITS.miss) return reply(429, { ok: false, error: 'limit' });
    const ins = await db.prepare('INSERT OR IGNORE INTO miss_dev (code, device) VALUES (?, ?)').bind(code, device).run();
    if (ins.meta && ins.meta.changes) await db.prepare('INSERT INTO misses (code, n, last) VALUES (?, 1, ?) ON CONFLICT(code) DO UPDATE SET n = n + 1, last = excluded.last').bind(code, Date.now()).run();
    return reply(200, { ok: true });
  }
  if (path === '/submit' && request.method === 'POST') {
    const name = clean(get('name'), 80);
    if (name.length < 3) return reply(400, { ok: false, error: 'name' });
    if (await bump(db, device, 'submit') > LIMITS.submit) return reply(429, { ok: false, error: 'limit' });
    let checks = {};
    try { checks = JSON.parse(String(get('checks') || '{}')) || {}; } catch (e) { checks = {}; }
    const barcode = ['match', 'none'].includes(checks.barcode) ? checks.barcode : 'none';
    const exists = await db.prepare('SELECT device, status, wanted FROM subs WHERE code = ?').bind(code).first();
    if (exists) return reply(200, { ok: true, status: exists.status, mine: exists.device === device, wanted: !!exists.wanted, existed: true });
    const miss = await db.prepare('SELECT n FROM misses WHERE code = ?').bind(code).first();
    const wanted = miss && miss.n >= 2 ? 1 : 0;
    const t = await trustOf(db, device);
    const spot = t.trusted && barcode === 'match' && Math.random() < SPOT; // wyrywkowa kontrola także u zaufanych
    const status = t.trusted && barcode === 'match' && !spot ? 'confirmed' : 'pending';
    await db.prepare('INSERT INTO subs (code, device, nick, name, at, status, checks, iph, wanted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(code, device, clean(get('nick'), 24), name, Date.now(), status, JSON.stringify({ barcode }), status === 'pending' ? await ipHash(ip, env.DISC_SALT) : null, wanted).run();
    if (status === 'confirmed') await confirmDevice(db, device);
    return reply(200, { ok: true, status, trusted: t.trusted, level: t.level, spot, wanted: !!wanted });
  }
  if (path === '/vote' && request.method === 'POST') {
    const vote = String(get('vote') || '');
    if (!['yes', 'no', 'unsure'].includes(vote)) return reply(400, { ok: false, error: 'vote' });
    const s = await db.prepare('SELECT device, status, yes, no, iph FROM subs WHERE code = ?').bind(code).first();
    if (!s) return reply(404, { ok: false, error: 'not_found' });
    if (s.device === device) return reply(403, { ok: false, error: 'own' });
    const prev = await db.prepare('SELECT vote FROM votes WHERE code = ? AND device = ?').bind(code, device).first();
    if (prev) return reply(409, { ok: false, error: 'voted' });
    if (await bump(db, device, 'vote') > LIMITS.vote) return reply(429, { ok: false, error: 'limit' });
    const me = await trustOf(db, device), iph = await ipHash(ip, env.DISC_SALT);
    // Nie liczymy: „nie wiem”, głos z adresu autora, głos osoby, która często mówi inaczej niż reszta.
    const counted = vote !== 'unsure' && iph !== s.iph && me.disagree < 3 && s.status === 'pending' ? 1 : 0;
    await db.prepare('INSERT INTO votes (code, device, vote, at, iph, counted) VALUES (?, ?, ?, ?, ?, ?)').bind(code, device, vote, Date.now(), iph, counted).run();
    let status = s.status;
    if (counted) {
      const col = vote === 'yes' ? 'yes' : 'no', w = me.level === 'guardian' ? 2 : 1; // głos strażnika bazy liczy się podwójnie
      await db.prepare(`UPDATE subs SET ${col} = ${col} + ? WHERE code = ?`).bind(w, code).run();
      const n = (vote === 'yes' ? s.yes : s.no) + w;
      if (n >= NEED) { status = vote === 'yes' ? 'confirmed' : 'rejected'; await settle(db, code, status, s.device); }
    }
    return reply(200, { ok: true, counted: !!counted, weight: counted ? (me.level === 'guardian' ? 2 : 1) : 0, status, reward: vote === 'unsure' ? 2 : 5 });
  }
  return reply(404, { ok: false, error: 'not_found' });
}

function validCode(code) {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const d = code.split('').map(Number), check = d.pop();
  const sum = d.reverse().reduce((s, n, i) => s + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
