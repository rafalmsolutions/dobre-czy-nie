/* Dobre czy nie? 1.0 – ekran produktu: „Zgadnij”, osobiste dopasowanie, szczegóły oceny, zamienniki,
   brak produktu (dodawanie do Open Food Facts z nagrodą odkrywcy), ocena składu z etykiety, zgłoszenia. */
'use strict';
(() => {
  const A = App, esc = A.esc;
  let cur = null;          // { prod, an, pm, local, guess }
  let pendingToken = null;

  A.route('product', code => {
    if (cur && cur.prod && cur.prod.code === code && cur.rendered && !cur.missing && !cur.local) return; // ponowne wejście bez zmian
    openProduct(code);
  });
  A.currentProduct = () => cur;

  function screen(html) { A.$('scr-product').innerHTML = `<div class="wrap">${html}</div>`; }
  const topbar = (title) => `<div class="topbar"><button class="btn btn-white iconbtn" type="button" data-act="back" aria-label="Wróć"><svg><use href="#i-back"/></svg></button><span class="grow small muted" style="font-weight:800">${esc(title)}</span>${A.hudPill()}</div>`;

  async function openProduct(code) {
    const token = {}; pendingToken = token; cur = null;
    screen(`${topbar('Szukam produktu…')}<div class="card stack" aria-busy="true"><p class="small muted">Kod <span class="mono">${esc(code)}</span></p><div class="row"><div class="sk" style="width:72px;height:72px"></div><div class="grow stack"><div class="sk" style="height:22px"></div><div class="sk" style="height:16px;width:60%"></div></div></div><div class="sk" style="height:140px"></div></div>`);
    const local = A.store.get('local', {})[code];
    // Równolegle: baza Open Food Facts na żywo (pełny skład) i nasza kopia (odpowiada od razu).
    // Gdy baza na żywo spóźnia się ponad 2,5 s, pokazujemy kopię i podmieniamy dane, kiedy baza odpowie.
    const snapP = A.snapshotProduct(code).catch(() => null);
    const liveP = A.lookup(code).then(p => ({ ok: true, p }), e => ({ ok: false, e }));
    const first = await Promise.race([liveP, new Promise(r => setTimeout(() => r(null), 2500))]);
    if (pendingToken !== token) return;
    if (!first) {
      const snap = await Promise.race([snapP, new Promise(r => setTimeout(() => r(null), 1500))]);
      if (pendingToken !== token) return;
      if (snap) {
        show(snap, { snapshot: true });
        const live = await liveP;
        if (pendingToken !== token || !cur || cur.prod.code !== code) return;
        if (live.ok && live.p) upgrade(live.p);
        return;
      }
    }
    const res = first || await liveP;
    if (pendingToken !== token) return;
    if (res.ok) {
      const prod = res.p;
      if (!prod) {
        const snap = await snapP;
        if (pendingToken !== token) return;
        if (snap) show(snap, { snapshot: true });
        else if (local) show(local, { local: true });
        else { A.track('skan-brak'); renderMissing(code, 'missing'); }
        return;
      }
      // Dane, które użytkownik właśnie uzupełnił, a baza jeszcze ich nie pokazuje.
      if (local && !prod.ingredients) prod.ingredients = local.ingredients;
      if (local && local.nutriments && !Object.values(prod.nutriments || {}).some(v => v != null)) prod.nutriments = Object.assign({}, local.nutriments);
      show(prod, {});
      return;
    }
    const kind = (res.e && res.e.kind) || 'network';
    const snap = await snapP;
    if (pendingToken !== token) return;
    const cached = A.store.get('cache', {})[code];
    if (cached && cached.p) { show(cached.p, { cached: true }); A.toast(kind === 'offline' ? 'Jesteś offline. Pokazuję zapisany wynik.' : 'Baza nie odpowiada. Pokazuję zapisany wynik.'); }
    else if (snap) show(snap, { snapshot: true });
    else if (local) show(local, { local: true });
    else { A.track('skan-blad-' + kind); renderMissing(code, kind); }
  }
  // Dane, które użytkownik sam uzupełnił, a baza (albo nasza cotygodniowa kopia) jeszcze ich nie ma.
  function mergeLocal(prod) {
    const local = A.store.get('local', {})[prod.code];
    if (!local) return prod;
    if (!prod.ingredients && local.ingredients) prod.ingredients = local.ingredients;
    if (local.nutriments && !Object.values(prod.nutriments || {}).some(v => v != null)) prod.nutriments = Object.assign({}, local.nutriments);
    return prod;
  }
  // Czego brakuje? Kopia bazy nie ma tekstu składu, ale wie, czy skład istnieje (lista dodatków nie jest wtedy pusta/null).
  function missingParts(prod, snapshot) {
    return { ingr: !prod.ingredients && !(snapshot && prod.additiveTags != null), nut: !Object.values(prod.nutriments || {}).some(v => v != null) };
  }
  // Pełne dane z bazy na żywo zastępują dane z kopii; stan gry („Zgadnij”) zostaje.
  function upgrade(prod) {
    mergeLocal(prod);
    A.albumAdd(prod, { touch: true }).catch(() => { }); // pełne dane z bazy: szkic z kopii może od razu ożyć (bez komunikatu)
    const guess = cur.guess, alts = cur.alts;
    const an = analyze(prod), pm = personalMatch(prod, an, A.profile);
    A.remember(prod, an, pm);
    cur = Object.assign(cur, { prod, an, pm, snapshot: false, alts });
    cur.guess = guess;
    if (guess !== null) render();
  }

  function guessedToday(code) {
    const d = A.game.days && A.game.days[Game.dayKey(new Date())];
    return !!(d && d.once && d.once['guess|' + code]);
  }
  function show(prod, opts) {
    if (!opts.local) mergeLocal(prod);
    const an = analyze(prod), pm = personalMatch(prod, an, A.profile);
    A.remember(prod, an, pm);
    cur = { prod, an, pm, local: !!opts.local, cached: !!opts.cached, snapshot: !!opts.snapshot, guess: null, rendered: true };
    if (!opts.local && !opts.cached) A.award('product_checked', { code: prod.code, category: prod.category });
    // Po 5 sprawdzonych produktach jeden raz pytamy o uwagi.
    if (A.CFG.contactEmail && !A.store.get('askedFeedback', false) && (A.game.sets.product_checked || []).length >= 5) {
      A.store.set('askedFeedback', true);
      setTimeout(() => A.toast('Sprawdziłeś już 5 produktów. Co działa, a co nie?', `<a href="${A.feedbackHref()}">Napisz nam</a>`), 1500);
    }
    const ask = A.settings.guess !== false && pm.pct != null && !guessedToday(prod.code) && !opts.local;
    if (!ask) cur.guess = 'skip-silent';
    render();
    if (A.discAsk && !opts.local) A.discAsk(prod);
    // Wersja D: karta do albumu. Nowa karta → nakładka z odsłonięciem; uzupełniony szkic → karta ożywa.
    if (!opts.local || prod.added) {
      A.albumAdd(prod, { snapshot: !!opts.snapshot }).then(res => {
        if (!res) return;
        const here = cur && cur.prod && cur.prod.code === prod.code;
        if (res.isNew && res.quiet) return;
        if (res.isNew) A.albumGot(res); // pasek „Nowa karta · Odbierz” pod wynikiem, bez zasłaniania ekranu
        else if (res.revived) { A.toast('Karta ożyła! Dane produktu są już pełne.'); A.sound('badge'); }
        else if (here && (res.noSlot || res.incompatible)) setTimeout(() => A.albumNote(res), 900);
      }).catch(() => { });
    }
  }

  /* ---------- Widok produktu ---------- */
  function prodCard(p, pm) {
    const img = A.safeImg(p.image), key = A.prodCatKey(p), dish = A.catImg(key);
    const catLabel = key ? ((SHOP_CATEGORIES.find(c => c.key === key) || {}).label || '') : '';
    const lvl = (pm && pm.pct != null && pm.level) || 'unknown';
    const nm = p.name || 'Produkt bez nazwy';
    // Zdjęcie produktu z bazy ma pierwszeństwo; miska kategorii jest wtedy małym znaczkiem w rogu z nazwą kategorii.
    const main = img ? `<button class="prod-img-btn d-plate" type="button" data-act="photo-open" aria-label="Powiększ zdjęcie produktu"><img class="prod-img" src="${esc(img)}" alt="Zdjęcie produktu"></button>`
      : dish ? `<span class="d-dishwrap"><img class="d-dish" src="${esc(dish)}" alt="" width="480" height="480"></span>`
      : `<span class="d-plate d-plate-art">${art(p.kind === 'cosmetic' ? 'dept_home' : 'dept_' + departmentFor(p), 80)}</span>`;
    const chip = catLabel ? `<a class="d-catchip" href="#/lista/${esc(key)}">${img && dish ? `<img src="${esc(dish)}" alt="" width="40" height="40">` : ''}<span>${esc(catLabel)}</span></a>` : '';
    // Domownicy: obok zdjęcia odpowiedź dla całej rodziny, pod spodem kółka osób (najpierw te z problemem).
    const fv = pm && cur.fam ? cur.fam : null;
    const verdict = fv ? A.familyAnswerHtml(fv) : pm ? `<div class="d-verdict">${pm.pct != null ? `<div class="d-badge" data-level="${esc(lvl)}" role="img" aria-label="${pm.personal ? 'Dopasowanie' : 'Ocena'} ${pm.pct} procent"><b>${pm.pct}${pm.personal ? '%' : ''}</b><span>${pm.personal ? 'dla Ciebie' : 'na 100'}</span></div>` : `<div class="d-badge" data-level="unknown"><b>?</b><span>brak danych</span></div>`}<div class="mlabel lvl-${esc(pm.level)}" id="matchLabel">${esc(pm.label)}</div></div>` : '';
    return `<div class="d-hero${fv ? ' has-fam' : ''}" data-level="${esc(fv ? fv.level : lvl)}"><span class="d-arc" aria-hidden="true"></span>
      <div class="d-hmain">${main}</div>
      <div class="d-hside">${chip}${verdict}</div>${fv ? A.familyCirclesHtml(fv) : ''}
      <div class="d-title"><p class="d-meta">${esc([p.brand, p.quantity, p.kind === 'cosmetic' ? 'kosmetyk' : ''].filter(Boolean).join(' · ') || 'Produkt')}</p><h1 class="${nm.length > 26 ? 'd-long' : ''}">${A.splitName(nm)}</h1></div></div>`;
  }
  /* Wersja D: wyjaśnienie dopasowania jak rachunek: ocena składu, potem każda pozycja „Pilnuję” z punktami, na końcu wynik. */
  function billHtml(pm, who) {
    const sign = d => d > 0 ? '+' + d : d < 0 ? '−' + Math.abs(d) : '0';
    const watch = pm.rows.filter(r => !r.exclude), excl = pm.rows.filter(r => r.exclude);
    const line = r => `<li class="bill-row ${r.kind}">${r.watch ? `<span class="bill-ic">${A.dIcon((WATCH.find(w => w.key === r.watch) || {}).icon, 18)}</span>` : `<span class="bill-ic">${A.dIcon(r.kind === 'good' ? 'healthy' : 'ban', 18)}</span>`}<span class="grow"><b>${esc(r.title)}</b>${r.word ? ` <span class="bill-word">${esc(r.word)}</span>` : ''}${r.value ? `<small>${esc(r.value)}${r.text ? ', ' + esc(r.text) : ''}</small>` : r.text ? `<small>${esc(r.text)}</small>` : ''}</span><span class="bill-pts">${r.delta == null ? (r.cap ? 'max ' + r.cap + '%' : '') : sign(r.delta)}</span></li>`;
    const fail = pm.status === 'fail';
    return `<ul class="bill" aria-label="Jak policzyliśmy dopasowanie">
      ${pm.base != null ? `<li class="bill-row base"><span class="bill-ic">${A.dIcon('healthy', 18)}</span><span class="grow"><b>Ocena składu</b><small>taka sama dla wszystkich</small></span><span class="bill-pts">${pm.base}</span></li>` : ''}
      ${watch.map(line).join('')}${excl.map(line).join('')}
      <li class="bill-sum"><span class="grow">${who ? 'Dla: ' + esc(who) : 'Dla Ciebie'}</span><b>${pm.pct == null ? '–' : pm.pct + '%'}</b></li></ul>
      ${fail ? '<p class="small bill-note">Zawiera coś, czego nie jesz, więc dopasowanie wynosi najwyżej 10%.</p>' : pm.capped && pm.capBy ? `<p class="small bill-note">Najwyżej ${pm.cap}% (${esc(pm.capBy)}).</p>` : pm.pct === 12 && pm.base != null && pm.base + pm.sum < 12 ? '<p class="small bill-note">Najmniej 12%: niżej są tylko produkty z czymś, czego nie jesz.</p>' : ''}
      <a class="small" href="#/profil">Zmień, czego pilnujesz</a>`;
  }
  function critRow(r) {
    const ic = { good: '✓', bad: '✕', warn: '!', info: 'i' }[r.kind] || 'i';
    const goalIcon = ''; // wersja D: bez kolorowych ikonek celów, sam znak ✓ ✕ ! i
    return `<div class="crit ${r.kind}">${goalIcon ? `<span style="width:30px;height:30px;flex:0 0 auto">${goalIcon}</span>` : `<span class="ci" aria-hidden="true">${ic}</span>`}<span class="grow"><b>${esc(r.title)}</b>${r.text ? `<small>${esc(r.text)}</small>` : ''}</span></div>`;
  }
  function render() {
    const { prod, an, pm } = cur;
    const added = cur.local && prod.added;
    cur.fam = cur.guess !== null && A.familyView ? A.familyView(prod, an, cur.famPick) : null;
    // Produkt jest na półce: odświeżamy tam dopasowanie i odpowiedź dla rodziny.
    if (cur.guess !== null && prod.code && Shelf.hasCode(A.shelves, prod.code)) {
      const up = Shelf.updateInfo(A.shelves, prod.code, { pct: pm.pct, fam: A.familyShort ? A.familyShort(prod, an, cur.fam) : null });
      if (up.changed) { A.shelves = up.state; A.saveShelves(); }
    }
    const parts = [topbar(added ? 'Produkt dodany przez Ciebie' : cur.local ? 'Skład wpisany przez Ciebie' : 'Zeskanowany produkt'), prodCard(prod, cur.guess === null ? null : pm)];
    if (added) parts.push(`<p class="small" id="addedNote" role="status" style="font-weight:700">Dodałeś ten produkt ${esc(agoText(prod.addedAt))}. Open Food Facts udostępni go wszystkim zwykle w ciągu kilku minut. Do tego czasu widzisz dane, które wpisałeś.</p>`);
    if (cur.snapshot) parts.push(`<p class="small muted" id="snapNote" role="status">Dane z naszej kopii bazy Open Food Facts. Pełny skład pobieramy w tle.</p>`);
    if (cur.guess === null) {
      parts.push(`<div class="panel stack center" id="guessBox" style="align-items:center">
        ${A.mascot('think', 84)}
        <h2 style="font-size:1.5rem">${pm.personal ? 'Zgadnij: dobre czy nie dla Ciebie?' : 'Zgadnij: dobre czy nie?'}</h2>
        <p class="small muted" style="max-width:290px">Za trafny typ dostajesz 10 pkt, a za pudło 3 pkt, bo też się czegoś uczysz.</p>
        <div class="guess-btns"><button class="btn btn-green" type="button" data-act="guess" data-v="good"><svg><use href="#i-check"/></svg>Dobre</button><button class="btn btn-red" type="button" data-act="guess" data-v="bad"><svg><use href="#i-x"/></svg>Raczej nie</button></div>
        <button class="linkbtn" type="button" data-act="guess" data-v="skip">Pokaż wynik bez zgadywania</button>
        <label class="row small" style="font-weight:700"><input type="checkbox" data-act="no-guess" style="width:20px;height:20px;accent-color:var(--green)"> Nie pytaj przy każdym skanie</label>
      </div>`);
      screen(parts.join(''));
      return;
    }
    if (cur.guess === 'right') parts.push(`<div class="banner right" role="status">${A.mascot('cheer', 48)}<div><b>Trafione! +10 pkt</b><span class="small">Twoja intuicja rośnie.</span></div></div>`);
    else if (cur.guess === 'wrong') parts.push(`<div class="banner wrong" role="status">${A.mascot('wink', 48)}<div><b>Tym razem pudło. +3 pkt</b><span class="small">${esc(wrongHint())}</span></div></div>`);
    const lvl = pm.level;
    const ringColor = { great: '#2E9A3E', good: '#7CBF3A', poor: '#F0B021', bad: '#D9412B' }[lvl] || '#C9CFD6';
    parts.push('<div class="d-side">');
    if (cur.fam && cur.fam.tone !== 'ok') parts.push(`<div id="famAlt">${cur.famAltHtml || ''}</div>`);
    const fp = cur.fam ? cur.fam.focus : null, other = fp && fp.id !== 'me';
    const bpm = other ? fp.pm : pm;
    parts.push(`<div class="panel stack${bpm.personal ? '' : ' general'}" id="matchBox">
      <span class="small muted" style="font-weight:800;letter-spacing:.06em">${other ? 'DLACZEGO DLA: ' + esc(fp.name.toUpperCase()) : bpm.personal ? 'DLACZEGO DLA CIEBIE' : 'OCENA OGÓLNA'}</span>
      ${other && !bpm.personal ? `<p class="small">${esc(fp.name)} nie ma jeszcze ustawień profilu, więc to ogólna ocena składu. <a href="#/profil">Ustaw</a></p>` : ''}
      ${bpm.personal ? billHtml(bpm, other ? fp.name : '') : `<p class="small">${esc(scoreNote(prod, an))}</p><p class="small muted" id="generalNote">${pm.general ? 'Twój cel to „po prostu zdrowiej”, więc liczy się ogólna ocena składu, taka sama dla wszystkich.' : 'Nie masz jeszcze celów ani ograniczeń, więc to ogólna ocena składu, taka sama dla wszystkich.'} <a href="#/profil">Ustaw cele</a>, a pokażemy, czy produkt pasuje właśnie do Ciebie.</p>`}
    </div>`);
    parts.push('<div id="discBox"></div>');
    const qc = prod.qchg && prod.qchg.length > 1 ? prod.qchg : null;
    if (qc) {
      const a = qc[qc.length - 2], z = qc[qc.length - 1], num = x => parseFloat(x[2]), mon = d => new Date(d + 'T12:00:00').toLocaleDateString('pl-PL', { month: 'short', year: 'numeric' });
      const less = num(z) < num(a), pct = Math.round(Math.abs(num(z) - num(a)) / num(a) * 100);
      parts.push(`<div class="panel stack qchg${less ? ' less' : ''}" id="qchgBox"><b>${less ? 'Mniej w opakowaniu' : 'Więcej w opakowaniu'}</b><p class="small">Według bazy Open Food Facts opakowanie zmieniło się z <b>${esc(a[2])}</b> (${esc(mon(a[0]))}) na <b>${esc(z[2])}</b> (${esc(mon(z[0]))}), czyli o ${pct}%.${less ? ' Sprawdź cenę za kilogram lub litr.' : ''}</p><p class="small muted">Gramaturę wpisują użytkownicy bazy, więc może zawierać błędy.</p></div>`);
    }
    const onShelf = Shelf.hasCode(A.shelves, prod.code);
    parts.push(`<div class="actions" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <button class="btn btn-green" type="button" data-act="shelf-add" ${onShelf ? 'disabled' : ''}>${onShelf ? 'Już na półce' : 'Na półkę (+5 pkt)'}</button>
      <button class="btn btn-white" type="button" data-act="scan">Skanuj kolejny</button></div>`);
    parts.push('</div>');
    // Brakuje składu albo wartości odżywczych: zachęta do uzupełnienia (dane trafią do Open Food Facts).
    const miss = missingParts(prod, cur.snapshot);
    if (A.CFG.offProxyUrl && prod.kind === 'food' && (prod.source === 'off' || added) && (miss.ingr || miss.nut)) {
      const what = [miss.ingr && 'składu', miss.nut && 'wartości odżywczych'].filter(Boolean).join(' i ');
      parts.push(`<div id="completeBox"><div class="panel stack"><b style="font-family:var(--f-display);font-size:1.1rem">Pomóż uzupełnić ten produkt</b><p class="small">W bazie brakuje ${what}, dlatego ocena jest niepełna. Uzupełnisz to w minutę, a każdy kolejny kupujący zobaczy pełną ocenę.</p><button class="btn btn-gold" type="button" data-act="complete">Uzupełnij (+10 pkt za każdą część)</button></div></div>`);
    }
    parts.push(detailsHtml(prod, an, !pm.personal));
    screen(parts.join(''));
    if (A.discFill) A.discFill(prod.code);
    if (prod.kind === 'food' && prod.source !== 'local' && prod.category) loadCategory();
  }
  function wrongHint() {
    const r = cur.pm.rows.find(x => x.kind === (cur.pm.good ? 'good' : 'bad'));
    if (r) return (cur.pm.good ? 'Pasuje, bo: ' : 'Nie bardzo, bo: ') + r.title.toLowerCase() + (r.word ? ' – ' + r.word : '') + (r.value ? ' (' + r.value + ')' : '') + '.';
    return cur.pm.good ? 'Ten produkt wypada dobrze w ocenie składu.' : 'Ten produkt wypada słabiej w ocenie składu.';
  }

  /* ---------- Szczegóły oceny (z wersji 0.5) ---------- */
  function ring(score, color) {
    const C = 2 * Math.PI * 54, off = score == null ? C : C * (1 - score / 100);
    return `<div class="ring" role="img" aria-label="Ocena ${score == null ? 'niedostępna' : score + ' na 100'}"><svg viewBox="0 0 132 132"><circle class="trk" cx="66" cy="66" r="54" fill="none" stroke-width="14"/><circle class="val" cx="66" cy="66" r="54" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg><div class="ring-c"><span class="ring-n">${score == null ? '–' : score}</span><span class="ring-d">na 100</span></div></div>`;
  }
  function sourcesHtml(items) {
    const src = sourcesFor(items);
    return src.length ? `<div class="sources"><b class="small">Źródła:</b>${src.map(s => `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('')}</div>` : '';
  }
  function effectText(a, kind) {
    if (kind === 'watch') return '';
    if (kind === 'cosmetic') return a.level >= 3 ? 'Obniża ocenę o 40 pkt i ogranicza ją do 49.' : a.level === 2 ? 'Obniża ocenę o 15 pkt.' : 'Nie obniża oceny.';
    return additiveEffect(a) + ' Producenci nie podają ilości dodatków na etykiecie. Dopuszczalne ilości ustala UE.';
  }
  function addList(list, kind) {
    return `<div class="adds">${list.map(a => {
      const lv = a.level == null ? { label: 'Brak opisu', cls: 'lv-none' } : LEVELS[a.level];
      const chip = a.code || (a.level == null ? '?' : ['✓', '!', '!!', '!!!'][a.level]);
      const eff = effectText(a, kind);
      return `<details class="add" data-ev="additive" data-key="${esc(a.code || a.name)}"><summary><span class="code ${lv.cls}">${esc(chip)}</span><span class="name">${esc(a.name || a.code)}</span><span class="lvl" style="color:${a.level == null ? 'var(--muted)' : ['var(--great)', 'var(--good)', 'var(--fair)', 'var(--poor)'][a.level]}">${lv.label}</span></summary><p>${esc(a.note)}</p>${eff ? `<p class="effect">${esc(eff)}</p>` : ''}</details>`;
    }).join('')}</div>`;
  }
  function scoreNote(prod, an) {
    const isFood = prod.kind === 'food';
    const onlyAdditives = isFood && an.parts && an.parts.length === 1 && an.parts[0].key === 'additives';
    const capWho = (an.capBy || []).map(c => { const a = ADDITIVES[c]; return a ? `${c} (${a[0]})` : c; }).join(', ');
    return an.score == null ? 'Baza nie ma jeszcze danych potrzebnych do oceny.' :
      an.capped ? (isFood ? `Ocena ograniczona do 49, bo produkt zawiera ${capWho}.` : 'Ocena ograniczona do 49, bo kosmetyk zawiera składnik z dużymi zastrzeżeniami.') :
      an.floored ? 'Produkt prosty lub nieprzetworzony. Może być kaloryczny, ale sycący. Liczy się porcja.' :
      onlyAdditives ? 'Ocena częściowa: obejmuje tylko dodatki. Bez wartości odżywczych nie wiemy, ile jest cukru, tłuszczu i soli.' :
      an.partial ? 'Ocena częściowa: w bazie brakuje części danych.' : (isFood ? 'Wartość odżywcza 60%, dodatki 30%, przetworzenie 10%.' : 'Ocena na podstawie składu INCI.');
  }
  function detailsHtml(prod, an, general) {
    const g = grade(an.score), isFood = prod.kind === 'food';
    const onlyAdditives = isFood && an.parts && an.parts.length === 1 && an.parts[0].key === 'additives';
    const note = scoreNote(prod, an);
    const s = [`<h2 style="font-size:1.3rem;margin-top:6px">Szczegóły oceny</h2>`];
    if (!general) s.push(`<div class="card score"><div>${ring(an.score, g.color)}</div><div><span class="small muted" style="font-weight:800">OCENA SKŁADU</span><h2 style="color:${g.color}">${esc(onlyAdditives ? 'Dodatki: ' + g.label.toLowerCase() : g.label)}</h2><p>${esc(note)}</p></div></div>`);
    const why = explain(prod, an);
    if (why.length) {
      const icon = { '+': ['why-plus', '+'], '-': ['why-minus', '−'], 'i': ['why-info', 'i'] };
      s.push(`<details class="card more why-card" data-ev="why"><summary class="details-h">Dlaczego taka ocena?</summary><div class="stack" style="margin-top:10px"><ul class="why">${why.map(w => `<li class="${icon[w.sign][0]}"><span class="why-ic" aria-hidden="true">${icon[w.sign][1]}</span><span>${esc(w.text)}</span></li>`).join('')}</ul><button class="linkbtn small" type="button" data-act="how" style="align-self:flex-start">Cała metoda oceny</button></div></details>`);
    }
    if (isFood) {
      const pv = k => ((an.parts || []).find(p => p.key === k) || {}).v;
      const bar = v => v == null ? '' : `<div class="bar"><i style="width:${v}%;background:${grade(v).color}"></i></div>`;
      const ns = an.nutriscore in NUTRI_POINTS ? an.nutriscore : null;
      const novaTxt = { 1: 'nieprzetworzone lub minimalnie przetworzone', 2: 'przetworzone składniki kulinarne', 3: 'przetworzone', 4: 'wysoko przetworzone' }[Number(prod.nova)];
      const worst = an.additives.reduce((m, a) => Math.max(m, a.level ?? -1), -1);
      s.push(`<div class="card stack parts-card"><h3>Z czego wynika ocena</h3><div class="parts">
        <div class="part"><b>Wartość odżywcza</b><span class="ns" aria-label="Nutri-Score ${ns ? ns.toUpperCase() : 'brak'}">${'abcde'.split('').map(l => `<span class="${l}${l === ns ? ' on' : ''}">${l.toUpperCase()}</span>`).join('')}</span>${bar(pv('nutrition'))}<span class="sub">${ns ? 'Nutri-Score ' + ns.toUpperCase() + (an.nutriscoreEstimated ? ' (szacunkowy z wpisanych wartości)' : '') : 'Brak Nutri-Score w bazie'}</span></div>
        <div class="part"><b>Dodatki</b><span class="small">${an.additivesKnown ? an.additives.length + ' ' + plural(an.additives.length, 'dodatek', 'dodatki', 'dodatków') : 'brak danych'}</span>${bar(pv('additives'))}<span class="sub">${!an.additivesKnown ? 'Baza nie ma składu tego produktu.' : !an.additives.length ? 'Nie znaleźliśmy dodatków z numerem E.' : worst >= 0 ? 'Najpoważniejsze: ' + LEVELS[worst].label.toLowerCase() : 'Dodatki spoza naszej bazy.'}</span></div>
        <div class="part"><b>Przetworzenie</b><span class="small">${novaTxt ? 'NOVA ' + Number(prod.nova) : 'brak danych'}</span>${bar(pv('processing'))}<span class="sub">${novaTxt ? 'Grupa ' + Number(prod.nova) + ': ' + novaTxt : 'Brak grupy NOVA w bazie'}</span></div></div></div>`);
      const nm = prod.nutriments || {};
      if (Object.values(nm).some(v => v != null)) {
        const row = (label, v, unit, key) => {
          if (v == null) return '';
          const lv = key ? nutrientLevel(key, v, prod.drink) : null, word = { low: 'mało', mid: 'średnio', high: 'dużo' }[lv];
          return `<tr><td>${lv ? `<span class="dot ${lv}"></span>` : '<span class="dot na"></span>'}${label}${word ? `<span class="lvl-word">${word}</span>` : ''}</td><td>${fmtNum(v)} ${unit}</td></tr>`;
        };
        s.push(`<div class="card stack"><div class="sec-head"><h3>Wartości odżywcze</h3><span class="small muted">na 100 ${prod.drink ? 'ml' : 'g'}</span></div><table class="nut"><tbody>${row('Energia', nm.kcal, 'kcal')}${row('Tłuszcz', nm.fat, 'g', 'fat')}${row('w tym nasycone', nm.sat, 'g', 'saturated-fat')}${row('Cukry', nm.sugars, 'g', 'sugars')}${row('Sól', nm.salt, 'g', 'salt')}${row('Białko', nm.proteins, 'g')}${row('Błonnik', nm.fiber, 'g')}</tbody></table><p class="small muted">Kolory według progów z etykiet w Wielkiej Brytanii: zielony to mało, pomarańczowy średnio, czerwony dużo.</p></div>`);
      }
      if (an.additives.length) s.push(`<div class="card stack"><div class="sec-head"><h3>Dodatki</h3><span class="small muted">dotknij, żeby rozwinąć</span></div>${addList(an.additives, 'food')}${sourcesHtml(an.additives)}</div>`);
      if (an.watch.length) s.push(`<div class="card stack"><h3>Warto wiedzieć</h3>${addList(an.watch.map(w => ({ code: '', name: w.label, level: w.level, note: w.note })), 'watch')}<p class="small muted">Te informacje nie zmieniają oceny.</p></div>`);
      const alg = (prod.allergens || []).map(a => ALLERGENS[a] || String(a).replace(/^[a-z]{2}:/, '').replace(/-/g, ' '));
      s.push(`<div class="card stack"><h3>Alergeny</h3>${alg.length ? `<div class="chips">${alg.map(a => `<span class="chip plain">${esc(a)}</span>`).join('')}</div>` : '<p class="small muted">Baza nie podaje alergenów dla tego produktu.</p>'}<p class="small muted">Lista pochodzi z bazy tworzonej przez społeczność i może być niepełna. Przy alergii zawsze sprawdź etykietę.</p></div>`);
    } else {
      s.push(`<div class="card stack"><div class="sec-head"><h3>Składniki z uwagami</h3><span class="small muted">${an.count} ${plural(an.count, 'składnik', 'składniki', 'składników')}</span></div>${an.flags.length ? addList(an.flags, 'cosmetic') + sourcesHtml(an.flags) : `<p class="muted small">${an.count ? 'Nie znaleźliśmy składników, które budzą zastrzeżenia według naszej bazy.' : 'Baza nie ma jeszcze składu tego kosmetyku.'}</p>`}</div>`);
    }
    if (prod.ingredients) s.push(`<details class="card more"><summary class="details-h">Pełny skład</summary><p class="small" style="margin-top:8px">${esc(prod.ingredients)}</p></details>`);
    if (isFood && prod.source !== 'local' && prod.category) s.push(`<div class="card stack" id="catCard" aria-live="polite"><h3>Na tle podobnych produktów</h3><div id="catBody"><p class="small muted">Porównuję z podobnymi produktami…</p><div class="sk" style="height:56px"></div></div></div>`);
    const offUrl = `${prod.source === 'obf' ? OBF : OFF}/product/${encodeURIComponent(prod.code)}`;
    s.push(`<div class="card stack"><div class="actions"><button class="btn btn-white btn-sm" type="button" data-act="share"><svg><use href="#i-share"/></svg>Udostępnij</button><button class="btn btn-white btn-sm" type="button" data-act="report">Zgłoś błąd</button>${prod.source !== 'local' ? '<button class="btn btn-white btn-sm" type="button" data-act="manual-ing">Wpisz skład ręcznie</button>' : ''}</div>
      <div id="ingSlot"></div>
      <div class="source">${prod.source === 'local' ? (prod.added ? '<span>Dane, które dodałeś do Open Food Facts (licencja ODbL). Dziękujemy!</span>' : '<span>Skład wpisany przez Ciebie, zapisany tylko w tym telefonie.</span>') : `<span>Źródło danych: <a href="${offUrl}" target="_blank" rel="noopener">${prod.source === 'obf' ? 'Open Beauty Facts' : 'Open Food Facts'}</a> (licencja ODbL). Widzisz błąd? Możesz go poprawić w bazie.</span>`}<span>Ocena ma charakter informacyjny i nie jest poradą medyczną.</span></div></div>`);
    return s.join('');
  }

  /* ---------- Porównanie w kategorii i zamienniki ---------- */
  let catLoading = null; // produkt, dla którego trwa porównanie (chroni przed wielokrotnym klikaniem)
  async function loadCategory() {
    const mine = cur, body = () => A.$('catBody');
    if (catLoading === mine) return;
    catLoading = mine;
    try {
      // Najpierw najwęższa kategoria; gdy ma za mało produktów, kategoria nadrzędna (np. „jogurty owocowe” → „jogurty”).
      const cats = (mine.prod.categories || []).slice().reverse().filter(c => /^en:[a-z0-9-]{2,60}$/.test(c)).slice(0, 2);
      if (!cats.length && mine.prod.category) cats.push(mine.prod.category);
      const onWait = sec => { const b = body(); if (b && cur === mine) b.innerHTML = `<p class="small muted">Wyszukiwarka produktów ma limit zapytań. Porównam za ${sec} s…</p><div class="sk" style="height:56px"></div>`; };
      let list = [], levels = 0;
      for (const c of cats) {
        levels++;
        const got = await A.fetchCategory(c, onWait);
        const seen = new Set(list.map(x => x.code));
        list = list.concat(got.filter(x => !seen.has(x.code)));
        if (list.filter(x => x.code !== mine.prod.code).length >= 8) break;
      }
      if (cur !== mine || !body()) return;
      const cmp = compareInCategory(mine.prod, mine.an, list, A.profile);
      // Nazwy kategorii w bazie bywają po angielsku albo francusku, więc podajemy polską nazwę z naszej listy, jeśli pasuje.
      const shop = (mine.prod.categories || []).slice().reverse().map(c => SHOP_CATEGORIES.find(x => x.key === c)).find(Boolean);
      const out = [];
      if (A.profile.noScores) out.push(`<p class="small muted">${cmp.sampleSize ? `Sprawdziliśmy ${cmp.sampleSize} podobnych produktów.` : 'Nie mamy jeszcze podobnych produktów do porównania.'}</p>`);
      else if (!cmp.enough) out.push(`<p class="small muted">Za mało podobnych produktów w bazie, żeby rzetelnie porównać (${cmp.sampleSize} z ${MIN_SAMPLE} potrzebnych).</p>`);
      else if (mine.an.score != null) {
        const p = cmp.betterThan, kind = shop ? ` (${esc(shop.label.toLowerCase())})` : '';
        const n = `${cmp.sampleSize} ${plural(cmp.sampleSize, 'podobnego produktu', 'podobnych produktów', 'podobnych produktów')}${kind}`;
        const sentence = p === 0 ? `Żaden z ${n} nie ma niższej oceny.` : p === 100 ? `Ma wyższą ocenę niż wszystkie ${cmp.sampleSize} porównane podobne produkty${kind}.` : `Ma lepszą ocenę niż ${p}% z ${n}.`;
        out.push(`<div class="pctl alt-score"><b class="pctl-n">${p}%</b><span class="small">${sentence}</span></div><div class="pctl-bar alt-score" aria-hidden="true"><i style="left:${p}%"></i></div>`);
      }
      // Zamiennik musi być naprawdę lepszy dla tej osoby: co najmniej „Dobre dopasowanie” i wyżej niż obecny produkt.
      // Zamiennik musi należeć do tej samej, najwęższej kategorii co skanowany produkt (krem orzechowy → krem orzechowy, a nie dżem),
      // a dopasowanie musi być co najmniej dobre i wyższe niż obecnego produktu.
      const narrow = cats[0];
      const altSrc = narrow ? compareInCategory(mine.prod, mine.an, list.filter(x => (x.categories || []).includes(narrow)), A.profile).alternatives : cmp.alternatives;
      const alts = altSrc.map(x => Object.assign(x, { pm: personalMatch(x.pr, x.an, A.profile) })).filter(x => x.pm.pct != null && x.pm.pct >= 50 && (mine.pm.pct == null || x.pm.pct > mine.pm.pct));
      mine.alts = alts;
      // Domownicy: gdy produkt komuś nie pasuje, pokazujemy jeden produkt z tej kategorii, który pasuje wszystkim.
      if (mine.fam && mine.fam.tone !== 'ok' && A.familyAltPick && cur === mine) {
        const pick = A.familyAltPick(mine.prod, narrow ? list.filter(x => (x.categories || []).includes(narrow)) : list) || (narrow ? A.familyAltPick(mine.prod, list) : null);
        mine.famAltHtml = A.familyAltHtml(mine.fam, pick);
        const slot = A.$('famAlt'); if (slot) slot.innerHTML = mine.famAltHtml;
      }
      if (alts.length) {
        const best = alts[0];
        A.setHistoryAlt(mine.prod.code, { code: best.pr.code, name: best.pr.name, image: A.safeImg(best.pr.image), pct: best.pm.pct, level: best.pm.level, label: best.pm.label });
        out.push(`<h3 style="font-size:1rem">Zamień na lepsze</h3><div class="list">${alts.map(x => { const img = A.safeImg(x.pr.image); return `<div class="item alt" style="cursor:default"><a class="row grow" href="#/p/${esc(x.pr.code)}" style="text-decoration:none;color:inherit">${img ? `<img class="thumb" src="${esc(img)}" alt="" loading="lazy">` : `<span class="thumb">${art('dept_' + departmentFor(x.pr), 34)}</span>`}<span class="grow"><span class="t1">${esc(x.pr.name)}</span><span class="t2">${esc([x.pr.brand, x.pm.label].filter(Boolean).join(' · '))}</span></span><span class="pct ${A.pctClass(x.pm.level)} alt-score">${x.pm.pct == null ? '–' : x.pm.pct + '%'}</span></a><button class="btn btn-green btn-sm" type="button" data-act="swap-alt" data-code="${esc(x.pr.code)}">Zamień</button></div>`; }).join('')}</div><p class="small muted">Zamiana dodaje zamiennik na półkę (+15 pkt). Ceny i dostępność w Twoim sklepie mogą się różnić.</p>`);
      } else if (cmp.enough && mine.an.score != null) out.push(`<p class="small muted">${cmp.betterThan >= 70 ? 'To jeden z lepszych wyborów w tej kategorii.' : 'Nie znaleźliśmy wyraźnie lepszego zamiennika.'}</p>`);
      body().innerHTML = out.join('') || '<p class="small muted">Nie mamy jeszcze podobnych produktów do porównania.</p>';
    } catch (e) {
      if (cur !== mine || !body()) return;
      const kind = (e && e.kind) || 'network';
      body().innerHTML = `<p class="small muted">${kind === 'offline' ? 'Porównanie wymaga internetu.' : kind === 'rate' ? 'Wyszukiwarka produktów chwilowo ogranicza liczbę zapytań. Spróbuj za minutę.' : 'Wyszukiwarka produktów Open Food Facts chwilowo nie odpowiada.'}</p><button class="btn btn-white btn-sm" type="button" data-act="retry-cat">Spróbuj ponownie</button>`;
    } finally { if (catLoading === mine) catLoading = null; }
  }

  /* ---------- Półka i zamiana ---------- */
  A.addToShelf = (prod, pm, quiet) => {
    const sh = A.shelves.shelves.find(s => s.id === A.shelves.active) || A.shelves.shelves[0];
    const fam = A.familyShort ? A.familyShort(prod, cur && cur.prod === prod ? cur.an : null, cur && cur.prod === prod ? cur.fam : null) : null;
    const r = Shelf.addItem(A.shelves, sh.id, { name: prod.name || ('Produkt ' + prod.code), code: prod.code, pct: pm ? pm.pct : null, categories: prod.categories, qty: 1, unit: 'szt', fam });
    if (r.error === 'duplicate') { if (!quiet) A.toast(`Ten produkt już jest na półce „${sh.name}”.`); return false; }
    if (r.error === 'full') { A.toast('Ta półka jest pełna. Usuń kupione rzeczy albo wybierz inną półkę.'); return false; }
    if (r.error) { A.toast('Nie udało się dodać produktu.'); return false; }
    A.shelves = r.state; A.saveShelves();
    A.award('shelf_add', { code: prod.code });
    if (!quiet) A.toast(`Dodano na półkę „${sh.name}”.`, '<a href="#/polki">Zobacz</a>');
    return true;
  };
  A.swapTo = (fromCode, alt) => {
    // Usuwamy słabszy produkt z półki (jeśli tam był) i dodajemy zamiennik.
    A.shelves.shelves.forEach(sh => { sh.items.filter(i => i.code === fromCode && !i.checked).forEach(i => { A.shelves = Shelf.removeItem(A.shelves, sh.id, i.id).state; }); });
    const sh = A.shelves.shelves.find(s => s.id === A.shelves.active) || A.shelves.shelves[0];
    const r = Shelf.addItem(A.shelves, sh.id, { name: alt.name, code: alt.code, pct: alt.pct, categories: alt.categories });
    if (!r.error || r.error === 'duplicate') { if (!r.error) A.shelves = r.state; A.saveShelves(); }
    const g = A.award('swap_to_better', { code: alt.code });
    A.toast(g.blocked === 'once_product_day' ? 'Ten zamiennik już dziś wybrałeś. Jest na półce.' : `Zamienione! „${alt.name}” jest na półce „${sh.name}”.`, '<a href="#/polki">Zobacz</a>');
  };

  /* ---------- Brak produktu: dodaj do bazy i zdobądź nagrodę odkrywcy ---------- */
  const photos = { front: null, ingredients: null, nutrition: null };
  const PHOTO_STEPS = [['front', 'Przód opakowania', 'żeby inni rozpoznali produkt'], ['ingredients', 'Skład', 'cała lista składników, wyraźnie'], ['nutrition', 'Wartości odżywcze', 'tabelka z tyłu, najlepiej razem z kodem kreskowym']];
  // Odkrywcy: kod ze zdjęcia musi zgadzać się ze skanem (ochrona przed zdjęciami innego produktu).
  function barcodeState(code) {
    const found = Object.values(photos).filter(Boolean).flatMap(p => p.codes || []);
    if (found.includes(code)) return { s: 'match' };
    if (found.length) return { s: 'other', other: found[0] };
    return { s: 'none' };
  }
  const BAD_WORDS = ['kurw', 'chuj', 'huj ', 'pierdol', 'jeban', 'jebi', 'pizd', 'kutas', 'cipa', 'cipk', 'debil', 'spierdal', 'zjeb'];
  A.nameProblem = name => {
    const f = ' ' + fold(name) + ' ';
    if (BAD_WORDS.some(w => f.includes(w))) return 'Ta nazwa wygląda na żart. Wpisz nazwę z opakowania.';
    if (!/[a-ząćęłńóśźż]{2}/i.test(name)) return 'Wpisz nazwę z opakowania, np. „Jogurt naturalny 2%”.';
    if (/(.)\1{4,}/.test(name) || /^(test|asdf|qwer|xxx|abc)/i.test(name.trim())) return 'Wpisz prawdziwą nazwę z opakowania.';
    return '';
  };
  function renderMissing(code, reason) {
    cur = { prod: { code }, missing: true, reason, rendered: true };
    Object.keys(photos).forEach(k => { if (photos[k] && photos[k].url) URL.revokeObjectURL(photos[k].url); photos[k] = null; });
    const err = A.ERR_TEXT[reason];
    const badChecksum = !err && !validBarcode(code);
    const proxy = !!A.CFG.offProxyUrl;
    const parts = [topbar('Wynik skanu · ' + code)];
    if (err) {
      parts.push(`<div class="panel stack center" id="notFound" data-reason="${esc(reason)}" style="align-items:center">${A.mascot('sad', 80)}<h1 style="font-size:1.4rem">${esc(err[0])}</h1><p class="small muted">${esc(err[1])}</p><button class="btn btn-gold" type="button" data-act="retry" data-code="${esc(code)}">Spróbuj ponownie</button></div>`);
    } else {
      parts.push(`<div class="row" id="notFound" data-reason="missing" style="align-items:center">${A.mascot('wow', 84)}<div class="stack" style="gap:6px"><h1 style="font-size:1.4rem">Ojej! Tego produktu jeszcze nie znamy</h1><p class="small muted">${badChecksum ? 'Cyfry tego kodu się nie zgadzają (zła suma kontrolna), więc pewnie jedna jest błędna. Sprawdź je z opakowaniem. ' : ''}Możesz być pierwszą osobą, która go doda. Dzięki Tobie inni też zobaczą jego ocenę.</p></div></div>`);
      parts.push(`<div class="panel stack" style="position:relative;margin-top:14px;padding-top:30px" id="addCta">
        <div style="position:absolute;left:0;right:0;top:-24px">${ribbonSvg('Nagroda odkrywcy', 250, ['#FFE27A', '#F0B021', '#8A5A0A'])}</div>
        <div class="reward-grid"><div class="card"><svg width="40" height="40"><use href="#i-star"/></svg><b style="font-family:var(--f-display)">+10 od razu</b><span class="small muted">+50, gdy 2 osoby potwierdzą</span></div>
          <div class="card">${medalSvg('plus', 'baza', true, 48)}<b style="font-family:var(--f-display);font-size:.92rem;line-height:1.1">Odznaka Odkrywca</b></div>
          <div class="card disc-gold-card"><span class="disc-gold" aria-hidden="true">★</span><b style="font-family:var(--f-display);font-size:.92rem;line-height:1.1">Złota karta Odkrycie</b><span class="small" style="color:#8A5A0A;font-weight:700">+1 pkt za każdą osobę, która go sprawdzi</span></div></div></div>`);
      if (proxy) {
        parts.push(`<form class="stack" id="addForm" novalidate>
          <label for="addName"><b style="font-family:var(--f-display)">Nazwa produktu</b></label>
          <input class="field" id="addName" maxlength="80" autocomplete="off" placeholder="np. Jogurt naturalny 2%" required>
          <div class="sec-head"><b style="font-family:var(--f-display);font-size:1.1rem">Zrób 3 zdjęcia</b><span class="small" style="font-weight:800;color:var(--green-d)" id="photoCount">0 z 3 gotowe</span></div>
          ${PHOTO_STEPS.map(([k, t, d], i) => `<div class="photo-step" id="ps-${k}"><span class="num">${i + 1}</span><span class="grow"><b style="display:block">${t}</b><span class="small muted">${d}</span></span><span id="pv-${k}"></span><span class="btn btn-blue btn-sm filebtn"><span id="pb-${k}">Zrób zdjęcie</span><input type="file" accept="image/*" capture="environment" data-photo="${k}" aria-label="Zdjęcie: ${t}"></span></div>`).join('')}
          <div class="disc-check" id="addCode" role="status" hidden></div>
          <p class="msg" id="addMsg" role="status"></p>
          <button class="btn btn-grey btn-block" type="submit" id="addSend">Jeszcze 3 zdjęcia do nagrody</button>
          <p class="small muted center">Zdjęcia trafią do otwartej bazy Open Food Facts i będą dostępne dla wszystkich na licencji CC BY-SA. Fotografuj samo opakowanie, bez osób.</p></form>`);
      } else {
        parts.push(`<div class="card stack"><b style="font-family:var(--f-display)">Dodaj produkt w 2 minuty</b><ol class="small" style="margin:0;padding-left:20px;display:grid;gap:4px"><li>Zainstaluj darmową aplikację Open Food Facts. To otwarta baza, z której korzysta „Dobre czy nie?”.</li><li>Zeskanuj w niej ten sam kod: <span class="mono">${esc(code)}</span>.</li><li>Zrób 3 zdjęcia: przód, skład i tabelę wartości odżywczych.</li></ol>
          <div class="actions"><a class="btn btn-green btn-sm" href="https://play.google.com/store/apps/details?id=org.openfoodfacts.scanner" target="_blank" rel="noopener">Android: Open Food Facts</a><a class="btn btn-white btn-sm" href="https://world.openfoodfacts.org/open-food-facts-mobile-app" target="_blank" rel="noopener">iPhone i inne</a></div>
          <p class="small muted">Dodawanie prosto z tej aplikacji, z nagrodą odkrywcy, uruchomimy wkrótce.</p></div>`);
      }
      parts.push(`<div class="row" style="justify-content:center;gap:18px"><a href="#/">Nie teraz</a><button class="linkbtn" type="button" data-act="scan">Zły kod? Zeskanuj ponownie</button></div>`);
    }
    parts.push(`<details class="card more" id="ingDetails"><summary class="details-h">Oceń skład z etykiety</summary><div id="ingSlot" style="margin-top:10px"></div></details>`);
    if (!err) parts.push(`<p class="small muted center">Nie możesz teraz dodać produktu? <button class="linkbtn small" type="button" data-act="report-missing" data-code="${esc(code)}">Zgłoś brak</button></p>`);
    screen(parts.join(''));
    A.$('ingSlot').innerHTML = ingredientForm(code, 'food');
    if (!err && !badChecksum && A.discMiss) A.discMiss(code);
  }
  A.photoChosen = async (input) => {
    const k = input.dataset.photo, f = input.files && input.files[0];
    input.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type || 'image/')) { A.$('addMsg').textContent = 'To nie jest zdjęcie. Wybierz plik ze zdjęciem.'; return; }
    if (f.size > 25 * 1024 * 1024) { A.$('addMsg').textContent = 'To zdjęcie jest za duże. Zrób zwykłe zdjęcie aparatem.'; return; }
    try {
      const blob = await A.downscale(f, 1600, 'blob');
      if (photos[k] && photos[k].url) URL.revokeObjectURL(photos[k].url);
      photos[k] = { blob, url: URL.createObjectURL(blob), codes: A.findCodes ? await A.findCodes(blob) : [] };
      A.$('pv-' + k).innerHTML = `<img src="${photos[k].url}" alt="Podgląd zdjęcia" style="width:44px;height:44px;object-fit:cover;border-radius:10px">`;
      A.$('ps-' + k).classList.add('done'); A.$('ps-' + k).querySelector('.num').textContent = '✓'; A.$('pb-' + k).textContent = 'Zmień';
      A.$('addMsg').textContent = '';
    } catch (e) { A.$('addMsg').textContent = 'Nie udało się odczytać zdjęcia. Spróbuj zrobić je jeszcze raz.'; }
    updateSend();
  };
  function updateSend() {
    const n = Object.values(photos).filter(Boolean).length, btn = A.$('addSend');
    if (!btn) return;
    A.$('photoCount').textContent = n + ' z 3 gotowe';
    const bc = cur && cur.missing ? barcodeState(cur.prod.code) : { s: 'none' }, bEl = A.$('addCode');
    if (bEl && n) {
      bEl.hidden = false; bEl.className = 'disc-check ' + (bc.s === 'match' ? 'ok' : bc.s === 'other' ? 'bad' : 'warn');
      bEl.innerHTML = bc.s === 'match' ? '<b>✓ Kod na zdjęciu zgadza się ze skanem</b>'
        : bc.s === 'other' ? `<b>To chyba inny produkt</b><span>Zeskanowałeś ${esc(cur.prod.code)}, a na zdjęciu jest ${esc(bc.other)}. Zrób zdjęcia tego samego opakowania.</span>`
        : '<b>Nie widzimy kodu kreskowego na zdjęciach</b><span>Zrób zdjęcie tyłu tak, żeby było widać kod. Bez tego produkt potwierdzą dopiero inne osoby.</span>';
    }
    const ready = n === 3 && bc.s !== 'other';
    btn.className = 'btn btn-block ' + (ready ? 'btn-gold' : 'btn-grey');
    btn.textContent = ready ? 'Wyślij i odbierz nagrodę' : `Jeszcze ${3 - n} ${plural(3 - n, 'zdjęcie', 'zdjęcia', 'zdjęć')} do nagrody`;
  }
  A.submitAdd = async () => {
    const code = cur && cur.missing ? cur.prod.code : null; if (!code) return;
    const name = A.$('addName').value.replace(/\s+/g, ' ').trim(), msg = A.$('addMsg');
    if (name.length < 3) { msg.textContent = 'Wpisz nazwę produktu z opakowania (co najmniej 3 znaki).'; A.$('addName').focus(); return; }
    const np = A.nameProblem(name); if (np) { msg.textContent = np; A.$('addName').focus(); return; }
    const bc = barcodeState(code);
    if (bc.s === 'other') { msg.textContent = 'Kod na zdjęciu nie zgadza się ze skanem. Zrób zdjęcia tego samego opakowania.'; return; }
    const missing = PHOTO_STEPS.filter(([k]) => !photos[k]).map(([, t]) => t.toLowerCase());
    if (missing.length) { msg.textContent = 'Brakuje zdjęcia: ' + missing.join(', ') + '.'; return; }
    const btn = A.$('addSend'); btn.disabled = true; btn.textContent = 'Wysyłam…'; msg.className = 'msg';
    const rec = { id: code + '-' + Date.now(), code, name, lang: 'pl', uuid: A.appUuid(), at: Date.now(), checks: { barcode: bc.s }, photos: { front: photos.front.blob, ingredients: photos.ingredients.blob, nutrition: photos.nutrition.blob } };
    const res = await A.sendAdd(rec);
    if (res === 'ok') addedSuccess(code, name);
    else if (res === 'queued') { msg.className = 'msg ok'; msg.textContent = 'Nie ma teraz połączenia. Zapisaliśmy produkt w telefonie i wyślemy go, gdy internet wróci. Nagrodę dostaniesz po wysłaniu.'; btn.textContent = 'Zapisane do wysłania'; }
    else if (res === 'exists') { msg.className = 'msg ok'; msg.textContent = 'Ktoś właśnie dodał ten produkt do bazy. Dziękujemy! Sprawdź go za chwilę ponownie.'; btn.textContent = 'Produkt już jest w bazie'; }
    else { msg.textContent = res === 'rejected' ? 'Baza nie przyjęła tego produktu. Sprawdź nazwę i zdjęcia albo spróbuj później.' : 'Nie udało się wysłać. Spróbuj ponownie za chwilę.'; btn.disabled = false; updateSend(); }
  };
  function addedSuccess(code, name) {
    const box = A.$('addForm'); if (!box) return;
    A.rememberAdded(code, name);
    const shots = { ingredients: photos.ingredients && photos.ingredients.blob, nutrition: photos.nutrition && photos.nutrition.blob };
    box.outerHTML = `<div class="panel stack center" style="align-items:center" id="addDone">${A.mascot('cheer', 90)}<h2>Dziękujemy, odkrywco!</h2><p class="small">Produkt jest już w bazie Open Food Facts. Gdy potwierdzą go 2 kolejne osoby, dostaniesz złotą kartę i +50 pkt. Jeszcze 2 krótkie kroki, a od razu zobaczysz jego ocenę.</p><a class="small" href="#/odkrycia">Twoje odkrycia</a></div><div id="completeBox"></div>`;
    A.openComplete(A.$('completeBox'), { code, name, needIngr: true, needNut: true, photos: shots, onDone: () => {
      const el = A.$('completeBox'); if (!el) return;
      el.innerHTML = `<div class="panel stack center" style="align-items:center">${A.mascot('wow', 70)}<b style="font-family:var(--f-display);font-size:1.15rem">Gotowe!</b><p class="small">Wszyscy zobaczą produkt w bazie zwykle w ciągu kilku minut. Ty możesz od razu sprawdzić jego ocenę.</p><button class="btn btn-gold btn-block" type="button" data-act="retry" data-code="${esc(code)}">Zobacz ocenę produktu</button><a class="small" href="#/postepy">Zobacz swoje odznaki</a></div>`;
    } });
  }
  function agoText(t) {
    const m = Math.max(0, Math.round((Date.now() - (t || Date.now())) / 60000));
    return m < 1 ? 'przed chwilą' : m < 60 ? `${m} min temu` : m < 1440 ? `${Math.round(m / 60)} godz. temu` : 'niedawno';
  }
  A.startComplete = () => {
    if (!cur || !cur.prod) return;
    const p = cur.prod, el = A.$('completeBox'); if (!el) return;
    const miss = missingParts(p, cur.snapshot), nmKnown = !miss.nut;
    A.openComplete(el, { code: p.code, name: p.name, drink: !!p.drink, needIngr: miss.ingr, needNut: miss.nut, images: { ingredients: p.imageIngredients, nutrition: p.imageNutrition }, onDone: saved => {
      const local = A.store.get('local', {})[p.code] || {};
      if (local.ingredients && !p.ingredients) p.ingredients = local.ingredients;
      if (local.nutriments && !nmKnown) p.nutriments = Object.assign({}, local.nutriments);
      cur.an = analyze(p); cur.pm = personalMatch(p, cur.an, A.profile); A.remember(p, cur.an, cur.pm);
      render();
      A.albumAdd(p, { touch: true }).catch(() => null).then(res => {
        if (res && res.revived) { A.toast('Karta ożyła! Dziękujemy za uzupełnienie danych.'); A.sound('badge'); }
        else A.toast(saved.length ? 'Dziękujemy! Ocena uwzględnia już Twoje dane.' : 'Możesz wrócić do uzupełniania w każdej chwili.');
      });
    } });
  };

  /* Wysyłka przez pośrednika (Cloudflare Worker). Zwraca 'ok', 'queued', 'rejected' albo 'error'. */
  A.sendAdd = async (rec, fromQueue) => {
    if (!A.CFG.offProxyUrl) return 'error';
    if (navigator.onLine === false) { if (!fromQueue) await A.queueAdd(rec); return 'queued'; }
    const fd = new FormData();
    fd.append('code', rec.code); fd.append('product_name', rec.name); fd.append('lang', rec.lang); fd.append('app_uuid', rec.uuid);
    fd.append('app_version', A.CFG.appVersion || '1.0');
    Object.entries(rec.photos).forEach(([k, b]) => fd.append('photo_' + k, b, k + '.jpg'));
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 60000);
    try {
      const r = await fetch(A.CFG.offProxyUrl.replace(/\/$/, '') + '/product', { method: 'POST', body: fd, signal: ctrl.signal });
      let j = {}; try { j = await r.json(); } catch (e) { }
      if (r.ok && j.ok) {
        A.award('product_added', { code: rec.code });
        if (A.discSubmit) A.discSubmit(rec.code, rec.name, rec.checks || { barcode: 'none' });
        if (fromQueue) A.toast(`Wysłaliśmy zapisany produkt „${rec.name}”. Dziękujemy, odkrywco!`);
        return 'ok';
      }
      if (r.status === 409) return 'exists';
      if (r.status >= 400 && r.status < 500 && r.status !== 429) return 'rejected';
      if (!fromQueue) await A.queueAdd(rec);
      return 'queued';
    } catch (e) {
      if (!fromQueue) await A.queueAdd(rec);
      return 'queued';
    } finally { clearTimeout(t); }
  };
  // Kolejka w IndexedDB (zdjęcia są za duże na localStorage).
  function idb() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('no idb'));
      const r = indexedDB.open('dcn', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('adds', { keyPath: 'id' });
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  A.queueAdd = async rec => { try { const db = await idb(); await new Promise((res, rej) => { const tx = db.transaction('adds', 'readwrite'); tx.objectStore('adds').put(rec); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); } catch (e) { } };
  A.flushAdds = async () => {
    if (!A.CFG.offProxyUrl || navigator.onLine === false) return;
    let db; try { db = await idb(); } catch (e) { return; }
    const all = await new Promise(res => { const out = []; const tx = db.transaction('adds', 'readonly'); const c = tx.objectStore('adds').openCursor(); c.onsuccess = () => { const cu = c.result; if (cu) { out.push(cu.value); cu.continue(); } else res(out); }; c.onerror = () => res(out); });
    for (const rec of all) {
      const r = await A.sendAdd(rec, true);
      if (r === 'ok' || r === 'rejected' || r === 'exists') await new Promise(res => { const tx = db.transaction('adds', 'readwrite'); tx.objectStore('adds').delete(rec.id); tx.oncomplete = res; tx.onerror = res; });
    }
  };

  /* ---------- Ocena składu z etykiety (OCR) ---------- */
  function ingredientForm(code, kind) {
    return `<div class="stack" id="ingCard" data-code="${esc(code)}">
      <div class="row" role="group" aria-label="Rodzaj produktu"><button class="cat-tab" type="button" data-kind="food" aria-pressed="${kind === 'food'}">Jedzenie</button><button class="cat-tab" type="button" data-kind="cosmetic" aria-pressed="${kind === 'cosmetic'}">Kosmetyk</button></div>
      <span class="btn btn-white btn-sm filebtn" style="align-self:flex-start"><svg><use href="#i-photo"/></svg>Zdjęcie składu<input type="file" id="ingPhoto" accept="image/*" capture="environment" aria-label="Zrób zdjęcie składu"></span>
      <div id="ocrBox" hidden class="stack"><p class="small muted" id="ocrMsg">Odczytuję tekst ze zdjęcia…</p><div class="progress"><i id="ocrBar"></i></div></div>
      <label class="small" for="ingText" style="font-weight:800">Skład</label>
      <textarea class="field" id="ingText" placeholder="np. mąka pszenna, cukier, olej palmowy, emulgator: lecytyny (z soi), E471…"></textarea>
      <input class="field" id="ingName" placeholder="Nazwa produktu (opcjonalnie)" maxlength="80">
      <button class="btn btn-green" type="button" data-act="rate-ing">Oceń skład</button>
      <p class="msg" id="ingMsg" role="status"></p>
      <p class="small muted">Odczyt ze zdjęcia działa w Twoim telefonie i bywa niedokładny. Popraw tekst przed oceną.</p></div>`;
  }
  A.ingKind = btn => btn.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
  A.runOcr = async file => {
    const box = A.$('ocrBox'), bar = A.$('ocrBar'), msg = A.$('ocrMsg');
    box.hidden = false; bar.style.width = '4%'; msg.textContent = 'Pobieram moduł odczytu tekstu (pierwszy raz trwa dłużej)…';
    try {
      await A.loadScript([TESSERACT_URL]);
      const kind = document.querySelector('#ingCard [aria-pressed="true"]').dataset.kind;
      const img = await A.downscale(file, 2000);
      const worker = await Tesseract.createWorker(kind === 'cosmetic' ? 'eng' : 'pol', 1, { logger: m => { if (m.status === 'recognizing text') { bar.style.width = Math.round(10 + m.progress * 90) + '%'; msg.textContent = 'Odczytuję tekst ze zdjęcia…'; } } });
      const { data } = await worker.recognize(img);
      await worker.terminate();
      let s = String(data.text || '').replace(/\r/g, '').replace(/-\n/g, '').replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
      const i = fold(s).search(/sklad|ingredients|ingredienti|zutaten/); if (i > 0) s = s.slice(i);
      A.$('ingText').value = s; bar.style.width = '100%';
      msg.textContent = s ? 'Gotowe. Sprawdź i popraw tekst, potem kliknij „Oceń skład”.' : 'Nie udało się odczytać tekstu. Zrób ostrzejsze zdjęcie z bliska albo wpisz skład ręcznie.';
    } catch (e) { msg.textContent = 'Odczyt ze zdjęcia nie zadziałał. Wpisz skład ręcznie.'; }
  };
  A.rateIngredients = () => {
    const card = A.$('ingCard'); if (!card) return;
    const code = card.dataset.code, text = A.$('ingText').value.trim();
    const kind = card.querySelector('[aria-pressed="true"]').dataset.kind;
    if (text.length < 8) { A.$('ingMsg').textContent = 'Wpisz skład z opakowania, przynajmniej kilka składników.'; A.$('ingText').focus(); return; }
    const base = cur && cur.prod && cur.prod.code === code && !cur.missing ? cur.prod : {};
    const prod = { code, kind, source: 'local', name: A.$('ingName').value.trim().slice(0, 80) || base.name || '', brand: base.brand || '', quantity: '', image: base.image || '', nutriscore: kind === 'food' ? base.nutriscore || '' : '', nova: kind === 'food' ? base.nova || null : null, additiveTags: null, allergens: base.allergens || [], traces: base.traces || [], analysis: [], labels: [], ingredients: text.slice(0, 5000), drink: false, category: '', categories: base.categories || [], nutriments: base.nutriments || {} };
    const local = A.store.get('local', {}); local[code] = prod;
    const keys = Object.keys(local); if (keys.length > 50) delete local[keys[0]];
    A.store.set('local', local);
    show(prod, { local: true });
  };
  A.manualIng = () => {
    if (!cur || !cur.prod) return;
    const slot = A.$('ingSlot'); if (!slot) return;
    slot.innerHTML = ingredientForm(cur.prod.code, cur.prod.kind || 'food');
    A.$('ingText').value = cur.prod.ingredients || ''; A.$('ingName').value = cur.prod.name || '';
    A.$('ingText').focus();
  };

  /* ---------- Zgadywanie ---------- */
  A.doGuess = v => {
    if (!cur || cur.guess !== null) return;
    if (v === 'skip') { cur.guess = 'skip'; A.track('zgadnij-pominiete'); render(); return; }
    const right = (v === 'good') === !!cur.pm.good;
    cur.guess = right ? 'right' : 'wrong';
    A.award(right ? 'guess_right' : 'guess_wrong', { code: cur.prod.code });
    render();
    const b = document.querySelector('#scr-product .banner'); if (b) b.setAttribute('tabindex', '-1'), b.focus();
  };
  /* Stuknięcie w domownika: jego wyjaśnienie przy tym produkcie; zapamiętujemy go jako najważniejszą osobę. */
  A.famPick = id => { if (!cur || cur.missing) return; cur.famPick = id; A.setFocus(id); A.rerenderProduct(); };
  A.rerenderProduct = () => {
    if (!cur || cur.missing) return;
    cur.pm = personalMatch(cur.prod, cur.an, A.profile);
    if (cur.guess === null) cur.guess = 'skip-silent';
    render();
  };

  /* ---------- Udostępnianie ---------- */
  A.shareProduct = async () => {
    if (!cur || !cur.prod || cur.missing) return;
    const url = location.origin + location.pathname + '#/p/' + cur.prod.code;
    const text = A.profile.noScores ? `${cur.prod.name || 'Produkt'} w aplikacji Dobre czy nie?` : `${cur.prod.name || 'Produkt'}: ${grade(cur.an.score).label.toLowerCase()} (${cur.an.score ?? '–'}/100) w aplikacji Dobre czy nie?`;
    if (navigator.share) { try { await navigator.share({ title: 'Dobre czy nie?', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text + ' ' + url); A.toast('Skopiowano link do wyniku.'); } catch (e) { A.toast(url); }
  };
  A.onExplain = d => {
    if (!cur || !cur.prod || !d.open) return;
    if (d.dataset.ev === 'why') {
      const nm = cur.prod.nutriments || {};
      const sugar = nm.sugars != null || /cukier|cukru|syrop|glukoz|fruktoz/.test(fold(cur.prod.ingredients || ''));
      A.award('explanation_opened', { code: cur.prod.code, sugar });
    } else if (d.dataset.ev === 'additive') A.award('additive_read', { key: d.dataset.key });
  };

  /* ---------- Zgłoszenia ---------- */
  const REPORT_LIMIT = 5;
  let reportCtx = null;
  A.openReport = ctx => {
    reportCtx = ctx;
    const f = A.$('reportForm'); f.reset();
    A.$('repProduct').textContent = ctx.name ? `${ctx.name} · ${ctx.code}` : `Kod ${ctx.code}`;
    if (ctx.reason) { const r = f.querySelector(`input[name="repReason"][value="${ctx.reason}"]`); if (r) r.checked = true; }
    A.$('repMsg').textContent = ''; A.$('repMsg').className = 'msg'; A.$('repSend').disabled = false; A.$('repCount').textContent = '0/1000';
    A.$('repFix').hidden = !ctx.code || ctx.local; A.$('repFixLink').href = `${ctx.source === 'obf' ? OBF : OFF}/product/${encodeURIComponent(ctx.code)}`;
    A.openDlg('reportDlg');
  };
  A.reportCurrent = () => { if (cur && cur.prod && !cur.missing) A.openReport({ code: cur.prod.code, name: cur.prod.name, source: cur.prod.source, local: cur.prod.source === 'local' }); };
  const reportText = r => `Zgłoszenie z aplikacji Dobre czy nie?\nKod: ${r.code}\nProdukt: ${r.name || '-'}\nProblem: ${r.reasonLabel}\nOpis: ${r.comment || '-'}\nE-mail do odpowiedzi: ${r.email || '-'}\nWersja metody: ${r.method}, aplikacja: ${r.app}\nData: ${r.at}`;
  async function postReport(r) {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 10000);
    try { const res = await fetch(A.CFG.reportEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(r), signal: ctrl.signal }); return res.ok; }
    catch (e) { return false; } finally { clearTimeout(t); }
  }
  A.flushReports = async () => {
    if (!A.CFG.reportEndpoint || navigator.onLine === false) return;
    const box = A.store.get('outbox', []); if (!box.length) return;
    const left = [];
    for (const r of box) { if (!(await postReport(r))) left.push(r); }
    A.store.set('outbox', left);
    if (left.length < box.length) A.toast('Wysłaliśmy zaległe zgłoszenia. Dziękujemy!');
  };
  A.submitReport = async e => {
    e.preventDefault();
    const msg = A.$('repMsg'), f = A.$('reportForm');
    const reasonEl = f.querySelector('input[name="repReason"]:checked');
    const comment = A.$('repComment').value.trim().slice(0, 1000), email = A.$('repEmail').value.trim();
    msg.className = 'msg';
    if (!reasonEl) { msg.textContent = 'Wybierz, czego dotyczy problem.'; return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = 'Ten adres e-mail wygląda na niepełny. Popraw go albo zostaw pole puste.'; A.$('repEmail').focus(); return; }
    if (reasonEl.value === 'other' && comment.length < 5) { msg.textContent = 'Opisz krótko problem, żebyśmy wiedzieli, co sprawdzić.'; A.$('repComment').focus(); return; }
    const hourAgo = Date.now() - 3600e3;
    const sent = A.store.get('reportTimes', []).filter(t => typeof t === 'number' && t > hourAgo);
    if (sent.length >= REPORT_LIMIT) { msg.textContent = 'Wysłałeś już kilka zgłoszeń w ciągu godziny. Dziękujemy! Spróbuj ponownie później.'; return; }
    const r = { code: reportCtx.code, name: reportCtx.name || '', reason: reasonEl.value, reasonLabel: reasonEl.dataset.label, comment, email, method: METHOD_VERSION, app: A.CFG.appVersion || '', at: new Date().toISOString() };
    A.$('repSend').disabled = true;
    A.store.set('reportTimes', sent.concat(Date.now()));
    A.award('report_sent', { code: r.code });
    msg.className = 'msg ok';
    if (A.CFG.reportEndpoint) {
      if (await postReport(r)) { msg.textContent = r.email ? 'Dziękujemy! Zgłoszenie dotarło. Odpiszemy, co poprawiliśmy.' : 'Dziękujemy! Zgłoszenie dotarło.'; setTimeout(() => A.closeDlg(A.$('reportDlg')), 1800); }
      else { A.store.set('outbox', A.store.get('outbox', []).concat(r).slice(-20)); msg.textContent = 'Nie udało się teraz wysłać. Zapisaliśmy zgłoszenie i wyślemy je, gdy połączenie wróci.'; setTimeout(() => A.closeDlg(A.$('reportDlg')), 2500); }
      return;
    }
    if (A.CFG.reportEmail) {
      const href = `mailto:${A.CFG.reportEmail}?subject=${encodeURIComponent('Zgłoszenie: ' + (r.name || r.code))}&body=${encodeURIComponent(reportText(r))}`;
      msg.textContent = 'Otwieramy pocztę z gotowym zgłoszeniem. Wystarczy kliknąć „Wyślij”.';
      A.$('repSend').disabled = false;
      try { location.href = href; } catch (err) { }
      return;
    }
    A.store.set('outbox', A.store.get('outbox', []).concat(r).slice(-20));
    let copied = false;
    try { await navigator.clipboard.writeText(reportText(r)); copied = true; } catch (err) { }
    msg.textContent = 'Zapisaliśmy zgłoszenie w telefonie.' + (copied ? ' Skopiowaliśmy też jego treść.' : '');
    A.$('repSend').disabled = false;
  };
  /* ---------- Zdjęcie produktu na pełny ekran ---------- */
  A.openPhoto = () => {
    if (!cur || !cur.prod) return;
    const big = A.safeImg(cur.prod.imageLarge) || A.safeImg(cur.prod.image);
    if (!big) return;
    const box = A.$('photoBox');
    box.innerHTML = `<img src="${esc(big)}" alt="Zdjęcie produktu ${esc(cur.prod.name || '')}">`;
    A.$('photoName').textContent = cur.prod.name || 'Zdjęcie produktu';
    A.openDlg('photoDlg');
  };
  A.reportPhoto = () => {
    A.closeDlg(A.$('photoDlg'));
    if (cur && cur.prod && !cur.missing) A.openReport({ code: cur.prod.code, name: cur.prod.name, source: cur.prod.source, local: cur.prod.source === 'local', reason: 'photo' });
  };
  A.retryProduct = code => { cur = null; openProduct(code); };
  A.retryCategory = () => { if (cur && cur.prod && A.$('catBody') && catLoading !== cur) { A.$('catBody').innerHTML = '<div class="sk" style="height:56px"></div>'; loadCategory(); } };
  A.findAlt = code => (cur && cur.alts || []).find(x => x.pr.code === code) || null;
})();
