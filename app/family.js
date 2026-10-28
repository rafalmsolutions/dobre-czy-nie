/* Dobre czy nie? – wersja D: profile rodziny.
   „Ja” to główny profil (A.profile). Domownicy (do 4) mają własne „Nie jem” i „Pilnuję”.
   Przy produkcie: obok zdjęcia odpowiedź dla całej rodziny, pod spodem kółka domowników (najpierw ci z problemem).
   Album i punkty liczą się według profilu „Ja”. Dane tylko w telefonie (klucz d-family). */
'use strict';
(() => {
  const A = App, esc = A.esc;
  A.FAMILY_MAX = 4;
  const load = () => {
    const raw = A.store.get('d-family', []);
    return (Array.isArray(raw) ? raw : []).filter(f => f && typeof f === 'object' && f.id).slice(0, A.FAMILY_MAX)
      .map(f => ({ id: String(f.id).slice(0, 20), name: String(f.name || 'Domownik').replace(/[<>]/g, '').slice(0, 30), p: cleanProfile(f.p) }));
  };
  A.family = load();
  A.saveFamily = () => A.store.set('d-family', A.family);
  A.familyAdd = () => {
    if (A.family.length >= A.FAMILY_MAX) return null;
    const used = new Set(A.family.map(f => f.name));
    let n = A.family.length + 2; while (used.has('Osoba ' + n)) n++;
    const f = { id: 'f' + Date.now().toString(36), name: 'Osoba ' + n, p: cleanProfile({}) };
    A.family.push(f); A.saveFamily(); return f;
  };
  A.familyRemove = id => { A.family = A.family.filter(f => f.id !== id); A.saveFamily(); if (A.focusId === id) A.setFocus('me'); A.shopOff = A.shopOff.filter(x => x !== id); A.store.set('d-shopoff', A.shopOff); };
  /* Najważniejsza osoba: jej wyjaśnienie widać, gdy produkt pasuje wszystkim. Zapamiętujemy ostatni wybór. */
  A.familyRows = () => [{ id: 'me', name: A.userName() || 'Ja', p: A.profile }].concat(A.family);
  A.focusId = A.store.get('d-focus', 'me');
  A.setFocus = id => { A.focusId = id; A.store.set('d-focus', id); };
  A.focusPerson = () => A.famOn() ? (A.activeRows().find(r => r.id === A.focusId) || A.activeRows()[0]) : null;
  /* Na zakupy: osoby wyłączone (np. dziś kupujesz tylko dla siebie albo tylko dla dziecka) nie liczą się przy produkcie ani na listach.
     Można wyłączyć każdego, także siebie, ale ktoś musi zostać. Klucz d-shopoff: lista wyłączonych id. */
  A.shopOff = (raw => Array.isArray(raw) ? raw.map(String) : [])(A.store.get('d-shopoff', []));
  A.isShopOn = id => !A.shopOff.includes(id);
  A.activeRows = () => {
    const all = A.familyRows();
    if (!A.family.length) return all;
    const on = all.filter(r => A.isShopOn(r.id));
    return on.length ? on : all;
  };
  A.offRows = () => { if (!A.family.length) return []; const on = new Set(A.activeRows().map(r => r.id)); return A.familyRows().filter(r => !on.has(r.id)); };
  /* Tryb rodziny: są domownicy i liczymy kogoś poza Tobą. Sam „Ty” = zwykły widok jednej osoby. */
  A.famOn = () => { if (!A.family.length) return false; const on = A.activeRows(); return !(on.length === 1 && on[0].id === 'me'); };
  A.setShopOn = (id, on) => {
    const ids = A.familyRows().map(r => r.id);
    if (!ids.includes(id)) return false;
    const next = on ? A.shopOff.filter(x => x !== id) : [...new Set(A.shopOff.concat(id))].filter(x => ids.includes(x));
    if (next.length >= ids.length) return false; // ktoś musi zostać
    A.shopOff = next; A.store.set('d-shopoff', next); return true;
  };
  A.shopAll = () => { A.shopOff = []; A.store.set('d-shopoff', []); };
  const profSize = p => p.watch.length + ['allergens', 'diet', 'avoid', 'custom'].reduce((s, g) => s + p[g].length, 0);
  const low = s => String(s || '').toLowerCase();

  /* Stan jednej osoby: ok (≥50%), mid (słabo albo „może zawierać”), bad (zawiera coś, czego nie je), unk (nie wiemy). */
  A.personState = (prod, an, p) => {
    const pm = personalMatch(prod, an, p), m = pm.match || {};
    if (pm.status === 'fail') return { pm, st: 'bad', why: (m.fails || []).map(f => low(f.label)).join(', ') || 'zawiera coś, czego nie je' };
    if (pm.status === 'unknown') return { pm, st: 'unk', why: (m.unknowns || []).length ? low(m.unknowns.join(', ')) + '?' : 'brak składu' };
    if (pm.status === 'traces') return { pm, st: 'mid', why: 'może zawierać ' + low((m.traces || []).join(', ')) };
    if (pm.pct == null) return { pm, st: 'unk', why: 'za mało danych' };
    if (pm.pct >= 50) return { pm, st: 'ok', why: profSize(p) ? 'pasuje' : 'bez ograniczeń' };
    const worst = (pm.rows || []).filter(r => r.kind === 'bad' && !r.exclude).sort((a, b) => (a.delta || 0) - (b.delta || 0))[0];
    return { pm, st: 'mid', why: worst ? low(worst.title) + (worst.word ? ' ' + low(worst.word) : '') : 'słabo pasuje' };
  };
  const RANK = { bad: 0, unk: 1, mid: 2, ok: 3 };
  /* Jeden wynik dla osób, dla których robisz zakupy (włączonych). Zasada: liczy się NAJNIŻSZY wynik, nie średnia –
     produkt jest tak dobry, jak dla osoby, której pasuje najsłabiej (średnia ukryłaby np. gluten u jednej osoby).
     Ten sam wynik pokazują: obręcz talerza i kwadrat z procentem na ekranie produktu, „Ostatnio sprawdzone” i lista „Wszyscy”.
     Zwraca to samo co personalMatch (pct, status, level, label) plus who: nazwa osoby z najniższym wynikiem. */
  A.groupMatch = (prod, an) => {
    const rows = A.family.length ? A.activeRows() : [{ id: 'me', name: 'Ty', p: A.profile }];
    if (rows.length === 1 || !prod || prod.kind === 'cosmetic') {
      const r = rows.length === 1 ? rows[0] : rows.find(x => x.id === 'me') || rows[0];
      return Object.assign({}, personalMatch(prod, an, r.p), { who: r.id === 'me' ? 'Ty' : r.name, n: 1 });
    }
    const nm = r => r.id === 'me' ? 'Ty' : r.name;
    const st = rows.map(r => ({ r, s: A.personState(prod, an, r.p) }));
    const bad = st.filter(x => x.s.st === 'bad'), unk = st.filter(x => x.s.st === 'unk'), known = st.filter(x => x.s.st === 'ok' || x.s.st === 'mid');
    const names = a => a.map(x => nm(x.r)).join(', ');
    const weakest = (bad.length ? bad : known).slice().sort((a, b) => (a.s.pm.pct ?? 0) - (b.s.pm.pct ?? 0))[0];
    const base = { personal: true, n: rows.length, who: weakest ? nm(weakest.r) : '' };
    if (bad.length) return Object.assign(base, { pct: weakest.s.pm.pct ?? 0, status: 'fail', level: 'bad', label: 'Nie dla: ' + names(bad) });
    if (unk.length) return Object.assign(base, { pct: null, status: 'unknown', level: 'unknown', label: 'Nie wiemy dla: ' + names(unk) });
    if (!weakest) return Object.assign(base, { pct: null, status: 'none', level: 'unknown', label: 'Za mało danych' });
    return Object.assign(base, { pct: weakest.s.pm.pct, status: 'ok', level: weakest.s.pm.level, label: known.every(x => x.s.st === 'ok') ? (rows.length === 2 ? 'Pasuje Wam obojgu' : 'Pasuje wszystkim') : 'Najsłabiej: ' + nm(weakest.r) });
  };

  /* Widok rodziny przy produkcie. pick: osoba wybrana przy tym produkcie (stuknięcie), inaczej pierwsza z problemem, inaczej najważniejsza. */
  A.familyView = (prod, an, pick) => {
    if (!A.famOn() || prod.kind === 'cosmetic') return null;
    const noScores = !!A.profile.noScores;
    const rows = A.activeRows().map((r, i) => Object.assign({ i }, r, A.personState(prod, an, r.p)))
      .sort((a, b) => RANK[a.st] - RANK[b.st] || a.i - b.i);
    // Inicjały: jedna litera, dwie, gdy się powtarza (Ania i Adam → An, Ad).
    const first = r => (r.name.trim()[0] || '?').toUpperCase();
    rows.forEach(r => {
      const twin = rows.filter(x => first(x) === first(r)).length > 1;
      r.label = r.name.trim() === 'Ja' ? 'Ja' : twin ? r.name.trim().slice(0, 2).replace(/^./, c => c.toUpperCase()) : first(r);
      r.word = r.st === 'bad' ? 'nie pasuje' : r.st === 'unk' ? 'nie wiemy' : r.pm.status === 'traces' ? 'może zawierać'
        : noScores ? (r.st === 'ok' ? 'pasuje' : 'słabo') : r.pm.pct + '%';
    });
    const n = rows.length, tone = rows[0].st, same = rows.filter(r => r.st === tone);
    let head, sub;
    if (tone === 'ok') {
      const w = rows.reduce((a, b) => b.pm.pct < a.pm.pct ? b : a);
      head = n === 1 ? 'Pasuje: ' + w.name : n === 2 ? 'Pasuje Wam obojgu' : 'Pasuje wszystkim';
      sub = n === 1 ? (noScores ? 'liczymy tylko dla tej osoby' : `${w.pm.pct}% · liczymy tylko dla tej osoby`) : noScores ? `${n} z ${n} osób` : `Najsłabiej ${w.pm.pct}% · ${w.name}`;
    } else {
      head = { bad: 'Nie dla: ', unk: 'Nie wiemy dla: ', mid: 'Uwaga: ' }[tone] + same.map(r => r.name).join(', ');
      sub = same.map(r => r.name + ': ' + r.why).join(' · ') + (tone === 'unk' ? ' · sprawdź etykietę' : '');
    }
    const picked = pick && rows.find(r => r.id === pick);
    const focus = picked || (tone !== 'ok' ? rows[0] : rows.find(r => r.id === A.focusId) || rows.find(r => r.id === 'me') || rows[0]);
    return { rows, n, tone, head, sub, focus, off: A.offRows(), level: { ok: 'great', mid: 'poor', bad: 'bad', unk: 'unknown' }[tone], gm: A.groupMatch(prod, an) };
  };

  const MARK = {
    ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', mid: '<path d="M12 6v8"/><path d="M12 19v.5"/>',
    bad: '<path d="M7 7l10 10M17 7L7 17"/>', unk: '<path d="M9 9a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 1.9v.3"/><path d="M12 18.5v.5"/>'
  };
  /* Skrót odpowiedzi dla rodziny na półkę: { t: 'bad', h: 'Nie dla: Kuba' } albo null bez domowników. */
  A.familyShort = (prod, an, fv) => {
    const v = fv || (A.famOn() && prod && prod.kind !== 'cosmetic' ? A.familyView(prod, an || analyze(prod)) : null);
    return v ? { t: v.tone, h: v.head } : null;
  };
  /* Odpowiedź dla rodziny (obok zdjęcia). */
  /* Dopełniacz imienia do „Dlaczego dla Kuby”: najczęstsze polskie końcówki. Imię z kilku słów, cyfr albo nietypowe zostaje bez zmian (null). */
  A.nameGen = name => {
    const n = String(name || '').trim();
    if (!/^[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+$/.test(n) || n.length < 3) return null;
    const lo = n.toLowerCase(), cut = k => n.slice(0, n.length - k);
    if (/(si|zi|ci|ni|dzi)a$/.test(lo)) return cut(1);            // Kasia → Kasi, Ania → Ani
    if (/ia$/.test(lo)) return cut(1) + 'i';                       // Maria → Marii
    if (/ja$/.test(lo)) return cut(2) + 'i';                       // Maja → Mai
    if (/[kgl]a$/.test(lo)) return cut(1) + 'i';                   // Olga → Olgi, Ola → Oli
    if (/a$/.test(lo)) return cut(1) + 'y';                        // Kuba → Kuby, Ewa → Ewy
    if (/i$/.test(lo)) return n + 'ego';                           // Antoni → Antoniego
    if (/y$/.test(lo)) return cut(1) + 'ego';                      // Jerzy → Jerzego
    if (/[^aeiouyąęó]ek$/.test(lo)) return cut(2) + 'ka';          // Tomek → Tomka
    if (/eł$/.test(lo)) return cut(2) + 'ła';                      // Paweł → Pawła
    const soft = { 'ś': 'sia', 'ć': 'cia', 'ń': 'nia', 'ź': 'zia' }[lo.slice(-1)];
    if (soft) return cut(1) + soft;                                // Staś → Stasia
    if (/[bcdfhjklłmnprstwz]$/.test(lo)) return n + 'a';           // Adam → Adama
    return null;
  };
  A.familyAnswerHtml = fv => fv ? `<div class="fam-ans" data-tone="${fv.tone}" role="status"><b>${esc(fv.head)}</b><span>${esc(fv.sub)}</span></div>` : '';
  /* 3.0: osoby pod talerzem jako plakietki z pełnym imieniem i kolorowym wynikiem (✕ = nie pasuje, ? = nie wiemy). Stuknięcie = wyjaśnienie dla tej osoby. */
  A.familyCirclesHtml = fv => {
    if (!fv) return '';
    const noScores = !!A.profile.noScores;
    const note = A.offNoteHtml();
    return `${note ? '<div class="fam-box">' : ''}<div class="fam-circles" role="group" aria-label="Domownicy">${fv.rows.map(r => {
      const on = fv.focus && fv.focus.id === r.id, has = (r.st === 'ok' || r.st === 'mid') && r.pm && r.pm.pct != null;
      const val = r.st === 'bad' ? '✕' : r.st === 'unk' ? '?' : noScores || !has ? (r.st === 'ok' ? '✓' : '!') : r.pm.pct + '%';
      const col = r.st === 'bad' ? A.scoreColor(0) : r.st === 'unk' ? '#8A8C91' : has && !noScores ? A.scoreColor(r.pm.pct) : r.st === 'ok' ? A.scoreColor(100) : A.scoreColor(55);
      return `<button type="button" class="fam-c${on ? ' on' : ''}" data-st="${r.st}" data-act="fam-focus" data-id="${esc(r.id)}" aria-pressed="${on}" aria-label="${esc(r.name)}: ${esc(r.st === 'bad' ? 'nie pasuje, ' + r.why : r.st === 'unk' ? 'nie wiemy, ' + r.why : r.word)}${on ? ', wyjaśnienie poniżej' : ''}"><span class="fam-pill" style="background:${col}">${esc(val)}</span><span class="fam-nm">${esc(r.name)}</span></button>`;
    }).join('')}</div>${note ? note + '</div>' : ''}`;
  };
  /* Kogo teraz nie liczymy, z szybkim powrotem do wszystkich. */
  A.offNoteHtml = () => {
    const off = A.offRows();
    return off.length ? `<p class="small muted fam-off" id="famOff">Nie liczymy: ${esc(off.map(r => r.id === 'me' ? 'Ciebie' : r.name).join(', '))}. <button type="button" class="linkbtn small" data-act="shop-all">Licz wszystkich</button></p>` : '';
  };
  /* Zamiennik, który pasuje całej rodzinie (z produktów tej samej kategorii). */
  A.familyAltPick = (prod, list) => {
    let best = null;
    (list || []).forEach(x => {
      if (!x || !x.code || x.code === prod.code || !x.name) return;
      const an = analyze(x);
      if (an.score == null) return;
      let min = 101;
      for (const r of A.activeRows()) {
        const s = A.personState(x, an, r.p);
        if (s.st !== 'ok') return;
        min = Math.min(min, s.pm.pct);
      }
      const my = A.inMyStore ? !!A.inMyStore(x) : false; // najpierw produkt z Twojego sklepu
      if (!best || my > best.my || (my === best.my && min > best.min)) best = { pr: x, min, my };
    });
    return best;
  };
  A.familyAltHtml = (fv, alt) => {
    if (!fv || !alt) return '';
    const n = fv.n, img = A.safeImg(alt.pr.image);
    return `<a class="fam-alt" href="#/p/${esc(alt.pr.code)}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<span class="fam-alt-ok" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>'}
      <span class="grow"><small>${n === 1 ? 'PASUJE: ' + esc(fv.rows[0].name.toUpperCase()) : n === 2 ? 'PASUJE WAM OBOJGU' : 'PASUJE WSZYSTKIM'} W TEJ KATEGORII</small><b>${esc(alt.pr.name)}</b><span>${esc([alt.pr.brand, alt.my ? 'jest w: ' + A.storeLabel(A.inMyStore(alt.pr)) : '', n === 1 ? (A.profile.noScores ? '' : alt.min + '%') : `${n} z ${n}` + (A.profile.noScores ? '' : ` · najsłabiej ${alt.min}%`)].filter(Boolean).join(' · '))}</span></span>
      <svg class="fam-alt-go" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></a>`;
  };
})();
