/* Dobre czy nie? 1.0 – ekran startowy (cele i ograniczenia), ekran „Dla Ciebie” i listy „Najlepsze dla Ciebie”. */
'use strict';
(() => {
  const A = App, esc = A.esc;

  /* ---------- Start: 3 kroki (wersja D: cele to skróty do listy „Pilnuję”) ---------- */
  const QUICK_AVOID = [['allergens', 'gluten'], ['allergens', 'milk'], ['allergens', 'nuts'], ['allergens', 'peanuts'], ['allergens', 'eggs'], ['diet', 'vegan'], ['diet', 'vegetarian'], ['diet', 'glutenfree'], ['diet', 'lactose'], ['avoid', 'pork'], ['avoid', 'alcohol']];
  let step = 1, draft = null, msg = '';
  A.route('start', () => {
    if (!draft) draft = { goals: A.profile.goals.slice(), watch: A.profile.watch.slice(), picks: {}, name: A.userName() };
    if (!Object.keys(draft.picks).length) ['allergens', 'diet', 'avoid'].forEach(g => A.profile[g].forEach(k => { draft.picks[g + ':' + k] = true; }));
    renderStart();
  });
  function opt(g, k) { return PROFILE_OPTIONS[g].find(o => o.key === k); }
  // Włączenie celu dodaje jego pozycje do „Pilnuję”; wyłączenie zdejmuje te, których nie potrzebuje inny wybrany cel.
  A.toggleGoalWatch = (watch, goals, key, on) => {
    const g = GOALS.find(x => x.key === key); if (!g) return watch;
    const keep = new Set(watchFromGoals(goals.filter(k => k !== key)));
    let out = watch.slice();
    if (on) g.watch.forEach(w => { if (!out.includes(w)) out.push(w); });
    else out = out.filter(w => !g.watch.includes(w) || keep.has(w));
    return WATCH.map(w => w.key).filter(k => out.includes(k)).slice(0, WATCH_MAX);
  };
  A.goalTile = (g, on, act) => { const t = GOAL_TILES[g.key]; return `<button class="goal-tile d-goal" type="button" data-act="${act}" data-k="${g.key}" aria-pressed="${on}"><span class="tick" aria-hidden="true"><svg width="14" height="14"><use href="#i-check"/></svg></span><span class="d-goal-ic">${A.dIcon(t.icon, 24)}</span><b>${esc(t.label)}</b><span>${esc(t.hint)}</span></button>`; };
  A.watchLine = watch => watch.length ? `<p class="small d-watchline"><b>Będę pilnować:</b> ${watch.map(k => esc((WATCH.find(w => w.key === k) || {}).label || k).toLowerCase()).join(', ')}.</p>` : '';
  function renderStart() {
    const el = A.$('scr-start');
    const bar = `<div class="steps-bar" aria-label="Krok ${step} z 3">${[1, 2, 3].map(i => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}<span class="small muted" style="margin-left:6px;font-weight:800">Krok ${step} z 3</span></div>`;
    let body = '';
    if (step === 1) {
      body = `<p class="small muted">Pomożemy Ci wybierać produkty, które pasują właśnie do Ciebie.</p>
        <div><h1 id="startTitle" style="font-size:1.8rem">Jaki masz cel?</h1><p class="small muted">Wybierz do ${GOALS_MAX}. Cel zaznacza, czego mamy pilnować w produktach. Zmienisz to w profilu.</p></div>
        <div class="goal-grid">${GOALS.map(g => A.goalTile(g, draft.goals.includes(g.key), 'goal')).join('')}</div>
        ${A.watchLine(draft.watch)}
        <p class="msg" role="status" id="startMsg">${esc(msg)}</p>`;
    } else if (step === 2) {
      body = `<div><h1 id="startTitle" style="font-size:1.8rem">Czego nie jesz?</h1><p class="small muted">Produkt, który to zawiera, oznaczymy „Nie pasuje”. Możesz nic nie zaznaczać. Pełna lista alergenów i własne składniki są w profilu.</p></div>
        <div class="pchips">${QUICK_AVOID.map(([g, k]) => `<label class="pchip"><input type="checkbox" data-pick="${g}:${k}"${draft.picks[g + ':' + k] ? ' checked' : ''}>${esc(opt(g, k).label)}</label>`).join('')}</div>
        <p class="small muted">Przy alergii aplikacja jest pomocą, a nie gwarancją. Zawsze sprawdź etykietę.</p>`;
    } else {
      body = `<div><h1 id="startTitle" style="font-size:1.8rem">Jak masz na imię?</h1><p class="small muted">Nieobowiązkowe. Imię zostaje tylko w tym telefonie.</p></div>
        <input class="field" id="startName" maxlength="30" autocomplete="given-name" placeholder="np. Ania" value="${esc(draft.name)}" aria-label="Twoje imię">
        <div class="panel stack"><b style="font-family:var(--f-display)">Jak liczymy dopasowanie?</b><ul class="why">
          <li class="why-plus"><span class="why-ic">1</span><span>Zaczynamy od oceny składu produktu, takiej samej dla wszystkich.</span></li>
          <li class="why-plus"><span class="why-ic">2</span><span>Każda rzecz, której pilnujesz, dodaje albo odejmuje punkty. Zawsze pokażemy ile i dlaczego.</span></li>
          <li class="why-plus"><span class="why-ic">3</span><span>Jeśli produkt zawiera coś, czego nie jesz, oznaczymy go „Nie pasuje”.</span></li></ul></div>`;
    }
    el.innerHTML = `<div class="wrap" style="gap:12px">${bar}${body}
      <div class="stack" style="margin-top:auto;gap:6px">
        <button class="btn btn-green btn-block" type="button" data-act="start-next">${step < 3 ? (step === 1 && draft.goals.length ? `Dalej (${draft.goals.length} ${plural(draft.goals.length, 'cel', 'cele', 'celów')})` : 'Dalej') : 'Zaczynamy!'}</button>
        <div class="row" style="justify-content:space-between">${step > 1 ? '<button class="linkbtn" type="button" data-act="start-back">Wstecz</button>' : '<span></span>'}<button class="linkbtn" type="button" data-act="start-skip">Pomiń na razie</button></div>
      </div></div>`;
  }
  function saveStart(finish) {
    const p = Object.assign({}, A.profile, { goals: draft.goals.slice(), watch: draft.watch.slice() });
    ['allergens', 'diet', 'avoid'].forEach(g => {
      const quick = QUICK_AVOID.filter(q => q[0] === g).map(q => q[1]);
      p[g] = A.profile[g].filter(k => !quick.includes(k)).concat(quick.filter(k => draft.picks[g + ':' + k]));
    });
    A.profile = cleanProfile(p); A.saveProfile();
    if (finish) {
      const nm = String(draft.name || '').replace(/[<>]/g, '').trim().slice(0, 30);
      A.store.set('name', nm);
      A.store.set('onboarded', true);
      draft = null; step = 1;
      A.go('#/');
    }
  }
  A.startAction = (act, el) => {
    if (act === 'goal') {
      const k = el.dataset.k, i = draft.goals.indexOf(k);
      if (i >= 0) { draft.goals.splice(i, 1); draft.watch = A.toggleGoalWatch(draft.watch, draft.goals, k, false); msg = ''; }
      else if (draft.goals.length >= GOALS_MAX) msg = `Możesz wybrać najwyżej ${GOALS_MAX} cele. Odznacz któryś, żeby dodać nowy.`;
      else { draft.watch = A.toggleGoalWatch(draft.watch, draft.goals, k, true); draft.goals.push(k); msg = ''; }
      renderStart();
      const again = A.$('scr-start').querySelector(`[data-k="${k}"]`); if (again) again.focus();
    } else if (act === 'start-next') {
      if (step === 2) A.$('scr-start').querySelectorAll('[data-pick]').forEach(i => { draft.picks[i.dataset.pick] = i.checked; });
      if (step === 3) { draft.name = A.$('startName').value; saveStart(true); return; }
      step++; msg = ''; renderStart(); A.$('startTitle').focus();
    } else if (act === 'start-back') {
      if (step === 2) A.$('scr-start').querySelectorAll('[data-pick]').forEach(i => { draft.picks[i.dataset.pick] = i.checked; });
      if (step === 3) draft.name = A.$('startName').value;
      step = Math.max(1, step - 1); renderStart();
    } else if (act === 'start-skip') {
      if (step === 2) A.$('scr-start').querySelectorAll('[data-pick]').forEach(i => { draft.picks[i.dataset.pick] = i.checked; });
      saveStart(true);
    }
  };

  /* ---------- Dla Ciebie ---------- */
  // Czy osoba ustawiła coś, co zmienia ocenę (cel inny niż „Po prostu zdrowiej” albo ograniczenie)?
  A.hasProfile = () => A.profile.watch.length > 0 || ['allergens', 'diet', 'avoid', 'custom'].some(g => A.profile[g].length);
  A.pctClass = lvl => ({ great: 'great', good: 'good', poor: 'poor', bad: 'bad' }[lvl] || 'unknown');
  A.profileChips = (p = A.profile) => {
    const out = [];
    p.watch.forEach(k => { const w = WATCH.find(x => x.key === k); if (w) out.push(`<span class="chip d-chip">${A.dIcon(w.icon, 16)}${esc(w.label)}</span>`); });
    ['allergens', 'diet', 'avoid'].forEach(g => p[g].forEach(k => {
      const o = PROFILE_OPTIONS[g].find(x => x.key === k); if (!o) return;
      out.push(`<span class="chip d-chip avoid">${A.dIcon('ban', 16)}${g === 'diet' ? esc(o.label) : 'Nie jem: ' + esc(o.label.toLowerCase())}</span>`);
    }));
    p.custom.forEach(c => out.push(`<span class="chip d-chip avoid">${A.dIcon('ban', 16)}Nie jem: ${esc(c)}</span>`));
    return out;
  };
  A.route('home', () => {
    const name = A.userName();
    const lv = Game.levelFor(A.cfg, A.game.points);
    const nextPts = lv.next ? lv.next.minPoints : null;
    const pct = nextPts ? Math.round((A.game.points - lv.minPoints) / (nextPts - lv.minPoints) * 100) : 100;
    const ch = Game.challengeProgress(A.game, A.cfg, new Date());
    const chips = A.profileChips();
    const hist0 = A.store.get('history', []).filter(h => h && h.code);
    // „Ostatnio sprawdzone”: wynik liczony na nowo dla osób włączonych teraz (najniższy wynik, jak obręcz talerza i lista),
    // z danych produktu zapamiętanych w telefonie. Bez danych (stary wpis) – wynik z chwili skanu.
    const pcache = A.store.get('cache', {});
    const hist = hist0.map(h => {
      const p = (pcache[h.code] && pcache[h.code].p) || (A.detailCached && A.detailCached(h.code));
      if (!p || !A.groupMatch) return h;
      try { const g = A.groupMatch(p, analyze(p)); return Object.assign({}, h, { pct: g.pct, level: g.level, glab: g.n > 1 ? g.label : '', pre: !!(A.dataGaps && A.dataGaps(p).length) }); } catch (e) { return h; }
    });
    const swap = hist0.find(h => h.alt && h.pct != null && h.pct < 50 && !Shelf.hasCode(A.shelves, h.alt.code));
    const fam = !!(A.family && A.family.length), fresh = !hist0.length;
    const wk = A.weekCard();
    /* Krótko, czego ktoś pilnuje: „✕ gluten · białko”. Szczegóły są w Profilu. */
    const short = pr => { const out = []; ['allergens', 'diet', 'avoid'].forEach(g => (pr[g] || []).forEach(k => { const o = PROFILE_OPTIONS[g].find(x => x.key === k); if (o) out.push('✕ ' + o.label.toLowerCase()); }));
      (pr.custom || []).forEach(c => out.push('✕ ' + c)); (pr.watch || []).forEach(k => { const w = WATCH.find(x => x.key === k); if (w) out.push(w.label.replace(' (więcej)', '').toLowerCase()); });
      return out.length ? out.slice(0, 2).join(' · ') + (out.length > 2 ? ' …' : '') : 'bez ustawień'; };
    /* 3.0: „Kupujesz dla” jako przełącznik: Cała rodzina / Tylko ja / Wybierz… (panel z osobami). Jedna linia mówi, dla kogo liczymy wynik. */
    const rows = fam ? A.familyRows() : [], nmOf = r => r.id === 'me' ? (r.name === 'Ja' ? 'Ty' : r.name) : r.name;
    const onRows = rows.filter(r => A.isShopOn(r.id)), mode = onRows.length === rows.length ? 'all' : onRows.length === 1 && onRows[0].id === 'me' ? 'me' : 'pick';
    const forLine = mode === 'all' ? `całej rodziny (${rows.length} ${rows.length < 5 ? 'osoby' : 'osób'})` : mode === 'me' ? 'Ciebie' : onRows.map(nmOf).join(', ');
    const seg = (m, label, act) => `<button type="button" class="seg-b${mode === m ? ' on' : ''}" data-act="${act}" aria-pressed="${mode === m}">${label}</button>`;
    const who = fam ? `<section class="who-seg" aria-label="Kupujesz dla"><div class="seg" role="group" aria-label="Kupujesz dla">${seg('all', 'Cała rodzina', 'shop-all')}${seg('me', 'Tylko ja', 'shop-me')}${seg('pick', mode === 'pick' ? 'Wybrane: ' + onRows.length : 'Wybierz…', 'who-sheet')}</div>
        <p class="who-line">Wynik liczymy dla: <b>${esc(forLine)}</b></p></section>`
      : A.hasProfile() ? `<a class="who-solo" href="#/profil" id="hProf"><span class="small muted">Pilnujesz:</span> <b>${esc(short(A.profile))}</b><span class="linkish">Zmień</span></a>`
      : `<section class="card stack d-setprof" aria-labelledby="hProf"><h2 id="hProf">Czego pilnujesz?</h2><span>Zaznacz, czego nie jesz i czego pilnujesz. Wynik od razu dopasuje się do Ciebie, a potem do każdego domownika.</span><a class="btn btn-green" href="#/start">Ustaw profil</a></section>`;
    const whoSheet = fam && A.whoSheet ? `<div class="ls-dim" data-act="who-close"></div><div class="ls-sheet" role="dialog" aria-modal="true" aria-labelledby="whoTitle"><span class="ls-grab" aria-hidden="true"></span><h2 id="whoTitle">Dla kogo kupujesz?</h2><div class="ls-list">${rows.map(r => { const on = A.isShopOn(r.id);
        return `<button type="button" class="who-ck" role="checkbox" aria-checked="${on}" data-act="shop-on" data-id="${esc(r.id)}"><span class="ck" aria-hidden="true">${on ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : ''}</span><span class="grow"><b>${esc(r.id === 'me' ? (r.name === 'Ja' ? 'Ty' : r.name + ' (Ty)') : r.name)}</b><span>${esc(short(r.p))}</span></span></button>`; }).join('')}</div><button class="btn btn-dark btn-block" type="button" data-act="who-close">Gotowe</button></div>` : '';
    const sh = A.shelves && A.shelves.shelves.find(x => x.id === A.shelves.activeId) || (A.shelves && A.shelves.shelves[0]);
    const todo = sh ? sh.items.filter(i => !i.checked).length : 0, inCart = sh ? sh.items.length - todo : 0;
    const listCard = sh ? `<a class="list-card" href="#/polki"><svg aria-hidden="true"><use href="#i-shelf"/></svg><span class="grow"><b>${esc(sh.name)}</b><span>${sh.items.length ? `${todo} do kupienia${inCart ? ' · ' + inCart + ' w koszyku' : ''}` : 'Lista jest pusta'}</span></span><span class="lc-go">${sh.items.length ? 'Na zakupy' : 'Otwórz'}</span></a>` : '';
    /* Ostatnio sprawdzone: talerze w jednym rzędzie; nazwa zawsze na 2 linie, pod nią powód (komu nie pasuje) i wynik – wszystko na równej wysokości. */
    const why = h => {
      if (h.pct == null) return ['unk', 'brak wyniku'];
      if (h.pre) return ['mid', 'wynik wstępny'];
      if (h.glab && A.famOn()) { const g = h.glab; return [/^Nie dla/.test(g) ? 'bad' : /^Uwaga/.test(g) ? 'mid' : /^Pasuje/.test(g) ? 'ok' : h.pct >= 70 ? 'ok' : h.pct >= 40 ? 'mid' : 'bad', g.replace(/^./, c => c.toLowerCase()).replace(/^nie dla: /, 'nie dla: ')]; }
      return [h.pct >= 70 ? 'ok' : h.pct >= 40 ? 'mid' : 'bad', A.hasProfile() ? (h.pct >= 70 ? 'pasuje do Ciebie' : h.pct >= 40 ? 'z umiarem' : 'słabo pasuje') : grade(h.pct).label.toLowerCase()];
    };
    const histHtml = hist.length ? `<section class="stack" aria-labelledby="hHist"><div class="sec-head"><h2 id="hHist">Ostatnio sprawdzone</h2><button class="linkbtn small" type="button" data-act="clear-history">Wyczyść</button></div>
        <div class="recent">${hist.slice(0, 8).map(h => { const ci = h.kind === 'cosmetic' ? '' : A.catImg(A.catKeyOf(h.categories) || A.catKeyByName(h.name)); const [t, w] = why(h);
          return `<a class="rc" href="#/p/${esc(h.code)}"><span class="rc-plate${A.profile.noScores ? '' : A.ringStyle(h.pct)}">${h.image ? `<img src="${esc(h.image)}" alt="" loading="lazy">` : ci ? `<img class="dish" src="${ci}" alt="" loading="lazy">` : art('dept_other', 40)}</span><span class="rc-nm">${esc(h.name)}</span>${A.profile.noScores ? '' : `<span class="rc-why" data-t="${t}">${esc(w)}</span>${h.pct != null ? `<span class="pct"${A.pctStyle(h.pct)}>${h.pct}%</span>` : '<span class="pct none">–</span>'}`}</a>`; }).join('')}</div></section>` : '';
    A.$('scr-home').innerHTML = `<div class="wrap">
      <div class="d-head"><span class="d-word"><svg width="28" height="28" aria-hidden="true"><use href="#i-lupka"/></svg><b>lupka</b></span>${A.hudPill()}</div>
      ${fresh ? `<div class="d-scanhero"><span class="d-arc d-arc-home" aria-hidden="true"></span>
        <button class="d-scanbtn" type="button" data-act="scan"><svg aria-hidden="true"><use href="#i-scan"/></svg><span>Skanuj</span></button>
        <div class="d-hello"><p>${name ? 'Cześć, ' + esc(name) : 'Cześć'}</p><h1><span class="w-light">Sprawdź skład</span> <span class="w-bold">w 2 sek.</span></h1></div></div>` : '<span class="d-arc d-arc-home" aria-hidden="true"></span>'}
      <a class="d-search two" href="#/szukaj" id="homeSearch"><svg aria-hidden="true"><use href="#i-search"/></svg><span>${name ? `<b>Czego szukasz, ${esc(name)}?</b><small>nazwa produktu, marka albo kod kreskowy</small>` : '<b>Szukaj produktu, marki albo kodu</b><small>nazwa produktu, marka albo kod kreskowy</small>'}</span></a>
      ${who}
      ${listCard}
      ${histHtml}
      ${swap ? `<section class="stack" aria-labelledby="hSwap"><h2 id="hSwap">Zamień na lepsze</h2>
        <div class="card stack" id="swapCard">
          <a class="swap-row" href="#/p/${swap.code}" style="text-decoration:none;color:inherit"><span class="swap-thumb">${swap.image ? `<img src="${esc(swap.image)}" alt="">` : art('prod_cup_berry', 50)}<span class="pct ${A.pctClass(swap.level)}"${A.pctStyle(swap.pct)}>${swap.pct}${A.hasProfile() ? '%' : ''}</span></span><span class="grow"><b style="display:block">${esc(swap.name)}</b><span class="small" style="${A.pctText(swap.pct) || 'color:var(--poor)'};font-weight:700">${A.hasProfile() ? 'Słabe dopasowanie do Ciebie' : esc(grade(swap.pct).label)}</span></span></a>
          <div class="row small muted" style="padding-left:20px;font-weight:700"><svg width="18" height="18" style="color:var(--green)"><use href="#i-back" transform="rotate(-90 12 12)"/></svg>ta sama kategoria</div>
          <a class="swap-row" href="#/p/${esc(swap.alt.code)}" style="text-decoration:none;color:inherit"><span class="swap-thumb">${swap.alt.image ? `<img src="${esc(swap.alt.image)}" alt="">` : art('prod_cup', 50)}${swap.alt.pct != null ? `<span class="pct ${A.pctClass(swap.alt.level)}"${A.pctStyle(swap.alt.pct)}>${swap.alt.pct}%</span>` : ''}</span><span class="grow"><b style="display:block">${esc(swap.alt.name)}</b><span class="small" style="${A.pctText(swap.alt.pct) || 'color:var(--great)'};font-weight:700">${esc(swap.alt.label || 'Lepszy wybór')}</span></span></a>
          <button class="btn btn-green btn-block" type="button" data-act="swap" data-from="${esc(swap.code)}">Zamień i dodaj do listy${A.pt(' (+15 pkt)')}</button></div></section>` : ''}
      <section class="stack" aria-labelledby="hBest"><div class="sec-head"><h2 id="hBest">${fam && A.famOn() ? 'Najlepsze dla Was' : A.hasProfile() ? 'Najlepsze dla Ciebie' : 'Najlepsze w sklepie'}</h2><a href="#/najlepsze">Wszystkie</a></div>
        <div class="tiles t3">${HOME_TILES.map(t => `<a class="tile" href="#/lista/${t.cat}"><img class="d-tile-img" src="${A.catImg(t.cat)}" alt="" width="72" height="72"><b>${esc(t.label)}</b></a>`).join('')}</div></section>
    </div>${whoSheet}`;
    document.body.classList.toggle('sheet-open', !!whoSheet);
  });

  /* ---------- Wszystkie kategorie ---------- */
  A.route('cats', () => {
    const el = A.$('scr-cats');
    el.innerHTML = `<div class="wrap">
      <div class="topbar"><a class="btn btn-white iconbtn" href="#/" aria-label="Wróć"><svg><use href="#i-back"/></svg></a><h1 class="grow">${A.hasProfile() ? 'Najlepsze dla Ciebie' : 'Najlepsze w sklepie'}</h1>${A.hudPill()}</div>
      <p class="small muted">${A.hasProfile() ? 'W każdej kategorii pokażemy produkty, które najlepiej pasują do Twoich celów i ograniczeń.' : 'W każdej kategorii pokażemy produkty z najlepszą oceną składu. Ustaw cele w profilu, a lista dopasuje się do Ciebie.'}</p>
      <input class="field" id="catSearch" type="search" autocomplete="off" placeholder="Szukaj kategorii, np. sery" aria-label="Szukaj kategorii">
      <p class="small muted" id="catNone" hidden>Nie mamy takiej kategorii. Spróbuj innego słowa.</p>
      ${SHOP_GROUPS.map(g => `<section class="stack cat-group" style="gap:8px" aria-label="${esc(g.label)}"><div class="dept-h">${esc(g.label)}</div>
        <div class="cat-grid">${SHOP_CATEGORIES.filter(c => c.group === g.key).map(c => `<a class="cat-link" href="#/lista/${c.key}" data-name="${esc(fold(c.label))}"><img class="d-cat-img" src="${A.catImg(c.key)}" alt="" width="44" height="44" loading="lazy"><span class="grow">${esc(c.label)}</span><span class="arr" aria-hidden="true">›</span></a>`).join('')}</div></section>`).join('')}
    </div>`;
  });
  A.filterCats = q => {
    const f = fold(q).trim();
    let any = false;
    document.querySelectorAll('#scr-cats .cat-group').forEach(g => {
      let n = 0;
      g.querySelectorAll('.cat-link').forEach(a => { const n0 = a.dataset.name, on = !f || n0.startsWith(f) || n0.includes(' ' + f); a.hidden = !on; if (on) n++; });
      g.hidden = !n; if (n) any = true;
    });
    A.$('catNone').hidden = any;
  };

  /* ---------- Lista „Najlepsze” w kategorii ---------- */
  let listToken = null;
  A.route('list', cat => {
    if (!SHOP_CATEGORIES.some(c => c.key === cat)) { A.go('#/'); return; }
    A.track('kategoria-' + cat.replace(/^en:/, ''));
    const sel = A.store.get('shopStore', null);
    renderList(cat, sel === 'all' || STORES.some(s => s.key === sel) || /^x:[a-z0-9]{2,40}$/.test(sel || '') ? sel : null); // null: wybierz sam (Twój sklep albo wszystkie)
  });
  const itemHtml = x => { const img = A.safeImg(x.pr.image); const st = x.pr.stores.slice(0, 2).map(A.storeName).join(', '); return `<div class="item cat-item" style="cursor:default"><a href="#/p/${esc(x.pr.code)}" class="row grow" style="text-decoration:none;color:inherit;min-width:0">${img ? `<img class="thumb" src="${esc(img)}" alt="" loading="lazy">` : `<span class="thumb">${art('dept_' + departmentFor(x.pr), 34)}</span>`}<span class="grow"><span class="t1">${esc(x.pr.name)}</span><span class="t2">${esc([x.pr.brand, x.pm.pct != null && A.dataGaps(x.pr).length ? A.preLabel(x.pm.label) : x.pm.label].filter(Boolean).join(' · '))}</span>${st ? `<span class="t2">Sklep: ${esc(st)}</span>` : ''}</span><span class="pct ${A.pctClass(x.pm.level)} alt-score"${A.pctStyle(x.pm.pct)}>${x.pm.pct == null ? '–' : x.pm.pct + '%'}</span></a><span class="ci-acts">${A.cmpBtnHtml ? A.cmpBtnHtml(x.pr.code, x.pr.name) : ''}<button class="btn btn-white iconbtn" type="button" data-act="shelf-add-code" data-code="${esc(x.pr.code)}" aria-label="Dodaj ${esc(x.pr.name)} do listy zakupów"${Shelf.hasCode(A.shelves, x.pr.code) ? ' disabled' : ''}><svg><use href="#i-${Shelf.hasCode(A.shelves, x.pr.code) ? 'check' : 'plus'}"/></svg></button></span></div>`; };
  A.storeName = raw => { const f = fold(raw).replace(/\s+/g, ''); const k = STORES.find(x => f.includes(x.key)); return k ? k.label : String(raw).charAt(0).toUpperCase() + String(raw).slice(1); };
  /* Dla kogo liczymy listę: 'me' (Ty), id domownika albo 'all' (cała rodzina = wynik najsłabszej osoby). Bez domowników zawsze 'me'. */
  const listWho = () => {
    if (!A.famOn || !A.famOn()) return 'me';
    const on = A.activeRows();
    if (on.length === 1) return on[0].id;
    const w = A.store.get('d-listwho', 'all');
    return w === 'all' || on.some(r => r.id === w) ? w : 'all';
  };
  const whoName = r => r.id === 'me' ? 'Ty' : r.name;
  function matchFor(pr, an, who) {
    if (who === 'me') return personalMatch(pr, an, A.profile);
    const rows = A.activeRows();
    if (who !== 'all') { const r = rows.find(x => x.id === who); return personalMatch(pr, an, r ? r.p : A.profile); }
    return A.groupMatch(pr, an); // ta sama zasada co obręcz talerza i „Ostatnio sprawdzone”: najniższy wynik wśród włączonych osób
  }
  /* Pełne dane produktów. Wyszukiwarka OFF (źródło list) bywa niepełna, np. bez wartości odżywczych albo składu, więc wynik liczony
     na jej danych różnił się od ekranu produktu. Pełne dane bierzemy przez pośrednika (/details, kopia w Cloudflare 3 dni) i pamiętamy
     w telefonie (Cache API „dcn-pdet”, 7 dni). Produkt otwarty na ekranie produktu zastępuje kopię najświeższymi danymi. */
  const DET = new Map(), DET_TTL = 7 * 24 * 3600e3, DET_CACHE = 'dcn-pdet';
  const detStore = () => (typeof caches !== 'undefined' ? caches.open(DET_CACHE).catch(() => null) : Promise.resolve(null));
  const detKey = code => new Request(location.origin + '/__pdet/' + code);
  A.putDetail = prod => {
    if (!prod || !prod.code || prod.kind !== 'food') return;
    DET.set(prod.code, prod);
    detStore().then(c => c && c.put(detKey(prod.code), new Response(JSON.stringify({ p: prod, at: Date.now() }), { headers: { 'Content-Type': 'application/json' } }))).catch(() => { });
  };
  A.detailOne = async code => { await loadDetails([code]); return DET.get(code) || null; };
  const withDetail = pr => { const d = DET.get(pr.code); return d ? Object.assign({}, d, { stores: d.stores && d.stores.length ? d.stores : pr.stores, name: d.name || pr.name }) : pr; };
  A.withDetail = withDetail;
  A.detailCached = code => DET.get(code) || null;
  A.loadDetails = codes => loadDetails(codes);
  // Wczytuje pełne dane podanych produktów (najpierw z telefonu, potem przez pośrednika). Zwraca true, gdy mamy wszystkie.
  const detInflight = new Map(); // kod → trwające pobieranie (dwa wywołania naraz nie pobierają dwa razy)
  async function loadDetails(codes) {
    const waiting = codes.filter(c => !DET.has(c) && detInflight.has(c)).map(c => detInflight.get(c));
    const mine = codes.filter(c => !DET.has(c) && !detInflight.has(c));
    let done; const p = new Promise(r => { done = r; }); mine.forEach(c => detInflight.set(c, p));
    try { const ok = await loadDetailsNow(mine); await Promise.all(waiting); return ok && codes.every(c => DET.has(c)); }
    finally { mine.forEach(c => detInflight.delete(c)); done(); }
  }
  async function loadDetailsNow(codes) {
    let need = codes.filter(c => !DET.has(c));
    if (!need.length) return true;
    const store = await detStore();
    if (store) await Promise.all(need.map(async code => {
      try { const r = await store.match(detKey(code)); if (!r) return; const j = await r.json(); if (j && Date.now() - j.at < DET_TTL) DET.set(code, j.p || false); } catch (e) { }
    }));
    need = need.filter(c => !DET.has(c));
    const proxy = (A.CFG.offProxyUrl || '').replace(/\/$/, '');
    if (!need.length) return true;
    if (!proxy || navigator.onLine === false) return false;
    let complete = true;
    const chunks = []; for (let i = 0; i < need.length; i += 40) chunks.push(need.slice(i, i + 40));
    await Promise.all(chunks.map(async chunk => {
      try {
        const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 20000);
        const r = await fetch(`${proxy}/details?codes=${chunk.join(',')}`, { signal: ctrl.signal }); clearTimeout(t);
        const j = r.ok ? await r.json() : null;
        if (!j || !j.products) { complete = false; return; }
        if (j.failed) complete = false;
        chunk.forEach(code => {
          if (!(code in j.products)) return;
          const raw = j.products[code], prod = raw ? normalizeProduct(raw, 'off') : false;
          DET.set(code, prod);
          if (store) store.put(detKey(code), new Response(JSON.stringify({ p: prod, at: Date.now() }), { headers: { 'Content-Type': 'application/json' } })).catch(() => { });
        });
      } catch (e) { complete = false; }
    }));
    return complete && codes.every(c => DET.has(c));
  }
  /* Lista jednej kategorii liczona RAZ na pełnych danych i zapamiętana na czas sesji: przełączanie osób i sklepów tylko przelicza te same dane,
     więc ta sama osoba zawsze widzi ten sam wynik, a „Cała rodzina” jest zawsze częścią listy każdej osoby. */
  const LISTS = {};
  const CAND = 80; // tyle produktów z czołówki (najlepszy wynik dla kogokolwiek z rodziny) dostaje pełne dane
  function candidates(list) {
    const people = A.family && A.family.length ? A.familyRows() : [{ id: 'me', p: A.profile }];
    return list.filter(pr => pr.name && pr.code).map(pr => {
      const an = analyze(pr);
      const best = Math.max(-1, ...people.map(r => { const m = personalMatch(pr, an, r.p); return m.pct == null ? -1 : m.pct; }));
      return { code: pr.code, best: an.score == null ? -2 : best };
    }).sort((a, b) => b.best - a.best || (a.code < b.code ? -1 : 1)).slice(0, CAND).map(x => x.code);
  }
  async function renderList(cat, storeKey) {
    const cName = (SHOP_CATEGORIES.find(c => c.key === cat) || {}).label || 'Produkty';
    const el = A.$('scr-list');
    el.innerHTML = `<div class="wrap"><div class="topbar"><a class="btn btn-white iconbtn" href="#/najlepsze" aria-label="Wszystkie kategorie"><svg><use href="#i-back"/></svg></a><h1 class="grow">${esc(cName)}</h1>${A.hudPill()}</div>
      <div class="d-listhero" aria-hidden="true"><span class="d-arc d-arc-list"></span><img src="${A.catImg(cat)}" alt="" width="480" height="480"></div>
      <div id="listBody" class="stack" aria-live="polite"><p class="small muted" id="listWait">Szukam produktów…</p><div class="sk" style="height:58px"></div><div class="sk" style="height:58px"></div><div class="sk" style="height:58px"></div></div></div>`;
    const token = {}; listToken = token;
    const have = LISTS[cat], sig = JSON.stringify([A.profile, A.family]);
    if (have && have.complete && have.sig === sig && Date.now() - have.at < 6 * 3600e3) { drawList(cat, storeKey, have); return; }
    try {
      const list = await A.fetchCategory(cat, sec => { const w = A.$('listWait'); if (w && listToken === token) w.textContent = `Wyszukiwarka produktów ma limit zapytań. Spróbuję za ${sec} s…`; });
      if (listToken !== token || A.current.screen !== 'list') return;
      const codes = candidates(list);
      const w = A.$('listWait'); if (w) w.textContent = `Sprawdzam szczegóły ${codes.length} ${plural(codes.length, 'produktu', 'produktów', 'produktów')}…`;
      const complete = await loadDetails(codes);
      if (listToken !== token || A.current.screen !== 'list') return;
      LISTS[cat] = { list, at: Date.now(), complete, sig };
      drawList(cat, storeKey, LISTS[cat]);
    } catch (e) {
      if (listToken !== token || !A.$('listBody')) return;
      const kind = (e && e.kind) || 'network';
      A.$('listBody').innerHTML = `<div class="empty stack" style="align-items:center">${A.mascot('sad', 60)}<b>${esc(A.ERR_TEXT[kind][0])}</b><span>${esc(A.ERR_TEXT[kind][1])}</span><button class="btn btn-gold" type="button" data-act="list-store" data-cat="${esc(cat)}" data-store="${esc(storeKey)}">Spróbuj ponownie</button></div>`;
    }
  }
  function drawList(cat, storeKey, data) {
    const list = data.list;
    const personal = A.hasProfile() || (A.family && A.family.length > 0);
    const who = listWho(), famAll = A.famOn && A.famOn() ? A.activeRows() : null, fam = famAll && famAll.length > 1 ? famAll : null;
    const scored = list.filter(pr => pr.name).map(pr => { const p = withDetail(pr); const an = analyze(p); return { pr: p, an, pm: matchFor(p, an, who), full: p !== pr }; })
      .filter(x => x.an.score != null && x.an.parts.length >= 2);
    const all = scored.slice().sort((a, b) => (b.pm.pct ?? -1) - (a.pm.pct ?? -1) || (a.pr.code < b.pr.code ? -1 : 1));
    const ok = x => x.pm.pct >= 50 && x.pm.status !== 'fail' && x.pm.status !== 'unknown';
    const good = all.filter(ok);
    // 3.0.4: sklepy z danych produktów (także spoza listy znanych sieci), każdy produkt liczony raz na sklep.
    const counts = {}, firstName = {};
    good.forEach(x => { const seen = new Set(); (x.pr.stores || []).forEach(raw => { const k = A.storeKeyOf(raw); if (!k || seen.has(k)) return; seen.add(k); counts[k] = (counts[k] || 0) + 1; if (!firstName[k]) firstName[k] = raw; }); });
    const tagMap = A.store.get('d-storetag', {}) || {}; good.forEach(x => { const k = tagMap[x.pr.code]; if (k && !(x.pr.stores || []).some(raw => A.storeKeyOf(raw) === k)) counts[k] = (counts[k] || 0) + 1; });
    const stLabel = k => STORES.some(s => s.key === k) ? A.storeLabel(k) : A.storeNames()[k] || (A.storeCatalog().find(c => c.key === k) || {}).name || A.storeName(firstName[k] || k);
    if (storeKey == null) storeKey = A.myStores().find(k => counts[k] >= 3) || 'all';
    if (storeKey !== 'all' && !counts[storeKey]) storeKey = 'all';
    const shown = storeKey === 'all' ? good : good.filter(x => A.storeOf(x.pr, storeKey));
    const withStore = list.filter(pr => pr.stores.length).length;
    const whoChips = fam ? `<div class="chips list-who" role="group" aria-label="Dla kogo">${[['all', A.offRows().length ? 'Wszyscy wybrani' : 'Cała rodzina']].concat(fam.map(r => [r.id, whoName(r)])).map(([k, l]) => `<button class="cat-tab" type="button" data-act="list-who" data-cat="${esc(cat)}" data-store="${esc(storeKey)}" data-who="${esc(k)}" aria-pressed="${k === who}">${esc(l)}</button>`).join('')}</div>` : '';
    /* 3.0.3: sklep jako jeden przycisk („Sklep: Biedronka · 3 ▾”), a lista sklepów w panelu od dołu – jak „Dla kogo kupujesz?”. */
    const my = A.myStores(), stores = [['all', 'Wszystkie sklepy', good.length]].concat(Object.keys(counts).sort((a, b) => (my.includes(b) - my.includes(a)) || counts[b] - counts[a] || stLabel(a).localeCompare(stLabel(b), 'pl')).map(k => [k, stLabel(k), counts[k]]));
    const curSt = stores.find(x => x[0] === storeKey) || stores[0];
    const chips = good.length ? `<button class="store-sw" type="button" data-act="list-store-sheet" data-cat="${esc(cat)}" data-store="${esc(storeKey)}" aria-haspopup="dialog"><span class="grow"><small>Sklep</small><b>${esc(curSt[1])}</b></span><span class="muted">${curSt[2]} ${plural(curSt[2], 'produkt', 'produkty', 'produktów')}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>` : '';
    const storeSheet = good.length && A.storeSheet ? `<div class="ls-dim" data-act="list-sheet-close"></div><div class="ls-sheet" role="dialog" aria-modal="true" aria-labelledby="stTitle"><span class="ls-grab" aria-hidden="true"></span><h2 id="stTitle">W którym sklepie?</h2><div class="ls-list">${stores.map(([k, l, n]) => `<button type="button" class="who-ck" role="radio" aria-checked="${k === storeKey}" data-act="list-store" data-cat="${esc(cat)}" data-store="${esc(k)}"><span class="ck rd" aria-hidden="true">${k === storeKey ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : ''}</span><span class="grow"><b>${esc(l)}</b><span>${n} ${plural(n, 'dobry produkt', 'dobre produkty', 'dobrych produktów')}</span></span></button>`).join('')}</div>
        <p class="small muted">Sklep przy produkcie wpisują kupujący, więc znamy go tylko dla ${withStore} z ${list.length} produktów. Brak sklepu nie znaczy, że produktu tam nie ma.</p><button class="btn btn-dark btn-block" type="button" data-act="list-sheet-close">Zamknij</button></div>` : '';
    const forWho = who === 'all' ? (A.offRows().length ? 'wybranych osób' : 'całej rodziny') + ' (liczy się wynik osoby, której produkt pasuje najsłabiej)' : who === 'me' ? 'Twoich celów i ograniczeń' : 'celów i ograniczeń: ' + esc(whoName((famAll || []).find(r => r.id === who) || { id: 'me' }));
    let body;
    if (!list.length) body = `<div class="empty">W bazie Open Food Facts nie ma jeszcze produktów z tej kategorii sprzedawanych w Polsce.</div>`;
    else if (!good.length) {
      const best = all.filter(x => x.pm.pct != null && x.pm.status !== 'fail').slice(0, 5);
      body = `<div class="empty">Sprawdziliśmy ${list.length} ${plural(list.length, 'produkt', 'produkty', 'produktów')}. Żaden nie ma ${who === 'all' ? 'dobrego dopasowania dla ' + (A.offRows().length ? 'wybranych osób' : 'całej rodziny') : personal ? 'co najmniej dobrego dopasowania' : 'oceny co najmniej „Dobre”'}.${best.length ? ' Poniżej najlepsze z dostępnych.' : ''}</div>${best.length ? `<div class="list" id="shopList">${best.map(itemHtml).join('')}</div>` : ''}`;
    } else body = `<p class="small">${personal ? 'Ułożone według dopasowania do ' + forWho + '.' : 'Ułożone według oceny składu. Ustaw cele, a lista dopasuje się do Ciebie.'} <a href="#/profil">${personal ? 'Zmień' : 'Ustaw cele'}</a></p>
        <div class="list" id="shopList">${shown.slice(0, 20).map(itemHtml).join('')}</div>
        <p class="small muted">Pokazujemy ${Math.min(20, shown.length)} z ${shown.length} (sprawdziliśmy ${list.length} popularnych produktów). Asortyment sklepów się zmienia.</p>`;
    const det = data.complete ? '' : '<p class="small muted" id="listDet">Nie udało się sprawdzić szczegółów wszystkich produktów (słaby zasięg albo baza nie odpowiada). Część wyników może się różnić od ekranu produktu.</p>';
    A.$('listBody').innerHTML = whoChips + (A.offNoteHtml ? A.offNoteHtml() : '') + chips + det + body + storeSheet;
    document.body.classList.toggle('sheet-open', !!storeSheet);
    A.listCache = all;
  }
  A.store.del('d-pdet'); // dawna kopia w localStorage (2.3.2), zastąpiona przez Cache API
  const redraw = (cat, storeKey) => { const d = LISTS[cat]; if (d && d.sig === JSON.stringify([A.profile, A.family]) && A.current.screen === 'list') { drawList(cat, storeKey, d); return true; } return false; };
  A.listWhoSet = (cat, storeKey, who) => { A.store.set('d-listwho', who); const sk = storeKey === 'all' || STORES.some(s => s.key === storeKey) || /^x:[a-z0-9]{2,40}$/.test(storeKey || '') ? storeKey : null; if (!redraw(cat, sk)) renderList(cat, sk); };
  A.listStore = (cat, storeKey) => { A.storeSheet = false; A.store.set('shopStore', storeKey); if (!redraw(cat, storeKey)) renderList(cat, storeKey); const b = document.querySelector('.store-sw'); if (b) b.focus(); };
  A.listStoreSheet = (cat, storeKey, on) => { A.storeSheet = on; if (!redraw(cat, storeKey)) renderList(cat, storeKey); const b = document.querySelector(on ? '.ls-sheet [aria-checked=true]' : '.store-sw'); if (b) b.focus(); };
})();
