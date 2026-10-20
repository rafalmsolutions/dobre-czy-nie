/* Dobre czy nie? 1.0 – wspólne elementy interfejsu: pamięć, konfiguracja, punkty, gratulacje, nawigacja, pobieranie danych, skaner. */
'use strict';
const App = {};
(() => {
  const A = App;
  A.$ = id => document.getElementById(id);
  A.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  A.CFG = typeof CONFIG === 'object' && CONFIG ? CONFIG : {};
  // Obrazki tylko z https (adresy z bazy mogą być dowolne).
  A.safeImg = u => (typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : '');

  /* ---------- Pamięć w telefonie ---------- */
  A.store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('dcn-' + k); if (v == null) return d;
        const p = JSON.parse(v);
        if (d !== undefined && (Array.isArray(d) !== Array.isArray(p) || typeof p !== typeof d || p === null)) return d;
        return p;
      } catch (e) { return d; }
    },
    set(k, v) { try { localStorage.setItem('dcn-' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem('dcn-' + k); } catch (e) { } }
  };
  A.profile = cleanProfile(A.store.get('profile', {}));
  A.settings = Object.assign({ guess: true }, A.store.get('settings', {}));
  A.game = Game.load(A.store.get('game', null));
  A.shelves = Shelf.load(A.store.get('shelves', null));
  A.saveProfile = () => A.store.set('profile', A.profile);
  A.saveSettings = () => A.store.set('settings', A.settings);
  A.saveShelves = () => A.store.set('shelves', A.shelves);
  A.saveGame = () => A.store.set('game', A.game);
  A.userName = () => String(A.store.get('name', '') || '').slice(0, 30);
  // Losowy identyfikator dla Open Food Facts (app_uuid): nie zawiera danych osobowych.
  A.appUuid = () => {
    let u = A.store.get('uuid', '');
    if (!/^[a-z0-9-]{16,64}$/.test(u)) { u = (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')); A.store.set('uuid', u); }
    return u;
  };

  /* ---------- Konfiguracja grywalizacji (pliki config/*.json) ---------- */
  A.cfg = A.store.get('cfg', { rules: {}, levels: {}, achievements: {}, challenges: {} });
  A.loadConfig = async () => {
    const names = { rules: 'points-rules', levels: 'levels', achievements: 'achievements', challenges: 'weekly-challenges' };
    try {
      const entries = await Promise.all(Object.entries(names).map(async ([k, f]) => {
        const r = await fetch('../config/' + f + '.json', { cache: 'no-cache' });
        if (!r.ok) throw new Error(f);
        return [k, await r.json()];
      }));
      const c = Object.fromEntries(entries);
      // Wersja 1.0 pokazuje odznaki oznaczone "1.0"; reszta przyjdzie z kolejnymi wersjami.
      const v = A.CFG.appVersion || '1.0';
      c.achievements = Object.assign({}, c.achievements, { achievements: (c.achievements.achievements || []).filter(a => !a.inVersion || parseFloat(a.inVersion) <= parseFloat(v)) });
      A.cfg = c; A.store.set('cfg', c);
    } catch (e) { /* bez sieci: zostaje ostatnia zapisana konfiguracja */ }
  };
  A.extraMetrics = () => ({ breakfast_on_shelf: Shelf.breakfastGood(A.shelves) });

  /* ---------- Anonimowe statystyki (GoatCounter, bez ciasteczek) ----------
     Wysyłamy tylko nazwę ekranu albo zdarzenia (np. „skan-znaleziony”). Bez kodów produktów, profilu,
     imienia ani identyfikatora osoby. Powroty liczymy w telefonie: „aktywny-tydzien-2” wysyłamy raz,
     gdy ktoś używa aplikacji w drugim tygodniu od pierwszego otwarcia. */
  const GC = typeof A.CFG.goatcounter === 'string' && /^[a-z0-9-]{2,50}$/.test(A.CFG.goatcounter) ? A.CFG.goatcounter : '';
  A.statsOn = () => !!GC && A.settings.stats !== false && navigator.doNotTrack !== '1' && navigator.globalPrivacyControl !== true;
  A.statsAvailable = () => !!GC;
  function hit(path, event) {
    if (!A.statsOn()) return;
    const url = `https://${GC}.goatcounter.com/count?p=${encodeURIComponent(path)}${event ? '&e=true' : ''}&rnd=${Math.random().toString(36).slice(2, 8)}`;
    try { if (!(navigator.sendBeacon && navigator.sendBeacon(url))) new Image().src = url; } catch (e) { }
  }
  A.track = name => hit('d-' + name, true); // wersja D: osobne zdarzenia w statystykach
  // Uwagi od testerów: gotowy e-mail z szablonem i wersją aplikacji (bez danych z profilu).
  A.feedbackHref = () => {
    const v = (A.CFG.appVersion || '1.0') + ' (wersja D)', scr = `${Math.round(window.innerWidth)}×${Math.round(window.innerHeight)}`;
    const ua = /Android/i.test(navigator.userAgent) ? 'Android' : /iPhone|iPad/i.test(navigator.userAgent) ? 'iPhone/iPad' : 'komputer';
    const body = `Co było przydatne:\n\n\nCo przeszkadzało albo nie działało:\n\n\nCzego brakuje:\n\n\n---\nWersja ${v}, ${ua}, ekran ${scr}`;
    return `mailto:${A.CFG.contactEmail}?subject=${encodeURIComponent('Uwagi: Dobre czy nie? ' + v)}&body=${encodeURIComponent(body)}`;
  };
  A.trackView = screen => hit('/d/' + screen, false);
  A.trackWeek = () => {
    const now = Date.now();
    let first = A.store.get('first', 0);
    if (!first || first > now) { first = now; A.store.set('first', first); A.track('nowa-instalacja'); }
    const week = Math.floor((now - first) / (7 * 864e5)) + 1;
    const sent = A.store.get('weeksSent', []);
    if (!sent.includes(week)) { A.store.set('weeksSent', sent.concat(week).slice(-60)); A.track('aktywny-tydzien-' + week); }
  };
  const EVENT_STATS = { product_checked: 'skan-znaleziony', guess_right: 'zgadnij-trafione', guess_wrong: 'zgadnij-pudlo', shelf_add: 'na-polke', swap_to_better: 'zamiana', list_completed: 'lista-kupiona', product_added: 'dodano-produkt', ingredients_added: 'uzupelniono-sklad', nutrition_added: 'uzupelniono-wartosci', photo_added: 'dodano-zdjecie', report_sent: 'zgloszenie', shelf_shared: 'polka-udostepniona', explanation_opened: 'wyjasnienie' };

  /* ---------- Punkty, odznaki, gratulacje ---------- */
  A.award = (event, ctx = {}) => {
    if (EVENT_STATS[event]) A.track(EVENT_STATS[event]);
    const r = Game.award(A.game, A.cfg, event, Object.assign({ extra: A.extraMetrics() }, ctx));
    if (r.state !== A.game) { A.game = r.state; A.saveGame(); }
    if (r.gained > 0) A.plusFly(r.gained);
    if (r.events.length) A.celebrate(r.events);
    A.refreshHud();
    return r;
  };
  A.plusFly = n => {
    const el = document.createElement('div');
    el.className = 'plus-fly'; el.textContent = '+' + n + ' pkt'; el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el); setTimeout(() => el.remove(), 1700);
    A.announce('Zdobywasz ' + n + ' ' + plural(n, 'punkt', 'punkty', 'punktów') + '.');
  };
  A.refreshHud = () => document.querySelectorAll('[data-hud=points]').forEach(e => { e.textContent = A.game.points; });
  A.hudPill = () => `<a class="pill" href="#/postepy"><svg aria-hidden="true"><use href="#i-star"/></svg><span class="sr">Punkty: </span><span data-hud="points">${A.game.points}</span><span class="sr"> – przejdź do postępów</span></a>`;

  const celQueue = [];
  A.celebrate = events => {
    events.forEach(e => celQueue.push(e));
    if (A.$('celebrate').hidden) A.nextCelebration();
  };
  A.rewardChips = reward => {
    if (!reward) return '';
    if (typeof reward === 'string') return `<span class="reward-chip green">${A.esc(reward)}</span>`;
    const out = [];
    if (reward.points) out.push(`<span class="reward-chip gold">+${reward.points} pkt</span>`, `<span class="reward-chip blue">+${reward.points} kropli</span>`);
    (reward.items || []).forEach(i => out.push(`<span class="reward-chip red">${A.esc(ITEM_NAMES[i] || 'Nagroda')}</span>`));
    return out.join('');
  };
  const ITEM_NAMES = { seed_strawberry: 'Nasiona truskawki', seed_golden_carrot: 'Złota marchewka', seed_pumpkin: 'Nasiona dyni', deco_rainbow_fence: 'Tęczowy płotek', tool_golden_can: 'Złota konewka' };
  A.ITEM_NAMES = ITEM_NAMES;
  let celReturnFocus = null;
  A.nextCelebration = () => {
    const box = A.$('celebrate');
    const e = celQueue.shift();
    if (!e) { box.hidden = true; box.innerHTML = ''; document.body.style.overflow = ''; if (celReturnFocus && celReturnFocus.focus) celReturnFocus.focus(); return; }
    if (box.hidden) celReturnFocus = document.activeElement;
    let ribbon, head, sub, emblem;
    if (e.type === 'achievement') {
      const a = ((A.cfg.achievements && A.cfg.achievements.achievements) || []).find(x => x.id === e.id) || {};
      ribbon = 'Nowa odznaka!'; head = e.name; sub = a.description || '';
      emblem = medalSvg(a.icon, a.category, true, 170, 3);
    } else if (e.type === 'level') {
      ribbon = 'Nowy poziom!'; head = e.name; sub = 'Poziom ' + e.level + '. Tak trzymaj!';
      emblem = shieldSvg(e.level, 150);
    } else {
      ribbon = 'Wyzwanie ukończone!'; head = e.name; sub = 'Nowe wyzwanie pojawi się w poniedziałek.';
      emblem = art('packet_strawberry', 150);
    }
    const colors = ['#FFD23F', '#FF6B6B', '#5BB4F5', '#7EE08A', '#C9B2FF', '#FF9F6B', '#FFFFFF'];
    let conf = '';
    for (let i = 0; i < 36; i++) conf += `<i style="left:${(i * 37) % 100}%;background:${colors[i % colors.length]};animation-duration:${(3.5 + (i % 7) * .5).toFixed(1)}s;animation-delay:${(-(i % 9) * .7).toFixed(1)}s"></i>`;
    box.innerHTML = `<div class="rays"></div><div class="glow"></div><div class="confetti" aria-hidden="true">${conf}</div>
      ${ribbonSvg(A.esc(ribbon), 300, ['#FFE27A', '#F0B021', '#8A5A0A'])}
      <div class="emblem">${emblem}</div>
      <div class="crew">${art('z_cheer', 92)}${art('f_carrot', 66)}</div>
      <h2 id="celHead">${A.esc(head)}</h2>
      <p>${A.esc(sub)}</p>
      ${e.reward || e.points ? `<div class="chips" style="justify-content:center">${A.rewardChips(e.reward || { points: e.points })}</div>` : ''}
      <button class="btn btn-gold btn-block" type="button" data-act="cel-ok" style="max-width:360px">${celQueue.length ? 'Dalej' : 'Odbierz nagrody'}</button>`;
    box.hidden = false; document.body.style.overflow = 'hidden';
    setTimeout(() => { const b = box.querySelector('[data-act=cel-ok]'); if (b) b.focus(); }, 60);
  };

  /* ---------- Komunikaty ---------- */
  let toastTimer;
  A.toast = (msg, actionHtml) => {
    const t = A.$('toast');
    t.innerHTML = A.esc(msg) + (actionHtml ? ' ' + actionHtml : '');
    t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3800);
  };
  A.announce = msg => { let l = A.$('srLive'); if (!l) { l = document.createElement('div'); l.id = 'srLive'; l.className = 'sr'; l.setAttribute('aria-live', 'polite'); document.body.appendChild(l); } l.textContent = msg; };
  A.openDlg = id => { const d = A.$(id); if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute('open', ''); };
  A.closeDlg = d => { if (!d) return; if (d.close) d.close(); else d.removeAttribute('open'); };
  // Wersja D: bez maskotki (spokojniejszy wygląd dla dorosłych).
  A.mascot = () => '';
  // Zdjęcia kategorii (img/cat/*.webp): najwęższa kategoria produktu, która jest na liście kategorii aplikacji.
  const CAT_KEYS = new Set(SHOP_CATEGORIES.map(c => c.key));
  const CAT_ALIAS = { 'en:hams': 'en:prepared-meats', 'en:cold-cuts': 'en:prepared-meats', 'en:frankfurters': 'en:sausages', 'en:hazelnut-spreads': 'en:sweet-spreads', 'en:plain-yogurts': 'en:yogurts', 'en:plant-based-milks': 'en:plant-based-milk-alternatives', 'en:mineral-waters': 'en:waters', 'en:chips': 'en:crisps', 'en:carbonated-drinks': 'en:sodas', 'en:sweetened-beverages': 'en:sodas', 'en:fruit-based-beverages': 'en:fruit-juices', 'en:nectars': 'en:fruit-juices', 'en:orange-nectars': 'en:fruit-juices', 'en:bars-covered-with-chocolate': 'en:chocolates', 'en:confectioneries': 'en:candies', 'en:instant-beverages': 'en:coffees', 'pl:kawy-ziarniste': 'en:coffees', 'en:broths': 'en:soups', 'en:poultry-broth': 'en:soups' };
  A.catKeyOf = cats => { const c = Array.isArray(cats) ? cats : []; for (let i = c.length - 1; i >= 0; i--) { if (CAT_KEYS.has(c[i])) return c[i]; if (CAT_ALIAS[c[i]] && CAT_KEYS.has(CAT_ALIAS[c[i]])) return CAT_ALIAS[c[i]]; } return ''; };
  // Gdy baza nie podaje kategorii: rozpoznanie po nazwie produktu (kolejność: od najbardziej szczegółowych).
  const NAME_RULES = [
    [/\b(parowk|kielbas|kabanos|frankfurter)/, 'en:sausages'],
    [/\b(sardyn|tunczyk|szprot|makrel)/, 'en:canned-fishes'],
    [/\b(losos|dorsz|pstrag|mintaj|filet rybn|ryba|ryby)/, 'en:fishes'],
    [/\b(szynk|poledwic|salami|boczek|wedlin|baleron|mortadel)/, 'en:prepared-meats'],
    [/\b(krem (orzech|kakao|czekol)|nutell|maslo orzech|pasta orzech)/, 'en:sweet-spreads'],
    [/\b(napoj (owsian|sojow|migdal|ryzow|kokos|roslin))/, 'en:plant-based-milk-alternatives'],
    [/\b(budyn|kisiel|deser|pudding|panna cotta)/, 'en:dairy-desserts'],
    [/\bjogurt/, 'en:yogurts'],
    [/\b(twarog|twarozek|serek|homogeniz)/, 'en:quarks'],
    [/\b(ser|sery|sera|gouda|edam|mozzarell|camembert|feta|parmezan|cheddar|brie)\b/, 'en:cheeses'],
    [/\b(mleko|kefir|maslank)/, 'en:milks'],
    [/\b(maslo|masla)\b/, 'en:butters'],
    [/\b(musli|granol)/, 'en:mueslis'],
    [/\b(platki|owsianka)/, 'en:breakfast-cereals'],
    [/\b(dzem|konfitur|powidl|marmolad)/, 'en:jams'],
    [/\bhummus/, 'en:hummus'],
    [/\b(chleb|bulk|bagiet|pieczyw|tortill|grahamk|rogal)/, 'en:breads'],
    [/\b(chips|crisps)/, 'en:crisps'],
    [/\b(paluszk|krakers|precel|wafle ryz|popcorn|chrupk)/, 'en:salty-snacks'],
    [/\b(makaron|spaghetti|penne|fusilli|tagliatell|lasagn|nitki)/, 'en:pastas'],
    [/\b(kasza|kaszk|bulgur|kuskus|quinoa)/, 'en:groats'],
    [/\b(ryz|ryzu)\b/, 'en:rices'],
    [/\b(fasol|soczewic|ciecierzyc|cieciork|groch)/, 'en:legumes'],
    [/\bketchup/, 'en:ketchup'],
    [/\b(sos|sosy|pesto|majonez)\b/, 'en:sauces'],
    [/\b(olej|oliwa)/, 'en:vegetable-oils'],
    [/\b(ogork|kiszon|marynowan)/, 'en:pickles'],
    [/\b(kukurydz|groszek)/, 'en:canned-vegetables'],
    [/\b(zupa|bulion|rosol|barszcz|zurek|krem z)/, 'en:soups'],
    [/\b(pierog|uszka|kopytk|pyzy)/, 'en:pierogi'],
    [/\bpizz/, 'en:pizzas'],
    [/\b(mrozon|mieszanka warzyw)/, 'en:frozen-vegetables'],
    [/\b(danie|gulasz|bigos|golabk|risotto)/, 'en:meals'],
    [/\b(rodzynk|suszon|daktyl|zurawin|morel|figi)/, 'en:dried-fruits'],
    [/\b(orzech|migdal|nerkow|pistacj|arachid)/, 'en:nuts'],
    [/\b(czekolad|baton|praliny|bombonier)/, 'en:chocolates'],
    [/\b(ciastk|herbatnik|biszkopt|wafel|wafelek|piernik|cookies)/, 'en:biscuits'],
    [/\b(cukierk|zelk|zelki|lizak|landrynk|gumy)/, 'en:candies'],
    [/\b(lody|lodow)/, 'en:ice-creams'],
    [/\b(sok|soki|nektar|smoothie)\b/, 'en:fruit-juices'],
    [/\b(cola|lemoniad|oranzad|tonic|napoj gazow|napoj energ|energy)/, 'en:sodas'],
    [/\b(herbat)/, 'en:teas'],
    [/\b(kawa|kawy|cappuccino|espresso|latte)\b/, 'en:coffees'],
    [/\bwoda\b/, 'en:waters']
  ];
  A.catKeyByName = name => { const f = fold(name).replace(/[^a-z0-9 ]+/g, ' '); for (const [re, k] of NAME_RULES) if (re.test(f)) return k; return ''; };
  A.catImg = key => key && CAT_KEYS.has(key) ? 'img/cat/' + key.replace(/^en:/, '') + '.webp' : '';
  A.prodCatImg = p => p && p.kind !== 'cosmetic' ? A.catImg(A.catKeyOf(p.categories) || A.catKeyByName(p.name)) : '';
  // Nazwa produktu w dwóch grubościach: pierwsze słowo cienko, reszta grubo.
  A.splitName = name => { const w = String(name || '').trim().split(/\s+/); if (w.length < 2) return `<span class="w-bold">${A.esc(w[0] || '')}</span>`; return `<span class="w-light">${A.esc(w[0])}</span> <span class="w-bold">${A.esc(w.slice(1).join(' '))}</span>`; };

  /* ---------- Nawigacja ---------- */
  A.routes = {};
  A.route = (name, fn) => { A.routes[name] = fn; };
  A.go = hash => { if (location.hash === hash) A.render(); else location.hash = hash; };
  A.current = { screen: null, arg: null };
  A.render = () => {
    const h = decodeURIComponent(location.hash || '');
    let m, screen = 'home', arg = null;
    if ((m = h.match(/^#\/?p\/?(\d{6,14})$/)) || (m = h.match(/^#p(\d{8,14})$/))) { screen = 'product'; arg = m[1]; }
    else if (h === '#/polki') screen = 'shelves';
    else if (h === '#/postepy') screen = 'progress';
    else if (h === '#/profil') screen = 'profile';
    else if (h === '#/start') screen = 'start';
    else if (h === '#/najlepsze') screen = 'cats';
    else if ((m = h.match(/^#\/lista\/([a-z]{2}:[a-z0-9-]{2,60})$/))) { screen = 'list'; arg = m[1]; }
    if (screen === 'home' && !A.store.get('onboarded', false)) screen = 'start';
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 'scr-' + screen));
    document.body.classList.toggle('no-nav', screen === 'start');
    document.querySelectorAll('.tab').forEach(t => { if (t.dataset.tab === screen) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
    const first = !A.current.screen;
    const changed = A.current.screen !== screen || A.current.arg !== arg;
    A.current = { screen, arg };
    const boot = A.$('boot'); if (boot) boot.remove();
    if (changed) A.trackView(screen);
    if (A.routes[screen]) A.routes[screen](arg);
    if (changed) {
      // Przy pierwszym ekranie strona jest już na górze – pomijamy przewijanie (wymusza dodatkowe przeliczenie układu).
      if (!first) {
        window.scrollTo({ top: 0 });
        // Po zmianie ekranu czytnik ekranu zaczyna od nagłówka. Przy starcie aplikacji nie trzeba (strona i tak czyta się od góry).
        const h1 = document.querySelector('#scr-' + screen + ' h1');
        if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
      }
    }
  };

  /* ---------- Pobieranie danych ---------- */
  A.fetchError = (kind, detail) => { const e = new Error(detail || kind); e.kind = kind; return e; };
  A.getJson = async (url, signal) => {
    let r;
    try { r = await fetch(url, { signal }); }
    catch (e) {
      if (e && e.name === 'AbortError') throw A.fetchError('timeout');
      throw A.fetchError(navigator.onLine === false ? 'offline' : 'network');
    }
    if (r.status === 404) return { notFound: true };
    if (r.status === 429) throw A.fetchError('rate');
    if (!r.ok) throw A.fetchError('server', 'HTTP ' + r.status);
    try { return { json: await r.json() }; } catch (e) { throw A.fetchError('server', 'bad json'); }
  };
  A.ERR_TEXT = {
    offline: ['Jesteś offline', 'Telefon nie ma teraz połączenia z internetem. Połącz się i spróbuj ponownie. Sprawdzone wcześniej produkty znajdziesz na ekranie głównym.'],
    timeout: ['Baza produktów nie odpowiada', 'Odpowiedź trwa za długo, może przez słaby zasięg w sklepie. Spróbuj ponownie za chwilę.'],
    rate: ['Za dużo sprawdzeń naraz', 'Baza produktów chwilowo ogranicza liczbę zapytań. Odczekaj minutę i spróbuj ponownie.'],
    server: ['Baza produktów ma chwilowy problem', 'To nie jest błąd po Twojej stronie. Spróbuj ponownie za kilka minut.'],
    network: ['Nie udało się połączyć z bazą produktów', 'Sprawdź połączenie z internetem i spróbuj ponownie.']
  };
  async function fetchProduct(base, code, signal) {
    const res = await A.getJson(`${base}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, signal);
    if (res.notFound) return null;
    const j = res.json;
    if (!j || typeof j !== 'object' || j.status !== 1 || !j.product || typeof j.product !== 'object') return null;
    j.product.code = j.product.code || code;
    return j.product;
  }
  const hasData = p => p && (p.product_name || p.product_name_pl || p.ingredients_text || p.ingredients_text_pl || p.nutriscore_grade);
  // Jedna baza z jedną cichą ponowną próbą: serwery Open Food Facts czasem odpowiadają chwilowym błędem
  // („Strona tymczasowo niedostępna”), a druga próba po chwili zwykle się udaje.
  async function fetchWithRetry(base, code) {
    let last;
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), attempt ? 10000 : 7000);
      try { return { p: await fetchProduct(base, code, ctrl.signal) }; }
      catch (e) { last = e; if (e && e.kind === 'offline') break; }
      finally { clearTimeout(timer); }
      await new Promise(r => setTimeout(r, 800));
    }
    return { error: last && last.kind ? last : A.fetchError('network') };
  }
  A.lookup = async code => {
    if (navigator.onLine === false) throw A.fetchError('offline');
    // Najpierw jedzenie; baza kosmetyków tylko wtedy, gdy w jedzeniu nic nie ma (limit 15 odczytów na minutę).
    const f = await fetchWithRetry(OFF, code);
    if (hasData(f.p)) return normalizeProduct(f.p, 'off');
    const b = await fetchWithRetry(OBF, code);
    if (hasData(b.p)) return normalizeProduct(b.p, 'obf');
    // Baza jedzenia odpowiedziała „nie ma”, a kosmetyków ma problem: produkt najpewniej jest nieznany,
    // więc pokazujemy „Tego produktu jeszcze nie znamy” zamiast błędu.
    if (f.error) throw f.error;
    if (f.p) return normalizeProduct(f.p, 'off');
    if (b.p) return normalizeProduct(b.p, 'obf');
    return null;
  };
  const TTL = 24 * 3600e3;
  /* Produkty z kategorii (listy „Najlepsze” i porównanie po skanie).
     Najpierw przez naszego pośrednika (szybka wyszukiwarka Open Food Facts, wyniki zapamiętane na dobę).
     Bez pośrednika: stara wyszukiwarka OFF, która ma limit 10 zapytań na minutę i bywa niedostępna,
     więc pilnujemy limitu, ponawiamy raz i pamiętamy wyniki. Pustych wyników nie zapamiętujemy. */
  A.CAT_FIELDS = 'code,product_name,product_name_pl,brands,quantity,image_front_small_url,image_front_url,nutriscore_grade,nova_group,additives_tags,allergens_tags,traces_tags,ingredients_analysis_tags,labels_tags,nutriments,categories_hierarchy,categories,stores_tags,stores';
  const inflight = {}, searchTimes = [];
  /* Własna kopia polskich produktów (folder data/, budowana co tydzień przez GitHub Actions).
     Odpowiada od razu i nie zależy od tego, czy serwery Open Food Facts są przeciążone. */
  let metaP = null;
  A.snapshotMeta = () => metaP || (metaP = fetch('../data/meta.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(j => (j && j.products ? j : null)).catch(() => null));
  async function snapshotJson(path) {
    const r = await fetch(path);
    if (r.status === 404) return null;
    if (!r.ok) throw A.fetchError('server', 'HTTP ' + r.status);
    return r.json();
  }
  A.snapshotProduct = async code => {
    if (!/^\d{8,14}$/.test(code) || !(await A.snapshotMeta())) return null;
    try { const j = await snapshotJson(`../data/p/${code.slice(-3)}.json`); return j && j[code] ? Object.assign(normalizeProduct(j[code], 'off'), { snapshot: true }) : null; }
    catch (e) { return null; }
  };
  const SEARCH_PER_MIN = 8;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function searchSlot(onWait) {
    for (let i = 0; i < 70; i++) {
      const now = Date.now();
      while (searchTimes.length && now - searchTimes[0] > 60e3) searchTimes.shift();
      if (searchTimes.length < SEARCH_PER_MIN) { searchTimes.push(now); return; }
      const wait = Math.ceil((60e3 - (now - searchTimes[0])) / 1000);
      if (onWait) onWait(wait);
      await sleep(1000);
    }
    throw A.fetchError('rate');
  }
  async function fetchCatRemote(cat, onWait) {
    if (await A.snapshotMeta()) {
      // Brak pliku = w Polsce mniej niż 5 produktów z tej kategorii: nie ma czego porównywać, nie pytamy dalej.
      let j;
      try { j = await snapshotJson(`../data/c/${cat.replace(':', '_')}.json`); }
      catch (e) { throw e.kind ? e : A.fetchError(navigator.onLine === false ? 'offline' : 'network'); }
      return j && Array.isArray(j.products) ? j.products.filter(x => x && x.code).map(x => normalizeProduct(x, 'off')) : [];
    }
    const proxy = (A.CFG.offProxyUrl || '').replace(/\/$/, '');
    for (let attempt = 0; attempt < 2; attempt++) {
      if (navigator.onLine === false) throw A.fetchError('offline');
      const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 20000);
      try {
        let res;
        if (proxy) res = await A.getJson(`${proxy}/category?tag=${encodeURIComponent(cat)}`, ctrl.signal);
        else { await searchSlot(onWait); res = await A.getJson(`${OFF}/api/v2/search?categories_tags=${encodeURIComponent(cat)}&countries_tags=en:poland&fields=${A.CAT_FIELDS}&sort_by=popularity_key&page_size=100`, ctrl.signal); }
        const raw = res.json && (Array.isArray(res.json.products) ? res.json.products : []);
        return (raw || []).filter(x => x && typeof x === 'object' && x.code).slice(0, 200).map(x => normalizeProduct(x, 'off'));
      } catch (e) {
        const kind = e && e.kind;
        if (attempt === 0 && (kind === 'rate' || kind === 'server' || kind === 'timeout')) { if (onWait) onWait(5); await sleep(5000); continue; }
        throw e;
      } finally { clearTimeout(t); }
    }
  }
  A.fetchCategory = (cat, onWait) => {
    const cache = A.store.get('catcache', {}), hit = cache[cat];
    if (hit && Array.isArray(hit.list) && hit.list.length && Date.now() - hit.at < TTL) return Promise.resolve(hit.list);
    if (inflight[cat]) return inflight[cat];
    inflight[cat] = fetchCatRemote(cat, onWait).then(list => {
      if (list.length) {
        const c = A.store.get('catcache', {});
        c[cat] = { at: Date.now(), list };
        Object.keys(c).sort((x, y) => (c[y].at || 0) - (c[x].at || 0)).slice(6).forEach(k => delete c[k]);
        if (!A.store.set('catcache', c)) { A.store.set('catcache', { [cat]: c[cat] }); }
      }
      return list;
    }).finally(() => { delete inflight[cat]; });
    return inflight[cat];
  };
  A.storeOf = (prod, key) => (prod.stores || []).some(s => fold(s).replace(/\s+/g, '').includes(key));

  /* ---------- Historia ---------- */
  A.remember = (prod, an, pm) => {
    const hist = A.store.get('history', []).filter(h => h && h.code !== prod.code);
    const prev = A.store.get('history', []).find(h => h && h.code === prod.code) || {};
    hist.unshift({ code: prod.code, name: prod.name || 'Produkt bez nazwy', brand: prod.brand, image: A.safeImg(prod.image), score: an.score, pct: pm ? pm.pct : null, level: pm ? pm.level : null, kind: prod.kind, categories: (prod.categories || []).slice(-4), alt: prev.alt || null, at: Date.now() });
    A.store.set('history', hist.slice(0, 30));
    const cache = A.store.get('cache', {});
    cache[prod.code] = { p: prod, at: Date.now() };
    Object.keys(cache).sort((a, b) => cache[b].at - cache[a].at).slice(40).forEach(k => delete cache[k]);
    A.store.set('cache', cache);
  };
  A.setHistoryAlt = (code, alt) => {
    const hist = A.store.get('history', []);
    const h = hist.find(x => x && x.code === code);
    if (h) { h.alt = alt; A.store.set('history', hist); }
  };

  /* ---------- Narzędzia ---------- */
  A.downscale = (file, max, type) => new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
      c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      if (type === 'blob') c.toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/jpeg', 0.85); else res(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
    img.src = url;
  });
  const loaded = {};
  A.loadScript = urls => {
    const key = urls[0];
    if (loaded[key]) return loaded[key];
    loaded[key] = (async () => {
      for (const u of urls) {
        try { await new Promise((res, rej) => { const s = document.createElement('script'); s.src = u; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); return; } catch (e) { }
      }
      delete loaded[key]; throw new Error('load');
    })();
    return loaded[key];
  };
  A.codeProblem = raw => {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return 'Wpisz cyfry spod kodu kreskowego.';
    if (/[a-zA-Ząćęłńóśźż]/.test(s)) return 'Kod kreskowy składa się z samych cyfr. Wpisz liczby spod kresek, bez liter.';
    const d = s.replace(/\D/g, '');
    if (d.length < 8) return `Wpisałeś ${d.length} ${plural(d.length, 'cyfrę', 'cyfry', 'cyfr')}. Kod kreskowy ma zwykle 8 albo 13 cyfr.`;
    if (d.length > 14) return 'Ten kod jest za długi. Kod kreskowy ma zwykle 8 albo 13 cyfr.';
    return '';
  };
  // Otwiera produkt z kodu; błędy wpisu pokazuje w miejscu, z którego przyszedł kod.
  A.openCode = (raw, msgEl) => {
    const problem = A.codeProblem(raw);
    if (problem) { if (msgEl) msgEl.textContent = problem; return false; }
    if (msgEl) msgEl.textContent = '';
    A.go('#/p/' + String(raw).replace(/\D/g, ''));
    return true;
  };

  /* ---------- Skaner ---------- */
  let stream = null, scanning = false, detector = null, lastCand = null, sameCount = 0, canvas = null, zxReader = null, scanReturn = null;
  A.openScanner = async () => {
    scanReturn = document.activeElement;
    A.$('scanner').hidden = false; A.$('scanErr').hidden = true; A.$('reticle').hidden = false; A.$('torchBtn').hidden = true; A.$('torchSpacer').hidden = false;
    A.$('scanHint').textContent = 'Skieruj aparat na kod kreskowy. Odczyt nastąpi sam.'; A.$('scanMsg').textContent = '';
    document.body.style.overflow = 'hidden';
    setTimeout(() => A.$('scanner').querySelector('[data-act=close-scan]').focus(), 30);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return scanError('Ta przeglądarka nie daje dostępu do aparatu', 'Wpisz cyfry spod kodu poniżej albo wybierz zdjęcie kodu.');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (e) {
      return scanError('Nie mamy dostępu do aparatu', e && e.name === 'NotAllowedError' ? 'Zezwól na dostęp do aparatu w ustawieniach przeglądarki albo wpisz cyfry spod kodu poniżej.' : 'Nie znaleźliśmy aparatu albo używa go inna aplikacja. Wpisz cyfry spod kodu poniżej.');
    }
    if (A.$('scanner').hidden) { stopStream(); return; }
    const video = A.$('video'); video.srcObject = stream;
    try { await video.play(); } catch (e) { }
    const track = stream.getVideoTracks()[0];
    try { const caps = track.getCapabilities ? track.getCapabilities() : {}; if (caps.torch) { A.$('torchBtn').hidden = false; A.$('torchSpacer').hidden = true; } } catch (e) { }
    detector = await nativeDetector();
    if (!detector) {
      try { await A.loadScript(ZXING_URLS); } catch (e) { return scanError('Nie udało się uruchomić skanera', 'Sprawdź połączenie z internetem albo wpisz cyfry spod kodu poniżej.'); }
    }
    scanning = true; lastCand = null; sameCount = 0;
    tick();
  };
  async function nativeDetector() {
    if (!('BarcodeDetector' in window)) return null;
    try {
      const fm = await BarcodeDetector.getSupportedFormats();
      const want = ['ean_13', 'ean_8', 'upc_a', 'upc_e'].filter(f => fm.includes(f));
      return want.includes('ean_13') ? new BarcodeDetector({ formats: want }) : null;
    } catch (e) { return null; }
  }
  function zxDecode(cnv) {
    if (!window.ZXing) return null;
    if (!zxReader) {
      zxReader = new ZXing.MultiFormatReader();
      const hints = new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E]);
      hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
      zxReader.setHints(hints);
    }
    try { return zxReader.decodeWithState(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.HTMLCanvasElementLuminanceSource(cnv)))).getText(); } catch (e) { return null; }
  }
  async function tick() {
    if (!scanning) return;
    const video = A.$('video');
    let code = null;
    if (video.readyState >= 2 && video.videoWidth) {
      if (detector) { try { const r = await detector.detect(video); if (r.length) code = r[0].rawValue; } catch (e) { } }
      else {
        canvas = canvas || document.createElement('canvas');
        const vw = video.videoWidth, vh = video.videoHeight, cw = vw * 0.8, ch = vh * 0.5, scale = Math.min(1, 900 / cw);
        canvas.width = Math.round(cw * scale); canvas.height = Math.round(ch * scale);
        canvas.getContext('2d', { willReadFrequently: true }).drawImage(video, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, canvas.width, canvas.height);
        code = zxDecode(canvas);
      }
    }
    if (code) {
      code = code.length === 12 ? '0' + code : code;
      if (validBarcode(code)) {
        sameCount = code === lastCand ? sameCount + 1 : 1; lastCand = code;
        if (detector || sameCount >= 2) { found(code); return; }
      }
    }
    setTimeout(() => scanning && requestAnimationFrame(tick), detector ? 100 : 140);
  }
  function found(code) {
    if (navigator.vibrate) { try { navigator.vibrate(60); } catch (e) { } }
    A.closeScanner(true);
    A.openCode(code);
  }
  function scanError(title, text) {
    A.$('reticle').hidden = true; A.$('scanErr').hidden = false;
    A.$('scanErrTitle').textContent = title; A.$('scanErrText').textContent = text; A.$('scanHint').textContent = '';
    setTimeout(() => A.$('scanCode').focus(), 30);
  }
  function stopStream() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }
  A.closeScanner = (silent) => {
    scanning = false; stopStream();
    A.$('video').srcObject = null; A.$('scanner').hidden = true; document.body.style.overflow = '';
    A.$('torchBtn').setAttribute('aria-pressed', 'false');
    if (!silent && scanReturn && scanReturn.focus) scanReturn.focus();
  };
  A.toggleTorch = async () => {
    const track = stream && stream.getVideoTracks()[0]; if (!track) return;
    const on = A.$('torchBtn').getAttribute('aria-pressed') !== 'true';
    try { await track.applyConstraints({ advanced: [{ torch: on }] }); A.$('torchBtn').setAttribute('aria-pressed', String(on)); } catch (e) { A.toast('Latarka nie jest dostępna.'); }
  };
  A.decodeImageFile = async file => {
    const msg = A.$('scanMsg');
    msg.textContent = 'Szukam kodu na zdjęciu…';
    try {
      const img = await A.downscale(file, 1600);
      let code = null;
      const det = await nativeDetector();
      if (det) { try { const r = await det.detect(img); if (r.length) code = r[0].rawValue; } catch (e) { } }
      if (!code) { await A.loadScript(ZXING_URLS); code = zxDecode(img); }
      if (code && code.length === 12) code = '0' + code;
      if (code) { msg.textContent = ''; A.closeScanner(true); A.openCode(code); }
      else msg.textContent = 'Nie widzimy kodu na tym zdjęciu. Zrób zdjęcie z bliska, prosto i w dobrym świetle albo wpisz cyfry.';
    } catch (e) { msg.textContent = 'Nie udało się odczytać zdjęcia. Wpisz cyfry spod kodu.'; }
  };
})();
