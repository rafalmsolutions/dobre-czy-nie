// Testy wersji D: profil „Nie jem” + „Pilnuję”, spójność dopasowania, przeniesienie ustawień, odznaki w 3 stopniach.
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..');
const ctx = { console, Intl, URL, setTimeout };
vm.createContext(ctx);
for (const f of ['data.js', 'core.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8').replace(/^'use strict';/m, ''), ctx, { filename: f });
const D = vm.runInContext('({ normalizeProduct, analyze, personalMatch, cleanProfile, migrateProfileD, watchFromGoals, WATCH, GOALS, WATCH_MAX })', ctx);

let pass = 0, fail = 0;
const ok = (c, name) => { if (c) pass++; else { fail++; console.log('  ✗ ' + name); } };
const P = o => D.normalizeProduct(Object.assign({ code: '5900000000001', product_name_pl: 'Produkt', nutriscore_grade: 'c', nova_group: 3, additives_tags: [], ingredients_text_pl: 'składnik, drugi składnik' }, o), 'off');
const M = (prod, prof) => D.personalMatch(prod, D.analyze(prod), prof);

// 1. Więcej składnika, którego pilnujesz, nigdy nie daje lepszego wyniku.
for (const [watch, key, max] of [['sugar', 'sugars_100g', 60], ['salt', 'salt_100g', 5], ['satfat', 'saturated-fat_100g', 20], ['kcal', 'energy-kcal_100g', 700]]) {
  let mono = true, prev = Infinity;
  for (let v = 0; v <= max; v += max / 80) { const pct = M(P({ nutriments: { [key]: v } }), { watch: [watch] }).pct; if (pct > prev) mono = false; prev = pct; }
  ok(mono, `więcej: ${watch} → nigdy lepszy wynik`);
}
// 2. Więcej białka/błonnika nigdy nie daje gorszego wyniku.
for (const [watch, key] of [['protein', 'proteins_100g'], ['fiber', 'fiber_100g']]) {
  let mono = true, prev = -1;
  for (let v = 0; v <= 30; v += 0.5) { const pct = M(P({ nutriments: { [key]: v } }), { watch: [watch] }).pct; if (pct < prev) mono = false; prev = pct; }
  ok(mono, `więcej: ${watch} → nigdy gorszy wynik`);
}
// 3. Te same dane = ten sam wynik, niezależnie od tego, z którego celu przyszła pozycja.
const choc = P({ nutriments: { sugars_100g: 48, salt_100g: 0.2, 'saturated-fat_100g': 18, 'energy-kcal_100g': 540 } });
ok(M(choc, { goals: ['sugar'], watch: D.watchFromGoals(['sugar']) }).pct === M(choc, { watch: ['sugar'] }).pct, 'cel „Mniej cukru” = „Pilnuję: cukier”');
ok(JSON.stringify(D.watchFromGoals(['heart'])) === JSON.stringify(['salt', 'satfat']), 'cel „Serce” = sól + tłuszcze nasycone');
// 4. Dużo → najwyżej 45%, brak danych → najwyżej 70%.
const great = P({ nutriscore_grade: 'a', nova_group: 1, nutriments: { sugars_100g: 30 } });
ok(M(great, { watch: ['sugar'] }).pct <= 45, 'dużo cukru → najwyżej 45%');
ok(M(P({ nutriscore_grade: 'a', nova_group: 1, nutriments: {} }), { watch: ['salt'] }).pct <= 70, 'brak danych o soli → najwyżej 70%');
// 5. „Nie jem” zawsze niżej niż produkt tylko „pilnowany”.
const milky = P({ allergens_tags: ['en:milk'], ingredients_text_pl: 'mleko, cukier', nutriscore_grade: 'a', nova_group: 1, nutriments: { sugars_100g: 1 } });
const bad = P({ nutriscore_grade: 'e', nova_group: 4, additives_tags: ['en:e250'], ingredients_text_pl: 'mięso, sól, azotyn sodu', nutriments: { salt_100g: 3, sugars_100g: 30, 'saturated-fat_100g': 20, 'energy-kcal_100g': 600 } });
const pm1 = M(milky, { allergens: ['milk'], watch: ['sugar'] }), pm2 = M(bad, { watch: ['sugar', 'salt', 'satfat', 'kcal', 'processing'] });
ok(pm1.pct <= 10 && pm1.status === 'fail', 'alergen → 0–10%');
ok(pm2.pct >= 12 && pm2.pct > pm1.pct, 'najgorszy „pilnowany” produkt i tak wyżej niż „nie jem”');
// 6. Rachunek się zgadza: ocena składu + suma punktów (z limitem i dolną granicą).
for (const prod of [choc, great, bad, milky]) {
  const pm = M(prod, { watch: ['sugar', 'salt', 'protein'] });
  if (pm.status === 'fail' || pm.base == null) continue;
  const sum = pm.rows.filter(r => r.delta != null).reduce((s, r) => s + r.delta, 0);
  const expect = Math.max(12, Math.min(pm.cap || 100, 100, Math.round(pm.base + sum)));
  ok(pm.pct === expect, `rachunek: ${pm.base} + ${sum} → ${pm.pct}%`);
}
// 7. Bez ustawień: ocena ogólna, bez zmian.
ok(M(choc, {}).personal === false && M(choc, {}).pct === D.analyze(choc).score, 'bez profilu: ocena ogólna');
// 8. Przeniesienie starych ustawień.
const mig = D.migrateProfileD({ goals: ['sugar', 'cholesterol', 'iron'], diet: ['vegan', 'diabetes', 'lowsodium'], avoid: ['palm', 'kidsugar', 'pork', 'ultra', 'caffeine'], allergens: ['nuts'], custom: ['czosnek'] });
ok(JSON.stringify(mig.goals) === JSON.stringify(['sugar', 'heart']), 'migracja: cele (żelazo znika)');
ok(['sugar', 'salt', 'satfat', 'processing', 'palm', 'caffeine'].every(k => mig.watch.includes(k)) && mig.watch.length <= D.WATCH_MAX, 'migracja: „unikam” i diety → „Pilnuję”');
ok(mig.diet.join() === 'vegan' && mig.avoid.join() === 'pork' && mig.allergens.join() === 'nuts' && mig.custom.join() === 'czosnek', 'migracja: „Nie jem” zostaje');
// 9. Profil: bez duplikatów, limity.
const cp = D.cleanProfile({ watch: ['sugar', 'sugar', 'salt', 'x', 'kcal', 'palm', 'fiber', 'protein', 'caffeine', 'satfat'], goals: ['sugar', 'heart', 'weight', 'muscle'] });
ok(cp.watch.length === D.WATCH_MAX && new Set(cp.watch).size === cp.watch.length && !cp.watch.includes('x'), 'Pilnuję: bez powtórzeń, najwyżej ' + D.WATCH_MAX);
ok(cp.goals.length === 3, 'cele: najwyżej 3');
ok(D.cleanProfile({ diet: ['diabetes', 'cardio', 'vegan'] }).diet.join() === 'vegan', 'diety „orientacyjne” usunięte');
// 10. Odznaki: 3 stopnie, rosnące progi, każda ma opis i ikonę.
const ach = JSON.parse(fs.readFileSync(path.join(dir, 'achievements.json'), 'utf8')).achievements;
const bases = [...new Set(ach.map(a => a.base))];
ok(bases.length >= 15, `odznak: ${bases.length}`);
ok(bases.every(b => { const t = ach.filter(a => a.base === b).sort((x, y) => x.tier - y.tier); return t.length === 3 && t[0].target < t[1].target && t[1].target < t[2].target; }), 'każda odznaka: 3 stopnie z rosnącymi progami');
ok(ach.every(a => a.description && a.icon && a.metric && a.reward && a.reward.points > 0) && new Set(ach.map(a => a.id)).size === ach.length, 'odznaki: opisy, ikony, unikalne id');

