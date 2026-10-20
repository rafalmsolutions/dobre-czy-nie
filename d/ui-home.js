/* Dobre czy nie? 1.0 – ekran startowy (cele i ograniczenia), ekran „Dla Ciebie” i listy „Najlepsze dla Ciebie”. */
'use strict';
(() => {
  const A = App, esc = A.esc;

  /* ---------- Start: 3 kroki ---------- */
  const QUICK_AVOID = [['allergens', 'gluten'], ['allergens', 'milk'], ['allergens', 'nuts'], ['allergens', 'eggs'], ['diet', 'vegan'], ['diet', 'vegetarian'], ['diet', 'glutenfree'], ['diet', 'lactose'], ['avoid', 'palm'], ['avoid', 'sweeteners'], ['avoid', 'sugar'], ['avoid', 'ultra']];
  let step = 1, draft = null, msg = '';
  A.route('start', () => {
    if (!draft) draft = { goals: A.profile.goals.slice(), picks: {}, name: A.userName() };
    if (!Object.keys(draft.picks).length) ['allergens', 'diet', 'avoid'].forEach(g => A.profile[g].forEach(k => { draft.picks[g + ':' + k] = true; }));
    renderStart();
  });
  function opt(g, k) { return PROFILE_OPTIONS[g].find(o => o.key === k); }
  function renderStart() {
    const el = A.$('scr-start');
    const bar = `<div class="steps-bar" aria-label="Krok ${step} z 3">${[1, 2, 3].map(i => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}<span class="small muted" style="margin-left:6px;font-weight:800">Krok ${step} z 3</span></div>`;
    let body = '';
    if (step === 1) {
      body = `<div class="row" style="align-items:flex-end">${A.mascot('hello', 64)}<div class="bubble">Pomożemy Ci wybierać produkty, które pasują właśnie do Ciebie.</div></div>
        <div><h1 id="startTitle" style="font-size:1.8rem">Jaki masz cel?</h1><p class="small muted">Wybierz do ${GOALS_MAX}. Zmienisz je w każdej chwili.</p></div>
        <div class="goal-grid">${GOALS.map(g => { const t = GOAL_TILES[g.key]; const on = draft.goals.includes(g.key); return `<button class="goal-tile" type="button" data-act="goal" data-k="${g.key}" aria-pressed="${on}" style="background:radial-gradient(circle at 30% 25%,#fff 0%,${t.bg} 65%)"><span class="tick" aria-hidden="true"><svg width="14" height="14"><use href="#i-check"/></svg></span>${art(t.icon, 42)}<b>${esc(t.label)}</b><span>${esc(t.hint)}</span></button>`; }).join('')}</div>
        <p class="msg" role="status" id="startMsg">${esc(msg)}</p>`;
    } else if (step === 2) {
      body = `<div class="row" style="align-items:flex-end">${A.mascot('think', 60)}<div class="bubble">Czego nie jesz albo czego unikasz? Sprawdzę to przy każdym produkcie.</div></div>
        <div><h1 id="startTitle" style="font-size:1.8rem">Czego unikasz?</h1><p class="small muted">Możesz nic nie zaznaczać. Pełną listę (alergeny, diety, własne składniki) znajdziesz w profilu.</p></div>
        <div class="pchips">${QUICK_AVOID.map(([g, k]) => `<label class="pchip"><input type="checkbox" data-pick="${g}:${k}"${draft.picks[g + ':' + k] ? ' checked' : ''}>${esc(opt(g, k).label)}</label>`).join('')}</div>
        <p class="small muted">Przy alergii aplikacja jest pomocą, a nie gwarancją. Zawsze sprawdź etykietę.</p>`;
    } else {
      body = `<div class="row" style="align-items:flex-end">${A.mascot('wink', 60)}<div class="bubble">Ostatnia rzecz. Jak mam się do Ciebie zwracać?</div></div>
        <div><h1 id="startTitle" style="font-size:1.8rem">Jak masz na imię?</h1><p class="small muted">Nieobowiązkowe. Imię zostaje tylko w tym telefonie.</p></div>
        <input class="field" id="startName" maxlength="30" autocomplete="given-name" placeholder="np. Ania" value="${esc(draft.name)}" aria-label="Twoje imię">
        <div class="panel stack"><b style="font-family:var(--f-display)">Jak to działa?</b><ul class="why">
          <li class="why-plus"><span class="why-ic">1</span><span>Skanujesz produkt i od razu widzisz, czy pasuje do Ciebie.</span></li>
          <li class="why-plus"><span class="why-ic">2</span><span>Zgadujesz „dobre czy nie”, zbierasz punkty i odznaki.</span></li>
          <li class="why-plus"><span class="why-ic">3</span><span>Odkładasz dobre produkty na półki, czyli listy zakupów.</span></li></ul></div>`;
    }
    el.innerHTML = `<div class="wrap" style="gap:12px">${bar}${body}
      <div class="stack" style="margin-top:auto;gap:6px">
        <button class="btn btn-green btn-block" type="button" data-act="start-next">${step < 3 ? (step === 1 && draft.goals.length ? `Dalej (${draft.goals.length} ${plural(draft.goals.length, 'cel', 'cele', 'celów')})` : 'Dalej') : 'Zaczynamy!'}</button>
        <div class="row" style="justify-content:space-between">${step > 1 ? '<button class="linkbtn" type="button" data-act="start-back">Wstecz</button>' : '<span></span>'}<button class="linkbtn" type="button" data-act="start-skip">Pomiń na razie</button></div>
      </div></div>`;
  }
  function saveStart(finish) {
    const p = Object.assign({}, A.profile, { goals: draft.goals.slice() });
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
      if (i >= 0) { draft.goals.splice(i, 1); msg = ''; }
      else if (draft.goals.length >= GOALS_MAX) msg = `Możesz wybrać najwyżej ${GOALS_MAX} cele. Odznacz któryś, żeby dodać nowy.`;
      else { draft.goals.push(k); msg = ''; }
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
  A.hasProfile = () => A.profile.goals.some(g => { const x = GOALS.find(y => y.key === g); return x && !x.general; }) || ['allergens', 'diet', 'avoid', 'custom'].some(g => A.profile[g].length);
  A.pctClass = lvl => ({ great: 'great', good: 'good', poor: 'poor', bad: 'bad' }[lvl] || 'unknown');
  A.profileChips = () => {
    const out = [];
    A.profile.goals.forEach(k => { const t = GOAL_TILES[k]; if (t) out.push(`<span class="chip"><span class="ci">${art(t.icon, 24)}</span>${esc(t.label)}</span>`); });
    ['allergens', 'diet', 'avoid'].forEach(g => A.profile[g].forEach(k => {
      const o = PROFILE_OPTIONS[g].find(x => x.key === k); if (!o) return;
      const icon = k === 'palm' ? 'avoid_palm' : 'avoid_generic';
      out.push(g === 'diet' ? `<span class="chip plain">${esc(o.label)}</span>` : `<span class="chip avoid"><span class="ci">${art(icon, 24)}</span>Bez: ${esc(o.label.toLowerCase())}</span>`);
    }));
    A.profile.custom.forEach(c => out.push(`<span class="chip avoid"><span class="ci">${art('avoid_generic', 24)}</span>Bez: ${esc(c)}</span>`));
    return out;
  };
  A.route('home', () => {
    const name = A.userName();
    const lv = Game.levelFor(A.cfg, A.game.points);
    const nextPts = lv.next ? lv.next.minPoints : null;
    const pct = nextPts ? Math.round((A.game.points - lv.minPoints) / (nextPts - lv.minPoints) * 100) : 100;
    const ch = Game.challengeProgress(A.game, A.cfg, new Date());
    const chips = A.profileChips();
    const hist = A.store.get('history', []).filter(h => h && h.code);
    const swap = hist.find(h => h.alt && h.pct != null && h.pct < 50 && !Shelf.hasCode(A.shelves, h.alt.code));
    const slots = ch ? Array.from({ length: Math.min(ch.target, 7) }, (_, i) => i < ch.have ? '<span class="slot done"><svg width="20" height="20" style="color:#7A4A1F"><use href="#i-check"/></svg></span>' : `<span class="slot todo">${i + 1}</span>`).join('') : '';
    A.$('scr-home').innerHTML = `<div class="wrap">
      <div class="d-head"><span class="d-word"><span class="w-light">dobre </span><b>czy nie?</b></span>${A.hudPill()}</div>
      <div class="d-scanhero"><span class="d-arc d-arc-home" aria-hidden="true"></span>
        <button class="d-scanbtn" type="button" data-act="scan"><svg aria-hidden="true"><use href="#i-scan"/></svg><span>Skanuj</span></button>
        <div class="d-hello"><p>${name ? 'Cześć, ' + esc(name) : 'Cześć'}</p><h1><span class="w-light">Sprawdź skład</span> <span class="w-bold">w 2 sek.</span></h1></div></div>
      <a class="panel level-card" href="#/postepy"><span>${shieldSvg(lv.level, 54)}</span><span class="grow stack" style="gap:6px"><span class="row" style="justify-content:space-between"><b style="font-family:var(--f-display);font-size:1.1rem">${esc(lv.name)}</b><span class="small" style="font-weight:800;color:var(--green-d)">Poziom ${lv.level}</span></span>
        <span class="xp"><i style="width:${pct}%"></i></span><span class="small muted">${nextPts ? `${nextPts - A.game.points} pkt do poziomu ${lv.level + 1}: ${esc(lv.next.name)}` : 'Najwyższy poziom. Brawo!'}</span></span></a>
      ${ch ? `<div class="hero-green stack" id="challenge">
        <div class="row" style="justify-content:space-between;position:relative"><span class="reward-chip gold" style="letter-spacing:.06em">WYZWANIE TYGODNIA</span><span class="small" style="font-weight:700">${ch.done ? 'Ukończone!' : 'Zostało ' + ch.daysLeft + ' ' + plural(ch.daysLeft, 'dzień', 'dni', 'dni')}</span></div>
        <h2 style="font-size:1.4rem;max-width:260px;position:relative">${esc(ch.title)}</h2>
        <div class="slots" aria-label="Postęp ${ch.have} z ${ch.target}">${slots}</div>
        <div class="chips" style="position:relative">${A.rewardChips(ch.reward)}</div></div>` : ''}
      <section class="stack" aria-labelledby="hProf"><div class="sec-head"><h2 id="hProf">Twój profil</h2><a href="#/profil">Zmień</a></div>
        ${chips.length ? `<div class="chips">${chips.join('')}</div>` : `<div class="empty">Ustaw cel i to, czego unikasz, a od razu zobaczysz, czy produkt pasuje do Ciebie. <a href="#/start">Ustaw profil</a></div>`}</section>
      <section class="stack" aria-labelledby="hBest"><div class="sec-head"><h2 id="hBest" style="font-size:1.25rem">${A.hasProfile() ? 'Najlepsze dla Ciebie' : 'Najlepsze w sklepie'}</h2><a href="#/najlepsze">Wszystkie</a></div>
        <div class="tiles">${HOME_TILES.map(t => `<a class="tile" href="#/lista/${t.cat}" ><img class="d-tile-img" src="${A.catImg(t.cat)}" alt="" width="96" height="96"><b>${esc(t.label)}</b><span>${A.hasProfile() ? 'dobre dla Ciebie' : 'z najlepszą oceną'}</span></a>`).join('')}<a class="tile" href="#/najlepsze"><span class="d-tile-stack" aria-hidden="true"><img src="img/cat/cheeses.webp" alt=""><img src="img/cat/pastas.webp" alt=""><img src="img/cat/nuts.webp" alt=""></span><b>Wszystkie kategorie</b><span>${SHOP_CATEGORIES.length} kategorii</span></a></div></section>
      ${swap ? `<section class="stack" aria-labelledby="hSwap"><h2 id="hSwap" style="font-size:1.25rem">Zamień na lepsze</h2>
        <div class="card stack" id="swapCard">
          <a class="swap-row" href="#/p/${swap.code}" style="text-decoration:none;color:inherit"><span class="swap-thumb">${swap.image ? `<img src="${esc(swap.image)}" alt="">` : art('prod_cup_berry', 50)}<span class="pct ${A.pctClass(swap.level)}">${swap.pct}${A.hasProfile() ? '%' : ''}</span></span><span class="grow"><b style="display:block">${esc(swap.name)}</b><span class="small" style="color:var(--poor);font-weight:700">${A.hasProfile() ? 'Słabe dopasowanie do Ciebie' : esc(grade(swap.pct).label)}</span></span></a>
          <div class="row small muted" style="padding-left:20px;font-weight:700"><svg width="18" height="18" style="color:var(--green)"><use href="#i-back" transform="rotate(-90 12 12)"/></svg>ta sama kategoria</div>
          <a class="swap-row" href="#/p/${esc(swap.alt.code)}" style="text-decoration:none;color:inherit"><span class="swap-thumb">${swap.alt.image ? `<img src="${esc(swap.alt.image)}" alt="">` : art('prod_cup', 50)}${swap.alt.pct != null ? `<span class="pct ${A.pctClass(swap.alt.level)}">${swap.alt.pct}%</span>` : ''}</span><span class="grow"><b style="display:block">${esc(swap.alt.name)}</b><span class="small" style="color:var(--great);font-weight:700">${esc(swap.alt.label || 'Lepszy wybór')}</span></span></a>
          <button class="btn btn-green btn-block" type="button" data-act="swap" data-from="${esc(swap.code)}">Zamień i dodaj na półkę (+15 pkt)</button></div></section>` : ''}
      <section class="stack" aria-labelledby="hHist"><div class="sec-head"><h2 id="hHist" style="font-size:1.25rem">Ostatnio sprawdzone</h2>${hist.length ? '<button class="linkbtn small" type="button" data-act="clear-history">Wyczyść</button>' : ''}</div>
        ${hist.length ? `<div class="list">${hist.slice(0, 8).map(h => { const ci = h.kind === 'cosmetic' ? '' : A.catImg(A.catKeyOf(h.categories) || A.catKeyByName(h.name)); return `<a class="item" href="#/p/${esc(h.code)}">${ci ? `<img class="thumb dish" src="${ci}" alt="" loading="lazy">` : h.image ? `<img class="thumb" src="${esc(h.image)}" alt="" loading="lazy">` : `<span class="thumb">${art('dept_other', 34)}</span>`}<span class="grow"><span class="t1">${esc(h.name)}</span><span class="t2">${esc([h.brand, h.kind === 'cosmetic' ? 'kosmetyk' : ''].filter(Boolean).join(' · '))}</span></span>${h.pct != null ? `<span class="pct ${A.pctClass(h.level)}">${h.pct}%</span>` : '<span class="pct none">–</span>'}</a>`; }).join('')}</div>`
        : `<div class="empty stack" style="align-items:center">${A.mascot('smile', 64)}<span>Tu pojawią się sprawdzone produkty. Zeskanuj coś z kuchni albo łazienki.</span><button class="btn btn-green" type="button" data-act="scan"><svg><use href="#i-scan"/></svg>Skanuj produkt</button></div>`}</section>
      <section class="glass stack" aria-labelledby="hCode"><h2 id="hCode" style="font-size:1.05rem">Nie masz aparatu pod ręką?</h2>
        <form class="inline-form" id="homeForm" novalidate><input class="field" id="homeCode" inputmode="numeric" autocomplete="off" maxlength="40" placeholder="cyfry spod kodu kreskowego" aria-label="Kod kreskowy"><button class="btn btn-green btn-sm" type="submit">Sprawdź</button></form>
        <p class="msg" id="homeMsg" role="status"></p>
        <div class="chips">${EXAMPLES.map(x => `<a class="chip plain" href="#/p/${x.code}">Przykład: ${esc(x.label)}</a>`).join('')}</div></section>
    </div>`;
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
    const sel = A.store.get('shopStore', 'all');
    renderList(cat, sel === 'all' || STORES.some(s => s.key === sel) ? sel : 'all');
  });
  const itemHtml = x => { const img = A.safeImg(x.pr.image); const st = x.pr.stores.slice(0, 2).map(A.storeName).join(', '); return `<div class="item" style="cursor:default"><a href="#/p/${esc(x.pr.code)}" class="row grow" style="text-decoration:none;color:inherit;min-width:0">${img ? `<img class="thumb" src="${esc(img)}" alt="" loading="lazy">` : `<span class="thumb">${art('dept_' + departmentFor(x.pr), 34)}</span>`}<span class="grow"><span class="t1">${esc(x.pr.name)}</span><span class="t2">${esc([x.pr.brand, x.pm.label].filter(Boolean).join(' · '))}</span>${st ? `<span class="t2">Sklep: ${esc(st)}</span>` : ''}</span><span class="pct ${A.pctClass(x.pm.level)} alt-score">${x.pm.pct == null ? '–' : x.pm.pct + '%'}</span></a><button class="btn btn-white iconbtn" type="button" data-act="shelf-add-code" data-code="${esc(x.pr.code)}" aria-label="Dodaj ${esc(x.pr.name)} na półkę"${Shelf.hasCode(A.shelves, x.pr.code) ? ' disabled' : ''}><svg><use href="#i-${Shelf.hasCode(A.shelves, x.pr.code) ? 'check' : 'plus'}"/></svg></button></div>`; };
  A.storeName = raw => { const f = fold(raw).replace(/\s+/g, ''); const k = STORES.find(x => f.includes(x.key)); return k ? k.label : String(raw).charAt(0).toUpperCase() + String(raw).slice(1); };
  async function renderList(cat, storeKey) {
    const cName = (SHOP_CATEGORIES.find(c => c.key === cat) || {}).label || 'Produkty';
    const el = A.$('scr-list');
    el.innerHTML = `<div class="wrap"><div class="topbar"><a class="btn btn-white iconbtn" href="#/najlepsze" aria-label="Wszystkie kategorie"><svg><use href="#i-back"/></svg></a><h1 class="grow">${esc(cName)}</h1>${A.hudPill()}</div>
      <div class="d-listhero" aria-hidden="true"><span class="d-arc d-arc-list"></span><img src="${A.catImg(cat)}" alt="" width="480" height="480"></div>
      <div id="listBody" class="stack" aria-live="polite"><p class="small muted" id="listWait">Szukam produktów…</p><div class="sk" style="height:58px"></div><div class="sk" style="height:58px"></div><div class="sk" style="height:58px"></div></div></div>`;
    const token = {}; listToken = token;
    try {
      const list = await A.fetchCategory(cat, sec => { const w = A.$('listWait'); if (w && listToken === token) w.textContent = `Wyszukiwarka produktów ma limit zapytań. Spróbuję za ${sec} s…`; });
      if (listToken !== token || A.current.screen !== 'list') return;
      const personal = A.hasProfile();
      const all = list.filter(pr => pr.name).map(pr => { const an = analyze(pr); return { pr, an, pm: personalMatch(pr, an, A.profile) }; })
        .filter(x => x.an.score != null && x.an.parts.length >= 2)
        .sort((a, b) => (b.pm.pct ?? -1) - (a.pm.pct ?? -1));
      const good = all.filter(x => x.pm.pct >= 50);
      const counts = {}; STORES.forEach(s => { counts[s.key] = good.filter(x => A.storeOf(x.pr, s.key)).length; });
      if (storeKey !== 'all' && !counts[storeKey]) storeKey = 'all';
      const shown = storeKey === 'all' ? good : good.filter(x => A.storeOf(x.pr, storeKey));
      const withStore = list.filter(pr => pr.stores.length).length;
      const chips = good.length ? `<div class="chips" role="group" aria-label="Sklep">${[['all', 'Wszystkie sklepy', good.length]].concat(STORES.filter(s => counts[s.key]).map(s => [s.key, s.label, counts[s.key]])).map(([k, l, n]) => `<button class="cat-tab" type="button" data-act="list-store" data-cat="${esc(cat)}" data-store="${k}" aria-pressed="${k === storeKey}">${esc(l)} <span class="muted">${n}</span></button>`).join('')}</div>
        <p class="small muted">Sklep przy produkcie wpisują kupujący, więc znamy go tylko dla ${withStore} z ${list.length} produktów. Brak sklepu nie znaczy, że produktu tam nie ma.</p>` : '';
      let body;
      if (!list.length) body = `<div class="empty">W bazie Open Food Facts nie ma jeszcze produktów z tej kategorii sprzedawanych w Polsce.</div>`;
      else if (!good.length) {
        const best = all.filter(x => x.pm.pct != null && x.pm.status !== 'fail').slice(0, 5);
        body = `<div class="empty">Sprawdziliśmy ${list.length} ${plural(list.length, 'produkt', 'produkty', 'produktów')}. Żaden nie ma ${personal ? 'co najmniej dobrego dopasowania do Ciebie' : 'oceny co najmniej „Dobre”'}.${best.length ? ' Poniżej najlepsze z dostępnych.' : ''}</div>${best.length ? `<div class="list" id="shopList">${best.map(itemHtml).join('')}</div>` : ''}`;
      } else body = `<p class="small">${personal ? 'Ułożone według dopasowania do Twoich celów i ograniczeń.' : 'Ułożone według oceny składu. Ustaw cele, a lista dopasuje się do Ciebie.'} <a href="#/profil">${personal ? 'Zmień' : 'Ustaw cele'}</a></p>
        <div class="list" id="shopList">${shown.slice(0, 20).map(itemHtml).join('')}</div>
        <p class="small muted">Pokazujemy ${Math.min(20, shown.length)} z ${shown.length} (sprawdziliśmy ${list.length} popularnych produktów). Asortyment sklepów się zmienia.</p>`;
      A.$('listBody').innerHTML = chips + body;
      A.listCache = all;
    } catch (e) {
      if (listToken !== token || !A.$('listBody')) return;
      const kind = (e && e.kind) || 'network';
      A.$('listBody').innerHTML = `<div class="empty stack" style="align-items:center">${A.mascot('sad', 60)}<b>${esc(A.ERR_TEXT[kind][0])}</b><span>${esc(A.ERR_TEXT[kind][1])}</span><button class="btn btn-gold" type="button" data-act="list-store" data-cat="${esc(cat)}" data-store="${esc(storeKey)}">Spróbuj ponownie</button></div>`;
    }
  }
  A.listStore = (cat, storeKey) => { A.store.set('shopStore', storeKey); renderList(cat, storeKey); };
})();
