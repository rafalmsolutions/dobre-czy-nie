/* Lupka (dawniej „Dobre czy nie?”) – pośrednik do Open Food Facts (Cloudflare Worker).

   Po co:
   1. POST /product – dodawanie brakującego produktu. Aplikacja w przeglądarce nie może bezpiecznie trzymać hasła
      do konta aplikacji ani ustawić nagłówka User-Agent. Pośrednik sprawdza nazwę i 3 zdjęcia i przekazuje je
      do Open Food Facts kontem aplikacji. Niczego nie zapisuje.
   2. GET /category?tag=en:yogurts – popularne produkty z kategorii sprzedawane w Polsce (listy „Najlepsze”
      i porównanie po skanie). Korzysta z szybkiej wyszukiwarki search.openfoodfacts.org, która nie przyjmuje
      zapytań prosto z przeglądarki, i zapamiętuje wynik na dobę w pamięci podręcznej Cloudflare.

   Ustawienia (Cloudflare → Workers → Settings → Variables):
   - OFF_USER, OFF_PASS  – login i hasło konta aplikacji w Open Food Facts (jako „Secret”, nigdy w kodzie);
   - OFF_BASE            – https://world.openfoodfacts.org (produkcja) albo https://world.openfoodfacts.net (testy);
   - OFF_BASIC           – tylko dla serwera testowego: off:off;
   - ALLOWED_ORIGINS     – adresy aplikacji oddzielone przecinkami, np. https://dobreczynie.pl,https://twoja-nazwa.netlify.app
   - CONTACT_EMAIL       – e-mail w nagłówku User-Agent (wymóg Open Food Facts). */

import { disc } from './disc.js';

