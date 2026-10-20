/* Dobre czy nie? 1.0 – service worker: aplikacja działa i otwiera się szybko także przy słabym zasięgu w sklepie. */
const VERSION = 'dcn-1.1.4';
const SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'data.js', 'core.js', 'game.js', 'shelf.js', 'art.js',
  'ui-base.js', 'ui-home.js', 'ui-product.js', 'ui-shelves.js', 'ui-progress.js', 'ui-complete.js', 'ui-main.js',
  'config/points-rules.json', 'config/levels.json', 'config/achievements.json', 'config/weekly-challenges.json',
  'privacy.html', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== VERSION + '-data').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Kopia bazy produktów (data/): od razu z pamięci telefonu, w tle odświeżamy (dane zmieniają się raz w tygodniu).
  if (url.origin === self.location.origin && /\/data\/(p|c)\//.test(url.pathname)) {
    e.respondWith(caches.open(VERSION + '-data').then(async c => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit || Response.error());
      return hit || net;
    }));
    return;
  }
  // Pliki aplikacji: najpierw sieć (poprawki docierają od razu), bez sieci kopia.
  if (url.origin === self.location.origin) {
    // no-cache: pytamy serwer o nowszą wersję, zamiast brać plik z pamięci przeglądarki (GitHub Pages trzyma ją 10 minut).
    e.respondWith((e.request.mode === 'navigate' ? fetch(e.request) : fetch(e.request, { cache: 'no-cache' })).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
    return;
  }
  // Biblioteki z CDN i czcionki: najpierw kopia, bo się nie zmieniają.
  if (/cdn\.jsdelivr\.net|unpkg\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); } return r; })));
  }
  // Zapytania do baz produktów i do pośrednika idą zawsze do sieci (aplikacja sama trzyma ostatnie wyniki).
});
