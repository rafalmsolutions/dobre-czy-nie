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
  A.familyRemove = id => { A.family = A.family.filter(f => f.id !== id); A.saveFamily(); if (A.focusId === id) A.setFocus('me'); };
  /* Najważniejsza osoba: jej wyjaśnienie widać, gdy produkt pasuje wszystkim. Zapamiętujemy ostatni wybór. */
  A.familyRows = () => [{ id: 'me', name: A.userName() || 'Ja', p: A.profile }].concat(A.family);
  A.focusId = A.store.get('d-focus', 'me');
  A.setFocus = id => { A.focusId = id; A.store.set('d-focus', id); };
  A.focusPerson = () => A.family.length ? (A.familyRows().find(r => r.id === A.focusId) || A.familyRows()[0]) : null;
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

  /* Widok rodziny przy produkcie. pick: osoba wybrana przy tym produkcie (stuknięcie), inaczej pierwsza z problemem, inaczej najważniejsza. */
  A.familyView = (prod, an, pick) => {
    if (!A.family.length || prod.kind === 'cosmetic') return null;
    const noScores = !!A.profile.noScores;
    const rows = A.familyRows().map((r, i) => Object.assign({ i }, r, A.personState(prod, an, r.p)))
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
      head = n === 2 ? 'Pasuje Wam obojgu' : 'Pasuje wszystkim';
      sub = noScores ? `${n} z ${n} osób` : `Najsłabiej ${w.pm.pct}% · ${w.name}`;
    } else {
      head = { bad: 'Nie dla: ', unk: 'Nie wiemy dla: ', mid: 'Uwaga: ' }[tone] + same.map(r => r.name).join(', ');
      sub = same.map(r => r.name + ': ' + r.why).join(' · ') + (tone === 'unk' ? ' · sprawdź etykietę' : '');
    }
    const picked = pick && rows.find(r => r.id === pick);
    const focus = picked || (tone !== 'ok' ? rows[0] : rows.find(r => r.id === A.focusId) || rows.find(r => r.id === 'me'));
    return { rows, n, tone, head, sub, focus, level: { ok: 'great', mid: 'poor', bad: 'bad', unk: 'unknown' }[tone] };
  };

  const MARK = {
    ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', mid: '<path d="M12 6v8"/><path d="M12 19v.5"/>',
    bad: '<path d="M7 7l10 10M17 7L7 17"/>', unk: '<path d="M9 9a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 1.9v.3"/><path d="M12 18.5v.5"/>'
  };
  /* Skrót odpowiedzi dla rodziny na półkę: { t: 'bad', h: 'Nie dla: Kuba' } albo null bez domowników. */
  A.familyShort = (prod, an, fv) => {
    const v = fv || (A.family.length && prod && prod.kind !== 'cosmetic' ? A.familyView(prod, an || analyze(prod)) : null);
    return v ? { t: v.tone, h: v.head } : null;
  };
  /* Odpowiedź dla rodziny (obok zdjęcia). */
  A.familyAnswerHtml = fv => fv ? `<div class="fam-ans" data-tone="${fv.tone}" role="status"><b>${esc(fv.head)}</b><span>${esc(fv.sub)}</span></div>` : '';
  /* Kółka domowników pod zdjęciem: pierścień = dopasowanie (pusty przy „nie pasuje” i „nie wiemy”), znak ✓ ! ✕ ?. */
  A.familyCirclesHtml = fv => {
    if (!fv) return '';
    const noScores = !!A.profile.noScores;
    return `<div class="fam-circles" role="group" aria-label="Domownicy">${fv.rows.map(r => {
      const on = fv.focus && fv.focus.id === r.id;
      const deg = r.st === 'bad' || r.st === 'unk' ? 0 : noScores ? 360 : Math.max(24, Math.round(r.pm.pct * 3.6));
      return `<button type="button" class="fam-c${on ? ' on' : ''}" data-st="${r.st}"${r.st === 'bad' ? ` style="--c:${A.scoreColor(0)}"` : (r.st === 'ok' || r.st === 'mid') && !noScores ? ` style="--c:${A.scoreColor(r.pm.pct)}"` : ''} data-act="fam-focus" data-id="${esc(r.id)}" aria-pressed="${on}" aria-label="${esc(r.name)}: ${esc(r.st === 'bad' ? 'nie pasuje, ' + r.why : r.st === 'unk' ? 'nie wiemy, ' + r.why : r.word)}${on ? ', wyjaśnienie poniżej' : ''}">
        <span class="fam-ring" style="--deg:${deg}deg${r.st === 'ok' || r.st === 'mid' ? (noScores ? '' : ';--c:' + A.scoreColor(r.pm.pct)) : r.st === 'bad' ? ';--c:' + A.scoreColor(0) : ''}"><span class="fam-ini${r.label.length > 1 ? ' two' : ''}">${esc(r.label)}</span><span class="fam-mark"><svg viewBox="0 0 24 24" aria-hidden="true">${MARK[r.st]}</svg></span></span>
        <span class="fam-nm">${esc(r.name)}</span><span class="fam-wd">${esc(r.word)}</span></button>`;
    }).join('')}</div>`;
  };
  /* Zamiennik, który pasuje całej rodzinie (z produktów tej samej kategorii). */
  A.familyAltPick = (prod, list) => {
    let best = null;
    (list || []).forEach(x => {
      if (!x || !x.code || x.code === prod.code || !x.name) return;
      const an = analyze(x);
      if (an.score == null) return;
      let min = 101;
      for (const r of A.familyRows()) {
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
      <span class="grow"><small>${n === 2 ? 'PASUJE WAM OBOJGU' : 'PASUJE WSZYSTKIM'} W TEJ KATEGORII</small><b>${esc(alt.pr.name)}</b><span>${esc([alt.pr.brand, alt.my ? 'jest w: ' + A.storeLabel(A.inMyStore(alt.pr)) : '', `${n} z ${n}` + (A.profile.noScores ? '' : ` · najsłabiej ${alt.min}%`)].filter(Boolean).join(' · '))}</span></span>
      <svg class="fam-alt-go" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></a>`;
  };
})();
