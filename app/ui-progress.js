/* Dobre czy nie? 1.0 – postępy i odznaki oraz profil i ustawienia. */
'use strict';
(() => {
  const A = App, esc = A.esc;

  /* ---------- Twoje postępy ---------- */
  let cat = 'all', sel = null;
  const EARN = [
    ['magnifier', 'odkrywanie', 'Sprawdź produkt', 'do 20 pkt dziennie', 'product_checked'],
    ['target', 'odkrywanie', 'Zgadnij: dobre czy nie', 'pudło też uczy: +3 pkt', 'guess_right'],
    ['swap', 'wybory', 'Zamień na lepsze', 'zamiennik trafia na listę', 'swap_to_better'],
    ['cart', 'wybory', 'Odhacz całą listę w sklepie', 'raz dziennie na listę', 'list_completed'],
    ['plus', 'baza', 'Dodaj brakujący produkt', 'nazwa i 3 zdjęcia', 'product_added'],
    ['shield', 'baza', 'Zgłoś błąd w danych', 'do 3 dziennie', 'report_sent'],
    ['trophy', 'wybory', 'Ukończ wyzwanie tygodnia', 'nowe co poniedziałek', null]
  ];
  A.route('progress', () => render());
  function render() {
    const now = new Date(), cfg = A.cfg, g = A.game;
    const lv = Game.levelFor(cfg, g.points), levels = (cfg.levels && cfg.levels.levels) || [];
    const nextPts = lv.next ? lv.next.minPoints : null;
    const pct = nextPts ? Math.round((g.points - lv.minPoints) / (nextPts - lv.minPoints) * 100) : 100;
    const achs = (cfg.achievements && cfg.achievements.achievements) || [];
    const cats = (cfg.achievements && cfg.achievements.categories) || {};
    const extra = A.extraMetrics();
    const prog = achs.map(a => Object.assign({ a }, Game.progress(g, cfg, a, now, extra)));
    // Wersja D: odznaki w 3 stopniach. Grupujemy wpisy po „base”; medal pokazuje najwyższy zdobyty stopień.
    const groups = [], byBase = {};
    prog.forEach(p => { const b = p.a.base || p.a.id; if (!byBase[b]) { byBase[b] = { base: b, a: p.a, tiers: [] }; groups.push(byBase[b]); } byBase[b].tiers.push(p); });
    groups.forEach(x => { x.tiers.sort((m, n) => (m.a.tier || 1) - (n.a.tier || 1)); x.doneTier = x.tiers.filter(t => t.done).length; x.next = x.tiers.find(t => !t.done) || null; });
    const seen = A.store.get('d-seen-ach', {}), seenNext = {};
    groups.forEach(x => { x.fresh = x.doneTier > (seen[x.base] || 0); seenNext[x.base] = x.doneTier; });
    A.store.set('d-seen-ach', seenNext);
    const earned = groups.filter(x => x.doneTier > 0).length, tiersDone = prog.filter(p => p.done).length;
    if (!sel || !byBase[sel]) sel = (groups.find(x => x.next) || groups[0] || {}).base || null;
    const s = sel ? byBase[sel] : null;
    const TIER = ['', 'Brąz', 'Srebro', 'Złoto'];
    const usedCats = [...new Set(achs.map(a => a.category))];
    const dots = levels.map((l, i) => `${i ? `<span class="lvline${l.level <= lv.level ? ' done' : ''}"></span>` : ''}<span class="lvdot ${l.level < lv.level ? 'done' : l.level === lv.level ? 'cur' : 'next'}" title="${esc(l.name)}">${l.level}</span>`).join('');
    const rulesEv = (cfg.rules && cfg.rules.events) || {};
    const ch = Game.challengeProgress(g, cfg, now);
    const inv = Object.entries(g.inventory || {}).filter(([, n]) => n > 0);
    A.$('scr-progress').innerHTML = `<div class="wrap">
      ${A.collTabs('badges')}
      <div class="panel stack">
        <div class="row">${A.mascot('detective', 80)}<div class="grow stack" style="gap:5px"><span class="reward-chip green" style="align-self:flex-start">POZIOM ${lv.level}</span><b style="font-family:var(--f-display);font-size:1.35rem;line-height:1.05">${esc(lv.name)}</b>
          <span class="xp"><i style="width:${pct}%"></i><span>${g.points}${nextPts ? ' / ' + nextPts : ''} pkt</span></span></div></div>
        ${levels.length ? `<div class="lvdots" aria-label="Poziomy">${dots}</div>` : ''}
        <p class="small muted">${lv.next ? `Następny: <b style="color:var(--ink)">${esc(lv.next.name)}</b> za ${nextPts - g.points} pkt.` : 'Masz najwyższy poziom. Brawo!'}</p>
      </div>
      <div class="stats">
        <div class="card stat">${medalSvg('magnifier', 'odkrywanie', true, 40)}<div><b>${(g.sets.product_checked || []).length}</b><span>${plural((g.sets.product_checked || []).length, 'sprawdzony produkt', 'sprawdzone produkty', 'sprawdzonych produktów')}</span></div></div>
        <div class="card stat">${medalSvg('target', 'odkrywanie', true, 40)}<div><b>${g.counters.guess_right || 0}</b><span>${plural(g.counters.guess_right || 0, 'trafny typ', 'trafne typy', 'trafnych typów')}</span></div></div>
        <div class="card stat">${medalSvg('swap', 'wybory', true, 40)}<div><b>${g.counters.swap_to_better || 0}</b><span>${plural(g.counters.swap_to_better || 0, 'zamiana na lepsze', 'zamiany na lepsze', 'zamian na lepsze')}</span></div></div>
        <div class="card stat">${medalSvg('shield', 'baza', true, 40)}<div><b>${(g.counters.product_added || 0) + (g.counters.report_sent || 0)}</b><span>${plural((g.counters.product_added || 0) + (g.counters.report_sent || 0), 'pomoc dla bazy', 'pomoce dla bazy', 'pomocy dla bazy')}</span></div></div>
      </div>
      ${ch ? `<div class="card stack"><div class="sec-head"><h2 style="font-size:1.1rem">Wyzwanie tygodnia</h2><span class="small muted">${ch.done ? 'ukończone' : 'zostało ' + ch.daysLeft + ' ' + plural(ch.daysLeft, 'dzień', 'dni', 'dni')}</span></div><b>${esc(ch.title)}</b><span class="xp green"><i style="width:${Math.round(ch.have / ch.target * 100)}%"></i><span>${ch.have} z ${ch.target}</span></span></div>` : ''}
      ${ribbonSvg(esc(`Odznaki ${earned} z ${groups.length}`), 250)}
      <p class="small muted center" style="margin-top:-8px">Zdobyte stopnie: ${tiersDone} z ${prog.length}. Każda odznaka ma brąz, srebro i złoto.</p>
      <div class="chips" style="justify-content:center" role="group" aria-label="Kategorie odznak">${[['all', 'Wszystkie']].concat(usedCats.map(c => [c, (cats[c] || {}).label || c])).map(([k, l]) => `<button class="cat-tab" type="button" data-act="ach-cat" data-cat="${esc(k)}" aria-pressed="${k === cat}">${esc(l)}</button>`).join('')}</div>
      ${s ? `<div class="panel row" id="achDetail" aria-live="polite"><span style="flex:0 0 auto">${medalSvg(s.a.icon, s.a.category, s.doneTier > 0, 92, s.doneTier, s.fresh ? 'm-pop' : '')}</span><div class="grow stack" style="gap:6px"><b style="font-family:var(--f-display);font-size:1.2rem">${esc(s.a.name)}${s.doneTier ? ' · ' + TIER[s.doneTier] : ''}</b>
        <span class="small">${s.next ? esc(s.next.a.description) : 'Masz złoto. Brawo!'}</span>
        ${s.next ? `<span class="xp"><i style="width:${Math.round(s.next.have / s.next.target * 100)}%"></i></span><span class="small" style="font-weight:800">${s.next.have} z ${s.next.target} do: ${TIER[s.next.a.tier || 1].toLowerCase()} (+${(s.next.a.reward || {}).points || 0} pkt)</span>` : ''}
        <div class="d-tiers">${s.tiers.map(t => `<span class="d-tier${t.done ? ' done' : ''}">${medalSvg(t.a.icon, t.a.category, t.done, 34, t.a.tier || 1)}${TIER[t.a.tier || 1]} · ${t.a.target}</span>`).join('')}</div></div></div>` : ''}
      <div class="panel medals" id="medals">${groups.filter(x => cat === 'all' || x.a.category === cat).map(x => `<button class="medal-btn${x.doneTier ? '' : ' locked'}" type="button" data-act="ach-pick" data-id="${esc(x.base)}" aria-pressed="${x.base === sel}" aria-label="${esc(x.a.name)}${x.doneTier ? ', ' + TIER[x.doneTier].toLowerCase() : ''}${x.next ? ', do następnego stopnia ' + x.next.have + ' z ' + x.next.target : ', wszystkie stopnie'}">${medalSvg(x.a.icon, x.a.category, x.doneTier > 0, 66, x.doneTier, x.fresh ? 'm-pop' : '')}<b>${esc(x.a.name)}</b><span class="small" style="font-size:12px;font-weight:800">${x.doneTier ? TIER[x.doneTier] : 'Jeszcze nie'}</span>${x.next ? `<span class="mini-xp"><i style="width:${Math.round(x.next.have / x.next.target * 100)}%"></i></span><span class="small muted" style="font-size:12px;font-weight:700">${x.next.have} z ${x.next.target}</span>` : ''}</button>`).join('')}</div>
      ${ribbonSvg('Jak zdobyć punkty', 270)}
      <div class="panel stack" style="gap:0">${EARN.map(([gl, c, t, n, ev], i) => { const p = ev ? (rulesEv[ev] || {}).points : 50; return `<div class="row" style="padding:7px 0;${i ? 'border-top:1.5px dashed #E2CFA8' : ''}">${medalSvg(gl, c, true, 38)}<span class="grow"><b style="display:block;font-size:.95rem">${esc(t)}</b><span class="small muted">${esc(n)}</span></span><span class="reward-chip gold">+${p || 0}</span></div>`; }).join('')}</div>
      <p class="small muted center">Punktów nie da się kupić. Przerwa nie kasuje postępów. Nie ma rankingów wagi ani porównywania się z innymi.</p>
    </div>`;
  }
  A.achAction = (act, el) => {
    if (act === 'ach-cat') { cat = el.dataset.cat; render(); const b = A.$('scr-progress').querySelector(`[data-act=ach-cat][data-cat="${cat}"]`); if (b) b.focus(); }
    if (act === 'ach-pick') { sel = el.dataset.id; render(); const b = A.$('scr-progress').querySelector(`[data-act=ach-pick][data-id="${sel}"]`); if (b) b.focus(); }
  };

  /* ---------- Profil i ustawienia ---------- */
  let draftCustom = [], confirmWipe = false, editing = 'me', confirmDel = false;
  const person = () => editing === 'me' ? null : A.family.find(f => f.id === editing) || null;
  A.editProfileOf = id => { editing = id === 'me' || A.family.some(f => f.id === id) ? id : 'me'; A.go('#/profil'); };
  /* 3.0: Profil jako spis (Preferencje, Wykluczenia, Ulubione sklepy, Ustawienia, Informacje) z osobnymi ekranami.
     Wszystkie pola są w jednym formularzu (ukryte poza aktywnym ekranem), więc zapis działa tak jak wcześniej. */
  let sub = '';
  const SUBS = { preferencje: 'Preferencje', wykluczenia: 'Wykluczenia', sklepy: 'Ulubione sklepy', ustawienia: 'Ustawienia', informacje: 'Informacje i pomoc', osoby: 'Domownicy' };
  A.route('profile', arg => {
    sub = SUBS[arg] ? arg : '';
    if (sub === 'ustawienia' || sub === 'informacje' || sub === 'sklepy') editing = 'me';
    if (!person()) editing = 'me';
    draftCustom = (person() ? person().p : A.profile).custom.slice(); confirmWipe = false; confirmDel = false; renderProfile();
  });
  const nameOf = id => id === 'me' ? 'Ty' : (A.family.find(f => f.id === id) || {}).name || '';
  const ckRow = (name, key, label, on, hint) => `<label class="ck-row"><span class="grow"><b>${esc(label)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</span><input class="ck-in" type="checkbox" name="${name}" value="${esc(key)}"${on ? ' checked' : ''}><span class="ck" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span></label>`;
  const tgRow = (id, label, hint, on) => `<label class="tg-row" for="${id}"><span class="grow"><b>${esc(label)}</b><small>${esc(hint)}</small></span><input class="tg" type="checkbox" role="switch" id="${id}"${on ? ' checked' : ''}></label>`;
  const navRow = (href, title, sum) => `<a class="nav-row" href="${href}"><span class="grow"><b>${esc(title)}</b><small>${esc(sum)}</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></a>`;
  const lab = (g, k) => (PROFILE_OPTIONS[g].find(o => o.key === k) || {}).label || k;
  function renderProfile() {
    const fp = person(), p = fp ? fp.p : A.profile, me = !fp, who = nameOf(editing);
    const sec = k => sub === k ? '' : ' hidden';
    const goalsSum = p.goals.map(k => GOAL_TILES[k] ? GOAL_TILES[k].label : k).concat(p.goals.length ? [] : p.watch.map(k => { const w = WATCH.find(x => x.key === k); return w ? w.label.replace(' (więcej)', '') : k; })).join(' · ') || 'Nie ustawiono';
    const exclSum = [].concat(p.allergens.map(k => lab('allergens', k)), p.diet.map(k => lab('diet', k)), p.avoid.map(k => lab('avoid', k)), p.custom).join(' · ') || 'Nie ustawiono';
    const storeSum = A.myStores().map(k => A.storeLabel(k)).join(', ') || 'Nie wybrano';
    const watchSum = p.watch.map(k => { const w = WATCH.find(x => x.key === k); return w ? w.label.replace(' (więcej)', '').toLowerCase() : k; }).join(' · ');
    const tabs = [{ id: 'me', name: 'Ty' }].concat(A.family);
    const head = sub ? `<div class="sub-top"><a class="btn btn-white iconbtn" href="#/profil" aria-label="Wróć do profilu"><svg><use href="#i-back"/></svg></a><h1>${esc(SUBS[sub])}</h1><span class="iconbtn" aria-hidden="true"></span></div>`
      : `<div class="pf-head"><div><h1>Profil</h1><p>Preferencje Twoje i domowników.</p></div><svg width="30" height="30" aria-hidden="true"><use href="#i-lupka"/></svg></div>`;
    A.$('scr-profile').innerHTML = `<div class="wrap pf${sub ? ' pf-sub' : ''}"><form class="stack" id="profileForm" novalidate>
      ${head}
      <p class="save-state small" id="saveState" role="status" aria-live="polite"></p>
      <div class="pf-index"${sec('')}>
        <div class="pf-sec"><div class="sec-head"><h2>Domownicy</h2><a href="#/profil/osoby">Zarządzaj</a></div>
          <div class="fam-tabs" role="tablist" aria-label="Czyje preferencje">${tabs.map(t => `<button type="button" role="tab" class="fam-tab${t.id === editing ? ' on' : ''}" aria-selected="${t.id === editing}" data-act="fam-pick" data-id="${esc(t.id)}">${esc(t.name)}</button>`).join('')}${A.family.length ? '' : '<button type="button" class="fam-tab add" data-act="fam-add">+ Dodaj osobę</button>'}</div></div>
        <div class="pf-sec"><h2>Dopasowanie produktów${fp ? ': ' + esc(fp.name) : ''}</h2><div class="rows">
          ${navRow('#/profil/preferencje', 'Preferencje', goalsSum)}${navRow('#/profil/wykluczenia', 'Wykluczenia', exclSum)}${me ? navRow('#/profil/sklepy', 'Ulubione sklepy', storeSum) : ''}</div></div>
        <div class="pf-sec"><h2>Aplikacja</h2><div class="rows">${navRow('#/profil/ustawienia', 'Ustawienia', 'Nagrody, dźwięki i sposób oceniania')}${navRow('#/profil/informacje', 'Informacje i pomoc', 'Jak oceniamy, źródła danych, kontakt')}</div></div>
        <p class="pf-note">Dane zostają na tym urządzeniu.<br>Profil działa bez zakładania konta.</p>
      </div>
      <div class="pf-osoby"${sec('osoby')}>
        <p class="small muted">Dodaj domowników (np. dziecko z alergią), a przy produkcie zobaczysz wynik dla każdego. Album liczy się według Twojego profilu.</p>
        <div class="fam-tabs" role="tablist" aria-label="Osoba">${tabs.map(t => `<button type="button" role="tab" class="fam-tab${t.id === editing ? ' on' : ''}" aria-selected="${t.id === editing}" data-act="fam-pick" data-id="${esc(t.id)}">${esc(t.name)}</button>`).join('')}
          ${A.family.length < A.FAMILY_MAX ? '<button type="button" class="fam-tab add" data-act="fam-add">+ Dodaj osobę</button>' : ''}</div>
        <div class="stack" style="gap:6px"><label for="profName"><b>${fp ? 'Imię lub pseudonim' : 'Twoje imię'}</b> <span class="small muted">${fp ? '' : '(nieobowiązkowe)'}</span></label><input class="field" id="profName" maxlength="30" autocomplete="${fp ? 'off' : 'given-name'}" value="${esc(fp ? fp.name : A.userName())}"></div>
        ${fp ? (confirmDel ? `<div class="ls-note"><b>Usunąć profil „${esc(fp.name)}”?</b><div class="actions"><button class="btn btn-red btn-sm" type="button" data-act="fam-del-yes">Usuń</button><button class="btn btn-white btn-sm" type="button" data-act="fam-del-no">Zostaw</button></div></div>` : '<button class="linkbtn small red-link" type="button" data-act="fam-del" style="align-self:flex-start">Usuń tę osobę</button>') : ''}
      </div>
      <div class="pf-pref"${sec('preferencje')}>
        <p class="pf-who">Edytujesz: <b>${esc(who)}</b></p>
        <h2 class="pf-q">${fp ? `Co jest ważne dla: ${esc(fp.name)}?` : 'Co jest dla Ciebie ważne?'}</h2>
        <p class="small muted">Wybierz do ${GOALS_MAX} celów. Na ich podstawie dobierzemy kryteria oceny. Zmiany zapisują się od razu.</p>
        <div class="rows">${GOALS.map(g => { const t = GOAL_TILES[g.key], on = p.goals.includes(g.key); return `<button class="ck-row" type="button" data-act="prof-goal" data-k="${g.key}" aria-pressed="${on}"><span class="grow"><b>${esc(t.label)}${g.key === 'healthy' ? '' : ' · ' + esc(t.hint)}</b></span><span class="ck" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span></button>`; }).join('')}</div>
        <p class="msg" id="goalMsg" role="status"></p>
        <details class="pf-more" id="watchSet"><summary><span class="grow"><b>Szczegółowe kryteria</b><small>${esc(watchSum || 'cele ustawiają je same')}</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary>
          <p class="small muted">Możesz pilnować do ${WATCH_MAX} rzeczy.</p>
          <div class="rows">${WATCH.map(w => ckRow('watch', w.key, w.label, p.watch.includes(w.key))).join('')}</div>
          <p class="msg" id="watchMsg" role="status"></p>
          <div class="d-rules small"><b>Jak liczymy każdą pozycję</b>
            <span>Cukier, sól, tłuszcze, kalorie, przetworzenie: mało <b>+5</b>, średnio <b>−10</b>, dużo <b>−25</b> i najwyżej 45%.</span>
            <span>Olej palmowy, słodziki, kofeina: zawiera <b>−25</b> i najwyżej 45%.</span>
            <span>Białko, błonnik: dużo <b>+10</b>, źródło <b>+5</b>.</span>
            <span>Brak danych w bazie: najwyżej 70%.</span></div></details>
        <p class="small muted">Alergeny i dietę ustawisz w <a href="#/profil/wykluczenia">„Wykluczeniach”</a>.</p>
        <button class="btn btn-dark btn-block" type="submit">Gotowe</button>
      </div>
      <div class="pf-excl"${sec('wykluczenia')}>
        <p class="pf-who">Edytujesz: <b>${esc(who)}</b></p>
        <p class="small muted">Produkt, który to zawiera, oznaczamy „Nie pasuje” (0–10%). Śladowe ilości: najwyżej 35%. Zmiany zapisują się od razu.</p>
        <h3 class="pf-sh">Alergeny</h3><div class="rows">${PROFILE_OPTIONS.allergens.map(o => ckRow('allergens', o.key, o.label, p.allergens.includes(o.key))).join('')}</div>
        <h3 class="pf-sh">Dieta</h3><div class="rows">${PROFILE_OPTIONS.diet.map(o => ckRow('diet', o.key, o.label, p.diet.includes(o.key))).join('')}${PROFILE_OPTIONS.avoid.map(o => ckRow('avoid', o.key, o.label, p.avoid.includes(o.key))).join('')}</div>
        <h3 class="pf-sh">Własne składniki</h3>
        <div class="inline-form"><input id="customInput" class="field" maxlength="40" placeholder="np. czosnek, kakao" autocomplete="off" aria-label="Nazwa składnika"><button class="btn btn-dark btn-sm" type="button" data-act="add-custom">Dodaj</button></div>
        <p class="msg" id="customMsg" role="status"></p><div class="pchips" id="customChips"></div>
        <p class="small muted">Szukamy też odmian (np. „czosnku”) i pomijamy frazy w rodzaju „bez dodatku”.</p>
        ${me ? `<h3 class="pf-sh">W kosmetykach unikam</h3><div class="rows">${PROFILE_OPTIONS.cosmetic.map(o => ckRow('cosmetic', o.key, o.label, p.cosmetic.includes(o.key))).join('')}</div>` : ''}
        <p class="small muted">Przy alergii aplikacja jest pomocą, a nie gwarancją. Dane pochodzą z bazy tworzonej przez społeczność, więc zawsze sprawdź etykietę.</p>
        <button class="btn btn-dark btn-block" type="submit">Gotowe</button>
      </div>
      ${me ? `<div class="pf-shops"${sec('sklepy')}>
        <p class="small muted">Nieobowiązkowe. Produkty z tych sklepów pokażemy wyżej, a przy dodawaniu produktu sklep podpowie się sam. Zmiany zapisują się od razu.</p>
        ${(() => { const my = A.myStores();
          // 3.0.5: sieci działające w Polsce (lista sprawdzona ręcznie) i Twoje dopisane sklepy. Surowe nazwy z bazy bywają zagraniczne albo z literówkami, więc ich nie podpowiadamy.
          const keys = [...new Set(STORES.map(x => x.key).concat(my))];
          return `<div class="rows" id="storeRows">${keys.map(k => ckRow('mystore', k, A.storeLabel(k), my.includes(k))).join('')}</div>
          <h3 class="pf-sh">Nie ma Twojego sklepu?</h3>
          <div class="inline-form"><input class="field" id="storeAddInput" maxlength="40" autocomplete="off" placeholder="np. Społem, Topaz, sklep osiedlowy" aria-label="Nazwa sklepu"><button class="btn btn-dark btn-sm" type="button" data-act="store-add">Dodaj</button></div>
          
          <p class="msg" id="storeAddMsg" role="status"></p>
          <p class="msg" id="storeLimitMsg" role="status"></p><p class="small muted">Możesz wybrać do 8 sklepów. Własny sklep działa od razu w Twoim telefonie. Do bazy Open Food Facts trafi przy produkcie dopiero wtedy, gdy wskażą go co najmniej 3 osoby.</p>`; })()}
        <button class="btn btn-dark btn-block" type="submit">Gotowe</button>
      </div>
      <div class="pf-set"${sec('ustawienia')}>
        <p class="small muted">Zmiany zapisują się od razu.</p>
        <h3 class="pf-sh">Kraj zakupów</h3><div class="rows"><div class="tg-row" id="countryRow"><span class="grow"><b>Polska</b><small>Od kraju zależą produkty w bazie i lista sklepów. Na razie Lupka działa tylko w Polsce, kolejne kraje dodamy razem z wersjami językowymi.</small></span></div></div>
        <h3 class="pf-sh">Podczas zakupów</h3><div class="rows">
          ${tgRow('setShop', 'Ukryj punkty i nagrody', 'Karty i odznaki nadal zbierają się w Kartach.', A.quiet())}
          ${tgRow('setGuess', 'Zgadywanie przed wynikiem', 'Pytaj „dobre czy nie?” przed pokazaniem oceny.', A.settings.guess !== false)}
          ${tgRow('setSound', 'Dźwięki i wibracje', 'Sygnał po skanie i dodaniu do listy.', A.settings.sound !== false)}</div>
        <h3 class="pf-sh">Sposób oceniania</h3><div class="rows">${tgRow('profNoScores', 'Tryb bez ocen', 'Pokazuj fakty bez punktów i werdyktów.', !!p.noScores)}</div>
        ${A.statsAvailable() ? `<h3 class="pf-sh">Prywatność</h3><div class="rows">${tgRow('setStats', 'Anonimowe statystyki', 'Pomagają sprawdzić, które funkcje są używane. Bez ciasteczek i kodów produktów.', A.settings.stats !== false)}</div>` : ''}
        ${confirmWipe ? `<div class="ls-note"><b class="small">Usunąć wszystkie dane z tego telefonu (profil, domownicy, listy zakupów, karty, punkty, historię) i Twoje dane z serwera odkrywców (głosy, statystyki; dodane produkty zostaną bez pseudonimu)? Tego nie da się cofnąć.</b><div class="actions"><button class="btn btn-red btn-sm" type="button" data-act="wipe-yes">Usuń wszystko</button><button class="btn btn-white btn-sm" type="button" data-act="wipe-no">Zostaw</button></div></div>` : '<button class="linkbtn small red-link" type="button" data-act="wipe" style="align-self:flex-start">Usuń dane z urządzenia</button>'}
      </div>` : ''}
    </form>
    ${me ? `<div class="pf-info stack"${sec('informacje')}>
      <div class="rows"><button class="nav-row" type="button" data-act="how"><span class="grow"><b>Jak oceniamy</b><small>Skąd bierze się wynik i procent dopasowania</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
        <a class="nav-row" href="../privacy.html?z=app"><span class="grow"><b>Polityka prywatności</b><small>Co zostaje w telefonie, a co trafia do bazy</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></a>
        ${A.CFG.contactEmail ? `<a class="nav-row" id="feedbackBtn" href="${A.feedbackHref()}"><span class="grow"><b>Wyślij uwagi o aplikacji</b><small>Przeczytamy każdą</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></a><a class="nav-row" href="mailto:${esc(A.CFG.contactEmail)}"><span class="grow"><b>Kontakt</b><small>${esc(A.CFG.contactEmail)}</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></a>` : ''}</div>
      <p class="small muted">Dane produktów: Open Food Facts i Open Beauty Facts (licencja ODbL). Wersja aplikacji ${esc(A.CFG.appVersion || '1.0')}.</p><p class="small muted" id="dataDate"></p>
    </div>` : ''}</div>`;
    renderCustomChips();
    const sr = A.$('storeRows');
    if (sr) sr.addEventListener('change', e => {
      if (e.target.name !== 'mystore') return;
      const n = sr.querySelectorAll('input[name="mystore"]:checked').length, m = A.$('storeLimitMsg');
      if (n > 8) { e.target.checked = false; e.stopImmediatePropagation(); if (m) m.textContent = 'Możesz wybrać najwyżej 8 sklepów. Odznacz któryś, żeby dodać nowy.'; }
      else if (m) m.textContent = '';
    }, true);
    A.$('watchSet').addEventListener('change', e => {
      if (e.target.name !== 'watch') return;
      const n = A.$('watchSet').querySelectorAll('input[name="watch"]:checked').length;
      if (n > WATCH_MAX) { e.target.checked = false; A.$('watchMsg').textContent = `Możesz pilnować najwyżej ${WATCH_MAX} rzeczy. Odznacz którąś, żeby dodać nową.`; }
      else A.$('watchMsg').textContent = '';
    }, true);
    if (me && sub === 'informacje') A.snapshotMeta().then(m => { const el = A.$('dataDate'); if (m && el) el.textContent = `Kopia bazy produktów: ${m.products.toLocaleString('pl-PL')} produktów, aktualizacja ${new Date(m.built).toLocaleDateString('pl-PL')}.`; });
  }
  function renderCustomChips() {
    const el = A.$('customChips'); if (!el) return;
    el.innerHTML = draftCustom.length ? draftCustom.map((c, i) => `<span class="pchip" style="cursor:default">${esc(c)}<button type="button" class="x" data-act="rm-custom" data-i="${i}" aria-label="Usuń ${esc(c)}">×</button></span>`).join('') : '<span class="small muted">Nie dodałeś jeszcze własnych składników.</span>';
  }
  A.profAction = (act, el) => {
    if (act === 'prof-goal') {
      const root = A.$('scr-profile');
      const on = [...root.querySelectorAll('[data-act=prof-goal][aria-pressed=true]')];
      const goals = on.map(b => b.dataset.k), watchNow = [...root.querySelectorAll('input[name="watch"]:checked')].map(i => i.value);
      let turnOn = null;
      if (el.getAttribute('aria-pressed') === 'true') { el.setAttribute('aria-pressed', 'false'); A.$('goalMsg').textContent = ''; turnOn = false; }
      else if (on.length >= GOALS_MAX) A.$('goalMsg').textContent = `Wybierz najwyżej ${GOALS_MAX} cele. Odznacz któryś, żeby dodać nowy.`;
      else { el.setAttribute('aria-pressed', 'true'); A.$('goalMsg').textContent = ''; turnOn = true; }
      if (turnOn !== null) {
        const next = A.toggleGoalWatch(watchNow, turnOn ? goals : goals.filter(k => k !== el.dataset.k), el.dataset.k, turnOn);
        root.querySelectorAll('input[name="watch"]').forEach(i => { i.checked = next.includes(i.value); });
        A.$('watchMsg').textContent = '';
      }
      A.profAutoSave();
    } else if (act === 'add-custom') {
      const inp = A.$('customInput'), problem = customProblem(inp.value, draftCustom);
      if (problem) { A.$('customMsg').textContent = problem; inp.focus(); return; }
      draftCustom.push(cleanCustom(inp.value)); inp.value = ''; A.$('customMsg').textContent = ''; renderCustomChips(); inp.focus();
      A.profAutoSave();
    } else if (act === 'store-add') {
      const inp = A.$('storeAddInput'), msg = A.$('storeAddMsg'), v = inp.value.trim();
      if (v.length < 2) { msg.textContent = 'Wpisz nazwę sklepu.'; inp.focus(); return; }
      const my = [...A.$('profileForm').querySelectorAll('input[name="mystore"]:checked')].map(i => i.value);
      const key = A.addCustomStore(v);
      if (!key) { msg.textContent = 'Ta nazwa nie wygląda na sklep. Wpisz samą nazwę, bez adresu strony.'; inp.focus(); return; }
      if (!my.includes(key) && my.length >= 8) { msg.textContent = 'Masz już 8 sklepów. Odznacz któryś, żeby dodać nowy.'; return; }
      A.setMyStores(my.includes(key) ? my : my.concat(key));
      renderProfile(); const f = A.$('storeAddInput'); if (f) f.focus();
      A.$('storeAddMsg').textContent = `Dodano: ${A.storeLabel(key)}.`;
    } else if (act === 'rm-custom') { draftCustom.splice(Number(el.dataset.i), 1); renderCustomChips(); A.$('customInput').focus(); A.profAutoSave(); }
    else if (act === 'wipe') { confirmWipe = true; saveDraftToDom(); renderProfile(); const b = A.$('scr-profile').querySelector('[data-act=wipe-no]'); if (b) b.focus(); }
    else if (act === 'wipe-no') { confirmWipe = false; renderProfile(); }
    else if (act === 'fam-pick' || act === 'fam-add') {
      if (A.$('profileForm')) collect(false);
      if (act === 'fam-add') { const f = A.familyAdd(); if (!f) return; editing = f.id; } else editing = el.dataset.id;
      draftCustom = (person() ? person().p : A.profile).custom.slice(); confirmDel = false;
      if (act === 'fam-add' && sub !== 'osoby') { location.hash = '#/profil/osoby'; setTimeout(() => { const t = A.$('profName'); if (t) { t.focus(); t.select(); } }, 60); return; }
      renderProfile();
      const t = A.$('scr-profile').querySelector(act === 'fam-add' ? '#profName' : `.${sub === 'osoby' ? 'pf-osoby' : 'pf-index'} .fam-tab.on`); if (t) { t.focus(); if (act === 'fam-add') t.select(); }
    }
    else if (act === 'fam-del') { confirmDel = true; renderProfile(); }
    else if (act === 'fam-del-no') { confirmDel = false; renderProfile(); }
    else if (act === 'fam-del-yes') { A.familyRemove(editing); editing = 'me'; confirmDel = false; draftCustom = A.profile.custom.slice(); renderProfile(); A.toast('Usunięto profil domownika.'); }
    else if (act === 'wipe-yes') {
      if (el) { el.disabled = true; el.textContent = 'Usuwam…'; }
      Promise.resolve(A.discForget ? A.discForget().catch(() => null) : null).then(() => wipeLocal());
    }
  };
  function wipeLocal() {
    {
      try { Object.keys(localStorage).filter(k => k.startsWith('dcn-')).forEach(k => localStorage.removeItem(k)); } catch (e) { }
      try { indexedDB.deleteDatabase('dcn'); } catch (e) { }
      location.hash = '#/start'; location.reload();
    }
  }
  function saveDraftToDom() { /* zmiany zapisują się od razu, więc nie ma czego przenosić */ }
  // Zapis przy każdej zmianie: nie trzeba pamiętać o przycisku na dole strony.
  function collect(includePending) {
    const f = A.$('profileForm'), next = { noScores: A.$('profNoScores') ? A.$('profNoScores').checked : false };
    ['allergens', 'diet', 'avoid', 'cosmetic', 'watch'].forEach(g => { next[g] = [...f.querySelectorAll(`input[name="${g}"]:checked`)].map(i => i.value); });
    next.goals = [...f.querySelectorAll('[data-act=prof-goal][aria-pressed=true]')].map(b => b.dataset.k);
    next.custom = draftCustom.slice();
    const pending = A.$('customInput') ? A.$('customInput').value.trim() : '';
    if (includePending && pending && !customProblem(pending, next.custom)) { next.custom.push(cleanCustom(pending)); draftCustom = next.custom.slice(); }
    const fp = person();
    if (fp) {
      fp.p = cleanProfile(next); fp.name = A.$('profName').value.replace(/[<>]/g, '').trim().slice(0, 30) || fp.name;
      A.saveFamily();
      if (A.rerenderProduct) A.rerenderProduct();
      return;
    }
    A.profile = cleanProfile(next); A.saveProfile();
    A.setMyStores([...f.querySelectorAll('input[name="mystore"]:checked')].map(i => i.value));
    if (!A.$('setGuess')) return;
    A.settings.guess = A.$('setGuess').checked;
    A.settings.shopMode = A.$('setShop').checked; document.body.classList.toggle('shop-mode', A.settings.shopMode);
    const soundWas = A.settings.sound !== false;
    A.settings.sound = A.$('setSound').checked;
    if (!soundWas && A.settings.sound) A.sound('badge');
    if (A.$('setStats')) A.settings.stats = A.$('setStats').checked;
    A.saveSettings();
    A.store.set('name', A.$('profName').value.replace(/[<>]/g, '').trim().slice(0, 30));
    document.body.classList.toggle('no-scores', A.profile.noScores);
    if (A.rerenderProduct) A.rerenderProduct();
  }
  let stateTimer;
  A.profAutoSave = () => {
    if (!A.$('profileForm')) return;
    collect(false);
    const el = A.$('saveState'); if (!el) return;
    el.textContent = '✓ Zapisano'; el.classList.add('on');
    clearTimeout(stateTimer); stateTimer = setTimeout(() => el.classList.remove('on'), 1800);
  };
  A.saveProfileForm = e => {
    e.preventDefault();
    collect(true);
    A.go('#/profil'); // zmiany zapisały się już przy zaznaczaniu; „Gotowe” tylko wraca do spisu
  };
})();