const APP_NAME = 'Lupka';
const MAX_PHOTO = 6 * 1024 * 1024;
const PHOTOS = { front: 'front', ingredients: 'ingredients', nutrition: 'nutrition' };
const RATE = { perHour: 40, hits: new Map() }; // ochrona przed zalewem (w obrębie jednej instancji)
const SEARCH = 'https://search.openfoodfacts.org/search';
const CAT_TTL = 24 * 3600;
/* Sklepy, które aplikacja może dopisać do produktu (pole „stores” w Open Food Facts, dopisywane przez add_stores – bez kasowania innych). */
const STORE_NAMES = { biedronka: 'Biedronka', lidl: 'Lidl', aldi: 'Aldi', kaufland: 'Kaufland', auchan: 'Auchan', carrefour: 'Carrefour', netto: 'Netto', dino: 'Dino', stokrotka: 'Stokrotka', zabka: 'Żabka', lewiatan: 'Lewiatan', polomarket: 'Polomarket', intermarche: 'Intermarché', rossmann: 'Rossmann', hebe: 'Hebe', spar: 'Spar' };
const storeLabel = v => STORE_NAMES[String(v || '').toLowerCase()] || '';
const CAT_FIELDS = 'code,product_name,product_name_pl,brands,quantity,image_front_small_url,image_front_url,nutriscore_grade,nova_group,ingredients_tags,ingredients_n,allergens_tags,traces_tags,ingredients_analysis_tags,labels_tags,nutriments,categories_tags,categories,stores';
const NUTRIMENTS = ['energy-kcal_100g', 'fat_100g', 'saturated-fat_100g', 'sugars_100g', 'salt_100g', 'proteins_100g', 'fiber_100g', 'carbohydrates_100g', 'alcohol_100g'];

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const okOrigin = allowed.includes(origin);
    const cors = okOrigin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : { Vary: 'Origin' };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, cors) });

    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: okOrigin ? 204 : 403, headers: cors });
    if (url.pathname === '/health') return reply(200, { ok: true });
    // Zdjęcia produktów: serwer zdjęć Open Food Facts bywa bardzo wolny (kilka sekund na zdjęcie) i nie pozwala ich zapamiętać.
    // Pośrednik trzyma kopię w pamięci Cloudflare na 30 dni (adresy zdjęć zmieniają się przy każdej nowej wersji, więc kopia się nie starzeje).
    if (url.pathname.startsWith('/img/')) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return reply(405, { ok: false, error: 'method' });
      const path = url.pathname.slice(4);
      if (!/^\/images\/products\/[0-9/]{1,40}\/[A-Za-z0-9_.-]{1,80}\.(jpg|jpeg|png|webp)$/.test(path) || path.includes('..')) return reply(400, { ok: false, error: 'path' });
      const ref = request.headers.get('Referer') || '';
      if (ref && !allowed.some(o => ref === o || ref.startsWith(o + '/'))) return new Response('forbidden', { status: 403 });
      const store = typeof caches !== 'undefined' ? caches.default : null;
      const key = new Request('https://lupka-img.cache' + path);
      const hit = store ? await store.match(key) : null;
      if (hit) { const h = new Headers(hit.headers); h.set('X-Lupka-Img', 'hit'); return new Response(hit.body, { status: 200, headers: h }); }
      let r;
      try { r = await fetch('https://images.openfoodfacts.org' + path, { headers: { 'User-Agent': `${APP_NAME}/1.0 (${env.CONTACT_EMAIL || 'rafalmsolutions@gmail.com'})` }, cf: { cacheTtl: 2592000, cacheEverything: true } }); }
      catch (e) { return new Response(null, { status: 502, headers: { 'Cache-Control': 'no-store' } }); }
      if (!r.ok) return new Response(null, { status: r.status === 404 ? 404 : 502, headers: { 'Cache-Control': r.status === 404 ? 'public, max-age=3600' : 'no-store' } });
      const type = r.headers.get('Content-Type') || '';
      if (!/^image\//.test(type)) return new Response(null, { status: 502, headers: { 'Cache-Control': 'no-store' } });
      const resp = new Response(r.body, { status: 200, headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=2592000, immutable', 'Access-Control-Allow-Origin': '*', 'X-Lupka-Img': 'miss' } });
      if (store) { const put = store.put(key, resp.clone()); if (ctx && ctx.waitUntil) ctx.waitUntil(put); else await put; }
      return resp;
    }
    // Sprawdzenie, czy login i hasło konta aplikacji są poprawne (bez zapisywania czegokolwiek w bazie).
    if (url.pathname === '/check') {
      if (request.method !== 'POST') return reply(405, { ok: false, error: 'method' });
      if (!okOrigin) return reply(403, { ok: false, error: 'origin' });
      if (!env.OFF_USER || !env.OFF_PASS) return reply(500, { ok: false, error: 'not_configured' });
      if (!rateOk(request.headers.get('CF-Connecting-IP') || 'unknown')) return reply(429, { ok: false, error: 'rate' });
      const base = (env.OFF_BASE || 'https://world.openfoodfacts.org').replace(/\/$/, '');
      const headers = { 'User-Agent': `${APP_NAME}/1.0 (${env.CONTACT_EMAIL || 'rafalmsolutions@gmail.com'})` };
      if (env.OFF_BASIC) headers.Authorization = 'Basic ' + btoa(env.OFF_BASIC);
      const fd = new FormData(); fd.append('user_id', env.OFF_USER); fd.append('password', env.OFF_PASS);
      try {
        // Logowanie jak na stronie OFF; zła para login–hasło zwraca komunikat o błędzie.
        fd.append('.submit', 'Sign-in');
        const r = await fetch(`${base}/cgi/session.pl`, { method: 'POST', body: fd, headers, redirect: 'manual' });
        const txt = await r.text().catch(() => '');
        const bad = /niepoprawna nazwa u|incorrect user name|invalid user|nieprawidłow/i.test(txt);
        const cookie = (r.headers.get('set-cookie') || '').includes('session');
        return reply(200, { ok: !bad && (cookie || r.status === 200 || r.status === 302), wrong: bad, upstream: r.status, cookie, server: base, userLooksLikeEmail: env.OFF_USER.includes('@'), userLength: env.OFF_USER.length });
      } catch (e) { return reply(502, { ok: false, error: 'network', server: base }); }
    }
    if (url.pathname === '/category') {
      if (request.method !== 'GET') return reply(405, { ok: false, error: 'method' });
      if (!okOrigin) return reply(403, { ok: false, error: 'origin' });
      const tag = url.searchParams.get('tag') || '';
      if (!/^[a-z]{2}:[a-z0-9-]{2,60}$/.test(tag)) return reply(400, { ok: false, error: 'tag' });
      const r = await category(tag, env);
      return new Response(r.body, { status: r.status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': r.status === 200 ? 'public, max-age=3600' : 'no-store' }, cors) });
    }
    if (['/ocr', '/image', '/edit'].includes(url.pathname)) {
      if (request.method !== 'POST') return reply(405, { ok: false, error: 'method' });
      if (!okOrigin) return reply(403, { ok: false, error: 'origin' });
      if (!env.OFF_USER || !env.OFF_PASS) return reply(500, { ok: false, error: 'not_configured' });
      if (!rateOk(request.headers.get('CF-Connecting-IP') || 'unknown')) return reply(429, { ok: false, error: 'rate' });
      let form;
      try { form = await request.formData(); } catch (e) { return reply(400, { ok: false, error: 'form' }); }
      const code = String(form.get('code') || '').replace(/\D/g, '');
      if (!validBarcode(code)) return reply(400, { ok: false, error: 'code' });
      const lang = /^[a-z]{2}$/.test(String(form.get('lang') || '')) ? String(form.get('lang')) : 'pl';
      const appVersion = /^[0-9.]{1,10}$/.test(String(form.get('app_version') || '')) ? String(form.get('app_version')) : '1.0';
      const o = offCtx(env, appVersion);
      // Odczyt składu ze zdjęcia (OCR Open Food Facts). Niczego nie zapisuje: tekst wraca do aplikacji do sprawdzenia.
      if (url.pathname === '/ocr') {
        try {
          const r = await fetch(`${o.base}/cgi/ingredients.pl?code=${code}&id=ingredients_${lang}&process_image=1&ocr_engine=google_cloud_vision`, { headers: o.headers });
          const j = r.ok ? await r.json().catch(() => null) : null;
          const text = j && typeof j.ingredients_text_from_image === 'string' ? cleanText(j.ingredients_text_from_image, 5000) : '';
          return reply(200, text ? { ok: true, text } : { ok: false, error: 'no_text' });
        } catch (e) { return reply(502, { ok: false, error: 'network' }); }
      }
      const uuid = String(form.get('app_uuid') || '');
      if (!/^[a-z0-9-]{16,64}$/.test(uuid)) return reply(400, { ok: false, error: 'uuid' });
      const common = Object.assign({ user_id: env.OFF_USER, password: env.OFF_PASS, app_name: APP_NAME, app_version: appVersion, app_uuid: uuid });
      // Jedno zdjęcie do istniejącego produktu (np. skład, którego brakuje).
      if (url.pathname === '/image') {
        const field = String(form.get('field') || '');
        if (!PHOTOS[field]) return reply(400, { ok: false, error: 'field' });
        const f = form.get('photo');
        if (!f || typeof f === 'string' || f.size > MAX_PHOTO || f.size < 100) return reply(400, { ok: false, error: 'photo_size' });
        const buf = new Uint8Array(await f.arrayBuffer()), type = imageType(buf);
        if (!type) return reply(400, { ok: false, error: 'photo_type' });
        const fd = new FormData(), imagefield = `${field}_${lang}`;
        Object.entries(Object.assign({ code, imagefield, lc: lang, cc: 'pl' }, common)).forEach(([k, v]) => fd.append(k, v));
        fd.append('imgupload_' + imagefield, new Blob([buf], { type }), `${field}.jpg`);
        try {
          const r = await fetch(`${o.base}/cgi/product_image_upload.pl`, { method: 'POST', body: fd, headers: o.headers });
          const j = r.ok ? await r.json().catch(() => null) : null;
          return j && j.status === 'status ok' ? reply(200, { ok: true }) : reply(502, { ok: false, error: 'off_image', verbose: j && j.error ? String(j.error).slice(0, 160) : '' });
        } catch (e) { return reply(502, { ok: false, error: 'network' }); }
      }
      // Uzupełnienie składu i wartości odżywczych. Tylko brakujące pola: nie nadpisujemy danych, które ktoś już wpisał.
      const ingredients = cleanText(form.get('ingredients_text'), 5000);
      const nut = parseNutriments(form.get('nutriments'));
      const store = storeLabel(form.get('store'));
      if (nut === 'bad') return reply(400, { ok: false, error: 'nutriments' });
      if (form.get('store') && !store) return reply(400, { ok: false, error: 'store' });
      if (!ingredients && !nut && !store) return reply(400, { ok: false, error: 'empty' });
      if (ingredients && ingredients.length < 3) return reply(400, { ok: false, error: 'ingredients' });
      let current = null;
      try {
        const r = await fetch(`${o.base}/api/v2/product/${code}.json?fields=code,ingredients_text_${lang},ingredients_text,nutriments`, { headers: o.headers });
        const j = r.ok ? await r.json().catch(() => null) : null;
        current = j && j.status === 1 ? j.product : null;
      } catch (e) { current = null; }
      // Świeżo dodany produkt bywa przez kilka minut niewidoczny w odczycie; wtedy nie ma czego nadpisać.
      current = current || {};
      const fields = { code, lang, lc: lang, cc: 'pl', comment: 'Uzupełnione w aplikacji Lupka' };
      const saved = [];
      if (ingredients && !String(current['ingredients_text_' + lang] || current.ingredients_text || '').trim()) { fields['ingredients_text_' + lang] = ingredients; saved.push('ingredients'); }
      const hasNut = current.nutriments && ['energy-kcal_100g', 'fat_100g', 'sugars_100g', 'salt_100g', 'proteins_100g'].some(k => current.nutriments[k] !== undefined);
      if (nut && !hasNut) {
        fields.nutrition_data_per = '100g';
        Object.entries(nut).forEach(([k, v]) => { fields['nutriment_' + k] = String(v); fields['nutriment_' + k + '_unit'] = k === 'energy-kcal' ? 'kcal' : 'g'; });
        saved.push('nutrition');
      }
      if (store) { fields.add_stores = store; saved.push('store'); } // dopisanie sklepu nie usuwa innych
      if (!saved.length) return reply(409, { ok: false, error: 'exists' });
      const fd = new FormData();
      Object.entries(Object.assign(fields, common)).forEach(([k, v]) => fd.append(k, v));
      try {
        const r = await fetch(`${o.base}/cgi/product_jqm2.pl`, { method: 'POST', body: fd, headers: o.headers });
        const j = r.ok ? await r.json().catch(() => null) : null;
        return j && j.status === 1 ? reply(200, { ok: true, saved }) : reply(502, { ok: false, error: 'off_save', upstream: r.status });
      } catch (e) { return reply(502, { ok: false, error: 'network' }); }
    }
    // Odkrywcy: potwierdzanie nowych produktów (baza D1, plik disc.js).
    if (url.pathname.startsWith('/disc/')) {
      if (!okOrigin) return reply(403, { ok: false, error: 'origin' });
      if (!rateOk('d:' + (request.headers.get('CF-Connecting-IP') || 'unknown'), 400)) return reply(429, { ok: false, error: 'rate' });
      try { return await disc(request, env, url, reply); } catch (e) { return reply(500, { ok: false, error: 'db' }); }
    }
    if (url.pathname !== '/product') return reply(404, { ok: false, error: 'not_found' });
    if (request.method !== 'POST') return reply(405, { ok: false, error: 'method' });
    if (!okOrigin) return reply(403, { ok: false, error: 'origin' });
    if (!env.OFF_USER || !env.OFF_PASS) return reply(500, { ok: false, error: 'not_configured' });

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!rateOk(ip)) return reply(429, { ok: false, error: 'rate' });

    const len = Number(request.headers.get('Content-Length') || 0);
    if (len > 3 * MAX_PHOTO + 64 * 1024) return reply(413, { ok: false, error: 'too_large' });

    let form;
    try { form = await request.formData(); } catch (e) { return reply(400, { ok: false, error: 'form' }); }

    // --- Sprawdzenie danych ---
    const code = String(form.get('code') || '').replace(/\D/g, '');
    if (!validBarcode(code)) return reply(400, { ok: false, error: 'code' });
    const name = cleanText(form.get('product_name'), 80);
    if (name.length < 3) return reply(400, { ok: false, error: 'name' });
    const lang = /^[a-z]{2}$/.test(String(form.get('lang') || '')) ? String(form.get('lang')) : 'pl';
    const uuid = String(form.get('app_uuid') || '');
    if (!/^[a-z0-9-]{16,64}$/.test(uuid)) return reply(400, { ok: false, error: 'uuid' });
    const appVersion = /^[0-9.]{1,10}$/.test(String(form.get('app_version') || '')) ? String(form.get('app_version')) : '1.0';
    const photos = {};
    for (const k of Object.keys(PHOTOS)) {
      const f = form.get('photo_' + k);
      if (!f || typeof f === 'string') return reply(400, { ok: false, error: 'photo_missing', field: k });
      if (f.size > MAX_PHOTO || f.size < 100) return reply(400, { ok: false, error: 'photo_size', field: k });
      const buf = new Uint8Array(await f.arrayBuffer());
      const type = imageType(buf);
      if (!type) return reply(400, { ok: false, error: 'photo_type', field: k });
      photos[k] = { buf, type };
    }

    const base = (env.OFF_BASE || 'https://world.openfoodfacts.org').replace(/\/$/, '');
    const headers = { 'User-Agent': `${APP_NAME}/${appVersion} (${env.CONTACT_EMAIL || 'rafalmsolutions@gmail.com'})` };
    if (env.OFF_BASIC) headers.Authorization = 'Basic ' + btoa(env.OFF_BASIC);
    const common = { user_id: env.OFF_USER, password: env.OFF_PASS, app_name: APP_NAME, app_version: appVersion, app_uuid: uuid };

    // --- Nie nadpisujemy produktu, który już ktoś dodał ---
    try {
      const r = await fetch(`${base}/api/v2/product/${code}.json?fields=code,product_name`, { headers });
      if (r.ok) { const j = await r.json(); if (j && j.status === 1 && j.product && j.product.product_name) return reply(409, { ok: false, error: 'exists' }); }
    } catch (e) { /* sprawdzenie pomocnicze; przy błędzie próbujemy dalej */ }

    // --- Zapis produktu ---
    const fields = new FormData();
    const store = storeLabel(form.get('store'));
    Object.entries(Object.assign({ code, lang, lc: lang, cc: 'pl', ['product_name_' + lang]: name, comment: 'Dodane w aplikacji Lupka' }, store ? { add_stores: store } : {}, common)).forEach(([k, v]) => fields.append(k, v));
    let saved, upstream = 0, verbose = '';
    try {
      const r = await fetch(`${base}/cgi/product_jqm2.pl`, { method: 'POST', body: fields, headers });
      upstream = r.status;
      const txt = await r.text();
      try { saved = JSON.parse(txt); } catch (e) { saved = null; const plain = txt.replace(/<(script|style|head|nav|header|footer)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const hit = plain.match(/[^.!?]{0,160}(hasł|password|nieprawidł|incorrect|invalid|zablokow|blocked|uprawnie|permission|forbidden|not allowed|nie masz)[^.!?]{0,160}/i);
        verbose = (hit ? hit[0] : plain.slice(-300)).trim(); }
    } catch (e) { saved = null; verbose = String(e).slice(0, 160); }
    // Do diagnozy zwracamy kod i opis odpowiedzi Open Food Facts (bez haseł i danych logowania).
    if (!saved || saved.status !== 1) return reply(502, { ok: false, error: 'off_save', upstream, verbose: (saved && saved.status_verbose ? String(saved.status_verbose) : verbose).slice(0, 300) });

    // --- Zdjęcia: przód, skład, wartości odżywcze ---
    let images = 0;
    for (const [k, field] of Object.entries(PHOTOS)) {
      const fd = new FormData();
      const imagefield = `${field}_${lang}`;
      Object.entries(Object.assign({ code, imagefield, lc: lang, cc: 'pl' }, common)).forEach(([a, v]) => fd.append(a, v));
      fd.append('imgupload_' + imagefield, new Blob([photos[k].buf], { type: photos[k].type }), `${k}.${photos[k].type === 'image/png' ? 'png' : photos[k].type === 'image/webp' ? 'webp' : 'jpg'}`);
      try {
        const r = await fetch(`${base}/cgi/product_image_upload.pl`, { method: 'POST', body: fd, headers });
        const j = r.ok ? await r.json().catch(() => null) : null;
        if (j && j.status === 'status ok') images++;
      } catch (e) { /* liczymy tylko udane */ }
    }
    return reply(200, { ok: true, images });
  }
};

function rateOk(ip, per = RATE.perHour) {
  const now = Date.now(), hourAgo = now - 3600e3;
  const list = (RATE.hits.get(ip) || []).filter(t => t > hourAgo);
  if (list.length >= per) { RATE.hits.set(ip, list); return false; }
  list.push(now); RATE.hits.set(ip, list);
  if (RATE.hits.size > 5000) RATE.hits.clear();
  return true;
}
function cleanText(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function validBarcode(code) {
  if (!/^\d{8,14}$/.test(code)) return false;
  if (![8, 12, 13, 14].includes(code.length)) return false;
  const d = code.split('').map(Number), check = d.pop();
  const sum = d.reverse().reduce((a, n, i) => a + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
// Rozpoznajemy obraz po pierwszych bajtach, a nie po nazwie pliku.
function imageType(b) {
  if (b.length > 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png';
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

/* Produkty z kategorii, sprzedawane w Polsce, najpopularniejsze najpierw. Wynik w pamięci Cloudflare na dobę. */
async function category(tag, env) {
  const key = new Request('https://cache.dcn/category/' + tag);
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) { const hit = await cache.match(key); if (hit) return { status: 200, body: await hit.text() }; }
  const q = `categories_tags:"${tag}" AND countries_tags:"en:poland"`;
  const headers = { 'User-Agent': `${APP_NAME}/1.0 (${env.CONTACT_EMAIL || 'rafalmsolutions@gmail.com'})`, Accept: 'application/json' };
  let j = null, status = 0;
  for (let attempt = 0; attempt < 2 && !j; attempt++) {
    try {
      const r = await fetch(`${SEARCH}?q=${encodeURIComponent(q)}&page_size=200&sort_by=-unique_scans_n&fields=${CAT_FIELDS}`, { headers });
      status = r.status;
      if (r.ok) j = await r.json().catch(() => null);
    } catch (e) { status = 0; }
  }
  if (!j || !Array.isArray(j.hits)) return { status: 502, body: JSON.stringify({ ok: false, error: 'search', upstream: status }) };
  const products = j.hits.filter(h => h && /^\d{6,14}$/.test(String(h.code || ''))).map(compact);
  const body = JSON.stringify({ ok: true, tag, count: j.count, at: new Date().toISOString(), products });
  if (cache && products.length) await cache.put(key, new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CAT_TTL}` } }));
  return { status: 200, body };
}
// Zostawiamy tylko pola, których używa aplikacja (mniej danych w telefonie).
function compact(h) {
  const str = v => (typeof v === 'string' ? v.slice(0, 200) : '');
  const arr = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 40) : []);
  const n = h.nutriments && typeof h.nutriments === 'object' ? h.nutriments : {};
  const nutriments = {};
  NUTRIMENTS.forEach(k => { const v = Number(n[k]); if (n[k] !== undefined && n[k] !== null && n[k] !== '' && isFinite(v)) nutriments[k] = v; });
  const ing = arr(h.ingredients_tags);
  return {
    code: String(h.code), product_name: str(h.product_name_pl) || str(h.product_name), brands: str(Array.isArray(h.brands) ? h.brands.join(', ') : h.brands), quantity: str(h.quantity),
    image_front_small_url: str(h.image_front_small_url), image_front_url: str(h.image_front_url),
    nutriscore_grade: str(h.nutriscore_grade).slice(0, 20), nova_group: Number.isInteger(h.nova_group) ? h.nova_group : null,
    // Dodatki E bierzemy z listy składników; gdy składników brak, zostawiamy „nie wiadomo” (null).
    additives_tags: ing.length || h.ingredients_n ? ing.filter(t => /^en:e\d{3}/.test(t)) : null,
    allergens_tags: arr(h.allergens_tags), traces_tags: arr(h.traces_tags), ingredients_analysis_tags: arr(h.ingredients_analysis_tags), labels_tags: arr(h.labels_tags),
    nutriments, categories_hierarchy: arr(h.categories_tags), categories: str(h.categories),
    stores: (Array.isArray(h.stores) ? h.stores : typeof h.stores === 'string' ? h.stores.split(',') : []).map(x => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, 10)
  };
}

function offCtx(env, appVersion) {
  const base = (env.OFF_BASE || 'https://world.openfoodfacts.org').replace(/\/$/, '');
  const headers = { 'User-Agent': `${APP_NAME}/${appVersion} (${env.CONTACT_EMAIL || 'rafalmsolutions@gmail.com'})` };
  if (env.OFF_BASIC) headers.Authorization = 'Basic ' + btoa(env.OFF_BASIC);
  return { base, headers };
}
/* Wartości odżywcze na 100 g z aplikacji: tylko znane pola i rozsądne zakresy. null = brak, 'bad' = złe dane. */
const NUT_LIMITS = { 'energy-kcal': 900, fat: 100, 'saturated-fat': 100, carbohydrates: 100, sugars: 100, fiber: 100, proteins: 100, salt: 100 };
function parseNutriments(raw) {
  if (raw == null || raw === '') return null;
  let o;
  try { o = JSON.parse(String(raw)); } catch (e) { return 'bad'; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return 'bad';
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (!(k in NUT_LIMITS)) return 'bad';
    if (v === null || v === '') continue;
    const n = Number(v);
    if (!isFinite(n) || n < 0 || n > NUT_LIMITS[k]) return 'bad';
    out[k] = Math.round(n * 100) / 100;
  }
  if (!Object.keys(out).length) return null;
  if (out['saturated-fat'] > (out.fat ?? 100) || out.sugars > (out.carbohydrates ?? 100)) return 'bad';
  if ((out.fat || 0) + (out.carbohydrates || 0) + (out.proteins || 0) + (out.salt || 0) + (out.fiber || 0) > 105) return 'bad';
  if (out['energy-kcal'] === undefined) return 'bad';
  return out;
}
