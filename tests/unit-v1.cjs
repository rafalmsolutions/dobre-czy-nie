// Testy logiki wersji 1.0: dopasowanie, działy, punkty i odznaki, półki. Uruchom: node unit-v1.cjs
const { A, CFG } = require('./bundle.js');
const { Game, Shelf } = A;
let pass = 0, fail = 0;
const t = (name, cond, info) => { if (cond) pass++; else { fail++; console.log('FAIL', name, info !== undefined ? JSON.stringify(info).slice(0, 400) : ''); } };
const prod = o => Object.assign({ code: '1', kind: 'food', source: 'off', name: 'x', nutriscore: '', nova: null, additiveTags: [], ingredients: '', allergens: [], traces: [], analysis: [], labels: [], nutriments: {} }, o);
const pm = (o, profile) => { const p = prod(o); return A.personalMatch(p, A.analyze(p), profile); };

/* ===== Osobiste dopasowanie ===== */
const skyr = { nutriscore: 'a', nova: 1, ingredients: 'mleko odtłuszczone, kultury bakterii', allergens: ['en:milk'], nutriments: { proteins: 11, sugars: 4, kcal: 63, salt: 0.1, sat: 0.1 } };
const m1 = pm(skyr, {});
t('no profile = general score', m1.pct === A.analyze(prod(skyr)).score && m1.level === 'great', m1);
const m2 = pm(skyr, { goals: ['muscle', 'sugar'] });
t('goals add bonus, capped 100', m2.pct === 100 && m2.rows.filter(r => r.kind === 'good').length === 2, m2);
t('goal rows titled', m2.rows[0].title === 'Cel: więcej białka', m2.rows[0]);
const m3 = pm(skyr, { allergens: ['milk'] });
t('allergen fail -> bad', m3.level === 'bad' && m3.pct <= 10 && m3.good === false && m3.rows.some(r => r.kind === 'bad' && r.title === 'Mleko'), m3);
const m4 = pm({ ...skyr, allergens: [], ingredients: 'płatki owsiane. Może zawierać orzechy', traces: ['en:nuts'] }, { allergens: ['nuts'] });
t('traces cap 35', m4.pct <= 35 && m4.status === 'traces' && m4.rows.some(r => r.kind === 'warn'), m4);
const m5 = pm({ nutriscore: '', nova: null, additiveTags: null, ingredients: '' }, { goals: ['muscle'] });
t('no data -> unknown, no guess', m5.pct === null && m5.level === 'unknown' && m5.good === null, m5);
const candy = { nutriscore: 'e', nova: 4, ingredients: 'cukier, syrop glukozowy, żelatyna', nutriments: { sugars: 60, kcal: 350 } };
const m6 = pm(candy, { goals: ['sugar'] });
t('bad goal penalty', m6.pct < pm(candy, {}).pct && m6.level !== 'great', [m6.pct, pm(candy, {}).pct]);
t('healthy goal no insight row', pm(skyr, { goals: ['healthy'] }).rows.length === 0);
t('healthy goal accepted by profile', A.cleanProfile({ goals: ['healthy', 'muscle', 'bogus'] }).goals.join() === 'healthy,muscle');
t('profile ok row', pm(skyr, { avoid: ['palm'] }).rows.some(r => r.title === 'Zgodne z Twoimi ograniczeniami'));
t('match levels edges', A.MATCH_LEVELS.find(l => 75 >= l.min).key === 'great' && A.MATCH_LEVELS.find(l => 49 >= l.min).key === 'poor');
t('cosmetic match works', pm({ kind: 'cosmetic', ingredients: 'Aqua, Glycerin, Parfum' }, { cosmetic: ['fragrance'] }).level === 'bad');

/* ===== Działy ===== */
t('dept by tag', A.departmentFor({ name: 'Coś', categories: ['en:dairies', 'en:yogurts'] }) === 'dairy');
t('dept by word', A.departmentFor({ name: 'Marchew myta' }) === 'veg');
t('dept polish letters', A.departmentFor({ name: 'Ziemniaki' }) === 'veg' && A.departmentFor({ name: 'Mąka pszenna' }) === 'pantry', [A.departmentFor({ name: 'Mąka pszenna' })]);
t('dept bread', A.departmentFor({ name: 'chleb żytni' }) === 'bread');
t('dept short word not inside', A.departmentFor({ name: 'Rosół' }) !== 'pantry', A.departmentFor({ name: 'Rosół' }));
t('dept unknown', A.departmentFor({ name: 'xyz' }) === 'other' && A.departmentFor(null) === 'other');

