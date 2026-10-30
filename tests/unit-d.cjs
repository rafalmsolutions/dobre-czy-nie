// Testy wersji D: profil „Nie jem” + „Pilnuję”, spójność dopasowania, przeniesienie ustawień, odznaki w 3 stopniach.
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'app');
const ctx = { console, Intl, URL, setTimeout };
vm.createContext(ctx);
for (const f of ['data.js', 'core.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8').replace(/^'use strict';/m, ''), ctx, { filename: f });
const D = vm.runInContext('({ normalizeProduct, analyze, personalMatch, cleanProfile, migrateProfileD, watchFromGoals, WATCH, GOALS, WATCH_MAX, catListFilter, departmentFor })', ctx);

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
// 2.8.0: dyktowanie listy (rozbijanie wypowiedzi) i zamiana ogólnej pozycji na produkt.
{
  vm.runInContext(fs.readFileSync(path.join(dir, 'shelf.js'), 'utf8').replace(/^'use strict';/m, ''), ctx, { filename: 'shelf.js' });
  const S = vm.runInContext('Shelf', ctx);
  const a = S.splitSpeech('mleko, chleb i dwa jogurty');
  ok(a.length === 3 && a[2].name === 'jogurty' && a[2].qty === 2, 'dyktowanie: „mleko, chleb i dwa jogurty” → 3 pozycje, jogurty ×2');
  const b2 = S.splitSpeech('2 kg ziemniaki oraz masło');
  ok(b2.length === 2 && b2[0].unit === 'kg' && b2[0].qty === 2 && b2[1].name === 'masło', 'dyktowanie: „2 kg ziemniaki oraz masło” → 2 pozycje');
  ok(S.splitSpeech('1,5 l mleka a także dziesięć jajek').map(x => x.qty + x.unit).join() === '1.5l,10szt', 'dyktowanie: przecinek w liczbie nie dzieli, „a także”, „dziesięć”');
  const j = t => S.splitSpeech(t).map(x => x.name + (x.qty !== 1 || x.unit !== 'szt' ? ' ' + x.qty + x.unit : '')).join('|');
  ok(j('pomidory ziemniaki banany') === 'pomidory|ziemniaki|banany', 'dyktowanie bez przecinków: 3 produkty');
  ok(j('chleb żytni masło orzechowe') === 'chleb żytni|masło orzechowe', 'dyktowanie: przymiotnik zostaje przy produkcie');
  ok(j('pasta do zębów płyn do naczyń') === 'pasta do zębów|płyn do naczyń' && j('pierś z kurczaka ryż') === 'pierś z kurczaka|ryż', 'dyktowanie: po przyimku nie dzielimy');
  ok(j('jogurt naturalny dwa banany') === 'jogurt naturalny|banany 2szt' && j('dwa litry mleka trzy jogurty') === 'mleka 2l|jogurty 3szt', 'dyktowanie: liczebnik zaczyna nową pozycję');
  ok(j('mleko 2 litry chleb') === 'mleko 2l|chleb' && j('jajka 10 sztuk masło') === 'jajka 10szt|masło' && j('ser 2 kg ziemniaków') === 'ser|ziemniaków 2kg', 'dyktowanie: ilość po nazwie albo przed dopełniaczem');
  ok(j('warzywa mrożone') === 'warzywa mrożone' && j('kasza gryczana') === 'kasza gryczana' && j('makarony ryż') === 'makarony|ryż', 'dyktowanie: odmiana vs przymiotnik');
  ok(j('mleko przecinek chleb') === 'mleko|chleb' && j('cebula czosnek jeszcze pietruszka') === 'cebula|czosnek|pietruszka', 'dyktowanie: „przecinek”, „jeszcze”');
  ok(S.splitSpeech('chleb').length === 1 && S.splitSpeech('  ').length === 0, 'dyktowanie: jedna rzecz / pusto');
  let st = S.newState(); const sid = st.active;
  for (const n of ['chleb', '2 l mleko', 'jogurty']) st = S.addItem(st, sid, { name: n }).state;
  const sh = () => st.shelves[0];
  const g = S.findGeneric(sh(), { name: 'Mleko 2%', categories: ['en:milks'] });
  ok(g && g.name === 'mleko', 'zamiana: „mleko” pasuje do „Mleko 2%” (nazwa)');
  ok(S.findGeneric(sh(), { name: 'Skyr naturalny', categories: ['en:yogurts'] }, n => /jogurt/.test(n) ? 'en:yogurts' : '').name === 'jogurty', 'zamiana: „jogurty” pasuje przez kategorię');
  ok(!S.findGeneric(sh(), { name: 'Ketchup', categories: ['en:ketchup'] }), 'zamiana: niepasujący produkt → brak');
  const r = S.replaceItem(st, sid, g.id, { name: 'Mleko 2%', code: '5900000000999', pct: 70, categories: ['en:milks'] });
  const i1 = r.state.shelves[0].items[1];
  ok(i1.code === '5900000000999' && i1.checked && i1.qty === 2 && i1.unit === 'l' && i1.added === g.added, 'zamiana: to samo miejsce i ilość, w koszyku');
  const u = S.undoReplace(r.state, sid, i1.id, r.old).state.shelves[0].items;
  ok(u.length === 3 && u[1].name === 'mleko' && !u[1].checked && !u.some(i => i.code), 'cofnięcie zamiany przywraca pozycję ogólną');
}
// Alergeny: słowo musi zaczynać wyraz (dżem: „malin zużyto” to nie „żyto”).
{ const jam = P({ product_name_pl: 'Dżem malinowy', ingredients_text_pl: 'Maliny (100 g malin zużyto na 100 g produktu), cukry pochodzące z owoców, substancja żelująca - pektyny. SPORZĄDZONO ZE 100g OWOCÓW NA 100 g PRODUKTU', additives_tags: ['en:e440'] });
  ok(M(jam, { allergens: ['gluten'] }).status !== 'fail', 'dżem: „zużyto” nie oznacza glutenu');
  ok(M(jam, { diet: ['glutenfree'] }).status !== 'fail', 'dżem: dieta bezglutenowa nie odrzuca');
  ok(M(P({ ingredients_text_pl: 'mąka pszenno-żytnia, woda, sól' }), { allergens: ['gluten'] }).status === 'fail', 'mąka pszenno-żytnia: gluten');
  ok(M(P({ ingredients_text_pl: 'płatki owsiane 100%' }), { allergens: ['gluten'] }).status === 'fail', 'płatki owsiane: gluten');
  ok(M(P({ ingredients_text_pl: 'mleko, ser (mleko, sól)' }), { allergens: ['milk'] }).status === 'fail', 'ser: mleko'); }
