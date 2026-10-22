/* Dobre czy nie? – wersja D: odkrywcy.
   - Po dodaniu produktu zgłaszamy go do pośrednika (/disc/submit). Kolejne osoby, które zeskanują go aparatem,
     dostają pytanie „Czy trzymasz ten produkt?” (+5 pkt za „tak” albo „nie”, +2 za „nie mam pewności”).
   - 2 potwierdzenia → złota karta Odkrycie i +50 pkt (+100, gdy produkt był „poszukiwany”). Zaufany odkrywca dostaje je od razu.
   - Za każdą osobę, która później sprawdzi Twój produkt: +1 pkt (do 100 na produkt).
   - Kody, których nie ma w bazie, zgłaszamy anonimowo (/disc/miss) – z nich powstaje lista „Poszukiwane”.
   Stan w telefonie: klucz d-disc. Bez pośrednika (offProxyUrl) wszystko to jest wyłączone. */
'use strict';
(() => {
  const A = App, esc = A.esc;
  Object.assign(A.ALBUM_RULES, {
    product_added: { points: 10, dailyCap: 50, oncePerBarcode: true },
    discovery_confirmed: { points: 50, oncePerBarcode: true }, discovery_wanted: { points: 100, oncePerBarcode: true },
    discovery_view: { points: 1, oncePerBarcode: true, dailyCap: 100 },
    disc_vote: { points: 5, dailyCap: 50, oncePerBarcode: true }, disc_unsure: { points: 2, dailyCap: 20, oncePerBarcode: true },
    disc_trusted: { points: 100, oncePerBarcode: true }, disc_guardian: { points: 100, oncePerBarcode: true }
  });
  const VIEW_MAX = 100;
  const proxy = () => (A.CFG.offProxyUrl || '').replace(/\/$/, '');
  A.discOn = () => !!proxy();
  /* „Usuń wszystkie moje dane”: na serwerze kasujemy głosy, odwiedziny i liczniki tego urządzenia; dodane produkty zostają bez powiązania z nim. */
  A.discForget = () => Promise.race([api('/disc/forget', { device: A.appUuid() }), new Promise(r => setTimeout(() => r(null), 4000))]);
  const load = () => { const d = A.store.get('d-disc', null); return d && typeof d === 'object' && d.items ? d : { items: {}, trusted: false, confirmed: 0, rejected: 0, nick: '' }; };
  A.disc = load();
  const save = () => A.store.set('d-disc', A.disc);

  async function api(path, fields) {
    if (!proxy() || navigator.onLine === false) return null;
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 12000);
    try {
      let r;
      if (fields) { const fd = new FormData(); Object.entries(fields).forEach(([k, v]) => fd.append(k, v)); r = await fetch(proxy() + path, { method: 'POST', body: fd, signal: ctrl.signal }); }
      else r = await fetch(proxy() + path, { signal: ctrl.signal });
      const j = await r.json().catch(() => null);
      return j ? Object.assign({ status: r.status }, j) : null;
    } catch (e) { return null; } finally { clearTimeout(t); }
  }
  A.discApi = api;

  /* Ostatni kod odczytany aparatem: o potwierdzenie pytamy tylko po prawdziwym skanie, nie po wpisaniu kodu. */
  A.lastCameraScan = null;
  A.markCameraScan = code => { A.lastCameraScan = { code, at: Date.now() }; };
  const viaCamera = code => !!(A.lastCameraScan && A.lastCameraScan.code === code && Date.now() - A.lastCameraScan.at < 120000);

  A.discSubmit = async (code, name, checks) => {
    A.disc.items[code] = Object.assign(A.disc.items[code] || {}, { name, at: Date.now(), status: 'pending', views: 0, paidViews: 0 });
    save();
    const r = await api('/disc/submit', { device: A.appUuid(), code, name, nick: A.disc.nick || '', checks: JSON.stringify(checks || {}) });
    if (r && r.ok) { Object.assign(A.disc.items[code], { status: r.status, wanted: !!r.wanted, spot: !!r.spot }); save(); payout(); }
    return r;
  };
  /* Nagrody za potwierdzone odkrycia i za osoby, które sprawdziły produkt. */
  function payout() {
    Object.entries(A.disc.items).forEach(([code, it]) => {
      if (it.status === 'confirmed' && !it.paid) {
        it.paid = true;
        A.award(it.wanted ? 'discovery_wanted' : 'discovery_confirmed', { code });
        A.toast(`Twoje odkrycie „${it.name}” jest potwierdzone! Złota karta Odkrycie czeka w Twoich odkryciach.`, '<a href="#/odkrycia">Zobacz</a>');
      }
      if (it.status === 'rejected' && !it.rejectedSeen) {
        it.rejectedSeen = true;
        A.toast(`Dwie osoby zgłosiły, że „${it.name}” to inny produkt. Wpis jest ukryty.`);
      }
      const due = Math.min(it.views || 0, VIEW_MAX) - (it.paidViews || 0);
      if (it.status !== 'rejected' && due > 0) { for (let i = 0; i < due; i++) { it.paidViews = (it.paidViews || 0) + 1; A.award('discovery_view', { code: code + '#' + it.paidViews }); } }
    });
    save();
  }
  let synced = 0;
  A.discSync = async (force) => {
    if (!A.discOn() || (!force && Date.now() - synced < 5 * 60e3)) return;
    synced = Date.now();
    const r = await api('/disc/mine?device=' + encodeURIComponent(A.appUuid()));
    if (!r || !r.ok) return;
    const before = A.disc.level || 'new';
    Object.assign(A.disc, { trusted: !!r.trusted, confirmed: r.confirmed || 0, rejected: r.rejected || 0, level: r.level || (r.trusted ? 'trusted' : 'new'), streak: r.streak || 0, need: r.need || 0 });
    A.disc.best = Math.max(A.disc.best || 0, A.disc.streak);
    const rank = { new: 0, trusted: 1, guardian: 2 };
    if (rank[A.disc.level] > rank[before]) {
      if (A.disc.level === 'guardian') { A.award('disc_guardian', { code: 'guardian' }); A.toast('Zostałeś strażnikiem bazy! Twoje potwierdzenia liczą się teraz podwójnie.', '<a href="#/odkrycia">Zobacz</a>'); }
      else { A.award('disc_trusted', { code: 'trusted' }); A.toast('Zostałeś zaufanym odkrywcą! Twoje produkty trafiają do albumu od razu, bez czekania.', '<a href="#/odkrycia">Zobacz</a>'); }
    } else if (rank[A.disc.level] < rank[before]) A.toast('Jeden z Twoich produktów został odrzucony w kontroli, więc znów czekają na potwierdzenie. Seria liczy się od nowa.');
    (r.items || []).forEach(x => { const it = A.disc.items[x.code] = Object.assign(A.disc.items[x.code] || { paidViews: 0 }, { name: x.name, status: x.status, views: x.views, wanted: !!x.wanted, at: x.at }); if (!it.name) it.name = x.code; });
    save();
    payout();
  };

  /* Zgłoszenie braku produktu (anonimowe: kod i losowy identyfikator aplikacji). */
  const missed = new Set();
  A.discMiss = code => { if (A.discOn() && !missed.has(code)) { missed.add(code); api('/disc/miss', { device: A.appUuid(), code }); } };

  /* Na ekranie produktu: pytanie „Czy trzymasz ten produkt?”. */
  let askCache = null; // { code, html } – ekran produktu bywa rysowany ponownie (np. po „Zgadnij”)
  A.discFill = code => { const el = A.$('discBox'); if (el && askCache && askCache.code === code) el.innerHTML = askCache.html; };
  A.discAsk = async prod => {
    if (!A.discOn() || !prod || !prod.code) return;
    askCache = null;
    const camera = viaCamera(prod.code);
    const r = await api(`/disc/product?code=${prod.code}&device=${encodeURIComponent(A.appUuid())}`);
    if (!r || !r.found || cur() !== prod.code) return;
    if (r.status === 'rejected') { askCache = { code: prod.code, html: '<div class="panel disc-box rej"><b>Ten wpis zgłoszono jako błędny</b><p class="small">Dwie osoby napisały, że pod tym kodem jest inny produkt. Sprawdź etykietę.</p></div>' }; A.discFill(prod.code); return; }
    if (!r.canVote || !camera) return;
    const img = A.safeImg(prod.imageLarge || prod.image);
    askCache = { code: prod.code, html: `<div class="panel stack disc-box" id="discAsk"><span class="disc-k">NOWY W BAZIE · CZEKA NA POTWIERDZENIE</span>
      <b class="disc-h">Czy trzymasz ten produkt?</b>
      <p class="small">Dodał${r.nick ? `(a) go <b>${esc(r.nick)}</b>` : ' go inny odkrywca'}. Porównaj nazwę${img ? ' i zdjęcie' : ''} z opakowaniem w ręce.</p>
      <div class="disc-prod">${img ? `<img src="${esc(img)}" alt="Zdjęcie przodu z bazy">` : ''}<b>${esc(r.name || prod.name || '')}</b></div>
      <button class="btn btn-green btn-block" type="button" data-act="disc-vote" data-v="yes">Tak, to ten sam</button>
      <div class="disc-row"><button class="btn btn-white" type="button" data-act="disc-vote" data-v="no">Nie, to inny</button><button class="btn btn-white" type="button" data-act="disc-vote" data-v="unsure">Nie mam pewności</button></div>
      <p class="small muted center">+5 pkt za „tak” lub „nie”, +2 za „nie mam pewności”. Nagroda jest za Twój czas, nie za wynik.${A.disc.level === 'guardian' ? ' Jako strażnik bazy liczysz się podwójnie.' : ''}</p></div>` };
    A.discFill(prod.code);
  };
  A.discVote = async btn => {
    const box = btn.closest('#discAsk'), code = cur();
    if (!box || !code) return;
    box.querySelectorAll('button').forEach(b => { b.disabled = true; });
    const vote = btn.dataset.v, r = await api('/disc/vote', { device: A.appUuid(), code, vote });
    if (!r || !r.ok) { box.querySelectorAll('button').forEach(b => { b.disabled = false; }); A.toast(r && r.error === 'limit' ? 'Dziś oceniłeś już 10 produktów. Dziękujemy! Wróć jutro.' : 'Nie udało się wysłać odpowiedzi. Spróbuj za chwilę.'); return; }
    A.award(vote === 'unsure' ? 'disc_unsure' : 'disc_vote', { code });
    const t = vote === 'yes' ? (r.status === 'confirmed' ? 'Dzięki! Produkt potwierdzony.' : 'Dzięki! Potrzebna jeszcze jedna osoba.') : vote === 'no' ? 'Zgłoszenie przyjęte' : 'W porządku';
    const d = vote === 'no' ? 'Po dwóch takich zgłoszeniach wpis znika, a autor traci nagrodę. Masz właściwy produkt? Możesz go uzupełnić w bazie.' : vote === 'unsure' ? 'Zapytamy kogoś innego.' : r.status === 'confirmed' ? 'Odkrywca dostaje złotą kartę, a produkt jest już pewny dla wszystkich.' : 'Gdy potwierdzi go jeszcze jedna osoba, odkrywca dostanie złotą kartę.';
    askCache = { code, html: `<div class="panel stack disc-box done${vote === 'no' ? ' rej' : ''}" role="status"><b class="disc-h">${esc(t)}</b><p class="small">${esc(d)}</p></div>` };
    A.discFill(code);
  };
  const cur = () => { const m = location.hash.match(/^#\/p\/(\d{8,14})/); return m ? m[1] : null; };

  /* ---------- Ekran „Twoje odkrycia” ---------- */
  const STATUS = { pending: ['czeka na potwierdzenie', 'pending'], confirmed: ['potwierdzone', 'ok'], rejected: ['odrzucone', 'rej'] };
  A.route('discoveries', () => {
    const el = A.$('scr-discoveries');
    const render = wanted => {
      const items = Object.entries(A.disc.items).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
      const views = items.reduce((s, [, it]) => s + (it.views || 0), 0), conf = items.filter(([, it]) => it.status === 'confirmed').length;
      el.innerHTML = `<div class="wrap">
        <div class="topbar"><a class="btn btn-white iconbtn" href="#/album" aria-label="Wróć do albumu"><svg><use href="#i-back"/></svg></a><span class="grow small muted" style="font-weight:800">Album · strona specjalna</span>${A.hudPill()}</div>
        <h1 class="al-h"><span class="w-light">Twoje</span> <span class="w-bold">odkrycia</span></h1>
        ${(() => { const lv = A.disc.level || (A.disc.trusted ? 'trusted' : 'new'), st = A.disc.streak || 0;
          const L = { new: ['Nowy odkrywca', `Każdy Twój produkt potwierdzają 2 kolejne osoby. Po 5 potwierdzonych z rzędu zostaniesz zaufanym odkrywcą.`, st, 5],
            trusted: ['Zaufany odkrywca', 'Twoje produkty trafiają do albumu od razu, bez czekania. Mniej więcej co 10. przechodzi wyrywkową kontrolę: odrzucenie zeruje serię. Po 15 z rzędu zostaniesz strażnikiem bazy.', st, 15],
            guardian: ['Strażnik bazy', 'Twoje produkty trafiają do albumu od razu, a Twoje odpowiedzi „czy to ten produkt?” liczą się podwójnie. Wyrywkowa kontrola obowiązuje nadal.', st, 0] }[lv];
          return `<div class="disc-trust${lv !== 'new' ? ' on' : ''}"><span class="disc-shield" aria-hidden="true">${A.dIcon('healthy', 22)}</span><span class="stack" style="gap:4px;flex:1"><b>${L[0]}</b><span class="small">${L[1]}</span>${L[3] ? `<span class="disc-steps"><span class="xp"><i style="width:${Math.min(100, L[2] / L[3] * 100)}%"></i></span><span class="small">${L[2]} z ${L[3]} potwierdzonych z rzędu</span></span>` : ''}</span></div>`; })()}
        <div class="al-stats three"><div><b>${items.length}</b><span>dodanych</span></div><div><b>${conf}</b><span>potwierdzonych</span></div><div><b>${views}</b><span>${plural(views, 'osoba sprawdziła', 'osoby sprawdziły', 'osób sprawdziło')}</span></div></div>
        ${items.length ? `<div class="stack" style="gap:10px">${items.map(([code, it]) => `<a class="disc-item ${STATUS[it.status] ? STATUS[it.status][1] : 'pending'}" href="#/p/${esc(code)}"><span class="disc-ic" aria-hidden="true">${it.status === 'confirmed' ? '★' : it.status === 'rejected' ? '!' : '…'}</span><span class="grow stack" style="gap:2px"><b>${esc(it.name || code)}</b><span class="small">${esc((STATUS[it.status] || STATUS.pending)[0])}${it.spot && it.status === 'pending' ? ' (wyrywkowa kontrola)' : ''}${it.wanted ? ' · poszukiwany (+100)' : ''}${it.views ? ` · sprawdziło ${it.views} ${plural(it.views, 'osoba', 'osoby', 'osób')}` : ''}</span></span></a>`).join('')}</div>`
          : '<div class="empty stack"><b>Nie dodałeś jeszcze żadnego produktu</b><span>Gdy zeskanujesz coś, czego nie ma w bazie, zrób 3 zdjęcia i dodaj to. Za potwierdzony produkt dostaniesz złotą kartę i +50 pkt.</span></div>'}
        <div class="card stack"><b style="font-family:var(--f-display)">Poszukiwane</b><span class="small muted">Te kody ktoś skanował, a bazy brak. Masz taki produkt w domu? Dodanie daje podwójną nagrodę (+100).</span>
          ${wanted == null ? '<div class="sk" style="height:60px"></div>' : wanted.length ? wanted.slice(0, 10).map(w => `<a class="disc-want" href="#/p/${esc(w.code)}"><span class="mono">${esc(w.code)}</span><b>szukało ${w.n} ${plural(w.n, 'osoba', 'osoby', 'osób')}</b></a>`).join('') : '<span class="small">Na razie nic. Wróć za kilka dni.</span>'}</div>
        <div class="card stack"><label for="discNick"><b style="font-family:var(--f-display)">Pseudonim odkrywcy</b> <span class="small muted">(nieobowiązkowy)</span></label><input class="field" id="discNick" maxlength="24" autocomplete="off" placeholder="np. Ola z Poznania" value="${esc(A.disc.nick || '')}"><span class="small muted">Widzą go osoby, które potwierdzają Twoje produkty. Bez pseudonimu jesteś „innym odkrywcą”.</span></div>
      </div>`;
      const nick = A.$('discNick');
      if (nick) nick.addEventListener('change', () => { A.disc.nick = nick.value.replace(/[<>]/g, '').trim().slice(0, 24); save(); A.toast('Zapisano pseudonim.'); });
    };
    render(null);
    A.discSync(true).then(() => api('/disc/wanted')).then(r => { if (location.hash.startsWith('#/odkrycia')) render(r && r.ok ? r.items : []); });
  });
})();