/* ===== Punkty i limity ===== */
const NOW = new Date('2026-10-21T10:00:00');
let s = Game.newState();
let r = Game.award(s, CFG, 'product_checked', { code: '111', now: NOW });
t('scan +2', r.gained === 2 && r.state.points === 2 && r.state.drops === 2, r);
r = Game.award(r.state, CFG, 'product_checked', { code: '111', now: NOW });
t('same product same day blocked', r.gained === 0 && r.blocked === 'once_product_day' && r.state.points === 2, r.blocked);
s = r.state;
for (let i = 0; i < 15; i++) s = Game.award(s, CFG, 'product_checked', { code: String(200 + i), now: NOW }).state;
t('daily cap 20', s.points === 20, s.points);
t('unique set counts beyond cap', s.sets.product_checked.length === 16, s.sets.product_checked.length);
r = Game.award(s, CFG, 'product_checked', { code: '111', now: new Date('2026-10-22T10:00:00') });
t('next day same product ok', r.gained === 2, r.gained);
s = Game.newState();
r = Game.award(s, CFG, 'guess_right', { code: '5', now: NOW });
t('guess right +10', r.gained === 10);
r = Game.award(r.state, CFG, 'guess_wrong', { code: '5', now: NOW });
t('second guess same product blocked', r.gained === 0 && r.blocked, r.blocked);
r = Game.award(Game.newState(), CFG, 'question_of_day', { now: NOW }); r = Game.award(r.state, CFG, 'question_of_day', { now: NOW });
t('question once a day', r.blocked === 'daily_count' && r.state.points === 5, r);
s = Game.newState();
r = Game.award(s, CFG, 'product_added', { code: '777', now: NOW });
t('product added +50', r.gained === 50, r.gained);
t('odkrywca unlocked', r.events.some(e => e.type === 'achievement' && e.id === 'odkrywca'), r.events);
r = Game.award(r.state, CFG, 'product_added', { code: '777', now: new Date('2026-11-05T10:00:00') });
t('same barcode only once ever', r.gained === 0 && r.blocked === 'once_barcode', r.blocked);
s = Game.newState();
for (const c of ['1', '2', '3', '4']) s = Game.award(s, CFG, 'product_added', { code: c, now: NOW }).state;
t('product added daily cap 150 (+50 odkrywca)', s.points === 150 + 50, s.points);
r = Game.award(Game.newState(), CFG, 'unknown_event', { now: NOW });
t('unknown event no points, no crash', r.gained === 0 && r.state.counters.unknown_event === 1);
r = Game.award(Game.newState(), CFG, 'added_product_viewed_by_other', { now: NOW });
t('drops-only event', r.gained === 0 && r.state.drops === 1 && r.state.points === 0, r.state);
s = Game.newState();
for (let i = 0; i < 25; i++) s = Game.award(s, CFG, 'added_product_viewed_by_other', { now: NOW }).state;
t('drops cap 20', s.drops === 20, s.drops);

/* ===== Odznaki, poziomy, wyzwanie ===== */
s = Game.newState();
let evs = [];
for (let i = 0; i < 25; i++) { const x = Game.award(s, CFG, 'product_checked', { code: String(1000 + i), now: new Date(NOW.getTime() + Math.floor(i / 10) * 864e5) }); s = x.state; evs = evs.concat(x.events); }
t('detektyw at 25 unique', evs.some(e => e.id === 'detektyw') && s.unlocked.detektyw, evs.map(e => e.id));
t('detektyw reward +30', s.points >= 30 + 46, s.points);
{ let q = Game.newState(), le = []; for (const c of ['a1', 'a2']) { const x = Game.award(q, CFG, 'product_added', { code: c, now: NOW }); q = x.state; le = le.concat(x.events); }
  t('level up event fired', le.some(e => e.type === 'level' && e.level === 2) && q.level === 2, le); }
