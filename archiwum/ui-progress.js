/* Dobre czy nie? 1.0 – postępy i odznaki oraz profil i ustawienia. */
'use strict';
(() => {
  const A = App, esc = A.esc;

  /* ---------- Twoje postępy ---------- */
  let cat = 'all', sel = null;
  const EARN = [
    ['magnifier', 'odkrywanie', 'Sprawdź produkt', 'do 20 pkt dziennie', 'product_checked'],
    ['target', 'odkrywanie', 'Zgadnij: dobre czy nie', 'pudło też uczy: +3 pkt', 'guess_right'],
    ['swap', 'wybory', 'Zamień na lepsze', 'zamiennik trafia na półkę', 'swap_to_better'],
    ['cart', 'wybory', 'Odhacz całą listę w sklepie', 'raz dziennie na półkę', 'list_completed'],
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
    const earned = prog.filter(p => p.done).length;
    if (!sel || !achs.some(a => a.id === sel)) sel = (prog.find(p => !p.done) || prog[0] || {}).a ? (prog.find(p => !p.done) || prog[0]).a.id : null;
    const s = prog.find(p => p.a.id === sel);
    const usedCats = [...new Set(achs.map(a => a.category))];
    const dots = levels.map((l, i) => `${i ? `<span class="lvline${l.level <= lv.level ? ' done' : ''}"></span>` : ''}<span class="lvdot ${l.level < lv.level ? 'done' : l.level === lv.level ? 'cur' : 'next'}" title="${esc(l.name)}">${l.level}</span>`).join('');
    const rulesEv = (cfg.rules && cfg.rules.events) || {};
    const ch = Game.challengeProgress(g, cfg, now);
    const inv = Object.entries(g.inventory || {}).filter(([, n]) => n > 0);
    A.$('scr-progress').innerHTML = `<div class="wrap">
      <div class="topbar"><h1>Twoje postępy</h1>${A.hudPill()}</div>
      <div class="panel stack">
        <div class="row">${A.mascot('detective', 80)}<div class="grow stack" style="gap:5px"><span class="reward-chip green" style="align-self:flex-start">POZIOM ${lv.level}</span><b style="font-family:var(--f-display);font-size:1.35rem;line-height:1.05">${esc(lv.name)}</b>
          <span class="xp"><i style="width:${pct}%"></i><span>${g.points}${nextPts ? ' / ' + nextPts : ''} pkt</span></span></div></div>
        ${levels.length ? `<div class="lvdots" aria-label="Poziomy">${dots}</div>` : ''}
        <p class="small muted">${lv.next ? `Następny: <b style="color:var(--ink)">${esc(lv.next.name)}</b> za ${nextPts - g.points} pkt.${lv.next.reward ? ' Nagroda: ' + esc(lv.next.reward) + '.' : ''}` : 'Masz najwyższy poziom. Brawo!'}</p>
        <p class="small muted">Masz też <b style="color:var(--ink)">${g.drops} ${plural(g.drops, 'kroplę', 'krople', 'kropli')}</b>. Przydadzą się w ogródku Ziarenka, który pojawi się w kolejnej wersji.</p>
      </div>
      <div class="stats">
        <div class="card stat">${medalSvg('magnifier', 'odkrywanie', true, 40)}<div><b>${(g.sets.product_checked || []).length}</b><span>${plural((g.sets.product_checked || []).length, 'sprawdzony produkt', 'sprawdzone produkty', 'sprawdzonych produktów')}</span></div></div>
        <div class="card stat">${medalSvg('target', 'odkrywanie', true, 40)}<div><b>${g.counters.guess_right || 0}</b><span>${plural(g.counters.guess_right || 0, 'trafny typ', 'trafne typy', 'trafnych typów')}</span></div></div>
        <div class="card stat">${medalSvg('swap', 'wybory', true, 40)}<div><b>${g.counters.swap_to_better || 0}</b><span>${plural(g.counters.swap_to_better || 0, 'zamiana na lepsze', 'zamiany na lepsze', 'zamian na lepsze')}</span></div></div>
        <div class="card stat">${medalSvg('shield', 'baza', true, 40)}<div><b>${(g.counters.product_added || 0) + (g.counters.report_sent || 0)}</b><span>${plural((g.counters.product_added || 0) + (g.counters.report_sent || 0), 'pomoc dla bazy', 'pomoce dla bazy', 'pomocy dla bazy')}</span></div></div>
      </div>
      ${ch ? `<div class="card stack"><div class="sec-head"><h2 style="font-size:1.1rem">Wyzwanie tygodnia</h2><span class="small muted">${ch.done ? 'ukończone' : 'zostało ' + ch.daysLeft + ' ' + plural(ch.daysLeft, 'dzień', 'dni', 'dni')}</span></div><b>${esc(ch.title)}</b><span class="xp green"><i style="width:${Math.round(ch.have / ch.target * 100)}%"></i><span>${ch.have} z ${ch.target}</span></span></div>` : ''}
      ${ribbonSvg(esc(`Odznaki ${earned} z ${achs.length}`), 250, ['#7EE08A', '#2E9A3E', '#1E6B2A'])}
      <div class="chips" style="justify-content:center" role="group" aria-label="Kategorie odznak">${[['all', 'Wszystkie']].concat(usedCats.map(c => [c, (cats[c] || {}).label || c])).map(([k, l]) => `<button class="cat-tab" type="button" data-act="ach-cat" data-cat="${esc(k)}" aria-pressed="${k === cat}">${esc(l)}</button>`).join('')}</div>
      ${s ? `<div class="panel row" id="achDetail" aria-live="polite"><span style="flex:0 0 auto">${medalSvg(s.a.icon, s.a.category, s.done, 88, s.done ? 3 : 0)}</span><div class="grow stack" style="gap:4px"><b style="font-family:var(--f-display);font-size:1.2rem">${esc(s.a.name)}</b><span class="small">${esc(s.a.description)}</span><span class="small" style="font-weight:800;color:var(--green-d)">${s.done ? 'Zdobyta!' : 'Postęp: ' + s.have + ' z ' + s.target}</span>${s.a.reward ? `<div class="chips">${A.rewardChips(s.a.reward)}</div>` : ''}</div></div>` : ''}
      <div class="panel medals" id="medals">${prog.filter(p => cat === 'all' || p.a.category === cat).map(p => `<button class="medal-btn${p.done ? '' : ' locked'}" type="button" data-act="ach-pick" data-id="${esc(p.a.id)}" aria-pressed="${p.a.id === sel}" aria-label="${esc(p.a.name)}${p.done ? ', zdobyta' : ', ' + p.have + ' z ' + p.target}">${medalSvg(p.a.icon, p.a.category, p.done, 66)}<b>${esc(p.a.name)}</b>${!p.done && p.target > 1 ? `<span class="mini-xp"><i style="width:${Math.round(p.have / p.target * 100)}%"></i></span><span class="small muted" style="font-size:12px;font-weight:700">${p.have} z ${p.target}</span>` : ''}</button>`).join('')}</div>
      ${inv.length ? `<div class="card stack"><h2 style="font-size:1.1rem">Twoje nagrody</h2><div class="chips">${inv.map(([k, n]) => `<span class="reward-chip red">${esc(A.ITEM_NAMES[k] || k)}${n > 1 ? ' ×' + n : ''}</span>`).join('')}</div><p class="small muted">Nasiona i ozdoby czekają na ogródek Ziarenka w kolejnej wersji.</p></div>` : ''}
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
  let draftCustom = [], confirmWipe = false;
  A.route('profile', () => { draftCustom = A.profile.custom.slice(); confirmWipe = false; renderProfile(); });
  function renderProfile() {
    const p = A.profile;
    const groups = [['allergens', 'Alergeny'], ['diet', 'Dieta'], ['avoid', 'Unikam w jedzeniu'], ['cosmetic', 'Unikam w kosmetykach']];
    A.$('scr-profile').innerHTML = `<div class="wrap"><form class="stack" id="profileForm" novalidate style="gap:16px">
      <div class="topbar"><h1>Twój profil</h1>${A.hudPill()}</div>
      <div class="row">${A.mascot('smile', 60)}<p class="bubble small">Sprawdzam to przy każdym produkcie. Zmiany zapisuję od razu, a profil zostaje tylko w tym telefonie.</p></div>
      <p class="save-state small" id="saveState" role="status" aria-live="polite"></p>
      <div class="card stack"><label for="profName"><b style="font-family:var(--f-display)">Imię</b> <span class="small muted">(nieobowiązkowe)</span></label><input class="field" id="profName" maxlength="30" autocomplete="given-name" value="${esc(A.userName())}"></div>
      <fieldset class="card"><legend>Twoje cele <span class="small muted" style="font-family:var(--f-body)">(do ${GOALS_MAX})</span></legend>
        <div class="goal-grid">${GOALS.map(g => { const t = GOAL_TILES[g.key]; return `<button class="goal-tile" type="button" data-act="prof-goal" data-k="${g.key}" aria-pressed="${p.goals.includes(g.key)}" style="background:radial-gradient(circle at 30% 25%,#fff 0%,${t.bg} 65%)"><span class="tick" aria-hidden="true"><svg width="14" height="14"><use href="#i-check"/></svg></span>${art(t.icon, 38)}<b>${esc(t.label)}</b><span>${esc(t.hint)}</span></button>`; }).join('')}</div>
        <p class="msg" id="goalMsg" role="status"></p></fieldset>
      ${groups.map(([g, title]) => `<fieldset class="card"><legend>${title}</legend><div class="pchips">${PROFILE_OPTIONS[g].map(o => `<label class="pchip"><input type="checkbox" name="${g}" value="${o.key}"${p[g].includes(o.key) ? ' checked' : ''}>${esc(o.label)}${o.approx ? ' *' : ''}</label>`).join('')}</div>${g === 'diet' ? '<p class="small muted">* Orientacyjnie, na podstawie etykiety. Nie zastępuje zaleceń lekarza ani dietetyka.</p>' : ''}</fieldset>`).join('')}
      <fieldset class="card"><legend>Własne składniki do unikania</legend>
        <div class="inline-form"><input id="customInput" class="field" maxlength="40" placeholder="np. sól, czosnek, kakao" autocomplete="off" aria-label="Nazwa składnika"><button class="btn btn-green btn-sm" type="button" data-act="add-custom">Dodaj</button></div>
        <p class="msg" id="customMsg" role="status"></p><div class="pchips" id="customChips"></div>
        <p class="small muted">Szukamy też odmian (np. „soli”, „czosnku”) i pomijamy frazy w rodzaju „bez dodatku soli”.</p></fieldset>
      <fieldset class="card"><legend>Ustawienia</legend>
        <label class="row" style="align-items:flex-start;min-height:44px"><input type="checkbox" id="setGuess" style="width:22px;height:22px;accent-color:var(--green);flex:0 0 auto;margin-top:2px"${A.settings.guess !== false ? ' checked' : ''}><span><b>Pytaj „Zgadnij: dobre czy nie?”</b><br><span class="small muted">Gra przy każdym nowym produkcie. Wyłącz, jeśli wolisz od razu widzieć wynik.</span></span></label>
        <label class="row" style="align-items:flex-start;min-height:44px"><input type="checkbox" id="profNoScores" style="width:22px;height:22px;accent-color:var(--green);flex:0 0 auto;margin-top:2px"${p.noScores ? ' checked' : ''}><span><b>Tryb bez ocen</b><br><span class="small muted">Ukrywa liczby i werdykty. Zostają fakty: skład, alergeny i dopasowanie do profilu.</span></span></label>
        ${A.statsAvailable() ? `<label class="row" style="align-items:flex-start;min-height:44px"><input type="checkbox" id="setStats" style="width:22px;height:22px;accent-color:var(--green);flex:0 0 auto;margin-top:2px"${A.settings.stats !== false ? ' checked' : ''}><span><b>Anonimowe statystyki</b><br><span class="small muted">Liczymy tylko, które funkcje są używane i ile osób wraca. Bez ciasteczek, profilu i kodów produktów.</span></span></label>` : ''}</fieldset>
      <p class="small muted">Przy alergii aplikacja jest pomocą, a nie gwarancją. Dane pochodzą z bazy tworzonej przez społeczność, więc zawsze sprawdź etykietę.</p>
      <button class="btn btn-green btn-block" type="submit">Gotowe</button>
    </form>
    <div class="card stack"><h2 style="font-size:1.1rem">Informacje</h2>
      ${A.CFG.contactEmail ? `<a class="btn btn-green btn-sm" id="feedbackBtn" href="${A.feedbackHref()}" style="align-self:flex-start">Wyślij uwagi o aplikacji</a>` : ''}
      <div class="actions"><button class="btn btn-white btn-sm" type="button" data-act="how">Jak oceniamy</button><a class="btn btn-white btn-sm" href="../privacy.html">Polityka prywatności</a>${A.CFG.contactEmail ? `<a class="btn btn-white btn-sm" href="mailto:${esc(A.CFG.contactEmail)}">Kontakt</a>` : ''}</div>
      <p class="small muted">Dane produktów: Open Food Facts i Open Beauty Facts (licencja ODbL). Wersja aplikacji ${esc(A.CFG.appVersion || '1.0')}.</p><p class="small muted" id="dataDate"></p>
      ${confirmWipe ? `<div class="stack"><b class="small">Usunąć wszystkie dane z tego telefonu (profil, półki, punkty, historię)? Tego nie da się cofnąć.</b><div class="actions"><button class="btn btn-red btn-sm" type="button" data-act="wipe-yes">Usuń wszystko</button><button class="btn btn-white btn-sm" type="button" data-act="wipe-no">Zostaw</button></div></div>` : '<button class="linkbtn small" type="button" data-act="wipe" style="align-self:flex-start">Usuń wszystkie moje dane</button>'}
    </div></div>`;
    renderCustomChips();
    A.snapshotMeta().then(m => { const el = A.$('dataDate'); if (m && el) el.textContent = `Kopia bazy produktów: ${m.products.toLocaleString('pl-PL')} produktów, aktualizacja ${new Date(m.built).toLocaleDateString('pl-PL')}.`; });
  }
  function renderCustomChips() {
    const el = A.$('customChips'); if (!el) return;
    el.innerHTML = draftCustom.length ? draftCustom.map((c, i) => `<span class="pchip" style="cursor:default">${esc(c)}<button type="button" class="x" data-act="rm-custom" data-i="${i}" aria-label="Usuń ${esc(c)}">×</button></span>`).join('') : '<span class="small muted">Nie dodałeś jeszcze własnych składników.</span>';
  }
  A.profAction = (act, el) => {
    if (act === 'prof-goal') {
      const on = [...A.$('scr-profile').querySelectorAll('[data-act=prof-goal][aria-pressed=true]')];
      if (el.getAttribute('aria-pressed') === 'true') { el.setAttribute('aria-pressed', 'false'); A.$('goalMsg').textContent = ''; }
      else if (on.length >= GOALS_MAX) A.$('goalMsg').textContent = `Wybierz najwyżej ${GOALS_MAX} cele. Odznacz któryś, żeby dodać nowy.`;
      else { el.setAttribute('aria-pressed', 'true'); A.$('goalMsg').textContent = ''; }
      A.profAutoSave();
    } else if (act === 'add-custom') {
      const inp = A.$('customInput'), problem = customProblem(inp.value, draftCustom);
      if (problem) { A.$('customMsg').textContent = problem; inp.focus(); return; }
      draftCustom.push(cleanCustom(inp.value)); inp.value = ''; A.$('customMsg').textContent = ''; renderCustomChips(); inp.focus();
      A.profAutoSave();
    } else if (act === 'rm-custom') { draftCustom.splice(Number(el.dataset.i), 1); renderCustomChips(); A.$('customInput').focus(); A.profAutoSave(); }
    else if (act === 'wipe') { confirmWipe = true; saveDraftToDom(); renderProfile(); const b = A.$('scr-profile').querySelector('[data-act=wipe-no]'); if (b) b.focus(); }
    else if (act === 'wipe-no') { confirmWipe = false; renderProfile(); }
    else if (act === 'wipe-yes') {
      try { Object.keys(localStorage).filter(k => k.startsWith('dcn-')).forEach(k => localStorage.removeItem(k)); } catch (e) { }
      try { indexedDB.deleteDatabase('dcn'); } catch (e) { }
      location.hash = '#/start'; location.reload();
    }
  };
  function saveDraftToDom() { /* zmiany zapisują się od razu, więc nie ma czego przenosić */ }
  // Zapis przy każdej zmianie: nie trzeba pamiętać o przycisku na dole strony.
  function collect(includePending) {
    const f = A.$('profileForm'), next = { noScores: A.$('profNoScores').checked };
    ['allergens', 'diet', 'avoid', 'cosmetic'].forEach(g => { next[g] = [...f.querySelectorAll(`input[name="${g}"]:checked`)].map(i => i.value); });
    next.goals = [...f.querySelectorAll('[data-act=prof-goal][aria-pressed=true]')].map(b => b.dataset.k);
    next.custom = draftCustom.slice();
    const pending = A.$('customInput').value.trim();
    if (includePending && pending && !customProblem(pending, next.custom)) { next.custom.push(cleanCustom(pending)); draftCustom = next.custom.slice(); }
    A.profile = cleanProfile(next); A.saveProfile();
    A.settings.guess = A.$('setGuess').checked;
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
    A.toast('Profil zapisany. Sprawdzamy go przy każdym produkcie.');
    A.go('#/');
  };
})();