// 3.0.14: kafel „Słodkie kremy” (en:sweet-spreads) bez dżemów, miodów i musów; inne kategorie bez zmian.
{ const S = (name, cats) => P({ product_name_pl: name, categories_hierarchy: ['en:spreads', 'en:sweet-spreads'].concat(cats || []) });
  const list = [S('Nutella', ['en:chocolate-spreads']), S('Masa krówkowa'), S('Krem czekoladowy'), S('Konfitura truskawkowa', ['en:jams']), S('Miód lipowy', ['en:honeys']),
    S('Ovolovo Gruszka Mus owocowy', ['en:fruit-and-vegetable-preserves']), S('Marmolada wieloowocowa'), S('Powidła śliwkowe'), S('Kubuś mus pitaya')];
  const kept = D.catListFilter('en:sweet-spreads', list).map(p => p.name);
  ok(kept.join('|') === 'Nutella|Masa krówkowa|Krem czekoladowy', 'słodkie kremy: tylko kremy (' + kept.join('|') + ')');
  ok(D.catListFilter('en:jams', list).length === list.length, 'dżemy: lista bez filtra');
  ok(D.catListFilter('en:sweet-spreads', [S('Musli z kremem')]).length === 1, '„musli” to nie „mus”'); }
// 3.0.16: napoje roślinne nie w Nabiale; zwykłe mleko zostaje w Nabiale.
{ const dep = n => D.departmentFor({ name: n });
  const plant = ['mleko owsiane', 'Mleko sojowe', 'mleko migdałowe', 'mleko ryżowe', 'mleko kokosowe', 'napój owsiany', 'Napój roślinny', 'mleczko kokosowe'];
  const dairy = ['mleko', 'Mleko 2%', 'mleko UHT', 'mleko bez laktozy', 'mleko 3,2% Łaciate'];
  ok(plant.every(n => dep(n) === 'drinks'), 'napoje roślinne → Napoje (' + plant.map(n => n + ':' + dep(n)).join(', ') + ')');
  ok(dairy.every(n => dep(n) === 'dairy'), 'mleko krowie → Nabiał (' + dairy.map(n => n + ':' + dep(n)).join(', ') + ')');
  const juice = ['sok pomarańczowy', 'Sok jabłkowy 1 l', 'nektar z czarnej porzeczki', 'soki owocowe'], fruit = ['pomarańcze', 'jabłka', 'sos pomidorowy'];
  ok(juice.every(n => dep(n) === 'drinks'), 'soki i nektary → Napoje (' + juice.map(n => n + ':' + dep(n)).join(', ') + ')');
  ok(dep('pomarańcze') === 'veg' && dep('jabłka') === 'veg' && dep('sos pomidorowy') !== 'drinks', 'owoce zostają w warzywach i owocach, sos nie jest sokiem (' + fruit.map(n => n + ':' + dep(n)).join(', ') + ')'); }
