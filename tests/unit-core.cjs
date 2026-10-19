// Testy logiki oceny. Uruchom: node unit.cjs
const { A } = require('./bundle.js');
let pass = 0, fail = 0;
const t = (name, cond, info) => { if (cond) pass++; else { fail++; console.log('FAIL', name, info !== undefined ? JSON.stringify(info) : ''); } };
const prod = o => Object.assign({ code: '1', kind: 'food', source: 'off', name: 'x', nutriscore: '', nova: null, additiveTags: [], ingredients: '', allergens: [], nutriments: {} }, o);
const run = o => A.analyze(prod(o));

// Werdykty
t('verdict 90', A.grade(90).label === 'Dobre na co dzień');
t('verdict 60', A.grade(60).label === 'Dobre');
t('verdict 30', A.grade(30).label === 'Od czasu do czasu');
t('verdict 10', A.grade(10).label === 'Raczej rzadko');
t('verdict null', A.grade(null).label === 'Brak oceny');
t('verdict NaN', A.grade(NaN).label === 'Brak oceny');
t('verdict edges', A.grade(75).label === 'Dobre na co dzień' && A.grade(74).label === 'Dobre' && A.grade(50).label === 'Dobre' && A.grade(49).label === 'Od czasu do czasu' && A.grade(25).label === 'Od czasu do czasu' && A.grade(24).label === 'Raczej rzadko');

// Dodatki według ryzyka
const msg = run({ nutriscore: 'd', nova: 4, additiveTags: ['en:e621', 'en:e627', 'en:e631'], ingredients: 'x' });
t('MSG no penalty', msg.parts.find(p => p.key === 'additives').v === 100, msg.parts);
t('MSG score 45', msg.score === 45, msg.score);
const lec = run({ nutriscore: 'b', nova: 3, additiveTags: ['en:e322', 'en:e330'], ingredients: 'x' });
t('neutral additives keep 100', lec.parts.find(p => p.key === 'additives').v === 100);
const carr = run({ nutriscore: 'b', nova: 3, additiveTags: ['en:e407'], ingredients: 'x' });
t('E407 minus 15', carr.parts.find(p => p.key === 'additives').v === 85);
t('E407 no cap', !carr.capped);
const asp = run({ nutriscore: 'a', nova: 1, additiveTags: ['en:e951'], ingredients: 'x' });
t('aspartame not capped (no strong evidence)', !asp.capped && asp.score > 49, asp);
// Limit tylko dla E171 i azotynów/azotanów
const yog = run({ nutriscore: 'a', nova: 1, additiveTags: ['en:e250'], ingredients: 'x' });
t('E250 caps at 49', yog.capped && yog.score === 49 && yog.capBy[0] === 'E250', yog);
const ti = run({ nutriscore: 'a', nova: 3, additiveTags: ['en:e171'], ingredients: 'x' });
t('E171 caps', ti.capped && ti.score === 49);
const ham = run({ nutriscore: 'd', nova: 4, additiveTags: ['en:e250', 'en:e451', 'en:e301', 'en:e407'], ingredients: 'mięso' });
t('ham score 29 (Od czasu do czasu)', ham.score === 29 && A.grade(ham.score).label === 'Od czasu do czasu', ham.score);

// Ochrona prostej żywności
const oil = run({ nutriscore: 'e', nova: 2, additiveTags: undefined, ingredients: '' });
t('olive oil floored to 25', oil.floored && oil.score === 25, oil);
const nuts = run({ nutriscore: 'e', nova: null, additiveTags: [], ingredients: 'orzeszki ziemne 100%' });
t('1-ingredient product is simple', nuts.simple === true);
t('peanuts not lowest verdict', A.grade(nuts.score).label !== 'Raczej rzadko', nuts);
const candy = run({ nutriscore: 'e', nova: 4, additiveTags: [], ingredients: 'cukier, syrop glukozowy, żelatyna, kwas cytrynowy, aromat' });
t('candy not simple', candy.simple === false, candy);
const oilWithAdd = run({ nutriscore: 'e', nova: 4, additiveTags: ['en:e250'], ingredients: 'x' });
t('cap beats floor', !oilWithAdd.floored);
const sugar = run({ nutriscore: 'e', nova: 2, additiveTags: [], ingredients: 'cukier' });
t('sugar never below 25', sugar.score >= 25 && sugar.simple);

