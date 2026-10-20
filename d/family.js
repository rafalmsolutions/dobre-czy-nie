/* Dobre czy nie? – wersja D: profile rodziny.
   „Ja” to główny profil (A.profile). Domownicy (do 4) mają własne „Nie jem” i „Pilnuję”.
   Przy produkcie każdy dostaje osobny werdykt. Album i punkty liczą się według profilu „Ja”. Dane tylko w telefonie (klucz d-family). */
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
  /* Kto jest najważniejszy przy produkcie: jego wyjaśnienie („rachunek”) widać pod zdjęciem. Zapamiętujemy wybór. */
  A.familyRows = () => [{ id: 'me', name: A.userName() || 'Ja', p: A.profile }].concat(A.family);
  A.focusId = A.store.get('d-focus', 'me');
  A.setFocus = id => { A.focusId = id; A.store.set('d-focus', id); };
  A.focusPerson = () => A.family.length ? (A.familyRows().find(r => r.id === A.focusId) || A.familyRows()[0]) : null;
  const profSize = p => p.watch.length + ['allergens', 'diet', 'avoid', 'custom'].reduce((s, g) => s + p[g].length, 0);

  /* Werdykt dla jednej osoby: krótko, bez liczb, gdy wykluczenie. */
  A.personVerdict = (prod, an, p) => {
    const pm = personalMatch(prod, an, p);
    if (pm.status === 'fail') return { cls: 'bad', text: 'Nie pasuje: ' + pm.match.fails.map(f => f.label.toLowerCase()).join(', ') };
    if (pm.status === 'traces') return { cls: 'warn', text: 'Może zawierać: ' + pm.match.traces.join(', ').toLowerCase() };
    if (!profSize(p)) return { cls: 'muted', text: 'bez ustawień profilu' };
    if (pm.pct == null) return { cls: 'muted', text: 'za mało danych' };
    const word = pm.pct >= 75 ? 'pasuje bardzo dobrze' : pm.pct >= 50 ? 'pasuje' : pm.pct >= 25 ? 'raczej nie' : 'słabo pasuje';
    return { cls: pm.pct >= 50 ? 'good' : 'mid', text: `${pm.pct}% · ${word}` };
  };
  /* Przy zdjęciu produktu: wszyscy domownicy od razu, bez przewijania. Stuknięcie wybiera osobę do wyjaśnienia. */
  A.familyHeroHtml = (prod, an) => {
    if (!A.family.length || prod.kind === 'cosmetic') return '';
    const focus = A.focusPerson();
    return `<div class="fam-hero" role="group" aria-label="Dopasowanie dla domowników">${A.familyRows().map(r => {
      const pm = personalMatch(prod, an, r.p), on = focus && focus.id === r.id;
      const lvl = pm.status === 'fail' ? 'bad' : pm.status === 'traces' ? 'poor' : (pm.pct != null ? pm.level : 'unknown');
      const big = pm.status === 'fail' ? '✕' : pm.status === 'traces' ? '!' : pm.pct != null ? pm.pct + (pm.personal ? '%' : '') : '?';
      const word = pm.status === 'fail' ? 'nie pasuje' : pm.status === 'traces' ? 'może zawierać' : pm.pct == null ? 'brak danych' : pm.pct >= 75 ? 'bardzo dobre' : pm.pct >= 50 ? 'pasuje' : pm.pct >= 25 ? 'słabo' : 'raczej nie';
      return `<button type="button" class="fam-hrow${on ? ' on' : ''}" data-act="fam-focus" data-id="${esc(r.id)}" aria-pressed="${on}" aria-label="${esc(r.name)}: ${esc(word)}${on ? ', wyjaśnienie poniżej' : ''}"><span class="fam-sq" data-level="${esc(lvl)}">${esc(big)}</span><span class="fam-who"><b>${esc(r.name)}</b><small>${esc(word)}</small></span></button>`;
    }).join('')}</div>`;
  };
  A.familyHtml = (prod, an) => {
    if (!A.family.length || prod.kind === 'cosmetic') return '';
    const rows = [{ name: A.userName() || 'Ja', p: A.profile }].concat(A.family);
    return `<div class="panel stack fam-box" id="familyBox"><b class="fam-h">Dla domowników</b>
      ${rows.map(r => { const v = A.personVerdict(prod, an, r.p); return `<div class="fam-row"><span class="fam-name">${esc(r.name)}</span><span class="fam-v ${v.cls}">${esc(v.text)}</span></div>`; }).join('')}
      <a class="small" href="#/profil">Zmień domowników</a></div>`;
  };
})();