// 3.0.18: bez składu, ale z kategorii jednoznacznie zwierzęcej → „nie pasuje” z uczciwym powodem; produkty roślinne bez zmian.
{ const N = (name, cats, extra) => D.normalizeProduct(Object.assign({ code: '5900000000002', product_name_pl: name, nutriscore_grade: 'd', categories_hierarchy: cats }, extra || {}), 'off');
  const st = (prod, diet) => { const m = M(prod, { diet: [diet] }); return { s: m.status, why: (m.match.fails[0] || {}).why || '' }; };
  const cheese = N('Pecorino biologico', ['en:dairies', 'en:fermented-foods', 'en:fermented-milk-products', 'en:cheeses', 'en:sheep-cheeses']);
  const vcheese = N('Ser wegański', ['en:plant-based-foods-and-beverages', 'en:plant-based-foods', 'en:dairy-substitutes', 'en:cheeses', 'en:plant-based-cheese-alternatives']);
  const tofu = N('Tofu naturalne', ['en:plant-based-foods-and-beverages', 'en:plant-based-foods', 'en:legumes-and-their-products', 'en:meat-alternatives', 'en:tofus']);
  const ham = N('Szynka', ['en:meats-and-their-products', 'en:prepared-meats', 'en:hams']);
  const honey = N('Miód lipowy', ['en:spreads', 'en:sweet-spreads', 'en:bee-products', 'en:honeys']);
  const c1 = st(cheese, 'vegan');
  ok(c1.s === 'fail' && c1.why === 'to ser (kategoria w bazie)', 'ser bez składu, weganin: nie pasuje, „to ser (kategoria w bazie)” (' + JSON.stringify(c1) + ')');
  ok(st(cheese, 'vegetarian').s === 'unknown', 'ser bez składu, wegetarianin: bez zmian („nie wiemy”)');
  ok(st(vcheese, 'vegan').s === 'unknown', 'ser wegański (plant-based): nie oznaczamy jako niepasujący');
  ok(st(tofu, 'vegan').s === 'unknown' && st(tofu, 'vegetarian').s === 'unknown', 'tofu: bez zmian („nie wiemy”), nigdy „pasuje” z samej kategorii');
  const h = st(ham, 'vegetarian');
  ok(h.s === 'fail' && /wędlina/.test(h.why), 'szynka bez składu, wegetarianin: nie pasuje (' + h.why + ')');
  ok(st(honey, 'vegan').s === 'fail' && st(honey, 'vegetarian').s !== 'fail', 'miód: nie dla wegan, dla wegetarian bez zmian');
  ok(st(N('Ser z etykietą', ['en:cheeses'], { labels_tags: ['en:vegan'] }), 'vegan').s !== 'fail', 'etykieta wegańska wygrywa z kategorią');
  ok(st(N('Ser', ['en:cheeses'], { ingredients_text_pl: 'mleko, sól, podpuszczka' }), 'vegan').why === 'zawiera składniki odzwierzęce', 'ze składem: powód ze składu jak dotąd'); }
