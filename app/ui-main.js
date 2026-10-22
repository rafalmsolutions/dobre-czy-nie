/* Dobre czy nie? 1.0 – obsługa zdarzeń i start aplikacji. */
'use strict';
(() => {
  const A = App;
  let depth = 0; // ile razy nawigowaliśmy w tej sesji (dla przycisku „Wróć”)
  let nameTimer;

  /* ---------- Zdjęcia, które się nie wczytały: zamiast pękniętego obrazka szara lupa ---------- */
  const NOIMG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#F1F2F3"/><circle cx="45" cy="45" r="17" fill="none" stroke="#C9CBD0" stroke-width="7"/><path d="M57 57l12 12" stroke="#C9CBD0" stroke-width="7" stroke-linecap="round"/></svg>');
  document.addEventListener('error', e => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG' || img.dataset.noimg) return;
    img.dataset.noimg = '1'; img.classList.add('noimg'); img.src = NOIMG;
  }, true);

  /* ---------- Kliknięcia ---------- */
  const SHELF_ACTS = ['shelf-pick', 'shelf-new', 'shelf-cancel', 'shelf-rename', 'shelf-delete', 'shelf-delete-no', 'shelf-delete-yes', 'item-remove', 'shelf-clear', 'shelf-share', 'item-qty', 'qty-minus', 'qty-plus'];
  const PROF_ACTS = ['fam-pick', 'fam-add', 'fam-del', 'fam-del-no', 'fam-del-yes', 'prof-goal', 'add-custom', 'rm-custom', 'wipe', 'wipe-yes', 'wipe-no'];
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
      case 'complete': A.startComplete(); break;
      case 'fill-go': A.fillAuto = el.dataset.code; A.fillFrom = el.dataset.code; break; // link prowadzi dalej do produktu
      case 'photo-report': A.reportPhoto(); break;
      case 'close-dlg': A.closeDlg(el.closest('dialog')); break;
      case 'cel-ok': A.nextCelebration(); break;
      case 'rw-open': case 'rw-close': A.rewardAction(act); break;
      case 'store-tag': case 'store-skip': A.storeAction(act, el); break;
      case 'reveal-flip': case 'reveal-close': case 'reveal-page': case 'reveal-album': A.revealAction(act, el); break;
      case 'share-page': A.sharePage(el.dataset.k); break;
      case 'gal-demo': A.galleryDemo(el); break;
      case 'disc-vote': A.discVote(el); break;
      case 'prof-of': if (A.editProfileOf) A.editProfileOf(el.dataset.id); break;
      case 'shop-on': {
        const id = el.dataset.id, on = el.getAttribute('aria-checked') !== 'true';
        if (!A.setShopOn(id, on)) { A.toast('Przynajmniej jedna osoba musi zostać włączona.'); break; }
        A.render(); { const b = document.querySelector(`[data-act=shop-on][data-id="${id}"]`); if (b) b.focus(); } break;
      }
      case 'shop-all': A.shopAll(); if (A.current.screen === 'product' && A.rerenderProduct) A.rerenderProduct(); else A.render(); break;
      case 'fam-focus': if (A.famPick) A.famPick(el.dataset.id); { const b = document.querySelector(`#scr-product [data-act=fam-focus][data-id="${el.dataset.id}"]`); if (b) b.focus(); } break;
      case 'clear-history': A.store.set('history', []); A.render(); A.toast('Wyczyszczono historię.'); break;
      case 'list-store': A.listStore(el.dataset.cat, el.dataset.store); break;
      case 'list-who': A.listWhoSet(el.dataset.cat, el.dataset.store, el.dataset.who); break;
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
      case 'scanForm': e.preventDefault(); { const raw = A.$('scanCode').value; if (!A.codeProblem(raw)) { A.closeScanner(true); A.$('scanCode').value = ''; } A.openCode(raw, A.$('scanMsg')); } break;
      case 'newShelfForm': case 'renameForm': case 'addItemForm': case 'qtyForm': e.preventDefault(); A.shelfSubmit(f); break;
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
      if (!A.$('reveal').hidden) { e.preventDefault(); A.closeReveal(); return; }
    }
    // Pułapka fokusu w pełnoekranowych gratulacjach.
    // Pułapka fokusu w nakładce nowej karty.
    if (e.key === 'Tab' && !A.$('reveal').hidden && A.$('celebrate').hidden) {
      const f = [...A.$('reveal').querySelectorAll('button, a[href]')]; if (!f.length) return;
      const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); return;
    }
    if (e.key === 'Tab' && !A.$('celebrate').hidden) { e.preventDefault(); const b = A.$('celebrate').querySelector('[data-act=cel-ok]'); if (b) b.focus(); }
  });

  /* ---------- Zmiany pól ---------- */
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.photo) { A.photoChosen(t); return; }
    if (t.id === 'ingPhoto') { const f = t.files && t.files[0]; t.value = ''; if (f) A.runOcr(f); return; }
    if (t.id === 'codePhoto') { const f = t.files && t.files[0]; t.value = ''; if (f) A.decodeImageFile(f); return; }
    if (t.dataset.act === 'item-toggle') { A.shelfAction('item-toggle', t); return; }
    if (t.closest('#profileForm') && t.id !== 'customInput') { A.profAutoSave(); return; }
    if (t.dataset.act === 'no-guess') {
      A.settings.guess = !t.checked; A.saveSettings();
      A.toast(t.checked ? 'Nie będziemy pytać. Zmienisz to w profilu.' : 'Wróciło pytanie „Zgadnij”.');
    }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'catSearch') { A.filterCats(e.target.value); return; }
    if (e.target.id === 'profName') { clearTimeout(nameTimer); nameTimer = setTimeout(A.profAutoSave, 500); return; }
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
    // Ekran startowy, produkt, półki itd. nie potrzebują konfiguracji punktów – rysujemy je od razu, bez czekania na sieć.
    const h = location.hash.replace(/^#?\/?/, '');
    const needsCfg = (h === '' && A.store.get('onboarded', false)) || h === 'postepy';
    if (hadCfg || !needsCfg) A.render();
    await A.loadConfig();
    // Ekrany zależne od konfiguracji (poziomy, odznaki) przerysowujemy po jej odświeżeniu.
    if (!hadCfg || ['home', 'progress'].includes(A.current.screen)) A.render();
    A.award('app_opened', {});
    A.trackWeek(); A.trackTester();
    A.flushReports(); A.flushAdds();
    if (A.discSync) A.discSync();
  }
  boot();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
  }
})();
