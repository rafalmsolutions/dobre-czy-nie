/* Dobre czy nie? – wersja D: ekrany albumu (polowanie), karta, odsłonięcie po skanie, plakaty i gratulacje za pełną stronę. */
'use strict';
(() => {
  const A = App, esc = A.esc;
  const RAYS = {
    zwykla: 'transparent',
    rzadka: 'repeating-conic-gradient(rgba(79,117,166,.25) 0 10deg, transparent 10deg 22deg)',
    epicka: 'repeating-conic-gradient(rgba(110,79,166,.28) 0 10deg, transparent 10deg 22deg)',
    legendarna: 'repeating-conic-gradient(rgba(209,154,18,.32) 0 10deg, transparent 10deg 22deg)',
    holo: 'repeating-conic-gradient(rgba(255,120,200,.22) 0 8deg, rgba(120,220,255,.22) 8deg 16deg, transparent 16deg 24deg)'
  };
  const SOUND = { zwykla: 'shelf', rzadka: 'right', epicka: 'badge', legendarna: 'gold' };
  const BACK = { zwykla: 'linear-gradient(135deg,#55575D,#2B2C30)', rzadka: 'linear-gradient(135deg,#9DB8D9,#4F75A6)', epicka: 'linear-gradient(135deg,#C9B3EA,#6E4FA6)', legendarna: 'linear-gradient(135deg,#FFE897,#D19A12 55%,#FFE897)' };

  /* ---------- Plakaty: strona albumu = obraz odsłaniany po fragmencie ----------
     10 fragmentów (2 kolumny × 5 rzędów); miejsce nr i odsłania fragment ORDER[i] (środek na koniec, za najtrudniejsze miejsca). */
  const GALLERY = {
    'en:chocolates': { img: 'img/gal/chocolates.webp', style: 'plakat art deco' },
    'en:yogurts': { img: 'img/gal/yogurts.webp', style: 'martwa natura' },
    'en:breads': { img: 'img/gal/breads.webp', style: 'drzeworyt' },
    'en:cheeses': { img: 'img/gal/cheeses.webp', style: 'secesyjny plakat' },
    'en:breakfast-cereals': { img: 'img/gal/breakfast-cereals.webp', style: 'akwarela botaniczna' },
    'en:milks': { img: 'img/gal/milks.webp', style: 'impresjonizm' },
    'en:prepared-meats': { img: 'img/gal/prepared-meats.webp', style: 'holenderska martwa natura' },
    'en:pastas': { img: 'img/gal/pastas.webp', style: 'włoski plakat z lat 50.' },
    'en:coffees': { img: 'img/gal/coffees.webp', style: 'linoryt' },
    'en:teas': { img: 'img/gal/teas.webp', style: 'japoński drzeworyt' },
    'en:fruit-juices': { img: 'img/gal/fruit-juices.webp', style: 'pop-art z lat 70.' },
    'en:nuts': { img: 'img/gal/nuts.webp', style: 'mozaika' },
    'en:biscuits': { img: 'img/gal/biscuits.webp', style: 'haft krzyżykowy' },
    'en:pierogi': { img: 'img/gal/pierogi.webp', style: 'polska wycinanka ludowa' },
    'en:legumes': { img: 'img/gal/legumes.webp', style: 'witraż' }
  };
  const ORDER = [1, 8, 3, 6, 0, 9, 2, 7, 5, 4];
  A.gallery = key => GALLERY[key] || null;
  /* open: numery zajętych miejsc (0–9); fresh: numer miejsca, którego fragment właśnie się odsłania. */
  A.galleryHtml = (key, open, opts = {}) => {
    const g = GALLERY[key]; if (!g) return '';
    const tiles = new Set(open.map(i => ORDER[i])), fresh = opts.fresh != null ? ORDER[opts.fresh] : -1, page = A.pageInfo(key) || { label: '' };
    const cls = 'gal' + (open.length >= ORDER.length ? ' full' : '') + (opts.size ? ' ' + opts.size : '');
    return `<div class="${cls}" style="background-image:url('${esc(g.img)}')" role="img" aria-label="Plakat ${esc(page.label)}: odsłonięte ${open.length} z ${ORDER.length} fragmentów">${ORDER.map((_, t) =>
      tiles.has(t) && t !== fresh ? '<span class="gal-t open"></span>' : `<span class="gal-t${t === fresh ? ' fresh' : ''}">?</span>`).join('')}</div>`;
  };
  A.galleryDemo = el => {
    const gal = el.closest('.gal-box') && el.closest('.gal-box').querySelector('.gal');
    if (!gal || gal.dataset.demo) return;
    gal.dataset.demo = '1'; el.disabled = true;
    const tiles = [...gal.children], todo = ORDER.filter(i => !tiles[i].classList.contains('open'));
    todo.forEach((ti, k) => setTimeout(() => {
      tiles[ti].classList.add('fresh');
      if (k === todo.length - 1) setTimeout(() => { gal.classList.add('full'); A.sound('level'); }, 1700);
    }, 450 * k));
  };
  const openIdx = key => (A.slotsOf(key) || []).map((s, i) => A.slotCard(key, s.id) ? i : -1).filter(i => i >= 0);

  /* Karta produktu. size = szerokość w px (wysokość 1,4×). */
  const slotOf = c => (A.slotsOf(c.k) || []).find(s => s.id === c.slot);
  A.cardHtml = (c, size, idx) => {
    const R = A.RARITY[c.r] || A.RARITY.zwykla, page = A.pageInfo(c.k) || {}, slot = slotOf(c);
    const pic = c.i ? `<img src="${esc(c.i)}" alt="" loading="lazy">` : page.img ? `<img src="${esc(page.img)}" alt="" class="dish" loading="lazy">` : `<span class="acard-noimg">${A.dIcon('healthy', 34)}</span>`;
    const foot = c.s ? 'brakuje danych · uzupełnij' : slot ? (slot.secret ? '✦ ' : '') + slot.label : '';
    return `<div class="acard r-${esc(c.r)}${c.h ? ' holo' : ''}${c.s ? ' sketch' : ''}${c.w ? ' weekly' : ''}" style="--w:${size}px">
      <div class="acard-in"><div class="acard-top"><span class="acard-chip">${c.s ? 'Szkic' : R.card}</span>${idx ? `<span class="acard-num">#${String(idx).padStart(2, '0')}</span>` : ''}</div>
        <span class="acard-img">${pic}</span><b class="acard-name">${esc(c.n)}</b><span class="acard-brand">${esc(c.b || ' ')}</span>
        <span class="acard-foot">${esc(foot)}</span>${c.h ? '<span class="acard-holo" aria-hidden="true"></span>' : ''}</div>
      ${c.h ? '<span class="acard-star" aria-hidden="true">✦</span>' : ''}${c.w ? '<span class="acard-week">tydzień</span>' : ''}</div>`;
  };
  /* Jak sprawdzić warunek miejsca na etykiecie (album ma uczyć czytać opakowania). Progi „mało/dużo” jak w unijnych oświadczeniach żywieniowych. */
  const LABEL_TIP = {
    'ns-a': 'Nutri-Score to kolorowa skala A–E na przodzie opakowania. Nie każdy producent ją drukuje – wtedy porównaj w tabeli wartości cukry, tłuszcze nasycone i sól na 100 g.',
    'ns-ab': 'Nutri-Score to kolorowa skala A–E na przodzie opakowania. Nie każdy producent ją drukuje – wtedy porównaj w tabeli wartości cukry, tłuszcze nasycone i sól na 100 g.',
    'ns-c': 'Nutri-Score to kolorowa skala A–E na przodzie opakowania. Nie każdy producent ją drukuje – wtedy porównaj w tabeli wartości cukry, tłuszcze nasycone i sól na 100 g.',
    nova12: 'Krótki skład z rzeczy, które znasz z kuchni, to zwykle mało przetworzony produkt. Długa lista z emulgatorami, aromatami, syropami czy skrobią modyfikowaną oznacza mocne przetworzenie.',
    nova3: 'Krótki skład z rzeczy, które znasz z kuchni, to zwykle mało przetworzony produkt. Długa lista z emulgatorami, aromatami, syropami czy skrobią modyfikowaną oznacza mocne przetworzenie.',
    noadd: 'Dodatki w składzie mają numer E (np. E330) albo nazwę z funkcją, np. „regulator kwasowości: kwas cytrynowy”. Szukaj słów: konserwant, emulgator, stabilizator, barwnik, wzmacniacz smaku.',
    nopalm: 'Szukaj w składzie słowa „palmowy”: olej palmowy, tłuszcz palmowy, olej z ziaren palmowych. Producent musi podać, z jakiej rośliny jest tłuszcz roślinny.',
    vegan: 'Alergeny w składzie są wyróżnione, np. pogrubieniem: mleko, jaja, ryby, skorupiaki, mięczaki. Uważaj też na żelatynę, miód, serwatkę i karmin (E120). Pewność daje znak „Vegan”.',
    bio: 'Szukaj unijnego znaku: listek z gwiazdek na zielonym tle, obok kod jednostki certyfikującej, np. PL-EKO-07. Napis „naturalny” to nie to samo co bio.',
    fair: 'Szukaj znaku Fairtrade albo Rainforest Alliance (żabka). Sam napis „etyczny” czy „odpowiedzialny” nie jest certyfikatem.',
    nosugar: '„Bez dodatku cukru” znaczy, że producent nie dodał cukrów ani składników słodzących. Cukry naturalne (np. z mleka czy owoców) mogą być – sprawdź wiersz „w tym cukry” w tabeli wartości.',
    glutenfree: 'Szukaj napisu „bezglutenowy” albo przekreślonego kłosa. Gluten mają pszenica, żyto, jęczmień, orkisz i zwykły owies – w składzie są wyróżnione jako alergeny.',
    lactosefree: 'Szukaj napisu „bez laktozy”. Mleko w składzie jest wyróżnione jako alergen, ale produkt bez laktozy dalej może je zawierać (laktoza jest rozłożona).',
    lowsugar: 'W tabeli wartości odżywczych wiersz „w tym cukry”: mało to najwyżej 5 g na 100 g (napoje: 2,5 g na 100 ml).',
    lowsalt: 'W tabeli wartości odżywczych wiersz „sól”: mało to najwyżej 0,3 g na 100 g.',
    lowfat: 'W tabeli wartości odżywczych wiersz „tłuszcz”: mało to najwyżej 3 g na 100 g (napoje: 1,5 g na 100 ml).',
    lowsat: 'W tabeli wartości wiersz „w tym kwasy tłuszczowe nasycone”: mało to najwyżej 1,5 g na 100 g (napoje: 0,75 g na 100 ml).',
    protein: 'W tabeli wartości odżywczych wiersz „białko”: tu szukamy co najmniej 10 g na 100 g.',
    fiber: 'W tabeli wartości wiersz „błonnik”: dużo to co najmniej 6 g na 100 g. Nie każdy producent go podaje – bez tego wiersza nie wiadomo.'
  };
  A.labelTip = s => !s || s.secret ? '' : LABEL_TIP[String(s.id).replace(/^c:/, '')] || (String(s.id).startsWith('s:') ? 'Rodzaj produktu sprawdzisz w nazwie i w składzie: składniki są wymienione od tego, którego jest najwięcej.' : String(s.id).startsWith('b:') ? 'Markę znajdziesz na przodzie opakowania. Marki własne sieci (np. Biedronki czy Lidla) też się liczą jako osobne marki.' : '');
  const emptySlotHtml = (key, s, i) => {
    const seen = A.album.seen[key] || 0, hintOn = s.secret && seen >= 5;
    const tip = A.labelTip(s);
    return `<${tip ? 'button type="button" data-act="slot-tip" data-k="' + esc(key) + '" data-slot="' + esc(s.id) + '"' : 'div'} class="ap-empty t-${esc(s.tier)}${s.secret ? ' secret' : ''}"${tip ? ' aria-label="' + esc(s.label) + ': jak to sprawdzić na etykiecie"' : ''}><span class="ap-top"><span class="ap-chip">${esc(A.RARITY[s.tier].label)}</span><span class="ap-num">#${String(i + 1).padStart(2, '0')}</span></span>
      <span class="ap-q">?</span><b>${s.secret ? 'Tajne miejsce' : esc(s.label)}</b><small>${s.secret ? (hintOn ? 'Podpowiedź: chodzi o ' + esc(s.h || 'skład') : `podpowiedź po ${5 - seen} ${plural(5 - seen, 'skanie', 'skanach', 'skanach')} z tej strony`) : esc(A.oddsText(s))}</small>${tip ? '<span class="ap-tipq" aria-hidden="true">jak sprawdzić?</span>' : ''}</${tip ? 'button' : 'div'}>`;
  };
  A.missingText = (key, max = 3) => A.missingSlots(key).filter(s => !s.secret && !s.id.startsWith('any')).sort((a, b) => b.share - a.share).slice(0, max).map(s => `„${s.label}”`).join(', ');

  /* ---------- Odsłonięcie karty po skanie ---------- */
  let rv = null; // { res, flipped, rewarded, step }
  /* ---------- Pasek nagród ----------
     Po skanie wynik jest najważniejszy, więc nowa karta, odznaka czy poziom nie zasłaniają ekranu.
     Pokazujemy je na pasku nad dolnym menu; odsłonięcie karty i gratulacje dopiero po stuknięciu „Odbierz”. */
  A.pendingCard = null;
  A.rewardBar = () => {
    const bar = A.$('rwBar'); if (!bar) return;
    const res = A.pendingCard, cels = A.heldCelebrations ? A.heldCelebrations() : [];
    const busy = !A.$('reveal').hidden || !A.$('celebrate').hidden;
    if ((!res && !cels.length) || busy) { bar.hidden = true; bar.innerHTML = ''; document.body.classList.remove('has-rwbar'); return; }
    const badge = e => e.type === 'achievement' ? 'odznaka „' + e.name + '”' : e.type === 'level' ? 'nowy poziom' : 'wyzwanie ukończone';
    let ic, t1, t2;
    if (res) {
      const c = res.card, slot = (A.slotsOf(c.k) || []).find(s => s.id === c.slot), page = A.pageInfo(c.k) || { label: '' };
      ic = `<span class="rw-card" style="background:${BACK[c.r] || BACK.zwykla}" aria-hidden="true">?</span>`;
      t1 = c.h ? 'Nowa karta ✦ błyszcząca' : `Nowa karta · ${RARITY_WORD[c.r] || 'miejsce'}`;
      t2 = [slot ? (slot.secret ? 'tajne miejsce' : '„' + slot.label + '”') : '', page.label].filter(Boolean).join(' · ') + (cels.length ? ' · + ' + cels.map(badge).join(', ') : '');
    } else {
      ic = '<span class="rw-medal" aria-hidden="true">★</span>';
      t1 = cels[0].type === 'achievement' ? 'Nowa odznaka' : cels[0].type === 'level' ? 'Nowy poziom' : 'Wyzwanie ukończone';
      t2 = cels.map(e => e.name).join(', ');
    }
    bar.innerHTML = `${ic}<span class="grow"><b>${esc(t1)}</b><span>${esc(t2)}</span></span><button class="btn btn-gold btn-sm" type="button" data-act="rw-open">Odbierz</button><button class="rw-x" type="button" data-act="rw-close" aria-label="Później"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
    bar.hidden = false; document.body.classList.add('has-rwbar');
    // Po chwili (albo przy przewijaniu) pasek zwija się do małego przycisku z prawej, żeby nie zasłaniał wyniku i przycisków.
    bar.classList.remove('mini'); clearTimeout(rwMiniT);
    rwMiniT = setTimeout(() => bar.classList.add('mini'), 4000);
  };
  let rwMiniT = 0;
  addEventListener('scroll', () => { const b = A.$('rwBar'); if (b && !b.hidden && scrollY > 40) b.classList.add('mini'); }, { passive: true });
  const RARITY_WORD = { zwykla: 'zwykłe miejsce', rzadka: 'rzadkie miejsce', epicka: 'epickie miejsce', legendarna: 'legendarne miejsce' };
  A.rewardAction = act => {
    if (act === 'rw-open') {
      const res = A.pendingCard; A.pendingCard = null;
      if (res) A.showReveal(res); else A.nextCelebration();
    } else { // „Później”: karta i odznaki zostają w albumie, tylko bez pokazu
      A.pendingCard = null; if (A.dropCelebrations) A.dropCelebrations();
    }
    A.rewardBar();
  };
  /* Po skanie: punkty od razu, karta czeka na pasku. */
  A.albumGot = res => {
    if (!res || !res.isNew || res.quiet) return;
    if (A.quiet && A.quiet()) { A.albumReward(res); res.rewarded = true; return; } // karta w albumie, bez paska
    A.pendingCard = res; // poprzednia nieodebrana karta i tak jest już w albumie
    A.albumReward(res); res.rewarded = true;
    A.rewardBar();
  };
  A.showReveal = res => {
    if (!res || !res.isNew) return;
    rv = { res, flipped: false, rewarded: !!res.rewarded, step: 'card', ret: document.activeElement };
    const box = A.$('reveal');
    box.hidden = false; document.body.style.overflow = 'hidden';
    renderReveal();
    const b = box.querySelector('[data-act=reveal-flip]'); if (b) b.focus();
  };
  function reward() { if (rv && !rv.rewarded) { rv.rewarded = true; A.albumReward(rv.res); } }
  function renderReveal() {
    const box = A.$('reveal'), c = rv.res.card, page = A.pageInfo(c.k) || { label: 'Album' };
    if (rv.step === 'page') { renderPageDone(box, rv.res.pageFull); return; }
    const slots = A.slotsOf(c.k) || [], si = slots.findIndex(s => s.id === c.slot), slot = slots[si] || { label: '', tier: c.r, share: 1, id: 'any' };
    const have = A.filledCount(c.k);
    const R = A.RARITY[c.r], h1 = c.h ? ['Błyszcząca', 'karta ✦'] : slot.secret ? ['Tajne', 'miejsce!'] : R.h1;
    const prof = A.hasProfile && A.hasProfile();
    const odds = slot.id.startsWith('any') ? 'Pierwsze kroki na tej stronie. Trudniejsze miejsca czekają.' : slot.id.startsWith('b:') ? 'Nowa marka na tej stronie albumu. Różnorodność się opłaca.' : `Ten warunek spełnia mniej więcej 1 na ${A.oneIn(slot.share)} popularnych produktów z tej kategorii${prof ? ' zgodnych z Twoim profilem' : ''}.`;
    const text = (slot.secret ? `Warunek był ukryty: „${slot.label}”. ` : '') + odds;
    const extra = [c.h ? 'Błysk trafia się mniej więcej raz na 20 kart.' : '', c.w ? 'Polowanie tygodnia: złota ramka i +30 pkt.' : '', c.s ? 'W bazie brakuje danych tego produktu. Uzupełnij je, a karta nabierze kolorów.' : ''].filter(Boolean).join(' ');
    const gal = A.gallery(c.k);
    box.innerHTML = `<div class="rv-wrap">
      <div class="rv-top"><button class="rv-x" type="button" data-act="reveal-close" aria-label="Zamknij"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button><span>Album · ${esc(page.label)}</span><span style="width:44px"></span></div>
      ${rv.flipped ? '' : `<span class="rv-kicker">NOWE MIEJSCE${si >= 0 ? ' #' + String(si + 1).padStart(2, '0') : ''}</span>`}
      <div class="rv-stage${rv.flipped ? ' open' : ''}">${rv.flipped ? `<div class="rv-rays" aria-hidden="true" style="background:${c.h ? RAYS.holo : RAYS[c.r]}"></div><div class="rv-front">${A.cardHtml(c, 190)}</div>`
        : `<button class="rv-back" type="button" data-act="reveal-flip" aria-label="Odsłoń nową kartę" style="background:${BACK[c.r] || BACK.zwykla}"><span class="rv-q">?</span><b class="rv-slot">${slot.secret ? '???' : esc(slot.label)}</b><span class="rv-logo"><span>dobre </span><b>czy nie?</b></span></button>`}</div>
      ${rv.flipped ? `<div class="rv-text" role="status"><h2><span class="w-light">${esc(h1[0])}</span> <span class="w-bold">${esc(h1[1])}</span></h2><p>${esc(text)}${extra ? ' ' + esc(extra) : ''}</p>${A.labelTip(Object.assign({}, slot, { secret: false })) ? `<p class="rv-tip"><b>Na etykiecie:</b> ${esc(A.labelTip(Object.assign({}, slot, { secret: false })))}</p>` : ''}
        ${gal ? `<div class="rv-progress rv-gal">${A.galleryHtml(c.k, openIdx(c.k), { size: 'tiny', fresh: si >= 0 ? si : null })}<span class="stack" style="gap:4px;text-align:left"><b>Plakat: ${esc(page.label)}</b><span>Odsłoniłeś kolejny fragment: ${have} z ${A.ALBUM_SLOTS}</span></span></div>`
          : `<div class="rv-progress"><div class="row" style="justify-content:space-between"><b>Strona: ${esc(page.label)}</b><b>${have} z ${A.ALBUM_SLOTS}</b></div><span class="xp"><i style="width:${have * 10}%"></i></span></div>`}
      </div>
        <div class="rv-btns rv-dock"><button class="btn btn-white" type="button" data-act="reveal-close">Wynik produktu</button>${rv.res.pageFull ? '<button class="btn btn-green" type="button" data-act="reveal-page">Dalej ›</button>' : `<a class="btn btn-green" href="#/album/${esc(c.k)}" data-act="reveal-album">Zobacz stronę</a>`}</div>`
        : '<div class="rv-text"><h2><span class="w-light">Nowa</span> <span class="w-bold">karta</span></h2><p>Ten produkt zajmuje wolne miejsce w albumie. Stuknij, żeby ją odsłonić.</p></div>'}
    </div>`;
  }
  function renderPageDone(box, key) {
    const page = A.pageInfo(key) || { label: '' }, cards = A.cardsOf(key);
    const rare = cards.filter(c => c.r !== 'zwykla').length, holo = cards.filter(c => c.h).length;
    box.innerHTML = `<div class="rv-wrap pd">
      <div class="pd-rays" aria-hidden="true"></div>
      <span class="pd-chip">STRONA ${Object.keys(A.album.done).length} Z ${A.albumPages().length}</span>
      <h2 class="pd-h"><span class="w-light">Strona</span> <span class="w-bold">ukończona!</span></h2>
      ${A.gallery(key) ? `<div class="pd-gal m-pop">${A.galleryHtml(key, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], { size: 'mid' })}<span class="pd-tw t1">✦</span><span class="pd-tw t2">✦</span><span class="pd-tw t3">✦</span><span class="pd-label">${esc(page.label)} · plakat odsłonięty</span></div>`
        : `<div class="pd-plate m-pop"><span class="pd-ring"></span>${page.img ? `<img src="${esc(page.img)}" alt="">` : ''}<span class="pd-tw t1">✦</span><span class="pd-tw t2">✦</span><span class="pd-tw t3">✦</span><span class="pd-label">${esc(page.label)} · ${A.ALBUM_SLOTS} / ${A.ALBUM_SLOTS}</span></div>`}
      <p class="pd-p">Zdobyłeś wszystkie miejsca na tej stronie${rare ? `, w tym ${rare} ${plural(rare, 'trudniejsze', 'trudniejsze', 'trudniejszych')}` : ''}${holo ? ` i ${holo} ${plural(holo, 'błyszczącą kartę', 'błyszczące karty', 'błyszczących kart')}` : ''}.</p>
      <div class="chips" style="justify-content:center"><span class="reward-chip gold">+100 pkt</span><span class="reward-chip">Złota ramka strony</span></div>
      <div class="rv-btns" style="margin-top:auto"><button class="btn btn-white" type="button" data-act="share-page" data-k="${esc(key)}">Udostępnij</button><a class="btn btn-green" href="#/album/${esc(key)}" data-act="reveal-album">Zobacz stronę</a></div></div>`;
  }
  A.closeReveal = () => {
    reward();
    const box = A.$('reveal'); box.hidden = true; box.innerHTML = ''; document.body.style.overflow = '';
    if (rv && rv.ret && rv.ret.focus && document.contains(rv.ret)) rv.ret.focus();
    rv = null;
    // Odznaki zdobyte przy tej karcie pokazujemy zaraz po niej.
    if (A.heldCelebrations && A.heldCelebrations().length) A.nextCelebration(); else A.rewardBar();
  };
  A.revealAction = (act, el) => {
    if (!rv) return;
    if (act === 'reveal-flip') {
      rv.flipped = true; renderReveal(); reward();
      const c = rv.res.card; A.sound('flip'); setTimeout(() => A.sound(c.h ? 'gold' : SOUND[c.r] || 'shelf'), 160);
      const b = A.$('reveal').querySelector('.rv-btns .btn'); if (b) b.focus({ preventScroll: true });
    } else if (act === 'reveal-page') { rv.step = 'page'; renderReveal(); A.sound('level'); }
    else if (act === 'reveal-close' || act === 'reveal-album') A.closeReveal();
  };
  A.sharePage = key => {
    const page = A.pageInfo(key) || { label: '' };
    const text = `Ukończyłem stronę „${page.label}” w albumie Lupki. Każde miejsce to inny produkt do znalezienia.`;
    const url = location.origin + location.pathname;
    if (navigator.share) navigator.share({ title: 'Lupka', text, url }).catch(() => { });
    else if (navigator.clipboard) navigator.clipboard.writeText(text + ' ' + url).then(() => A.toast('Skopiowano. Wklej, gdzie chcesz.'), () => { });
  };
  /* Skan bez nowego miejsca albo niezgodny z profilem: krótka informacja zamiast okna. */
  A.albumNote = res => {
    if (!res) return;
    const page = A.pageInfo(res.key) || { label: '' };
    if (res.incompatible) A.toast(`Nie pasuje do Twojego profilu (${res.why}), więc nie trafia do albumu.`);
    else if (res.noSlot) {
      const miss = A.missingText(res.key);
      A.toast(`${page.label} ${A.filledCount(res.key)}/${A.ALBUM_SLOTS} · to miejsce już masz.${miss ? ' Szukasz jeszcze: ' + miss + '.' : ''}`, `<a href="#/album/${esc(res.key)}">Strona</a>`);
    }
  };

  /* ---------- Kolekcja: karty (album) i odznaki w jednym miejscu, przełącznik na górze ---------- */
  A.collTabs = on => {
    const achs = ((A.cfg.achievements && A.cfg.achievements.achievements) || []), got = achs.filter(a => A.game.unlocked && A.game.unlocked[a.id]).length;
    const n = A.albumStats().cards;
    // „Uzupełnij dane”: popularne produkty do przepisania ze zdjęć (bez produktu w ręku), punkty za każdą część.
    const fill = A.CFG.offProxyUrl ? `<a class="fill-banner" href="#/uzupelnij"><span class="fill-ic" aria-hidden="true"><svg width="22" height="22"><use href="#i-photo"/></svg></span><span class="grow"><b>Uzupełnij dane, zbieraj punkty</b><span>Popularne produkty czekają na przepisanie składu, wartości albo polskiej nazwy ze zdjęcia. Nie trzeba ich mieć w domu.</span></span><span aria-hidden="true">›</span></a>` : '';
    return `<nav class="coll-tabs" aria-label="Kolekcja"><a href="#/album"${on === 'cards' ? ' aria-current="page"' : ''}>Karty <span>${n}</span></a><a href="#/postepy"${on === 'badges' ? ' aria-current="page"' : ''}>Odznaki i poziom <span>${got}</span></a></nav>${fill}`;
  };
  /* ---------- Album ---------- */
  A.route('album', () => {
    const st = A.albumStats(), wk = A.weekCard();
    const pages = A.albumPages().map(p => ({ ...p, n: A.slotsOf(p.key) ? A.filledCount(p.key) : A.cardsOf(p.key).length, full: !!A.album.done[p.key] }));
    pages.sort((a, b) => (b.n > 0) - (a.n > 0) || b.full - a.full || b.n - a.n || !!A.gallery(b.key) - !!A.gallery(a.key));
    const extra = ['other', 'cosmetics'].map(k => ({ ...A.pageInfo(k), n: A.cardsOf(k).length })).filter(p => p.n);
    const newest = Object.values(A.album.cards).sort((a, b) => b.t - a.t)[0];
    const near = pages.filter(p => !p.full && p.n >= 7 && A.slotsOf(p.key)).slice(0, 2);
    A.$('scr-album').innerHTML = `<div class="wrap"><span class="d-arc d-arc-album" aria-hidden="true"></span>
      <div class="d-head"><h1 class="al-h"><span class="w-light">Twoja</span> <span class="w-bold">kolekcja</span></h1>${A.hudPill()}</div>
      ${A.collTabs('cards')}
      <nav class="al-stats" aria-label="Twoje karty"><a href="#/album/karty"><b>${st.cards}</b><span>${plural(st.cards, 'karta', 'karty', 'kart')}</span></a><a href="#/album/pelne"><b>${st.pages}</b><span>pełne strony</span></a><a class="legend" href="#/album/legendarne"><b>${st.legend}</b><span>legendarne</span></a><a class="holo" href="#/album/blyszczace"><b>${st.holo} ✦</b><span>błyszczące</span></a></nav>
      <a class="al-week${wk.done ? ' done' : ''}" href="#/album/${esc(wk.key)}">${wk.img ? `<img src="${esc(wk.img)}" alt="">` : ''}<span class="grow"><span class="al-week-k">POLOWANIE TYGODNIA</span><b>Wolne miejsce na stronie: ${esc(wk.label.toLowerCase())}</b><span>${wk.done ? 'Zdobyte w tym tygodniu ✓' : `zostało ${wk.daysLeft} ${plural(wk.daysLeft, 'dzień', 'dni', 'dni')} · złota ramka i +30 pkt`}</span></span><span aria-hidden="true">›</span></a>
      ${A.discOn && A.discOn() ? (() => { const its = Object.values(A.disc.items), conf = its.filter(i => i.status === 'confirmed').length; return `<a class="al-disc" href="#/odkrycia"><span class="disc-gold" aria-hidden="true">★</span><span class="grow"><b>Twoje odkrycia</b><span>${its.length ? `${its.length} ${plural(its.length, 'dodany', 'dodane', 'dodanych')} · ${conf} ${plural(conf, 'potwierdzony', 'potwierdzone', 'potwierdzonych')}` : 'Dodaj produkt, którego nie ma w bazie: +50 pkt i złota karta'}</span></span><span aria-hidden="true">›</span></a>`; })() : ''}
      ${near.length ? `<div class="sec-head"><h2>Prawie gotowe</h2></div><div class="stack" style="gap:10px">${near.map(p => `<a class="al-near" href="#/album/${esc(p.key)}">${p.img ? `<img src="${esc(p.img)}" alt="">` : ''}<span class="grow stack" style="gap:6px"><span class="row" style="justify-content:space-between"><b>${esc(p.label)}</b><b>${p.n} z ${A.ALBUM_SLOTS}</b></span><span class="xp"><i style="width:${p.n * 10}%"></i></span><span class="small muted">Brakuje: ${esc(A.missingText(p.key, 2) || 'tajnego miejsca')}</span></span></a>`).join('')}</div>` : ''}
      ${st.cards ? '' : '<div class="empty stack" style="align-items:center"><b>Twój album jest jeszcze pusty</b><span>Każda strona ma 10 miejsc do zdobycia, np. „gorzka”, „bio”, „mało cukru”. Zeskanuj produkt, a zajmie pierwsze pasujące miejsce.</span><button class="btn btn-green" type="button" data-act="scan"><svg><use href="#i-scan"/></svg>Skanuj produkt</button></div>'}
      <div class="sec-head"><h2>Strony albumu</h2><span class="small muted" style="font-weight:700">${st.started} z ${A.albumPages().length} rozpoczętych</span></div>
      <div class="al-grid">${pages.concat(extra).map(p => `<a class="al-page${p.full ? ' full' : p.n ? '' : ' empty-page'}" href="#/album/${esc(p.key)}">${A.gallery(p.key) ? A.galleryHtml(p.key, A.slotsOf(p.key) ? openIdx(p.key) : [], { size: 'mini' }) : p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : `<span class="al-noimg">${A.dIcon(p.key === 'cosmetics' ? 'healthy' : 'processing', 34)}</span>`}<b>${esc(p.label)}</b>${A.isHuntPage(p.key) ? `<span class="xp"><i style="width:${Math.min(100, p.n * 10)}%"></i></span><span class="al-n">${p.full ? 'pełna strona' : p.n ? p.n + ' z ' + A.ALBUM_SLOTS : A.gallery(p.key) ? 'plakat do odkrycia' : 'jeszcze pusta'}</span>` : `<span class="al-n">${p.n} ${plural(p.n, 'karta', 'karty', 'kart')}</span>`}${p.full ? '<span class="al-star">★</span>' : ''}${newest && newest.k === p.key && Date.now() - newest.t < 864e5 ? '<span class="al-new">NOWA</span>' : ''}</a>`).join('')}</div>
    </div>`;
  });

  /* ---------- Zestawienia z kafelków kolekcji: wszystkie karty, pełne strony, legendarne, błyszczące ---------- */
  const SETS = {
    karty: { h: ['Wszystkie', 'karty'], pick: c => true, empty: 'Nie masz jeszcze kart. Zeskanuj produkt, a zajmie pierwsze pasujące miejsce w albumie.' },
    legendarne: { h: ['Karty', 'legendarne'], pick: c => c.r === 'legendarna', info: 'Legendarne miejsce spełnia mniej niż 1 na 50 popularnych produktów z kategorii.', empty: 'Jeszcze żadnej. Legendarne miejsce spełnia mniej niż 1 na 50 popularnych produktów z kategorii. Na stronie albumu widać, które miejsca są najtrudniejsze.' },
    blyszczace: { h: ['Karty', 'błyszczące'], pick: c => c.h, info: 'Błyszcząca może się trafić przy każdej nowej karcie, mniej więcej raz na 20. To czyste szczęście.', empty: 'Jeszcze żadnej. Błyszcząca może się trafić przy każdej nowej karcie, mniej więcej raz na 20.' },
    pelne: { h: ['Pełne', 'strony'], empty: 'Jeszcze żadnej. Strona jest pełna, gdy zdobędziesz wszystkie 10 miejsc. Za pełną stronę: złota ramka i +100 pkt.' }
  };
  const setHtml = key => {
    const S = SETS[key], back = `<div class="topbar"><a class="btn btn-white iconbtn" href="#/album" aria-label="Wróć do albumu"><svg><use href="#i-back"/></svg></a><span class="grow small muted" style="font-weight:800">Twoja kolekcja</span>${A.hudPill()}</div>`;
    const title = `<h1 class="al-h"><span class="w-light">${S.h[0]}</span> <span class="w-bold">${S.h[1]}</span></h1>`;
    if (key === 'pelne') {
      const full = Object.keys(A.album.done).map(k => ({ ...A.pageInfo(k), n: A.cardsOf(k).length })).filter(p => p.key);
      return `<div class="wrap"><span class="d-arc d-arc-page" aria-hidden="true"></span>${back}${title}
        ${full.length ? `<div class="al-grid">${full.map(p => `<a class="al-page full" href="#/album/${esc(p.key)}">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : ''}<b>${esc(p.label)}</b><span class="al-n">pełna strona</span><span class="al-star">★</span></a>`).join('')}</div>` : `<div class="empty">${S.empty}</div>`}</div>`;
    }
    const cards = Object.values(A.album.cards).filter(c => !c.legacy && S.pick(c)).sort((a, b) => b.t - a.t);
    return `<div class="wrap"><span class="d-arc d-arc-page" aria-hidden="true"></span>${back}${title}
      ${cards.length ? `<p class="small muted" style="font-weight:700;margin:0">${cards.length} ${plural(cards.length, 'karta', 'karty', 'kart')}, od najnowszej${S.info ? '. ' + S.info : ''}</p><div class="ap-grid">${cards.map((c, i) => `<a class="ap-slot" href="#/p/${esc(c.c)}" aria-label="${esc(c.n)}">${A.cardHtml(c, 156, i + 1)}</a>`).join('')}</div>` : `<div class="empty">${S.empty}</div>`}</div>`;
  };

  /* ---------- Strona albumu ---------- */
  let pageReq = 0;
  A.route('albumPage', key => {
    if (SETS[key]) { ++pageReq; A.$('scr-albumpage').innerHTML = setHtml(key); return; }
    const page = A.pageInfo(key);
    if (!page) { A.go('#/album'); return; }
    const el = A.$('scr-albumpage'), isCat = A.isHuntPage(key), req = ++pageReq;
    const head = (n, full) => `<div class="topbar"><a class="btn btn-white iconbtn" href="#/album" aria-label="Wróć do albumu"><svg><use href="#i-back"/></svg></a><span class="grow small muted" style="font-weight:800">${isCat ? 'Strona albumu' : 'Dodatkowa strona'}</span>${A.hudPill()}</div>
      <div class="ap-head${full ? ' full' : ''}">${page.img ? `<img src="${esc(page.img)}" alt="">` : ''}<div class="stack" style="gap:6px"><h1><span class="w-light">Strona</span> <span class="w-bold">${esc(page.label)}</span></h1>
        <span class="small muted" style="font-weight:700">${n}${full ? ' · pełna ★' : ''}</span></div></div>`;
    if (!isCat) {
      const cards = A.cardsOf(key);
      el.innerHTML = `<div class="wrap"><span class="d-arc d-arc-page" aria-hidden="true"></span>${head(`${cards.length} ${plural(cards.length, 'karta', 'karty', 'kart')}`, false)}
        <p class="small muted">${key === 'other' ? 'Produkty, których kategorii nie rozpoznaliśmy. Ta strona nie ma miejsc z warunkami.' : 'Kosmetyki z Open Beauty Facts. Ta strona nie ma miejsc z warunkami.'}</p>
        <div class="ap-grid">${cards.map((c, i) => `<a class="ap-slot" href="#/p/${esc(c.c)}">${A.cardHtml(c, 156, i + 1)}</a>`).join('')}</div></div>`;
      return;
    }
    if (!A.slotsOf(key)) el.innerHTML = `<div class="wrap">${head('Dobieramy miejsca do Twojego profilu…', false)}<div class="sk" style="height:220px"></div></div>`;
    A.ensurePage(key).then(() => {
      if (req !== pageReq) return;
      const slots = A.slotsOf(key);
      if (!slots) { el.innerHTML = `<div class="wrap">${head('', false)}<div class="empty stack"><b>Nie udało się wczytać strony</b><span>Sprawdź internet i wejdź tu jeszcze raz.</span></div></div>`; return; }
      const full = !!A.album.done[key], filled = A.filledCount(key), holo = A.cardsOf(key).filter(c => c.h).length;
      const sketch = A.cardsOf(key).find(c => c.s), gal = A.gallery(key), miss = A.missingText(key), prof = A.hasProfile && A.hasProfile();
      el.innerHTML = `<div class="wrap"><span class="d-arc d-arc-page" aria-hidden="true"></span>
        ${head(`${filled} z ${A.ALBUM_SLOTS} miejsc${holo ? ` · ${holo} ${plural(holo, 'błyszcząca', 'błyszczące', 'błyszczących')}` : ''}`, full)}
        <span class="xp ap-xp"><i style="width:${filled * 10}%"></i></span>
        ${gal ? `<div class="gal-box">${A.galleryHtml(key, openIdx(key))}<div class="gal-cap"><b>${full ? 'Plakat odsłonięty w całości' : 'Plakat do odsłonięcia'}</b><span>styl: ${esc(gal.style)} · każde zdobyte miejsce odsłania jeden fragment.</span></div>${full || !A.store.get('debug', false) ? '' : '<button class="btn btn-white" type="button" data-act="gal-demo">Podgląd: odsłoń cały plakat (test)</button>'}</div>` : ''}
        <p class="ap-reward small">Każde miejsce ma warunek. „1 na 17” znaczy, że spełnia go mniej więcej co siedemnasty popularny produkt z tej kategorii${prof ? ' zgodny z Twoim profilem' : ''}.${full ? '' : ' Pełna strona: złota ramka i +100 pkt.'}</p>
        ${sketch ? `<a class="ap-sketch" href="#/p/${esc(sketch.c)}"><span class="ap-sketch-ic">✎</span><span class="grow"><b>Ożyw szkic „${esc(sketch.n)}”</b><span>Uzupełnij dane, a karta nabierze kolorów</span></span><span aria-hidden="true">›</span></a>` : ''}
        <div class="ap-grid">${slots.map((s, i) => { const c = A.slotCard(key, s.id); return c ? `<a class="ap-slot" href="#/p/${esc(c.c)}" aria-label="${esc(c.n)}, miejsce: ${esc(s.label)}">${A.cardHtml(c, 156, i + 1)}</a>` : emptySlotHtml(key, s, i); }).join('')}</div>
        <div class="panel ap-tip" id="slotTip" role="status" hidden></div>
        ${miss && !full ? `<div class="ap-hunt"><span class="ap-hunt-k">NA ZAKUPY</span><b>Szukasz jeszcze: ${esc(miss)}</b><span>Przy skanie od razu zobaczysz, czy produkt zajmie wolne miejsce.</span></div>` : ''}
      </div>`;
    });
  });
  // Stuknięcie w puste miejsce: jak sprawdzić warunek na etykiecie.
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act=slot-tip]'); if (!el) return;
    const s = (A.slotsOf(el.dataset.k) || []).find(x => x.id === el.dataset.slot), box = A.$('slotTip'); if (!s || !box) return;
    const again = !box.hidden && box.dataset.slot === s.id;
    box.hidden = again; box.dataset.slot = again ? '' : s.id;
    box.innerHTML = again ? '' : `<b>„${esc(s.label)}” – jak to sprawdzić na etykiecie</b><p class="small" style="margin:6px 0 0">${esc(A.labelTip(s))}</p>`;
    if (!again) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
})();