const lv = Game.levelFor(CFG, 340);
t('level for 340 = 3 Detektyw', lv.level === 3 && lv.name === 'Detektyw składów' && lv.next.minPoints === 500, lv);
t('level for 0', Game.levelFor(CFG, 0).level === 1);
s = Game.newState();
const days = ['2026-10-19', '2026-10-21', '2026-10-21', '2026-10-24'];
evs = []; days.forEach(d => { const x = Game.award(s, CFG, 'app_opened', { now: new Date(d + 'T09:00:00') }); s = x.state; evs = evs.concat(x.events); });
t('3 distinct days in a week -> Pierwszy tydzień', evs.some(e => e.id === 'tydzien'), evs);
s = Game.newState(); evs = [];
['2026-10-25', '2026-10-26'].forEach(d => { const x = Game.award(s, CFG, 'app_opened', { now: new Date(d + 'T09:00:00') }); s = x.state; evs = evs.concat(x.events); });
t('days across weeks not combined', !evs.some(e => e.id === 'tydzien'));
t('weekKey ISO', Game.weekKey(new Date('2026-10-19T12:00:00')) === '2026-W43' && Game.weekKey(new Date('2026-10-25T12:00:00')) === '2026-W43' && Game.weekKey(new Date('2026-10-26T12:00:00')) === '2026-W44', [Game.weekKey(new Date('2026-10-19T12:00:00'))]);
t('weekKey year edge', Game.weekKey(new Date('2027-01-01T12:00:00')) === '2026-W53', Game.weekKey(new Date('2027-01-01T12:00:00')));
const ch = Game.challengeFor(CFG, NOW);
t('challenge rotates', ch && Game.challengeFor(CFG, new Date('2026-10-28T10:00:00')).id !== ch.id);
s = Game.newState(); evs = [];
const metricEvent = { swap_to_better: 'swap_to_better', guess_any: 'guess_right', store_tagged: 'store_tagged', distinct_categories: 'product_checked' }[ch.metric];
for (let i = 0; i < ch.target; i++) { const x = Game.award(s, CFG, metricEvent, { code: String(50 + i), category: 'cat' + i, now: NOW }); s = x.state; evs = evs.concat(x.events); }
t('weekly challenge done +50', evs.some(e => e.type === 'challenge' && e.points === 50), evs);
const cp = Game.challengeProgress(s, CFG, NOW);
t('challenge progress done', cp.done && cp.have === ch.target && cp.daysLeft >= 1 && cp.daysLeft <= 7, cp);
s = Game.newState(); evs = [];
for (let i = 0; i < 3; i++) { const x = Game.award(s, CFG, 'swap_to_better', { now: NOW }); s = x.state; evs = evs.concat(x.events); }
t('Mistrz zamian 3 swaps in week', evs.some(e => e.id === 'swap'), evs);
t('swap reward item', s.inventory.seed_strawberry >= 1, s.inventory);
s = Game.newState();
for (let i = 0; i < 10; i++) s = Game.award(s, CFG, 'explanation_opened', { code: 'c' + (i % 5), sugar: true, now: NOW }).state;
t('cukrowy detektyw needs 10 unique products', !s.unlocked.cukier && !s.unlocked.czytelnik, [s.sets, s.unlocked]);
t('explanations counted once per product per day', s.counters.explanation_opened === 5, s.counters);
{ let s2 = Game.newState();
for (let i = 0; i < 10; i++) s2 = Game.award(s2, CFG, 'explanation_opened', { code: 'd' + i, sugar: false, now: NOW }).state;
t('czytelnik after 10 different products', s2.unlocked.czytelnik && !s2.unlocked.cukier, s2.unlocked); }
const pr = Game.progress(s, CFG, CFG.achievements.achievements.find(a => a.id === 'cukier'), NOW);
t('progress 5 of 10', pr.have === 5 && pr.target === 10 && !pr.done, pr);
t('extra metric (breakfast on shelf)', Game.progress(s, CFG, CFG.achievements.achievements.find(a => a.id === 'sniadanie'), NOW, { breakfast_on_shelf: 4 }).have === 4);

/* ===== Odporność stanu ===== */
t('load garbage', Game.load('x').points === 0 && Game.load(null).v === 1 && Game.load({ v: 2, points: 999 }).points === 0);
t('load negative/NaN', Game.load({ v: 1, points: -5, drops: 'a', level: NaN, sets: { product_checked: [1, 'a', null] } }).points === 0 && Game.load({ v: 1, sets: { product_checked: [1, 'a', null] } }).sets.product_checked.join() === 'a');
r = Game.award(undefined, CFG, 'product_checked', { code: '1', now: NOW });
t('award without state', r.gained === 2);
const before = JSON.stringify(s); Game.award(s, CFG, 'product_checked', { code: 'zz', now: NOW });
t('award does not mutate input', JSON.stringify(s) === before);
s = Game.newState();
for (let d = 0; d < 40; d++) s = Game.award(s, CFG, 'app_opened', { now: new Date(NOW.getTime() + d * 864e5) }).state;
t('old days pruned', Object.keys(s.days).length <= 15, Object.keys(s.days).length);