// 3.0.19: brakujące wartości odżywcze wyliczone z innych (bez zgadywania).
{ const N = (nut, cats) => P({ nutriments: nut, categories_hierarchy: cats || [] });
  const oil = N({ fat_100g: 100, carbohydrates_100g: 0, proteins_100g: 0, 'energy-kcal_100g': 900, 'saturated-fat_100g': 8 });
  ok(oil.nutriments.sugars === 0 && oil.nutriDerived.sugars.kind === 'exact' && oil.nutriDerived.sugars.from === 'węglowodany 0 g', 'olej: węglowodany 0 → cukry 0 (dokładnie)');
  ok(oil.nutriments.salt == null && !(oil.nutriDerived || {}).salt, 'olej bez soli i sodu: sól nadal „brak danych” (nie zgadujemy)');
  const water = N({ fat_100g: 0, carbohydrates_100g: 0, proteins_100g: 0, 'energy-kcal_100g': 0, sodium_100g: 0.004 }, ['en:beverages', 'en:waters']);
  ok(water.nutriments.sat === 0 && water.nutriments.sugars === 0 && water.nutriments.salt === 0.01, 'woda: nasycone 0, cukry 0, sól z sodu 0,004 × 2,5 = 0,01 (' + JSON.stringify(water.nutriments) + ')');
  const lean = N({ fat_100g: 1, carbohydrates_100g: 3, salt_100g: 0.2 });
  ok(lean.nutriments.sat === 1 && lean.nutriDerived.sat.kind === 'max' && lean.nutriments.sugars === 3 && lean.nutriDerived.sugars.kind === 'max', 'tłuszcz 1 g, węglowodany 3 g → najwyżej 1 g nasyconych i 3 g cukrów (na pewno „mało”)');
  const fatty = N({ fat_100g: 30, carbohydrates_100g: 50 });
  ok(fatty.nutriments.sat == null && fatty.nutriments.sugars == null, 'tłuszcz 30 g, węglowodany 50 g: bez wyliczeń (poziom niepewny)');
  const known = N({ fat_100g: 0, 'saturated-fat_100g': 0.5, carbohydrates_100g: 0, sugars_100g: 0.2, salt_100g: 1, sodium_100g: 0.1 });
  ok(known.nutriDerived === null && known.nutriments.sat === 0.5 && known.nutriments.salt === 1, 'wartości z bazy nigdy nie są nadpisywane');
  const drinkLean = N({ fat_100g: 1, carbohydrates_100g: 4 }, ['en:beverages']);
  ok(drinkLean.nutriments.sat == null && drinkLean.nutriments.sugars == null, 'napój: progi „mało” dla napojów (0,75 g / 2,5 g) – 1 g tłuszczu i 4 g węglowodanów to za mało pewności');
  const m = M(N({ fat_100g: 0, carbohydrates_100g: 0, salt_100g: 0.01, proteins_100g: 0 }), { watch: ['sugar', 'satfat'] });
  const rows = m.rows.filter(r => r.watch === 'sugar' || r.watch === 'satfat' || /cukr|nasyc/i.test(r.title || ''));
  ok(m.rows.some(r => /wyliczone: węglowodany 0 g/.test(r.value || '')) && m.rows.some(r => /wyliczone: tłuszcz 0 g/.test(r.value || '')), 'rachunek: przy wartości podpis „wyliczone: …” (' + rows.map(r => r.value).join(' | ') + ')'); }