// 11. Historia gramatur z kopii bazy.
const q = D.normalizeProduct({ code: '5900000000017', product_name: 'X', qchg: [['2026-10-20', '360 g', '360 g'], ['2026-11-03', '340 g', '340 g'], 'zle', ['a']] }, 'off');
ok(q.qchg && q.qchg.length === 2 && q.qchg[1][2] === '340 g', 'gramatura: historia odczytana, złe wpisy pominięte');
ok(D.normalizeProduct({ code: '5900000000017', product_name: 'X' }, 'off').qchg === null, 'gramatura: brak historii = null');
// Ocet spirytusowy / winny to nie alkohol (21.10.2026, gulasz Krakus).
{
  const gul = P({ ingredients_text_pl: 'mięso wieprzowe (30%), sos: woda, mąka pszenna (gluten), musztarda (woda, gorczyca, ocet spirytusowy, cukier, sól), przyprawy' });
  ok(M(gul, { avoid: ['alcohol'] }).status !== 'fail', 'ocet spirytusowy nie jest alkoholem');
  ok(M(P({ ingredients_text_pl: 'ogórki, woda, ocet winny, sól' }), { avoid: ['alcohol'] }).status !== 'fail', 'ocet winny nie jest alkoholem');
  ok(M(P({ ingredients_text_pl: 'śliwki, cukier, spirytus 5%' }), { avoid: ['alcohol'] }).status === 'fail', 'spirytus nadal jest alkoholem');
  ok(M(P({ ingredients_text_pl: 'czekolada, wino 3%, ocet spirytusowy' }), { avoid: ['alcohol'] }).status === 'fail', 'wino obok octu nadal jest alkoholem');
}
console.log(`unit-d: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