// Brak danych
const empty = run({ additiveTags: undefined });
t('no data -> null score', empty.score === null);
const weird = run({ nutriscore: 'not-applicable', nova: 'unknown', additiveTags: [] , ingredients: ''});
t('not-applicable handled', weird.score === null || typeof weird.score === 'number', weird);

// Kosmetyki
const cos = A.analyze(prod({ kind: 'cosmetic', ingredients: 'Aqua, Glycerin, Parfum, Limonene, Linalool, Phenoxyethanol' }));
t('cosmetic allergens no penalty', cos.score === 100, cos.score);
const cos2 = A.analyze(prod({ kind: 'cosmetic', ingredients: 'Aqua, Propylparaben, Methylisothiazolinone' }));
t('cosmetic MI caps', cos2.score <= 49 && cos2.capped === false ? cos2.score === 45 : cos2.score === 49, cos2);
const cos3 = A.analyze(prod({ kind: 'cosmetic', ingredients: '' }));
t('cosmetic empty null', cos3.score === null);

// Normalizacja dziwnych danych
const n = A.normalizeProduct({ code: '1', nutriments: { 'sugars_100g': 'abc', 'salt_100g': -1, 'fat_100g': '3.5' } }, 'off');
t('bad nutriments -> null', n.nutriments.sugars === null && n.nutriments.salt === null && n.nutriments.fat === 3.5, n.nutriments);
const n2 = A.normalizeProduct({}, 'off');
t('empty product normalizes', n2.name === '' && n2.code === '');

// Efekt dodatku
t('effect neutral', A.additiveEffect({ code: 'E330', level: 0 }) === 'Nie obniża oceny.');
t('effect cap text', /49/.test(A.additiveEffect({ code: 'E250', level: 3 })));


// Etap 2: „Dlaczego?” i źródła
const nutP = prod({ nutriscore: 'e', nova: 4, additiveTags: ['en:e322'], ingredients: 'cukier, olej palmowy', nutriments: { sugars: 56.3, salt: 0.1, sat: 10.6 } });
const why = A.explain(nutP, A.analyze(nutP)).map(w => w.sign + ' ' + w.text);
t('why nutriscore', why.some(w => /^- Słaba wartość odżywcza \(Nutri-Score E\)/.test(w)), why);
t('why sugar', why.some(w => /^- Dużo cukru: 56,3 g/.test(w)), why);
t('why sat fat', why.some(w => /tłuszczów nasyconych/.test(w)), why);
t('why neutral additive', why.some(w => /^i 1 dodatek bez wpływu/.test(w)), why);
t('why nova4', why.some(w => /NOVA 4/.test(w)), why);
const hamP = prod({ nutriscore: 'd', nova: 4, additiveTags: ['en:e250', 'en:e407'], ingredients: 'x' });
const whyH = A.explain(hamP, A.analyze(hamP)).map(w => w.sign + ' ' + w.text);
t('why ham E250 penalty', whyH.some(w => /^- E250 \(azotyn sodu\): duże zastrzeżenia, −40 pkt/.test(w)), whyH);
t('why ham cap info', whyH.some(w => /Zawiera E250, więc ocena i tak nie mogłaby przekroczyć 49/.test(w)), whyH);
const oilP = prod({ nutriscore: 'e', nova: 2, additiveTags: undefined });
const whyO = A.explain(oilP, A.analyze(oilP)).map(w => w.sign + ' ' + w.text);
t('why oil floor', whyO.some(w => /^\+ Produkt prosty/.test(w)), whyO);
t('why oil no ingredients', whyO.some(w => /nie ma składu/.test(w)), whyO);
const noneP = prod({ additiveTags: undefined });
t('why empty product no crash', Array.isArray(A.explain(noneP, A.analyze(noneP))));
const cosP = prod({ kind: 'cosmetic', ingredients: 'Aqua, Parfum, Propylparaben, Methylisothiazolinone' });
const whyC = A.explain(cosP, A.analyze(cosP)).map(w => w.sign + ' ' + w.text);
t('why cosmetic MI', whyC.some(w => /Methylisothiazolinone: duże zastrzeżenia \(−40 pkt\)/.test(w)), whyC);
t('why cosmetic cap info', whyC.some(w => /nie mogłaby przekroczyć 49/.test(w)), whyC);
const src = A.sourcesFor(A.additivesFromTags(['en:e250', 'en:e951'])).map(s => s.key);
t('sources IARC/EFSA', src.includes('IARC') && src.includes('EFSA'), src);
t('sources none', A.sourcesFor([]).length === 0);