/* ===== Półki ===== */
let sh = Shelf.newState();
const id0 = sh.active;
t('default shelf', sh.shelves.length === 1 && sh.shelves[0].name === 'Zakupy tygodniowe');
let x = Shelf.addShelf(sh, 'Dla Zosi'); sh = x.state;
x = Shelf.addShelf(sh, '  Grill   w sobotę '); sh = x.state;
t('add shelf trims name', x.shelf.name === 'Grill w sobotę' && sh.active === x.shelf.id);
x = Shelf.addShelf(sh, 'Czwarta');
t('free limit 3', x.error === 'limit' && x.state.shelves.length === 3);
t('empty name rejected', Shelf.addShelf(Shelf.newState(), '   ').error === 'name');
t('duplicate shelf name', Shelf.addShelf(Shelf.newState(), 'zakupy TYGODNIOWE').error === 'duplicate');
t('rename', Shelf.renameShelf(sh, id0, 'Biedronka').state.shelves[0].name === 'Biedronka');
x = Shelf.addItem(sh, id0, { name: 'Skyr naturalny', code: '5900000000001', pct: 91, categories: ['en:dairies'] }); sh = x.state;
t('add item from db', x.item.dept === 'dairy' && x.item.pct === 91);
t('duplicate code rejected', Shelf.addItem(sh, id0, { name: 'Skyr', code: '5900000000001' }).error === 'duplicate');
x = Shelf.addItem(sh, id0, { name: '  ziemniaki ' }); sh = x.state;
t('free text item dept', x.item.dept === 'veg' && x.item.name === 'ziemniaki');
t('duplicate free text', Shelf.addItem(sh, id0, { name: 'ZIEMNIAKI' }).error === 'duplicate');
t('empty item rejected', Shelf.addItem(sh, id0, { name: ' \n ' }).error === 'name');
x = Shelf.addItem(sh, id0, { name: '<img src=x onerror=alert(1)>' }); sh = x.state;
t('html kept as text (escaped at render)', x.item.name.startsWith('<img'));
t('long name cut', Shelf.addItem(sh, id0, { name: 'a'.repeat(500) }).item.name.length === 60);
const g = Shelf.grouped(sh.shelves[0]);
t('grouped in shop order', g[0].key === 'veg' && g[1].key === 'dairy', g.map(x => x.key));
let done = null;
sh.shelves[0].items.forEach(it => { x = Shelf.toggleItem(sh, id0, it.id); sh = x.state; done = x.completed; });
t('complete when all checked (3+)', done === true && Shelf.isComplete(sh.shelves[0]));
t('two items not complete', !Shelf.isComplete({ items: [{ checked: true }, { checked: true }] }));
x = Shelf.addItem(sh, id0, { name: 'ziemniaki' });
t('re-adding checked item restores it', x.restored && !x.item.checked);
t('share text only open items', /• ziemniaki/.test(Shelf.shareText(x.state.shelves[0])) && !/Skyr/.test(Shelf.shareText(x.state.shelves[0])), Shelf.shareText(x.state.shelves[0]));
const cl = Shelf.clearChecked(sh, id0);
t('clear checked', cl.removed === 3 && cl.state.shelves[0].items.length === 0, cl.removed);
let del = Shelf.deleteShelf(Shelf.newState(), Shelf.newState().active);
t('deleting last shelf keeps one', del.state.shelves.length === 1);
t('load garbage shelves', Shelf.load('x').shelves.length === 1 && Shelf.load({ v: 1, shelves: [{ name: 5, items: [{ name: '' }, { name: 'ok', dept: 'zzz', pct: 500, code: 'abc' }] }] }).shelves[0].items[0].dept === 'other');
const bad = Shelf.load({ v: 1, shelves: [{ id: 'a', name: 'A', items: [{ name: 'ok', pct: 500, code: 'abc' }] }] }).shelves[0].items[0];
t('load sanitizes pct and code', bad.pct === null && bad.code === null, bad);
t('full shelf', (() => { let st = Shelf.newState(); for (let i = 0; i < 200; i++) st = Shelf.addItem(st, null, { name: 'rzecz ' + i }).state; return Shelf.addItem(st, null, { name: 'jeszcze' }).error === 'full'; })());
t('breakfast good count', Shelf.breakfastGood({ shelves: [{ items: [{ dept: 'breakfast', pct: 80 }, { dept: 'breakfast', pct: 60 }, { dept: 'dairy', pct: 90 }] }] }) === 1);

