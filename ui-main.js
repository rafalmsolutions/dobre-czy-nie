/* Dobre czy nie? 1.0 – obsługa zdarzeń i start aplikacji. */
'use strict';
(() => {
  const A = App;
  let depth = 0; // ile razy nawigowaliśmy w tej sesji (dla przycisku „Wróć”)

  /* ---------- Kliknięcia ---------- */
  const SHELF_ACTS = ['shelf-pick', 'shelf-new', 'shelf-cancel', 'shelf-rename', 'shelf-delete', 'shelf-delete-no', 'shelf-delete-yes', 'item-remove', 'shelf-clear', 'shelf-share'];
  const PROF_ACTS = ['prof-goal', 'add-custom', 'rm-custom', 'wipe', 'wipe-yes', 'wipe-no'];
  document.addEventListener('click', e => {
    const kindBtn = e.target.closest('#ingCard [data-kind]');
    if (kindBtn) { A.ingKind(kindBtn); return; }
    if (e.target.closest('#torchBtn')) { A.toggleTorch(); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    // Pola wyboru obsługuje zdarzenie „change”.
    if (el.tagName === 'INPUT') return;
    const act = el.dataset.act, cur = A.currentProduct();
    switch (act) {
      case 'scan': A.openScanner(); break;
      case 'close-scan': A.closeScanner(); break;
      case 'back': if (depth > 0) history.back(); else A.go('#/'); break;
      case 'guess': A.doGuess(el.dataset.v); break;
      case 'shelf-add':
        if (cur && cur.prod && !cur.missing && A.addToShelf(cur.prod, cur.pm)) { el.disabled = true; el.textContent = 'Już na półce'; }
        break;
      case 'shelf-add-code': {
        const x = (A.listCache || []).find(i => i.pr.code === el.dataset.code);
        if (x && A.addToShelf(x.pr, x.pm)) { el.disabled = true; el.innerHTML = '<svg><use href="#i-check"/></svg>'; el.setAttribute('aria-label', 'Na półce'); }
        break;
      }
      case 'swap': {
        const h = A.store.get('history', []).find(i => i && i.code === el.dataset.from);
        if (h && h.alt) { A.swapTo(h.code, { name: h.alt.name, code: h.alt.code, pct: h.alt.pct, categories: h.categories }); A.render(); }
        break;
      }
      case 'swap-alt': {
        const x = A.findAlt(el.dataset.code);
        if (x && cur && cur.prod) { A.swapTo(cur.prod.code, { name: x.pr.name || 'Produkt ' + x.pr.code, code: x.pr.code, pct: x.pm.pct, categories: x.pr.categories }); el.disabled = true; el.textContent = 'Na półce'; const sb = document.querySelector('#scr-product [data-act=shelf-add]'); if (sb && !Shelf.hasCode(A.shelves, cur.prod.code)) { sb.disabled = false; sb.textContent = 'Na półkę (+5 pkt)'; } }
        break;
      }
      case 'retry': A.retryProduct(el.dataset.code); break;
      case 'retry-cat': A.retryCategory(); break;
      case 'share': A.shareProduct(); break;
      case 'report': A.reportCurrent(); break;
      case 'report-missing': A.openReport({ code: el.dataset.code, reason: 'missing', local: true }); break;
      case 'manual-ing': A.manualIng(); break;
      case 'rate-ing': A.rateIngredients(); break;
      case 'how': A.openDlg('howDlg'); break;
      case 'photo-open': A.openPhoto(); break;
      case 'photo-report': A.reportPhoto(); break;
      case 'close-dlg': A.closeDlg(el.closest('dialog')); break;
      case 'cel-ok': A.nextCelebration(); break;
      case 'clear-history': A.store.set('history', []); A.render(); A.toast('Wyczyszczono historię.'); break;
      case 'list-store': A.listStore(el.dataset.cat, el.dataset.store); break;
      case 'goal': case 'start-next': case 'start-back': case 'start-skip': A.startAction(act, el); break;
      case 'ach-cat': case 'ach-pick': A.achAction(act, el); break;
      default:
        if (SHELF_ACTS.includes(act)) A.shelfAction(act, el);
        else if (PROF_ACTS.includes(act)) A.profAction(act, el);
    }
  });

  /* ---------- Formularze ---------- */
  document.addEventListener('submit', e => {
    const f = e.target;
    switch (f.id) {
      case 'homeForm': e.preventDefault(); A.openCode(A.$('homeCode').value, A.$('homeMsg')); break;
      case 'scanForm': e.preventDefault(); { const raw = A.$('scanCode').value; if (!A.codeProblem(raw)) { A.closeScanner(true); A.$('scanCode').value = ''; } A.openCode(raw, A.$('scanMsg')); } break;
      case 'newShelfForm': case 'renameForm': case 'addItemForm': e.preventDefault(); A.shelfSubmit(f); break;
      case 'addForm': e.preventDefault(); A.submitAdd(); break;
      case 'reportForm': A.submitReport(e); break;
      case 'profileForm': A.saveProfileForm(e); break;
      default: e.preventDefault();
    }
  });
  // Enter w polu własnego składnika dodaje składnik zamiast zapisywać cały profil.
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'customInput') { e.preventDefault(); A.profAction('add-custom', e.target); return; }
    if (e.key === 'Escape') {
      if (!A.$('celebrate').hidden) { e.preventDefault(); A.nextCelebration(); return; }
      if (!A.$('scanner').hidden) { e.preventDefault(); A.closeScanner(); return; }
    }
    // Pułapka fokusu w pełnoekranowych gratulacjach.
    if (e.key === 'Tab' && !A.$('celebrate').hidden) { e.preventDefault(); const b = A.$('celebrate').querySelector('[data-act=cel-ok]'); if (b) b.focus(); }
  });

  /* ---------- Zmiany pól ---------- */
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.photo) { A.photoChosen(t); return; }
    if (t.id === 'ingPhoto') { const f = t.files && t.files[0]; t.value = ''; if (f) A.runOcr(f); return; }
    if (t.id === 'codePhoto') { const f = t.files && t.files[0]; t.value = ''; if (f) A.decodeImageFile(f); return; }
    if (t.dataset.act === 'item-toggle') { A.shelfAction('item-toggle', t); return; }
    if (t.dataset.act === 'no-guess') {
      A.settings.guess = !t.checked; A.saveSettings();
      A.toast(t.checked ? 'Nie będziemy pytać. Zmienisz to w profilu.' : 'Wróciło pytanie „Zgadnij”.');
    }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'catSearch') { A.filterCats(e.target.value); return; }
    if (e.target.id === 'repComment') A.$('repCount').textContent = e.target.value.length + '/1000';
  });
  // Rozwinięcie wyjaśnienia lub dodatku (punkty za naukę, odznaki „Czytelnik etykiet” i „Cukrowy detektyw”).
  document.addEventListener('toggle', e => { const d = e.target; if (d.tagName === 'DETAILS' && d.dataset.ev) A.onExplain(d); }, true);
  // Kliknięcie w tło okna dialogowego zamyka je.
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) A.closeDlg(d); }));

  /* ---------- Sieć ---------- */
  window.addEventListener('online', () => { A.flushReports(); A.flushAdds(); });
  window.addEventListener('offline', () => A.toast('Jesteś offline. Sprawdzone wcześniej produkty nadal działają.'));

  /* ---------- Start ---------- */
  window.addEventListener('hashchange', () => { depth++; if (!A.$('scanner').hidden) A.closeScanner(true); A.render(); });
  async function boot() {
    document.body.classList.toggle('no-scores', !!A.profile.noScores);
    const hadCfg = !!(A.cfg.levels && A.cfg.levels.levels);
    if (hadCfg) A.render();
    await A.loadConfig();
    // Ekrany zależne od konfiguracji (poziomy, odznaki) przerysowujemy po jej odświeżeniu.
    if (!hadCfg || ['home', 'progress'].includes(A.current.screen)) A.render();
    A.award('app_opened', {});
    A.flushReports(); A.flushAdds();
  }
  boot();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
  }
})();
