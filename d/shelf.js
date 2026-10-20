/* Dobre czy nie? – półki zakupowe (listy zakupów ułożone według działów sklepu).
   Czyste funkcje: dostają stan, zwracają nowy stan i wynik. Wymaga data.js (DEPARTMENTS) i core.js (departmentFor, fold). */
'use strict';

const Shelf = (() => {
  const FREE_LIMIT = 3, MAX_ITEMS = 200, MAX_NAME = 60, MAX_SHELF_NAME = 30;
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const key = v => fold(clean(v, MAX_NAME));
  const isObj = o => o && typeof o === 'object' && !Array.isArray(o);

  function newShelf(name) { return { id: uid(), name: clean(name, MAX_SHELF_NAME) || 'Zakupy', items: [], created: Date.now() }; }
  function newState() { const s = newShelf('Zakupy tygodniowe'); return { v: 1, active: s.id, shelves: [s] }; }

  function load(raw) {
    if (!isObj(raw) || raw.v !== 1 || !Array.isArray(raw.shelves)) return newState();
    const shelves = raw.shelves.filter(isObj).slice(0, 20).map(sh => ({
      id: typeof sh.id === 'string' && sh.id ? sh.id : uid(),
      name: clean(sh.name, MAX_SHELF_NAME) || 'Zakupy',
      created: typeof sh.created === 'number' ? sh.created : Date.now(),
      items: (Array.isArray(sh.items) ? sh.items : []).filter(isObj).map(it => ({
        id: typeof it.id === 'string' && it.id ? it.id : uid(),
        name: clean(it.name, MAX_NAME),
        code: typeof it.code === 'string' && /^\d{6,14}$/.test(it.code) ? it.code : null,
        pct: typeof it.pct === 'number' && it.pct >= 0 && it.pct <= 100 ? Math.round(it.pct) : null,
        dept: DEPARTMENTS.some(d => d.key === it.dept) ? it.dept : 'other',
        checked: it.checked === true,
        added: typeof it.added === 'number' ? it.added : Date.now()
      })).filter(it => it.name).slice(0, MAX_ITEMS)
    }));
    if (!shelves.length) return newState();
    const active = shelves.some(s => s.id === raw.active) ? raw.active : shelves[0].id;
    return { v: 1, active, shelves };
  }
  const copy = st => JSON.parse(JSON.stringify(st));
  const find = (st, id) => st.shelves.find(s => s.id === id);

  function addShelf(st, name, limit = FREE_LIMIT) {
    if (st.shelves.length >= limit) return { state: st, error: 'limit' };
    const nm = clean(name, MAX_SHELF_NAME);
    if (!nm) return { state: st, error: 'name' };
    if (st.shelves.some(s => key(s.name) === key(nm))) return { state: st, error: 'duplicate' };
    const s = copy(st), sh = newShelf(nm);
    s.shelves.push(sh); s.active = sh.id;
    return { state: s, shelf: sh };
  }
  function renameShelf(st, id, name) {
    const nm = clean(name, MAX_SHELF_NAME);
    if (!nm) return { state: st, error: 'name' };
    if (st.shelves.some(s => s.id !== id && key(s.name) === key(nm))) return { state: st, error: 'duplicate' };
    const s = copy(st), sh = find(s, id);
    if (!sh) return { state: st, error: 'missing' };
    sh.name = nm;
    return { state: s };
  }
  function deleteShelf(st, id) {
    const s = copy(st);
    s.shelves = s.shelves.filter(x => x.id !== id);
    if (!s.shelves.length) s.shelves.push(newShelf('Zakupy'));
    if (!find(s, s.active)) s.active = s.shelves[0].id;
    return { state: s };
  }
  function setActive(st, id) { if (!find(st, id)) return { state: st }; const s = copy(st); s.active = id; return { state: s }; }

  /* Dodanie rzeczy: z bazy (code, pct, categories) albo wpisanej ręcznie (sama nazwa). */
  function addItem(st, shelfId, item) {
    const name = clean(item && item.name, MAX_NAME);
    if (!name) return { state: st, error: 'name' };
    const s = copy(st), sh = find(s, shelfId || s.active);
    if (!sh) return { state: st, error: 'missing' };
    const code = item.code && /^\d{6,14}$/.test(String(item.code)) ? String(item.code) : null;
    const dup = sh.items.find(i => (code && i.code === code) || (!code && !i.code && key(i.name) === key(name)));
    if (dup) {
      if (dup.checked) { dup.checked = false; return { state: s, item: dup, restored: true }; }
      return { state: st, error: 'duplicate', item: dup };
    }
    if (sh.items.length >= MAX_ITEMS) return { state: st, error: 'full' };
    const it = {
      id: uid(), name, code,
      pct: typeof item.pct === 'number' && isFinite(item.pct) ? Math.max(0, Math.min(100, Math.round(item.pct))) : null,
      dept: departmentFor({ name, categories: item.categories }), checked: false, added: Date.now()
    };
    sh.items.push(it);
    return { state: s, item: it };
  }
  function toggleItem(st, shelfId, itemId) {
    const s = copy(st), sh = find(s, shelfId), it = sh && sh.items.find(i => i.id === itemId);
    if (!it) return { state: st, error: 'missing' };
    it.checked = !it.checked;
    return { state: s, item: it, completed: isComplete(sh) };
  }
  function removeItem(st, shelfId, itemId) {
    const s = copy(st), sh = find(s, shelfId);
    if (!sh) return { state: st, error: 'missing' };
    sh.items = sh.items.filter(i => i.id !== itemId);
    return { state: s };
  }
  function clearChecked(st, shelfId) {
    const s = copy(st), sh = find(s, shelfId);
    if (!sh) return { state: st, error: 'missing' };
    const n = sh.items.filter(i => i.checked).length;
    sh.items = sh.items.filter(i => !i.checked);
    return { state: s, removed: n };
  }
  function grouped(sh) {
    return DEPARTMENTS.map(d => ({ key: d.key, label: d.label, icon: d.icon, items: sh.items.filter(i => i.dept === d.key).sort((a, b) => (a.checked - b.checked) || (a.added - b.added)) })).filter(g => g.items.length);
  }
  function progress(sh) { return { done: sh.items.filter(i => i.checked).length, total: sh.items.length }; }
  // Pełna lista = co najmniej 3 rzeczy i wszystkie odhaczone (mniejsze listy nie dają nagrody).
  function isComplete(sh) { return sh.items.length >= 3 && sh.items.every(i => i.checked); }
  function shareText(sh) {
    const lines = [sh.name, ''];
    grouped(sh).forEach(g => {
      const open = g.items.filter(i => !i.checked);
      if (!open.length) return;
      lines.push(g.label + ':');
      open.forEach(i => lines.push('• ' + i.name));
      lines.push('');
    });
    if (lines.length === 2) lines.push('Wszystko kupione.');
    lines.push('Lista z aplikacji „Dobre czy nie?”');
    return lines.join('\n').trim();
  }
  function breakfastGood(st) {
    return st.shelves.reduce((n, sh) => n + sh.items.filter(i => i.dept === 'breakfast' && i.pct != null && i.pct >= 75).length, 0);
  }
  function hasCode(st, code) { return st.shelves.some(sh => sh.items.some(i => i.code === code && !i.checked)); }

  return { FREE_LIMIT, MAX_ITEMS, newState, load, addShelf, renameShelf, deleteShelf, setActive, addItem, toggleItem, removeItem, clearChecked, grouped, progress, isComplete, shareText, breakfastGood, hasCode };
})();

if (typeof module !== 'undefined' && typeof document === 'undefined') module.exports = Shelf;
