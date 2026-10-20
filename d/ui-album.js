/* Dobre czy nie? – wersja D: ekrany albumu, karta, odsłonięcie po skanie i gratulacje za pełną stronę. */
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

  const scansText = c => {
    if (c.r === 'legendarna') return 'dodane przez Ciebie';
    if (c.sc == null) return 'zeskanowana przez Ciebie';
    return c.sc <= 1 ? 'pierwszy skan w Polsce' : `skanowało ${c.sc.toLocaleString('pl-PL')} ${plural(c.sc, 'osoba', 'osoby', 'osób')}`;
  };
  /* Karta produktu. size = szerokość w px (wysokość 1,4×). */
  A.cardHtml = (c, size, idx) => {
    const R = A.RARITY[c.r] || A.RARITY.zwykla, page = A.pageInfo(c.k) || {};
    const pic = c.i ? `<img src="${esc(c.i)}" alt="" loading="lazy">` : page.img ? `<img src="${esc(page.img)}" alt="" class="dish" loading="lazy">` : `<span class="acard-noimg">${A.dIcon('healthy', 34)}</span>`;
    return `<div class="acard r-${esc(c.r)}${c.h ? ' holo' : ''}${c.s ? ' sketch' : ''}${c.w ? ' weekly' : ''}" style="--w:${size}px">
      <div class="acard-in"><div class="acard-top"><span class="acard-chip">${c.s ? 'Szkic' : R.label}</span>${idx ? `<span class="acard-num">#${String(idx).padStart(2, '0')}</span>` : ''}</div>
        <span class="acard-img">${pic}</span><b class="acard-name">${esc(c.n)}</b><span class="acard-brand">${esc(c.b || ' ')}</span>
        <span class="acard-foot">${c.s ? 'brakuje danych · uzupełnij' : esc(scansText(c))}</span>${c.h ? '<span class="acard-holo" aria-hidden="true"></span>' : ''}</div>
      ${c.h ? '<span class="acard-star" aria-hidden="true">✦</span>' : ''}${c.w ? '<span class="acard-week">tydzień</span>' : ''}</div>`;
  };

  /* ---------- Odsłonięcie karty po skanie ---------- */
  let rv = null; // { res, flipped, rewarded, step }
  A.showReveal = res => {
    if (!res || !res.isNew) return;
    rv = { res, flipped: false, rewarded: false, step: 'card', ret: document.activeElement };
    const box = A.$('reveal');
    box.hidden = false; document.body.style.overflow = 'hidden';
    renderReveal();
    const b = box.querySelector('[data-act=reveal-flip]'); if (b) b.focus();
  };
  function reward() { if (rv && !rv.rewarded) { rv.rewarded = true; A.albumReward(rv.res); } }
  function renderReveal() {
    const box = A.$('reveal'), c = rv.res.card, page = A.pageInfo(c.k) || { label: 'Album' };
    if (rv.step === 'page') { renderPageDone(box, rv.res.pageFull); return; }
    const have = Math.min(A.ALBUM_SLOTS, A.cardsOf(c.k).length), isCat = SHOP_CATEGORIES.some(x => x.key === c.k);
    const R = A.RARITY[c.r], h1 = c.h ? ['Błyszcząca', 'karta ✦'] : c.s && c.r === 'zwykla' ? ['Nowy', 'szkic'] : R.h1;
    const text = c.r === 'legendarna' ? 'Tego produktu nie było w bazie. Jesteś pierwszą osobą w Polsce, która go dodała.'
      : c.r === 'epicka' ? (c.sc != null && c.sc <= 1 ? 'Nikt przed Tobą nie skanował go w Polsce. Prawdziwe odkrycie.' : `Przed Tobą sprawdziło go tylko ${c.sc} ${plural(c.sc || 0, 'osoba', 'osoby', 'osób')}. Prawdziwe odkrycie.`)
      : c.r === 'rzadka' ? `Skanowało go tylko ${c.sc} ${plural(c.sc || 0, 'osoba', 'osoby', 'osób')} w Polsce.`
      : 'Ten produkt zna już wiele osób. Każda karta przybliża Cię do pełnej strony.';
    const extra = [c.h ? 'Błysk trafia się mniej więcej raz na 20 kart.' : '', c.w ? 'To karta tygodnia: złota ramka i +30 pkt.' : '', c.s ? 'W bazie brakuje danych tego produktu. Uzupełnij je, a karta nabierze kolorów.' : ''].filter(Boolean).join(' ');
    box.innerHTML = `<div class="rv-wrap">
      <div class="rv-top"><button class="rv-x" type="button" data-act="reveal-close" aria-label="Zamknij"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button><span>Album · ${esc(page.label)}</span><span style="width:44px"></span></div>
      <div class="rv-stage">${rv.flipped ? `<div class="rv-rays" aria-hidden="true" style="background:${c.h ? RAYS.holo : RAYS[c.r]}"></div><div class="rv-front">${A.cardHtml(c, 224)}</div>`
        : `<button class="rv-back" type="button" data-act="reveal-flip" aria-label="Odsłoń nową kartę"><span class="rv-q">?</span><span class="rv-logo"><span>dobre </span><b>czy nie?</b></span></button>`}</div>
      ${rv.flipped ? `<div class="rv-text" role="status"><h2><span class="w-light">${esc(h1[0])}</span> <span class="w-bold">${esc(h1[1])}</span></h2><p>${esc(text)}${extra ? ' ' + esc(extra) : ''}</p>
        ${isCat ? `<div class="rv-progress"><div class="row" style="justify-content:space-between"><b>Strona: ${esc(page.label)}</b><b>${have} z ${A.ALBUM_SLOTS}</b></div><span class="xp"><i style="width:${have * 10}%"></i></span></div>` : ''}
        <div class="rv-btns"><button class="btn btn-white" type="button" data-act="reveal-close">Wynik produktu</button>${rv.res.pageFull ? '<button class="btn btn-green" type="button" data-act="reveal-page">Dalej ›</button>' : `<a class="btn btn-green" href="#/album/${esc(c.k)}" data-act="reveal-album">Zobacz album</a>`}</div></div>`
        : '<div class="rv-text"><h2><span class="w-light">Nowa</span> <span class="w-bold">karta</span></h2><p>Stuknij, żeby ją odsłonić.</p></div>'}
    </div>`;
  }
  function renderPageDone(box, key) {
    const page = A.pageInfo(key) || { label: '' }, cards = A.cardsOf(key);
    const rare = cards.filter(c => c.r !== 'zwykla').length, holo = cards.filter(c => c.h).length;
    box.innerHTML = `<div class="rv-wrap pd">
      <div class="pd-rays" aria-hidden="true"></div>
      <span class="pd-chip">STRONA ${Object.keys(A.album.done).length} Z ${SHOP_CATEGORIES.length}</span>
      <h2 class="pd-h"><span class="w-light">Strona</span> <span class="w-bold">ukończona!</span></h2>
      <div class="pd-plate m-pop"><span class="pd-ring"></span>${page.img ? `<img src="${esc(page.img)}" alt="">` : ''}<span class="pd-tw t1">✦</span><span class="pd-tw t2">✦</span><span class="pd-tw t3">✦</span><span class="pd-label">${esc(page.label)} · ${A.ALBUM_SLOTS} / ${A.ALBUM_SLOTS}</span></div>
      <p class="pd-p">Masz wszystkie karty z tej strony${rare ? `, w tym ${rare} ${plural(rare, 'rzadszą', 'rzadsze', 'rzadszych')}` : ''}${holo ? ` i ${holo} ${plural(holo, 'błyszczącą', 'błyszczące', 'błyszczących')}` : ''}.</p>
      <div class="chips" style="justify-content:center"><span class="reward-chip gold">+100 pkt</span><span class="reward-chip">Złota ramka strony</span></div>
      <div class="rv-btns" style="margin-top:auto"><button class="btn btn-white" type="button" data-act="share-page" data-k="${esc(key)}">Udostępnij</button><a class="btn btn-green" href="#/album/${esc(key)}" data-act="reveal-album">Zobacz stronę</a></div></div>`;
  }
  A.closeReveal = () => {
    reward();
    const box = A.$('reveal'); box.hidden = true; box.innerHTML = ''; document.body.style.overflow = '';
    if (rv && rv.ret && rv.ret.focus && document.contains(rv.ret)) rv.ret.focus();
    rv = null;
  };
  A.revealAction = (act, el) => {
    if (!rv) return;
    if (act === 'reveal-flip') {
      rv.flipped = true; renderReveal(); reward();
      const c = rv.res.card; A.sound(c.h ? 'gold' : SOUND[c.r] || 'shelf');
      const b = A.$('reveal').querySelector('.rv-btns .btn'); if (b) b.focus({ preventScroll: true });
    } else if (act === 'reveal-page') { rv.step = 'page'; renderReveal(); A.sound('level'); }
    else if (act === 'reveal-close' || act === 'reveal-album') A.closeReveal();
  };
  A.sharePage = key => {
    const page = A.pageInfo(key) || { label: '' };
    const text = `Ukończyłem stronę „${page.label}” w albumie Dobre czy nie? Każdy skan to nowa karta.`;
    const url = location.origin + location.pathname;
    if (navigator.share) navigator.share({ title: 'Dobre czy nie?', text, url }).catch(() => { });
    else if (navigator.clipboard) navigator.clipboard.writeText(text + ' ' + url).then(() => A.toast('Skopiowano. Wklej, gdzie chcesz.'), () => { });
  };

  /* ---------- Album ---------- */
  A.route('album', () => {
    const st = A.albumStats(), wk = A.weekCard();
    const pages = A.albumPages().map(p => ({ ...p, n: A.cardsOf(p.key).length, full: !!A.album.done[p.key] }));
    pages.sort((a, b) => (b.n > 0) - (a.n > 0) || b.full - a.full || b.n - a.n);
    const extra = ['other', 'cosmetics'].map(k => ({ ...A.pageInfo(k), n: A.cardsOf(k).length })).filter(p => p.n);
    const newest = Object.values(A.album.cards).sort((a, b) => b.t - a.t)[0];
    A.$('scr-album').innerHTML = `<div class="wrap"><span class="d-arc d-arc-album" aria-hidden="true"></span>
      <div class="d-head"><h1 class="al-h"><span class="w-light">Album</span> <span class="w-bold">odkryć</span></h1>${A.hudPill()}</div>
      <div class="al-stats"><div><b>${st.cards}</b><span>${plural(st.cards, 'karta', 'karty', 'kart')}</span></div><div><b>${st.pages}</b><span>pełne strony</span></div><div class="legend"><b>${st.legend}</b><span>legendarne</span></div><div class="holo"><b>${st.holo} ✦</b><span>błyszczące</span></div></div>
      <a class="al-week${wk.done ? ' done' : ''}" href="#/album/${esc(wk.key)}">${wk.img ? `<img src="${esc(wk.img)}" alt="">` : ''}<span class="grow"><span class="al-week-k">KARTA TYGODNIA</span><b>Dowolny produkt: ${esc(wk.label.toLowerCase())}</b><span>${wk.done ? 'Zdobyta w tym tygodniu ✓' : `zostało ${wk.daysLeft} ${plural(wk.daysLeft, 'dzień', 'dni', 'dni')} · złota ramka i +30 pkt`}</span></span><span aria-hidden="true">›</span></a>
      ${st.cards ? '' : '<div class="empty stack" style="align-items:center"><b>Twój album jest jeszcze pusty</b><span>Zeskanuj dowolny produkt, a dostaniesz pierwszą kartę.</span><button class="btn btn-green" type="button" data-act="scan"><svg><use href="#i-scan"/></svg>Skanuj produkt</button></div>'}
      <div class="sec-head"><h2>Strony albumu</h2><span class="small muted" style="font-weight:700">${st.started} z ${SHOP_CATEGORIES.length} rozpoczętych</span></div>
      <div class="al-grid">${pages.concat(extra).map(p => `<a class="al-page${p.full ? ' full' : p.n ? '' : ' empty-page'}" href="#/album/${esc(p.key)}">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : `<span class="al-noimg">${A.dIcon(p.key === 'cosmetics' ? 'healthy' : 'processing', 34)}</span>`}<b>${esc(p.label)}</b>${SHOP_CATEGORIES.some(c => c.key === p.key) ? `<span class="xp"><i style="width:${Math.min(100, p.n * 10)}%"></i></span><span class="al-n">${p.full ? 'pełna strona' : p.n ? Math.min(p.n, A.ALBUM_SLOTS) + ' z ' + A.ALBUM_SLOTS : 'jeszcze pusta'}</span>` : `<span class="al-n">${p.n} ${plural(p.n, 'karta', 'karty', 'kart')}</span>`}${p.full ? '<span class="al-star">★</span>' : ''}${newest && newest.k === p.key && Date.now() - newest.t < 864e5 ? '<span class="al-new">NOWA</span>' : ''}</a>`).join('')}</div>
      <a class="al-link" href="#/postepy">Odznaki i poziom ›</a>
    </div>`;
  });

  /* ---------- Strona albumu ---------- */
  A.route('albumPage', key => {
    const page = A.pageInfo(key);
    if (!page) { A.go('#/album'); return; }
    const cards = A.cardsOf(key), isCat = SHOP_CATEGORIES.some(c => c.key === key);
    const shown = isCat ? cards.slice(0, A.ALBUM_SLOTS) : cards;
    const empty = isCat ? Math.max(0, A.ALBUM_SLOTS - shown.length) : 0;
    const sketch = cards.find(c => c.s), holo = cards.filter(c => c.h).length, full = !!A.album.done[key];
    A.$('scr-albumpage').innerHTML = `<div class="wrap"><span class="d-arc d-arc-page" aria-hidden="true"></span>
      <div class="topbar"><a class="btn btn-white iconbtn" href="#/album" aria-label="Wróć do albumu"><svg><use href="#i-back"/></svg></a><span class="grow small muted" style="font-weight:800">${isCat ? 'Strona albumu' : 'Dodatkowa strona'}</span>${A.hudPill()}</div>
      <div class="ap-head${full ? ' full' : ''}">${page.img ? `<img src="${esc(page.img)}" alt="">` : ''}<div class="stack" style="gap:6px"><h1><span class="w-light">Strona</span> <span class="w-bold">${esc(page.label)}</span></h1>
        <span class="small muted" style="font-weight:700">${isCat ? `${Math.min(cards.length, A.ALBUM_SLOTS)} z ${A.ALBUM_SLOTS} kart` : `${cards.length} ${plural(cards.length, 'karta', 'karty', 'kart')}`}${holo ? ` · ${holo} ${plural(holo, 'błyszcząca', 'błyszczące', 'błyszczących')}` : ''}${full ? ' · pełna ★' : ''}</span>
        ${isCat ? `<span class="xp"><i style="width:${Math.min(100, cards.length * 10)}%"></i></span>` : ''}</div></div>
      ${isCat && !full ? '<p class="ap-reward small"><b>Nagroda za pełną stronę:</b> złota ramka, +100 pkt i postęp w odznace „Kolekcjoner”.</p>' : ''}
      ${!isCat ? `<p class="small muted">${key === 'other' ? 'Produkty, których kategorii nie rozpoznaliśmy. Ta strona nie ma limitu kart.' : 'Kosmetyki z Open Beauty Facts. Ta strona nie ma limitu kart.'}</p>` : ''}
      ${sketch ? `<a class="ap-sketch" href="#/p/${esc(sketch.c)}"><span class="ap-sketch-ic">✎</span><span class="grow"><b>Ożyw szkic „${esc(sketch.n)}”</b><span>Uzupełnij dane, a karta nabierze kolorów (+10 pkt)</span></span><span aria-hidden="true">›</span></a>` : ''}
      <div class="ap-grid">${shown.map((c, i) => `<a class="ap-slot" href="#/p/${esc(c.c)}" aria-label="${esc(c.n)}, ${esc((A.RARITY[c.r] || {}).label || '')}${c.h ? ', błyszcząca' : ''}${c.s ? ', szkic' : ''}">${A.cardHtml(c, 156, i + 1)}</a>`).join('')}
        ${Array.from({ length: empty }, (_, i) => `<div class="ap-empty"><span>?</span><b>Miejsce #${String(shown.length + i + 1).padStart(2, '0')}</b><small>zeskanuj produkt z tej kategorii</small></div>`).join('')}</div>
      ${isCat && cards.length > A.ALBUM_SLOTS ? `<p class="small muted center">Masz też ${cards.length - A.ALBUM_SLOTS} ${plural(cards.length - A.ALBUM_SLOTS, 'kartę', 'karty', 'kart')} ponad stronę.</p>` : ''}
    </div>`;
  });
})();
