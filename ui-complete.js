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

  /* Kroki uzupełniania w podanym elemencie. opts: { code, name, needIngr, needNut, photos:{ingredients,nutrition} (Bloby), images:{ingredients,nutrition} (adresy z bazy), onDone } */
  A.openComplete = (el, opts) => {
    if (!el || !proxy()) return;
    const st = Object.assign({ step: opts.needIngr ? 'ingr' : 'nut', saved: [], per: opts.drink ? 'ml' : 'g' }, opts);
    // Sklep jedzie razem z pierwszym zapisem (bez osobnego kroku). Pomijamy, gdy produkt ma już Twój sklep albo sklep już dopisano.
    st.store = !opts.storeDone && A.myStores().length ? A.myStores()[0] : null; st.storeAsk = !!st.store;
    const storeField = () => st.store && st.storeAsk ? { store: st.store } : {};
    const storeSaved = r => { if (st.storeAsk && (r.saved || []).includes('store')) { st.storeAsk = false; A.markStoreTagged(opts.code, st.store); A.award('store_added', { code: opts.code }); } };
    const perText = () => st.per === 'ml' ? 'na 100 ml' : 'na 100 g';
    const urls = {};
    ['ingredients', 'nutrition'].forEach(k => { if (st.photos && st.photos[k]) urls[k] = URL.createObjectURL(st.photos[k]); else if (st.images && A.safeImg(st.images[k])) urls[k] = A.safeImg(st.images[k]); });
    const total = (opts.needIngr ? 1 : 0) + (opts.needNut ? 1 : 0);
    const stepNo = () => (st.step === 'ingr' ? 1 : opts.needIngr ? 2 : 1);
    const head = title => `<div class="sec-head"><b style="font-family:var(--f-display);font-size:1.15rem">${title}</b>${total > 1 ? `<span class="small muted">Krok ${stepNo()} z ${total}</span>` : ''}</div>${st.storeAsk ? A.storePickHtml('cmpStore', st.store) : ''}`;
    const photo = k => urls[k] ? `<img src="${esc(urls[k])}" alt="Zdjęcie: ${k === 'ingredients' ? 'skład' : 'wartości odżywcze'}" class="complete-photo">` : '';

    function next() {
      if (st.step === 'ingr' && opts.needNut) { st.step = 'nut'; renderNut(); return; }
      finish();
    }
    function finish() {
      Object.values(urls).forEach(u => { if (u.startsWith('blob:')) URL.revokeObjectURL(u); });
      if (opts.onDone) opts.onDone(st.saved);
    }

    async function renderIngr(afterPhoto) {
      el.innerHTML = `<div class="panel stack" id="completeIngr">${head('Sprawdź skład')}
        <p class="small muted">Odczytuję skład ze zdjęcia…</p><div class="sk" style="height:90px"></div></div>`;
      const r = await post('/ocr', { code: opts.code });
      if (!el.isConnected) return;
      const text = r.ok ? A.trimOcr(r.text) : '';
      st.ocr = text;
      const noImage = !r.ok && !urls.ingredients && !afterPhoto;
      el.innerHTML = `<div class="panel stack" id="completeIngr">${head('Sprawdź skład')}
        ${text ? '<p class="small">Tak odczytaliśmy skład ze zdjęcia. Popraw błędy i usuń to, co nie jest składem.</p>' : noImage
          ? '<p class="small">Zrób zdjęcie listy składników, odczytamy ją za Ciebie. Możesz też przepisać skład ręcznie.</p><span class="btn btn-blue btn-sm filebtn" style="align-self:flex-start"><svg><use href="#i-photo"/></svg>Zdjęcie składu<input type="file" accept="image/*" capture="environment" data-complete-photo="ingredients" aria-label="Zdjęcie składu"></span>'
          : '<p class="small">Nie udało się odczytać tekstu ze zdjęcia. Przepisz skład z opakowania.</p>'}
        ${photo('ingredients')}
        <label class="small" for="cmpIngr" style="font-weight:800">Skład</label>
        <textarea class="field" id="cmpIngr" rows="6" maxlength="5000" placeholder="np. mleko, cukier, truskawki 8%, skrobia modyfikowana">${esc(text)}</textarea>
        <p class="msg" id="cmpIngrMsg" role="status"></p>
        <div class="actions"><button class="btn btn-gold" type="button" data-cmp="save-ingr">Zapisz skład (+10 pkt)</button><button class="btn btn-white" type="button" data-cmp="skip">Pomiń</button></div>
        <p class="small muted">Skład trafi do otwartej bazy Open Food Facts, z której korzystają wszyscy.</p></div>`;
    }
    function renderNut() {
      const per = perText();
      el.innerHTML = `<div class="panel stack" id="completeNut">${head('Wartości odżywcze')}
        <div class="nut-per" role="group" aria-label="Na ile podane są wartości na opakowaniu"><button type="button" data-cmp="per-g" aria-pressed="${st.per === 'g'}">na 100 g</button><button type="button" data-cmp="per-ml" aria-pressed="${st.per === 'ml'}">na 100 ml (napoje)</button></div>
        <p class="small">Przepisz liczby z kolumny <b class="nut-per-label">${per}</b> w tabeli na opakowaniu, a nie z kolumny „porcja”. Wystarczy kilka pól.</p>
        ${photo('nutrition')}
        <div class="nut-grid"><div class="nut-head" aria-hidden="true"><span>Składnik</span><span class="nut-per-label">${per}</span></div>
        ${NUT_FIELDS.map(([k, label, unit, req]) => `<label class="nut-row${k === 'saturated-fat' || k === 'sugars' ? ' sub' : ''}"><span class="nut-name">${label}${req ? '' : ' <span class="muted">(jeśli jest)</span>'}</span><span class="nut-in"><input class="field" inputmode="decimal" autocomplete="off" data-nut="${k}" data-label="${label}" data-unit="${unit}" aria-label="${label} w ${unit} ${per}"><span class="nut-unit muted">${unit}</span></span></label>`).join('')}</div>
        <p class="msg" id="cmpNutMsg" role="status"></p>
        <div class="actions"><button class="btn btn-gold" type="button" data-cmp="save-nut">Zapisz wartości (+10 pkt)</button><button class="btn btn-white" type="button" data-cmp="skip">Pomiń</button></div></div>`;
    }
    function setPer(v) {
      st.per = v; const per = perText();
      el.querySelectorAll('.nut-per-label').forEach(t => { t.textContent = per; });
      el.querySelectorAll('[data-cmp^="per-"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cmp === 'per-' + v)));
      el.querySelectorAll('[data-nut]').forEach(i => i.setAttribute('aria-label', `${i.dataset.label} w ${i.dataset.unit} ${per}`));
    }

    el.onclick = async e => {
      const b = e.target.closest('[data-cmp]'); if (!b || b.disabled) return;
      const act = b.dataset.cmp;
      if (act === 'skip') { next(); return; }
      if (act === 'per-g' || act === 'per-ml') { setPer(act === 'per-ml' ? 'ml' : 'g'); return; }
      if (act === 'save-ingr') {
        const text = A.$('cmpIngr').value.replace(/\s+/g, ' ').trim(), msg = A.$('cmpIngrMsg');
        if (text.length < 8) { msg.textContent = 'Wpisz skład z opakowania, przynajmniej kilka składników.'; A.$('cmpIngr').focus(); return; }
        if (A.ocrMatch(st.ocr, text) < 0.35) { msg.textContent = 'Wpisany skład bardzo różni się od tego, co widać na zdjęciu. Popraw tylko błędy odczytu i usuń to, co nie jest składem.'; A.$('cmpIngr').focus(); return; }
        b.disabled = true; b.textContent = 'Zapisuję…';
        const r = await post('/edit', Object.assign({ code: opts.code, ingredients_text: text }, storeField()));
        if (r.ok || r.error === 'exists') {
          saveLocal(opts.code, { ingredients: text.slice(0, 5000) }); storeSaved(r);
          if (r.ok && (r.saved || []).includes('ingredients')) { st.saved.push('ingredients'); A.award('ingredients_added', { code: opts.code }); }
          else if (!(r.saved || []).includes('ingredients')) A.toast('Ktoś już uzupełnił skład tego produktu. Dziękujemy!');
          next();
        } else { b.disabled = false; b.textContent = 'Zapisz skład (+10 pkt)'; msg.textContent = r.error === 'offline' ? 'Nie ma połączenia z internetem. Spróbuj, gdy wróci.' : 'Nie udało się zapisać. Spróbuj ponownie za chwilę.'; }
      }
      if (act === 'save-nut') {
        const n = {}; el.querySelectorAll('[data-nut]').forEach(i => { n[i.dataset.nut] = A.parseNum(i.value); });
        const problem = A.nutProblem(n).replace('na 100 g', perText()), msg = A.$('cmpNutMsg');
        if (problem) { msg.textContent = problem; return; }
        const clean = Object.fromEntries(Object.entries(n).filter(([, v]) => v != null));
        b.disabled = true; b.textContent = 'Zapisuję…';
        const r = await post('/edit', Object.assign({ code: opts.code, nutriments: JSON.stringify(clean) }, storeField()));
        if (r.ok || r.error === 'exists') {
          const nm = {}; Object.entries(clean).forEach(([k, v]) => { nm[NUT_KEY[k]] = v; });
          saveLocal(opts.code, { nutriments: nm }); storeSaved(r);
          if (r.ok && (r.saved || []).includes('nutrition')) { st.saved.push('nutrition'); A.award('nutrition_added', { code: opts.code }); }
          else if (!(r.saved || []).includes('nutrition')) A.toast('Ktoś już uzupełnił wartości tego produktu. Dziękujemy!');
          next();
        } else { b.disabled = false; b.textContent = 'Zapisz wartości (+10 pkt)'; msg.textContent = r.error === 'offline' ? 'Nie ma połączenia z internetem. Spróbuj, gdy wróci.' : 'Nie udało się zapisać. Spróbuj ponownie za chwilę.'; }
      }
    };
    el.onchange = async e => {
      if (e.target.name === 'cmpStore') { st.store = e.target.value || null; return; }
      const inp = e.target.closest('[data-complete-photo]'); if (!inp) return;
      const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
      el.innerHTML = `<div class="panel stack">${head('Sprawdź skład')}<p class="small muted">Wysyłam zdjęcie i odczytuję skład…</p><div class="sk" style="height:90px"></div></div>`;
      try {
        const blob = await A.downscale(f, 1600, 'blob');
        const r = await post('/image', { code: opts.code, field: 'ingredients' }, blob);
        if (r.ok) { urls.ingredients = URL.createObjectURL(blob); A.award('photo_added', { code: opts.code }); }
      } catch (err) { }
      renderIngr(true);
    };
    if (st.step === 'ingr') renderIngr(false); else renderNut();
  };
})();