// Etap 3: profil
const M = (o, prof) => { const pr = prod(o); return A.matchProfile(pr, A.analyze(pr), prof); };
const yogurt = { nutriscore: 'a', nova: 1, allergens: ['en:milk'], ingredients: 'mleko, żywe kultury bakterii', nutriments: { sugars: 4.5 } };
t('empty profile -> none', M(yogurt, {}).status === 'none');
t('milk allergy -> fail', M(yogurt, { allergens: ['milk'] }).status === 'fail');
t('milk from text only', M({ ingredients: 'mąka pszenna, MLEKO w proszku, cukier' }, { allergens: ['milk'] }).status === 'fail');
t('mleczan is not milk', M({ ingredients: 'woda, mleczan wapnia, sól' , additiveTags: []}, { allergens: ['milk'] }).status === 'ok');
t('cocoa butter not milk', M({ ingredients: 'cukier, masło kakaowe, kakao', additiveTags: [] }, { allergens: ['milk'] }).status === 'ok');
t('rybonukleotydy not fish', M({ ingredients: "sól, 5'-rybonukleotydy disodowe", additiveTags: [] }, { allergens: ['fish'] }).status === 'ok');
const oat = { nutriscore: 'b', nova: 4, allergens: ['en:gluten'], traces: ['en:nuts'], analysis: ['en:vegan', 'en:palm-oil-free'], labels: ['en:vegan'], additiveTags: ['en:e340'], ingredients: 'woda, owies 10%, olej rzepakowy, fosforany potasu, sól' };
t('oat vegan ok', M(oat, { diet: ['vegan'] }).status === 'ok');
t('oat gluten fail', M(oat, { allergens: ['gluten'] }).status === 'fail');
t('oat nuts traces', M(oat, { allergens: ['nuts'] }).status === 'traces');
t('traces from text', M({ ingredients: 'cukier, kakao. Może zawierać orzechy laskowe i mleko.', additiveTags: [] }, { allergens: ['nuts'] }).status === 'traces');
t('traces not counted as contains', M({ ingredients: 'cukier, kakao. Może zawierać orzechy laskowe.', additiveTags: [] }, { allergens: ['milk'] }).status === 'ok');
const hamM = { nutriscore: 'd', nova: 4, analysis: ['en:non-vegetarian'], additiveTags: ['en:e250'], ingredients: 'mięso wieprzowe, sól, azotyn sodu' };
t('ham vegetarian fail', M(hamM, { diet: ['vegetarian'] }).status === 'fail');
t('ham nitrites fail', M(hamM, { avoid: ['nitrites'] }).fails[0].why === 'E250');
t('gelatin not vegetarian', M({ ingredients: 'cukier, syrop glukozowy, żelatyna wieprzowa', additiveTags: [] }, { diet: ['vegetarian'] }).status === 'fail');
const nutM = { nutriscore: 'e', nova: 4, analysis: ['en:palm-oil'], allergens: ['en:milk', 'en:nuts', 'en:soybeans'], ingredients: 'cukier, olej palmowy, orzechy laskowe 13%, mleko w proszku, emulgator: lecytyny (z soi)', additiveTags: ['en:e322'], nutriments: { sugars: 56.3 } };
const r1 = M(nutM, { avoid: ['palm', 'sugar', 'kidsugar', 'sweeteners'], allergens: ['soy'] });
t('nutella multi fail', r1.status === 'fail' && r1.fails.length === 4, r1);
t('sweeteners found', M({ additiveTags: ['en:e951', 'en:e955'], ingredients: 'woda, aspartam, sukraloza' }, { avoid: ['sweeteners'] }).fails[0].why === 'aspartam, sukraloza');
t('no data -> unknown', M({ additiveTags: undefined }, { allergens: ['milk'], avoid: ['palm'] }).status === 'unknown');
t('vegan unknown without data', M({ ingredients: 'woda, cukier', additiveTags: [] }, { diet: ['vegan'] }).status === 'unknown');
t('lactose-free label ok', M({ labels: ['en:lactose-free'], allergens: ['en:milk'], ingredients: 'mleko bez laktozy', additiveTags: [] }, { diet: ['lactose'] }).status === 'ok');
t('cosmetic fragrance fail', M({ kind: 'cosmetic', ingredients: 'Aqua, Parfum, Linalool' }, { cosmetic: ['fragrance'] }).status === 'fail');
t('cosmetic parabens', M({ kind: 'cosmetic', ingredients: 'Aqua, Methylparaben, Propylparaben' }, { cosmetic: ['parabens'] }).fails[0].why === 'methylparaben, propylparaben');
t('food profile ignored for cosmetics', M({ kind: 'cosmetic', ingredients: 'Aqua, Lac (mleko)' }, { allergens: ['milk'] }).status === 'none');
t('bad profile cleaned', JSON.stringify(A.cleanProfile({ allergens: ['milk', 'xyz', 'milk'], diet: 'vegan', noScores: 'yes' })) === JSON.stringify({ allergens: ['milk'], diet: [], avoid: [], cosmetic: [], custom: [], goals: [], noScores: false }));
t('null profile', A.cleanProfile(null).allergens.length === 0);

