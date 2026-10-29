/* Dobre czy nie? 1.0 – półki zakupowe. */
'use strict';
(() => {
  const A = App, esc = A.esc;
  let ui = { adding: false, renaming: false, confirmDelete: false, msg: '', shelfMsg: '', qty: null, sheet: false };

  A.route('shelves', () => { ui = { adding: false, renaming: false, confirmDelete: false, msg: '', shelfMsg: '', qty: null, sheet: false }; render(); });
  /* Ocena przy rzeczy: z domownikami odpowiedź dla całej rodziny (zapamiętana przy ostatnim sprawdzeniu produktu), bez nich mój procent. */
  /* Ocena przy rzeczy (3.0): krótkie słowa w kolorze wyniku pod nazwą – „pasuje wszystkim”, „uwaga: Ola”, „nie dla Kuby”. */
  function scoreHtml(i) {
    if (i.code && !fresh.has(i.code)) return '';
    if (A.famOn() && i.fam) {
      const w = i.fam.t === 'ok' ? 'pasuje wszystkim' : i.fam.h.replace(/^./, c => c.toLowerCase());
      return `<span class="famchip" data-t="${esc(i.fam.t)}">${esc(w)}</span>`;
    }
    return i.pct != null ? `<span class="pct-w alt-score"${A.pctText ? ` style="${A.pctText(i.pct)}"` : ''}>dopasowanie ${i.pct}%</span>` : '';
  }
  function itemHtml(i) {
    const q = Shelf.fmtQty(i), sc = scoreHtml(i);
    const nm = i.code ? `<a class="t1" href="#/p/${esc(i.code)}">${esc(i.name)}</a>` : `<button type="button" class="t1 t1-edit" data-act="item-qty" data-id="${esc(i.id)}" aria-label="Zmień: ${esc(i.name)}">${esc(i.name)}</button>`;
    const row = `<div class="sitem${i.checked ? ' checked' : ''}" data-id="${esc(i.id)}"><input type="checkbox" data-act="item-toggle" data-id="${esc(i.id)}"${i.checked ? ' checked' : ''} aria-label="${i.checked ? 'Kupione' : 'Odhacz'}: ${esc(i.name)}"><span class="grow si-txt">${nm}${sc}</span><button class="qtybtn" type="button" data-act="item-qty" data-id="${esc(i.id)}" aria-expanded="${ui.qty === i.id}" aria-label="Ilość: ${esc(q)}. Zmień ilość lub jednostkę">${esc(q)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button><button class="x" type="button" data-act="item-remove" data-id="${esc(i.id)}" aria-label="Usuń ${esc(i.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;
    if (ui.qty !== i.id) return row;
    return row + `<form class="inline-form qty-form" id="qtyForm" data-id="${esc(i.id)}" novalidate>${i.code ? '' : `<label class="qf-name"><span class="small muted">Nazwa</span><input class="field" id="itemNameInput" maxlength="60" autocomplete="off" value="${esc(i.name)}"></label>`}<p class="msg qf-msg" id="itemEditMsg" role="status"></p><button class="btn btn-white iconbtn" type="button" data-act="qty-minus" aria-label="Mniej">−</button><input class="field" id="qtyInput" inputmode="decimal" value="${esc(String(i.qty).replace('.', ','))}" aria-label="Ilość"><button class="btn btn-white iconbtn" type="button" data-act="qty-plus" aria-label="Więcej">+</button><select class="field" id="qtyUnit" aria-label="Jednostka">${Shelf.UNITS.map(u => `<option value="${u}"${u === i.unit ? ' selected' : ''}>${u === 'szt' ? 'szt.' : u}</option>`).join('')}</select><button class="btn btn-green btn-sm" type="submit">OK</button></form>`;
  }

  const active = () => A.shelves.shelves.find(s => s.id === A.shelves.active) || A.shelves.shelves[0];
  /* Ulubione (serce przy produkcie) i „często kupujesz” (rzeczy odhaczane w sklepie co najmniej 2 razy): szybkie dodawanie na półkę. */
  const favs = () => (v => Array.isArray(v) ? v.filter(x => x && x.name) : [])(A.store.get('d-fav', []));
  const bkey = i => i.code ? i.code : 'n:' + fold(i.name);
  A.isFav = code => favs().some(f => f.code === code);
  A.toggleFav = (prod, pm) => {
    const list = favs(), on = list.some(f => f.code === prod.code);
    A.store.set('d-fav', on ? list.filter(f => f.code !== prod.code) : [{ code: prod.code, name: prod.name || 'Produkt ' + prod.code, categories: (prod.categories || []).slice(0, 8), pct: pm && pm.pct != null ? pm.pct : null, at: Date.now() }].concat(list).slice(0, 60));
    return !on;
  };
  function rememberBought(i) {
    const b = A.store.get('d-bought', {}), k = bkey(i), cur = b[k] || { name: i.name, code: i.code || null, n: 0 };
    b[k] = Object.assign(cur, { name: i.name, pct: i.pct, n: cur.n + 1, at: Date.now() });
    const keys = Object.keys(b); if (keys.length > 120) keys.sort((x, y) => b[x].at - b[y].at).slice(0, keys.length - 120).forEach(x => delete b[x]);
    A.store.set('d-bought', b);
  }
  function quickList(sh) {
    const onShelf = new Set(sh.items.filter(i => !i.checked).map(bkey)), out = [], seen = new Set();
    favs().forEach(f => { const k = bkey(f); if (!onShelf.has(k) && !seen.has(k)) { seen.add(k); out.push(Object.assign({ k, fav: true }, f)); } });
    const b = A.store.get('d-bought', {});
    Object.entries(b).filter(([, x]) => x && x.n >= 2).sort((x, y) => y[1].n - x[1].n).forEach(([k, x]) => { if (!onShelf.has(k) && !seen.has(k)) { seen.add(k); out.push(Object.assign({ k }, x)); } });
    return out.slice(0, 14);
  }
  const quickHtml = sh => {
    const q = quickList(sh); if (!q.length) return '';
    return `<div class="quick-add" role="group" aria-label="Szybko dodaj: ulubione i często kupowane"><div class="chips qrow">${q.map(x => `<button class="chip qadd" type="button" data-act="qadd" data-k="${esc(x.k)}"><span aria-hidden="true">${x.fav ? '♥' : '↻'}</span> ${esc(x.name)}</button>`).join('')}</div></div>`;
  };
  A.rememberBought = rememberBought;
  /* Produkty wcześniej dodawane na półki (z kodem) – trzecie źródło podpowiedzi przy pisaniu. */
  A.rememberAdded = (prod, pct) => {
    if (!prod || !prod.code) return;
    const m = A.store.get('d-added', {}), cur = m[prod.code] || {};
    m[prod.code] = { code: prod.code, name: prod.name || cur.name || 'Produkt ' + prod.code, categories: (prod.categories || cur.categories || []).slice(0, 8), pct: pct != null ? pct : (cur.pct != null ? cur.pct : null), at: Date.now() };
    const keys = Object.keys(m); if (keys.length > 150) keys.sort((x, y) => m[x].at - m[y].at).slice(0, keys.length - 150).forEach(x => delete m[x]);
    A.store.set('d-added', m);
  };

  /* ---------- Podpowiedzi podczas pisania (2.8.0): ♥ ulubione, ↻ często kupowane, potem produkty dodawane wcześniej ---------- */
  let sug = [], sugIdx = -1;
  const wordsOf = s => fold(s).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  const matches = (name, qw) => { const nw = wordsOf(name); return qw.every(q => nw.some(w => w.startsWith(q))); };
  function suggestions(text) {
    const q = Shelf.parseQty(text), qw = wordsOf(q.name);
    if (fold(q.name).replace(/\s/g, '').length < 2 || !qw.length) return [];
    const sh = active(), onShelf = new Set(sh.items.filter(i => !i.checked).map(bkey)), seen = new Set(), out = [];
    const push = (x, src) => { const k = bkey(x); if (out.length >= 5 || seen.has(k) || onShelf.has(k) || !x.name || !matches(x.name, qw)) return; seen.add(k); out.push(Object.assign({ k, src }, x)); };
    favs().forEach(f => push(f, 'fav'));
    const b = A.store.get('d-bought', {});
    Object.values(b).filter(x => x && x.name).sort((x, y) => y.n - x.n || y.at - x.at).forEach(x => push(x, 'bought'));
    const ad = A.store.get('d-added', {});
    Object.values(ad).filter(x => x && x.code).sort((x, y) => y.at - x.at).forEach(x => push(x, 'added'));
    A.shelves.shelves.forEach(s => s.items.filter(i => i.code).forEach(i => push({ code: i.code, name: i.name, pct: i.pct }, 'added')));
    return out.map(x => Object.assign(x, { qty: q.qty, unit: q.unit }));
  }
  const SRC_IC = { fav: ['♥', 'ulubione'], bought: ['↻', 'często kupujesz'], added: ['＋', 'było na liście'] };
  function drawSug() {
    const box = A.$('addSuggest'), inp = A.$('addItemInput'); if (!box || !inp) return;
    box.innerHTML = sug.map((x, n) => `<li role="option" id="sug-${n}" class="sug${n === sugIdx ? ' on' : ''}" aria-selected="${n === sugIdx}" data-act="sug-add" data-i="${n}"><span class="sug-ic${x.src === 'fav' ? ' fav' : ''}" aria-hidden="true">${SRC_IC[x.src][0]}</span><span class="grow">${esc(x.name)}<span class="sr">, ${SRC_IC[x.src][1]}</span></span>${x.pct != null ? `<span class="small muted">${x.pct}%</span>` : ''}</li>`).join('');
    box.hidden = !sug.length;
    inp.setAttribute('aria-expanded', sug.length ? 'true' : 'false');
    if (sugIdx >= 0 && sug.length) inp.setAttribute('aria-activedescendant', 'sug-' + sugIdx); else inp.removeAttribute('aria-activedescendant');
  }
  const closeSug = () => { sug = []; sugIdx = -1; drawSug(); };
  A.shelfSuggest = text => { sug = suggestions(text); sugIdx = -1; drawSug(); };
  function addSug(n) {
    const x = sug[n]; if (!x) return;
    const r = Shelf.addItem(A.shelves, active().id, { name: x.name, code: x.code || undefined, pct: x.pct, categories: x.categories, qty: x.qty || 1, unit: x.unit || 'szt' });
    sug = []; sugIdx = -1;
    if (r.error) { ui.msgInfo = false; ui.msg = r.error === 'duplicate' ? `„${r.item.name}” już jest na tej liście.` : r.error === 'full' ? ERR.full : 'Nie udało się dodać.'; render('#addItemInput'); return; }
    A.shelves = r.state; A.saveShelves(); ui.msgInfo = false; ui.msg = ''; render('#addItemInput'); A.announce(`Dodano: ${x.name}.`);
  }
  /* Strzałki wybierają podpowiedź, Enter ją dodaje, Escape zamyka. Zwraca true, gdy klawisz obsłużony. */
  A.shelfKey = e => {
    if (e.key === 'Escape' && sug.length) { e.preventDefault(); closeSug(); return true; }
    if (!sug.length) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sugIdx = (sugIdx + (e.key === 'ArrowDown' ? 1 : -1) + sug.length + 1) % (sug.length + 1); if (sugIdx === sug.length) sugIdx = -1; drawSug(); return true; }
    if (e.key === 'Enter' && sugIdx >= 0) { e.preventDefault(); addSug(sugIdx); return true; }
    return false;
  };

  /* ---------- Dyktowanie listy (2.8.0): Web Speech API, po polsku, jedna wypowiedź ---------- */
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const MIC = '<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  /* 2.8.2: słuchamy w trybie ciągłym. Każdy fragment po pauzie od razu trafia na półkę. Gdy przeglądarka sama zakończy
     rozpoznawanie (Android, iPhone robią to po kilku sekundach ciszy), uruchamiamy je ponownie. Koniec: stuknięcie mikrofonu,
     IDLE ms ciszy albo 2 minuty. Android potrafi powtarzać wcześniejsze słowa w kolejnych wynikach – usuwamy powtórzenia. */
  let rec = null, listening = false, sess = null;
  A.dictIdleMs = 8000;
  const DICT_MAX = 120000;
  const SR_ERR = { 'not-allowed': 'Nie mamy zgody na mikrofon. Zezwól na niego w ustawieniach przeglądarki albo wpisz rzecz.', 'service-not-allowed': 'Ta przeglądarka nie pozwala tu dyktować. Wpisz rzecz ręcznie.', network: 'Dyktowanie wymaga internetu. Wpisz rzecz ręcznie.', 'audio-capture': 'Nie znaleźliśmy mikrofonu.' };
  const setMsg = (m, info) => { ui.msgInfo = !!info; ui.msg = m; const el = A.$('itemMsg'); if (el) { el.textContent = m; el.classList.toggle('msg-info', !!info); } };
  const micState = () => { const b = A.$('micBtn'); if (b) { b.setAttribute('aria-pressed', listening ? 'true' : 'false'); b.setAttribute('aria-label', listening ? 'Zakończ dyktowanie' : 'Dyktuj listę'); b.classList.toggle('on', listening); } };
  const shelvesOpen = () => A.current && A.current.screen === 'shelves';
  const label = it => it.name + (it.unit === 'szt' ? (it.qty !== 1 ? ' ×' + String(it.qty).replace('.', ',') : '') : ' ' + Shelf.fmtQty(it));
  function sessMsg(final) {
    const s = sess, n = s.added.length;
    return [n ? `Dodano ${n} ${plural(n, 'rzecz', 'rzeczy', 'rzeczy')}: ${s.added.join(', ')}.` : '', s.dup.length ? `Już na liście: ${s.dup.join(', ')}.` : '', s.full ? ERR.full : '',
      final ? (!n && !s.dup.length ? (s.heard ? 'Nie rozpoznaliśmy żadnej rzeczy. Spróbuj jeszcze raz.' : 'Nic nie usłyszeliśmy. Stuknij mikrofon i wymieniaj produkty, np. „pomidory, ziemniaki, banany”.') : '')
        : 'Słucham dalej… Stuknij mikrofon, gdy skończysz.'].filter(Boolean).join(' ');
  }
  function addChunk(text) {
    const parts = Shelf.splitSpeech(text); let changed = false;
    parts.forEach(p => {
      const r = Shelf.addItem(A.shelves, active().id, { name: p.text });
      if (r.error === 'full') sess.full = true;
      else if (r.error) { if (r.item && !sess.dup.includes(r.item.name)) sess.dup.push(r.item.name); }
      else { A.shelves = r.state; sess.added.push(label(r.item)); changed = true; }
    });
    if (changed) A.saveShelves();
    ui.msgInfo = true; ui.msg = sessMsg(false);
    if (shelvesOpen()) render(); // bez przenoszenia fokusu (na telefonie nie wyskakuje klawiatura)
  }
  // Nowy końcowy fragment; Android bywa, że powtarza w nim poprzednie słowa.
  function takeFinal(t) {
    let txt = t.trim(); if (!txt) return;
    const prev = sess.lastFinal, ft = fold(txt), fp = fold(prev);
    if (fp && ft === fp) return;
    if (fp && ft.startsWith(fp + ' ')) txt = txt.slice(prev.length).trim();
    sess.lastFinal = t.trim(); sess.heard = true;
    if (txt) { sess.buf = (sess.buf ? sess.buf + ' ' : '') + txt; flushLater(); }
  }
  /* 3.0.11: Android (zwłaszcza Samsung) potrafi oddać „herbata” / „zielona” / „Teekanne” jako osobne końcowe wyniki.
     Zbieramy je i dzielimy na rzeczy dopiero po pauzie w mówieniu (A.dictPauseMs) albo na końcu dyktowania. */
  A.dictPauseMs = 1600;
  function flushLater() { const s = sess; if (!s) return; clearTimeout(s.flushT); s.flushT = setTimeout(() => { if (sess === s && !s.interim) flushBuf(); else if (sess === s) flushLater(); }, A.dictPauseMs); }
  function flushBuf() { const s = sess; if (!s || !s.buf) return; clearTimeout(s.flushT); const b = s.buf; s.buf = ''; addChunk(b); }
  function idle() { clearTimeout(sess.timer); sess.timer = setTimeout(() => stopDict(), A.dictIdleMs); }
  function finish() {
    const s = sess; if (!s) return;
    clearTimeout(s.timer); listening = false; rec = null;
    if (s.interim) { takeFinal(s.interim); s.interim = ''; }
    flushBuf();
    const msg = sessMsg(true); sess = null;
    ui.msgInfo = true; ui.msg = msg;
    const inp = A.$('addItemInput'); if (inp) inp.value = '';
    if (shelvesOpen()) render(); else micState();
    A.announce(msg);
  }
  function stopDict() { if (!sess) return; sess.stopping = true; clearTimeout(sess.timer); if (rec) { try { rec.stop(); } catch (e) { finish(); } } else finish(); }
  function startRec() {
    const s = sess; let r;
    try { r = new SR(); } catch (e) { setMsg('Dyktowanie nie działa w tej przeglądarce.'); sess = null; listening = false; micState(); return; }
    rec = r; s.done = new Set();
    r.lang = 'pl-PL'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = ev => {
      if (sess !== s) return;
      let interim = '';
      for (let n = ev.resultIndex || 0; n < ev.results.length; n++) {
        const res = ev.results[n], t = res[0].transcript;
        if (res.isFinal) { if (!s.done.has(n)) { s.done.add(n); takeFinal(t); } }
        else interim += t;
      }
      s.interim = interim.trim();
      const inp = A.$('addItemInput'); if (inp) inp.value = ((s.buf ? s.buf + ' ' : '') + s.interim).slice(0, 200);
      if (s.buf) flushLater();
      idle();
    };
    r.onerror = ev => {
      if (sess !== s) return;
      if (ev.error === 'no-speech' || ev.error === 'aborted') return; // cisza: decyduje licznik ciszy
      s.fatal = SR_ERR[ev.error] || 'Nie udało się rozpoznać mowy. Wpisz rzecz ręcznie.';
      s.stopping = true;
    };
    r.onend = () => {
      if (sess !== s) return;
      if (rec === r) rec = null;
      if (s.fatal) { const m = s.fatal; finish(); setMsg((ui.msg && s.added.length ? ui.msg + ' ' : '') + m); return; }
      if (s.stopping || Date.now() - s.started > DICT_MAX) { finish(); return; }
      // Przeglądarka skończyła sama po pauzie – słuchamy dalej (chyba że minął czas ciszy; wtedy kończy licznik).
      if (s.interim) { takeFinal(s.interim); s.interim = ''; }
      setTimeout(() => { if (sess === s && !s.stopping) startRec(); }, 120);
    };
    try { r.start(); } catch (e) { setMsg('Nie udało się włączyć mikrofonu.'); sess = null; listening = false; rec = null; micState(); }
  }
  A.dictate = () => {
    if (!SR) return;
    if (sess) { stopDict(); return; }
    closeSug();
    sess = { added: [], dup: [], full: false, heard: false, lastFinal: '', interim: '', buf: '', flushT: null, started: Date.now(), timer: null, stopping: false, fatal: '' };
    listening = true; micState();
    setMsg('Słucham… Wymieniaj produkty, np. „pomidory, ziemniaki, dwa jogurty”. Stuknij mikrofon, gdy skończysz.', true);
    idle(); startRec();
  };
  A.stopDictation = () => { if (sess) stopDict(); };

  /* Zakupy (3.0): na górze zawsze jedna linia – nazwa listy z ▾ (panel list), Udostępnij i ⋯. Lista produktów to najważniejsza część. */
  const SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/></svg>';
  function sheetHtml(sh) {
    if (!ui.sheet) return '';
    const canAdd = A.shelves.shelves.length < Shelf.FREE_LIMIT;
    const lists = A.shelves.shelves.map(s => { const n = s.items.filter(i => !i.checked).length; return `<button class="ls-row${s.id === sh.id ? ' on' : ''}" type="button" data-act="shelf-pick" data-id="${esc(s.id)}" aria-pressed="${s.id === sh.id}"><span class="grow">${s.id === sh.id ? '✓ ' : ''}${esc(s.name)}</span><span class="muted">${n ? n + ' do kupienia' : 'pusta'}</span></button>`; }).join('');
    const add = ui.adding ? (canAdd ? `<form class="inline-form" id="newShelfForm" novalidate><input class="field" id="newShelfName" maxlength="30" placeholder="np. Grill w sobotę" aria-label="Nazwa nowej listy"><button class="btn btn-dark btn-sm" type="submit">Dodaj</button><button class="btn btn-white btn-sm" type="button" data-act="shelf-cancel">Anuluj</button></form>`
      : `<div class="ls-note" role="status" id="shelfLimit">Masz już ${Shelf.FREE_LIMIT} darmowe listy. Więcej list i wspólne listy z rodziną będą w Lupka Plus. <button class="linkbtn" type="button" data-act="shelf-cancel">Rozumiem</button></div>`)
      : `<button class="ls-act" type="button" data-act="shelf-new">＋ Nowa lista</button>`;
    const ren = ui.renaming ? `<form class="inline-form" id="renameForm" novalidate><input class="field" id="renameInput" maxlength="30" value="${esc(sh.name)}" aria-label="Nowa nazwa listy"><button class="btn btn-dark btn-sm" type="submit">Zapisz</button></form>`
      : `<button class="ls-act" type="button" data-act="shelf-rename">Zmień nazwę „${esc(sh.name)}”</button>`;
    const del = ui.confirmDelete ? `<div class="ls-note"><b>Usunąć listę „${esc(sh.name)}” razem z produktami?</b><div class="row" style="gap:8px;margin-top:8px"><button class="btn btn-red btn-sm" type="button" data-act="shelf-delete-yes">Usuń</button><button class="btn btn-white btn-sm" type="button" data-act="shelf-delete-no">Zostaw</button></div></div>`
      : `<button class="ls-act red" type="button" data-act="shelf-delete">Usuń listę „${esc(sh.name)}”</button>`;
    return `<div class="ls-dim" data-act="shelf-sheet-close"></div><div class="ls-sheet" role="dialog" aria-modal="true" aria-labelledby="lsTitle"><span class="ls-grab" aria-hidden="true"></span><div class="row" style="justify-content:space-between"><h2 id="lsTitle">Twoje listy</h2><button class="linkbtn" type="button" data-act="shelf-sheet-close">Zamknij</button></div>
      <div class="ls-list">${lists}</div>${add}${ren}<button class="ls-act" type="button" data-act="shelf-clear" ${sh.items.some(i => i.checked) ? '' : 'disabled'}>Usuń kupione z listy</button>${del}
      <p class="msg" role="status">${esc(ui.shelfMsg)}</p><p class="small muted">Za darmo ${Shelf.FREE_LIMIT} listy · więcej w Lupka Plus</p></div>`;
  }
  /* 3.0.2: wynik przy produktach liczymy przy każdym otwarciu listy dla osób wybranych teraz, z danych produktu w telefonie.
     Gdy danych jeszcze nie ma, wiersz nie pokazuje starego wyniku (mógł być liczony dla innych osób), tylko dociągamy dane i odświeżamy. */
  let fresh = new Set(), fetching = false;
  function refreshInfo(sh) {
    fresh = new Set();
    const cache = A.store.get('cache', {}), need = [];
    sh.items.forEach(i => {
      if (!i.code) return;
      const p = (cache[i.code] && cache[i.code].p) || (A.detailCached && A.detailCached(i.code));
      if (!p || p.kind === 'cosmetic') { if (!p) need.push(i.code); return; }
      try {
        const an = analyze(p), pm = personalMatch(p, an, A.profile);
        const up = Shelf.updateInfo(A.shelves, i.code, { pct: pm.pct, fam: A.familyShort ? A.familyShort(p, an) : null });
        if (up.changed) { A.shelves = up.state; A.saveShelves(); }
        fresh.add(i.code);
      } catch (e) { }
    });
    if (need.length && A.loadDetails && !fetching && navigator.onLine !== false) {
      fetching = true;
      A.loadDetails(need.slice(0, 40)).catch(() => false).then(() => { fetching = false; if (A.current.screen === 'shelves' && need.some(c => A.detailCached(c))) render(); });
    }
  }
  function render(focusSel) {
    sug = []; sugIdx = -1;
    refreshInfo(active());
    const sh = active(), pr = Shelf.progress(sh), groups = Shelf.grouped({ items: sh.items.filter(i => !i.checked) }), bought = sh.items.filter(i => i.checked);
    const pct = pr.total ? Math.round(pr.done / pr.total * 100) : 0;
    A.$('scr-shelves').innerHTML = `<div class="wrap shop">
      <div class="shop-hd"><button class="list-sw" type="button" data-act="shelf-sheet" aria-haspopup="dialog" aria-label="Lista: ${esc(sh.name)}. Zmień listę albo zarządzaj"><b>${esc(sh.name)}</b><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
        <button class="btn btn-white iconbtn" type="button" data-act="shelf-share" aria-label="Udostępnij listę" ${pr.total ? '' : 'disabled'}>${SHARE}</button><button class="btn btn-white iconbtn" type="button" data-act="shelf-sheet" aria-label="Więcej: listy, zmiana nazwy, usuwanie">⋯</button></div>
      ${pr.total ? `<div class="shop-prog"><span class="xp green" role="progressbar" aria-valuenow="${pr.done}" aria-valuemin="0" aria-valuemax="${pr.total}" aria-label="Postęp zakupów"><i style="width:${pct}%"></i></span><span>w koszyku ${pr.done} z ${pr.total}</span></div>` : ''}
      <form class="inline-form add-item-form" id="addItemForm" novalidate><div class="sug-wrap"><input class="field" id="addItemInput" maxlength="60" autocomplete="off" placeholder="${SR ? 'Dodaj albo podyktuj…' : 'Dodaj, np. 2 kg ziemniaki'}" aria-label="Dodaj rzecz do listy" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="addSuggest"><ul class="sug-list" id="addSuggest" role="listbox" aria-label="Podpowiedzi" hidden></ul></div>${SR ? `<button class="btn btn-white iconbtn mic-btn" type="button" id="micBtn" data-act="dictate" aria-pressed="${listening ? 'true' : 'false'}" aria-label="${listening ? 'Zatrzymaj dyktowanie' : 'Dyktuj listę'}">${MIC}</button>` : ''}<button class="btn btn-dark iconbtn" type="submit" aria-label="Dodaj"><svg><use href="#i-plus"/></svg></button></form>
      <p class="msg${ui.msgInfo ? ' msg-info' : ''}" role="status" id="itemMsg">${esc(ui.msg)}</p>
      ${quickHtml(sh)}
      ${sh.items.length ? `<div class="shop-items" id="shelfItems">${groups.length ? groups.map(g => `<h3 class="dept-h">${esc(g.label)}</h3><div class="sgroup">${g.items.map(itemHtml).join('')}</div>`).join('') : '<div class="empty" id="allBought"><b style="font-family:var(--f-display);color:var(--ink)">Wszystko w koszyku ✓</b></div>'}</div>
        ${bought.length ? `<details class="bought" id="boughtBox"${ui.showBought ? ' open' : ''}><summary>W koszyku: ${bought.length} <span class="muted">· ${ui.showBought ? 'zwiń' : 'pokaż'}</span></summary><div class="sgroup" style="margin-top:8px">${bought.map(itemHtml).join('')}</div></details>` : ''}`
        : `<div class="empty stack" style="align-items:center"><b style="font-family:var(--f-display);color:var(--ink)">Lista jest pusta</b><span>Wpisz albo podyktuj, co kupić, np. „mleko, chleb i dwa jogurty”. Produkty dodasz też przyciskiem „Na listę” po skanie.</span></div>`}
      ${A.quiet && A.quiet() ? '' : `<p class="small center muted shop-pts">Odhaczysz całą listę (min. 3 rzeczy) w sklepie? <b>+10 pkt</b></p>`}
    </div>${sheetHtml(sh)}`;
    document.body.classList.toggle('sheet-open', !!ui.sheet);
    if (focusSel) { const f = A.$('scr-shelves').querySelector(focusSel); if (f) f.focus(); }
    const bb = A.$('boughtBox'); if (bb) bb.addEventListener('toggle', () => { ui.showBought = bb.open; const m = bb.querySelector('summary .muted'); if (m) m.textContent = '· ' + (bb.open ? 'zwiń' : 'pokaż'); });
  }

  const ERR = { name: 'Wpisz nazwę.', duplicate: 'Taka nazwa już jest na liście.', full: 'Ta lista jest pełna (200 rzeczy). Usuń kupione albo wybierz inną.', limit: 'Masz już maksymalną liczbę darmowych list.' };
  A.closeSheet = () => A.shelfAction('shelf-sheet-close');
  A.shelfAction = (act, el) => {
    if (act === 'shelf-sheet') { ui.sheet = true; ui.adding = false; ui.renaming = false; ui.confirmDelete = false; ui.shelfMsg = ''; render('.ls-sheet .ls-row.on'); }
    else if (act === 'shelf-sheet-close') { ui.sheet = false; ui.adding = ui.renaming = ui.confirmDelete = false; render('.list-sw'); }
    else if (act === 'shelf-pick') { A.shelves = Shelf.setActive(A.shelves, el.dataset.id).state; A.saveShelves(); ui.msgInfo = false; ui.msg = ''; ui.renaming = false; ui.confirmDelete = false; ui.sheet = false; render('.list-sw'); }
    else if (act === 'shelf-new') { ui.sheet = true; ui.adding = true; ui.shelfMsg = ''; render(A.shelves.shelves.length < Shelf.FREE_LIMIT ? '#newShelfName' : '#shelfLimit button'); }
    else if (act === 'shelf-cancel') { ui.adding = false; render('[data-act=shelf-new]'); }
    else if (act === 'shelf-rename') { ui.sheet = true; ui.renaming = true; render('#renameInput'); }
    else if (act === 'shelf-delete') { ui.sheet = true; ui.confirmDelete = true; render('[data-act=shelf-delete-no]'); }
    else if (act === 'shelf-delete-no') { ui.confirmDelete = false; render('[data-act=shelf-delete]'); }
    else if (act === 'shelf-delete-yes') { const name = active().name; A.shelves = Shelf.deleteShelf(A.shelves, active().id).state; A.saveShelves(); ui.confirmDelete = false; ui.shelfMsg = ''; ui.sheet = false; render(); A.toast(`Usunięto listę „${name}”.`); }
    else if (act === 'item-toggle') {
      const r = Shelf.toggleItem(A.shelves, active().id, el.dataset.id);
      if (r.error) return;
      A.shelves = r.state; A.saveShelves();
      if (r.item && r.item.checked) rememberBought(r.item);
      if (r.completed) {
        const g = A.award('list_completed', { shelfId: active().id });
        A.toast(g.gained ? 'Cała lista kupiona! Brawo!' : 'Cała lista kupiona!');
      }
      render(`[data-act=item-toggle][data-id="${el.dataset.id}"]`);
    }
    else if (act === 'qadd') {
      const x = quickList(active()).find(q => q.k === el.dataset.k); if (!x) return;
      const r = Shelf.addItem(A.shelves, active().id, { name: x.name, code: x.code || undefined, pct: x.pct, categories: x.categories, qty: 1, unit: 'szt' });
      if (r.error) { ui.msgInfo = false; ui.msg = r.error === 'full' ? ERR.full : 'Nie udało się dodać.'; render(); return; }
      A.shelves = r.state; A.saveShelves(); ui.msgInfo = false; ui.msg = ''; render('#addItemInput'); A.announce(`Dodano: ${x.name}.`);
    }
    else if (act === 'sug-add') addSug(+el.dataset.i);
    else if (act === 'dictate') A.dictate();
    else if (act === 'item-qty') { const fromName = el.classList.contains('t1-edit'); ui.qty = ui.qty === el.dataset.id ? null : el.dataset.id; render(ui.qty ? (fromName ? '#itemNameInput' : '#qtyInput') : `[data-act=item-qty][data-id="${el.dataset.id}"]`); }
    else if (act === 'qty-minus' || act === 'qty-plus') {
      const inp = A.$('qtyInput'), unit = A.$('qtyUnit').value, step = unit === 'g' || unit === 'ml' ? 100 : unit === 'kg' || unit === 'l' ? 0.5 : 1;
      const v = parseFloat(String(inp.value).replace(',', '.')) || 0, n = Math.max(step, Math.round((v + (act === 'qty-plus' ? step : -step)) * 1000) / 1000);
      inp.value = String(n).replace('.', ',');
    }
    else if (act === 'item-remove') { A.shelves = Shelf.removeItem(A.shelves, active().id, el.dataset.id).state; A.saveShelves(); render('#addItemInput'); }
    else if (act === 'shelf-clear') { const r = Shelf.clearChecked(A.shelves, active().id); A.shelves = r.state; A.saveShelves(); ui.sheet = false; render(); A.toast(`Usunięto ${r.removed} ${plural(r.removed, 'kupioną rzecz', 'kupione rzeczy', 'kupionych rzeczy')}.`); }
    else if (act === 'shelf-share') shareShelf();
  };
  A.shelfSubmit = form => {
    if (form.id === 'newShelfForm') {
      const r = Shelf.addShelf(A.shelves, A.$('newShelfName').value);
      if (r.error) { ui.shelfMsg = ERR[r.error] || 'Nie udało się dodać listy.'; render('#newShelfName'); return; }
      A.shelves = r.state; A.saveShelves(); ui.adding = false; ui.shelfMsg = ''; ui.sheet = false; render('#addItemInput');
    } else if (form.id === 'renameForm') {
      const r = Shelf.renameShelf(A.shelves, active().id, A.$('renameInput').value);
      if (r.error) { ui.shelfMsg = ERR[r.error] || 'Nie udało się zmienić nazwy.'; render('#renameInput'); return; }
      A.shelves = r.state; A.saveShelves(); ui.renaming = false; ui.shelfMsg = ''; render('[data-act=shelf-rename]');
    } else if (form.id === 'qtyForm') {
      const id = form.dataset.id, ni = A.$('itemNameInput');
      if (ni) {
        const rn = Shelf.renameItem(A.shelves, active().id, id, ni.value);
        if (rn.error === 'empty' || rn.error === 'duplicate') { A.$('itemEditMsg').textContent = rn.error === 'empty' ? 'Wpisz nazwę.' : `„${rn.item.name}” już jest na tej liście.`; ni.focus(); return; }
        if (!rn.error) A.shelves = rn.state;
      }
      const r = Shelf.setQty(A.shelves, active().id, id, A.$('qtyInput').value, A.$('qtyUnit').value);
      if (!r.error) A.shelves = r.state;
      A.saveShelves();
      ui.qty = null; render(`[data-act=item-qty][data-id="${id}"]`);
    } else if (form.id === 'addItemForm') {
      const val = A.$('addItemInput').value;
      const r = Shelf.addItem(A.shelves, active().id, { name: val });
      if (r.error) { ui.msgInfo = false; ui.msg = r.error === 'duplicate' ? `„${r.item.name}” już jest na tej liście.` : (ERR[r.error] || 'Nie udało się dodać.'); render('#addItemInput'); A.$('addItemInput').value = val; return; }
      A.shelves = r.state; A.saveShelves(); ui.msgInfo = !!r.restored; ui.msg = r.restored ? `Przywrócono „${r.item.name}” na listę.` : ''; render('#addItemInput');
    }
  };
  async function shareShelf() {
    const sh = active(), text = Shelf.shareText(sh);
    let done = false;
    if (navigator.share) { try { await navigator.share({ title: sh.name, text }); done = true; } catch (e) { if (e && e.name === 'AbortError') return; } }
    if (!done) { try { await navigator.clipboard.writeText(text); done = true; A.toast('Skopiowano listę. Wklej ją w SMS-ie albo komunikatorze.'); } catch (e) { A.toast('Nie udało się udostępnić listy.'); } }
    if (done) A.award('shelf_shared', {});
  }
  A.renderShelvesIfOpen = () => { if (A.current.screen === 'shelves') render(); };
})();
