/* Dobre czy nie? – punkty, krople, odznaki, poziomy i wyzwania tygodnia.
   Czyste funkcje: dostają stan i konfigurację (pliki config/*.json), zwracają nowy stan i zdarzenia.
   Nowa odznaka, poziom albo wyzwanie = nowy wpis w konfiguracji, bez zmian w tym pliku. */
'use strict';

const Game = (() => {
  const KEEP_DAYS = 14, KEEP_WEEKS = 10, MAX_SET = 3000;

  // Liczniki zdarzeń, z których korzystają odznaki (metric w achievements.json).
  const METRIC_FROM_EVENT = {
    guesses_right: 'guess_right', explanations_opened: 'explanation_opened', lists_completed: 'list_completed',
    products_added: 'product_added', reports_sent: 'report_sent', stores_tagged: 'store_tagged', photos_added: 'photo_added',
    shelves_shared: 'shelf_shared', harvests: 'harvest', friends_joined: 'friend_joined'
  };
  const SET_METRICS = { products_checked: 'product_checked', additives_read: 'additive_read', sugar_explanations_read: 'sugar_explanation_read' };

  const pad = n => String(n).padStart(2, '0');
  function dayKey(d) { d = d instanceof Date ? d : new Date(d); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function monthKey(d) { d = d instanceof Date ? d : new Date(d); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  // Tydzień ISO 8601 (poniedziałek–niedziela), np. 2026-W43.
  function weekKey(d) {
    d = d instanceof Date ? d : new Date(d);
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
    return y + '-W' + pad(w);
  }
  function weekIndex(d) { const k = weekKey(d); const [y, w] = k.split('-W').map(Number); return y * 53 + w; }

  function newState() {
    return { v: 1, points: 0, drops: 0, spent: 0, level: 1, counters: {}, sets: {}, days: {}, weeks: {}, months: {}, once: {}, unlocked: {}, challenges: {}, inventory: {} };
  }
  const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
  const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : d);
  // Wczytanie stanu z pamięci telefonu. Uszkodzone pola zastępujemy bezpiecznymi wartościami.
  function load(raw) {
    const s = newState();
    if (!isObj(raw) || raw.v !== 1) return s;
    s.points = Math.floor(num(raw.points)); s.drops = Math.floor(num(raw.drops)); s.spent = Math.floor(num(raw.spent));
    s.level = Math.max(1, Math.floor(num(raw.level, 1)));
    for (const k of ['counters', 'days', 'weeks', 'months', 'once', 'unlocked', 'challenges', 'inventory']) if (isObj(raw[k])) s[k] = raw[k];
    if (isObj(raw.sets)) for (const [k, v] of Object.entries(raw.sets)) if (Array.isArray(v)) s.sets[k] = v.filter(x => typeof x === 'string').slice(-MAX_SET);
    for (const k of Object.keys(s.counters)) s.counters[k] = Math.floor(num(s.counters[k]));
    return s;
  }
  function prune(s, now) {
    const minDay = dayKey(new Date(now.getTime() - KEEP_DAYS * 864e5));
    for (const k of Object.keys(s.days)) if (k < minDay) delete s.days[k];
    const wi = weekIndex(now);
    for (const k of Object.keys(s.weeks)) { const [y, w] = k.split('-W').map(Number); if (wi - (y * 53 + w) > KEEP_WEEKS) delete s.weeks[k]; }
    const months = Object.keys(s.months).sort(); while (months.length > 3) delete s.months[months.shift()];
  }

  function levelFor(cfg, points) {
    const lv = (cfg.levels && cfg.levels.levels) || [{ level: 1, name: 'Nowicjusz', minPoints: 0 }];
    let cur = lv[0];
    for (const l of lv) if (points >= l.minPoints) cur = l;
    const next = lv.find(l => l.minPoints > points) || null;
    return { level: cur.level, name: cur.name, minPoints: cur.minPoints, reward: cur.reward || null, next };
  }
  function challengeFor(cfg, now) {
    const list = (cfg.challenges && cfg.challenges.challenges) || [];
    if (!list.length) return null;
    return list[weekIndex(now) % list.length];
  }
  function metricValue(s, metric, now, extra) {
    if (extra && metric in extra) return num(extra[metric]);
    if (SET_METRICS[metric]) return (s.sets[SET_METRICS[metric]] || []).length;
    if (metric === 'swaps_week') return num((s.weeks[weekKey(now)] || {}).swap_to_better);
    if (metric === 'active_days_week') return Object.values(s.weeks).reduce((m, w) => Math.max(m, Array.isArray(w._days) ? w._days.length : 0), 0);
    if (metric === 'distinct_crops') return (s.sets.crop || []).length;
    return num(s.counters[METRIC_FROM_EVENT[metric] || metric]);
  }
  function weeklyValue(s, metric, now) {
    const w = s.weeks[weekKey(now)] || {};
    if (metric === 'distinct_categories') return Array.isArray(w._cats) ? w._cats.length : 0;
    return num(w[metric]);
  }
  function grantReward(s, reward, events, source) {
    if (!reward) return 0;
    let pts = 0;
    if (typeof reward.points === 'number' && reward.points > 0) pts = Math.floor(reward.points);
    const drops = typeof reward.drops === 'number' && reward.drops > 0 ? Math.floor(reward.drops) : 0;
    s.points += pts; s.drops += pts + drops;
    (reward.items || []).forEach(i => { if (typeof i === 'string') s.inventory[i] = num(s.inventory[i]) + 1; });
    return pts;
  }
  function addToSet(s, name, value) {
    const a = s.sets[name] || (s.sets[name] = []);
    if (a.includes(value)) return false;
    a.push(value); if (a.length > MAX_SET) a.shift();
    return true;
  }

  /* Główna funkcja: zapisuje zdarzenie (np. product_checked) i przyznaje punkty według reguł.
     ctx: { code, shelfId, category, sugar, key, now }. Zwraca { state, gained, blocked, events }. */
  function award(state, cfg, event, ctx = {}) {
    const s = JSON.parse(JSON.stringify(state || newState()));
    const now = ctx.now instanceof Date ? ctx.now : new Date(ctx.now || Date.now());
    const today = dayKey(now), wk = weekKey(now), mo = monthKey(now);
    const rule = ((cfg.rules && cfg.rules.events) || {})[event] || {};
    const day = s.days[today] || (s.days[today] = { pts: {}, cnt: {}, once: {} });
    const week = s.weeks[wk] || (s.weeks[wk] = {});
    const month = s.months[mo] || (s.months[mo] = {});
    const events = [];
    let blocked = null;

    // Warunki „raz na…”. Zablokowane zdarzenie niczego nie liczy, żeby nie dało się nabijać odznak.
    const code = ctx.code ? String(ctx.code) : '';
    const group = rule.group || event; // np. „Dobre” i „Raczej nie” liczą się razem jako jedno zgadnięcie
    if (rule.oncePerProductPerDay && code && day.once[group + '|' + code]) blocked = 'once_product_day';
    if (!blocked && rule.oncePerShelfPerDay && ctx.shelfId && day.once[event + '|' + ctx.shelfId]) blocked = 'once_shelf_day';
    if (!blocked && rule.oncePerBarcode && code && s.once[event + '|' + code]) blocked = 'once_barcode';
    if (!blocked && rule.dailyCount && num(day.cnt[event]) >= rule.dailyCount) blocked = 'daily_count';
    if (blocked) return { state: state, gained: 0, blocked, events };

    if (rule.oncePerProductPerDay && code) day.once[group + '|' + code] = 1;
    if (rule.oncePerShelfPerDay && ctx.shelfId) day.once[event + '|' + ctx.shelfId] = 1;
    if (rule.oncePerBarcode && code) s.once[event + '|' + code] = 1;
    day.cnt[event] = num(day.cnt[event]) + 1;

    // Liczniki do odznak i wyzwań.
    s.counters[event] = num(s.counters[event]) + 1;
    week[event] = num(week[event]) + 1;
    if (event === 'guess_right' || event === 'guess_wrong') week.guess_any = num(week.guess_any) + 1;
    if (event === 'product_checked' && code) {
      addToSet(s, 'product_checked', code);
      if (ctx.category) { const c = week._cats || (week._cats = []); if (!c.includes(ctx.category)) c.push(ctx.category); }
    }
    if (event === 'additive_read' && ctx.key) addToSet(s, 'additive_read', String(ctx.key));
    if (event === 'explanation_opened' && ctx.sugar && code) addToSet(s, 'sugar_explanation_read', code);
    if (event === 'harvest' && ctx.key) addToSet(s, 'crop', String(ctx.key));
    if (event === 'app_opened') { const d = week._days || (week._days = []); if (!d.includes(today)) d.push(today); }

    // Punkty z limitem dziennym i miesięcznym.
    let gained = Math.floor(num(rule.points));
    if (gained && rule.dailyCap) gained = Math.max(0, Math.min(gained, rule.dailyCap - num(day.pts[event])));
    if (gained && rule.monthlyCap) gained = Math.max(0, Math.min(gained, rule.monthlyCap - num(month[event])));
    let extraDrops = Math.floor(num(rule.drops));
    if (extraDrops && !rule.points && rule.dailyCap) extraDrops = Math.max(0, Math.min(extraDrops, rule.dailyCap - num(day.pts[event])));
    day.pts[event] = num(day.pts[event]) + (gained || extraDrops);
    month[event] = num(month[event]) + gained;
    const per = num(cfg.rules && cfg.rules.dropsPerPoint, 1);
    s.points += gained; s.drops += gained * per + extraDrops;
    if (rule.points && !gained) blocked = 'cap';

    // Odznaki.
    for (const a of (cfg.achievements && cfg.achievements.achievements) || []) {
      if (s.unlocked[a.id]) continue;
      if (metricValue(s, a.metric, now, ctx.extra) >= a.target) {
        s.unlocked[a.id] = now.getTime();
        const pts = grantReward(s, a.reward, events);
        events.push({ type: 'achievement', id: a.id, name: a.name, points: pts, reward: a.reward || null });
      }
    }
    // Wyzwanie tygodnia.
    const ch = challengeFor(cfg, now);
    if (ch && !(s.challenges[wk] && s.challenges[wk].done) && weeklyValue(s, ch.metric, now) >= ch.target) {
      s.challenges[wk] = { id: ch.id, done: now.getTime() };
      const pts = grantReward(s, ch.reward, events);
      events.push({ type: 'challenge', id: ch.id, name: ch.title, points: pts, reward: ch.reward || null });
    }
    // Poziom (także po punktach z odznak).
    const lv = levelFor(cfg, s.points);
    if (lv.level > s.level) {
      for (const l of (cfg.levels && cfg.levels.levels) || []) if (l.level > s.level && l.level <= lv.level) events.push({ type: 'level', level: l.level, name: l.name, reward: l.reward || null });
      s.level = lv.level;
    }
    prune(s, now);
    return { state: s, gained, drops: gained * per + extraDrops, blocked, events };
  }

  // Postęp jednej odznaki do ekranu „Twoje postępy”.
  function progress(state, cfg, ach, now, extra) {
    const s = state || newState();
    const have = Math.min(ach.target, metricValue(s, ach.metric, now instanceof Date ? now : new Date(now || Date.now()), extra));
    return { have, target: ach.target, done: !!s.unlocked[ach.id] };
  }
  function challengeProgress(state, cfg, now) {
    now = now instanceof Date ? now : new Date(now || Date.now());
    const ch = challengeFor(cfg, now);
    if (!ch) return null;
    const s = state || newState(), wk = weekKey(now);
    const end = new Date(now); end.setHours(0, 0, 0, 0); end.setDate(end.getDate() + (7 - ((now.getDay() + 6) % 7)));
    return { ...ch, have: Math.min(ch.target, weeklyValue(s, ch.metric, now)), done: !!(s.challenges[wk] && s.challenges[wk].done), daysLeft: Math.max(1, Math.round((end - now) / 864e5)) };
  }
  function pointsToday(state, now) {
    const d = (state && state.days && state.days[dayKey(now || new Date())]) || { pts: {} };
    return Object.values(d.pts || {}).reduce((a, b) => a + num(b), 0);
  }

  return { newState, load, award, levelFor, challengeFor, challengeProgress, progress, metricValue, dayKey, weekKey, pointsToday };
})();

if (typeof module !== 'undefined' && typeof document === 'undefined') module.exports = Game;