// Etap 4: porównanie w kategorii
const mk = (code, o) => A.normalizeProduct(Object.assign({ code, product_name: 'P' + code, additives_tags: [], ingredients_text: 'x, y, z' }, o), 'off');
const base = mk('1', { nutriscore_grade: 'e', nova_group: 4 }); const baseAn = A.analyze(base); // 30
const cands = [mk('2', { nutriscore_grade: 'a', nova_group: 1 }), mk('3', { nutriscore_grade: 'b', nova_group: 3 }), mk('4', { nutriscore_grade: 'e', nova_group: 4, additives_tags: ['en:e407'] }), mk('5', { nutriscore_grade: 'e', nova_group: 4, additives_tags: ['en:e250'] }), mk('6', { nutriscore_grade: 'c', nova_group: 4 }), mk('1', { nutriscore_grade: 'a' }), mk('7', {}), null, { code: '' }];
const cmp = A.compareInCategory(base, baseAn, cands, {});
t('cmp excludes self, nulls, unscored', cmp.sampleSize === 5, cmp.sampleSize);
t('cmp percentile', cmp.betterThan === 40, cmp.betterThan);
t('cmp alternatives sorted', cmp.alternatives.length === 3 && cmp.alternatives[0].pr.code === '2' && cmp.alternatives[0].gain === 70, cmp.alternatives.map(a => [a.pr.code, a.gain]));
const small = A.compareInCategory(base, baseAn, cands.slice(0, 3), {});
t('cmp too small sample', small.enough === false && small.betterThan === null);
const prof = { allergens: ['milk'] };
const withMilk = [mk('8', { nutriscore_grade: 'a', nova_group: 1, allergens_tags: ['en:milk'] }), ...cands];
const cmpP = A.compareInCategory(base, baseAn, withMilk, prof);
t('cmp profile filters alternatives', !cmpP.alternatives.some(a => a.pr.code === '8'), cmpP.alternatives.map(a => a.pr.code));
t('cmp empty candidates', A.compareInCategory(base, baseAn, [], {}).sampleSize === 0 && A.compareInCategory(base, baseAn, undefined, {}).alternatives.length === 0);
t('category label fallback', A.categoryLabel({ category: 'en:hazelnut-spreads' }) === 'hazelnut spreads' && A.categoryLabel({ categoryName: 'Kremy orzechowe', category: 'x' }) === 'Kremy orzechowe');

