/* Dobre czy nie? 1.0 – wspólne elementy interfejsu: pamięć, konfiguracja, punkty, gratulacje, nawigacja, pobieranie danych, skaner. */
'use strict';
const App = {};
(() => {
  const A = App;
  A.$ = id => document.getElementById(id);
  A.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  A.CFG = typeof CONFIG === 'object' && CONFIG ? CONFIG : {};
  // Obrazki tylko z https (adresy z bazy mogą być dowolne). Zdjęcia produktów z Open Food Facts idą przez nasz pośrednik,
  // który trzyma ich kopię w pamięci Cloudflare (serwer zdjęć OFF bywa bardzo wolny); telefon też je zapamiętuje (sw.js).
  const OFF_IMG = /^https:\/\/images\.openfoodfacts\.org(\/images\/products\/[0-9/]{1,40}\/[A-Za-z0-9_.-]{1,80}\.(?:jpg|jpeg|png|webp))$/;
  A.safeImg = u => {
    if (typeof u !== 'string' || !/^https:\/\/[^\s"'<>]+$/.test(u)) return '';
    const m = u.match(OFF_IMG), proxy = (A.CFG.offProxyUrl || '').replace(/\/$/, '');
    return m && proxy && !m[1].includes('..') ? proxy + '/img' + m[1] : u;
  };

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
  // Wersja D ma własny profil („Nie jem” + „Pilnuję”). Za pierwszym razem przenosimy ustawienia z głównej aplikacji.
  A.profile = A.store.get('d-profile', null) ? cleanProfile(A.store.get('d-profile', {})) : migrateProfileD(A.store.get('profile', {}));
  A.settings = Object.assign({ guess: false }, A.store.get('settings', {}));
  // 21.10.2026: „Zgadnij” domyślnie wyłączone – po skanie od razu wynik. Kto chce, włącza grę w profilu.
  if (A.store.get('settings-v', 1) < 2) { A.settings.guess = false; A.store.set('settings', A.settings); A.store.set('settings-v', 2); }
  A.game = Game.load(A.store.get('game', null));
  A.shelves = Shelf.load(A.store.get('shelves', null));
  A.saveProfile = () => A.store.set('d-profile', A.profile);
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
  A.ALBUM_RULES = {
    card_common: { points: 2, oncePerBarcode: true }, card_rare: { points: 5, oncePerBarcode: true }, card_epic: { points: 15, oncePerBarcode: true },
    card_legend: { points: 50, oncePerBarcode: true }, card_holo: { points: 20, oncePerBarcode: true }, card_weekly: { points: 30, oncePerBarcode: true },
    album_page: { points: 100, oncePerBarcode: true },
    store_added: { points: 2, dailyCap: 20, oncePerBarcode: true } // sklep dopisany do produktu w Open Food Facts
  };
  A.cfg = A.store.get('cfg', { rules: {}, levels: {}, achievements: {}, challenges: {} });
  A.loadConfig = async () => {
    const names = { rules: 'points-rules', levels: 'levels', achievements: 'achievements', challenges: 'weekly-challenges' };
    try {
      const entries = await Promise.all(Object.entries(names).map(async ([k, f]) => {
        const r = await fetch(f === 'achievements' ? 'achievements.json' : '../config/' + f + '.json', { cache: 'no-cache' }); // wersja D: własne odznaki
        if (!r.ok) throw new Error(f);
        return [k, await r.json()];
      }));
      const c = Object.fromEntries(entries);
      // Wersja 1.0 pokazuje odznaki oznaczone "1.0"; reszta przyjdzie z kolejnymi wersjami.
      const v = A.CFG.appVersion || '1.0';
      c.achievements = Object.assign({}, c.achievements, { achievements: (c.achievements.achievements || []).filter(a => !a.inVersion || parseFloat(a.inVersion) <= parseFloat(v)) });
      // Wersja D: punkty za karty albumu (raz na produkt) i pełne strony.
      c.rules = Object.assign({}, c.rules, { events: Object.assign({}, (c.rules || {}).events, A.ALBUM_RULES) });
      A.cfg = c; A.store.set('cfg', c);
    } catch (e) { /* bez sieci: zostaje ostatnia zapisana konfiguracja */ }
  };
  // Wersja D: dodatkowe liczniki odznak. Kategorie i „perełki” zbieramy w osobnych zbiorach, bo historia trzyma tylko 30 produktów.
  A.extraMetrics = () => {
    const hist = A.store.get('history', []).filter(h => h && h.code);
    const cats = new Set(A.store.get('d-cats', [])), great = new Set(A.store.get('d-great', []));
    const n0 = cats.size, g0 = great.size;
    hist.forEach(h => {
      const k = h.kind === 'cosmetic' ? '' : (A.catKeyOf ? (A.catKeyOf(h.categories) || A.catKeyByName(h.name)) : '');
      if (k) cats.add(k); else if (h.categories && h.categories.length) cats.add(h.categories[h.categories.length - 1]);
      if (h.pct != null && h.pct >= 75) great.add(h.code);
    });
    if (cats.size !== n0) A.store.set('d-cats', [...cats].slice(-500));
    if (great.size !== g0) A.store.set('d-great', [...great].slice(-1000));
    const c = (A.game && A.game.counters) || {}, p = A.profile || {};
    return {
      disc_best: (A.disc && A.disc.best) || 0,
      breakfast_on_shelf: Shelf.breakfastGood(A.shelves), categories_explored: cats.size, great_finds: great.size,
      data_completed: (c.ingredients_added || 0) + (c.nutrition_added || 0) + (c.name_added || 0),
      profile_items: (p.watch || []).length + ['allergens', 'diet', 'avoid', 'custom'].reduce((n, g) => n + ((p[g] || []).length), 0),
      ...(A.albumMetrics ? A.albumMetrics() : {})
    };
  };

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
  /* Znacznik testera z linku (lupka.app/app/?t=jan): zapamiętany w telefonie, dopisywany do uwag i zgłoszeń
     oraz raz dziennie do statystyk („d-tester-jan”), żeby było widać, kto korzysta i kto co zgłosił. Tylko to słowo, bez danych. */
  (() => {
    try {
      const u = new URL(location.href), t = (u.searchParams.get('t') || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9-]/g, '').slice(0, 30);
      if (t) { A.store.set('tester', t); u.searchParams.delete('t'); history.replaceState(null, '', u.pathname + (u.search || '') + u.hash); }
    } catch (e) { }
  })();
  A.tester = () => { const t = A.store.get('tester', ''); return typeof t === 'string' && /^[a-z0-9-]{1,30}$/.test(t) ? t : ''; };
  A.trackTester = () => { const t = A.tester(), day = new Date().toISOString().slice(0, 10); if (!t || A.store.get('tester-day', '') === day) return; A.store.set('tester-day', day); A.track('tester-' + t); };
  // Uwagi od testerów: gotowy e-mail z szablonem i wersją aplikacji (bez danych z profilu).
  A.feedbackHref = () => {
    const v = (A.CFG.appVersion || '2.0'), scr = `${Math.round(window.innerWidth)}×${Math.round(window.innerHeight)}`;
    const ua = /Android/i.test(navigator.userAgent) ? 'Android' : /iPhone|iPad/i.test(navigator.userAgent) ? 'iPhone/iPad' : 'komputer';
    const t = A.tester();
    const body = `Co było przydatne:\n\n\nCo przeszkadzało albo nie działało:\n\n\nCzego brakuje:\n\n\n---\nWersja ${v}, ${ua}, ekran ${scr}${t ? ', tester: ' + t : ''}`;
    return `mailto:${A.CFG.contactEmail}?subject=${encodeURIComponent('Uwagi: Lupka ' + v + (t ? ' · ' + t : ''))}&body=${encodeURIComponent(body)}`;
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
  const EVENT_STATS = { product_checked: 'skan-znaleziony', guess_right: 'zgadnij-trafione', guess_wrong: 'zgadnij-pudlo', shelf_add: 'na-polke', swap_to_better: 'zamiana', list_completed: 'lista-kupiona', product_added: 'dodano-produkt', ingredients_added: 'uzupelniono-sklad', nutrition_added: 'uzupelniono-wartosci', name_added: 'dodano-nazwe', photo_added: 'dodano-zdjecie', report_sent: 'zgloszenie', shelf_shared: 'polka-udostepniona', explanation_opened: 'wyjasnienie' };

  /* ---------- Wersja D: dźwięki i wibracje ----------
     Dźwięki są generowane w przeglądarce (Web Audio), bez plików. Wyłącza je przełącznik w profilu.
     Przeglądarka pozwala grać dopiero po pierwszym dotknięciu ekranu, więc wtedy przygotowujemy dźwięk. */
  let ac = null, master = null, verb = null;
  // Łańcuch: głosy → master (+ pogłos) → kompresor → głośnik. Kompresor wyrównuje głośność, pogłos daje „przestrzeń” nagrodom.
  function build(c) {
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    const out = c.createGain(); out.gain.value = 0.9; out.connect(comp); comp.connect(c.destination);
    const m = c.createGain(); m.gain.value = 0.55; m.connect(out);
    // Pogłos z wygenerowanej odpowiedzi impulsowej (szum gasnący przez ok. 1,8 s, osobno lewy i prawy kanał).
    const len = Math.round(c.sampleRate * 1.8), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let seed = ch ? 7 : 3; for (let i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; d[i] = ((seed / 2147483647) * 2 - 1) * Math.pow(1 - i / len, 3.2); } }
    const conv = c.createConvolver(); conv.buffer = ir; const wet = c.createGain(); wet.gain.value = 0.32; conv.connect(wet); wet.connect(out);
    return { m, verb: conv };
  }
  const audio = () => {
    if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ac = new C(); ({ m: master, verb } = build(ac)); }
    if (ac.state === 'suspended') ac.resume().catch(() => { });
    return ac;
  };
  /* Nagrane efekty z zestawu SFX Kit (Wyzowl, licencja CC0, folder sfx/). Każdy dźwięk aplikacji to jedna albo kilka warstw:
     [plik, przesunięcie w s, głośność]. Zanim pliki się wczytają (albo gdy się nie uda), gra syntezator niżej. */
  const SFX = {
    scan: [['click-tap-medium', 0, 0.8], ['tone-ding-high', 0.02, 0.45]],
    right: [['notification-success-chime', 0, 0.9]],
    wrong: [['notification-failure-pluck', 0, 0.8]],
    shelf: [['pop-medium-bubble', 0, 0.9]],
    flip: [['appear-flip-quick', 0, 0.9]],
    badge: [['notification-success-sparkle', 0, 0.95], ['shimmer-short-sparkle', 0.22, 0.55]],
    gold: [['sting-bright-short', 0, 0.95], ['shimmer-medium-sparkle', 0.32, 0.5]],
    level: [['celebration-popper', 0, 0.8], ['notification-success-fanfare', 0.06, 0.95], ['shimmer-medium-sparkle', 0.36, 0.45]],
    challenge: [['notification-success-fanfare', 0, 0.95], ['celebration-confetti', 0.04, 0.6]]
  };
  const SFX_GAIN = 3.2; // nagrania z zestawu są ciche (pod lektora); w telefonie mają być wyraźne, kompresor pilnuje szczytów
  const sfxBuf = {}; let sfxLoading = null;
  const loadSfx = () => sfxLoading || (sfxLoading = Promise.all([...new Set(Object.values(SFX).flat().map(l => l[0]))].map(async n => {
    try { const r = await fetch('sfx/' + n + '.mp3'); if (!r.ok) return; const ab = await r.arrayBuffer(); sfxBuf[n] = await new Promise((ok, no) => { const p = ac.decodeAudioData(ab, ok, no); if (p && p.then) p.then(ok, no); }); } catch (e) { }
  })));
  function playSfx(name, t) {
    const layers = SFX[name]; if (!layers || !layers.every(l => sfxBuf[l[0]])) return false;
    layers.forEach(([n, d, v]) => { const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = sfxBuf[n]; g.gain.value = v * SFX_GAIN; s.connect(g); g.connect(master); s.start(t + d); });
    return true;
  }
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => { if (A.settings.sound !== false && audio()) loadSfx(); }, { once: true, passive: true }));
  const env = (g, t, vol, attack, dur) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); };
  const out = (node, send) => { node.connect(master); if (send && verb) { const s = ac.createGain(); s.gain.value = send; node.connect(s); s.connect(verb); } };
  const pan = (node, p) => { if (!p || !ac.createStereoPanner) return node; const sp = ac.createStereoPanner(); sp.pan.value = p; node.connect(sp); return sp; };
  // Prosty ton (zostawiony dla zgodności).
  function tone(t, freq, dur, o = {}) {
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t);
    if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, t + dur * 0.8);
    env(g, t, o.vol || 0.2, o.attack || 0.006, dur);
    osc.connect(g); out(pan(g, o.pan), o.send || 0); osc.start(t); osc.stop(t + dur + 0.05);
  }
  // Dzwonek (synteza FM): jasny atak, który szybko łagodnieje – brzmi jak moneta, dzwoneczek, celesta.
  function bell(t, f, dur, vol = 0.18, o = {}) {
    const car = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
    car.frequency.value = f; mod.frequency.value = f * (o.ratio || 3.5);
    mg.gain.setValueAtTime(f * (o.index || 2.2), t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + dur * 0.6);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g); env(g, t, vol, 0.004, dur);
    out(pan(g, o.pan), o.send ?? 0.5); car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  }
  // Blacha (dwa rozstrojone piły przez filtr, który się otwiera) – na fanfary.
  function brass(t, f, dur, vol = 0.09, o = {}) {
    const g = ac.createGain(), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(f * 1.2, t); lp.frequency.exponentialRampToValueAtTime(f * 6, t + 0.06); lp.frequency.exponentialRampToValueAtTime(f * 2.5, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.035); g.gain.setValueAtTime(vol, t + Math.max(0.05, dur - 0.18)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [-6, 6].forEach(cents => { const o2 = ac.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f; o2.detune.value = cents; o2.connect(lp); o2.start(t); o2.stop(t + dur + 0.05); });
    lp.connect(g); out(pan(g, o.pan), o.send ?? 0.35);
  }
  // Szum przez filtr: „wzlot” przed nagrodą, iskierki, talerz.
  let noiseBuf = null;
  function noise(t, dur, vol, o = {}) {
    if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) { const n = ac.sampleRate * 2; noiseBuf = ac.createBuffer(1, n, ac.sampleRate); const d = noiseBuf.getChannelData(0); let s = 11; for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; } }
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf; f.type = o.type || 'bandpass'; f.Q.value = o.q || 1.2;
    f.frequency.setValueAtTime(o.f1 || 1000, t); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    if (o.swell) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.85); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    else env(g, t, vol, o.attack || 0.004, dur);
    src.connect(f); f.connect(g); out(pan(g, o.pan), o.send ?? 0.3); src.start(t); src.stop(t + dur + 0.05);
  }
  // Miękkie „bum” pod nagrodą.
  function thump(t, vol = 0.5) { const o2 = ac.createOscillator(), g = ac.createGain(); o2.frequency.setValueAtTime(140, t); o2.frequency.exponentialRampToValueAtTime(48, t + 0.18); env(g, t, vol, 0.004, 0.32); o2.connect(g); out(g, 0.05); o2.start(t); o2.stop(t + 0.4); }
  // Iskierki: szybki deszcz wysokich dzwoneczków rozłożonych w stereo.
  function sparkle(t, n = 7, base = 2637, vol = 0.05) { const st = [0, 3, 7, 12, 5, 10, 15, 9, 14, 19]; for (let i = 0; i < n; i++) bell(t + i * 0.045, base * Math.pow(2, st[i % st.length] / 12), 0.35, vol * (1 - i / (n * 1.6)), { pan: ((i % 4) - 1.5) / 2, index: 1.2, ratio: 4.1, send: 0.7 }); }
  const SOUNDS = {
    scan: t => { bell(t, 1760, 0.16, 0.16, { index: 1, send: 0.15 }); tone(t, 880, 0.06, { type: 'triangle', vol: 0.08 }); },
    flip: t => { noise(t, 0.14, 0.12, { f1: 1500, f2: 4000, q: 0.8 }); tone(t + 0.13, 300, 0.06, { vol: 0.2 }); },
    // Trafione: dwa jasne dzwonki w górę i iskierka.
    right: t => { bell(t, 1175, 0.35, 0.2); bell(t + 0.09, 1568, 0.5, 0.22); sparkle(t + 0.16, 4, 3136, 0.04); },
    // Pudło: łagodne, nie karzące „hmm” w dół.
    wrong: t => { tone(t, 466, 0.18, { type: 'triangle', vol: 0.16 }); tone(t + 0.13, 392, 0.34, { type: 'triangle', vol: 0.15, send: 0.2 }); },
    // Na półkę: „pyk” z dzwoneczkiem.
    shelf: t => { tone(t, 420, 0.12, { vol: 0.28, glide: 980 }); bell(t + 0.07, 1319, 0.4, 0.14); },
    // Odznaka: wzlot, bum, arpeggio dzwonków, ciepły akord i iskierki.
    badge: t => {
      noise(t, 0.32, 0.18, { f1: 500, f2: 5000, q: 1.6, swell: true, send: 0.2 });
      const h = t + 0.3; thump(h, 0.45);
      [1047, 1319, 1568, 2093].forEach((f, i) => bell(h + i * 0.075, f, 0.9, 0.17, { pan: (i - 1.5) / 3 }));
      [523, 659, 784].forEach(f => brass(h + 0.3, f, 0.9, 0.035));
      sparkle(h + 0.36, 8, 2637, 0.05);
    },
    // Złoto: jak odznaka, plus fanfara i dłuższy deszcz iskier.
    gold: t => {
      SOUNDS.badge(t); const h = t + 0.3;
      [[784, 0], [1047, 0.14], [1319, 0.28]].forEach(([f, d]) => brass(h + 0.55 + d, f, 0.2, 0.07));
      [1047, 1319, 1568].forEach(f => brass(h + 0.97, f, 1.2, 0.06)); thump(h + 0.97, 0.4);
      sparkle(h + 1.0, 10, 3136, 0.05); noise(h + 0.97, 1.4, 0.05, { type: 'highpass', f1: 7000, q: 0.7, send: 0.5 });
    },
    // Nowy poziom / pełna strona: narastający wzlot, fanfara „ta-da-da-DAM”, talerz i iskry.
    level: t => {
      noise(t, 0.5, 0.2, { f1: 300, f2: 6000, q: 1.4, swell: true, send: 0.2 });
      const h = t + 0.48; thump(h, 0.5);
      [[523, 0, 0.13], [659, 0.13, 0.13], [784, 0.26, 0.13]].forEach(([f, d, l]) => brass(h + d, f, l + 0.05, 0.08));
      [523, 659, 784, 1047].forEach(f => brass(h + 0.42, f, 1.4, 0.055)); thump(h + 0.42, 0.55);
      [1047, 1319, 1568, 2093].forEach((f, i) => bell(h + 0.42 + i * 0.06, f, 1.2, 0.12, { pan: (i - 1.5) / 3 }));
      noise(h + 0.42, 1.6, 0.06, { type: 'highpass', f1: 6500, q: 0.7, send: 0.5 }); sparkle(h + 0.6, 10, 2637, 0.05);
    },
    // Wyzwanie ukończone: krótka fanfara z dzwonkami.
    challenge: t => {
      thump(t, 0.4); brass(t, 784, 0.14, 0.08); brass(t + 0.14, 784, 0.1, 0.07);
      [523, 659, 784, 1047].forEach(f => brass(t + 0.28, f, 1.0, 0.055)); thump(t + 0.28, 0.5);
      [1319, 1568, 2093].forEach((f, i) => bell(t + 0.28 + i * 0.07, f, 0.9, 0.13)); sparkle(t + 0.45, 7, 2637, 0.05);
    }
  };
  // Podgląd dźwięku bez głośnika (testy i nagrania): renderuje dźwięk do bufora.
  A.renderSound = async (name, seconds = 3.2) => {
    const C = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!C || !SOUNDS[name]) return null;
    if (audio()) await loadSfx();
    const off = new C(2, Math.round(44100 * seconds), 44100), keep = [ac, master, verb];
    ac = off; ({ m: master, verb } = build(off));
    try { if (!playSfx(name, 0.02)) SOUNDS[name](0.02); } finally { [ac, master, verb] = keep; }
    return off.startRendering();
  };
  const BUZZ = { scan: 40, right: [25, 40, 25], wrong: 60, badge: [30, 50, 30, 50, 80], gold: [30, 40, 30, 40, 30, 40, 120], level: [60, 60, 120], challenge: [40, 40, 80] };
  A.sound = name => {
    if (A.settings.sound === false || document.hidden) return;
    try { const c = audio(); if (c) { loadSfx(); if (!playSfx(name, c.currentTime + 0.01) && SOUNDS[name]) SOUNDS[name](c.currentTime + 0.02); } } catch (e) { }
    try { if (BUZZ[name] && navigator.vibrate) navigator.vibrate(BUZZ[name]); } catch (e) { }
  };
  const EVENT_SOUND = { guess_right: 'right', guess_wrong: 'wrong', shelf_add: 'shelf', swap_to_better: 'shelf' };

  /* ---------- Punkty, odznaki, gratulacje ---------- */
  A.award = (event, ctx = {}) => {
    if (EVENT_STATS[event]) A.track(EVENT_STATS[event]);
    const r = Game.award(A.game, A.cfg, event, Object.assign({ extra: A.extraMetrics() }, ctx));
    if (r.state !== A.game) { A.game = r.state; A.saveGame(); }
    if (EVENT_SOUND[event]) A.sound(EVENT_SOUND[event]);
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
  /* Na ekranie produktu gratulacje nie zasłaniają wyniku: czekają na pasku nagród (A.rewardBar), aż ktoś go stuknie. */
  A.holdRewards = () => A.current && A.current.screen === 'product';
  A.celebrate = events => {
    events.forEach(e => celQueue.push(e));
    if (A.holdRewards() || (A.$('reveal') && !A.$('reveal').hidden)) { if (A.rewardBar) A.rewardBar(); return; }
    if (A.$('celebrate').hidden) A.nextCelebration();
  };
  A.heldCelebrations = () => celQueue.slice();
  A.dropCelebrations = () => { celQueue.length = 0; };
  A.rewardChips = reward => {
    if (!reward) return '';
    if (typeof reward === 'string') return `<span class="reward-chip green">${A.esc(reward)}</span>`;
    const out = [];
    if (reward.points) out.push(`<span class="reward-chip gold">+${reward.points} pkt</span>`); // wersja D: bez kropli i nasion
    return out.join('');
  };
  const ITEM_NAMES = { seed_strawberry: 'Nasiona truskawki', seed_golden_carrot: 'Złota marchewka', seed_pumpkin: 'Nasiona dyni', deco_rainbow_fence: 'Tęczowy płotek', tool_golden_can: 'Złota konewka' };
  A.ITEM_NAMES = ITEM_NAMES;
  let celReturnFocus = null;
  A.nextCelebration = () => {
    const box = A.$('celebrate');
    const e = celQueue.shift();
    if (!e) { box.hidden = true; box.innerHTML = ''; document.body.style.overflow = ''; if (celReturnFocus && celReturnFocus.focus) celReturnFocus.focus(); if (A.rewardBar) A.rewardBar(); return; }
    if (box.hidden) celReturnFocus = document.activeElement;
    let ribbon, head, sub, emblem;
    if (e.type === 'achievement') {
      const a = ((A.cfg.achievements && A.cfg.achievements.achievements) || []).find(x => x.id === e.id) || {};
      ribbon = 'Nowa odznaka!'; head = e.name; sub = a.description || '';
      emblem = medalSvg(a.icon, a.category, true, 170, a.tier || 3, 'm-pop');
      setTimeout(() => A.sound(a.tier === 3 ? 'gold' : 'badge'), 250);
      if (a.tier) { head = e.name + ' · ' + ['brąz', 'srebro', 'złoto'][a.tier - 1]; }
    } else if (e.type === 'level') {
      ribbon = 'Nowy poziom!'; head = e.name; sub = 'Poziom ' + e.level + '. Tak trzymaj!';
      emblem = shieldSvg(e.level, 150);
      setTimeout(() => A.sound('level'), 250);
    } else {
      setTimeout(() => A.sound('challenge'), 250);
      ribbon = 'Wyzwanie ukończone!'; head = e.name; sub = 'Ukończone wyzwanie widać na ekranie głównym i w Kolekcji → Odznaki. Nowe pojawi się w poniedziałek.';
      emblem = medalSvg('trophy', 'wybory', true, 170, 3, 'm-pop'); // wersja D: medal zamiast paczki nasion truskawki z dawnej gry w ogródek
    }
    const colors = ['#9FCDB0', '#F5D36B', '#F2A15E', '#EFA2B4', '#C9DAEC', '#E4DAF0', '#2B2C30']; // wersja D: pastelowe konfetti
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
  A.toast = (msg, actionHtml, ms) => {
    const t = A.$('toast');
    t.innerHTML = A.esc(msg) + (actionHtml ? ' ' + actionHtml : '');
    t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms || 3800);
  };
  A.announce = msg => { let l = A.$('srLive'); if (!l) { l = document.createElement('div'); l.id = 'srLive'; l.className = 'sr'; l.setAttribute('aria-live', 'polite'); document.body.appendChild(l); } l.textContent = msg; };
  A.openDlg = id => { const d = A.$(id); if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute('open', ''); };
  A.closeDlg = d => { if (!d) return; if (d.close) d.close(); else d.removeAttribute('open'); };
  // Wersja D: bez maskotki (spokojniejszy wygląd dla dorosłych).
  A.mascot = () => '';
  // Zdjęcia kategorii (img/cat/*.webp): najwęższa kategoria produktu, która jest na liście kategorii aplikacji.
  const CAT_KEYS = new Set(SHOP_CATEGORIES.map(c => c.key));
  const CAT_ALIAS = { 'en:hams': 'en:prepared-meats', 'en:cold-cuts': 'en:prepared-meats', 'en:frankfurters': 'en:sausages', 'en:hazelnut-spreads': 'en:sweet-spreads', 'en:plain-yogurts': 'en:yogurts', 'en:plant-based-milks': 'en:plant-based-milk-alternatives', 'en:mineral-waters': 'en:waters', 'en:chips': 'en:crisps', 'en:carbonated-drinks': 'en:sodas', 'en:sweetened-beverages': 'en:sodas', 'en:fruit-based-beverages': 'en:fruit-juices', 'en:nectars': 'en:fruit-juices', 'en:orange-nectars': 'en:fruit-juices', 'en:bars-covered-with-chocolate': 'en:chocolates', 'en:confectioneries': 'en:candies', 'en:instant-beverages': 'en:coffees', 'pl:kawy-ziarniste': 'en:coffees', 'en:broths': 'en:soups', 'en:poultry-broth': 'en:soups', 'en:lagers': 'en:beers', 'en:beer': 'en:beers', 'en:dairy-creams': 'en:creams', 'en:sour-creams': 'en:creams', 'en:chicken-eggs': 'en:eggs', 'en:poultries': 'en:fresh-meats', 'en:meats': 'en:fresh-meats', 'en:fruits': 'en:fresh-fruits', 'en:vegetables': 'en:fresh-vegetables' };
  A.catKeyOf = cats => { const c = Array.isArray(cats) ? cats : []; for (let i = c.length - 1; i >= 0; i--) { if (CAT_KEYS.has(c[i])) return c[i]; if (CAT_ALIAS[c[i]] && CAT_KEYS.has(CAT_ALIAS[c[i]])) return CAT_ALIAS[c[i]]; } return ''; };
  // Gdy baza nie podaje kategorii: rozpoznanie po nazwie produktu (kolejność: od najbardziej szczegółowych).
  const NAME_RULES = [
    [/\b(parowk|kielbas|kabanos|frankfurter)/, 'en:sausages'],
    [/\b(sardyn|tunczyk|szprot|makrel)/, 'en:canned-fishes'],
    [/\b(losos|dorsz|pstrag|mintaj|filet rybn|ryba|ryby|sledz|fish)/, 'en:fishes'],
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
    [/\b(ogork|kiszon|marynowan|korniszon|gherkin|pickle)/, 'en:pickles'],
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
    [/\bwoda\b/, 'en:waters'],
    [/\b(piwo|piwa|lager|radler)\b/, 'en:beers'],
    [/\b(smietan|smietank)/, 'en:creams'],
    [/\b(jaja|jajka|jajko)\b/, 'en:eggs'],
    [/(kurczak|indyk|piers).*wedzon|wedzon.*(kurczak|indyk|piers)/, 'en:prepared-meats'],
    [/\b(schab|filet z kurczaka|piers z kurczaka|karkowk|mielon|udka|lopatk|poledwiczk|wolowin|indyk|kurczak)/, 'en:fresh-meats'],
    [/\b(pomidor|ogorek|marchew|papryk|salat|szpinak|ziemniak|cebul|brokul|kalafior|cukini|rzodkiew|kapust)/, 'en:fresh-vegetables'],
    [/\b(jablk|banan|borowk|truskawk|gruszk|pomarancz|mandaryn|winogron|cytryn|malin|sliwk|kiwi)/, 'en:fresh-fruits']
  ];
  A.catKeyByName = name => { const f = fold(name).replace(/[^a-z0-9 ]+/g, ' '); for (const [re, k] of NAME_RULES) if (re.test(f)) return k; return ''; };
  A.catImg = key => key && CAT_KEYS.has(key) ? 'img/cat/' + key.replace(/^en:/, '') + '.webp' : '';
  A.prodCatKey = p => p && p.kind !== 'cosmetic' ? (A.catKeyOf(p.categories) || A.catKeyByName(p.name)) : '';
  A.prodCatImg = p => p && p.kind !== 'cosmetic' ? A.catImg(A.catKeyOf(p.categories) || A.catKeyByName(p.name)) : '';
  // Wersja D: liniowe ikony celów i pozycji „Pilnuję” (kolor z otoczenia).
  const D_ICONS = {
    sugar: 'M7 9l5-3 5 3v6l-5 3-5-3zM7 9l5 3 5-3M12 12v6',
    heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10zM8 12h2l1-2 2 4 1-2h2',
    pressure: 'M4 16a8 8 0 1 1 16 0M12 16l4-5M5 16h1.5M17.5 16H19M12 8V9.5M7.5 10.5l1 1M16.5 10.5l-1 1',
    weight: 'M5 6h14l-1.5 13h-11zM9 11a3 3 0 0 1 6 0M12 11l1.6-1.6',
    protein: 'M3 10v4M6 7.5v9M18 7.5v9M21 10v4M6 12h12',
    fiber: 'M12 21V9M12 9c-2-1-3-3-3-5 2 1 3 3 3 5zM12 9c2-1 3-3 3-5-2 1-3 3-3 5zM12 15c-2-1-3.5-3-3.5-5 2 1 3.5 3 3.5 5zM12 15c2-1 3.5-3 3.5-5-2 1-3.5 3-3.5 5z',
    processing: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3M7.5 15h9',
    healthy: 'M5 19c0-8 6-14 14-14 0 8-6 14-14 14zM5 19l7-7',
    salt: 'M8 10h8l-1 10H9zM8 10a4 4 0 0 1 8 0M10.5 6.5h.01M13.5 6.5h.01M12 5h.01',
    fat: 'M12 3C9 8 6 11 6 15a6 6 0 0 0 12 0c0-4-3-7-6-12zM9.5 15a2.5 2.5 0 0 0 2.5 2.5',
    kcal: 'M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1 1 2 2 2 4 0-3 1-5 1-8z',
    palm: 'M12 21v-9M12 12c-1-3-4-5-8-4M12 12c1-3 4-5 8-4M12 12c-3-1-6 0-7 3M12 12c3-1 6 0 7 3',
    sweetener: 'M12 4v3M12 17v3M4 12h3M17 12h3M6.5 6.5l2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2M12 10a2 2 0 1 0 0 4a2 2 0 1 0 0-4',
    caffeine: 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M9 3c0 1.5 1 1.5 1 3M12.5 3c0 1.5 1 1.5 1 3',
    ban: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM5.6 5.6l12.8 12.8'
  };
  /* Kolor wyniku 0–100 (obręcz talerza, jak znak Lupki): czerwony → żółty → zielony, przystanki dobrane tak, żeby środek nie był oliwkowy. */
  const SCORE_STOPS = [[0, '#E5533D'], [25, '#EE8139'], [50, '#F2B43C'], [62, '#D9C13A'], [75, '#A3C23F'], [88, '#62B14B'], [100, '#2E9E55']];
  A.scoreColor = pct => {
    const p = Math.max(0, Math.min(100, Number(pct) || 0)), hx = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    for (let i = 1; i < SCORE_STOPS.length; i++) if (p <= SCORE_STOPS[i][0]) {
      const [p0, c0] = SCORE_STOPS[i - 1], [p1, c1] = SCORE_STOPS[i], t = (p - p0) / (p1 - p0);
      return '#' + hx(c0).map((x, j) => Math.round(x + (hx(c1)[j] - x) * t).toString(16).padStart(2, '0')).join('');
    }
    return SCORE_STOPS[SCORE_STOPS.length - 1][1];
  };
  A.pctText = pct => pct == null || pct === '' ? '' : `color:color-mix(in srgb,${A.scoreColor(pct)} 62%,#2B2C30)`;
  A.ringStyle = pct => pct == null || pct === '' ? '' : ` has-score" style="--sc:${A.scoreColor(pct)};--pdeg:${Math.max(4, Math.round(pct * 3.6))}deg`;
  A.pctStyle = pct => pct == null || pct === '' ? '' : ` style="background:${A.scoreColor(pct)}"`;
  A.dIcon = (name, size) => D_ICONS[name] ? `<svg class="d-ic" width="${size || 22}" height="${size || 22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${D_ICONS[name]}"/></svg>` : '';
  // Nazwa produktu w dwóch grubościach: pierwsze słowo cienko, reszta grubo.
  A.splitName = name => { const w = String(name || '').trim().split(/\s+/); if (w.length < 2) return `<span class="w-bold">${A.esc(w[0] || '')}</span>`; return `<span class="w-light">${A.esc(w[0])}</span> <span class="w-bold">${A.esc(w.slice(1).join(' '))}</span>`; };

  /* ---------- Nawigacja ---------- */
  /* Ekran ładowania z animowanym znakiem: zostaje, aż animacja się skończy (ok. 1,7 s od otwarcia), potem znika.
     Bez czekania: przy „ogranicz animacje”, w testach automatycznych i po stuknięciu. */
  A.bootDone = boot => {
    boot.dataset.hold = '1';
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gone = () => { if (!boot.isConnected) return; boot.classList.add('out'); setTimeout(() => boot.remove(), 260); };
    const left = 1750 - (window.performance ? performance.now() : 0);
    if (reduce || navigator.webdriver || left <= 0) { boot.remove(); return; }
    boot.addEventListener('click', gone, { once: true });
    setTimeout(gone, left);
  };
  /* Nazwa produktu dużymi literami: zamiast łamać słowo w środku („WIEPRZOW / Y”) zmniejszamy czcionkę, aż najdłuższe słowo się zmieści.
     Ponownie po wczytaniu czcionek (Montserrat jest szerszy niż czcionka zastępcza). */
  A.fitTitle = h => {
    if (!h) return;
    const fit = () => {
      if (!h.isConnected) return;
      h.style.fontSize = '';
      let size = parseFloat(getComputedStyle(h).fontSize) || 40, n = 0;
      while (h.scrollWidth > h.clientWidth + 1 && size > 18 && n++ < 30) { size = Math.floor(size * 0.93); h.style.fontSize = size + 'px'; }
    };
    fit();
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(fit);
  };
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
    else if (h === '#/album') screen = 'album';
    else if (h === '#/odkrycia') screen = 'discoveries';
    else if ((m = h.match(/^#\/album\/((?:[a-z]{2}:[a-z0-9-]{2,60})|other|cosmetics|karty|pelne|legendarne|blyszczace)$/))) { screen = 'albumPage'; arg = m[1]; }
    else if ((m = h.match(/^#\/lista\/([a-z]{2}:[a-z0-9-]{2,60})$/))) { screen = 'list'; arg = m[1]; }
    else if (h === '#/porownaj') screen = 'compare';
    else if (h === '#/uzupelnij') screen = 'fill';
    else if ((m = h.match(/^#\/szukaj(?:\/(.{1,60}))?$/))) { screen = 'search'; arg = m[1] || null; }
    if (screen === 'home' && !A.store.get('onboarded', false)) screen = 'start';
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 'scr-' + screen.toLowerCase()));
    document.body.classList.toggle('no-nav', screen === 'start');
    document.querySelectorAll('.tab').forEach(t => { if (t.dataset.tab === (screen === 'albumPage' || screen === 'discoveries' || screen === 'progress' || screen === 'fill' ? 'album' : screen)) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
    const first = !A.current.screen;
    const changed = A.current.screen !== screen || A.current.arg !== arg;
    A.current = { screen, arg };
    const boot = A.$('boot'); if (boot && !boot.dataset.hold) A.bootDone(boot);
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
  /* Moje sklepy (Profil → Gdzie robisz zakupy): podnoszą wyżej produkty z tych sklepów i podpowiadają sklep przy dodawaniu. Bez nich nic się nie zmienia. */
  A.myStores = () => { const v = A.store.get('d-stores', []); return (Array.isArray(v) ? v : []).filter(k => STORES.some(s => s.key === k)).slice(0, 6); };
  A.setMyStores = keys => A.store.set('d-stores', keys.filter(k => STORES.some(s => s.key === k)).slice(0, 6));
  A.storeLabel = key => (STORES.find(s => s.key === key) || {}).label || key;
  // Produkty, przy których już dopisaliśmy sklep albo ktoś odpowiedział „Nie teraz” – nie pytamy drugi raz.
  A.storeTagged = code => { const m = A.store.get('d-storetag', {}); return !!(m && Object.prototype.hasOwnProperty.call(m, code)); };
  A.markStoreTagged = (code, key) => { const m = A.store.get('d-storetag', {}) || {}; m[code] = key || ''; const ks = Object.keys(m); if (ks.length > 500) delete m[ks[0]]; A.store.set('d-storetag', m); };
  /* Wybór sklepu przy dodawaniu i uzupełnianiu: Twoje sklepy (pierwszy zaznaczony) + „inny”. Bez Twoich sklepów – nic. */
  A.storePickHtml = (name, sel) => {
    const my = A.myStores(); if (!my.length) return '';
    const s = sel === undefined ? my[0] : sel;
    return `<div class="store-pick" role="radiogroup" aria-label="Gdzie to kupujesz?"><span class="small" style="font-weight:800">Gdzie to kupujesz?</span>${my.map(k => `<label class="pchip"><input type="radio" name="${name}" value="${k}"${s === k ? ' checked' : ''}>${A.esc(A.storeLabel(k))}</label>`).join('')}<label class="pchip"><input type="radio" name="${name}" value=""${!s ? ' checked' : ''}>inny</label></div>`;
  };
  A.inMyStore = prod => A.myStores().find(k => A.storeOf(prod, k)) || null;
  A.storeOf = (prod, key) => (prod.stores || []).some(s => fold(s).replace(/\s+/g, '').includes(key));

  /* ---------- Historia ---------- */
  A.remember = (prod, an, pm) => {
    const hist = A.store.get('history', []).filter(h => h && h.code !== prod.code);
    const prev = A.store.get('history', []).find(h => h && h.code === prod.code) || {};
    hist.unshift({ code: prod.code, name: prod.name || 'Produkt bez nazwy', brand: prod.brand, image: A.safeImg(prod.image), score: an.score, pct: pm ? pm.pct : null, level: pm ? pm.level : null, kind: prod.kind, categories: (prod.categories || []).slice(-4), alt: prev.alt || null, at: Date.now() });
    A.store.set('history', hist.slice(0, 30));
    if (A.putDetail && prod.source === 'off' && !prod.snapshot) A.putDetail(prod);
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
  let stream = null, scanning = false, detector = null, lastCand = null, sameCount = 0, canvas = null, zxReader = null, scanReturn = null, scanStart = 0, hinted = false;
  A.openScanner = async () => {
    scanReturn = document.activeElement;
    A.$('scanner').hidden = false; A.$('scanErr').hidden = true; A.$('reticle').hidden = false; A.$('torchBtn').hidden = true; A.$('torchSpacer').hidden = false;
    A.$('scanHint').textContent = 'Skieruj aparat na kod kreskowy. Odczyt nastąpi sam.'; A.$('scanMsg').textContent = '';
    document.body.style.overflow = 'hidden';
    setTimeout(() => A.$('scanner').querySelector('[data-act=close-scan]').focus(), 30);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return scanError('Ta przeglądarka nie daje dostępu do aparatu', 'Wpisz cyfry spod kodu poniżej albo wybierz zdjęcie kodu.');
    try {
      stream = await openCamera();
    } catch (e) {
      return scanError('Nie mamy dostępu do aparatu', e && e.name === 'NotAllowedError' ? 'Zezwól na dostęp do aparatu w ustawieniach przeglądarki albo wpisz cyfry spod kodu poniżej.' : 'Nie znaleźliśmy aparatu albo używa go inna aplikacja. Wpisz cyfry spod kodu poniżej.');
    }
    if (A.$('scanner').hidden) { stopStream(); return; }
    const video = A.$('video'); video.srcObject = stream;
    try { await video.play(); } catch (e) { }
    const track = stream.getVideoTracks()[0];
    try { const caps = track.getCapabilities ? track.getCapabilities() : {}; if (caps.torch) { A.$('torchBtn').hidden = false; A.$('torchSpacer').hidden = true; } } catch (e) { }
    await tuneCamera(track);
    A.$('scanner').onclick = e => { if (!e.target.closest('button,a,input,form,.scan-err')) A.refocus(); };
    detector = await nativeDetector();
    if (!detector) {
      try { await A.loadScript(ZXING_URLS); } catch (e) { return scanError('Nie udało się uruchomić skanera', 'Sprawdź połączenie z internetem albo wpisz cyfry spod kodu poniżej.'); }
    }
    scanning = true; lastCand = null; sameCount = 0; scanStart = Date.now(); hinted = false;
    tick();
  };
  /* Aparat do kodów. Telefony z kilkoma aparatami z tyłu potrafią dać szerokokątny bez autofokusa (ostry tylko na jedną
     odległość). Wybieramy tylny aparat z ciągłym autofokusem i zapamiętujemy go w telefonie (d-cam). */
  const camVideo = id => ({ video: Object.assign(id ? { deviceId: { exact: id } } : { facingMode: { ideal: 'environment' } }, { width: { ideal: 1920 }, height: { ideal: 1080 } }), audio: false });
  const camCaps = st => { try { const t = st.getVideoTracks()[0]; return t && t.getCapabilities ? t.getCapabilities() : {}; } catch (e) { return {}; } };
  const hasAF = caps => Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous');
  async function openCamera() {
    const saved = A.store.get('d-cam', '');
    if (saved) { try { return await navigator.mediaDevices.getUserMedia(camVideo(saved)); } catch (e) { A.store.set('d-cam', ''); } }
    let st = await navigator.mediaDevices.getUserMedia(camVideo(null));
    const caps = camCaps(st);
    // Brak informacji o ostrości (np. iPhone): zostajemy przy aparacie wybranym przez system.
    if (!Array.isArray(caps.focusMode) || hasAF(caps) || !navigator.mediaDevices.enumerateDevices) { if (caps.deviceId && hasAF(caps)) A.store.set('d-cam', caps.deviceId); return st; }
    try {
      const cur = caps.deviceId, devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput' && d.deviceId !== cur && !/front|przed|user|selfie/i.test(d.label));
      for (const d of devs) {
        let alt = null;
        try { st.getTracks().forEach(t => t.stop()); alt = await navigator.mediaDevices.getUserMedia(camVideo(d.deviceId)); } catch (e) { alt = null; }
        if (alt && hasAF(camCaps(alt))) { A.store.set('d-cam', d.deviceId); return alt; }
        if (alt) alt.getTracks().forEach(t => t.stop());
      }
    } catch (e) { }
    // Żaden nie ma autofokusa: wracamy do domyślnego.
    try { st.getTracks().forEach(t => t.stop()); } catch (e) { }
    return navigator.mediaDevices.getUserMedia(camVideo(null));
  }
  // Ciągły autofokus, a przy dużym zoomie lekkie przybliżenie: kod da się czytać z dalszej odległości, w zasięgu ostrości.
  async function tuneCamera(track) {
    if (!track || !track.getCapabilities) return;
    let caps = {}; try { caps = track.getCapabilities(); } catch (e) { return; }
    const adv = {};
    if (hasAF(caps)) adv.focusMode = 'continuous';
    if (caps.zoom && caps.zoom.max >= 2 && caps.zoom.min <= 1.5) adv.zoom = 1.5;
    if (Object.keys(adv).length) { try { await track.applyConstraints({ advanced: [adv] }); } catch (e) { } }
  }
  // Stuknięcie w obraz: ponowne ustawienie ostrości (tam, gdzie telefon na to pozwala).
  A.refocus = async () => {
    const track = stream && stream.getVideoTracks()[0]; if (!track || !track.getCapabilities) return;
    let caps = {}; try { caps = track.getCapabilities(); } catch (e) { return; }
    const modes = Array.isArray(caps.focusMode) ? caps.focusMode : [];
    try {
      if (modes.includes('single-shot')) await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] });
      if (modes.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
    } catch (e) { }
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
        // Ten sam kod dwa razy z rzędu (krótki EAN-8 trzy razy): na wygiętej puszce aparat potrafi odczytać
        // fragment kresek jako inny, poprawny kod. Druga zgodna klatka to ok. 0,1 s więcej, a eliminuje pomyłki.
        sameCount = code === lastCand ? sameCount + 1 : 1; lastCand = code;
        if (sameCount >= (code.length === 8 ? 3 : 2)) { found(code); return; }
      }
    }
    if (scanStart && Date.now() - scanStart > 6000 && !hinted) { hinted = true; A.$('scanHint').textContent = 'Nie odczytuje? Odsuń telefon na 20–30 cm (z bliska aparat nie łapie ostrości), stuknij w obraz, ustaw kod płasko w ramce (puszkę obróć) i włącz latarkę, jeśli jest ciemno.'; }
    setTimeout(() => scanning && requestAnimationFrame(tick), detector ? 80 : 140);
  }
  function found(code) {
    if (A.settings.sound === false && navigator.vibrate) { try { navigator.vibrate(60); } catch (e) { } }
    A.sound('scan');
    if (A.markCameraScan) A.markCameraScan(code);
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
  /* Kody kreskowe na zdjęciu (odkrywcy: kod ze zdjęcia musi zgadzać się ze skanem). Zwraca listę poprawnych kodów. */
  A.findCodes = async blob => {
    try {
      const img = await A.downscale(blob, 1600), out = [];
      const det = await nativeDetector();
      if (det) { try { (await det.detect(img)).forEach(r => out.push(r.rawValue)); } catch (e) { } }
      if (!out.length) { try { await A.loadScript(ZXING_URLS); const c = zxDecode(img); if (c) out.push(c); } catch (e) { } }
      return [...new Set(out.map(c => c.length === 12 ? '0' + c : c).filter(c => validBarcode(c)))];
    } catch (e) { return []; }
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
