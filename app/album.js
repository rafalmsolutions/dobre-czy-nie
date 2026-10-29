/* Dobre czy nie? – wersja D: „Album odkryć” z polowaniem.
   Każda strona albumu (kategoria) ma 10 miejsc z warunkami, np. „Gorzka”, „Bio”, „Nutri-Score C lub lepszy”.
   Rzadkość miejsca = jak trudno znaleźć pasujący produkt wśród popularnych produktów z tej kategorii,
   zgodnych z Twoim profilem (zwykłe ≥ 1 na 3, rzadkie do 1 na 12, epickie do 1 na 50, legendarne rzadziej).
   Kartę daje tylko produkt zgodny z profilem; trafia na najtrudniejsze wolne miejsce, do którego pasuje.
   Jedno miejsce na stronie jest tajne (warunek widać po odkryciu, podpowiedź po 5 skanach z kategorii).
   Lista miejsc powstaje przy pierwszej wizycie lub skanie i zostaje zapamiętana (klucz d-album). */
'use strict';
(() => {
  const A = App;
  const SLOTS = 10;
  const RARITY = {
    zwykla: { label: 'Zwykłe', card: 'Zwykła', event: 'card_common', h1: ['Zwykłe', 'miejsce'] },
    rzadka: { label: 'Rzadkie', card: 'Rzadka', event: 'card_rare', h1: ['Rzadkie', 'miejsce!'] },
    epicka: { label: 'Epickie', card: 'Epicka', event: 'card_epic', h1: ['Epickie', 'miejsce!'] },
    legendarna: { label: 'Legendarne', card: 'Legendarna', event: 'card_legend', h1: ['Legendarne', 'miejsce!'] }
  };
  A.RARITY = RARITY;
  A.ALBUM_SLOTS = SLOTS;
  const TIER_ORDER = ['zwykla', 'rzadka', 'epicka', 'legendarna'];
  const tierOf = share => share >= 1 / 3 ? 'zwykla' : share >= 1 / 12 ? 'rzadka' : share >= 1 / 50 ? 'epicka' : 'legendarna';
  A.huntTier = tierOf;
  const EXTRA_PAGES = { other: { key: 'other', label: 'Różne', img: '' }, cosmetics: { key: 'cosmetics', label: 'Kosmetyki', img: '' } };

  /* ---------- Warunki miejsc ---------- */
  const has = (arr, re) => (arr || []).some(t => re.test(t));
  const N = (p, k) => p.nutriments && p.nutriments[k] != null ? p.nutriments[k] : null;
  // h = grupa podpowiedzi do tajnego miejsca; w = pozycje „Pilnuję”, z którymi warunek idzie w parze (pierwszeństwo przy doborze).
  // Gdzie warunek ma sens: „only” = tylko te strony, „skip” = wszystkie poza tymi (np. „wegański” dla wody nic nie znaczy).
  const DRINKS_PLAIN = ['en:waters', 'en:teas', 'en:coffees'];
  const PLANT_BASIC = ['en:waters', 'en:teas', 'en:coffees', 'en:fruit-juices', 'en:sodas', 'en:beers', 'en:fresh-fruits', 'en:fresh-vegetables', 'en:legumes', 'en:nuts', 'en:rices', 'en:groats', 'en:vegetable-oils', 'en:dried-fruits', 'en:frozen-vegetables', 'en:canned-vegetables', 'en:pickles', 'en:jams', 'en:hummus', 'en:plant-based-milk-alternatives'];
  const ANIMAL = ['en:milks', 'en:yogurts', 'en:cheeses', 'en:quarks', 'en:butters', 'en:creams', 'en:dairy-desserts', 'en:eggs', 'en:fresh-meats', 'en:sausages', 'en:prepared-meats', 'en:fishes', 'en:canned-fishes'];
  const COND = [
    { id: 'ns-a', label: 'Nutri-Score A', h: 'wartość odżywcza', w: ['sugar', 'salt', 'satfat', 'kcal'], skip: DRINKS_PLAIN, test: p => p.nutriscore === 'a' },
    { id: 'ns-ab', label: 'Nutri-Score A lub B', h: 'wartość odżywcza', w: ['sugar', 'salt', 'satfat', 'kcal'], skip: DRINKS_PLAIN, test: p => ['a', 'b'].includes(p.nutriscore) },
    { id: 'ns-c', label: 'Nutri-Score C lub lepszy', h: 'wartość odżywcza', w: ['sugar', 'salt', 'satfat'], skip: DRINKS_PLAIN, test: p => ['a', 'b', 'c'].includes(p.nutriscore) },
    { id: 'nova12', label: 'Mało przetworzony (NOVA 1–2)', h: 'przetworzenie', w: ['processing'], skip: DRINKS_PLAIN, test: p => p.nova && p.nova <= 2 },
    { id: 'nova3', label: 'Nie ultraprzetworzony (NOVA 1–3)', h: 'przetworzenie', w: ['processing'], skip: DRINKS_PLAIN, test: p => p.nova && p.nova <= 3 },
    { id: 'noadd', label: 'Bez dodatków E', h: 'skład', w: ['processing'], skip: DRINKS_PLAIN, test: p => Array.isArray(p.additiveTags) && p.additiveTags.length === 0 },
    { id: 'nopalm', label: 'Bez oleju palmowego', h: 'skład', w: ['palm', 'satfat'], only: ['en:chocolates', 'en:biscuits', 'en:crisps', 'en:salty-snacks', 'en:sweet-spreads', 'en:ice-creams', 'en:candies', 'en:breakfast-cereals', 'en:mueslis', 'en:breads', 'en:meals', 'en:pizzas', 'en:soups', 'en:sauces', 'en:dairy-desserts', 'en:pierogi', 'en:butters'], test: p => p.analysis.includes('en:palm-oil-free') },
    { id: 'vegan', label: 'Wegański', h: 'skład', w: [], skip: PLANT_BASIC.concat(ANIMAL), test: p => p.analysis.includes('en:vegan') },
    { id: 'bio', label: 'Bio (ekologiczny)', h: 'znak na opakowaniu', w: [], test: p => has(p.labels, /organic|^en:bio$|eu-organic/) },
    { id: 'fair', label: 'Fair trade', h: 'znak na opakowaniu', w: [], only: ['en:chocolates', 'en:coffees', 'en:teas', 'en:fresh-fruits', 'en:sweet-spreads'], test: p => has(p.labels, /fair-trade|fairtrade|rainforest/) },
    { id: 'nosugar', label: 'Bez dodanego cukru', h: 'znak na opakowaniu', w: ['sugar'], only: ['en:yogurts', 'en:breakfast-cereals', 'en:mueslis', 'en:jams', 'en:sweet-spreads', 'en:dairy-desserts', 'en:plant-based-milk-alternatives', 'en:fruit-juices', 'en:sodas', 'en:chocolates', 'en:ketchup', 'en:sauces', 'en:biscuits', 'en:ice-creams', 'en:quarks', 'en:dried-fruits'], test: p => has(p.labels, /no-added-sugar/) },
    { id: 'glutenfree', label: 'Oznaczony „bez glutenu”', h: 'znak na opakowaniu', w: [], only: ['en:breads', 'en:breakfast-cereals', 'en:mueslis', 'en:pastas', 'en:biscuits', 'en:beers', 'en:meals', 'en:pizzas', 'en:soups', 'en:salty-snacks', 'en:crisps', 'en:candies', 'en:chocolates', 'en:ice-creams', 'en:sauces', 'en:pierogi', 'en:groats', 'en:prepared-meats', 'en:sausages'], test: p => has(p.labels, /no-gluten|gluten-free/) },
    { id: 'lactosefree', label: 'Bez laktozy', h: 'znak na opakowaniu', w: [], only: ['en:milks', 'en:yogurts', 'en:cheeses', 'en:quarks', 'en:dairy-desserts', 'en:creams', 'en:butters', 'en:ice-creams'], test: p => has(p.labels, /no-lactose|lactose-free/) || has(p.categories, /lactose-free/) },
    { id: 'lowsugar', label: 'Mało cukru', h: 'wartość odżywcza', w: ['sugar', 'kcal'], skip: DRINKS_PLAIN.concat(['en:vegetable-oils', 'en:eggs', 'en:fresh-meats']), test: p => N(p, 'sugars') != null && N(p, 'sugars') <= (p.drink ? 2.5 : 5) },
    { id: 'lowsalt', label: 'Mało soli', h: 'wartość odżywcza', w: ['salt'], skip: ['en:teas', 'en:coffees', 'en:vegetable-oils', 'en:fruit-juices', 'en:sodas'], test: p => N(p, 'salt') != null && N(p, 'salt') <= 0.3 },
    { id: 'lowfat', label: 'Mało tłuszczu', h: 'wartość odżywcza', w: ['kcal', 'satfat'], skip: DRINKS_PLAIN.concat(['en:fruit-juices', 'en:sodas', 'en:vegetable-oils']), test: p => N(p, 'fat') != null && N(p, 'fat') <= (p.drink ? 1.5 : 3) },
    { id: 'lowsat', label: 'Mało tłuszczów nasyconych', h: 'wartość odżywcza', w: ['satfat'], skip: DRINKS_PLAIN.concat(['en:fruit-juices', 'en:sodas']), test: p => N(p, 'sat') != null && N(p, 'sat') <= (p.drink ? 0.75 : 1.5) },
    { id: 'protein', label: 'Dużo białka (min. 10 g)', h: 'wartość odżywcza', w: ['protein'], skip: DRINKS_PLAIN.concat(['en:fruit-juices', 'en:sodas', 'en:vegetable-oils', 'en:beers']), test: p => N(p, 'proteins') != null && N(p, 'proteins') >= 10 },
    { id: 'fiber', label: 'Dużo błonnika (min. 6 g)', h: 'wartość odżywcza', w: ['fiber'], skip: DRINKS_PLAIN.concat(['en:fruit-juices', 'en:sodas', 'en:vegetable-oils', 'en:beers', 'en:milks']), test: p => N(p, 'fiber') != null && N(p, 'fiber') >= 6 }
  ];
  const condFits = (c, key) => (!c.only || c.only.includes(key)) && !(c.skip && c.skip.includes(key));
  const COND_BY_ID = Object.fromEntries(COND.map(c => [c.id, c]));
  // Podkategorie z bazy z polską nazwą: dają stronom różnorodność („Gorzka”, „Skyr”, „Żytni”).
  const SUB = {
    'en:yogurts': { 'en:plain-yogurts': 'Naturalny', 'en:fruit-yogurts': 'Owocowy', 'en:drinkable-yogurts': 'Pitny', 'en:skyrs': 'Skyr', 'en:greek-style-yogurts': 'Typu greckiego' },
    'en:breakfast-cereals': { 'en:mueslis': 'Musli', 'en:flakes': 'Płatki', 'en:cereals-with-fruits': 'Z owocami', 'en:chocolate-cereals': 'Czekoladowe', 'en:porridge': 'Owsianka' },
    'en:cheeses': { 'en:fresh-cheeses': 'Świeży', 'en:cream-cheeses': 'Kremowy', 'en:goat-cheeses': 'Kozi', 'en:mozzarella': 'Mozzarella', 'en:feta': 'Feta' },
    'en:chocolates': { 'en:milk-chocolates': 'Mleczna', 'en:dark-chocolates': 'Gorzka', 'en:extra-fine-dark-chocolates': 'Gorzka extra', 'en:white-chocolates': 'Biała', 'en:chocolates-with-hazelnuts': 'Z orzechami laskowymi', 'en:filled-chocolates': 'Nadziewana' },
    'en:milks': { 'en:lactose-free-milk': 'Bez laktozy', 'en:whole-milks': 'Pełnotłuste', 'en:semi-skimmed-milks': 'Półtłuste', 'en:skimmed-milks': 'Odtłuszczone' },
    'en:sausages': { 'pl:kabanosy': 'Kabanosy', 'en:poultry-sausages': 'Drobiowe' },
    'en:jams': { 'en:strawberry-jams': 'Truskawkowy', 'en:berry-jams': 'Z owoców jagodowych', 'en:plum-jams': 'Śliwkowy' },
    'en:crisps': { 'en:potato-crisps': 'Ziemniaczane', 'en:corn-chips': 'Kukurydziane' },
    'en:sweet-spreads': { 'en:chocolate-spreads': 'Czekoladowy', 'en:honeys': 'Miód' },
    'en:canned-vegetables': { 'en:pickled-cucumbers': 'Ogórki', 'en:canned-tomatoes': 'Pomidory', 'en:canned-corn': 'Kukurydza' },
    'en:fruit-juices': { 'en:orange-juices': 'Pomarańczowy', 'en:apple-juices': 'Jabłkowy', 'en:multifruit-juices': 'Wieloowocowy', 'en:squeezed-juices': 'Wyciskany' },
    'en:salty-snacks': { 'en:crackers': 'Krakersy', 'en:nuts': 'Orzechy', 'en:popcorn': 'Popcorn' },
    'en:fresh-fruits': { 'en:blueberries': 'Borówki', 'en:raspberries': 'Maliny', 'en:fresh-apples': 'Jabłka', 'en:kiwis': 'Kiwi', 'en:bananas': 'Banany' },
    'en:fresh-vegetables': { 'en:spinachs': 'Szpinak', 'en:tomatoes': 'Pomidory', 'en:broccoli': 'Brokuł' },
    'en:ice-creams': { 'en:ice-cream-tubs': 'W pudełku', 'en:ice-cream-bars': 'Na patyku', 'en:sorbets': 'Sorbet' },
    'en:breads': { 'en:rye-breads': 'Żytni', 'en:wholemeal-breads': 'Pełnoziarnisty', 'en:toasts': 'Tostowy', 'en:wheat-breads': 'Pszenny', 'en:flatbreads': 'Placki i tortille' },
    'en:sodas': { 'en:colas': 'Cola', 'en:diet-sodas': 'Bez cukru', 'en:lemonade': 'Lemoniada' },
    'en:pierogi': { 'pl:pierogi-ruskie': 'Ruskie' },
    'en:dried-fruits': { 'en:raisins': 'Rodzynki', 'en:dates': 'Daktyle', 'en:dried-apricots': 'Morele', 'en:prunes': 'Śliwki' },
    'en:groats': { 'en:buckwheat': 'Gryczana', 'en:bulgur': 'Bulgur', 'en:millet': 'Jaglana', 'en:pearl-barley': 'Pęczak' },
    'en:coffees': { 'en:instant-coffees': 'Rozpuszczalna', 'en:coffee-capsules': 'Kapsułki', 'en:coffee-beans': 'Ziarnista', 'en:ground-coffees': 'Mielona' },
    'en:pickles': { 'en:olives': 'Oliwki', 'en:pickled-cucumbers': 'Ogórki' },
    'en:canned-fishes': { 'en:tunas': 'Tuńczyk', 'en:herring': 'Śledź', 'en:mackerels': 'Makrela', 'en:sardines': 'Sardynki', 'en:canned-fish-in-tomato-sauce': 'W pomidorach' },
    'en:dairy-desserts': { 'pl:serek-homogenizowany': 'Serek homogenizowany', 'en:puddings': 'Budyń' },
    'en:waters': { 'en:mineral-waters': 'Mineralna', 'en:carbonated-waters': 'Gazowana', 'en:flavored-waters': 'Smakowa' },
    'en:eggs': { 'en:free-range-chicken-eggs': 'Z wolnego wybiegu', 'en:organic-eggs': 'Ekologiczne' },
    'en:mueslis': { 'en:mueslis-with-fruits': 'Z owocami', 'en:porridge': 'Owsianka', 'en:granola': 'Granola' },
    'en:fishes': { 'en:salmons': 'Łosoś', 'en:fish-fillets': 'Filety', 'en:tunas': 'Tuńczyk', 'en:herring': 'Śledź' },
    'en:candies': { 'en:gummi-candies': 'Żelki', 'en:lollipops': 'Lizaki' },
    'en:soups': { 'en:vegetable-soups': 'Warzywna', 'en:tomato-soups': 'Pomidorowa' },
    'en:meals': { 'en:pasta-dishes': 'Z makaronem', 'en:soups': 'Zupa', 'en:salads': 'Sałatka' },
    'en:creams': { 'en:whipped-creams': 'Do ubijania', 'en:uht-creams': 'UHT' },
    'en:rices': { 'en:basmati-rices': 'Basmati', 'en:parboiled-rices': 'Parboiled', 'en:brown-rices': 'Brązowy', 'en:jasmine-rices': 'Jaśminowy' },
    'en:quarks': { 'en:lean-quark': 'Chudy' },
    'en:pizzas': { 'en:vegetarian-pizzas': 'Wegetariańska', 'en:margherita-pizza': 'Margherita' },
    'en:plant-based-milk-alternatives': { 'en:oat-based-drinks': 'Owsiany', 'en:soy-based-drinks': 'Sojowy', 'en:almond-based-drinks': 'Migdałowy', 'en:rice-based-drinks': 'Ryżowy' },
    'en:prepared-meats': { 'en:hams': 'Szynka', 'en:pate': 'Pasztet' },
    'en:legumes': { 'en:lentils': 'Soczewica', 'en:chickpeas': 'Ciecierzyca', 'en:beans': 'Fasola' },
    'en:nuts': { 'en:almonds': 'Migdały', 'en:peanuts': 'Orzeszki ziemne', 'en:walnuts': 'Włoskie', 'en:cashew-nuts': 'Nerkowce' },
    'en:sauces': { 'en:mustards': 'Musztarda', 'en:mayonnaises': 'Majonez', 'en:tomato-sauces': 'Pomidorowy', 'en:pestos': 'Pesto' },
    'en:frozen-vegetables': { 'en:spinachs': 'Szpinak', 'en:mixed-vegetables': 'Mieszanka', 'en:broccoli': 'Brokuł' },
    'en:vegetable-oils': { 'en:olive-oils': 'Oliwa', 'en:extra-virgin-olive-oils': 'Oliwa extra virgin', 'en:rapeseed-oils': 'Rzepakowy', 'en:linseed-oils': 'Lniany' },
    'en:biscuits': { 'en:wafers': 'Wafle', 'en:dry-biscuits': 'Herbatniki', 'en:shortbread-cookies': 'Kruche' },
    'en:teas': { 'en:green-teas': 'Zielona', 'en:black-teas': 'Czarna', 'en:herbal-teas': 'Ziołowa', 'en:fruit-teas': 'Owocowa' },
    'en:beers': { 'en:non-alcoholic-beers': 'Bezalkoholowe', 'en:wheat-beers': 'Pszeniczne' },
    'en:pastas': { 'en:durum-wheat-pasta': 'Z pszenicy durum', 'en:wholemeal-pastas': 'Pełnoziarnisty', 'en:egg-pastas': 'Jajeczny' }
  };
  // Strony, których nie pokazujemy przy „Nie jem”: wszystko w nich zawiera wykluczony składnik.
  const DAIRY = ['en:yogurts', 'en:cheeses', 'en:milks', 'en:butters', 'en:dairy-desserts', 'en:quarks', 'en:creams'];
  const MEAT = ['en:sausages', 'en:prepared-meats', 'en:fresh-meats'], FISH = ['en:fishes', 'en:canned-fishes'];
  // Alkohol (także piwo bezalkoholowe, żeby nie zachęcać do kolekcji piw): bez kart i bez strony w albumie.
  const ALC_RE = /^en:(alcoholic-beverages|beers|wines|spirits|ciders|liqueurs|beer-based-beverages)$/;
  A.isAlcoholProd = prod => (prod.categories || []).some(c => ALC_RE.test(c));
  A.pageHidden = key => {
    const p = A.profile || {}, d = p.diet || [], al = p.allergens || [], av = p.avoid || [];
    if (d.includes('vegan') && [...DAIRY, ...MEAT, ...FISH, 'en:eggs'].includes(key)) return true;
    if (d.includes('vegetarian') && [...MEAT, ...FISH].includes(key)) return true;
    if (key === 'en:beers') return true; // 3.0.10: bez kart za alkohol (aplikacja o zdrowym jedzeniu nie nagradza zbierania piw)
    if (al.includes('milk') && DAIRY.includes(key)) return true;
    if (al.includes('eggs') && key === 'en:eggs') return true;
    if (al.includes('fish') && FISH.includes(key)) return true;
    if ((al.includes('nuts') || al.includes('peanuts')) && key === 'en:nuts') return true;
    return false;
  };

  /* Zgodność z profilem („Ja”): nie zawiera niczego z „Nie jem” i nie ma „dużo” tego, czego pilnujesz. */
  A.huntCompatible = (prod, an) => {
    if (!prod || prod.kind === 'cosmetic') return { ok: true };
    const pm = personalMatch(prod, an || analyze(prod), A.profile);
    if (pm.status === 'fail') return { ok: false, why: 'zawiera coś, czego nie jesz' };
    const bad = (pm.watch || []).find(w => (w.kind === 'limit' && w.level === 'high') || (w.kind === 'contains' && w.level === 'yes'));
    if (bad) return { ok: false, why: `${bad.label.toLowerCase()}: ${bad.word}` };
    return { ok: true };
  };
  const brandKey = b => String(b || '').split(',')[0].trim().toLowerCase();
  const profSig = () => { const p = A.profile || {}; return JSON.stringify([p.diet, p.allergens, p.avoid, p.custom, p.watch]); };

  A.slotTest = (slot, prod) => {
    if (!slot || !prod) return false;
    if (slot.id.startsWith('any')) return true; // dawne miejsca „dowolny produkt” (tylko już zajęte)
    if (slot.id.startsWith('b:')) { // „Nowa marka”: marka, której jeszcze nie ma na tej stronie
      const br = brandKey(prod.brand), key = A.pageKeyOf(prod);
      return !!br && !Object.values(A.album.cards).some(c => c.k === key && !c.legacy && brandKey(c.b) === br);
    }
    if (slot.id.startsWith('s:')) return (prod.categories || []).includes(slot.id.slice(2));
    const c = COND_BY_ID[slot.id.slice(2)];
    return !!(c && c.test(prod));
  };

  /* Dobór 10 miejsc dla strony z popularnych produktów kategorii (zgodnych z profilem). */
  function buildSlots(key, list, keep) {
    const watch = (A.profile && A.profile.watch) || [];
    const all = list.filter(p => p && p.code && p.name && p.kind !== 'cosmetic');
    const comp = all.filter(p => A.huntCompatible(p).ok);
    const base = comp.length >= 6 ? comp : all, n = base.length;
    const cands = [];
    Object.entries(SUB[key] || {}).forEach(([tag, label]) => cands.push({ id: 's:' + tag, label, h: 'rodzaj produktu', pri: 2 }));
    COND.filter(c => condFits(c, key)).forEach(c => cands.push({ id: 'c:' + c.id, label: c.label, h: c.h, pri: c.w.some(x => watch.includes(x)) ? 0 : 1 }));
    const used = new Set((keep || []).map(s => s.id)), scored = [];
    cands.forEach(c => {
      if (used.has(c.id) || !n) return;
      const hits = base.filter(p => A.slotTest(c, p)).length, share = hits / n;
      if (hits < (share < 1 / 50 ? 1 : 2) || share > 0.6) return;
      scored.push(Object.assign(c, { share, hits, n, tier: tierOf(share) }));
    });
    // Podobne warunki nie obok siebie (np. „Nutri-Score A” i „A lub B” – zostaje trudniejszy z pary, jeśli oba w tym samym stopniu).
    const twins = [['c:ns-a', 'c:ns-ab', 'c:ns-c'], ['c:nova12', 'c:nova3']];
    const pickFrom = (tier, k, out) => {
      const sorted = scored.filter(c => c.tier === tier && !out.some(o => o.id === c.id)).sort((a, b) => a.pri - b.pri || a.share - b.share);
      // Na zmianę: warunek zdrowotny i rodzaj produktu, żeby strona była zdrowa, ale różnorodna.
      const conds = sorted.filter(c => !c.id.startsWith('s:')), subs = sorted.filter(c => c.id.startsWith('s:')), pool = [];
      while (conds.length || subs.length) { if (conds.length) pool.push(conds.shift()); if (subs.length) pool.push(subs.shift()); }
      for (const c of pool) {
        if (out.length >= SLOTS || k <= 0) break;
        const tw = twins.find(t => t.includes(c.id));
        if (tw && out.some(o => tw.includes(o.id))) continue; // z pary podobnych warunków tylko jeden na stronę
        if (c.id.startsWith('s:') && out.filter(o => o.id.startsWith('s:')).length >= 3) continue; // najwyżej 3 rodzaje produktu
        out.push(c); k--;
      }
    };
    const out = (keep || []).slice();
    // Bez darmowego „dowolnego produktu”: każde miejsce coś wymaga. Najwięcej miejsc rzadkich i epickich.
    const want = { zwykla: 1, rzadka: 4, epicka: 3, legendarna: 2 };
    out.forEach(s => { if (want[s.tier]) want[s.tier]--; });
    ['legendarna', 'epicka', 'rzadka', 'zwykla'].forEach(t => pickFrom(t, Math.max(0, want[t]), out));
    ['rzadka', 'epicka', 'zwykla', 'legendarna'].forEach(t => pickFrom(t, SLOTS - out.length, out));
    // Słabe strony (mało danych w bazie): brakujące miejsca to „Nowa marka” – inna marka niż te, które już są na stronie.
    let extra = 1;
    while (out.length < SLOTS) {
      out.push({ id: 'b:' + extra, label: 'Nowa marka', h: 'marka, której nie masz jeszcze na tej stronie', share: Math.min(0.6, 0.15 * extra), hits: n, n, tier: 'rzadka' }); extra++;
    }
    // Tajne miejsce: rzadkie albo epickie (nigdy legendarne), najlepiej rodzaj produktu albo znak na opakowaniu.
    if (!out.some(s => s.secret)) {
      const sec = out.filter(s => (s.tier === 'rzadka' || s.tier === 'epicka') && !s.id.startsWith('any') && !s.id.startsWith('b:')).sort((a, b) => (a.id.startsWith('s:') ? 0 : 1) - (b.id.startsWith('s:') ? 0 : 1))[0];
      if (sec) sec.secret = true;
    }
    const rank = s => TIER_ORDER.indexOf(s.tier) * 10 + (s.secret ? 5 : 0) + (s.id.startsWith('any') ? -1 : 0);
    return out.slice(0, SLOTS).sort((a, b) => rank(a) - rank(b) || b.share - a.share)
      .map(s => ({ id: s.id, label: s.label, h: s.h || '', share: Math.round(s.share * 1000) / 1000, hits: s.hits, n: s.n, tier: s.tier, secret: !!s.secret }));
  }
  A.buildSlots = buildSlots; // do testów

  /* ---------- Stan albumu ---------- */
  function load() {
    const a = A.store.get('d-album', null);
    const o = v => v && typeof v === 'object' ? v : {};
    if (!a || typeof a !== 'object') return { cards: {}, done: {}, weeks: {}, pages: {}, seen: {}, extra: {} };
    return { cards: o(a.cards), done: o(a.done), weeks: o(a.weeks), pages: o(a.pages), seen: o(a.seen), extra: o(a.extra) };
  }
  A.album = load();
  const save = () => A.store.set('d-album', A.album);
  A.albumSave = save;
  // Wersja 3: polowanie. Stare karty (bez miejsca) trafiają na miejsca przy pierwszym otwarciu strony.
  if (A.store.get('d-album-v', 1) < 3) {
    Object.values(A.album.cards).forEach(c => { if (!c.slot) c.legacy = true; });
    save(); A.store.set('d-album-v', 3);
  }

  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  A.cardHolo = code => hash(A.appUuid() + '|' + code) % 20 === 0;
  // Szkic: w bazie brakuje składu albo wartości odżywczych (tak samo jak przycisk „Uzupełnij”).
  A.cardSketch = (prod, snapshot) => prod.kind !== 'cosmetic' && ((!prod.ingredients && !(snapshot && prod.additiveTags != null)) || !Object.values(prod.nutriments || {}).some(v => v != null));
  A.pageKeyOf = prod => prod.kind === 'cosmetic' ? 'cosmetics' : (A.prodCatKey(prod) || 'other');
  A.isHuntPage = key => SHOP_CATEGORIES.some(c => c.key === key);
  A.albumPages = () => SHOP_CATEGORIES.filter(c => !A.pageHidden(c.key)).map(c => ({ key: c.key, label: c.label, img: A.catImg(c.key) }));
  A.pageInfo = key => { const c = SHOP_CATEGORIES.find(x => x.key === key); return c ? { key, label: c.label, img: A.catImg(key) } : EXTRA_PAGES[key] || null; };
  A.cardsOf = key => Object.values(A.album.cards).filter(c => c.k === key && !c.legacy).sort((a, b) => a.t - b.t);
  A.slotsOf = key => (A.album.pages[key] && A.album.pages[key].slots) || null;
  A.slotCard = (key, slotId) => Object.values(A.album.cards).find(c => c.k === key && c.slot === slotId) || null;
  A.filledCount = key => { const s = A.slotsOf(key); return s ? s.filter(x => A.slotCard(key, x.id)).length : 0; };

  /* Lista miejsc strony: zapamiętana albo dobrana teraz z kopii bazy. Po zmianie profilu wolne miejsca dobieramy od nowa. */
  const building = {};
  A.ensurePage = async key => {
    if (!A.isHuntPage(key)) return null;
    const pg = A.album.pages[key];
    if (pg && pg.sig === profSig() && pg.v === 2 && !Object.values(A.album.cards).some(c => c.k === key && c.legacy)) return pg;
    if (building[key]) return building[key];
    building[key] = (async () => {
      let list = [];
      try { list = catListFilter(key, await A.fetchCategory(key)); } catch (e) { list = []; }
      const cur = A.album.pages[key];
      if (!list.length) return cur || null; // bez danych nie zamrażamy strony – spróbujemy przy następnej wizycie
      const keep = cur ? cur.slots.filter(s => A.slotCard(key, s.id)) : [];
      // v2 (21.10.2026): bez wolnych miejsc „dowolny produkt”; zajęte miejsca zostają.
      if (!cur || cur.sig !== profSig() || cur.v !== 2) A.album.pages[key] = { slots: buildSlots(key, list, keep), sig: profSig(), at: Date.now(), v: 2 };
      await migrateLegacy(key, list);
      save();
      return A.album.pages[key];
    })().finally(() => { delete building[key]; });
    return building[key];
  };
  async function migrateLegacy(key, list) {
    const old = Object.values(A.album.cards).filter(c => c.k === key && c.legacy).sort((a, b) => a.t - b.t);
    for (const c of old) {
      let p = list.find(x => x.code === c.c);
      if (!p) { try { p = await A.snapshotProduct(c.c); } catch (e) { p = null; } }
      const slot = p && A.huntCompatible(p).ok ? freeSlotFor(key, p) : null;
      if (slot) Object.assign(c, { slot: slot.id, r: slot.tier, legacy: false });
      else delete A.album.cards[c.c];
    }
  }
  function freeSlotFor(key, prod) {
    const slots = A.slotsOf(key) || [];
    return slots.filter(s => !A.slotCard(key, s.id) && A.slotTest(s, prod)).sort((a, b) => a.share - b.share)[0] || null;
  }
  A.missingSlots = key => (A.slotsOf(key) || []).filter(s => !A.slotCard(key, s.id));

  /* Karta polowania tygodnia: jedna kategoria na tydzień, ta sama dla wszystkich. */
  A.weekCard = (now = new Date()) => {
    const wk = Game.weekKey(now), [y, w] = wk.split('-W').map(Number);
    const pool = SHOP_CATEGORIES.filter(c => !A.pageHidden(c.key));
    const c = pool[(y * 53 + w) % pool.length];
    const day = (now.getDay() + 6) % 7;
    return { week: wk, key: c.key, label: c.label, img: A.catImg(c.key), daysLeft: 7 - day, done: !!A.album.weeks[wk] };
  };

  /* Po skanie. Zwraca:
     { card, isNew, slot, pageFull } – nowe miejsce; { card, revived } – znana karta;
     { noSlot, key, missing } – pasuje do strony, ale nie zajmuje nowego miejsca; { incompatible, why } – niezgodny z profilem. */
  A.albumAdd = async (prod, opts = {}) => {
    if (!prod || !prod.code || !prod.name) return null;
    const st = A.album, sketch = A.cardSketch(prod, !!opts.snapshot), old = st.cards[prod.code];
    if (old && !old.legacy) {
      let revived = false;
      if (old.s && !sketch) { old.s = false; revived = true; }
      if (!old.i && A.safeImg(prod.image)) old.i = A.safeImg(prod.image);
      if (revived || opts.touch) save();
      return { card: old, isNew: false, revived };
    }
    if (opts.touch) return null;
    if (A.isAlcoholProd(prod)) return null; // piwo, wino, mocne alkohole: można sprawdzić skład, ale bez karty
    const key = A.pageKeyOf(prod), wk = A.weekCard();
    const base = { c: prod.code, k: key, h: A.cardHolo(prod.code), s: sketch, n: String(prod.name).slice(0, 80), b: String(prod.brand || '').slice(0, 40), i: A.safeImg(prod.image) || '', sc: prod.scans, t: Date.now() };
    if (!A.isHuntPage(key)) {
      // Kosmetyki i „Różne”: zwykła kolekcja bez miejsc.
      const card = Object.assign(base, { r: 'zwykla', slot: null, w: false });
      st.cards[prod.code] = card; save();
      return { card, isNew: true, quiet: true };
    }
    const comp = A.huntCompatible(prod);
    if (!comp.ok) return { incompatible: true, why: comp.why, key };
    st.seen[key] = (st.seen[key] || 0) + 1;
    await A.ensurePage(key);
    if (!A.slotsOf(key)) { save(); return { pending: true, key }; } // brak danych kategorii (np. offline) – bez karty, bez komunikatu
    const slot = freeSlotFor(key, prod);
    if (!slot) { save(); return { noSlot: true, key, missing: A.missingSlots(key) }; }
    const card = Object.assign(base, { r: slot.tier, slot: slot.id, w: key === wk.key && !wk.done });
    st.cards[prod.code] = card;
    if (card.w) st.weeks[wk.week] = prod.code;
    const pageFull = !st.done[key] && A.filledCount(key) >= SLOTS;
    if (pageFull) st.done[key] = Date.now();
    save();
    return { card, isNew: true, slot, pageFull: pageFull ? key : null };
  };
  /* Punkty za kartę (przy odsłonięciu). */
  A.albumReward = res => {
    if (!res || !res.isNew || res.quiet) return;
    const c = res.card;
    A.award(RARITY[c.r].event, { code: c.c });
    if (c.h) A.award('card_holo', { code: c.c });
    if (c.w) A.award('card_weekly', { code: c.c });
    if (res.pageFull) A.award('album_page', { code: 'page:' + res.pageFull });
  };
  /* Liczniki do odznak (A.extraMetrics). */
  A.albumMetrics = () => {
    const cards = Object.values(A.album.cards).filter(c => !c.legacy);
    return {
      album_cards: cards.length, album_pages: Object.keys(A.album.done).length,
      epic_cards: cards.filter(c => c.r === 'epicka').length, legend_cards: cards.filter(c => c.r === 'legendarna').length,
      holo_cards: cards.filter(c => c.h).length
    };
  };
  A.albumStats = () => {
    const cards = Object.values(A.album.cards).filter(c => !c.legacy);
    return { cards: cards.length, pages: Object.keys(A.album.done).length, legend: cards.filter(c => c.r === 'legendarna').length, holo: cards.filter(c => c.h).length,
      started: new Set(cards.filter(c => A.isHuntPage(c.k)).map(c => c.k)).size };
  };
  // „1 na N” zaokrąglamy w górę, żeby liczba zgadzała się ze stopniem (rzadkie zawsze od „1 na 4”).
  A.oneIn = share => Math.max(1, Math.ceil(1 / Math.max(share, 0.001) - 0.05));
  A.oddsText = s => s.id.startsWith('any') ? 'pasuje każdy' : s.id.startsWith('b:') ? 'inna marka niż na tej stronie' : `pasuje 1 na ${A.oneIn(s.share)}`;
})();
