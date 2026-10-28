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
      <div class="d-head"><h1 class="al-h"><span class="w-light">Twoja</span> <span class="w-bold">kolekcja</span></h1>${A.hudPill()}</div>
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
  A.route('profile', () => { if (!person()) editing = 'me'; draftCustom = (person() ? person().p : A.profile).custom.slice(); confirmWipe = false; confirmDel = false; renderProfile(); });
  function familyTabs() {
    const tabs = [{ id: 'me', name: A.userName() || 'Ja' }].concat(A.family);
    return `<div class="card stack fam-tabs-card"><b style="font-family:var(--f-display)">Kupujesz też dla innych?</b>
      <div class="fam-tabs" role="tablist">${tabs.map(t => `<button type="button" role="tab" class="fam-tab${t.id === editing ? ' on' : ''}" aria-selected="${t.id === editing}" data-act="fam-pick" data-id="${esc(t.id)}">${esc(t.name)}</button>`).join('')}
        ${A.family.length < A.FAMILY_MAX ? '<button type="button" class="fam-tab add" data-act="fam-add">+ Dodaj osobę</button>' : ''}</div>
      <span class="small muted">${A.family.length ? 'Przy każdym produkcie zobaczysz osobny werdykt dla każdej osoby. Album liczy się według Twojego profilu.' : 'Dodaj domowników (np. dziecko z alergią), a przy produkcie zobaczysz werdykt dla każdego.'}</span></div>`;
  }
  function renderProfile() {
    const fp = person(), p = fp ? fp.p : A.profile;
    const chip = (name, key, label, on, icon) => `<label class="pchip${icon ? ' d-pchip' : ''}"><input type="checkbox" name="${name}" value="${key}"${on ? ' checked' : ''}>${icon ? A.dIcon(icon, 18) : ''}${esc(label)}</label>`;
    A.$('scr-profile').innerHTML = `<div class="wrap"><form class="stack" id="profileForm" novalidate style="gap:16px">
      <div class="topbar"><h1>${fp ? 'Profil: ' + esc(fp.name) : 'Twój profil'}</h1>${A.hudPill()}</div>
      <p class="small muted">Sprawdzamy to przy każdym produkcie. Zmiany zapisują się od razu, a profil zostaje tylko w tym telefonie.</p>
      <p class="save-state small" id="saveState" role="status" aria-live="polite"></p>
      ${familyTabs()}
      <div class="card stack"><label for="profName"><b style="font-family:var(--f-display)">${fp ? 'Imię lub pseudonim' : 'Imię'}</b> <span class="small muted">${fp ? '' : '(nieobowiązkowe)'}</span></label><input class="field" id="profName" maxlength="30" autocomplete="${fp ? 'off' : 'given-name'}" value="${esc(fp ? fp.name : A.userName())}"></div>
      <fieldset class="card"><legend>Cele <span class="small muted" style="font-family:var(--f-body)">(do ${GOALS_MAX})</span></legend>
        <p class="small muted">Cel to skrót: zaznacza, czego pilnujemy na liście niżej.</p>
        <div class="goal-grid">${GOALS.map(g => A.goalTile(g, p.goals.includes(g.key), 'prof-goal')).join('')}</div>
        <p class="msg" id="goalMsg" role="status"></p></fieldset>
      <fieldset class="card" id="watchSet"><legend>Pilnuję <span class="small muted" style="font-family:var(--f-body)">(do ${WATCH_MAX})</span></legend>
        <div class="pchips">${WATCH.map(w => chip('watch', w.key, w.label, p.watch.includes(w.key), w.icon)).join('')}</div>
        <p class="msg" id="watchMsg" role="status"></p>
        <div class="d-rules small"><b>Jak liczymy każdą pozycję</b>
          <span>Cukier, sól, tłuszcze, kalorie, przetworzenie: mało <b>+5</b>, średnio <b>−10</b>, dużo <b>−25</b> i najwyżej 45%.</span>
          <span>Olej palmowy, słodziki, kofeina: zawiera <b>−25</b> i najwyżej 45%.</span>
          <span>Białko, błonnik: dużo <b>+10</b>, źródło <b>+5</b>.</span>
          <span>Brak danych w bazie: najwyżej 70%.</span></div></fieldset>
      <fieldset class="card"><legend>Nie jem</legend>
        <p class="small muted">Produkt, który to zawiera, oznaczamy „Nie pasuje” (0–10%). Śladowe ilości: najwyżej 35%.</p>
        <b class="small">Alergeny</b><div class="pchips">${PROFILE_OPTIONS.allergens.map(o => chip('allergens', o.key, o.label, p.allergens.includes(o.key))).join('')}</div>
        <b class="small" style="margin-top:8px">Dieta</b><div class="pchips">${PROFILE_OPTIONS.diet.map(o => chip('diet', o.key, o.label, p.diet.includes(o.key))).join('')}${PROFILE_OPTIONS.avoid.map(o => chip('avoid', o.key, o.label, p.avoid.includes(o.key))).join('')}</div>
        <b class="small" style="margin-top:8px">Własne składniki</b>
        <div class="inline-form"><input id="customInput" class="field" maxlength="40" placeholder="np. czosnek, kakao" autocomplete="off" aria-label="Nazwa składnika"><button class="btn btn-green btn-sm" type="button" data-act="add-custom">Dodaj</button></div>
        <p class="msg" id="customMsg" role="status"></p><div class="pchips" id="customChips"></div>
        <p class="small muted">Szukamy też odmian (np. „czosnku”) i pomijamy frazy w rodzaju „bez dodatku”.</p></fieldset>
      ${fp ? `<div class="card stack">${confirmDel ? `<b class="small">Usunąć profil „${esc(fp.name)}”?</b><div class="actions"><button class="btn btn-red btn-sm" type="button" data-act="fam-del-yes">Usuń</button><button class="btn btn-white btn-sm" type="button" data-act="fam-del-no">Zostaw</button></div>` : '<button class="linkbtn small" type="button" data-act="fam-del" style="align-self:flex-start">Usuń tę osobę</button>'}</div>
      <button class="btn btn-green btn-block" type="submit">Gotowe</button></form></div>` : ''}${fp ? '' : `
      <fieldset class="card"><legend>Gdzie robisz zakupy</legend><p class="small muted">Nieobowiązkowe. Produkty z tych sklepów pokażemy wyżej, a przy dodawaniu produktu sklep podpowie się sam.</p><div class="pchips">${STORES.map(s => chip('mystore', s.key, s.label, A.myStores().includes(s.key))).join('')}</div></fieldset>
      <fieldset class="card"><legend>W kosmetykach unikam</legend><div class="pchips">${PROFILE_OPTIONS.cosmetic.map(o => chip('cosmetic', o.key, o.label, p.cosmetic.includes(o.key))).join('')}</div></fieldset>
      <fieldset class="card"><legend>Ustawienia</legend>
        <label class="row" style="align-items:flex-start;min-height:44px"><input type="checkbox" id="setShop" style="width:22px;height:22px;accent-color:var(--green);flex:0 0 auto;margin-top:2px"${A.quiet() ? ' checked' : ''}><span><b>Tryb zakupowy</b><br><span class="small muted">Sam wynik i powody, bez punktów, kart, odznak i „Zgadnij”. Karty i odznaki dalej zbierają się w tle, zobaczysz je w Kolekcji.</span></span></label>
        <label class="row" style="align-items:flex-start;min-height:44px"><input type="checkbox" id="setGuess" style="width:22px;height:22px;accent-color:var(--green);flex:0 0 auto;margin-top:2px"${A.settings.guess !== false ? ' checked' : ''}><span><b>Pytaj „Zgadnij: dobre czy nie?”</b><br><span class="small muted">Gra przy każdym nowym produkcie. Wyłącz, jeśli wolisz od razu widzieć wynik.</span></span></label>
        <label class="row" style="align-items:flex-start;min-height:44px"><input type="checkbox" id="setSound" style="width:22px;height:22px;accent-color:var(--green);flex:0 0 auto;margin-top:2px"${A.settings.sound !== false ? ' checked' : ''}><span><b>Dźwięki i wibracje</b><br><span class="small muted">Krótki dźwięk przy skanie, zgadywaniu i odkładaniu na półkę, melodia przy nowej odznace i poziomie.</span></span></label>
        <label class="row" style="align-items:flex-start;min-height:44px"><input type="checkbox" id="profNoScores" style="width:22px;height:22px;accent-color:var(--green);flex:0 0 auto;margin-top:2px"${p.noScores ? ' checked' : ''}><span><b>Tryb bez ocen</b><br><span class="small muted">Ukrywa liczby i werdykty. Zostają fakty: skład, alergeny i dopasowanie do profilu.</span></span></label>
        ${A.statsAvailable() ? `<label class="row" style="align-items:flex-start;min-height:44px"><input type="checkbox" id="setStats" style="width:22px;height:22px;accent-color:var(--green);flex:0 0 auto;margin-top:2px"${A.settings.stats !== false ? ' checked' : ''}><span><b>Anonimowe statystyki</b><br><span class="small muted">Liczymy tylko, które funkcje są używane i ile osób wraca. Bez ciasteczek, profilu i kodów produktów.</span></span></label>` : ''}</fieldset>
      <p class="small muted">Przy alergii aplikacja jest pomocą, a nie gwarancją. Dane pochodzą z bazy tworzonej przez społeczność, więc zawsze sprawdź etykietę.</p>
      <button class="btn btn-green btn-block" type="submit">Gotowe</button>
    </form>
    <div class="card stack"><h2 style="font-size:1.1rem">Informacje</h2>
      ${A.CFG.contactEmail ? `<a class="btn btn-green btn-sm" id="feedbackBtn" href="${A.feedbackHref()}" style="align-self:flex-start">Wyślij uwagi o aplikacji</a>` : ''}
      <div class="actions"><button class="btn btn-white btn-sm" type="button" data-act="how">Jak oceniamy</button><a class="btn btn-white btn-sm" href="../privacy.html?z=app">Polityka prywatności</a>${A.CFG.contactEmail ? `<a class="btn btn-white btn-sm" href="mailto:${esc(A.CFG.contactEmail)}">Kontakt</a>` : ''}</div>
      <p class="small muted">Dane produktów: Open Food Facts i Open Beauty Facts (licencja ODbL). Wersja aplikacji ${esc(A.CFG.appVersion || '1.0')}.</p><p class="small muted" id="dataDate"></p>
      ${confirmWipe ? `<div class="stack"><b class="small">Usunąć wszystkie dane z tego telefonu (profil, domownicy, półki, album, punkty, historię) i Twoje dane z serwera odkrywców (głosy, statystyki; dodane produkty zostaną bez pseudonimu)? Tego nie da się cofnąć.</b><div class="actions"><button class="btn btn-red btn-sm" type="button" data-act="wipe-yes">Usuń wszystko</button><button class="btn btn-white btn-sm" type="button" data-act="wipe-no">Zostaw</button></div></div>` : '<button class="linkbtn small" type="button" data-act="wipe" style="align-self:flex-start">Usuń wszystkie moje dane</button>'}
    </div></div>`}`;
    renderCustomChips();
    A.$('watchSet').addEventListener('change', e => {
      if (e.target.name !== 'watch') return;
      const n = A.$('watchSet').querySelectorAll('input[name="watch"]:checked').length;
      if (n > WATCH_MAX) { e.target.checked = false; A.$('watchMsg').textContent = `Możesz pilnować najwyżej ${WATCH_MAX} rzeczy. Odznacz którąś, żeby dodać nową.`; }
      else A.$('watchMsg').textContent = '';
    }, true);
    A.snapshotMeta().then(m => { const el = A.$('dataDate'); if (m && el) el.textContent = `Kopia bazy produktów: ${m.products.toLocaleString('pl-PL')} produktów, aktualizacja ${new Date(m.built).toLocaleDateString('pl-PL')}.`; });
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
    } else if (act === 'rm-custom') { draftCustom.splice(Number(el.dataset.i), 1); renderCustomChips(); A.$('customInput').focus(); A.profAutoSave(); }
    else if (act === 'wipe') { confirmWipe = true; saveDraftToDom(); renderProfile(); const b = A.$('scr-profile').querySelector('[data-act=wipe-no]'); if (b) b.focus(); }
    else if (act === 'wipe-no') { confirmWipe = false; renderProfile(); }
    else if (act === 'fam-pick' || act === 'fam-add') {
      if (A.$('profileForm')) collect(false);
      if (act === 'fam-add') { const f = A.familyAdd(); if (!f) return; editing = f.id; } else editing = el.dataset.id;
      draftCustom = (person() ? person().p : A.profile).custom.slice(); confirmDel = false; renderProfile();
      const t = A.$('scr-profile').querySelector(act === 'fam-add' ? '#profName' : '.fam-tab.on'); if (t) { t.focus(); if (act === 'fam-add') t.select(); }
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
    const pending = A.$('customInput').value.trim();
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
    A.toast(person() ? `Zapisano profil: ${person().name}.` : 'Profil zapisany. Sprawdzamy go przy każdym produkcie.');
    A.go('#/');
  };
})();