// Rozszerzony profil: własne składniki, nowe diety i pozycje „unikam”
const st = (o, prof) => M(o, prof).status;
const why0 = (o, prof) => (M(o, prof).fails[0] || {}).why;
// Własne składniki: odmiana, fałszywe trafienia, negacja
t('custom sol matches soli', st({ ingredients: 'woda, mniej soli, pieprz', additiveTags: [] }, { custom: ['sól'] }) === 'fail');
t('custom sol matches sol', st({ ingredients: 'mąka, sól, drożdże', additiveTags: [] }, { custom: ['sól'] }) === 'fail');
t('custom sol not fasola', st({ ingredients: 'fasola, woda, pomidory', additiveTags: [] }, { custom: ['sól'] }) === 'ok');
t('custom sol not rosol', st({ ingredients: 'rosół z kury, woda', additiveTags: [] }, { custom: ['sól'] }) === 'ok');
t('custom negation bez dodatku soli', st({ ingredients: 'pomidory 100%, bez dodatku soli', additiveTags: [] }, { custom: ['sól'] }) === 'ok');
t('custom negation nie zawiera', st({ ingredients: 'płatki owsiane. Nie zawiera cukru.', additiveTags: [] }, { custom: ['cukier'] }) === 'ok');
t('custom cukier matches cukru/syrop', st({ ingredients: 'woda, syrop glukozowy', additiveTags: [] }, { custom: ['cukier'] }) === 'fail');
t('custom czosnek matches czosnku', st({ ingredients: 'pomidory, ekstrakt z czosnku', additiveTags: [] }, { custom: ['czosnek'] }) === 'fail');
t('custom orzechy stem', st({ ingredients: 'cukier, orzechami laskowymi', additiveTags: [] }, { custom: ['orzechy'] }) === 'fail');
t('custom phrase', st({ ingredients: 'cukier, olej kokosowy, kakao', additiveTags: [] }, { custom: ['olej kokosowy'] }) === 'fail');
t('custom traces', st({ ingredients: 'cukier, kakao. Może zawierać sezam i orzechy', additiveTags: [] }, { custom: ['sezam'] }) === 'traces');
t('custom no ingredients unknown', st({ additiveTags: undefined }, { custom: ['sól'] }) === 'unknown');
t('custom label capitalized', M({ ingredients: 'sól', additiveTags: [] }, { custom: ['sól'] }).fails[0].label === 'Sól');
t('custom ignored for cosmetics', st({ kind: 'cosmetic', ingredients: 'Aqua, Sodium Chloride' }, { custom: ['sól'] }) === 'none');
// Walidacja własnych składników
t('custom empty', /Wpisz nazwę/.test(A.customProblem('  ', [])));
t('custom short', /3 litery/.test(A.customProblem('ab', [])));
t('custom long', /za długa/.test(A.customProblem('a'.repeat(31), [])));
t('custom comma', /pojedynczo/.test(A.customProblem('sól, cukier', [])));
t('custom digits/xss', /tylko liter/.test(A.customProblem('<script>', [])) && /tylko liter/.test(A.customProblem('E250', [])));
t('custom duplicate folded', /już na liście/.test(A.customProblem('SÓL', ['sól'])));
t('custom limit', /najwyżej 20/.test(A.customProblem('kakao', Array.from({ length: 20 }, (_, i) => 'x' + 'a'.repeat(i + 2)))));
t('custom ok', A.customProblem('olej kokosowy', []) === '');
t('clean profile custom', JSON.stringify(A.cleanProfile({ custom: ['Sól', 'sól', '<b>', 42, 'czosnek'] }).custom) === JSON.stringify(['sól', 'czosnek']));
// Nowe diety
t('glutenfree fail', st({ ingredients: 'mąka pszenna, woda', additiveTags: [] }, { diet: ['glutenfree'] }) === 'fail');
t('glutenfree label ok', st({ labels: ['en:gluten-free'], ingredients: 'mąka kukurydziana', additiveTags: [] }, { diet: ['glutenfree'] }) === 'ok');
t('glutenfree negation', st({ ingredients: 'mąka ryżowa, skrobia. Bez glutenu.', additiveTags: [] }, { diet: ['glutenfree'] }) === 'ok');
t('lowsodium fail', /dieta niskosodowa/.test(why0({ nutriments: { salt: 0.9 }, ingredients: 'x', additiveTags: [] }, { diet: ['lowsodium'] })));
t('lowsodium ok', st({ nutriments: { salt: 0.1 }, ingredients: 'x', additiveTags: [] }, { diet: ['lowsodium'] }) === 'ok');
t('lowsodium unknown', st({ ingredients: 'x', additiveTags: [] }, { diet: ['lowsodium'] }) === 'unknown');
t('lowcarb fail', st({ nutriments: { carbs: 60 }, ingredients: 'x', additiveTags: [] }, { diet: ['lowcarb'] }) === 'fail');
t('diabetes sugar', /dużo cukru/.test(why0({ nutriments: { sugars: 40 }, ingredients: 'x', additiveTags: [] }, { diet: ['diabetes'] })));
t('diabetes sweet drink', /słodzony napój/.test(why0({ drink: true, nutriments: { sugars: 8 }, ingredients: 'woda, cukier', additiveTags: [] }, { diet: ['diabetes'] })));
t('diabetes syrup', /syrop/.test(why0({ nutriments: { sugars: 3 }, ingredients: 'płatki, syrop glukozowo-fruktozowy', additiveTags: [] }, { diet: ['diabetes'] })));
t('diabetes ok', st({ nutriments: { sugars: 1 }, ingredients: 'płatki owsiane', additiveTags: [] }, { diet: ['diabetes'] }) === 'ok');
t('diabetes approx label', /orientacyjnie/.test(M({ nutriments: { sugars: 40 }, ingredients: 'x', additiveTags: [] }, { diet: ['diabetes'] }).fails[0].label));
const cardioWhy = why0({ nutriments: { salt: 2.4, sat: 6 }, ingredients: 'mięso wieprzowe, sól, azotyn sodu', additiveTags: ['en:e250'] }, { diet: ['cardio'] });
t('cardio ham reasons', /dużo soli/.test(cardioWhy) && /tłuszczów nasyconych/.test(cardioWhy) && /przetworzone mięso/.test(cardioWhy), cardioWhy);
t('cardio hydrogenated', /utwardzony/.test(why0({ nutriments: { salt: 0.1, sat: 1 }, ingredients: 'mąka, tłuszcz roślinny częściowo utwardzony', additiveTags: [] }, { diet: ['cardio'] })));
t('cardio ok yogurt', st(Object.assign({}, yogurt, { nutriments: { salt: 0.1, sat: 2, sugars: 4.5 } }), { diet: ['cardio'] }) === 'ok');
t('cardio unknown', st({ additiveTags: undefined }, { diet: ['cardio'] }) === 'unknown');
t('mediterranean nova4', /wysoko przetworzony/.test(why0({ nova: 4, ingredients: 'x', additiveTags: [] }, { diet: ['mediterranean'] })));
t('lightdiet beans', /ciężkostrawne/.test(why0({ ingredients: 'fasola biała, woda, sól', additiveTags: [] }, { diet: ['lightdiet'] })));
t('lightdiet herbatniki not tea', st({ ingredients: 'herbatniki maślane, mąka', additiveTags: [] }, { avoid: ['caffeine'] }) === 'ok');
// Nowe „unikam”
t('avoid salt high', st({ nutriments: { salt: 2 }, ingredients: 'x', additiveTags: [] }, { avoid: ['salt'] }) === 'fail');
t('avoid satfat', st({ nutriments: { sat: 10 }, ingredients: 'x', additiveTags: [] }, { avoid: ['satfat'] }) === 'fail');
t('avoid ultra', st({ nova: 4, ingredients: 'x', additiveTags: [] }, { avoid: ['ultra'] }) === 'fail');
t('avoid alcohol not winogrona', st({ ingredients: 'winogrona, ocet winny', additiveTags: [] }, { avoid: ['alcohol'] }) === 'ok');
t('avoid alcohol wino', st({ ingredients: 'wino czerwone 12%, cukier', additiveTags: [] }, { avoid: ['alcohol'] }) === 'fail');
t('avoid caffeine', st({ ingredients: 'woda, kofeina, tauryna', additiveTags: [] }, { avoid: ['caffeine'] }) === 'fail');
t('avoid caffeine not kawalki', st({ ingredients: 'kawałki czekolady, mąka', additiveTags: [] }, { avoid: ['caffeine'] }) === 'ok');
t('avoid pork', st({ ingredients: 'mięso wieprzowe, sól', additiveTags: [] }, { avoid: ['pork'] }) === 'fail');
t('avoid hydrogenated', st({ ingredients: 'tłuszcz roślinny częściowo utwardzony', additiveTags: [] }, { avoid: ['hydrogenated'] }) === 'fail');