// 3.0.21: „Bez mleka i przetworów”, poprawione „Bez laktozy”, „Pescetariańska”.
{ const I = (name, ing, extra) => P(Object.assign({ product_name_pl: name, ingredients_text_pl: ing }, extra || {}));
  const st = (prod, diet) => M(prod, { diet: [diet] }).status;
  const milkLF = I('Mleko bez laktozy 2%', 'mleko, enzym laktaza', { labels_tags: ['en:lactose-free'], allergens_tags: ['en:milk'] });
  const milkLFtext = I('Jogurt naturalny bez laktozy', 'mleko, kultury bakterii, laktaza', { allergens_tags: ['en:milk'] });
  const cheese = I('Ser gouda', 'mleko, sól, podpuszczka', { allergens_tags: ['en:milk'] });
  const coco = I('Deser kokosowy', 'mleko kokosowe 80%, cukier, skrobia');
  const choc = I('Czekolada gorzka 90%', 'miazga kakaowa, masło kakaowe, cukier');
  const whey = I('Baton proteinowy', 'izolat białek serwatkowych, kakao');
  ok(st(milkLF, 'lactose') !== 'fail' && st(milkLFtext, 'lactose') !== 'fail', 'bez laktozy: mleko i jogurt „bez laktozy” pasują (etykieta, nazwa, laktaza)');
  ok(st(cheese, 'lactose') === 'fail', 'bez laktozy: zwykły ser nadal nie pasuje');
  ok(st(milkLF, 'nomilk') === 'fail' && st(milkLFtext, 'nomilk') === 'fail' && st(cheese, 'nomilk') === 'fail' && st(whey, 'nomilk') === 'fail', 'bez mleka: mleko bez laktozy, jogurt, ser, serwatka – nie pasują');
  ok(st(coco, 'nomilk') !== 'fail' && st(choc, 'nomilk') !== 'fail' && st(coco, 'lactose') !== 'fail', 'bez mleka / bez laktozy: „mleko kokosowe” i „masło kakaowe” to nie mleko');
  ok(M(cheese, { diet: ['nomilk'] }).match.fails[0].why === 'zawiera mleko lub jego przetwory', 'bez mleka: powód „zawiera mleko lub jego przetwory”');
  const noIngCheese = P({ product_name_pl: 'Ser', ingredients_text_pl: '', categories_hierarchy: ['en:dairies', 'en:cheeses'] });
  ok(M(noIngCheese, { diet: ['nomilk'] }).match.fails.some(f => f.why === 'to ser (kategoria w bazie)'), 'bez mleka: ser bez składu – „to ser (kategoria w bazie)”');
  const tuna = I('Tuńczyk w sosie własnym', 'tuńczyk, woda, sól', { ingredients_analysis_tags: ['en:non-vegetarian'] });
  const ham = I('Szynka', 'mięso wieprzowe 90%, sól');
  const gummy = I('Żelki', 'cukier, syrop glukozowy, żelatyna wieprzowa');
  ok(st(tuna, 'pescetarian') !== 'fail' && st(tuna, 'vegetarian') === 'fail', 'pescetariańska: tuńczyk pasuje (wegetariańska – nie)');
  ok(st(ham, 'pescetarian') === 'fail' && st(gummy, 'pescetarian') === 'fail', 'pescetariańska: szynka i żelki z żelatyną nie pasują');
  const noIngFish = P({ product_name_pl: 'Łosoś wędzony', ingredients_text_pl: '', categories_hierarchy: ['en:seafood', 'en:fishes'] });
  const noIngSausage = P({ product_name_pl: 'Kiełbasa', ingredients_text_pl: '', categories_hierarchy: ['en:meats', 'en:prepared-meats', 'en:sausages'] });
  ok(st(noIngFish, 'pescetarian') === 'unknown' && st(noIngSausage, 'pescetarian') === 'fail', 'pescetariańska bez składu: ryba „nie wiemy”, kiełbasa „nie pasuje” (kategoria)'); }
// 3.0.23: konkretne słodziki i „Bez słodzików” (numer E albo nazwa w składzie).
{ const I = (ing, adds) => P({ ingredients_text_pl: ing, additives_tags: adds || [] });
  const st = (prod, k) => { const m = M(prod, { avoid: [k] }); return m.status + (m.match.fails[0] ? ':' + m.match.fails[0].why : ''); };
  const gum = I('słodzik: sorbitol, maltitol, aromat', ['en:e420', 'en:e965']), drink = I('woda, kwasek cytrynowy, sukraloza'), ery = I('erytrytol 99%, glikozydy stewiolowe'), plain = I('woda, cukier, sok z cytryny');
  ok(/^fail/.test(st(gum, 'sw-sorbitol')) && /^fail/.test(st(gum, 'sw-maltitol')) && !/^fail/.test(st(gum, 'sw-erythritol')), 'guma z sorbitolem i maltitolem: nie dla „sorbitol”, „maltitol”, pasuje przy „erytrytol”');
  ok(/^fail/.test(st(drink, 'sw-sucralose')) && /^fail/.test(st(ery, 'sw-erythritol')) && /^fail/.test(st(ery, 'sw-stevia')), 'nazwa w składzie bez numeru E: sukraloza, erytrytol, stewia');
  ok(/^fail:.*sukraloza/i.test(st(drink, 'sweeteners')) && /^fail/.test(st(gum, 'sweeteners')) && !/^fail/.test(st(plain, 'sweeteners')), '„Bez słodzików”: wszystkie (także po nazwie), cukier to nie słodzik');
  ok(D.cleanProfile({ avoid: ['sw-sorbitol', 'sweeteners', 'xxx'] }).avoid.join('|') === 'sw-sorbitol|sweeteners', 'profil zapisuje nowe klucze słodzików'); }
