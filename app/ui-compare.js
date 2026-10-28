/* Lupka 2.4 – porównanie 2–3 produktów (#/porownaj) i wyszukiwanie po nazwie (#/szukaj).
   Porównanie: wynik kolumny = ten sam wynik co wszędzie (A.groupMatch: najniższy wśród włączonych osób) albo wynik wybranej osoby.
   Produkt, który komuś nie pasuje, nie wygrywa; różnica < 5 punktów = „podobnie”. Lista porównania w telefonie (d-cmp, do 3 produktów).
   Wyszukiwanie: pośrednik /search (Open Food Facts, produkty z Polski), wyniki przeliczane na pełnych danych z /details, jak listy. */
'use strict';
(() => {
  const A = App, esc = A.esc;
  const MAX = 3, KEY = 'd-cmp', TIE = 5;

  /* ---------- Lista porównania ---------- */
  const valid = x => x && typeof x === 'object' && /^\d{6,14}$/.test(String(x.code || '')) && x.p && typeof x.p === 'object';
  A.cmp = (v => (Array.isArray(v) ? v.filter(valid) : []).slice(-MAX))(A.store.get(KEY, []));
  const save = () => { if (!A.store.set(KEY, A.cmp)) { A.cmp = A.cmp.slice(-2); A.store.set(KEY, A.cmp); } };
  A.inCmp = code => A.cmp.some(x => x.code === code);
  // Zapisujemy produkt razem z danymi, żeby porównanie działało też bez sieci i po zamknięciu aplikacji.
  const slim = p => { const o = Object.assign({}, p); delete o.raw; return o; };
  A.cmpAdd = prod => {
    if (!prod || !prod.code || prod.kind === 'cosmetic') return false;
    A.cmp = A.cmp.filter(x => x.code !== prod.code).concat({ code: prod.code, p: slim(prod), at: Date.now() }).slice(-MAX);
    save(); A.track('porownaj-dodaj'); return true;
  };
  A.cmpRemove = code => { A.cmp = A.cmp.filter(x => x.code !== code); save(); };
  A.cmpClear = () => { A.cmp = []; save(); };

  /* Pasek „Porównujesz 2 produkty · Pokaż” nad menu (jak pasek nagród). */
  A.cmpBar = () => {
    const bar = A.$('cmpBar'); if (!bar) return;
    const scr = A.current && A.current.screen, n = A.cmp.length;
    if (!n || scr === 'compare' || scr === 'start') { bar.hidden = true; bar.innerHTML = ''; document.body.classList.remove('has-cmpbar'); return; }
    const thumbs = A.cmp.map(x => { const img = A.safeImg(x.p.image); return img ? `<img src="${esc(img)}" alt="">` : '<span class="cb-dot"></span>'; }).join('');
    bar.innerHTML = `<span class="cb-thumbs" aria-hidden="true">${thumbs}</span><span class="grow"><b>${n === 1 ? 'W porównaniu: 1 produkt' : `Porównujesz ${n} produkty`}</b><span>${esc(A.cmp.map(x => x.p.name).join(', '))}</span></span>`
      + (n > 1 ? '<a class="btn btn-gold btn-sm" href="#/porownaj">Pokaż</a>' : '<button class="btn btn-white btn-sm" type="button" data-act="cmp-scan">Skanuj drugi</button>')
      + '<button class="rw-x" type="button" data-act="cmp-clear" aria-label="Wyczyść porównanie"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    bar.hidden = false; document.body.classList.add('has-cmpbar');
  };
  const render0 = A.render;
  A.render = () => { render0(); A.cmpBar(); };

  /* Przycisk ⇄ przy produkcie na liście i w wynikach wyszukiwania. */
  A.cmpBtnHtml = (code, name) => { const on = A.inCmp(code); return `<button class="cmp-btn${on ? ' on' : ''}" type="button" data-act="cmp-toggle" data-code="${esc(code)}" aria-pressed="${on}" aria-label="${on ? 'Usuń z porównania' : 'Porównaj'}: ${esc(name || '')}">${on ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h14l-4-4M20 16H6l4 4"/></svg>'}</button>`; };

  /* Podpowiedź na ekranie produktu: drugi produkt z tej samej kategorii sprawdzony w ciągu 15 minut. */
  A.cmpSuggest = prod => {
    if (!prod || !prod.code || prod.kind === 'cosmetic') return null;
    const key = A.catKeyOf(prod.categories) || A.catKeyByName(prod.name); if (!key) return null;
    const cache = A.store.get('cache', {});
    const h = A.store.get('history', []).find(x => x && x.code && x.code !== prod.code && Date.now() - (x.at || 0) < 15 * 60e3);
    if (!h || (A.catKeyOf(h.categories) || A.catKeyByName(h.name)) !== key) return null;
    if (A.inCmp(h.code) && A.inCmp(prod.code)) return null;
    const p = cache[h.code] && cache[h.code].p; if (!p) return null;
    return p;
  };
  A.cmpSuggestHtml = prod => {
    const p = A.cmpSuggest(prod); if (!p) return '';
    const g = A.groupMatch(p, analyze(p)), img = A.safeImg(p.image), ns = A.profile.noScores;
    return `<div class="cmp-sug" id="cmpSug">${img ? `<img class="thumb${ns ? '' : A.ringStyle(g.pct)}" src="${esc(img)}" alt="">` : ''}<span class="grow"><small>PRZED CHWILĄ SPRAWDZIŁEŚ</small><b>${esc(p.name)}${!ns && g.pct != null ? ' · ' + g.pct + '%' : ''}</b></span>`
      + `<button class="btn btn-dark btn-sm" type="button" data-act="cmp-pair" data-code="${esc(p.code)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h14l-4-4M20 16H6l4 4"/></svg>Porównaj</button></div>`;
  };

  /* Skan z „Skanuj drugi/trzeci”: zeskanowany produkt od razu trafia do porównania (do 3 minut od otwarcia skanera). */
  A.cmpAfterScan = prod => {
    if (!A.cmpWaiting || Date.now() - A.cmpWaiting > 180e3 || !prod || !prod.code || prod.kind === 'cosmetic' || A.inCmp(prod.code)) return false;
    A.cmpWaiting = 0;
    A.cmpAdd(prod);
    A.cmpBar();
    if (A.cmp.length > 1) { location.hash = '#/porownaj'; return true; }
    return false;
  };

  /* ---------- Ekran porównania ---------- */
  let who = 'all';
  const nameOf = r => r.id === 'me' ? 'Ty' : r.name;
  const people = () => { const f = A.famOn && A.famOn() ? A.activeRows() : null; return f && f.length > 1 ? f : null; };
  const fmt = v => String(Math.round(v * 10) / 10).replace('.', ',');
  const NUM = { sugar: ['sugars', ' g'], salt: ['salt', ' g'], satfat: ['sat', ' g'], kcal: ['kcal', ' kcal'], protein: ['proteins', ' g'], fiber: ['fiber', ' g'] };
  const RANK = { low: 0, mid: 1, high: 2 };
  // Wiersz „Co je różni”: wartości kolumn + kierunek (-1: mniej = lepiej, 1: więcej = lepiej).
  function diffRows(items, fam) {
    const rows = [];
    const profs = fam || [{ id: 'me', name: 'Ty', p: A.profile }];
    const keys = WATCH.map(w => w.key).filter(k => profs.some(r => (r.p.watch || []).includes(k)));
    keys.forEach(k => {
      const w = WATCH.find(x => x.key === k), whoW = fam ? profs.filter(r => (r.p.watch || []).includes(k)).map(nameOf) : [];
      const cells = items.map(x => {
        const ins = watchInsights(x.p, x.an, [k])[0] || {}, nm = x.p.nutriments || {};
        if (NUM[k]) { const v = nm[NUM[k][0]]; return { v: v == null ? null : v, t: v == null ? '–' : fmt(v) + NUM[k][1], word: ins.word }; }
        if (w.kind === 'contains') return { v: ins.level == null ? null : ins.level === 'yes' ? 1 : 0, t: ins.level == null ? 'nie wiemy' : ins.level === 'yes' ? 'zawiera' : 'nie zawiera' };
        return { v: ins.level == null ? null : RANK[ins.level], t: ins.level == null ? '–' : (ins.value || ins.word) };
      });
      rows.push({ t: w.label.replace(' (więcej)', ''), who: whoW.length === profs.length && profs.length > 1 ? 'pilnujecie wszyscy' : whoW.join(', '), dir: w.kind === 'more' ? 1 : -1, bin: w.kind === 'contains', cells });
    });
    // „Nie jem” każdej osoby: zawiera / może zawierać / nie wiemy / nie zawiera.
    profs.forEach(r => {
      const p = r.p || {}; const n = (p.allergens || []).length + (p.diet || []).length + (p.avoid || []).length + (p.custom || []).length;
      if (!n) return;
      const cells = items.map(x => { const m = personalMatch(x.p, x.an, p); const s = m.status;
        return s === 'fail' ? { v: 1, t: 'zawiera: ' + ((m.match && m.match.fails) || []).map(f => String(f.label).toLowerCase()).join(', '), bad: true }
          : s === 'traces' ? { v: 0.5, t: 'może zawierać' } : s === 'unknown' ? { v: null, t: 'nie wiemy' } : { v: 0, t: 'nie zawiera' }; });
      rows.push({ t: (fam ? nameOf(r) + ': ' : '') + 'nie je', who: '', dir: -1, bin: true, cells });
    });
    if (!keys.includes('protein')) rows.push({ t: 'Białko', who: '', dir: 1, cells: items.map(x => { const v = (x.p.nutriments || {}).proteins; return { v: v == null ? null : v, t: v == null ? '–' : fmt(v) + ' g' }; }) });
    rows.push({ t: 'Dodatki E', who: '', dir: -1, cells: items.map(x => { const k = x.an && x.an.additivesKnown, n = ((x.an && x.an.additives) || []).length; return { v: k ? n : null, t: k ? String(n) : '–' }; }) });
    rows.push({ t: 'Przetworzenie', who: 'NOVA 1–4', dir: -1, cells: items.map(x => { const n = Number(x.p.nova); return { v: n >= 1 && n <= 4 ? n : null, t: n >= 1 && n <= 4 ? 'NOVA ' + n : '–' }; }) });
    rows.push({ t: 'Ocena składu', who: 'taka sama dla wszystkich', dir: 1, cells: items.map(x => ({ v: x.an.score == null ? null : x.an.score, t: x.an.score == null ? '–' : String(x.an.score) })) });
    // Lepsza wartość: zielona kropka; wyraźnie gorsza (ponad 1,5 raza albo „zawiera”): czerwony tekst.
    rows.forEach(r => {
      const vals = r.cells.map(c => c.v).filter(v => v != null);
      if (vals.length < 2 || vals.every(v => v === vals[0])) return;
      const best = r.dir > 0 ? Math.max(...vals) : Math.min(...vals);
      r.cells.forEach(c => {
        if (c.v == null) return;
        c.good = c.v === best;
        c.worse = !c.good && (r.bin ? c.v >= 1 : r.dir > 0 ? c.v < best / 1.5 : c.v > Math.max(best * 1.5, best + 0.0001) && c.v - best >= (best < 1 ? 0.3 : 1));
      });
    });
    return rows;
  }
  function renderCompare() {
    const el = A.$('scr-compare'); if (!el) return;
    const fam = people(); if (!fam || (who !== 'all' && !fam.some(r => r.id === who))) who = 'all';
    const ns = !!A.profile.noScores;
    const items = A.cmp.map(x => { const p = x.p, an = analyze(p); const row = fam && who !== 'all' ? fam.find(r => r.id === who) : null;
      const m = row ? personalMatch(p, an, row.p) : A.groupMatch(p, an); return { code: x.code, p, an, m, bad: m.status === 'fail' }; });
    const top = `<div class="topbar"><button class="btn btn-white iconbtn" type="button" data-act="back" aria-label="Wróć"><svg><use href="#i-back"/></svg></button><h1 class="grow cmp-h1">Porównanie</h1>${items.length ? '<button class="btn btn-white btn-sm" type="button" data-act="cmp-clear">Wyczyść</button>' : ''}</div>`;
    if (items.length < 2) {
      el.innerHTML = `<div class="wrap">${top}<div class="empty stack" style="align-items:center;text-align:center"><b style="font-family:var(--f-display);font-size:1.2rem">${items.length ? 'Dodaj drugi produkt' : 'Nic jeszcze nie porównujesz'}</b><span>Zeskanuj produkt albo znajdź go w wyszukiwarce i stuknij „Porównaj”. Porównasz 2 albo 3 produkty naraz.</span>
        <div class="row" style="gap:10px;flex-wrap:wrap;justify-content:center"><button class="btn btn-dark" type="button" data-act="cmp-scan"><svg><use href="#i-scan"/></svg>Skanuj</button><a class="btn btn-white" href="#/szukaj">Szukaj</a></div></div>
        ${items.length ? `<div class="list">${items.map(x => `<div class="item"><span class="grow t1">${esc(x.p.name)}</span><button class="btn btn-white btn-sm" type="button" data-act="cmp-remove" data-code="${esc(x.code)}">Usuń</button></div>`).join('')}</div>` : ''}</div>`;
      return;
    }
    const order = items.map((x, i) => i).sort((a, b) => (items[a].bad - items[b].bad) || ((items[b].m.pct ?? -1) - (items[a].m.pct ?? -1)));
    const bi = order[0], b2 = order[1], B = items[bi], S2 = items[b2];
    const tie = !B.bad && !S2.bad && B.m.pct != null && S2.m.pct != null && B.m.pct - S2.m.pct < TIE;
    const allBad = items.every(x => x.bad);
    const best = tie || allBad || B.m.pct == null ? -1 : bi;
    // Wynik produktu z brakami w bazie jest wstępny: nie mówimy, że jest gorszy, tylko że o nim mniej wiemy.
    items.forEach(x => { x.gaps = A.dataGaps ? A.dataGaps(x.p) : []; });
    const unsure = best >= 0 && !B.gaps.length && items.some((x, i) => i !== bi && !x.bad && x.gaps.length);
    const off = A.offRows ? A.offRows() : [];
    const whoLbl = !fam ? 'dla Ciebie' : who === 'all' ? (off.length ? fam.length + (fam.length < 5 ? ' osoby' : ' osób') : 'rodzina') : who === 'me' ? 'dla Ciebie' : (fam.find(r => r.id === who) || {}).name;
    const lbl = x => x.bad ? x.m.label || 'Nie pasuje' : (who === 'all' ? x.m.label : x.m.label);
    const cols = items.length;
    const card = (x, i) => { const img = A.safeImg(x.p.image), pct = x.m.pct, c = pct != null ? A.scoreColor(pct) : null;
      return `<a class="cmp-card${i === best ? ' best' : ''}${x.bad ? ' bad' : ''}" href="#/p/${esc(x.code)}">${i === best ? `<span class="cmp-crown">${unsure ? 'Pełniejsze dane' : 'Lepszy wybór'}</span>` : ''}
        ${img ? `<span class="cmp-plate${ns || pct == null ? '' : ' has-score'}"${ns || pct == null ? '' : ` style="--sc:${c};--pdeg:${Math.max(4, Math.round(pct * 3.6))}deg"`}><img src="${esc(img)}" alt=""></span>` : `<span class="cmp-plate noimg">${art('dept_' + departmentFor(x.p), 54)}</span>`}
        ${ns ? '' : `<span class="cmp-badge"${pct != null ? A.pctStyle(pct) : ''}><b>${x.bad ? '✕' : pct == null ? '?' : pct + '%'}</b><span>${esc(whoLbl)}</span></span>`}
        <span class="cmp-name">${A.splitName(x.p.name)}</span><span class="cmp-meta">${esc([x.p.brand, x.p.quantity].filter(Boolean).join(' · '))}</span>
        <span class="cmp-lbl"${x.bad ? ' style="color:#7A1A13"' : pct != null ? ` style="${A.pctText(pct)}"` : ''}>${esc(lbl(x))}</span>${x.gaps.length && !x.bad ? `<span class="cmp-gap">dane niepełne: brak ${esc(x.gaps.join(' i '))}</span>` : ''}</a>`; };
    const nm = x => x.p.name;
    let vh, vs, vtone;
    if (allBad) { vh = 'Żaden nie pasuje'; vs = items.map(x => nm(x) + ': ' + lbl(x)).join(' · '); vtone = 'bad'; }
    else if (B.m.pct == null) { vh = 'Za mało danych, żeby wybrać'; vs = items.map(x => nm(x) + ': ' + lbl(x)).join(' · ') + '. Sprawdź etykiety.'; vtone = 'tie'; }
    else if (tie) { vh = 'Podobnie: ' + (ns ? '' : `${B.m.pct}% i ${S2.m.pct}%`); vs = 'Różnica poniżej 5 punktów. Wybierz, co bardziej lubicie.'; vtone = 'tie'; }
    else if (unsure) { vh = 'Pełniejsze dane: ' + nm(B) + (ns ? '' : ` (${B.m.pct}%)`);
      vs = items.filter((x, i) => i !== bi && x.gaps.length && !x.bad).map(x => `${nm(x)}: w bazie brakuje ${x.gaps.join(' i ')}`).join(' · ') + '. Nie wiemy, czy jest gorszy – sprawdź etykietę.'; vtone = 'tie'; }
    else { vh = 'Lepszy wybór' + (!fam ? ' dla Ciebie' : who === 'all' ? (fam.length === 2 ? ' dla Was obojga' : ' dla wszystkich') : who === 'me' ? ' dla Ciebie' : ' · ' + whoLbl) + ': ' + nm(B);
      vs = items.filter((x, i) => i !== bi).map(x => nm(x) + ': ' + (x.bad || ns || x.m.pct == null ? lbl(x).replace(/^./, c => c.toLowerCase()) : x.m.pct + '%')).join(' · '); vtone = 'ok'; }
    const vc = vtone === 'ok' && B.m.pct != null ? A.scoreColor(B.m.pct) : null;
    const chips = fam ? `<div class="chips cmp-who" role="group" aria-label="Wynik dla">${[['all', off.length ? 'Wybrani' : 'Wszyscy']].concat(fam.map(r => [r.id, nameOf(r)])).map(([k, l]) => `<button class="cat-tab" type="button" data-act="cmp-who" data-who="${esc(k)}" aria-pressed="${k === who}">${esc(l)}</button>`).join('')}</div>` : '';
    const grid = `style="grid-template-columns:${cols === 2 ? '1fr 1fr' : '1fr 1fr 1fr'}"`, rgrid = `style="grid-template-columns:${cols === 2 ? 'minmax(84px,.9fr) 1fr 1fr' : 'minmax(74px,.8fr) 1fr 1fr 1fr'}"`;
    const famTable = fam ? `<div class="panel cmp-tab"><span class="cmp-k">DLA KOGO</span>${fam.map(r => `<div class="cmp-row" ${rgrid}><b>${esc(nameOf(r))}</b>${items.map(x => { const s = A.personState(x.p, x.an, r.p);
        const v = s.st === 'bad' ? '✕' : s.st === 'unk' ? '?' : ns ? (s.st === 'ok' ? 'pasuje' : 'słabo') : s.pm.pct + '%';
        return `<span class="cmp-cell"><span class="cmp-chip"${s.st === 'bad' ? ' style="background:#FDE6E1"' : s.st === 'unk' || ns ? '' : A.pctStyle(s.pm.pct)}>${esc(v)}</span>${s.st === 'ok' ? '' : `<small>${esc(s.why)}</small>`}</span>`; }).join('')}</div>`).join('')}</div>` : '';
    const rows = diffRows(items, fam);
    const diff = `<div class="panel cmp-tab"><span class="cmp-k">CO JE RÓŻNI · NA 100 G</span>${rows.map(r => `<div class="cmp-row" ${rgrid}><span class="cmp-rt"><b>${esc(r.t)}</b>${r.who ? `<small>${esc(r.who)}</small>` : ''}</span>${r.cells.map(c => `<span class="cmp-val${c.good ? ' good' : ''}${c.worse || c.bad ? ' worse' : ''}">${esc(c.t)}</span>`).join('')}</div>`).join('')}
      <p class="small muted" style="margin:6px 0 0">Zielona kropka: lepsza wartość. Najpierw to, czego pilnujecie.</p></div>`;
    const acts = `<div class="cmp-acts" ${grid}>${items.map((x, i) => i === best ? `<button class="btn btn-dark btn-sm" type="button" data-act="cmp-shelf" data-code="${esc(x.code)}"${Shelf.hasCode(A.shelves, x.code) ? ' disabled' : ''}>${Shelf.hasCode(A.shelves, x.code) ? 'Już na półce' : 'Na półkę'}</button>` : `<button class="btn btn-white btn-sm" type="button" data-act="cmp-remove" data-code="${esc(x.code)}">Usuń</button>`).join('')}</div>`;
    const more = items.length < MAX ? `<div class="row" style="gap:10px"><button class="btn btn-white grow" type="button" data-act="cmp-scan"><svg><use href="#i-scan"/></svg>Skanuj trzeci</button><a class="btn btn-white grow" href="#/szukaj">Szukaj</a></div>` : '<p class="small muted center">Najwyżej 3 produkty naraz. Kolejny zastąpi najstarszy.</p>';
    el.innerHTML = `<div class="wrap cmp"${vc ? ` style="--sc:${vc}"` : ''}><span class="d-arc" aria-hidden="true"></span>${top}${chips}
      <div class="cmp-cards" ${grid}>${items.map(card).join('')}</div>
      <div class="cmp-verdict" data-tone="${vtone}" role="status"><b>${esc(vh)}</b><span>${esc(vs)}</span></div>
      ${famTable}${diff}${acts}${more}</div>`;
  }
  A.route('compare', () => { renderCompare(); });
  A.cmpRender = () => { if (A.current.screen === 'compare') renderCompare(); };

  /* ---------- Wyszukiwanie ---------- */
  const SQ = new Map(); // zapytanie → { at, list }
  let sToken = 0, sTimer = null, sQuery = '', sItems = [];
  const fq = s => fold(String(s || '')).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const recent = () => (v => Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 6) : [])(A.store.get('d-recentq', []));
  const addRecent = q => { const r = [q].concat(recent().filter(x => fq(x) !== fq(q))).slice(0, 6); A.store.set('d-recentq', r); };
  function catHits(q) {
    const ws = fq(q).split(' ').filter(w => w.length >= 3); if (!ws.length) return [];
    return SHOP_CATEGORIES.filter(c => { const l = fq(c.label); return ws.some(w => l.split(' ').some(x => x.startsWith(w.slice(0, Math.max(4, w.length - 2))))); }).slice(0, 3);
  }
  /* Trafność: ile słów zapytania jest w nazwie, marce albo kategorii produktu. Polskie końcówki się zmieniają
     („wiśnia” – „wiśniowy”), więc dłuższe słowa porównujemy po początku. Wyszukiwarka bazy zwraca też produkty
     z częścią słów; pokazujemy tylko te, które mają wszystkie (a gdy takich nie ma – najwięcej). */
  const stem = w => w.length <= 3 ? w : w.slice(0, Math.max(4, w.length - 2));
  const words = q => fq(q).split(' ').filter(w => w.length >= 2);
  const relevance = (p, ws) => { const t = ' ' + fq([p.name, p.brand, p.categoryName].join(' ')) + ' '; return ws.filter(w => t.includes((w.length <= 3 ? ' ' : '') + stem(w))).length; };
  A.searchRelevant = (list, q) => {
    const ws = words(q); if (!ws.length) return list;
    const scored = list.map(p => ({ p, r: relevance(p, ws) })), best = Math.max(0, ...scored.map(x => x.r));
    return best ? scored.filter(x => x.r === best).map(x => x.p) : [];
  };
  // Produkty z telefonu (historia, porównanie) – od razu i bez sieci.
  function localHits(q) {
    const ws = words(q); if (!ws.length) return [];
    const cache = A.store.get('cache', {}), seen = new Set(), out = [];
    Object.values(cache).map(c => c && c.p).concat(A.cmp.map(x => x.p)).forEach(p => {
      if (!p || !p.code || seen.has(p.code) || p.kind === 'cosmetic') return; seen.add(p.code);
      if (relevance(p, ws) === ws.length) out.push(p);
    });
    return out;
  }
  async function remote(q) {
    const key = fq(q), hit = SQ.get(key);
    if (hit && Date.now() - hit.at < 3600e3) return hit.list;
    const proxy = (A.CFG.offProxyUrl || '').replace(/\/$/, '');
    if (!proxy) return [];
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch(`${proxy}/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
      if (!r.ok) throw A.fetchError(r.status === 429 ? 'rate' : 'server');
      const j = await r.json();
      const list = (j && Array.isArray(j.products) ? j.products : []).filter(x => x && x.code).map(x => normalizeProduct(x, 'off')).filter(p => p.name && p.kind !== 'cosmetic');
      SQ.set(key, { at: Date.now(), list }); return list;
    } catch (e) { throw e && e.kind ? e : A.fetchError(navigator.onLine === false ? 'offline' : 'network'); }
    finally { clearTimeout(t); }
  }
  const rank = list => list.map(p => { const pr = A.withDetail ? A.withDetail(p) : p, an = analyze(pr); return { pr, an, m: A.groupMatch(pr, an) }; })
    .sort((a, b) => ((a.m.status === 'fail') - (b.m.status === 'fail')) || ((a.m.pct == null) - (b.m.pct == null)) || ((b.m.pct ?? 0) - (a.m.pct ?? 0)));
  function rowHtml(x) {
    const img = A.safeImg(x.pr.image), ns = A.profile.noScores, bad = x.m.status === 'fail', pct = x.m.pct;
    return `<div class="item srch-item${bad ? ' dim' : ''}"><a href="#/p/${esc(x.pr.code)}" class="row grow" style="text-decoration:none;color:inherit;min-width:0">
      ${img ? `<img class="thumb${ns || pct == null ? '' : A.ringStyle(pct)}" src="${esc(img)}" alt="" loading="lazy">` : `<span class="thumb">${art('dept_' + departmentFor(x.pr), 34)}</span>`}
      <span class="grow"><span class="t1">${esc(x.pr.name)}</span><span class="t2">${esc([x.pr.brand, x.pr.quantity].filter(Boolean).join(' · '))}</span><span class="t2 srch-lbl"${bad ? ' style="color:#7A1A13"' : pct != null ? ` style="${A.pctText(pct)}"` : ''}>${esc(x.m.label)}</span></span>
      ${ns ? '' : `<span class="pct"${bad ? ' style="background:#FDE6E1"' : A.pctStyle(pct)}>${bad ? '✕' : pct == null ? '–' : pct + '%'}</span>`}</a>${A.cmpBtnHtml(x.pr.code, x.pr.name)}</div>`;
  }
  function drawResults(q, list, state) {
    const box = A.$('srchRes'); if (!box) return;
    const cats = catHits(q);
    const catHtml = cats.length ? `<div class="chips srch-cats">${cats.map(c => `<a class="cat-tab on" href="#/lista/${esc(c.key)}">Kategoria: ${esc(c.label)} ›</a>`).join('')}</div>` : '';
    sItems = list;
    let body = '';
    if (list.length) body = `<p class="small muted srch-count">${state === 'local' ? 'Z Twoich ostatnich produktów · szukam w bazie…' : list.length > 20 ? `Pokazujemy 20 najlepszych z ${list.length}. Najpierw najlepsze dla ${people() ? 'osób, dla których kupujesz' : 'Ciebie'}.` : `Najpierw najlepsze dla ${people() ? 'osób, dla których kupujesz' : 'Ciebie'}.`}</p><div class="list">${list.slice(0, 20).map(rowHtml).join('')}</div>`;
    else if (state === 'loading') body = '<p class="small muted">Szukam…</p>';
    else if (state === 'error') body = '<div class="empty">Nie udało się połączyć z bazą produktów. Sprawdź internet i spróbuj ponownie.</div>';
    else if (state === 'done') body = `<div class="empty stack" style="align-items:center;text-align:center"><b style="font-family:var(--f-display)">Nie znaleźliśmy „${esc(q)}”</b><span>Może inaczej się nazywa albo jeszcze go nie ma w bazie Open Food Facts. Masz go pod ręką? Zeskanuj kod i dodaj produkt (+10 pkt).</span><button class="btn btn-dark" type="button" data-act="scan"><svg><use href="#i-scan"/></svg>Skanuj i dodaj</button></div>`;
    box.innerHTML = catHtml + body;
  }
  /* Same cyfry (kod spod kreski, także ze spacjami): od razu do produktu zamiast szukania po nazwie. */
  const asCode = q => { const d = String(q || '').replace(/[\s-]/g, ''); return /^\d{6,14}$/.test(d) ? d : null; };
  function drawCode(d) {
    const box = A.$('srchRes'); if (!box) return; sItems = [];
    const problem = A.codeProblem(d);
    box.innerHTML = problem ? `<p class="msg" role="status">${esc(problem)}</p>`
      : `<a class="item srch-code" href="#/p/${esc(d)}"><span class="thumb"><svg width="28" height="28" aria-hidden="true"><use href="#i-scan"/></svg></span><span class="grow"><span class="t1">Kod kreskowy ${esc(d)}</span><span class="t2">Otwórz produkt</span></span><span aria-hidden="true">›</span></a>`;
  }
  async function runSearch(q) {
    const tok = ++sToken; q = q.trim();
    const code = asCode(q);
    if (code) { drawCode(code); return; }
    if (fq(q).length < 2) { drawEmpty(); return; }
    const loc = rank(localHits(q));
    drawResults(q, loc, loc.length ? 'local' : 'loading');
    try {
      const list = await remote(q); if (tok !== sToken) return;
      const top = list.slice(0, 40).map(p => p.code);
      if (A.loadDetails && top.length) await A.loadDetails(top).catch(() => false);
      if (tok !== sToken) return;
      const seen = new Set(list.map(p => p.code));
      const all = rank(A.searchRelevant(list.concat(localHits(q).filter(p => !seen.has(p.code))), q));
      drawResults(q, all, 'done'); addRecent(q); A.track('szukaj');
    } catch (e) { if (tok === sToken) drawResults(q, loc, loc.length ? 'done' : 'error'); }
  }
  function drawEmpty() {
    const box = A.$('srchRes'); if (!box) return; sItems = [];
    const r = recent();
    box.innerHTML = r.length ? `<p class="small muted" style="font-weight:800;letter-spacing:.05em">OSTATNIO SZUKANE</p><div class="chips">${r.map(x => `<button class="cat-tab" type="button" data-act="srch-again" data-q="${esc(x)}">${esc(x)}</button>`).join('')}</div>`
      : '<p class="small muted">Wpisz nazwę produktu albo marki, np. „skyr”, „płatki owsiane”, „pierogi ruskie”, albo cyfry spod kodu kreskowego.</p>';
  }
  A.searchSet = q => { const i = A.$('srchQ'); if (i) { i.value = q; } sQuery = q; history.replaceState(null, '', '#/szukaj/' + encodeURIComponent(q)); runSearch(q); };
  A.route('search', arg => {
    const q = typeof arg === 'string' ? arg : '';
    const el = A.$('scr-search');
    if (!el.dataset.ready) {
      el.innerHTML = `<div class="wrap"><div class="topbar"><button class="btn btn-white iconbtn" type="button" data-act="back" aria-label="Wróć"><svg><use href="#i-back"/></svg></button><h1 class="grow" style="font-size:1.2rem">Szukaj produktu</h1></div>
        <form class="srch-form" id="srchForm" role="search" novalidate><svg aria-hidden="true"><use href="#i-search"/></svg><input class="field" id="srchQ" type="search" enterkeyhint="search" autocomplete="off" maxlength="60" placeholder="Nazwa, marka albo cyfry kodu" aria-label="Szukaj produktu, marki, kategorii albo kodu kreskowego"></form>
        <div id="srchRes" class="stack" aria-live="polite"></div></div>`;
      el.dataset.ready = '1';
      const inp = A.$('srchQ');
      inp.addEventListener('input', () => { clearTimeout(sTimer); const v = inp.value; sTimer = setTimeout(() => { if (v === sQuery) return; sQuery = v; history.replaceState(null, '', v.trim() ? '#/szukaj/' + encodeURIComponent(v.trim()) : '#/szukaj'); A.current.arg = v.trim() || null; runSearch(v); }, 350); });
      A.$('srchForm').addEventListener('submit', e => { e.preventDefault(); clearTimeout(sTimer); sQuery = inp.value; inp.blur(); const c = asCode(inp.value); if (c && !A.codeProblem(c)) { A.go('#/p/' + c); return; } runSearch(inp.value); });
    }
    const inp = A.$('srchQ');
    if (inp.value !== q) inp.value = q;
    if (q !== sQuery || !A.$('srchRes').innerHTML) { sQuery = q; if (q) runSearch(q); else drawEmpty(); }
    else if (sItems.length) drawResults(q, rank(sItems.map(x => x.pr)), 'done'); // powrót z produktu: przeliczenie dla aktualnych osób
    if (!q) setTimeout(() => { try { inp.focus(); } catch (e) { } }, 60);
  });

  /* ---------- Kliknięcia ---------- */
  const findProd = code => {
    const c = A.cmp.find(x => x.code === code); if (c) return c.p;
    const s = sItems.find(x => x.pr.code === code); if (s) return s.pr;
    const l = (A.listCache || []).find(x => x.pr.code === code); if (l) return l.pr;
    const cur = A.currentProduct && A.currentProduct(); if (cur && cur.prod && cur.prod.code === code) return cur.prod;
    const cache = A.store.get('cache', {}); return cache[code] && cache[code].p || null;
  };
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act, code = el.dataset.code;
    if (act === 'cmp-toggle') {
      e.preventDefault();
      if (A.inCmp(code)) A.cmpRemove(code);
      else { const p = findProd(code); if (!p || !A.cmpAdd(p)) return; if (A.cmp.length === MAX && A.cmp.length) A.toast(A.cmp.length + ' produkty w porównaniu.'); }
      const on = A.inCmp(code);
      document.querySelectorAll(`[data-act=cmp-toggle][data-code="${code}"]`).forEach(b => { b.outerHTML = A.cmpBtnHtml(code, (findProd(code) || {}).name); });
      if (el.classList.contains('btn')) A.rerenderProduct && A.current.screen === 'product' && A.rerenderProduct();
      A.cmpBar(); const nb = document.querySelector(`[data-act=cmp-toggle][data-code="${code}"]`); if (nb) nb.focus();
      A.announce(on ? 'Dodano do porównania.' : 'Usunięto z porównania.');
    } else if (act === 'cmp-scan') {
      A.cmpWaiting = Date.now(); A.openScanner();
    } else if (act === 'cmp-pair') {
      const prev = findProd(code), cur = A.currentProduct && A.currentProduct();
      if (prev) A.cmpAdd(prev); if (cur && cur.prod) A.cmpAdd(cur.prod);
      A.track('porownaj-podpowiedz'); location.hash = '#/porownaj';
    } else if (act === 'cmp-clear') { A.cmpClear(); A.cmpBar(); A.cmpRender(); if (A.current.screen === 'product' && A.rerenderProduct) A.rerenderProduct(); }
    else if (act === 'cmp-remove') { A.cmpRemove(code); A.cmpRender(); }
    else if (act === 'cmp-who') { who = el.dataset.who; renderCompare(); const b = document.querySelector(`[data-act=cmp-who][data-who="${who}"]`); if (b) b.focus(); }
    else if (act === 'cmp-shelf') { const x = A.cmp.find(i => i.code === code); if (x && A.addToShelf(x.p, A.groupMatch(x.p, analyze(x.p)))) { A.track('porownaj-polka'); renderCompare(); } }
    else if (act === 'srch-again') A.searchSet(el.dataset.q);
    else if (act === 'cmp-prod') {
      const cur = A.currentProduct && A.currentProduct(); if (!cur || !cur.prod) return;
      if (A.inCmp(cur.prod.code)) { if (A.cmp.length > 1) { location.hash = '#/porownaj'; return; } A.cmpRemove(cur.prod.code); }
      else { A.cmpAdd(cur.prod); if (A.cmp.length > 1) { location.hash = '#/porownaj'; return; } A.cmpWaiting = Date.now(); A.toast('Dodano do porównania. Zeskanuj albo wyszukaj drugi produkt.'); }
      if (A.rerenderProduct) A.rerenderProduct(); A.cmpBar();
    }
  });
})();