// Cele i lista „Dobre dla Ciebie”
const G = (o, goals) => { const pr = prod(o); return A.goalInsights(pr, A.analyze(pr), goals); };
const gv = (o, goal) => G(o, [goal])[0];
t('goal weight bad kcal', gv({ nutriments: { kcal: 539, sugars: 56 } }, 'weight').verdict === 'bad');
t('goal weight good', gv({ nutriments: { kcal: 60, proteins: 11 } }, 'weight').verdict === 'good');
t('goal weight sweet drink', /napój/.test(gv({ drink: true, nutriments: { kcal: 42, sugars: 10 } }, 'weight').items.map(i => i.text).join()));
t('goal muscle skyr', gv({ nutriments: { kcal: 63, proteins: 11 } }, 'muscle').items.some(i => /70% energii/.test(i.text)));
t('goal muscle low protein info', gv({ nutriments: { proteins: 1 } }, 'muscle').verdict === 'neutral');
t('goal cholesterol oats', gv({ ingredients: 'płatki owsiane 100%', nutriments: { sat: 1.2, fiber: 10 } }, 'cholesterol').verdict === 'good');
t('goal cholesterol butter', gv({ ingredients: 'śmietanka', nutriments: { sat: 50 } }, 'cholesterol').verdict === 'bad');
t('goal pressure salty', /WHO/.test(gv({ nutriments: { salt: 2.4 } }, 'pressure').items[0].text));
t('goal digestion source', /Źródło błonnika/.test(gv({ nutriments: { fiber: 4 } }, 'digestion').items[0].text));
t('goal digestion wholegrain', gv({ ingredients: 'mąka żytnia razowa', nutriments: {} }, 'digestion').verdict === 'good');
t('goal iron grams->mg', /Źródło żelaza: 2,5 mg/.test(gv({ nutriments: { iron: 0.0025 } }, 'iron').items[0].text));
t('goal iron missing', /nie podaje/.test(gv({ nutriments: {} }, 'iron').items[0].text));
t('goal iron lentils', gv({ ingredients: 'soczewica czerwona 100%', nutriments: {} }, 'iron').verdict === 'good');
t('goal sugar syrup', gv({ ingredients: 'syrop glukozowy', nutriments: { sugars: 3 } }, 'sugar').verdict === 'bad');
t('goal unknown no data', gv({ nutriments: {} }, 'pressure').verdict === 'unknown');
t('goal cosmetic empty', G({ kind: 'cosmetic' }, ['weight']).length === 0);
t('goal invalid ignored', G({ nutriments: {} }, ['xyz', 'weight']).length === 1);
t('clean profile goals max 3', A.cleanProfile({ goals: ['weight', 'muscle', 'iron', 'sugar', 'bad'] }).goals.length === 3);
const shop = [
  mk('11', { product_name: 'Skyr naturalny', nutriscore_grade: 'a', nova_group: 1, nutriments: { proteins_100g: 11, 'energy-kcal_100g': 63, sugars_100g: 4 }, allergens_tags: ['en:milk'], ingredients_text: 'mleko odtłuszczone, kultury bakterii' }),
  mk('12', { product_name: 'Jogurt owocowy', nutriscore_grade: 'c', nova_group: 4, nutriments: { sugars_100g: 13, proteins_100g: 3 }, ingredients_text: 'mleko, cukier, truskawki' }),
  mk('13', { product_name: 'Jogurt kokosowy', nutriscore_grade: 'b', nova_group: 3, nutriments: { proteins_100g: 1, sugars_100g: 2 }, ingredients_text: 'mleczko kokosowe, skrobia' , ingredients_analysis_tags: ['en:vegan'] }),
  mk('14', { product_name: 'Deser czekoladowy', nutriscore_grade: 'e', nova_group: 4, ingredients_text: 'cukier, mleko' }),
  mk('15', { product_name: '', nutriscore_grade: 'a' }), null, mk('11', { product_name: 'duplikat', nutriscore_grade: 'a' })
];
const rAll = A.rankForUser(shop, {});
t('rank excludes low/unnamed/dupes', rAll.map(x => x.pr.code).join() === '11,13,12', rAll.map(x => [x.pr.code, x.an.score]));
const rMilk = A.rankForUser(shop, { allergens: ['milk'] });
t('rank profile excludes milk', !rMilk.some(x => ['11', '12'].includes(x.pr.code)), rMilk.map(x => x.pr.code));
const rMuscle = A.rankForUser(shop, { goals: ['muscle'] });
t('rank goal boosts protein', rMuscle[0].pr.code === '11');
t('rank empty', A.rankForUser([], {}).length === 0 && A.rankForUser(undefined, {}).length === 0);

console.log(`unit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