/* ===== Uwagi z testów 19.10: bez profilu i cele ograniczające ===== */
t('no profile: not personal, verdict label', m1.personal === false && m1.label === 'Dobre na co dzień' && m1.rows.length === 0, m1);
const mh = pm(skyr, { goals: ['healthy'] });
t('only "po prostu zdrowiej" = general score', mh.personal === false && mh.general === true && mh.pct === m1.pct, mh);
// Cel „mniej soli”: więcej soli nigdy nie daje lepszego dopasowania, powyżej 1,5 g najwyżej 45%, średnio najwyżej 74%.
{
  const bases = [{ nutriscore: 'a', nova: 1 }, { nutriscore: 'b', nova: 3 }, { nutriscore: 'c', nova: 4 }, { nutriscore: 'd', nova: 2 }, { nutriscore: 'e', nova: 4, additiveTags: ['en:e250'] }];
  let monotonic = true, highOk = true, midOk = true, bad = null;
  for (const b of bases) {
    let prev = 101;
    for (let salt = 0; salt <= 5.001; salt += 0.1) {
      const r = pm(Object.assign({}, b, { nutriments: { salt: Math.round(salt * 10) / 10, sugars: 3 } }), { goals: ['pressure'] });
      if (r.pct > prev) { monotonic = false; bad = { b, salt, pct: r.pct, prev }; }
      if (salt > 1.5001 && r.pct > 45) { highOk = false; bad = { b, salt, pct: r.pct }; }
      if (salt > 0.3001 && salt <= 1.5 && r.pct > 74) { midOk = false; bad = { b, salt, pct: r.pct }; }
      prev = r.pct;
    }
  }
  t('salt goal: more salt never better', monotonic, bad);
  t('salt goal: >1,5 g → max 45%', highOk, bad);
  t('salt goal: 0,3–1,5 g → max 74%', midOk, bad);
  const a17 = pm({ nutriscore: 'c', nova: 3, nutriments: { salt: 1.7 } }, { goals: ['pressure'] });
  const b20 = pm({ nutriscore: 'a', nova: 1, nutriments: { salt: 2.0 } }, { goals: ['pressure'] });
  t('salt 2 g with great base is not "good"', b20.good === false && b20.level === 'poor' && a17.good === false, [a17.pct, b20.pct]);
  t('salt row explains the limit', /najwyżej 45%/.test(b20.rows[0].text) && /1,5 g/.test(b20.rows[0].text), b20.rows);
  const unk = pm({ nutriscore: 'a', nova: 1, nutriments: {} }, { goals: ['pressure'] });
  t('salt goal without salt data → max 70%', unk.pct <= 70, unk.pct);
  const low = pm({ nutriscore: 'a', nova: 1, nutriments: { salt: 0.1 } }, { goals: ['pressure'] });
  t('low salt with salt goal can be great', low.level === 'great', low.pct);
}
{
  let ok = true, info = null;
  for (let sug = 0; sug <= 60; sug += 1) {
    const r = pm({ nutriscore: 'b', nova: 1, nutriments: { sugars: sug } }, { goals: ['sugar'] });
    if (sug > 22.5 && r.pct > 45) { ok = false; info = [sug, r.pct]; }
    if (sug > 5 && sug <= 22.5 && r.pct > 74) { ok = false; info = [sug, r.pct]; }
  }
  t('sugar goal limits', ok, info);
  const drink = pm({ nutriscore: 'b', nova: 3, drink: true, nutriments: { sugars: 6 } }, { goals: ['weight'] });
  t('sweetened drink with weight goal max 45%', drink.pct <= 45, drink.pct);
}
t('restriction unknown → max 70%', pm({ nutriscore: 'a', nova: 1, ingredients: '', nutriments: { salt: 0.1 } }, { avoid: ['palm'] }).pct <= 70);
// Normalizacja z nowej wyszukiwarki: sklepy i dodatki z ingredients_tags.
{
  const n = A.normalizeProduct({ code: '590', product_name: 'Ser', stores: ['Lidl', 'Biedronka'], ingredients_tags: ['en:milk', 'en:e160b', 'en:e330'], image_front_url: 'https://x/y.jpg' }, 'off');
  t('stores normalized', n.stores.join() === 'Lidl,Biedronka', n.stores);
  t('additives from ingredients_tags', n.additiveTags.join() === 'en:e160b,en:e330', n.additiveTags);
  t('large image kept', n.imageLarge === 'https://x/y.jpg', n.imageLarge);
  const n2 = A.normalizeProduct({ code: '1', stores: 'Lidl, Aldi ' }, 'off');
  t('stores from text', n2.stores.join() === 'Lidl,Aldi' && n2.additiveTags === null, n2);
}

console.log(`unit-v1: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
