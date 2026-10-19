/* Dobre czy nie? 1.0 – półki zakupowe. */
'use strict';
(() => {
  const A = App, esc = A.esc;
  let ui = { adding: false, renaming: false, confirmDelete: false, msg: '', shelfMsg: '' };

  A.route('shelves', () => { ui = { adding: false, renaming: false, confirmDelete: false, msg: '', shelfMsg: '' }; render(); });

  const active = () => A.shelves.shelves.find(s => s.id === A.shelves.active) || A.shelves.shelves[0];
  function render(focusSel) {
    const sh = active(), pr = Shelf.progress(sh), groups = Shelf.grouped(sh);
    const pct = pr.total ? Math.round(pr.done / pr.total * 100) : 0;
    const tabs = A.shelves.shelves.map(s => `<button class="shelf-tab" type="button" data-act="shelf-pick" data-id="${esc(s.id)}" aria-pressed="${s.id === sh.id}">${esc(s.name)}<span class="n">${s.items.filter(i => !i.checked).length}</span></button>`).join('');
    const canAdd = A.shelves.shelves.length < Shelf.FREE_LIMIT;
    A.$('scr-shelves').innerHTML = `<div class="wrap">
      <div class="topbar"><h1>Moje półki</h1><span class="tag" style="background:#fff;border:2px solid var(--line)">${A.shelves.shelves.length} z ${Shelf.FREE_LIMIT} za darmo</span></div>
      <div class="tabs" role="group" aria-label="Wybierz półkę">${tabs}${ui.adding ? '' : `<button class="shelf-tab" type="button" data-act="shelf-new" style="border-style:dashed;background:rgba(255,255,255,.6)">+ Nowa półka</button>`}</div>
      ${ui.adding ? (canAdd ? `<form class="inline-form" id="newShelfForm" novalidate><input class="field" id="newShelfName" maxlength="30" placeholder="np. Grill w sobotę" aria-label="Nazwa nowej półki"><button class="btn btn-green btn-sm" type="submit">Dodaj</button><button class="btn btn-white btn-sm" type="button" data-act="shelf-cancel">Anuluj</button></form>`
        : `<div class="panel stack" role="status" id="shelfLimit"><div class="row">${A.mascot('crown', 60)}<div><b style="font-family:var(--f-display);font-size:1.15rem">Masz już ${Shelf.FREE_LIMIT} darmowe półki</b><p class="small muted">Więcej półek i wspólne półki z rodziną będą w wersji Plus. Na razie możesz zmienić nazwę albo wyczyścić którąś z obecnych.</p></div></div><button class="btn btn-white btn-sm" type="button" data-act="shelf-cancel" style="align-self:flex-start">Rozumiem</button></div>`) : ''}
      <p class="msg" role="status" id="shelfMsg">${esc(ui.shelfMsg)}</p>
      <div class="panel stack" id="shelfPanel">
        ${ui.renaming ? `<form class="inline-form" id="renameForm" novalidate><input class="field" id="renameInput" maxlength="30" value="${esc(sh.name)}" aria-label="Nowa nazwa półki"><button class="btn btn-green btn-sm" type="submit">Zapisz</button></form>`
          : `<div class="row"><h2 class="grow" style="font-size:1.35rem">${esc(sh.name)}</h2><button class="btn btn-white iconbtn" type="button" data-act="shelf-rename" aria-label="Zmień nazwę półki"><svg><use href="#i-edit"/></svg></button></div>`}
        ${pr.total ? `<div class="row small" style="justify-content:space-between;font-weight:800"><span>W koszyku: ${pr.done} z ${pr.total}</span><span class="muted">ułożone wg działów sklepu</span></div><span class="xp green" role="progressbar" aria-valuenow="${pr.done}" aria-valuemin="0" aria-valuemax="${pr.total}" aria-label="Postęp zakupów"><i style="width:${pct}%"></i></span>` : ''}
        <form class="inline-form" id="addItemForm" novalidate><input class="field" id="addItemInput" maxlength="60" autocomplete="off" placeholder="Dodaj rzecz, np. ziemniaki" aria-label="Dodaj rzecz do listy"><button class="btn btn-green btn-sm" type="submit" aria-label="Dodaj"><svg><use href="#i-plus"/></svg></button></form>
        <p class="msg" role="status" id="itemMsg">${esc(ui.msg)}</p>
      </div>
      ${groups.length ? `<div class="stack" style="gap:8px" id="shelfItems">${groups.map(g => `<div class="dept-h"><span class="di">${art(g.icon, 30)}</span>${esc(g.label)}</div>${g.items.map(i => `<div class="sitem${i.checked ? ' checked' : ''}" data-id="${esc(i.id)}"><label><input type="checkbox" data-act="item-toggle" data-id="${esc(i.id)}"${i.checked ? ' checked' : ''}><span class="grow"><span class="t1" style="font-weight:800;display:block">${esc(i.name)}</span>${i.code ? `<a class="small" href="#/p/${esc(i.code)}">szczegóły</a>` : ''}</span></label>${i.pct != null ? `<span class="pct ${i.pct >= 75 ? 'great' : i.pct >= 50 ? 'good' : i.pct >= 25 ? 'poor' : 'bad'} alt-score">${i.pct}%</span>` : ''}<button class="x" type="button" data-act="item-remove" data-id="${esc(i.id)}" aria-label="Usuń ${esc(i.name)}">×</button></div>`).join('')}`).join('')}</div>`
        : `<div class="empty stack" style="align-items:center">${A.mascot('smile', 70)}<b style="font-family:var(--f-display);color:var(--ink)">Pusta półka</b><span>Dodaj produkty ze skanu („Na półkę”), z listy „Najlepsze dla Ciebie” albo wpisz zwykłą rzecz, np. „ziemniaki”.</span></div>`}
      <div class="actions" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button class="btn btn-green" type="button" data-act="shelf-share" ${pr.total ? '' : 'disabled'}><svg><use href="#i-share"/></svg>Udostępnij</button>
        <button class="btn btn-white" type="button" data-act="shelf-clear" ${pr.done ? '' : 'disabled'}>Usuń kupione</button></div>
      <p class="small center" style="font-weight:700"><svg width="16" height="16" style="vertical-align:-3px;color:var(--green)"><use href="#i-check"/></svg> Odhaczysz całą listę (min. 3 rzeczy) w sklepie? <b style="color:var(--green-d)">+10 pkt</b></p>
      <div class="center">${ui.confirmDelete ? `<span class="small" style="font-weight:700">Na pewno usunąć półkę „${esc(sh.name)}” razem z listą?</span> <button class="btn btn-red btn-sm" type="button" data-act="shelf-delete-yes">Usuń</button> <button class="btn btn-white btn-sm" type="button" data-act="shelf-delete-no">Zostaw</button>` : `<button class="linkbtn small" type="button" data-act="shelf-delete">Usuń tę półkę</button>`}</div>
    </div>`;
    if (focusSel) { const f = A.$('scr-shelves').querySelector(focusSel); if (f) f.focus(); }
  }

  const ERR = { name: 'Wpisz nazwę.', duplicate: 'Taka nazwa już jest na liście.', full: 'Ta półka jest pełna (200 rzeczy). Usuń kupione albo wybierz inną.', limit: 'Masz już maksymalną liczbę darmowych półek.' };
  A.shelfAction = (act, el) => {
    if (act === 'shelf-pick') { A.shelves = Shelf.setActive(A.shelves, el.dataset.id).state; A.saveShelves(); ui.msg = ''; ui.renaming = false; ui.confirmDelete = false; render(`[data-id="${el.dataset.id}"]`); }
    else if (act === 'shelf-new') { ui.adding = true; ui.shelfMsg = ''; render(A.shelves.shelves.length < Shelf.FREE_LIMIT ? '#newShelfName' : '#shelfLimit button'); }
    else if (act === 'shelf-cancel') { ui.adding = false; render('[data-act=shelf-new]'); }
    else if (act === 'shelf-rename') { ui.renaming = true; render('#renameInput'); }
    else if (act === 'shelf-delete') { ui.confirmDelete = true; render('[data-act=shelf-delete-no]'); }
    else if (act === 'shelf-delete-no') { ui.confirmDelete = false; render('[data-act=shelf-delete]'); }
    else if (act === 'shelf-delete-yes') { const name = active().name; A.shelves = Shelf.deleteShelf(A.shelves, active().id).state; A.saveShelves(); ui.confirmDelete = false; ui.shelfMsg = ''; render(); A.toast(`Usunięto półkę „${name}”.`); }
    else if (act === 'item-toggle') {
      const r = Shelf.toggleItem(A.shelves, active().id, el.dataset.id);
      if (r.error) return;
      A.shelves = r.state; A.saveShelves();
      if (r.completed) {
        const g = A.award('list_completed', { shelfId: active().id });
        A.toast(g.gained ? 'Cała lista kupiona! Brawo!' : 'Cała lista kupiona!');
      }
      render(`[data-act=item-toggle][data-id="${el.dataset.id}"]`);
    }
    else if (act === 'item-remove') { A.shelves = Shelf.removeItem(A.shelves, active().id, el.dataset.id).state; A.saveShelves(); render('#addItemInput'); }
    else if (act === 'shelf-clear') { const r = Shelf.clearChecked(A.shelves, active().id); A.shelves = r.state; A.saveShelves(); render(); A.toast(`Usunięto ${r.removed} ${plural(r.removed, 'kupioną rzecz', 'kupione rzeczy', 'kupionych rzeczy')}.`); }
    else if (act === 'shelf-share') shareShelf();
  };
  A.shelfSubmit = form => {
    if (form.id === 'newShelfForm') {
      const r = Shelf.addShelf(A.shelves, A.$('newShelfName').value);
      if (r.error) { ui.shelfMsg = ERR[r.error] || 'Nie udało się dodać półki.'; render('#newShelfName'); return; }
      A.shelves = r.state; A.saveShelves(); ui.adding = false; ui.shelfMsg = ''; render('#addItemInput');
    } else if (form.id === 'renameForm') {
      const r = Shelf.renameShelf(A.shelves, active().id, A.$('renameInput').value);
      if (r.error) { ui.shelfMsg = ERR[r.error] || 'Nie udało się zmienić nazwy.'; render('#renameInput'); return; }
      A.shelves = r.state; A.saveShelves(); ui.renaming = false; ui.shelfMsg = ''; render('[data-act=shelf-rename]');
    } else if (form.id === 'addItemForm') {
      const val = A.$('addItemInput').value;
      const r = Shelf.addItem(A.shelves, active().id, { name: val });
      if (r.error) { ui.msg = r.error === 'duplicate' ? `„${r.item.name}” już jest na tej półce.` : (ERR[r.error] || 'Nie udało się dodać.'); render('#addItemInput'); A.$('addItemInput').value = val; return; }
      A.shelves = r.state; A.saveShelves(); ui.msg = r.restored ? `Przywrócono „${r.item.name}” na listę.` : ''; render('#addItemInput');
    }
  };
  async function shareShelf() {
    const sh = active(), text = Shelf.shareText(sh);
    let done = false;
    if (navigator.share) { try { await navigator.share({ title: sh.name, text }); done = true; } catch (e) { if (e && e.name === 'AbortError') return; } }
    if (!done) { try { await navigator.clipboard.writeText(text); done = true; A.toast('Skopiowano listę. Wklej ją w SMS-ie albo komunikatorze.'); } catch (e) { A.toast('Nie udało się udostępnić listy.'); } }
    if (done) A.award('shelf_shared', {});
  }
  A.renderShelvesIfOpen = () => { if (A.current.screen === 'shelves') render(); };
})();
