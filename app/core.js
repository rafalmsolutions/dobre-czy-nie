/* Dobre czy nie? – czysta logika oceny (bez interfejsu). Wymaga data.js. */
'use strict';

const OFF = 'https://world.openfoodfacts.org';
const OBF = 'https://world.openbeautyfacts.org';
const FIELDS = 'code,traces_tags,ingredients_analysis_tags,labels_tags,categories,product_name,product_name_pl,generic_name,generic_name_pl,brands,quantity,image_front_small_url,image_front_url,image_url,image_ingredients_url,image_nutrition_url,nutriscore_grade,nova_group,additives_tags,allergens_tags,ingredients_text,ingredients_text_pl,nutriments,categories_tags,categories_hierarchy,unique_scans_n';
const ZXING_URLS = ['https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js', 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js', 'https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js'];
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

/* ================= Analiza (czyste funkcje) ================= */

const LEVELS = [
  { key: 'ok', label: 'Bez zastrzeżeń', cls: 'lv-great' },
  { key: 'low', label: 'Niewielkie zastrzeżenia', cls: 'lv-good' },
  { key: 'mid', label: 'Umiarkowane zastrzeżenia', cls: 'lv-fair' },
  { key: 'high', label: 'Duże zastrzeżenia', cls: 'lv-poor' }
];

const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

function additiveKeyFromTag(tag) {
  const t = String(tag).replace(/^[a-z]{2}:/i, '').toUpperCase();
  const m = t.match(/^E(\d{3,4})([A-Z]?)/);
  if (!m) return null;
  const full = 'E' + m[1] + m[2], base = 'E' + m[1];
  if (ADDITIVES[full]) return full;
  if (ADDITIVES[base]) return base;
  return full;
}

function additiveInfo(key) {
  const a = ADDITIVES[key];
  if (!a) return { code: key, name: 'Dodatek spoza naszej bazy', level: null, note: 'Nie mamy jeszcze opisu tego dodatku. Nie wpływa na ocenę.' };
  return { code: key, name: a[0], level: a[1], note: a[2] };
}

function additivesFromTags(tags) {
  const seen = new Set(), out = [];
  (tags || []).forEach(t => { const k = additiveKeyFromTag(t); if (k && !seen.has(k)) { seen.add(k); out.push(additiveInfo(k)); } });
  return sortAdditives(out);
}

function sortAdditives(list) {
  return list.sort((a, b) => ((b.level ?? -1) - (a.level ?? -1)) || a.code.localeCompare(b.code, 'en', { numeric: true }));
}

/* Szuka dodatków w wolnym tekście składu: numery E i polskie nazwy. */
function additivesFromText(text) {
  const found = new Map();
  const low = String(text || '').toLowerCase();
  const re = /(?:^|[^a-z0-9ąćęłńóśźż])e\s?-?\s?(\d{3,4})\s?([a-f])?(?![0-9])/gi;
  let m;
  while ((m = re.exec(low))) {
    let key = 'E' + m[1] + (m[2] ? m[2].toUpperCase() : '');
    if (!ADDITIVES[key]) key = ADDITIVES['E' + m[1]] ? 'E' + m[1] : key;
    if (!found.has(key)) found.set(key, additiveInfo(key));
  }
  const f = ' ' + fold(text).replace(/\s+/g, ' ') + ' ';
  for (const [key, a] of Object.entries(ADDITIVES)) {
    if (found.has(key) || !a[3]) continue;
    if (a[3].some(alias => f.includes(fold(alias)))) found.set(key, additiveInfo(key));
  }
  return sortAdditives([...found.values()]);
}

function watchFromText(text) {
  const f = fold(text);
  return WATCH_WORDS.filter(w => w.words.some(x => f.includes(fold(x)))).map(w => ({ label: w.label, note: w.note, level: w.level }));
}

const NUTRI_POINTS = { a: 100, b: 75, c: 50, d: 25, e: 0 };
const NOVA_POINTS = { 1: 100, 2: 75, 3: 50, 4: 0 };
/* Metoda oceny, wersja 2 (19.10.2026): dodatki liczą się według ryzyka, a nie samej obecności. */
const METHOD_VERSION = '2';
const ADD_PENALTY = { 0: 0, 1: 0, 2: 15, 3: 40 };
/* Limit oceny tylko dla substancji wycofanych w UE albo z mocnymi dowodami. */
const CAP_CODES = new Set(['E171', 'E249', 'E250', 'E251', 'E252']);
const CAP_SCORE = 49;
const SIMPLE_FLOOR = 25;

function additivesScore(list) {
  return Math.max(0, 100 - list.reduce((s, a) => s + (ADD_PENALTY[a.level] || 0), 0));
}

function foodScore({ nutriscore, nova, additives, additivesKnown, simple }) {
  const parts = [];
  const ns = String(nutriscore || '').toLowerCase();
  if (ns in NUTRI_POINTS) parts.push({ key: 'nutrition', w: 60, v: NUTRI_POINTS[ns] });
  if (additivesKnown) parts.push({ key: 'additives', w: 30, v: additivesScore(additives) });
  const nv = Number(nova);
  if (nv in NOVA_POINTS) parts.push({ key: 'processing', w: 10, v: NOVA_POINTS[nv] });
  if (!parts.length) return { score: null, parts, partial: true, capped: false, floored: false, capBy: [] };
  const wsum = parts.reduce((s, p) => s + p.w, 0);
  let score = Math.round(parts.reduce((s, p) => s + p.w * p.v, 0) / wsum);
  const capBy = additivesKnown ? additives.filter(a => CAP_CODES.has(a.code)).map(a => a.code) : [];
  const capped = capBy.length > 0 && score > CAP_SCORE;
  if (capped) score = CAP_SCORE;
  const floored = !!simple && !capBy.length && score < SIMPLE_FLOOR;
  if (floored) score = SIMPLE_FLOOR;
  return { score, parts, partial: wsum < 100, capped, floored, capBy };
}

/* Szacunkowy Nutri-Score (algorytm z 2023 r. dla żywności ogólnej) z wartości na 100 g.
   Tylko gdy baza nie podaje oficjalnego. Napojów nie liczymy (inny algorytm). Brak owoców/warzyw = 0 pkt. */
function estimateNutriScore(nm, drink) {
  if (drink || !nm) return null;
  const kcal = nm.kcal, sug = nm.sugars, sat = nm.sat, salt = nm.salt;
  if ([kcal, sug, sat, salt].some(v => v == null || !isFinite(v))) return null;
  const steps = (v, list) => list.filter(t => v > t).length;
  const N = steps(kcal * 4.184, [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350])
    + steps(sug, [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51])
    + steps(sat, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    + steps(salt, [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4]);
  const protein = steps(nm.proteins || 0, [2.4, 4.8, 7.2, 9.6, 12, 14, 17]);
  const fiber = steps(nm.fiber || 0, [3, 4.1, 5.2, 6.3, 7.4]);
  const score = N - (N >= 11 ? fiber : protein + fiber);
  return score <= 0 ? 'a' : score <= 2 ? 'b' : score <= 10 ? 'c' : score <= 18 ? 'd' : 'e';
}

/* Pitne produkty mleczne (jogurty pitne, kefiry, maślanki, mleka smakowe). Oficjalny Nutri-Score od 2023 r. liczy je
   jak napoje, a baza ocenia bliźniacze produkty raz tak, raz tak – zależnie od wpisanej kategorii (np. skyr pitny
   wiśnia E, a truskawka B przy identycznych wartościach). Gdy znamy wartości odżywcze, liczymy je sami, jednakowo. */
const DAIRY_DRINK_CATS = ['en:yogurt-drinks', 'en:drinkable-yogurts', 'en:fermented-milk-drinks', 'en:kefirs', 'en:buttermilks', 'en:flavoured-milks', 'en:milk-drinks', 'en:dairy-drinks', 'en:milkshakes'];
const DAIRY_DRINK_WORDS = /(^|[^a-z])(pitn|do picia|kefir|maslank|napoj mleczn|mleko smakow)/;
function isDairyDrink(prod) {
  const cats = Array.isArray(prod.categories) ? prod.categories : [];
  if (prod.kind === 'cosmetic' || cats.includes('en:plant-based-milk-alternatives') || cats.includes('en:plant-based-beverages')) return false;
  if (DAIRY_DRINK_CATS.some(c => cats.includes(c))) return true;
  const dairy = cats.includes('en:dairies') || cats.some(c => /yogurt|milk|kefir|dairy|skyr/.test(c));
  return dairy && DAIRY_DRINK_WORDS.test(' ' + fold(prod.name));
}
/* Nutri-Score dla napojów (algorytm z 2023 r.), wartości na 100 ml. Bez zawartości owoców (baza jej zwykle nie ma). */
function beverageNutriScore(nm, sweetened) {
  if (!nm) return null;
  const kcal = nm.kcal, sug = nm.sugars, sat = nm.sat, salt = nm.salt;
  if ([kcal, sug, sat, salt].some(v => v == null || !isFinite(v))) return null;
  const steps = (v, list) => list.filter(t => v > t).length;
  const N = steps(kcal * 4.184, [30, 90, 150, 210, 240, 270, 300, 330, 360, 390])
    + steps(sug, [0.5, 2, 3.5, 5, 6, 7, 8, 9, 10, 11])
    + steps(sat, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    + steps(salt, [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4])
    + (sweetened ? 4 : 0);
  const P = steps(nm.proteins || 0, [1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3]) + steps(nm.fiber || 0, [3, 4.1, 5.2, 6.3, 7.4]);
  const score = N - P;
  return score <= 2 ? 'b' : score <= 6 ? 'c' : score <= 9 ? 'd' : 'e';
}

/* Produkt prosty: nieprzetworzony albo z 1–2 składników bez dodatków. Nie dostaje najniższego werdyktu za same kalorie czy tłuszcz. */
function isSimpleFood(prod, additives) {
  const nv = Number(prod.nova);
  if (nv === 1 || nv === 2) return true;
  if (!prod.ingredients || additives.length) return false;
  const parts = String(prod.ingredients).split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  return parts.length > 0 && parts.length <= 2;
}

function additiveEffect(a) {
  if (a.level == null || a.level <= 1) return 'Nie obniża oceny.';
  if (CAP_CODES.has(a.code)) return `Obniża ocenę o ${ADD_PENALTY[a.level]} pkt i ogranicza ją do ${CAP_SCORE}.`;
  return `Obniża ocenę o ${ADD_PENALTY[a.level]} pkt.`;
}

function inciAnalyze(text) {
  const items = String(text || '').replace(/\[[^\]]*\]/g, ' ').split(/[,;\n•·]+/).map(s => s.trim()).filter(Boolean);
  const flags = [], seen = new Set();
  items.forEach(raw => {
    const name = raw.toLowerCase().replace(/[*.]+$/, '').replace(/\s+/g, ' ').trim();
    let hit = null;
    if (INCI[name]) hit = [name, INCI[name]];
    else {
      for (const k of Object.keys(INCI)) {
        if (k.length > 3 && new RegExp('(^|[^a-z0-9-])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9-])').test(name)) { hit = [k, INCI[k]]; break; }
      }
    }
    if (!hit && /^peg-\d/.test(name)) hit = [name, [1, 'Związek PEG. Może zawierać śladowe zanieczyszczenia z produkcji.']];
    if (hit && !seen.has(hit[0])) { seen.add(hit[0]); flags.push({ code: '', name: raw.replace(/[*.]+$/, '').slice(0, 80), level: hit[1][0], note: hit[1][1] }); }
  });
  flags.sort((a, b) => b.level - a.level);
  return { flags, count: items.length };
}

function cosmeticScore(flags, count) {
  if (!count) return { score: null, partial: true, capped: false, floored: false, capBy: [] };
  const n = l => flags.filter(f => f.level === l).length;
  let score = Math.max(0, 100 - 40 * n(3) - 15 * n(2));
  const capped = n(3) > 0 && score > CAP_SCORE;
  if (capped) score = CAP_SCORE;
  return { score, partial: false, capped, floored: false, capBy: flags.filter(f => f.level === 3).map(f => f.name) };
}

const VERDICTS = [
  { min: 75, label: 'Dobre na co dzień', short: 'Na co dzień', cls: 'lv-great', color: 'var(--great)' },
  { min: 50, label: 'Dobre', short: 'Dobre', cls: 'lv-good', color: 'var(--good)' },
  { min: 25, label: 'Od czasu do czasu', short: 'Czasem', cls: 'lv-fair', color: 'var(--fair)' },
  { min: 0, label: 'Raczej rzadko', short: 'Rzadko', cls: 'lv-poor', color: 'var(--poor)' }
];
function grade(score) {
  if (score == null || isNaN(score)) return { label: 'Brak oceny', short: '–', cls: 'lv-none', color: 'var(--muted)' };
  return VERDICTS.find(v => score >= v.min);
}

/* Progi „sygnalizacji świetlnej” na 100 g (dla napojów na 100 ml). */
const THRESH = {
  fat: { food: [3, 17.5], drink: [1.5, 8.75] },
  'saturated-fat': { food: [1.5, 5], drink: [0.75, 2.5] },
  sugars: { food: [5, 22.5], drink: [2.5, 11.25] },
  salt: { food: [0.3, 1.5], drink: [0.3, 0.75] }
};
function nutrientLevel(key, value, drink) {
  const t = THRESH[key];
  if (!t || value == null || isNaN(value)) return null;
  const [lo, hi] = t[drink ? 'drink' : 'food'];
  return value <= lo ? 'low' : value > hi ? 'high' : 'mid';
}

function validBarcode(code) {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const d = code.split('').map(Number), check = d.pop();
  const sum = d.reverse().reduce((s, n, i) => s + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

function normalizeProduct(p, source) {
  const kind = source === 'obf' ? 'cosmetic' : 'food';
  // 3.0.16: znak ℮ (ilość szacunkowa) z etykiety trafia do bazy jako „℮” albo „e” – „400 g e” → „400 g”.
  const cleanQty = q => String(q || '').replace(/℮/g, ' ').replace(/(\d\s*(?:g|kg|mg|ml|cl|dl|l)\.?)\s+e\b\.?/gi, '$1').replace(/^\s*e\s+(?=\d)/i, '').replace(/\s{2,}/g, ' ').trim();
  const name = p.product_name_pl || p.product_name || p.generic_name_pl || p.generic_name || '';
  const ingredients = p.ingredients_text_pl || p.ingredients_text || '';
  const cats = Array.isArray(p.categories_hierarchy) && p.categories_hierarchy.length ? p.categories_hierarchy : (Array.isArray(p.categories_tags) ? p.categories_tags : []);
  const n = p.nutriments || {};
  const num = k => { const v = n[k]; if (v === undefined || v === null || v === '') return null; const x = Number(v); return isFinite(x) && x >= 0 ? x : null; };
  const out = {
    code: String(p.code || ''), kind, source, name: name.trim(),
    brand: String(p.brands || '').split(',')[0].trim(), quantity: cleanQty(p.quantity),
    image: p.image_front_small_url || p.image_front_url || p.image_url || '',
    imageLarge: p.image_front_url || p.image_url || p.image_front_small_url || '',
    imageIngredients: p.image_ingredients_url || '', imageNutrition: p.image_nutrition_url || '',
    stores: (Array.isArray(p.stores) ? p.stores : typeof p.stores === 'string' ? p.stores.split(',') : Array.isArray(p.stores_tags) ? p.stores_tags : []).map(x => String(x).trim()).filter(Boolean).slice(0, 20),
    qchg: Array.isArray(p.qchg) ? p.qchg.filter(x => Array.isArray(x) && x.length === 3 && x.every(y => typeof y === 'string')).slice(-3) : null,
    scans: p.unique_scans_n != null && isFinite(Number(p.unique_scans_n)) ? Math.max(0, Math.round(Number(p.unique_scans_n))) : null,
    nutriscore: (p.nutriscore_grade || '').toLowerCase(), nova: p.nova_group || null,
    additiveTags: Array.isArray(p.additives_tags) ? p.additives_tags : (typeof p.additives_tags === 'string' ? [p.additives_tags] : (Array.isArray(p.ingredients_tags) && p.ingredients_tags.length ? p.ingredients_tags.filter(t => /^en:e\d{3}/.test(t)) : null)),
    allergens: Array.isArray(p.allergens_tags) ? p.allergens_tags : [], traces: Array.isArray(p.traces_tags) ? p.traces_tags : [],
    analysis: Array.isArray(p.ingredients_analysis_tags) ? p.ingredients_analysis_tags : [], labels: Array.isArray(p.labels_tags) ? p.labels_tags : [],
    categoryName: String(p.categories || '').split(',').map(x => x.trim()).filter(Boolean).pop() || '', ingredients,
    drink: cats.includes('en:beverages') && !cats.includes('en:dairies'),
    category: cats[cats.length - 1] || '', categories: cats.filter(x => typeof x === 'string').slice(0, 30),
    nutriments: {
      kcal: num('energy-kcal_100g'), fat: num('fat_100g'), sat: num('saturated-fat_100g'), sugars: num('sugars_100g'),
      salt: num('salt_100g'), proteins: num('proteins_100g'), fiber: num('fiber_100g'), carbs: num('carbohydrates_100g'), alcohol: num('alcohol_100g'), iron: num('iron_100g')
    }
  };
  out.nutriDerived = deriveNutrients(out.nutriments, num('sodium_100g'), out.drink);
  return out;
}

/* 3.0.19: brakujące wartości odżywcze, które wynikają z innych (bez zgadywania). Uzupełnia nm i zwraca opis źródła:
   { sugars: { kind: 'exact', from: 'węglowodany 0 g' }, sat: { kind: 'max', from: 'tłuszcz 1 g' }, salt: { kind: 'exact', from: 'sód 0,4 g' } }.
   - dokładnie: węglowodany 0 → cukry 0; tłuszcz 0 → nasycone 0; sól = sód × 2,5;
   - górna granica (cukry ≤ węglowodany, nasycone ≤ tłuszcz) tylko wtedy, gdy na pewno daje „mało” – wtedy liczymy najgorszy przypadek (= granicę). */
function deriveNutrients(nm, sodium, drink) {
  const d = {}, g = v => String(Math.round(v * 1000) / 1000).replace('.', ',') + ' g';
  const pair = (key, parent, lvlKey, parentName) => {
    if (nm[key] != null || nm[parent] == null) return;
    if (nm[parent] === 0) { nm[key] = 0; d[key] = { kind: 'exact', from: parentName + ' 0 g' }; return; }
    if (nutrientLevel(lvlKey, nm[parent], drink) === 'low') { nm[key] = nm[parent]; d[key] = { kind: 'max', from: parentName + ' ' + g(nm[parent]) }; }
  };
  pair('sugars', 'carbs', 'sugars', 'węglowodany');
  pair('sat', 'fat', 'saturated-fat', 'tłuszcz');
  if (nm.salt == null && sodium != null) { nm.salt = Math.round(sodium * 2.5 * 1000) / 1000; d.salt = { kind: 'exact', from: 'sód ' + g(sodium) }; }
  return Object.keys(d).length ? d : null;
}

/* Pełna analiza produktu do wyświetlenia. */
function analyze(prod) {
  if (prod.kind === 'cosmetic') {
    const inci = inciAnalyze(prod.ingredients);
    const s = cosmeticScore(inci.flags, inci.count);
    return { ...s, flags: inci.flags, count: inci.count, additives: [], watch: [] };
  }
  const tagsKnown = Array.isArray(prod.additiveTags) && (prod.additiveTags.length > 0 || !!prod.ingredients);
  let additives = tagsKnown ? additivesFromTags(prod.additiveTags) : [];
  if (prod.ingredients) {
    const fromText = additivesFromText(prod.ingredients);
    const codes = new Set(additives.map(a => a.code));
    fromText.forEach(a => { if (!codes.has(a.code)) additives.push(a); });
    additives = sortAdditives(additives);
  }
  const additivesKnown = tagsKnown || !!prod.ingredients;
  const simple = isSimpleFood(prod, additives);
  // Brak Nutri-Score w bazie, ale są wartości odżywcze (np. produkt właśnie dodany): liczymy go szacunkowo.
  const official = String(prod.nutriscore || '').toLowerCase() in NUTRI_POINTS ? String(prod.nutriscore).toLowerCase() : '';
  const bev = isDairyDrink(prod) ? beverageNutriScore(prod.nutriments, additives.some(a => SWEETENER_CODES.includes(a.code))) : null;
  const est = official || bev ? null : estimateNutriScore(prod.nutriments, prod.drink);
  const nutriscore = bev || official || est || '';
  const s = foodScore({ nutriscore, nova: prod.nova, additives, additivesKnown, simple });
  return { ...s, nutriscore, nutriscoreEstimated: !!est, nutriscoreBeverage: !!bev, additives, additivesKnown, simple, watch: watchFromText(prod.ingredients) };
}

/* „Dlaczego?” – lista powodów werdyktu. sign: '+' podnosi, '-' obniża, 'i' informacja. */
const NUTRIENT_WORDS = { sugars: 'cukru', salt: 'soli', 'saturated-fat': 'tłuszczów nasyconych', fat: 'tłuszczu' };
function explain(prod, an) {
  const out = [], add = (sign, text) => out.push({ sign, text });
  const fmt = v => String(Math.round(v * 10) / 10).replace('.', ',');
  if (prod.kind === 'cosmetic') {
    if (!an.count) { add('i', 'Baza nie ma składu tego kosmetyku, więc nie możemy go ocenić.'); return out; }
    an.flags.filter(f => f.level >= 2).forEach(f => add('-', `${f.name}: ${LEVELS[f.level].label.toLowerCase()} (${f.level >= 3 ? '−40 pkt' : '−15 pkt'}).`));
    const low = an.flags.filter(f => f.level === 1).length;
    if (low) add('i', `${low} ${plural(low, 'składnik', 'składniki', 'składników')} z niewielkimi uwagami (np. alergeny zapachowe). Nie obniżają oceny.`);
    if (!an.flags.some(f => f.level >= 2)) add('+', 'Brak składników z umiarkowanymi lub dużymi zastrzeżeniami.');
    if (an.capped) add('-', 'Ocena ograniczona do 49 przez składnik z dużymi zastrzeżeniami.');
    else if (an.flags.some(f => f.level >= 3)) add('i', 'Zawiera składnik z dużymi zastrzeżeniami, więc ocena i tak nie mogłaby przekroczyć 49.');
    return out;
  }
  const ns = String(an.nutriscore || prod.nutriscore || '').toLowerCase();
  if (ns in NUTRI_POINTS) {
    const L = ns.toUpperCase() + (an.nutriscoreEstimated ? ', szacunkowy z wpisanych wartości' : an.nutriscoreBeverage ? ', liczony jak dla napoju, bo to pitny produkt mleczny' : '');
    if (ns === 'a' || ns === 'b') add('+', `Dobra wartość odżywcza (Nutri-Score ${L}).`);
    else if (ns === 'c') add('i', `Przeciętna wartość odżywcza (Nutri-Score ${L}).`);
    else add('-', `Słaba wartość odżywcza (Nutri-Score ${L}).`);
  } else add('i', 'Brak Nutri-Score w bazie, więc ta część nie wchodzi do oceny.');
  const nm = prod.nutriments || {};
  [['sugars', nm.sugars], ['salt', nm.salt], ['saturated-fat', nm.sat]].forEach(([k, v]) => {
    if (nutrientLevel(k, v, prod.drink) === 'high') add('-', `Dużo ${NUTRIENT_WORDS[k]}: ${fmt(v)} g na 100 ${prod.drink ? 'ml' : 'g'}.`);
  });
  if (nm.proteins != null && nm.proteins >= 12) add('+', `Dużo białka: ${fmt(nm.proteins)} g na 100 g.`);
  if (nm.fiber != null && nm.fiber >= 6) add('+', `Dużo błonnika: ${fmt(nm.fiber)} g na 100 g.`);
  if (!an.additivesKnown) add('i', 'Baza nie ma składu, więc nie oceniamy dodatków.');
  else {
    const bad = an.additives.filter(a => a.level >= 2);
    bad.forEach(a => add('-', `${a.code} (${a.name}): ${LEVELS[a.level].label.toLowerCase()}, −${ADD_PENALTY[a.level]} pkt w części „dodatki”.`));
    const neutral = an.additives.filter(a => a.level != null && a.level <= 1).length;
    if (neutral) add('i', `${neutral} ${plural(neutral, 'dodatek', 'dodatki', 'dodatków')} bez wpływu na ocenę (bez zastrzeżeń lub z niewielkimi).`);
    if (!bad.length) add('+', an.additives.length ? 'Brak dodatków z umiarkowanymi lub dużymi zastrzeżeniami.' : 'Bez dodatków z numerem E.');
  }
  const nv = Number(prod.nova);
  if (nv === 1) add('+', 'Nieprzetworzony lub minimalnie przetworzony (NOVA 1).');
  else if (nv === 2) add('i', 'Składnik kulinarny, np. olej, masło, cukier (NOVA 2).');
  else if (nv === 3) add('i', 'Przetworzony (NOVA 3).');
  else if (nv === 4) add('-', 'Wysoko przetworzony (NOVA 4).');
  if (an.capped) add('-', `Ocena ograniczona do 49, bo produkt zawiera ${an.capBy.join(', ')}.`);
  else if (an.capBy && an.capBy.length) add('i', `Zawiera ${an.capBy.join(', ')}, więc ocena i tak nie mogłaby przekroczyć 49.`);
  if (an.floored) add('+', 'Produkt prosty: nie dajemy mu najniższego werdyktu za same kalorie czy tłuszcz. Liczy się porcja.');
  if (an.partial && an.score != null) add('i', 'Ocena częściowa: w bazie brakuje części danych.');
  return out;
}

/* ===== Profil „czego unikam” ===== */
const EMPTY_PROFILE = { allergens: [], diet: [], avoid: [], cosmetic: [], custom: [], goals: [], noScores: false };
function cleanProfile(p) {
  const out = { allergens: [], diet: [], avoid: [], cosmetic: [], custom: [], goals: [], noScores: false };
  if (!p || typeof p !== 'object') return out;
  if (Array.isArray(p.goals)) { const ok = new Set(GOALS.map(g => g.key)); out.goals = [...new Set(p.goals.filter(g => ok.has(g)))].slice(0, GOALS_MAX); }
  if (Array.isArray(p.custom)) {
    const seen = new Set();
    p.custom.forEach(c => { const v = cleanCustom(c); if (v && !seen.has(fold(v))) { seen.add(fold(v)); out.custom.push(v); } });
    out.custom = out.custom.slice(0, CUSTOM_MAX);
  }
  for (const g of ['allergens', 'diet', 'avoid', 'cosmetic']) {
    const allowed = new Set(PROFILE_OPTIONS[g].map(o => o.key));
    out[g] = Array.isArray(p[g]) ? [...new Set(p[g].filter(k => allowed.has(k)))] : [];
  }
  out.noScores = p.noScores === true;
  return out;
}
const profileSize = p => p.allergens.length + p.diet.length + p.avoid.length + p.cosmetic.length + (p.custom ? p.custom.length : 0) + (p.watch ? p.watch.length : 0);

/* Własny składnik: same litery, spacje i myślniki, 3–30 znaków. Zwraca oczyszczony tekst albo ''. */
function cleanCustom(v) {
  const t = String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase();
  if (t.length < 3 || t.length > 30) return '';
  if (!/^[a-ząćęłńóśźż][a-ząćęłńóśźż \-]*$/.test(t)) return '';
  return t;
}
function customProblem(v, list) {
  const t = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  if (!t) return 'Wpisz nazwę składnika, np. sól albo czosnek.';
  if (t.length < 3) return 'Wpisz co najmniej 3 litery.';
  if (t.length > 30) return 'Nazwa jest za długa. Wpisz jeden składnik, do 30 znaków.';
  if (/[,;]/.test(t)) return 'Dodawaj składniki pojedynczo, bez przecinków.';
  if (!cleanCustom(t)) return 'Używaj tylko liter, np. „sól”, „kakao”, „olej kokosowy”.';
  if ((list || []).some(x => fold(x) === fold(t))) return 'Ten składnik jest już na liście.';
  if ((list || []).length >= CUSTOM_MAX) return `Możesz dodać najwyżej ${CUSTOM_MAX} własnych składników.`;
  return '';
}
/* Rdzeń słowa: „orzechy” → „orzech”, „czosnek” → „czosn”. Dla popularnych słów gotowe odmiany. */
function customMatcher(v) {
  const f = fold(v).trim();
  if (CUSTOM_SYNONYMS[f]) return CUSTOM_SYNONYMS[f];
  if (f.includes(' ')) return { phrases: [f] };
  let stem = f;
  if (f.length >= 5 && /(ek|ec)$/.test(f)) stem = f.slice(0, -2);
  else if (f.length >= 5) stem = f.replace(/(ami|ach|ow|em|om|a|e|i|y|u|o)$/, '');
  return { prefix: [stem], exact: [f] };
}
/* Tekst do dopasowań: bez polskich znaków, bez fraz typu „bez dodatku soli”, „nie zawiera glutenu”. */
function cleanForMatch(text) {
  return ' ' + fold(text).replace(/[^a-z0-9%]+/g, ' ')
    .replace(/\b(bez|nie zawiera)( dodatku| dodanego| dodanej| dodatkow| zawartosci)? [a-z]+/g, ' ')
    .replace(/\s+/g, ' ').trim() + ' ';
}
function hasWords(clean, spec) {
  if (!spec) return false;
  const tokens = clean.trim().split(' ');
  if ((spec.exact || []).some(w => tokens.includes(w))) return true;
  if ((spec.prefix || []).some(w => w.includes(' ') ? clean.includes(' ' + w) : tokens.some(t => t.startsWith(w)))) return true;
  if ((spec.phrases || []).some(w => clean.includes(w))) return true;
  return false;
}
/* Ocet spirytusowy, winny itp. to nie alkohol (alkohol przefermentował w kwas octowy): przed szukaniem alkoholu usuwamy te nazwy. */
const VINEGAR_RE = / (ocet|octu|octem|occie|octowy|octowa) (spirytusow|winn|z win|z wina|jablkow|z jablek|balsamiczn|ryzow|malinow|sherry|z sherry)[a-z]* /g;
const noVinegar = clean => clean.replace(VINEGAR_RE, ' ').replace(/ (spirit|wine|rice|cider) vinegar /g, ' ');
const hasAlcohol = (clean, nm) => (nm && nm.alcohol != null && nm.alcohol > 0.5) || hasWords(noVinegar(clean), WORDS.alcohol);
const wordText = s => ' ' + fold(s).replace(/[^a-z0-9%]+/g, ' ').trim() + ' ';

/* 3.0.18: produkt bez składu z kategorii jednoznacznie zwierzęcej (ser, mięso, wędlina, ryba, jajka, nabiał; dla wegan też miód).
   Zwraca nazwę do powodu („ser”) albo ''. Tylko do „nie pasuje” – nigdy nie oznaczamy niczego jako pasujące na podstawie samej kategorii.
   Pomijamy produkty roślinne: „plant-based”, „vegan”, zamienniki („substitute”, „alternative”) w kategoriach albo wegańska etykieta/analiza. */
const ANIMAL_CATS = [
  ['ser', ['en:cheeses']], ['wędlina', ['en:prepared-meats', 'en:sausages', 'en:hams', 'en:cold-cuts']], ['mięso', ['en:meats', 'en:poultries', 'en:meats-and-their-products']],
  ['ryba lub owoce morza', ['en:fishes', 'en:seafood', 'en:fishes-and-their-products', 'en:canned-fishes']], ['jajka', ['en:eggs', 'en:chicken-eggs']],
  ['nabiał', ['en:dairies', 'en:milks', 'en:yogurts', 'en:butters', 'en:creams', 'en:quarks', 'en:fermented-milk-products', 'en:dairy-desserts']]];
const VEGAN_ONLY_CATS = [['miód', ['en:honeys']]];
function animalCategory(prod, vegan, only) {
  const cats = (prod.categories || []).filter(c => typeof c === 'string');
  const labels = new Set(prod.labels || []), analysis = new Set(prod.analysis || []);
  if (cats.some(c => /plant-based|vegan|substitute|alternative/.test(c))) return '';
  if (labels.has('en:vegan') || analysis.has('en:vegan') || (!vegan && labels.has('en:vegetarian'))) return '';
  // Wegetarianie jedzą nabiał, sery i jajka – dla nich liczy się tylko mięso, wędlina i ryba.
  let rules = vegan ? ANIMAL_CATS.concat(VEGAN_ONLY_CATS) : ANIMAL_CATS.filter(([n]) => !['ser', 'jajka', 'nabiał'].includes(n));
  if (only) rules = ANIMAL_CATS.filter(([n]) => only.includes(n)); // 3.0.21: wybrane grupy (bez mleka: ser, nabiał; pescetarianie: mięso, wędlina)
  const hit = rules.find(([, tags]) => tags.some(t => cats.includes(t)));
  return hit ? hit[0] : '';
}

/* Wynik: status 'ok' | 'fail' | 'unknown' | 'none', listy powodów. Nigdy nie mówimy „bezpieczne”. */
function matchProfile(prod, an, profile) {
  const p = cleanProfile(profile);
  const res = { status: 'none', fails: [], traces: [], unknowns: [], checked: 0 };
  const isFood = prod.kind !== 'cosmetic';
  const groups = isFood ? ['allergens', 'diet', 'avoid', 'custom'] : ['cosmetic'];
  const wanted = groups.reduce((n, g) => n + p[g].length, 0);
  if (!wanted) return res;
  res.checked = wanted;
  const ing = String(prod.ingredients || '');
  const foldedAll = fold(ing);
  const tracePos = foldedAll.search(/moze zawierac|moze zawierac sladowe|produkt moze zawierac/);
  const mainText = cleanForMatch(tracePos >= 0 ? ing.slice(0, tracePos) : ing);
  const traceText = tracePos >= 0 ? cleanForMatch(ing.slice(tracePos)) : ' ';
  const hasIng = ing.trim().length > 0;
  const tags = new Set(prod.allergens || []), traceTags = new Set(prod.traces || []);
  const analysis = new Set(prod.analysis || []), labels = new Set(prod.labels || []);
  const codes = new Set((an.additives || []).map(a => a.code));
  const fail = (label, why) => res.fails.push({ label, why });
  const fmtG = v => String(Math.round(v * 10) / 10).replace('.', ',');
  const unknown = label => res.unknowns.push(label);
  // Słowo musi zaczynać wyraz: „zużyto” to nie „żyto”, „bezglutenowy” to nie „gluten” (tekst ma spacje wokół każdego wyrazu).
  const hasWord = (txt, words) => words.some(w => txt.includes(' ' + fold(w)));

  if (isFood) {
    const allergenDataKnown = hasIng || tags.size > 0;
    p.allergens.forEach(k => {
      const o = PROFILE_OPTIONS.allergens.find(x => x.key === k);
      const inTags = o.tags.some(t => tags.has(t)), inText = hasWord(mainText, o.words), inCodes = (o.codes || []).some(c => codes.has(c));
      if (inTags || inText || inCodes) fail(o.label, 'zawiera');
      else if (o.tags.some(t => traceTags.has(t)) || hasWord(traceText, o.words)) res.traces.push(o.label);
      else if (!allergenDataKnown) unknown(o.label);
    });
    const animal = hasWord(mainText, MEAT_WORDS), fishy = hasWord(mainText, PROFILE_OPTIONS.allergens.find(x => x.key === 'fish').words);
    const milky = tags.has('en:milk') || hasWord(mainText, PROFILE_OPTIONS.allergens.find(x => x.key === 'milk').words);
    const eggy = tags.has('en:eggs') || hasWord(mainText, PROFILE_OPTIONS.allergens.find(x => x.key === 'eggs').words);
    // 3.0.21: diety „bez mleka” i „bez laktozy”: „mleko kokosowe/owsiane…” i „masło kakaowe” to nie mleko krowie.
    const mainNoPlant = mainText.replace(/ mle(ko|ka|czko|czka) (kokos|owsian|sojow|migdal|ryzow|roslin|orzech|z owsa|z soi|z migdal)[a-z]*/g, ' ').replace(/ masl[oa] (kakaow|shea|orzech)[a-z]*/g, ' ');
    const milkyNoPlant = tags.has('en:milk') || hasWord(mainNoPlant, PROFILE_OPTIONS.allergens.find(x => x.key === 'milk').words);
    p.diet.forEach(k => {
      if (k === 'vegan') {
        if (analysis.has('en:non-vegan') || animal || fishy || milky || eggy || hasWord(mainText, ['miod'])) fail('Wegańska', 'zawiera składniki odzwierzęce');
        else if (analysis.has('en:vegan') || labels.has('en:vegan')) { /* pasuje */ }
        else if (!hasIng && animalCategory(prod, true)) fail('Wegańska', `to ${animalCategory(prod, true)} (kategoria w bazie)`);
        else unknown('Wegańska');
      } else if (k === 'vegetarian') {
        if (analysis.has('en:non-vegetarian') || animal || fishy) fail('Wegetariańska', 'zawiera mięso, ryby lub żelatynę');
        else if (analysis.has('en:vegetarian') || analysis.has('en:vegan') || labels.has('en:vegetarian') || labels.has('en:vegan')) { }
        else if (!hasIng && animalCategory(prod, false)) fail('Wegetariańska', `to ${animalCategory(prod, false)} (kategoria w bazie)`);
        else unknown('Wegetariańska');
      } else if (k === 'pescetarian') {
        // 3.0.21: bez mięsa (i żelatyny), ryby i owoce morza dozwolone. Ze składem bez mięsa – pasuje; bez składu – kategoria albo „nie wiemy”.
        if (animal) fail('Pescetariańska', 'zawiera mięso lub żelatynę');
        else if (hasIng || analysis.has('en:vegetarian') || analysis.has('en:vegan') || labels.has('en:vegetarian') || labels.has('en:vegan')) { }
        else if (animalCategory(prod, false, ['mięso', 'wędlina'])) fail('Pescetariańska', `to ${animalCategory(prod, false, ['mięso', 'wędlina'])} (kategoria w bazie)`);
        else unknown('Pescetariańska');
      } else if (k === 'nomilk') {
        // 3.0.21: mleko i każdy przetwór (ser, masło, serwatka, kazeina, laktoza) – także produkty „bez laktozy”. Mleka roślinne to nie mleko.
        if (analysis.has('en:vegan') || labels.has('en:vegan')) { }
        else if (milkyNoPlant || hasWord(mainNoPlant, ['laktoz'])) fail('Bez mleka i przetworów', 'zawiera mleko lub jego przetwory');
        else if (!hasIng && animalCategory(prod, false, ['ser', 'nabiał'])) fail('Bez mleka i przetworów', `to ${animalCategory(prod, false, ['ser', 'nabiał'])} (kategoria w bazie)`);
        else if (!allergenDataKnown) unknown('Bez mleka i przetworów');
      } else if (k === 'lactose') {
        // 3.0.21: produkt z mleka, ale oznaczony „bez laktozy” (etykieta, nazwa, skład, dodana laktaza) – pasuje. Dawniej każdy produkt z mlekiem odpadał.
        const lfText = fold((prod.name || '') + ' ' + ing);
        const lactoseFree = labels.has('en:lactose-free') || labels.has('en:no-lactose') || /bez ?laktoz|nie zawiera laktozy|bezlaktoz|laktoza\s*[<≤]/.test(lfText) || hasWord(mainText, ['laktaz']);
        if (lactoseFree) { }
        else if (milkyNoPlant || hasWord(mainNoPlant, ['laktoz'])) fail('Bez laktozy', 'zawiera mleko lub laktozę');
        else if (!allergenDataKnown) unknown('Bez laktozy');
      } else dietRule(k);
    });
    function dietRule(k) {
      const o = PROFILE_OPTIONS.diet.find(x => x.key === k);
      const L = o.label + (o.approx ? ' (orientacyjnie)' : '');
      const nm = prod.nutriments || {}, drink = prod.drink;
      const lvl = (key, v) => nutrientLevel(key, v, drink);
      const reasons = [];
      let missing = false;
      const need = v => { if (v == null) missing = true; return v; };
      if (k === 'glutenfree') {
        const g = PROFILE_OPTIONS.allergens.find(x => x.key === 'gluten');
        if (labels.has('en:gluten-free') || labels.has('en:no-gluten')) return;
        if (g.tags.some(t => tags.has(t)) || hasWord(mainText, g.words)) return fail(L, 'zawiera gluten');
        if (g.tags.some(t => traceTags.has(t)) || hasWord(traceText, g.words)) return res.traces.push('Gluten');
        if (!allergenDataKnown) return unknown(L);
        return;
      }
      if (k === 'lowsodium') {
        const salt = need(nm.salt);
        if (salt != null && salt > 0.3) return fail(L, `${fmtG(salt)} g soli na 100 ${drink ? 'ml' : 'g'} (dieta niskosodowa: do 0,3 g)`);
        if (missing) return unknown(L);
        return;
      }
      if (k === 'lowcarb') {
        const c = need(nm.carbs);
        if (c != null && c > 10) return fail(L, `${fmtG(c)} g węglowodanów na 100 ${drink ? 'ml' : 'g'}`);
        if (missing) return unknown(L);
        return;
      }
      if (k === 'diabetes') {
        const su = need(nm.sugars);
        if (su != null && lvl('sugars', su) === 'high') reasons.push(`dużo cukru: ${fmtG(su)} g na 100 ${drink ? 'ml' : 'g'}`);
        else if (drink && su != null && su > 2.5) reasons.push('słodzony napój');
        if (hasWord(mainText, ['syrop glukozowo', 'syrop fruktozowo', 'syrop glukozowy', 'syrop cukrowy', 'syrop kukurydziany'])) reasons.push('syrop cukrowy w składzie');
        if (reasons.length) return fail(L, reasons.join(', '));
        if (missing && !hasIng) return unknown(L);
        return;
      }
      if (k === 'cardio') {
        const salt = need(nm.salt), sat = need(nm.sat);
        if (salt != null && lvl('salt', salt) === 'high') reasons.push(`dużo soli: ${fmtG(salt)} g na 100 ${drink ? 'ml' : 'g'}`);
        if (sat != null && lvl('saturated-fat', sat) === 'high') reasons.push(`dużo tłuszczów nasyconych: ${fmtG(sat)} g`);
        if (hasWords(mainText, WORDS.hydrogenated)) reasons.push('tłuszcz utwardzony');
        if (['E249', 'E250', 'E251', 'E252'].some(c => codes.has(c)) || hasWords(mainText, WORDS.processedMeat)) reasons.push('przetworzone mięso');
        if (reasons.length) return fail(L, reasons.join(', '));
        if (salt == null && sat == null && !hasIng) return unknown(L);
        return;
      }
      if (k === 'mediterranean') {
        if (Number(prod.nova) === 4) reasons.push('wysoko przetworzony');
        if (lvl('sugars', nm.sugars) === 'high') reasons.push('dużo cukru');
        if (lvl('saturated-fat', nm.sat) === 'high') reasons.push('dużo tłuszczów nasyconych');
        if (['E249', 'E250', 'E251', 'E252'].some(c => codes.has(c)) || hasWords(mainText, WORDS.processedMeat)) reasons.push('przetworzone mięso');
        if (analysis.has('en:palm-oil') || hasWord(mainText, ['palmow'])) reasons.push('olej palmowy');
        if (reasons.length) return fail(L, reasons.join(', '));
        if (!hasIng && prod.nova == null && nm.sugars == null) return unknown(L);
        return;
      }
      if (k === 'lightdiet') {
        if (lvl('fat', nm.fat) === 'high') reasons.push('dużo tłuszczu');
        if (hasWords(mainText, WORDS.lightdiet)) reasons.push('składniki ciężkostrawne lub ostre');
        if (codes.has('E290')) reasons.push('napój gazowany');
        if (hasAlcohol(mainText, nm)) reasons.push('alkohol');
        if (reasons.length) return fail(L, reasons.join(', '));
        if (!hasIng && nm.fat == null) return unknown(L);
      }
    }
    p.avoid.forEach(k => {
      if (k === 'salt') {
        const v = prod.nutriments && prod.nutriments.salt, lv = nutrientLevel('salt', v, prod.drink);
        if (lv === 'high') fail('Dużo soli', `${fmtG(v)} g na 100 ${prod.drink ? 'ml' : 'g'}`); else if (lv == null) unknown('Dużo soli');
        return;
      }
      if (k === 'satfat') {
        const v = prod.nutriments && prod.nutriments.sat, lv = nutrientLevel('saturated-fat', v, prod.drink);
        if (lv === 'high') fail('Dużo tłuszczów nasyconych', `${fmtG(v)} g na 100 ${prod.drink ? 'ml' : 'g'}`); else if (lv == null) unknown('Dużo tłuszczów nasyconych');
        return;
      }
      if (k === 'hydrogenated') { if (hasWords(mainText, WORDS.hydrogenated)) fail('Tłuszcz utwardzony', 'zawiera'); else if (!hasIng) unknown('Tłuszcz utwardzony'); return; }
      if (k === 'ultra') { const nv = Number(prod.nova); if (nv === 4) fail('Wysoko przetworzone', 'NOVA 4'); else if (!(nv >= 1 && nv <= 3)) unknown('Wysoko przetworzone'); return; }
      if (k === 'alcohol') { if (hasAlcohol(mainText, prod.nutriments)) fail('Alkohol', 'zawiera'); else if (!hasIng) unknown('Alkohol'); return; }
      if (k === 'caffeine') { if (hasWords(mainText, WORDS.caffeine)) fail('Kofeina', 'zawiera kawę, herbatę lub kofeinę'); else if (!hasIng) unknown('Kofeina'); return; }
      if (k === 'pork') { if (hasWords(mainText, WORDS.pork)) fail('Wieprzowina', 'zawiera'); else if (!hasIng) unknown('Wieprzowina'); return; }
      if (k === 'palm') {
        if (analysis.has('en:palm-oil') || hasWord(mainText, ['palmow', 'palm '])) fail('Olej palmowy', 'zawiera');
        else if (!hasIng && !analysis.has('en:palm-oil-free')) unknown('Olej palmowy');
      } else if (k === 'sweeteners') {
        const found = SWEETENER_CODES.filter(c => codes.has(c));
        if (found.length) fail('Słodziki', found.map(c => ADDITIVES[c] ? ADDITIVES[c][0] : c).join(', '));
        else if (!an.additivesKnown) unknown('Słodziki');
      } else if (k === 'sugar') {
        if (hasWord(mainText, SUGAR_WORDS)) fail('Dodany cukier', 'cukier lub syrop w składzie');
        else if (!hasIng) unknown('Dodany cukier');
      } else if (k === 'kidsugar') {
        const s = prod.nutriments && prod.nutriments.sugars;
        const lv = nutrientLevel('sugars', s, prod.drink);
        if (lv === 'high') fail('Dużo cukru', `${String(s).replace('.', ',')} g na 100 ${prod.drink ? 'ml' : 'g'}`);
        else if (lv == null) unknown('Dużo cukru');
      } else if (k === 'nitrites') {
        const found = ['E249', 'E250', 'E251', 'E252'].filter(c => codes.has(c));
        if (found.length) fail('Azotyny i azotany', found.join(', '));
        else if (!an.additivesKnown) unknown('Azotyny i azotany');
      } else if (k === 'controversial') {
        const found = (an.additives || []).filter(a => a.level >= 2);
        if (found.length) fail('Dodatki z zastrzeżeniami', found.map(a => a.code).join(', '));
        else if (!an.additivesKnown) unknown('Dodatki z zastrzeżeniami');
      }
    });
    p.custom.forEach(c => {
      if (!hasIng) return unknown(c);
      if (hasWords(mainText, customMatcher(c))) fail(c.charAt(0).toUpperCase() + c.slice(1), 'jest w składzie');
      else if (traceText.trim() && hasWords(traceText, customMatcher(c))) res.traces.push(c);
    });
  } else {
    const items = String(prod.ingredients || '').toLowerCase();
    p.cosmetic.forEach(k => {
      if (!items.trim()) { unknown(k === 'fragrance' ? 'Substancje zapachowe' : 'Parabeny'); return; }
      if (k === 'fragrance') { const f = FRAGRANCE_INCI.filter(w => items.includes(w)); if (f.length) fail('Substancje zapachowe', f.slice(0, 3).join(', ')); }
      if (k === 'parabens') { const m = items.match(/[a-z]*paraben/g); if (m) fail('Parabeny', [...new Set(m)].slice(0, 3).join(', ')); }
    });
  }
  res.status = res.fails.length ? 'fail' : res.traces.length ? 'traces' : res.unknowns.length ? 'unknown' : 'ok';
  return res;
}

/* ===== Cele żywieniowe ===== */
/* Dla każdego celu lista plusów (+), minusów (-) i informacji (i) oraz werdykt: good / bad / neutral / unknown. Nie zmienia oceny produktu. */
function goalInsights(prod, an, goals) {
  if (prod.kind === 'cosmetic') return [];
  const nm = prod.nutriments || {}, drink = !!prod.drink, per = drink ? '100 ml' : '100 g';
  const f = v => String(Math.round(v * 10) / 10).replace('.', ',');
  const txt = cleanForMatch(prod.ingredients || '');
  const lvl = (k, v) => nutrientLevel(k, v, drink);
  return (goals || []).filter(g => GOALS.some(x => x.key === g && !x.general)).map(key => {
    const items = [], add = (sign, text) => items.push({ sign, text });
    // limit: poziom składnika, który ten cel ogranicza (low / mid / high / unknown); null, gdy cel niczego nie ogranicza.
    let limit = null;
    if (key === 'weight') {
      if (nm.kcal != null) {
        if (nm.kcal >= 400) add('-', `Dużo kalorii w małej porcji: ${Math.round(nm.kcal)} kcal na ${per}. Uważaj na wielkość porcji.`);
        else if (nm.kcal <= (drink ? 20 : 100)) add('+', `Mało kalorii: ${Math.round(nm.kcal)} kcal na ${per}.`);
      }
      if (drink && nm.sugars != null && nm.sugars > 2.5) { add('-', 'Słodzony napój: kalorie z picia słabo sycą.'); limit = 'high'; }
      else if (lvl('sugars', nm.sugars) === 'high') { add('-', `Dużo cukru: ${f(nm.sugars)} g na ${per}.`); limit = 'high'; }
      if ((nm.proteins != null && nm.proteins >= 10) || (nm.fiber != null && nm.fiber >= 6)) add('+', 'Dużo białka lub błonnika, więc syci na dłużej.');
    } else if (key === 'muscle') {
      if (nm.proteins != null) {
        if (nm.proteins >= 20) add('+', `Bardzo dużo białka: ${f(nm.proteins)} g na ${per}.`);
        else if (nm.proteins >= 10) add('+', `Dużo białka: ${f(nm.proteins)} g na ${per}.`);
        else if (nm.proteins < 3) add('i', `Mało białka: ${f(nm.proteins)} g na ${per}.`);
        if (nm.kcal && nm.kcal > 0) { const share = Math.round(nm.proteins * 4 / nm.kcal * 100); if (share >= 20) add('+', `${share}% energii pochodzi z białka.`); }
      }
    } else if (key === 'cholesterol') {
      limit = lvl('saturated-fat', nm.sat) || 'unknown';
      if (limit === 'high') add('-', `Dużo tłuszczów nasyconych: ${f(nm.sat)} g na ${per} (powyżej ${drink ? '2,5' : '5'} g).`);
      else if (limit === 'mid') add('i', `Średnio tłuszczów nasyconych: ${f(nm.sat)} g na ${per}.`);
      else if (limit === 'low') add('+', 'Mało tłuszczów nasyconych.');
      if (hasWords(txt, WORDS.hydrogenated)) { add('-', 'Tłuszcz utwardzony w składzie.'); limit = 'high'; }
      if (nm.fiber != null && nm.fiber >= 6) add('+', `Dużo błonnika: ${f(nm.fiber)} g na ${per}.`);
      if (hasWords(txt, CHOLESTEROL_PLUS_WORDS)) add('+', 'Zawiera owies lub sterole roślinne. Dla obu UE dopuszcza oświadczenie o obniżaniu cholesterolu, przy odpowiedniej dziennej ilości.');
    } else if (key === 'pressure') {
      const l = lvl('salt', nm.salt);
      limit = l || 'unknown';
      if (l === 'high') add('-', `Dużo soli: ${f(nm.salt)} g na ${per} (powyżej ${drink ? '0,75' : '1,5'} g). WHO zaleca najwyżej 5 g soli dziennie.`);
      else if (l === 'low') add('+', `Mało soli: ${f(nm.salt)} g na ${per}.`);
      else if (l === 'mid') add('i', `Średnio soli: ${f(nm.salt)} g na ${per} (mało to do 0,3 g).`);
    } else if (key === 'digestion') {
      if (nm.fiber != null) {
        if (nm.fiber >= 6) add('+', `Wysoka zawartość błonnika: ${f(nm.fiber)} g na ${per}.`);
        else if (nm.fiber >= 3) add('+', `Źródło błonnika: ${f(nm.fiber)} g na ${per}.`);
        else if (!drink && nm.fiber < 1.5) add('i', `Mało błonnika: ${f(nm.fiber)} g na ${per}.`);
      }
      if (hasWords(txt, WHOLEGRAIN_WORDS)) add('+', 'Pełne ziarno w składzie.');
    } else if (key === 'iron') {
      if (nm.iron != null) {
        const mg = nm.iron * 1000;
        if (mg >= 4.2) add('+', `Wysoka zawartość żelaza: ${f(mg)} mg na ${per}.`);
        else if (mg >= 2.1) add('+', `Źródło żelaza: ${f(mg)} mg na ${per}.`);
        else add('i', `Mało żelaza: ${f(mg)} mg na ${per}.`);
      } else add('i', 'Baza nie podaje zawartości żelaza w tym produkcie.');
      if (hasWords(txt, IRON_FOOD_WORDS)) add('+', 'Zawiera składniki bogate w żelazo (np. wołowinę, rośliny strączkowe, kaszę gryczaną).');
    } else if (key === 'sugar') {
      const l = lvl('sugars', nm.sugars);
      limit = l || 'unknown';
      if (l === 'high') add('-', `Dużo cukru: ${f(nm.sugars)} g na ${per} (powyżej ${drink ? '11,25' : '22,5'} g).`);
      else if (l === 'low') add('+', `Mało cukru: ${f(nm.sugars)} g na ${per}.`);
      else if (l === 'mid') add('i', `Średnio cukru: ${f(nm.sugars)} g na ${per} (mało to do ${drink ? '2,5' : '5'} g).`);
      if (hasWords(txt, { prefix: ['syrop'] })) { add('-', 'Syrop cukrowy w składzie.'); if (limit !== 'high') limit = 'mid'; }
    }
    const verdict = items.some(i => i.sign === '-') ? 'bad' : items.some(i => i.sign === '+') ? 'good' : items.length ? 'neutral' : 'unknown';
    if (!items.length) add('i', 'Za mało danych w bazie, żeby ocenić produkt pod ten cel.');
    return { key, label: GOALS.find(g => g.key === key).label, verdict, items, limit };
  });
}
const GOAL_POINTS = { good: 8, neutral: 0, unknown: 0, bad: -12 };

/* Lista „Dobre dla Ciebie”: produkty z oceną co najmniej „Dobre”, zgodne z profilem, posortowane z uwzględnieniem celów. */
function rankForUser(list, profile) {
  const prof = cleanProfile(profile), hasProfile = profileSize(prof) > 0;
  const seen = new Set(), out = [];
  (list || []).forEach(pr => {
    if (!pr || !pr.code || seen.has(pr.code) || !pr.name) return;
    seen.add(pr.code);
    const an = analyze(pr);
    if (an.score == null || an.parts.length < 2) return;
    const match = matchProfile(pr, an, prof);
    if (hasProfile && (match.status === 'fail' || match.status === 'traces')) return;
    const goals = goalInsights(pr, an, prof.goals);
    const bonus = goals.reduce((s, g) => s + GOAL_POINTS[g.verdict], 0);
    if (an.score < 50) return;
    out.push({ pr, an, match, goals, rank: an.score + bonus });
  });
  return out.sort((a, b) => b.rank - a.rank);
}

/* ===== Porównanie w kategorii i zamienniki ===== */
const MIN_SAMPLE = 5, ALT_MIN_GAIN = 10, ALT_COUNT = 3;
function categoryLabel(prod) {
  if (prod.categoryName) return prod.categoryName;
  return String(prod.category || '').replace(/^[a-z]{2}:/, '').replace(/-/g, ' ');
}
/* candidates: znormalizowane produkty z tej samej kategorii. Zwraca udział gorszych produktów i zamienniki. */
function compareInCategory(prod, an, candidates, profile) {
  const seen = new Set([prod.code]);
  const sample = [];
  // Porównujemy tylko oceny liczone z tych samych danych: jeśli produkt ma Nutri-Score, kandydat też musi go mieć.
  const needNutrition = (an.parts || []).some(x => x.key === 'nutrition');
  (candidates || []).forEach(pr => {
    if (!pr || !pr.code || seen.has(pr.code)) return;
    seen.add(pr.code);
    const a = analyze(pr);
    if (a.score == null) return;
    if (needNutrition && !(a.parts || []).some(x => x.key === 'nutrition')) return;
    sample.push({ pr, an: a, match: matchProfile(pr, a, profile) });
  });
  const res = { sampleSize: sample.length, betterThan: null, alternatives: [], enough: sample.length >= MIN_SAMPLE };
  if (an.score != null && res.enough) res.betterThan = Math.round(100 * sample.filter(x => x.an.score < an.score).length / sample.length);
  const prof = cleanProfile(profile);
  const hasProfile = profileSize(prof) > 0;
  res.alternatives = sample
    .filter(x => x.pr.name && (an.score == null || x.an.score >= an.score + ALT_MIN_GAIN))
    .filter(x => !hasProfile || x.match.status === 'ok' || x.match.status === 'none')
    .sort((a, b) => b.an.score - a.an.score)
    .slice(0, ALT_COUNT)
    .map(x => ({ ...x, gain: an.score == null ? null : x.an.score - an.score }));
  return res;
}

/* Źródła wymienione w opisach dodatków i składników. */
const SOURCES = [
  { key: 'EFSA', re: /EFSA/, label: 'EFSA: dodatki do żywności', url: 'https://www.efsa.europa.eu/en/topics/topic/food-additives' },
  { key: 'IARC', re: /IARC/, label: 'IARC: lista sklasyfikowanych substancji', url: 'https://monographs.iarc.who.int/agents-classified-by-the-iarc/' },
  { key: 'WHO', re: /WHO/, label: 'WHO: wytyczne o słodzikach (2023)', url: 'https://www.who.int/news/item/15-05-2023-who-advises-not-to-use-non-sugar-sweeteners-for-weight-control-in-newly-released-guideline' },
  { key: 'UE', re: /\bUE\b|w UE/, label: 'Rozporządzenie UE 1333/2008 o dodatkach do żywności', url: 'https://eur-lex.europa.eu/eli/reg/2008/1333/oj' }
];
function sourcesFor(items) {
  const text = items.map(i => i.note || '').join(' ');
  return SOURCES.filter(s => s.re.test(text));
}


function plural(n, one, few, many) {
  if (n === 1) return one;
  const t = n % 100, u = n % 10;
  return (u >= 2 && u <= 4 && !(t >= 12 && t <= 14)) ? few : many;
}
function fmtNum(v) { return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: v < 1 ? 2 : 1 }).format(v); }


/* ================= Wersja 1.0: osobiste dopasowanie i działy ================= */

const MATCH_LEVELS = [
  { min: 75, key: 'great', label: 'Bardzo dobre dopasowanie' },
  { min: 50, key: 'good', label: 'Dobre dopasowanie' },
  { min: 25, key: 'poor', label: 'Słabe dopasowanie' },
  { min: 0, key: 'bad', label: 'Raczej nie dla Ciebie' }
];
/* Dopasowanie produktu do osoby.
   - Bez celów i ograniczeń (albo tylko „Po prostu zdrowiej”) to po prostu ogólna ocena składu: personal = false.
   - Cel przesuwa wynik (+8, gdy produkt go wspiera, −12, gdy mu szkodzi).
   - Cel, który coś ogranicza (sól, cukier, tłuszcze nasycone), ustala też górną granicę:
     dużo tego składnika → najwyżej 45% (słabe dopasowanie), średnio → najwyżej 74%, brak danych → najwyżej 70%.
     Dzięki temu produkt z większą ilością soli nigdy nie wypada lepiej niż ten sam produkt z mniejszą.
   - Wykluczenie z profilu (alergen, dieta, „unikam”) → 0–10%, śladowe ilości → najwyżej 35%, brak danych → najwyżej 70%. */
const LIMIT_CAP = { high: 45, mid: 74, unknown: 70 };
function personalMatch(prod, an, profile) {
  const prof = cleanProfile(profile);
  const m = matchProfile(prod, an, prof);
  const goals = goalInsights(prod, an, prof.goals);
  const personal = goals.length > 0 || m.checked > 0;
  // Ocena z samych dodatków (bez wartości odżywczych i przetworzenia) to za mało na werdykt.
  const onlyAdditives = an && an.parts && an.parts.length === 1 && an.parts[0].key === 'additives';
  const score = an && an.score != null && isFinite(an.score) && !onlyAdditives ? an.score : null;
  if (!personal) {
    const lv = score == null ? { key: 'unknown', label: 'Za mało danych' } : MATCH_LEVELS.find(l => score >= l.min);
    return { pct: score, level: lv.key, label: score == null ? lv.label : grade(score).label, good: score == null ? null : score >= 50, personal: false, general: prof.goals.includes('healthy'), status: m.status, match: m, goals, rows: [], cap: null };
  }
  const rows = [];
  let cap = 100, capBy = null;
  goals.forEach(g => {
    const first = (g.items.find(i => i.sign === '-') || g.items.find(i => i.sign !== 'i') || g.items[0] || {}).text || '';
    const kind = g.verdict === 'good' ? 'good' : g.verdict === 'bad' ? 'bad' : 'info';
    const c = LIMIT_CAP[g.limit];
    let text = first;
    if (c != null && c < cap) { cap = c; capBy = g.key; }
    if (g.limit === 'high') text += ` Przy tym celu dopasowanie wynosi najwyżej ${LIMIT_CAP.high}%.`;
    else if (g.limit === 'mid') text += ' „Bardzo dobre dopasowanie” tylko przy małej ilości.';
    rows.push({ kind, goal: g.key, title: 'Cel: ' + (GOAL_TILES[g.key] ? GOAL_TILES[g.key].label.toLowerCase() : g.label), text });
  });
  m.fails.forEach(f => rows.push({ kind: 'bad', title: f.label, text: f.why }));
  if (m.traces.length) rows.push({ kind: 'warn', title: 'Może zawierać: ' + m.traces.join(', '), text: 'śladowe ilości według producenta' });
  if (m.checked && m.status === 'ok') rows.push({ kind: 'good', title: 'Zgodne z Twoimi ograniczeniami', text: '' });
  if (m.unknowns.length) rows.push({ kind: 'info', title: 'Nie wiemy: ' + m.unknowns.join(', '), text: 'brak danych w bazie, sprawdź etykietę' });
  let pct = null, level;
  if (m.status === 'fail') pct = score == null ? 5 : Math.round(score / 10);
  else if (score != null) {
    pct = score + goals.reduce((s, g) => s + GOAL_POINTS[g.verdict], 0);
    if (m.status === 'traces') cap = Math.min(cap, 35);
    if (m.status === 'unknown') cap = Math.min(cap, LIMIT_CAP.unknown);
    pct = Math.max(0, Math.min(cap, 100, Math.round(pct)));
  }
  if (pct == null) level = { key: 'unknown', label: 'Za mało danych' };
  else level = MATCH_LEVELS.find(l => pct >= l.min);
  return { pct, level: level.key, label: level.label, good: pct == null ? null : pct >= 50, personal: true, general: false, status: m.status, match: m, goals, rows, cap: cap < 100 ? cap : null, capBy };
}

/* Dział sklepu dla produktu z bazy albo wpisanej ręcznie rzeczy. */
function departmentFor(item) {
  const cats = Array.isArray(item && item.categories) ? item.categories : [];
  for (const d of DEPARTMENTS) if (d.tags.some(t => cats.includes(t))) return d.key;
  const name = ' ' + fold((item && item.name) || '') + ' ';
  // 3.0.16: napoje roślinne („mleko owsiane/sojowe/migdałowe/ryżowe/kokosowe”) to nie nabiał – dział „Napoje”, zanim „mleko” trafi do Nabiału.
  if (/ (mleko|mleczko|napoj|napoje|drink) (owsian|sojow|migdal|ryzow|kokos|roslin|orzech|grochow|konopn|z owsa|z soi|z migdal|z ryzu)/.test(name)) return 'drinks';
  // „sok pomarańczowy”, „nektar jabłkowy”: nazwa owocu nie przenosi napoju do warzyw i owoców.
  if (/ (sok|soki|soczek|nektar|nektary) /.test(name)) return 'drinks';
  for (const d of DEPARTMENTS) if (d.words.some(w => name.includes(w.length <= 3 ? ' ' + w : w))) return d.key;
  return 'other';
}

/* 3.0.14: produkty z kopii kategorii, które pasują do nazwy kafla (CAT_LIST_FILTER w data.js). Bez reguły – lista bez zmian. */
function catListFilter(key, list) {
  const f = CAT_LIST_FILTER[key];
  if (!f || !Array.isArray(list)) return list;
  return list.filter(pr => {
    const cats = Array.isArray(pr && pr.categories) ? pr.categories : [];
    if (f.tags.some(t => cats.includes(t))) return false;
    const name = ' ' + fold(pr && pr.name).replace(/[^a-z0-9]+/g, ' ') + ' ';
    return !f.words.some(w => name.includes(w));
  });
}

/* ===================== Wersja D: profil „Nie jem” + „Pilnuję” =====================
   Te deklaracje zastępują wcześniejsze o tej samej nazwie (cleanProfile, personalMatch, rankForUser). */
function cleanProfile(p) {
  const out = { allergens: [], diet: [], avoid: [], cosmetic: [], custom: [], goals: [], watch: [], noScores: false };
  if (!p || typeof p !== 'object') return out;
  if (Array.isArray(p.goals)) { const ok = new Set(GOALS.map(g => g.key)); out.goals = [...new Set(p.goals.filter(g => ok.has(g)))].slice(0, GOALS_MAX); }
  if (Array.isArray(p.watch)) { const ok = new Set(WATCH.map(w => w.key)); out.watch = [...new Set(p.watch.filter(w => ok.has(w)))].slice(0, WATCH_MAX); }
  if (Array.isArray(p.custom)) {
    const seen = new Set();
    p.custom.forEach(c => { const v = cleanCustom(c); if (v && !seen.has(fold(v))) { seen.add(fold(v)); out.custom.push(v); } });
    out.custom = out.custom.slice(0, CUSTOM_MAX);
  }
  for (const g of ['allergens', 'diet', 'avoid', 'cosmetic']) {
    const allowed = new Set(PROFILE_OPTIONS[g].map(o => o.key));
    out[g] = Array.isArray(p[g]) ? [...new Set(p[g].filter(k => allowed.has(k)))] : [];
  }
  out.noScores = p.noScores === true;
  return out;
}
/* Pozycje „Pilnuję” wynikające z celów (bez powtórzeń, w kolejności listy WATCH). */
function watchFromGoals(goals) {
  const set = new Set(); (goals || []).forEach(g => { const x = GOALS.find(y => y.key === g); if (x) x.watch.forEach(w => set.add(w)); });
  return WATCH.map(w => w.key).filter(k => set.has(k));
}
/* Przeniesienie ustawień z głównej aplikacji (stare cele, diety i „unikam”) do nowego profilu. */
function migrateProfileD(old) {
  const o = old && typeof old === 'object' ? old : {};
  const has = (g, k) => Array.isArray(o[g]) && o[g].includes(k);
  const goalMap = { weight: 'weight', muscle: 'muscle', cholesterol: 'heart', pressure: 'pressure', digestion: 'digestion', sugar: 'sugar', healthy: 'healthy' };
  const goals = [...new Set((Array.isArray(o.goals) ? o.goals : []).map(g => goalMap[g]).filter(Boolean))];
  const watch = new Set(watchFromGoals(goals));
  const add = (cond, ...keys) => { if (cond) keys.forEach(k => watch.add(k)); };
  add(has('diet', 'lowsodium'), 'salt'); add(has('diet', 'lowcarb'), 'sugar'); add(has('diet', 'diabetes'), 'sugar'); add(has('diet', 'cardio'), 'satfat', 'salt');
  add(has('diet', 'mediterranean') || has('diet', 'lightdiet'), 'processing');
  add(has('avoid', 'salt'), 'salt'); add(has('avoid', 'satfat') || has('avoid', 'hydrogenated'), 'satfat'); add(has('avoid', 'sugar') || has('avoid', 'kidsugar'), 'sugar');
  add(has('avoid', 'palm'), 'palm'); add(has('avoid', 'sweeteners'), 'sweeteners'); add(has('avoid', 'caffeine'), 'caffeine');
  add(has('avoid', 'nitrites') || has('avoid', 'controversial') || has('avoid', 'ultra'), 'processing');
  return cleanProfile({ allergens: o.allergens, diet: o.diet, avoid: o.avoid, cosmetic: o.cosmetic, custom: o.custom, noScores: o.noScores, goals, watch: WATCH.map(w => w.key).filter(k => watch.has(k)) });
}
const WATCH_FX = { limit: { low: 5, mid: -10, high: -25 }, contains: { yes: -25, no: 0 }, more: { high: 10, mid: 5, low: 0 } };
const WATCH_CAP = { mid: 74, high: 45, unknown: 70, yes: 45 };
const WATCH_WORD = { limit: { low: 'mało', mid: 'średnio', high: 'dużo' }, contains: { yes: 'zawiera', no: 'nie zawiera' }, more: { high: 'dużo', mid: 'źródło', low: 'mało' } };
const KCAL_T = { food: [150, 400], drink: [20, 40] };
const MATCH_FLOOR = 12;
/* Każda pozycja „Pilnuję” liczona jedną zasadą. Zwraca poziom, słowo, wartość, zmianę punktów i ewentualny limit. */
function watchInsights(prod, an, watch) {
  if (!prod || prod.kind === 'cosmetic') return [];
  const nm = prod.nutriments || {}, drink = !!prod.drink, per = drink ? '100 ml' : '100 g';
  const f = v => String(Math.round(v * 10) / 10).replace('.', ',');
  // 3.0.19: wartość wyliczona z innych (prod.nutriDerived) – mówimy to wprost: „najwyżej 1 g na 100 g, wyliczone: tłuszcz 1 g”.
  const dv = prod.nutriDerived || {}, gv = (dk, v) => { const d = dv[dk]; return `${d && d.kind === 'max' ? 'najwyżej ' : ''}${f(v)} g na ${per}${d ? ', wyliczone: ' + d.from : ''}`; };
  const ing = String(prod.ingredients || ''), hasIng = ing.trim().length > 0, txt = cleanForMatch(ing), folded = fold(ing);
  const analysis = new Set(prod.analysis || []), codes = new Set(((an && an.additives) || []).map(a => a.code));
  const adds = (an && an.additives) || [];
  return (watch || []).map(key => {
    const w = WATCH.find(x => x.key === key); if (!w) return null;
    let level = null, value = '', note = '';
    if (key === 'sugar') {
      level = nutrientLevel('sugars', nm.sugars, drink); if (nm.sugars != null) value = gv('sugars', nm.sugars);
      if (level === 'low' && folded.includes('syrop')) { level = 'mid'; note = 'syrop w składzie'; }
    } else if (key === 'salt') {
      level = nutrientLevel('salt', nm.salt, drink); if (nm.salt != null) value = gv('salt', nm.salt);
    } else if (key === 'satfat') {
      level = nutrientLevel('saturated-fat', nm.sat, drink); if (nm.sat != null) value = gv('sat', nm.sat);
      if (hasWords(txt, WORDS.hydrogenated)) { level = 'high'; note = 'tłuszcz utwardzony w składzie'; }
    } else if (key === 'kcal') {
      if (nm.kcal != null) { const [lo, hi] = KCAL_T[drink ? 'drink' : 'food']; level = nm.kcal <= lo ? 'low' : nm.kcal > hi ? 'high' : 'mid'; value = `${Math.round(nm.kcal)} kcal na ${per}`; }
    } else if (key === 'processing') {
      const nova = Number(prod.nova), bad = adds.filter(a => a.level >= 2), some = adds.filter(a => a.level === 1);
      if (nova === 4 || bad.length) { level = 'high'; value = [nova === 4 ? 'NOVA 4' : '', bad.map(a => a.code).slice(0, 3).join(', ')].filter(Boolean).join(', '); }
      else if (nova === 3 || some.length) { level = 'mid'; value = nova === 3 ? 'NOVA 3' : some.map(a => a.code).slice(0, 3).join(', '); }
      else if (nova === 1 || nova === 2) { level = 'low'; value = 'NOVA ' + nova; }
      else if (an && an.additivesKnown) { level = adds.length ? 'mid' : 'low'; value = adds.length ? adds.map(a => a.code).slice(0, 3).join(', ') : 'bez dodatków'; }
    } else if (key === 'palm') {
      if (analysis.has('en:palm-oil') || txt.includes(fold('palmow')) || txt.includes('palm ')) level = 'yes';
      else if (hasIng || analysis.has('en:palm-oil-free')) level = 'no';
    } else if (key === 'sweeteners') {
      const found = SWEETENER_CODES.filter(c => codes.has(c));
      if (found.length) { level = 'yes'; value = found.join(', '); } else if (an && an.additivesKnown) level = 'no';
    } else if (key === 'caffeine') {
      if (hasWords(txt, WORDS.caffeine)) level = 'yes'; else if (hasIng) level = 'no';
    } else if (key === 'protein' || key === 'fiber') {
      const v = key === 'protein' ? nm.proteins : nm.fiber, [mid, high] = key === 'protein' ? [5, 10] : [3, 6];
      if (v != null) { level = v >= high ? 'high' : v >= mid ? 'mid' : 'low'; value = `${f(v)} g na ${per}`; }
    }
    const fx = WATCH_FX[w.kind];
    const delta = level == null ? 0 : fx[level];
    const cap = level == null ? (w.kind === 'more' ? null : WATCH_CAP.unknown) : (w.kind === 'limit' && WATCH_CAP[level] != null ? WATCH_CAP[level] : w.kind === 'contains' && level === 'yes' ? WATCH_CAP.yes : null);
    const word = level == null ? 'brak danych' : WATCH_WORD[w.kind][level];
    return { key, label: w.label, kind: w.kind, icon: w.icon, level, word, value, note, delta, cap };
  }).filter(Boolean);
}
function personalMatch(prod, an, profile) {
  const prof = cleanProfile(profile);
  const m = matchProfile(prod, an, prof);
  const w = watchInsights(prod, an, prof.watch);
  const personal = w.length > 0 || m.checked > 0;
  const onlyAdditives = an && an.parts && an.parts.length === 1 && an.parts[0].key === 'additives';
  const score = an && an.score != null && isFinite(an.score) && !onlyAdditives ? an.score : null;
  if (!personal) {
    const lv = score == null ? { key: 'unknown', label: 'Za mało danych' } : MATCH_LEVELS.find(l => score >= l.min);
    return { pct: score, level: lv.key, label: score == null ? lv.label : grade(score).label, good: score == null ? null : score >= 50, personal: false, general: prof.goals.includes('healthy'), status: m.status, match: m, goals: [], watch: [], rows: [], cap: null, base: score };
  }
  const rows = [];
  let cap = 100, capBy = null, sum = 0;
  const setCap = (c, why) => { if (c != null && c < cap) { cap = c; capBy = why; } };
  w.forEach(x => {
    const kind = x.delta > 0 ? 'good' : x.delta < 0 ? 'bad' : x.level == null ? 'info' : 'neutral';
    rows.push({ kind, watch: x.key, icon: x.icon, title: x.label, word: x.word, value: x.value, text: x.note, delta: x.level == null ? null : x.delta, cap: x.cap });
    sum += x.delta;
    setCap(x.cap, `${x.label.replace(' (więcej)', '')}: ${x.word}`);
  });
  m.fails.forEach(f => rows.push({ kind: 'bad', exclude: true, title: f.label, word: 'nie pasuje', value: f.why && f.why !== 'zawiera' ? f.why : 'zawiera', text: '', delta: null }));
  if (m.traces.length) { rows.push({ kind: 'warn', exclude: true, title: 'Może zawierać: ' + m.traces.join(', '), word: 'śladowe ilości', value: '', text: '', delta: null, cap: 35 }); setCap(35, 'śladowe ilości'); }
  if (m.checked && m.status === 'ok') rows.push({ kind: 'good', exclude: true, title: 'Nie jem', word: 'pasuje', value: 'nie zawiera niczego z Twojej listy', text: '', delta: null });
  if (m.unknowns.length) { rows.push({ kind: 'info', exclude: true, title: 'Nie wiemy: ' + m.unknowns.join(', ').toLowerCase(), word: 'brak danych', value: '', text: 'sprawdź etykietę', delta: null, cap: LIMIT_CAP.unknown }); setCap(LIMIT_CAP.unknown, 'brak danych o składzie'); }
  let pct = null, level;
  if (m.status === 'fail') { pct = score == null ? 5 : Math.round(score / 10); capBy = 'zawiera coś, czego nie jesz'; cap = 10; }
  // Produkt, który tylko „pilnujesz”, zawsze wypada lepiej niż ten, którego „nie jesz” (0–10%).
  else if (score != null) pct = Math.max(MATCH_FLOOR, Math.min(cap, 100, Math.round(score + sum)));
  if (pct == null) level = { key: 'unknown', label: 'Za mało danych' };
  else level = MATCH_LEVELS.find(l => pct >= l.min);
  return { pct, level: level.key, label: level.label, good: pct == null ? null : pct >= 50, personal: true, general: false, status: m.status, match: m, goals: [], watch: w, rows, cap: cap < 100 ? cap : null, capBy, base: score, sum, capped: score != null && m.status !== 'fail' && pct < Math.round(score + sum) };
}
function rankForUser(list, profile) {
  const prof = cleanProfile(profile), hasProfile = profileSize(prof) > 0;
  const seen = new Set(), out = [];
  (list || []).forEach(pr => {
    if (!pr || !pr.code || seen.has(pr.code) || !pr.name) return;
    seen.add(pr.code);
    const an = analyze(pr);
    if (an.score == null || an.parts.length < 2) return;
    const pm = personalMatch(pr, an, prof);
    if (hasProfile && (pm.status === 'fail' || pm.status === 'traces')) return;
    if (an.score < 50) return;
    out.push({ pr, an, match: pm.match, goals: [], rank: pm.pct == null ? an.score : pm.pct });
  });
  return out.sort((a, b) => b.rank - a.rank);
}

if (typeof module !== 'undefined' && typeof document === 'undefined') {
  module.exports = { estimateNutriScore, beverageNutriScore, isDairyDrink, LIMIT_CAP, goalInsights, rankForUser, customProblem, cleanCustom, customMatcher, cleanForMatch, compareInCategory, categoryLabel, matchProfile, cleanProfile, additiveKeyFromTag, additivesFromTags, additivesFromText, watchFromText, foodScore, additivesScore, inciAnalyze, cosmeticScore, grade, nutrientLevel, validBarcode, normalizeProduct, analyze, isSimpleFood, additiveEffect, CAP_CODES, explain, sourcesFor, personalMatch, departmentFor, plural, fmtNum, fold, MATCH_LEVELS };
}
