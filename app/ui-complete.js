/* Dobre czy nie? – uzupełnianie produktu: skład odczytany ze zdjęcia (do sprawdzenia) i wartości odżywcze na 100 g.
   Open Food Facts odczytuje tekst ze zdjęcia, ale nie wpisuje go sam do produktu. Robimy to razem z użytkownikiem:
   on poprawia odczyt, my zapisujemy przez pośrednika (tylko pola, których jeszcze nie ma). */
'use strict';
(() => {
  const A = App, esc = A.esc;
  const proxy = () => (A.CFG.offProxyUrl || '').replace(/\/$/, '');
  const NUT_FIELDS = [
    ['energy-kcal', 'Wartość energetyczna', 'kcal', true], ['fat', 'Tłuszcz', 'g', true], ['saturated-fat', 'w tym kwasy nasycone', 'g', true],
    ['carbohydrates', 'Węglowodany', 'g', true], ['sugars', 'w tym cukry', 'g', true], ['fiber', 'Błonnik', 'g', false],
    ['proteins', 'Białko', 'g', true], ['salt', 'Sól', 'g', true]
  ];
  const NUT_KEY = { 'energy-kcal': 'kcal', fat: 'fat', 'saturated-fat': 'sat', carbohydrates: 'carbs', sugars: 'sugars', fiber: 'fiber', proteins: 'proteins', salt: 'salt' };

  // Odczyt ze zdjęcia bywa za długi: ucinamy etykietę „Skład:” i to, co zwykle stoi za składem.
  A.trimOcr = raw => {
    let s = String(raw || '').replace(/\s+/g, ' ').trim();
    s = s.replace(/^(skład|składniki|ingredients)\s*[:.-]\s*/i, '');
    const f = fold(s);
    const stops = ['nalezy ', 'nr partii', 'najlepiej spozyc', 'przechowywac', 'wartosc odzywcza', 'wartosci odzywcze', 'data minimalnej', 'masa netto', 'wyprodukowano', 'producent:', 'zawartosc netto', 'po otwarciu'];
    let cut = s.length;
    stops.forEach(w => { const i = f.indexOf(w); if (i > 15 && i < cut) cut = i; });
    return s.slice(0, cut).replace(/[\s,;.-]+$/, '').trim();
  };
  // Liczby z polskim przecinkiem; puste = brak.
  A.parseNum = v => { const t = String(v == null ? '' : v).trim().replace(',', '.').replace(/\s/g, ''); if (!t) return null; const n = Number(t); return isFinite(n) ? n : NaN; };
  /* Jaka część słów odczytanych ze zdjęcia została we wpisanym składzie (0–1). Bez odczytu: 1 (nie ma z czym porównać). */
  A.ocrMatch = (ocr, typed) => {
    const words = t => (fold(t || '').match(/[a-z]{4,}/g) || []);
    const o = [...new Set(words(ocr))];
    if (o.length < 5) return 1;
    const t = [...new Set(words(typed))], tw = new Set(t), os = new Set(o);
    if (!t.length) return 0;
    // Większa z dwóch: ile odczytu zostało we wpisie i ile wpisu jest w odczycie (usunięcie zbędnego tekstu nie karze).
    return Math.max(o.filter(w => tw.has(w)).length / o.length, t.filter(w => os.has(w)).length / t.length);
  };
  /* Wartości odżywcze z tekstu odczytanego ze zdjęcia tabeli. Zwraca { values, per } – tylko to, co udało się znaleźć;
     resztę człowiek dopisuje, a A.nutProblem sprawdza, czy liczby do siebie pasują (np. kalorie do makroskładników).
     Tabela bywa odczytana wierszami („Białko 8 g”) albo kolumnami (najpierw nazwy, potem liczby) – obsługujemy oba. */
  // Polskie nazwy, a dla tabel wielojęzycznych także angielskie (np. „of which saturates”).
  const NUT_RULES = [['saturated-fat', /nasycon|kwasy|tluszczow|saturate/], ['sugars', /cukr|sugar/], ['fat', /tluszcz|(^|[^a-z])fat([^a-z]|$)/], ['carbohydrates', /weglowodan|carbohydrate/], ['fiber', /blonnik|fibre|fiber/], ['proteins', /bialk|protein/], ['salt', /(^|[^a-z])(sol|salt)([^a-z]|$)/]];
  A.parseNutText = raw => {
    const t = String(raw || '').replace(/\r/g, '').replace(/(\d)\s*,\s*(\d)/g, '$1.$2');
    // Odczyt myli zero z literą O („Sól OG”, „0 q”): poprawiamy przed szukaniem liczb.
    const f = fold(t).replace(/(^|[\s(:])o\s?[gq](?=[^a-z]|$)/g, '$1 0 g').replace(/(\d)\s?q(?=[^a-z]|$)/g, '$1 g'), values = {};
    const per = /100\s*ml/.test(f) && !/100\s*g(?![a-z])/.test(f) ? 'ml' : 'g';
    const kc = f.match(/(\d+(?:\.\d+)?)\s*kcal/); if (kc) values['energy-kcal'] = Number(kc[1]);
    const lines = f.split('\n').map(l => l.trim()).filter(l => l && !/nienasycon|unsaturate/.test(l));
    const numIn = s => { const m = s.match(/<?\s*(\d+(?:\.\d+)?)\s*(?:g(?![a-z])|$|\s|\)|,)/); return m ? Number(m[1]) : null; };
    const pending = [];
    lines.forEach((ln, i) => {
      // Wszystkie nazwy w wierszu (tabela bywa jednym zdaniem: „tłuszcz 1,2 g (w tym nasycone 1,2 g), węglowodany…”).
      const hits = [];
      NUT_RULES.forEach(([k, re]) => { const g = new RegExp(re.source, 'g'); let m; while ((m = g.exec(ln))) { hits.push({ k, s: m.index, e: m.index + m[0].length }); if (!m[0].length) g.lastIndex++; } });
      if (!hits.length) return;
      // „tłuszczowe” to też „tłuszcz”: z nakładających się trafień zostaje dłuższe (tu: kwasy tłuszczowe = nasycone).
      hits.sort((a, b) => a.s - b.s || (b.e - b.s) - (a.e - a.s));
      for (let n = hits.length - 1; n > 0; n--) if (hits.slice(0, n).some(o => hits[n].s < o.e)) hits.splice(n, 1);
      hits.forEach((h, n) => {
        if (values[h.k] != null) return;
        const nx = hits[n + 1];
        if (nx && nx.k === h.k) return; // „nasycone kwasy tłuszczowe 1,2 g”: liczba stoi po ostatnim słowie
        let v = numIn(ln.slice(h.e, nx ? nx.s : ln.length) + ' ');
        if (v == null && !nx && lines[i + 1] && /^<?\s*\d+(?:\.\d+)?\s*g$/.test(lines[i + 1]) && !pending.length) v = numIn(lines[i + 1]);
        if (v == null) { if (!pending.includes(h.k)) pending.push(h.k); } else values[h.k] = v;
      });
    });
    // Odczyt kolumnami: nazwy bez liczb, a potem same liczby z „g” w tej samej kolejności.
    const todo = pending.filter(k => values[k] == null);
    if (todo.length) {
      const nums = lines.filter(l => /^<?\s*\d+(?:\.\d+)?\s*g$/.test(l)).map(numIn);
      todo.forEach((k, n) => { if (nums[n] != null && values[k] == null) values[k] = nums[n]; });
    }
    Object.keys(values).forEach(k => { const v = values[k]; if (!isFinite(v) || v < 0 || (k === 'energy-kcal' ? v > 900 : v > 100)) delete values[k]; });
    return { values, per };
  };
  A.nutProblem = n => {
    if (n['energy-kcal'] == null) return 'Wpisz wartość energetyczną w kcal (na 100 g).';
    for (const [k, label, , req] of NUT_FIELDS) {
      const v = n[k];
      if (v == null) { if (req) return `Wpisz: ${label.toLowerCase()}.`; continue; }
      if (isNaN(v) || v < 0) return `${label}: wpisz liczbę, np. 4,5.`;
      if (k === 'energy-kcal' ? v > 900 : v > 100) return `${label}: za duża wartość na 100 g. Sprawdź, czy to kolumna „na 100 g”.`;
    }
    if (n['saturated-fat'] > n.fat) return 'Kwasy nasycone nie mogą być większe niż tłuszcz.';
    if (n.sugars > n.carbohydrates) return 'Cukry nie mogą być większe niż węglowodany.';
    if ((n.fat || 0) + (n.carbohydrates || 0) + (n.proteins || 0) + (n.salt || 0) + (n.fiber || 0) > 105) return 'Suma tłuszczu, węglowodanów, białka, błonnika i soli przekracza 100 g. Sprawdź liczby.';
    // Odkrywcy: kalorie muszą pasować do białka, węglowodanów i tłuszczu (zmyślone liczby zwykle się nie sumują).
    if (n.fat != null && n.carbohydrates != null && n.proteins != null) {
      const est = 9 * n.fat + 4 * n.carbohydrates + 4 * n.proteins + 2 * (n.fiber || 0);
      if (Math.abs(n['energy-kcal'] - est) > Math.max(30, 0.25 * Math.max(est, n['energy-kcal']))) return `Kalorie (${n['energy-kcal']} kcal) nie pasują do białka, węglowodanów i tłuszczu (wychodzi ok. ${Math.round(est)} kcal). Sprawdź liczby.`;
    }
    return '';
  };

  async function post(path, fields, file) {
    const fd = new FormData();
    Object.entries(Object.assign({ lang: 'pl', app_uuid: A.appUuid(), app_version: A.CFG.appVersion || '1.0' }, fields)).forEach(([k, v]) => fd.append(k, v));
    if (file) fd.append('photo', file, 'photo.jpg');
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 45000);
    try {
      const r = await fetch(proxy() + path, { method: 'POST', body: fd, signal: ctrl.signal });
      let j = {}; try { j = await r.json(); } catch (e) { }
      return Object.assign({ status: r.status }, j);
    } catch (e) { return { status: 0, ok: false, error: navigator.onLine === false ? 'offline' : 'network' }; }
    finally { clearTimeout(t); }
  }

  /* Lokalna kopia produktu: pokazujemy ją od razu (też przy ponownym skanie), zanim baza udostępni produkt wszystkim. */
  function saveLocal(code, patch) {
    const local = A.store.get('local', {});
    const base = local[code] || { code, kind: 'food', source: 'local', name: '', brand: '', quantity: '', image: '', nutriscore: '', nova: null, additiveTags: null, allergens: [], traces: [], analysis: [], labels: [], ingredients: '', drink: false, category: '', categories: [], nutriments: {} };
    local[code] = Object.assign(base, patch);
    const keys = Object.keys(local); if (keys.length > 50) delete local[keys[0]];
    A.store.set('local', local);
    return local[code];
  }
  A.rememberAdded = (code, name) => saveLocal(code, { name, added: true, addedAt: Date.now() });

  /* Odczyt tabeli wartości ze zdjęcia (Open Food Facts odczytuje każde zdjęcie). Świeżo wysłane zdjęcie bywa odczytywane
     dopiero po chwili, więc przy nowym produkcie próbujemy kilka razy. Zwraca { values, per } albo null. */
  async function readNut(code, tries) {
    for (let i = 0; i < Math.max(tries, 2); i++) {
      const r = await post('/ocr', { code, field: 'nutrition' });
      if (r.ok && r.text) { const p = A.parseNutText(r.text); return Object.keys(p.values).length ? p : null; }
      if ((r.error !== 'not_ready' && r.error !== 'off_busy') || i === Math.max(tries, 2) - 1) return null;
      await new Promise(res => setTimeout(res, 3000 + i * 3000));
    }
    return null;
  }
  const fmt = v => String(v).replace('.', ',');

  /* Uzupełnianie w podanym elemencie. Gdy brakuje i składu, i wartości – jeden ekran z oboma, wypełniony odczytem ze zdjęć;
     człowiek tylko sprawdza i poprawia. opts: { code, name, needIngr, needNut, drink, fresh (świeżo dodany: zdjęcia jeszcze
     się odczytują), photos:{ingredients,nutrition} (Bloby), images:{ingredients,nutrition} (adresy z bazy), onDone, onNext } */
  A.openComplete = (el, opts) => {
    if (!el || !proxy()) return;
    const both = !!(opts.needIngr && opts.needNut);
    const st = Object.assign({ step: both ? 'both' : opts.needIngr ? 'ingr' : 'nut', saved: [], per: opts.drink ? 'ml' : 'g', nutRead: null }, opts);
    // Sklep jedzie razem z pierwszym zapisem (bez osobnego kroku). Pomijamy, gdy produkt ma już Twój sklep albo sklep już dopisano.
    st.store = !opts.storeDone && A.myStores().length ? A.myStores()[0] : null; st.storeAsk = !!st.store;
    const storeField = () => st.store && st.storeAsk ? { store: st.store } : {};
    const storeSaved = r => { if (st.storeAsk && (r.saved || []).includes('store')) { st.storeAsk = false; A.markStoreTagged(opts.code, st.store); A.award('store_added', { code: opts.code }); } };
    const perText = () => st.per === 'ml' ? 'na 100 ml' : 'na 100 g';
    const urls = {};
    ['ingredients', 'nutrition'].forEach(k => { if (st.photos && st.photos[k]) urls[k] = URL.createObjectURL(st.photos[k]); else if (st.images && A.safeImg(st.images[k])) urls[k] = A.safeImg(st.images[k]); });
    const total = both ? 1 : (opts.needIngr ? 1 : 0) + (opts.needNut ? 1 : 0);
    const stepNo = () => (st.step === 'ingr' ? 1 : opts.needIngr ? 2 : 1);
    const head = title => `<div class="sec-head"><b style="font-family:var(--f-display);font-size:1.15rem">${title}</b>${total > 1 ? `<span class="small muted">Krok ${stepNo()} z ${total}</span>` : ''}</div>${st.storeAsk ? A.storePickHtml('cmpStore', st.store) : ''}`;
    const photo = k => urls[k] ? `<img src="${esc(urls[k])}" alt="Zdjęcie: ${k === 'ingredients' ? 'skład' : 'wartości odżywcze'}" class="complete-photo">` : '';
    const photoBtn = (k, label) => `<span class="btn btn-blue btn-sm filebtn" style="align-self:flex-start"><svg><use href="#i-photo"/></svg>${label}<input type="file" accept="image/*" capture="environment" data-complete-photo="${k}" aria-label="${label}"></span>`;
    const pts = n => `(+${n} pkt)`;

    function next() {
      if (st.step === 'ingr' && opts.needNut) { st.step = 'nut'; renderNut(); return; }
      finish();
    }
    function finish() {
      Object.values(urls).forEach(u => { if (u.startsWith('blob:')) URL.revokeObjectURL(u); });
      if (opts.onDone) opts.onDone(st.saved);
    }
    const loading = (title, what) => { el.innerHTML = `<div class="panel stack">${head(title)}<p class="small muted">${what}</p><div class="sk" style="height:90px"></div></div>`; };
    // Bez zdjęcia składu nie ma czego odczytywać (odczyt trwa kilka sekund, więc go wtedy pomijamy).
    const ocrIngr = async () => { if (!urls.ingredients && !opts.fresh && !st.justUploaded) return ''; const r = await post('/ocr', { code: opts.code }); return r.ok ? A.trimOcr(r.text) : ''; };
    const nutTries = () => opts.fresh || st.justUploaded ? 5 : 1;

    // --- Fragmenty ekranu ---
    const ingrHtml = (text, afterPhoto) => {
      const noImage = !text && !urls.ingredients && !afterPhoto;
      return `${text ? '<p class="small">Tak odczytaliśmy skład ze zdjęcia. Popraw błędy i usuń to, co nie jest składem.</p>' : noImage
          ? `<p class="small">Zrób zdjęcie listy składników, odczytamy ją za Ciebie. Możesz też przepisać skład ręcznie.</p>${photoBtn('ingredients', 'Zdjęcie składu')}`
          : '<p class="small">Nie udało się odczytać tekstu ze zdjęcia. Przepisz skład z opakowania.</p>'}
        ${photo('ingredients')}
        <label class="small" for="cmpIngr" style="font-weight:800">Skład</label>
        <textarea class="field" id="cmpIngr" rows="6" maxlength="5000" placeholder="np. mleko, cukier, truskawki 8%, skrobia modyfikowana">${esc(text)}</textarea>
        <p class="msg" id="cmpIngrMsg" role="status"></p>`;
    };
    const nutHtml = read => {
      const per = perText(), vals = read ? read.values : {}, n = Object.keys(vals).length;
      return `<div class="nut-per" role="group" aria-label="Na ile podane są wartości na opakowaniu"><button type="button" data-cmp="per-g" aria-pressed="${st.per === 'g'}">na 100 g</button><button type="button" data-cmp="per-ml" aria-pressed="${st.per === 'ml'}">na 100 ml (napoje)</button></div>
        <p class="small">${n ? `Odczytaliśmy ze zdjęcia ${n} z ${NUT_FIELDS.length} pól (zaznaczone). Sprawdź je z kolumną <b class="nut-per-label">${per}</b> i dopisz brakujące.`
          : `Przepisz liczby z kolumny <b class="nut-per-label">${per}</b> w tabeli na opakowaniu, a nie z kolumny „porcja”.`}</p>
        ${urls.nutrition ? photo('nutrition') : photoBtn('nutrition', 'Zdjęcie tabeli')}
        <div class="nut-grid"><div class="nut-head" aria-hidden="true"><span>Składnik</span><span class="nut-per-label">${per}</span></div>
        ${NUT_FIELDS.map(([k, label, unit, req]) => `<label class="nut-row${k === 'saturated-fat' || k === 'sugars' ? ' sub' : ''}"><span class="nut-name">${label}${req ? '' : ' <span class="muted">(jeśli jest)</span>'}</span><span class="nut-in"><input class="field${vals[k] != null ? ' ocr' : ''}" inputmode="decimal" autocomplete="off" data-nut="${k}" data-label="${label}" data-unit="${unit}" aria-label="${label} w ${unit} ${per}" value="${vals[k] != null ? esc(fmt(vals[k])) : ''}"><span class="nut-unit muted">${unit}</span></span></label>`).join('')}</div>
        <p class="msg" id="cmpNutMsg" role="status"></p>`;
    };

    // --- Ekrany ---
    async function renderBoth(afterPhoto) {
      loading('Sprawdź skład i wartości', 'Odczytuję zdjęcia składu i tabeli…');
      const [text, read] = await Promise.all([st.ocr != null && !afterPhoto ? st.ocr : ocrIngr(), st.nutRead && !afterPhoto ? st.nutRead : readNut(opts.code, nutTries())]);
      if (!el.isConnected) return;
      st.ocr = text; st.nutRead = read; if (read && !opts.drink) st.per = read.per;
      el.innerHTML = `<div class="panel stack" id="completeBoth">${head('Sprawdź skład i wartości')}
        <div class="stack" id="completeIngr" style="gap:8px">${ingrHtml(text, afterPhoto)}</div>
        <div class="stack" id="completeNut" style="gap:8px"><b style="font-family:var(--f-display)">Wartości odżywcze</b>${nutHtml(read)}</div>
        <div class="actions"><button class="btn btn-gold" type="button" data-cmp="save-both">Zapisz ${pts(20)}</button><button class="btn btn-white" type="button" data-cmp="skip">Później</button></div>
        <p class="small muted">Dane trafią do otwartej bazy Open Food Facts, z której korzystają wszyscy.</p></div>`;
    }
    async function renderIngr(afterPhoto) {
      loading('Sprawdź skład', 'Odczytuję skład ze zdjęcia…');
      const text = await ocrIngr();
      if (!el.isConnected) return;
      st.ocr = text;
      el.innerHTML = `<div class="panel stack" id="completeIngr">${head('Sprawdź skład')}${ingrHtml(text, afterPhoto)}
        <div class="actions"><button class="btn btn-gold" type="button" data-cmp="save-ingr">Zapisz skład ${pts(10)}</button><button class="btn btn-white" type="button" data-cmp="skip">Pomiń</button></div>
        <p class="small muted">Skład trafi do otwartej bazy Open Food Facts, z której korzystają wszyscy.</p></div>`;
    }
    async function renderNut() {
      loading('Wartości odżywcze', 'Odczytuję tabelę ze zdjęcia…');
      const read = urls.nutrition || opts.fresh || st.justUploaded ? await readNut(opts.code, nutTries()) : null;
      if (!el.isConnected) return;
      st.nutRead = read; if (read && !opts.drink) st.per = read.per;
      el.innerHTML = `<div class="panel stack" id="completeNut">${head('Wartości odżywcze')}${nutHtml(read)}
        <div class="actions"><button class="btn btn-gold" type="button" data-cmp="save-nut">Zapisz wartości ${pts(10)}</button><button class="btn btn-white" type="button" data-cmp="skip">Pomiń</button></div></div>`;
    }
    const rerender = (afterPhoto) => st.step === 'both' ? renderBoth(afterPhoto) : st.step === 'ingr' ? renderIngr(afterPhoto) : renderNut();
    function setPer(v) {
      st.per = v; const per = perText();
      el.querySelectorAll('.nut-per-label').forEach(t => { t.textContent = per; });
      el.querySelectorAll('[data-cmp^="per-"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cmp === 'per-' + v)));
      el.querySelectorAll('[data-nut]').forEach(i => i.setAttribute('aria-label', `${i.dataset.label} w ${i.dataset.unit} ${per}`));
    }

    // --- Sprawdzenie wpisów ---
    const ingrValue = () => {
      const text = A.$('cmpIngr').value.replace(/\s+/g, ' ').trim(), msg = A.$('cmpIngrMsg');
      if (text.length < 8) { msg.textContent = 'Wpisz skład z opakowania, przynajmniej kilka składników.'; A.$('cmpIngr').focus(); return null; }
      if (A.ocrMatch(st.ocr, text) < 0.35) { msg.textContent = 'Wpisany skład bardzo różni się od tego, co widać na zdjęciu. Popraw tylko błędy odczytu i usuń to, co nie jest składem.'; A.$('cmpIngr').focus(); return null; }
      msg.textContent = ''; return text;
    };
    const nutValue = () => {
      const n = {}; el.querySelectorAll('[data-nut]').forEach(i => { n[i.dataset.nut] = A.parseNum(i.value); });
      const problem = A.nutProblem(n).replace('na 100 g', perText()), msg = A.$('cmpNutMsg');
      if (problem) { msg.textContent = problem; return null; }
      msg.textContent = ''; return Object.fromEntries(Object.entries(n).filter(([, v]) => v != null));
    };
    const failText = r => r.error === 'offline' ? 'Nie ma połączenia z internetem. Spróbuj, gdy wróci.' : 'Nie udało się zapisać. Spróbuj ponownie za chwilę.';
    const afterSave = (r, kinds, text, clean) => {
      if (text) saveLocal(opts.code, { ingredients: text.slice(0, 5000) });
      if (clean) { const nm = {}; Object.entries(clean).forEach(([k, v]) => { nm[NUT_KEY[k]] = v; }); saveLocal(opts.code, { nutriments: nm }); }
      storeSaved(r);
      kinds.forEach(([kind, ev, what]) => {
        if (r.ok && (r.saved || []).includes(kind)) { st.saved.push(kind); A.award(ev, { code: opts.code }); }
        else if (!(r.saved || []).includes(kind)) A.toast(`Ktoś już uzupełnił ${what} tego produktu. Dziękujemy!`);
      });
    };

    el.onclick = async e => {
      const b = e.target.closest('[data-cmp]'); if (!b || b.disabled) return;
      const act = b.dataset.cmp;
      if (act === 'skip') { next(); return; }
      if (act === 'per-g' || act === 'per-ml') { setPer(act === 'per-ml' ? 'ml' : 'g'); return; }
      const label = b.textContent;
      if (act === 'save-both') {
        const text = ingrValue(); if (text == null) return;
        const clean = nutValue(); if (!clean) return;
        b.disabled = true; b.textContent = 'Zapisuję…';
        const r = await post('/edit', Object.assign({ code: opts.code, ingredients_text: text, nutriments: JSON.stringify(clean) }, storeField()));
        if (r.ok || r.error === 'exists') { afterSave(r, [['ingredients', 'ingredients_added', 'skład'], ['nutrition', 'nutrition_added', 'wartości']], text, clean); finish(); }
        else { b.disabled = false; b.textContent = label; A.$('cmpNutMsg').textContent = failText(r); }
      }
      if (act === 'save-ingr') {
        const text = ingrValue(); if (text == null) return;
        b.disabled = true; b.textContent = 'Zapisuję…';
        const r = await post('/edit', Object.assign({ code: opts.code, ingredients_text: text }, storeField()));
        if (r.ok || r.error === 'exists') { afterSave(r, [['ingredients', 'ingredients_added', 'skład']], text, null); next(); }
        else { b.disabled = false; b.textContent = label; A.$('cmpIngrMsg').textContent = failText(r); }
      }
      if (act === 'save-nut') {
        const clean = nutValue(); if (!clean) return;
        b.disabled = true; b.textContent = 'Zapisuję…';
        const r = await post('/edit', Object.assign({ code: opts.code, nutriments: JSON.stringify(clean) }, storeField()));
        if (r.ok || r.error === 'exists') { afterSave(r, [['nutrition', 'nutrition_added', 'wartości']], null, clean); next(); }
        else { b.disabled = false; b.textContent = label; A.$('cmpNutMsg').textContent = failText(r); }
      }
    };
    el.oninput = e => { if (e.target.classList && e.target.classList.contains('ocr')) e.target.classList.remove('ocr'); };
    el.onchange = async e => {
      if (e.target.name === 'cmpStore') { st.store = e.target.value || null; return; }
      const inp = e.target.closest('[data-complete-photo]'); if (!inp) return;
      const k = inp.dataset.completePhoto, f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
      loading(k === 'nutrition' ? 'Wartości odżywcze' : 'Sprawdź skład', 'Wysyłam zdjęcie i odczytuję…');
      try {
        const blob = await A.downscale(f, 1600, 'blob');
        const r = await post('/image', { code: opts.code, field: k }, blob);
        if (r.ok) { urls[k] = URL.createObjectURL(blob); st.justUploaded = true; A.award('photo_added', { code: opts.code }); }
      } catch (err) { }
      if (k === 'nutrition') st.nutRead = null; else st.ocr = null;
      rerender(true);
    };
    rerender(false);
  };

  /* „Uzupełnij dane”: najpopularniejsze polskie produkty, które mają w bazie zdjęcie składu albo tabeli, ale nikt ich
     nie przepisał (lista z kopii bazy: data/uzupelnij.json, odświeżana co tydzień). Nie trzeba mieć produktu w ręku:
     odczytujemy zdjęcie, człowiek sprawdza. Zrobione i pominięte zapamiętujemy w telefonie (d-fill). */
  let fillP = null;
  const fillList = () => fillP || (fillP = fetch('../data/uzupelnij.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null));
  const fillState = () => Object.assign({ done: [], skip: [] }, A.store.get('d-fill', {}));
  A.fillDone = (code, saved) => {
    const f = fillState(), key = saved && saved.length ? 'done' : 'skip';
    if (!f[key].includes(code)) f[key] = f[key].concat(code).slice(-500);
    A.store.set('d-fill', f); A.fillFrom = null;
  };
  A.fillCount = async () => { const d = await fillList(); if (!d || !Array.isArray(d.items)) return 0; const f = fillState(); return d.items.filter(x => !f.done.includes(x.c)).length; };
  A.route('fill', async () => {
    const el = A.$('scr-fill'); const f = fillState();
    el.innerHTML = `<div class="wrap"><div class="topbar"><a class="btn btn-white iconbtn" href="#/postepy" aria-label="Wróć"><svg><use href="#i-back"/></svg></a><h1 class="grow" style="font-size:1.25rem">Uzupełnij dane</h1>${A.hudPill()}</div>
      <p class="small">Te popularne produkty mają w bazie zdjęcie składu albo tabeli wartości, ale nikt ich jeszcze nie przepisał, więc nie mają pełnej oceny. Odczytamy zdjęcie za Ciebie, Ty tylko sprawdzasz. Produkt nie musi być w domu.</p>
      <div id="fillList" class="stack"><div class="sk" style="height:70px"></div><div class="sk" style="height:70px"></div></div></div>`;
    const d = await fillList();
    const box = A.$('fillList'); if (!box || A.current.screen !== 'fill') return;
    if (!d || !Array.isArray(d.items)) { box.innerHTML = '<div class="empty">Nie udało się wczytać listy. Sprawdź internet i spróbuj ponownie.</div>'; return; }
    const todo = d.items.filter(x => !f.done.includes(x.c)).sort((a, b) => (f.skip.includes(a.c) - f.skip.includes(b.c)));
    const what = k => [k.includes('s') && 'skład', k.includes('w') && 'wartości odżywcze'].filter(Boolean).join(' i ');
    box.innerHTML = `<p class="small muted" style="font-weight:800">${f.done.length ? `UZUPEŁNIŁEŚ: ${f.done.length} · ` : ''}CZEKA: ${todo.length}</p>
      ${todo.slice(0, 40).map(x => `<a class="item fill-item" href="#/p/${esc(x.c)}" data-act="fill-go" data-code="${esc(x.c)}">${A.safeImg(x.i) ? `<img class="thumb" src="${esc(A.safeImg(x.i))}" alt="" loading="lazy">` : '<span class="thumb"></span>'}<span class="grow"><span class="t1">${esc(x.n || x.c)}</span><span class="t2">${esc(x.b || '')}${x.b ? ' · ' : ''}brakuje: ${what(x.k)}</span></span><span class="pct" style="background:#FFF2C2;color:#6B4A00">+${10 * x.k.length}</span></a>`).join('')}
      ${todo.length ? '' : '<div class="empty">Wszystko z tej listy jest uzupełnione. Dziękujemy! Nowe produkty pojawią się po cotygodniowej aktualizacji bazy.</div>'}`;
  });
})();
