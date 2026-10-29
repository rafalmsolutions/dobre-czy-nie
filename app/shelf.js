/* Dobre czy nie? – półki zakupowe (listy zakupów ułożone według działów sklepu).
   Czyste funkcje: dostają stan, zwracają nowy stan i wynik. Wymaga data.js (DEPARTMENTS) i core.js (departmentFor, fold). */
'use strict';

const Shelf = (() => {
  const FREE_LIMIT = 3, MAX_ITEMS = 200, MAX_NAME = 60, MAX_SHELF_NAME = 30;
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const key = v => fold(clean(v, MAX_NAME));
  const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
  // Ilość: liczba + jednostka (sztuki, waga, pojemność). Domyślnie 1 szt.
  const UNITS = ['szt', 'g', 'kg', 'ml', 'l'];
  const cleanQty = q => { const n = typeof q === 'number' ? q : parseFloat(String(q == null ? '' : q).replace(',', '.')); return isFinite(n) && n > 0 ? Math.min(9999, Math.round(n * 1000) / 1000) : 1; };
  const cleanUnit = u => UNITS.includes(u) ? u : 'szt';
  const FAM_T = ['ok', 'mid', 'bad', 'unk'];
  // Odpowiedź dla rodziny zapamiętana przy produkcie (np. { t: 'bad', h: 'Nie dla Kuby' }); null, gdy bez domowników.
  const cleanFam = f => isObj(f) && FAM_T.includes(f.t) ? { t: f.t, h: clean(f.h, 60) } : null;
  /* „2 kg ziemniaki”, „ziemniaki 2kg”, „mleko 2 l”, „3 jogurty” → nazwa + ilość. */
  function parseQty(text) {
    const t = clean(text, MAX_NAME + 12);
    let m = t.match(/^(\d+(?:[.,]\d+)?)\s*(szt|kg|g|ml|l)?\.?\s+(.+)$/i);
    if (m) return { name: m[3], qty: cleanQty(m[1]), unit: cleanUnit((m[2] || 'szt').toLowerCase()) };
    m = t.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(szt|kg|g|ml|l)\.?$/i);
    if (m) return { name: m[1], qty: cleanQty(m[2]), unit: cleanUnit(m[3].toLowerCase()) };
    return { name: t, qty: 1, unit: 'szt' };
  }
  /* Dyktowanie (2.8.0): „mleko, chleb i dwa jogurty” → pozycje z ilością. Liczebniki słownie 1–10 (i „pół”) na początku
     zamieniamy na cyfry, mówione jednostki („kilo”, „litry”, „gramów”) na skróty; resztę robi parseQty, jak przy wpisywaniu. */
  const NUM = { jeden: 1, jedna: 1, jedno: 1, dwa: 2, dwie: 2, trzy: 3, cztery: 4, piec: 5, szesc: 6, siedem: 7, osiem: 8, dziewiec: 9, dziesiec: 10, pol: 0.5 };
  const SPOKEN_UNIT = [[/^(kilo|kilogram\w*)$/, 'kg'], [/^(litr\w*)$/, 'l'], [/^(gram\w*|deko\w*)$/, 'g'], [/^(mililitr\w*)$/, 'ml'], [/^(sztuk\w*)$/, 'szt']];
  /* 2.8.2: rozpoznawanie mowy zwykle nie wstawia przecinków („pomidory ziemniaki banany”). Nową pozycję zaczyna wtedy słowo,
     które jest nazwą produktu (rdzeń ze słownika poniżej i z działów sklepu), gdy bieżąca pozycja ma już swój produkt.
     Nie dzielimy po przyimku („pasta do zębów”, „sok z pomarańczy”) ani przed przymiotnikiem („masło orzechowe”, „chleb żytni”). */
  const NOUNS = ['marchew', 'ziemniak', 'pomidor', 'ogor', 'ogorek', 'cebul', 'czosn', 'jablk', 'jablek', 'banan', 'grusz', 'cytryn', 'limonk', 'pomarancz', 'salat', 'kapust', 'papryk', 'brokul', 'kalafior', 'pietrusz', 'seler', 'burak',
    'owoc', 'warzyw', 'winogr', 'truskaw', 'malin', 'borowk', 'jagod', 'awokado', 'kiwi', 'mandaryn', 'grzyb', 'pieczark', 'rzodkiew', 'szpinak', 'cukini', 'dyni', 'dynia', 'arbuz', 'melon', 'sliwk', 'czeresn', 'wisni', 'brzoskwin', 'morel', 'ananas', 'mango',
    'imbir', 'koper', 'szczypior', 'natk', 'rukol', 'kukurydz', 'groszek', 'fasolk', 'chleb', 'bulk', 'bulecz', 'bagiet', 'rogal', 'pieczyw', 'tortill', 'grahamk', 'kajzerk', 'drozdzowk', 'paczk', 'paczek', 'ciast',
    'mleko', 'mleka', 'jogurt', 'kefir', 'maslank', 'ser', 'sery', 'serek', 'serk', 'twarog', 'twarozek', 'smietan', 'maslo', 'masla', 'margaryn', 'jaja', 'jajk', 'jajek', 'skyr', 'mozzarell', 'feta', 'parmezan',
    'mieso', 'miesa', 'kurczak', 'indyk', 'wolowin', 'wieprzowin', 'schab', 'karkowk', 'szynk', 'kielbas', 'parowk', 'boczek', 'boczk', 'salami', 'kabanos', 'poledwic', 'ryba', 'ryby', 'losos', 'dorsz', 'tunczyk', 'sledz', 'krewet', 'pasztet', 'filet', 'piers', 'udk', 'skrzydel',
    'lody', 'pierog', 'pizz', 'makaron', 'ryz', 'kasz', 'maka', 'maki', 'cukier', 'cukru', 'sol', 'olej', 'oliw', 'ocet', 'przypraw', 'pieprz', 'sos', 'ketchup', 'musztard', 'majonez', 'chrzan', 'konserw', 'fasol', 'ciecierzyc', 'soczewic', 'groch', 'koncentrat', 'passat', 'drozdz',
    'platki', 'platk', 'musli', 'granol', 'owsiank', 'dzem', 'miod', 'nutell', 'krem', 'pasta', 'paste', 'chips', 'czips', 'paluszk', 'precl', 'wafl', 'wafel', 'ciastk', 'herbatnik', 'czekolad', 'baton', 'cukierk', 'zelk', 'orzeszk', 'orzech', 'krakers', 'popcorn', 'chrupk',
    'woda', 'wody', 'wode', 'sok', 'soki', 'napoj', 'cola', 'kawa', 'kawe', 'kawy', 'herbat', 'kakao', 'piwo', 'piwa', 'wino', 'wina', 'lemoniad', 'bulion', 'zupa', 'zupe',
    'papier', 'recznik', 'proszek', 'plyn', 'mydlo', 'szampon', 'odzywk', 'dezodorant', 'gabk', 'worki', 'workow', 'folia', 'folie', 'chusteczk', 'pieluch', 'kapsulk', 'tabletk', 'zapalk', 'baterie', 'zarowk'];
  const NOUN_SET = [...new Set(NOUNS)].sort((x, y) => y.length - x.length);
  // Przymiotnik: końcówka po rdzeniu („orzech” + „owe”). Odmiana rzeczownika („makaron” + „y”) zostaje rzeczownikiem.
  const ADJ = /(ow[yaei]|owych|owej|owym|owego|[cs]ki|[cs]kie|[cs]ka|aln[yae]|czn[yae]|tni[e]?|ist[yae]|ysty|yste|owan[yae]|on[yae]|czan[yae]|ian[yae]|n[yae]|ow)$/;
  const PREP = new Set(['z', 'ze', 'w', 'we', 'do', 'na', 'bez', 'od', 'dla', 'po', 'o', 'pod', 'typu', 'albo', 'lub']);
  const UNIT_W = /^(kg|g|ml|l|szt|kilo|kilogram\w*|litr\w*|gram\w*|deko\w*|mililitr\w*|sztuk\w*|opakowan\w*|paczk[aiey]|puszk[aiey]|butelk[aiey]|kostk[aiey]|sloik\w*|karton\w*)$/;
  const isNum = w => /^\d+(?:[.,]\d+)?$/.test(w) || NUM[fold(w)] != null;
  const isNoun = w => { const f = fold(w); return NOUN_SET.some(s => f.startsWith(s) && (f.length - s.length <= (s.length <= 3 ? 2 : 3)) && !(f.length - s.length >= 2 && ADJ.test(f))); };
  const FILLER = /^(?:jeszcze|tez|no|yyy+|eee+|i|a|potem|oraz|takze)\s+/i;
  // Ilość po nazwie („mleko 2 litry”, „jajka 10 sztuk”) należy do poprzedniej rzeczy, chyba że po jednostce jest dopełniacz
  // („2 kilo ziemniaków”, „litr mleka”) – wtedy to ilość następnej.
  const GEN = /(a|y|i|ow|ek|ich|ych)$/;
  function splitWords(part) {
    const ws = part.split(' '), out = []; let cur = [], hasNoun = false, force = false;
    ws.forEach((w, n) => {
      const prev = ws[n - 1] ? fold(ws[n - 1]) : '';
      const afterLink = PREP.has(prev) || (prev && (isNum(ws[n - 1]) || UNIT_W.test(prev)));
      let startsNew = cur.length && hasNoun && (force || (!afterLink && (isNum(w) || isNoun(w))));
      if (startsNew && !force && isNum(w) && ws[n + 1] && UNIT_W.test(fold(ws[n + 1]))) {
        const nx = ws[n + 2] ? fold(ws[n + 2]) : '';
        if (!nx || isNum(ws[n + 2]) || !GEN.test(nx)) { startsNew = false; cur.push(w, ws[n + 1]); ws[n + 1] = null; force = true; return; }
      }
      if (w === null) return;
      if (startsNew) { out.push(cur.join(' ')); cur = []; hasNoun = false; force = false; }
      cur.push(w); if (isNoun(w)) hasNoun = true;
    });
    if (cur.length) out.push(cur.join(' '));
    return out;
  }
  function splitSpeech(text) {
    const parts = clean(text, 600).split(/\s*(?:;|(?<!\d)[,.]|[,.](?!\d))\s*|\s+(?:a\s+także|a\s+takze|oraz|i|przecinek|kropka|średnik|srednik|potem|następnie|nastepnie|plus|jeszcze|też|tez)\s+/i)
      .map(p => { let t = p.trim(); while (FILLER.test(t)) t = t.replace(FILLER, ''); return t.replace(/\s+(?:przecinek|kropka)$/i, ''); }).filter(Boolean).flatMap(splitWords);
    return parts.map(p => {
      const w = p.split(' ');
      // Liczebnik na początku albo przed jednostką/na końcu („mleko dwa litry”, „jogurt trzy”) → cyfra; mówiona jednostka → skrót.
      for (let k = 0; k < w.length; k++) {
        const n = NUM[fold(w[k])];
        if (n != null && w.length > 1 && (k === 0 || k === w.length - 1 || (w[k + 1] && UNIT_W.test(fold(w[k + 1]))))) w[k] = String(n);
        if (/^\d+(?:[.,]\d+)?$/.test(w[k]) && w[k + 1]) {
          const f = fold(w[k + 1]), u = SPOKEN_UNIT.find(([re]) => re.test(f));
          if (u) { if (/^deko/.test(f)) w[k] = String(parseFloat(w[k].replace(',', '.')) * 10); w[k + 1] = u[1]; if (k === 0 && (w[k + 2] === 'po' || w[k + 2] === 'z')) w.splice(k + 2, 1); }
        }
      }
      const textN = w.join(' ').slice(0, MAX_NAME + 12), q = parseQty(textN);
      return { text: textN, name: clean(q.name, MAX_NAME), qty: q.qty, unit: q.unit };
    }).filter(x => x.name && !/^(przecinek|kropka|i|oraz)$/i.test(x.name));
  }
  /* Zamiana ogólnej pozycji (2.8.0): pierwsza nieodhaczona rzecz bez kodu, której nazwa zaczyna słowo w nazwie produktu
     („mleko” → „Mleko 2%”, „jogurty” → „Jogurt naturalny”) albo której kategoria (zgadnięta z nazwy) jest kategorią produktu. */
  const words = s => fold(s).replace(/[^a-z0-9]+/g, ' ').trim();
  function findGeneric(sh, prod, guess) {
    if (!sh || !prod) return null;
    const pn = ' ' + words(prod.name) + ' ', cats = prod.categories || [];
    return sh.items.find(i => {
      if (i.code || i.checked) return false;
      const n = words(i.name); if (!n) return false;
      if (pn.includes(' ' + n)) return true;
      if (!n.includes(' ') && n.length >= 5 && pn.includes(' ' + n.slice(0, Math.max(4, n.length - 2)))) return true;
      const g = guess ? guess(i.name) : ''; return !!(g && cats.includes(g));
    }) || null;
  }
  /* Podmienia rzecz na produkt w tym samym miejscu listy (ta sama ilość, kolejność), od razu „w koszyku”. */
  function replaceItem(st, shelfId, itemId, prod) {
    const s = copy(st), sh = find(s, shelfId), idx = sh ? sh.items.findIndex(i => i.id === itemId) : -1;
    if (idx < 0) return { state: st, error: 'missing' };
    const old = sh.items[idx], code = prod.code && /^\d{6,14}$/.test(String(prod.code)) ? String(prod.code) : null;
    if (!code) return { state: st, error: 'code' };
    if (sh.items.some(i => i.code === code)) return { state: st, error: 'duplicate' };
    const name = clean(prod.name, MAX_NAME) || 'Produkt ' + code;
    const it = { id: uid(), name, code, pct: typeof prod.pct === 'number' && isFinite(prod.pct) ? Math.max(0, Math.min(100, Math.round(prod.pct))) : null,
      dept: departmentFor({ name, categories: prod.categories }), checked: true, checkedAt: Date.now(), qty: old.qty, unit: old.unit, fam: cleanFam(prod.fam), added: old.added };
    sh.items[idx] = it;
    return { state: s, item: it, old: JSON.parse(JSON.stringify(old)), completed: isComplete(sh) };
  }
  /* Cofnięcie zamiany: wraca dawna rzecz (nieodhaczona) w to samo miejsce, produkt znika. */
  function undoReplace(st, shelfId, newId, old) {
    const s = copy(st), sh = find(s, shelfId); if (!sh) return { state: st, error: 'missing' };
    const idx = sh.items.findIndex(i => i.id === newId), back = Object.assign({}, old, { checked: false });
    if (idx >= 0) sh.items[idx] = back; else if (!sh.items.some(i => i.id === old.id)) sh.items.push(back);
    return { state: s, item: back };
  }
  const fmtQty = it => { const q = String(it.qty).replace('.', ','); return it.unit === 'szt' ? `${q} szt.` : `${q} ${it.unit}`; };

  function newShelf(name) { return { id: uid(), name: clean(name, MAX_SHELF_NAME) || 'Zakupy', items: [], created: Date.now() }; }
  function newState() { const s = newShelf('Tygodniowe'); return { v: 1, active: s.id, shelves: [s] }; }

  function load(raw) {
    if (!isObj(raw) || raw.v !== 1 || !Array.isArray(raw.shelves)) return newState();
    const shelves = raw.shelves.filter(isObj).slice(0, 20).map(sh => ({
      id: typeof sh.id === 'string' && sh.id ? sh.id : uid(),
      name: clean(sh.name, MAX_SHELF_NAME) || 'Zakupy',
      created: typeof sh.created === 'number' ? sh.created : Date.now(),
      items: (Array.isArray(sh.items) ? sh.items : []).filter(isObj).map(it => ({
        id: typeof it.id === 'string' && it.id ? it.id : uid(),
        name: clean(it.name, MAX_NAME),
        code: typeof it.code === 'string' && /^\d{6,14}$/.test(it.code) ? it.code : null,
        pct: typeof it.pct === 'number' && it.pct >= 0 && it.pct <= 100 ? Math.round(it.pct) : null,
        dept: DEPARTMENTS.some(d => d.key === it.dept) ? it.dept : 'other',
        checked: it.checked === true, checkedAt: it.checked === true && typeof it.checkedAt === 'number' ? it.checkedAt : null,
        qty: cleanQty(it.qty), unit: cleanUnit(it.unit), fam: cleanFam(it.fam),
        added: typeof it.added === 'number' ? it.added : Date.now()
      })).filter(it => it.name).slice(0, MAX_ITEMS)
    }));
    if (!shelves.length) return newState();
    const active = shelves.some(s => s.id === raw.active) ? raw.active : shelves[0].id;
    return { v: 1, active, shelves };
  }
  const copy = st => JSON.parse(JSON.stringify(st));
  const find = (st, id) => st.shelves.find(s => s.id === id);

  function addShelf(st, name, limit = FREE_LIMIT) {
    if (st.shelves.length >= limit) return { state: st, error: 'limit' };
    const nm = clean(name, MAX_SHELF_NAME);
    if (!nm) return { state: st, error: 'name' };
    if (st.shelves.some(s => key(s.name) === key(nm))) return { state: st, error: 'duplicate' };
    const s = copy(st), sh = newShelf(nm);
    s.shelves.push(sh); s.active = sh.id;
    return { state: s, shelf: sh };
  }
  function renameShelf(st, id, name) {
    const nm = clean(name, MAX_SHELF_NAME);
    if (!nm) return { state: st, error: 'name' };
    if (st.shelves.some(s => s.id !== id && key(s.name) === key(nm))) return { state: st, error: 'duplicate' };
    const s = copy(st), sh = find(s, id);
    if (!sh) return { state: st, error: 'missing' };
    sh.name = nm;
    return { state: s };
  }
  function deleteShelf(st, id) {
    const s = copy(st);
    s.shelves = s.shelves.filter(x => x.id !== id);
    if (!s.shelves.length) s.shelves.push(newShelf('Zakupy'));
    if (!find(s, s.active)) s.active = s.shelves[0].id;
    return { state: s };
  }
  function setActive(st, id) { if (!find(st, id)) return { state: st }; const s = copy(st); s.active = id; return { state: s }; }

  /* Dodanie rzeczy: z bazy (code, pct, categories) albo wpisanej ręcznie (sama nazwa). */
  function addItem(st, shelfId, item) {
    // Wpisane ręcznie: ilość z tekstu („2 kg ziemniaki”), chyba że podano ją osobno.
    if (item && !item.code && item.qty == null) item = Object.assign({}, item, parseQty(item.name));
    const name = clean(item && item.name, MAX_NAME);
    if (!name) return { state: st, error: 'name' };
    const s = copy(st), sh = find(s, shelfId || s.active);
    if (!sh) return { state: st, error: 'missing' };
    const code = item.code && /^\d{6,14}$/.test(String(item.code)) ? String(item.code) : null;
    const dup = sh.items.find(i => (code && i.code === code) || (!code && !i.code && key(i.name) === key(name)));
    if (dup) {
      if (dup.checked) { dup.checked = false; return { state: s, item: dup, restored: true }; }
      return { state: st, error: 'duplicate', item: dup };
    }
    if (sh.items.length >= MAX_ITEMS) return { state: st, error: 'full' };
    const it = {
      id: uid(), name, code,
      pct: typeof item.pct === 'number' && isFinite(item.pct) ? Math.max(0, Math.min(100, Math.round(item.pct))) : null,
      dept: departmentFor({ name, categories: item.categories }), checked: false,
      qty: cleanQty(item.qty), unit: cleanUnit(item.unit), fam: cleanFam(item.fam), added: Date.now()
    };
    sh.items.push(it);
    return { state: s, item: it };
  }
  function setQty(st, shelfId, itemId, qty, unit) {
    const s = copy(st), sh = find(s, shelfId), it = sh && sh.items.find(i => i.id === itemId);
    if (!it) return { state: st, error: 'missing' };
    it.qty = cleanQty(qty); it.unit = cleanUnit(unit);
    return { state: s, item: it };
  }
  /* 3.0.11: zmiana nazwy wpisanej rzeczy (bez kodu). Dział liczymy od nowa z nowej nazwy. */
  function renameItem(st, shelfId, itemId, name) {
    const nm = clean(name, MAX_NAME); if (!nm) return { state: st, error: 'empty' };
    const s = copy(st), sh = find(s, shelfId), it = sh && sh.items.find(i => i.id === itemId);
    if (!it) return { state: st, error: 'missing' };
    if (it.code) return { state: st, error: 'code' };
    if (key(it.name) === key(nm)) { if (it.name === nm) return { state: st, item: it, same: true }; it.name = nm; return { state: s, item: it }; }
    const dup = sh.items.find(i => i.id !== it.id && !i.code && !i.checked && key(i.name) === key(nm));
    if (dup) return { state: st, error: 'duplicate', item: dup };
    it.name = nm; it.dept = departmentFor({ name: nm });
    return { state: s, item: it };
  }
  /* Przy ponownym otwarciu produktu odświeżamy dopasowanie i odpowiedź dla rodziny na wszystkich półkach. */
  function updateInfo(st, code, info) {
    let changed = false;
    const s = copy(st);
    s.shelves.forEach(sh => sh.items.forEach(it => {
      if (it.code !== code) return;
      const pct = typeof info.pct === 'number' ? Math.round(info.pct) : null, fam = cleanFam(info.fam);
      if (it.pct !== pct || JSON.stringify(it.fam) !== JSON.stringify(fam)) { it.pct = pct; it.fam = fam; changed = true; }
    }));
    return { state: changed ? s : st, changed };
  }
  function toggleItem(st, shelfId, itemId) {
    const s = copy(st), sh = find(s, shelfId), it = sh && sh.items.find(i => i.id === itemId);
    if (!it) return { state: st, error: 'missing' };
    it.checked = !it.checked;
    it.checkedAt = it.checked ? Date.now() : null;
    return { state: s, item: it, completed: isComplete(sh) };
  }
  /* 3.0.18: nagroda za całą listę tylko, gdy co najmniej 3 odhaczone rzeczy leżały na liście co najmniej 30 minut przed odhaczeniem
     (lista zrobiona wcześniej, a nie dopisana i odhaczona od razu). */
  const REWARD_MIN_ITEMS = 3, REWARD_MIN_AGE = 30 * 60 * 1000;
  function rewardable(sh) {
    if (!sh || !isComplete(sh)) return false;
    return sh.items.filter(i => i.checked && typeof i.added === 'number' && typeof i.checkedAt === 'number' && i.checkedAt - i.added >= REWARD_MIN_AGE).length >= REWARD_MIN_ITEMS;
  }
  function removeItem(st, shelfId, itemId) {
    const s = copy(st), sh = find(s, shelfId);
    if (!sh) return { state: st, error: 'missing' };
    sh.items = sh.items.filter(i => i.id !== itemId);
    return { state: s };
  }
  function clearChecked(st, shelfId) {
    const s = copy(st), sh = find(s, shelfId);
    if (!sh) return { state: st, error: 'missing' };
    const n = sh.items.filter(i => i.checked).length;
    sh.items = sh.items.filter(i => !i.checked);
    return { state: s, removed: n };
  }
  function grouped(sh) {
    return DEPARTMENTS.map(d => ({ key: d.key, label: d.label, icon: d.icon, items: sh.items.filter(i => i.dept === d.key).sort((a, b) => (a.checked - b.checked) || (a.added - b.added)) })).filter(g => g.items.length);
  }
  function progress(sh) { return { done: sh.items.filter(i => i.checked).length, total: sh.items.length }; }
  // Pełna lista = co najmniej 3 rzeczy i wszystkie odhaczone (mniejsze listy nie dają nagrody).
  function isComplete(sh) { return sh.items.length >= 3 && sh.items.every(i => i.checked); }
  function shareText(sh) {
    const lines = [sh.name, ''];
    grouped(sh).forEach(g => {
      const open = g.items.filter(i => !i.checked);
      if (!open.length) return;
      lines.push(g.label + ':');
      open.forEach(i => lines.push('• ' + i.name + (i.qty !== 1 || i.unit !== 'szt' ? ' – ' + fmtQty(i) : '')));
      lines.push('');
    });
    if (lines.length === 2) lines.push('Wszystko kupione.');
    lines.push('Lista z aplikacji Lupka');
    return lines.join('\n').trim();
  }
  function breakfastGood(st) {
    return st.shelves.reduce((n, sh) => n + sh.items.filter(i => i.dept === 'breakfast' && i.pct != null && i.pct >= 75).length, 0);
  }
  function hasCode(st, code) { return st.shelves.some(sh => sh.items.some(i => i.code === code && !i.checked)); }

  return { FREE_LIMIT, MAX_ITEMS, UNITS, parseQty, splitSpeech, findGeneric, replaceItem, undoReplace, fmtQty, setQty, renameItem, updateInfo, newState, load, addShelf, renameShelf, deleteShelf, setActive, addItem, toggleItem, removeItem, clearChecked, grouped, progress, isComplete, rewardable, shareText, breakfastGood, hasCode };
})();

if (typeof module !== 'undefined' && typeof document === 'undefined') module.exports = Shelf;
