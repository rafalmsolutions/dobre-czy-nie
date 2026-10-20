/* Dobre czy nie? – wersja D: „Album odkryć”.
   Każdy sprawdzony produkt to karta. Rzadkość jest losowana raz na zawsze, a rzadko skanowane produkty (unique_scans_n
   z Open Food Facts) mają większe szanse na kartę rzadką i epicką; legendarna = produkt dodany przez Ciebie, błysk ✦ wypada raz na ok. 20 kart
   (losowany raz na zawsze dla danego produktu). Karta produktu z brakami w bazie jest szkicem, a po uzupełnieniu ożywa.
   Strona albumu = kategoria ze zdjęciem talerza, 10 miejsc. Stan w pamięci telefonu (klucz d-album). */
'use strict';
(() => {
  const A = App;
  const SLOTS = 10;
  const RARITY = {
    zwykla: { label: 'Zwykła', event: 'card_common', h1: ['Zwykła', 'karta'] },
    rzadka: { label: 'Rzadka', event: 'card_rare', h1: ['Rzadka', 'karta!'] },
    epicka: { label: 'Epicka', event: 'card_epic', h1: ['Epicka', 'karta!'] },
    legendarna: { label: 'Legendarna', event: 'card_legend', h1: ['Legendarna', 'karta!'] }
  };
  A.RARITY = RARITY;
  A.ALBUM_SLOTS = SLOTS;
  const EXTRA_PAGES = { other: { key: 'other', label: 'Różne', img: '' }, cosmetics: { key: 'cosmetics', label: 'Kosmetyki', img: '' } };

  let tiers = null;
  A.snapshotMeta().then(m => { tiers = (m && m.scanTiers) || null; }).catch(() => { });
  A.setScanTiers = t => { tiers = t; }; // do testów

  function load() {
    const a = A.store.get('d-album', null);
    if (!a || typeof a !== 'object' || !a.cards || typeof a.cards !== 'object') return { cards: {}, done: {}, weeks: {} };
    return { cards: a.cards, done: a.done && typeof a.done === 'object' ? a.done : {}, weeks: a.weeks && typeof a.weeks === 'object' ? a.weeks : {} };
  }
  A.album = load();
  const save = () => A.store.set('d-album', A.album);

  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  A.cardHolo = code => hash(A.appUuid() + '|' + code) % 20 === 0;
  /* Rzadkość to losowanie (raz na zawsze dla pary telefon + produkt), w którym rzadko skanowane produkty mają większe szanse.
     Same liczby skanów nie wystarczą: w polskiej bazie połowa produktów ma 0 skanów, a 80% najwyżej 1,
     więc progi z rozkładu robiły z większości kart „epickie”. Szanse na 1000 kart: [epicka, rzadka]. */
  const ODDS = { low: [90, 260], mid: [60, 220], high: [30, 170] };
  A.RARITY_ODDS = ODDS;
  A.scanBand = s => s == null ? 'mid' : s <= 1 ? 'low' : s < 10 ? 'mid' : 'high';
  A.cardRarity = prod => {
    const local = A.store.get('local', {})[prod.code] || {};
    if (prod.added || local.added) return 'legendarna';
    let s = prod.scans;
    if (s == null && tiers) s = 0; // nowa kopia bazy nie zapisuje zera: brak liczby = nikt nie skanował
    const [epic, rare] = ODDS[A.scanBand(s)], roll = hash(A.appUuid() + '|r|' + prod.code) % 1000;
    return roll < epic ? 'epicka' : roll < epic + rare ? 'rzadka' : 'zwykla';
  };
  // Karty z pierwszej wersji albumu (progi z rozkładu skanów, przez które większość wychodziła „epicka”) losujemy jeszcze raz.
  if (A.store.get('d-album-v', 1) < 2) {
    for (const c of Object.values(A.album.cards)) if (c.r !== 'legendarna') c.r = A.cardRarity({ code: c.c, scans: c.sc == null ? null : c.sc });
    save(); A.store.set('d-album-v', 2);
  }
  // Szkic: w bazie brakuje składu albo wartości odżywczych (tak samo jak przycisk „Uzupełnij”).
  A.cardSketch = (prod, snapshot) => prod.kind !== 'cosmetic' && ((!prod.ingredients && !(snapshot && prod.additiveTags != null)) || !Object.values(prod.nutriments || {}).some(v => v != null));
  A.pageKeyOf = prod => prod.kind === 'cosmetic' ? 'cosmetics' : (A.prodCatKey(prod) || 'other');
  A.albumPages = () => SHOP_CATEGORIES.map(c => ({ key: c.key, label: c.label, img: A.catImg(c.key) }));
  A.pageInfo = key => { const c = SHOP_CATEGORIES.find(x => x.key === key); return c ? { key, label: c.label, img: A.catImg(key) } : EXTRA_PAGES[key] || null; };
  A.cardsOf = key => Object.values(A.album.cards).filter(c => c.k === key).sort((a, b) => a.t - b.t);

  /* Karta tygodnia: jedna kategoria na tydzień, ta sama dla wszystkich. */
  A.weekCard = (now = new Date()) => {
    const wk = Game.weekKey(now), [y, w] = wk.split('-W').map(Number);
    const c = SHOP_CATEGORIES[(y * 53 + w) % SHOP_CATEGORIES.length];
    const day = (now.getDay() + 6) % 7;
    return { week: wk, key: c.key, label: c.label, img: A.catImg(c.key), daysLeft: 7 - day, done: !!A.album.weeks[wk] };
  };

  /* Nowa karta po skanie. Zwraca { card, isNew, revived, events }; nowa karta jest od razu wklejana do albumu. */
  A.albumAdd = (prod, opts = {}) => {
    if (!prod || !prod.code || !prod.name) return null;
    const st = A.album, sketch = A.cardSketch(prod, !!opts.snapshot);
    const old = st.cards[prod.code];
    if (old) {
      let revived = false;
      if (old.s && !sketch) { old.s = false; revived = true; }
      if (!old.i && A.safeImg(prod.image)) old.i = A.safeImg(prod.image);
      if (revived || opts.touch) save();
      return { card: old, isNew: false, revived };
    }
    const key = A.pageKeyOf(prod), wk = A.weekCard();
    const card = { c: prod.code, k: key, r: A.cardRarity(prod), h: A.cardHolo(prod.code), s: sketch, w: key === wk.key && !wk.done,
      n: String(prod.name).slice(0, 80), b: String(prod.brand || '').slice(0, 40), i: A.safeImg(prod.image) || '', sc: prod.scans, t: Date.now() };
    st.cards[prod.code] = card;
    if (card.w) st.weeks[wk.week] = prod.code;
    const keys = Object.keys(st.cards); if (keys.length > 3000) delete st.cards[keys[0]];
    const before = SHOP_CATEGORIES.some(c => c.key === key) && !st.done[key];
    const pageFull = before && A.cardsOf(key).length >= SLOTS;
    if (pageFull) st.done[key] = Date.now();
    save();
    return { card, isNew: true, revived: false, pageFull: pageFull ? key : null };
  };
  /* Punkty za kartę (wywoływane przy odsłonięciu). */
  A.albumReward = res => {
    if (!res || !res.isNew) return;
    const c = res.card;
    A.award(RARITY[c.r].event, { code: c.c });
    if (c.h) A.award('card_holo', { code: c.c });
    if (c.w) A.award('card_weekly', { code: c.c });
    if (res.pageFull) A.award('album_page', { code: 'page:' + res.pageFull });
  };
  /* Liczniki do odznak (A.extraMetrics). */
  A.albumMetrics = () => {
    const cards = Object.values(A.album.cards);
    return {
      album_cards: cards.length, album_pages: Object.keys(A.album.done).length,
      epic_cards: cards.filter(c => c.r === 'epicka').length, legend_cards: cards.filter(c => c.r === 'legendarna').length,
      holo_cards: cards.filter(c => c.h).length
    };
  };
  A.albumStats = () => {
    const cards = Object.values(A.album.cards);
    return { cards: cards.length, pages: Object.keys(A.album.done).length, legend: cards.filter(c => c.r === 'legendarna').length, holo: cards.filter(c => c.h).length,
      started: new Set(cards.filter(c => SHOP_CATEGORIES.some(x => x.key === c.k)).map(c => c.k)).size };
  };
})();