// 3.0.24: własne składniki – synonimy i znalezione słowo w powodzie.
{ const I = ing => P({ ingredients_text_pl: ing });
  const why = (ing, c) => { const m = M(I(ing), { custom: [c] }); return m.status + (m.match.fails[0] ? ':' + m.match.fails[0].why : ''); };
  ok(why('cukier, serwatka w proszku, kakao', 'mleko') === 'fail:w składzie: serwatka', 'mleko → „w składzie: serwatka” (' + why('cukier, serwatka w proszku, kakao', 'mleko') + ')');
  ok(why('woda, Kazeinian sodu', 'mleko') === 'fail:w składzie: kazeinian', 'mleko → kazeinian (' + why('woda, Kazeinian sodu', 'mleko') + ')');
  ok(why('mąka pszenna, woda, sól', 'gluten') === 'fail:w składzie: pszenna', 'gluten → pszenna');
  ok(why('cukier, olej, pasta tahini', 'sezam') === 'fail:w składzie: tahini', 'sezam → tahini');
  ok(why('mięso, sól, E621', 'glutaminian') === 'fail:w składzie: e621', 'glutaminian → E621');
  ok(why('pasta z masła arachidowego, sól', 'orzeszki ziemne') === 'fail:w składzie: arachidowego', 'orzeszki ziemne → arachidowego');
  ok(why('cukier, woda. Może zawierać: mleko', 'mleko') === 'traces', 'mleko tylko w „może zawierać”: ślady, nie „nie pasuje”');
  ok(why('czosnek granulowany, sól', 'czosnek') === 'fail:w składzie: czosnek', 'bez synonimu: odmiana słowa nadal działa');
  const bad = vm.runInContext('CUSTOM_SUGGEST.filter(s => !cleanCustom(s) || customProblem(s, []) || !customMatcher(s))', ctx);
  ok(!bad.length, 'każda podpowiedź przechodzi walidację (' + bad.join(', ') + ')'); }
// 3.0.25: „Pilnuję: węglowodany”.
{ const C = (carbs, cats) => P({ nutriments: carbs == null ? {} : { carbohydrates_100g: carbs }, categories_hierarchy: cats || [] });
  const row = prod => M(prod, { watch: ['carbs'] }).rows.find(r => /Węglowodany/.test(r.title || '')) || {};
  const r1 = row(C(4)), r2 = row(C(20)), r3 = row(C(65)), r4 = row(C(null)), r5 = row(C(5, ['en:beverages']));
  ok(r1.word === 'mniej węglowodanów' && r1.delta === 5 && /4 g na 100 g/.test(r1.value) && r1.title === 'Węglowodany', 'węglowodany 4 g: „mniej węglowodanów”, +5 (' + JSON.stringify(r1) + ')');
  ok(r2.word === 'pośrednia zawartość' && r2.delta === -5 && r2.cap == null, 'węglowodany 20 g: „pośrednia zawartość”, −5, bez limitu');
  ok(r3.word === 'więcej węglowodanów' && r3.delta === -10 && r3.cap == null && /przedziały przyjęte przez Lupkę/.test(r3.text), 'węglowodany 65 g: −10, bez limitu 45%, z dopiskiem o przedziałach Lupki');
  ok(r4.word === 'brak danych' && r4.cap === 70, 'bez węglowodanów w bazie: „brak danych”, najwyżej 70% (jak inne pozycje)');
  ok(r5.word === 'pośrednia zawartość' && /100 ml/.test(r5.value), 'napój 5 g: pośrednia (progi dla napojów)');
  const sug = M(P({ nutriments: { sugars_100g: 30 } }), { watch: ['sugar'] }).rows.find(r => r.watch === 'sugar');
  ok(sug.word === 'dużo' && sug.delta === -25 && sug.cap === 45, 'cukier bez zmian: dużo −25, najwyżej 45%');
  ok(M(C(65), { watch: ['carbs'] }).pct < M(C(4), { watch: ['carbs'] }).pct, 'więcej węglowodanów → niższy wynik'); }
// 3.0.16: znak ℮ w gramaturze.
{ const q = v => P({ quantity: v }).quantity;
  ok(q('400 g e') === '400 g' && q('400 g ℮') === '400 g' && q('℮ 750 ml') === '750 ml' && q('1 l e') === '1 l', 'gramatura bez ℮/„e” (' + [q('400 g e'), q('400 g ℮'), q('℮ 750 ml'), q('1 l e')].join(' | ') + ')');
  ok(q('2 x 125 g') === '2 x 125 g' && q('500 g') === '500 g' && q('') === '' && q(undefined) === '', 'zwykła gramatura bez zmian'); }
console.log(`unit-d: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
