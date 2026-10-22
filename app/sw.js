/* Lupka – service worker aplikacji pod /app/ (od 22.10.2026; wcześniej pod głównym adresem jako „dcn-d-…”).
   Usuwa stare pamięci podręczne („dcn-…”, także dawnej głównej i folderu d/), ale nie rusza archiwum („dcn-arch-…”). */
const VERSION = 'lupka-2.7.5';
const IMG_CACHE = 'dcn-img'; // zdjęcia produktów (przez pośrednika); wspólne dla wersji, najwyżej IMG_MAX sztuk
const IMG_MAX = 400;
const SHELL = ['./', 'index.html', 'styles.css', 'd.css', 'config.js', 'data.js', 'core.js', 'game.js', 'shelf.js', 'art.js',
  'ui-base.js', 'album.js', 'family.js', 'disc.js', 'ui-album.js', 'ui-home.js', 'ui-product.js', 'ui-shelves.js', 'ui-progress.js', 'ui-complete.js', 'ui-compare.js', 'ui-main.js',
  '../config/points-rules.json', '../config/levels.json', '../config/achievements.json', '../config/weekly-challenges.json',
  '../privacy.html', 'manifest.webmanifest', 'sfx/click-tap-medium.mp3', 'sfx/tone-ding-high.mp3', 'sfx/notification-success-chime.mp3', 'sfx/notification-failure-pluck.mp3', 'sfx/pop-medium-bubble.mp3', 'sfx/appear-flip-quick.mp3',
  'sfx/notification-success-sparkle.mp3', 'sfx/shimmer-short-sparkle.mp3', 'sfx/sting-bright-short.mp3', 'sfx/shimmer-medium-sparkle.mp3', 'sfx/celebration-popper.mp3', 'sfx/notification-success-fanfare.mp3', 'sfx/celebration-confetti.mp3', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'achievements.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => (k.startsWith('dcn-') && !k.startsWith('dcn-arch-') && k !== IMG_CACHE && k !== 'dcn-pdet') || (k.startsWith('lupka-') && k !== VERSION && k !== VERSION + '-data')).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === self.location.origin && url.pathname.includes('/archiwum/')) return; // archiwum ma własny service worker
  // Kopia bazy produktów (data/): od razu z pamięci telefonu, w tle odświeżamy.
  if (url.origin === self.location.origin && /\/data\/(p|c)\//.test(url.pathname)) {
    e.respondWith(caches.open(VERSION + '-data').then(async c => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit || Response.error());
      return hit || net;
    }));
    return;
  }
  // Pliki aplikacji: najpierw sieć, bez sieci kopia.
  if (url.origin === self.location.origin) {
    e.respondWith((e.request.mode === 'navigate' ? fetch(e.request) : fetch(e.request, { cache: 'no-cache' })).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
    return;
  }
  // Zdjęcia produktów (pośrednik /img/ albo bezpośrednio z OFF): najpierw kopia w telefonie, bez czekania na sieć.
  if ((url.pathname.startsWith('/img/images/products/') && /workers\.dev$/.test(url.host)) || (url.host === 'images.openfoodfacts.org' && url.pathname.startsWith('/images/products/'))) {
    e.respondWith(caches.open(IMG_CACHE).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      // Pobieramy w trybie CORS (pośrednik i OFF na to pozwalają): kopia nie jest „nieprzezroczysta”, więc nie zajmuje sztucznie dużo miejsca.
      const r = await fetch(e.request.url, { mode: 'cors', credentials: 'omit' }).catch(() => fetch(e.request));
      if (r.ok) {
        c.put(e.request, r.clone()).then(() => c.keys()).then(k => { if (k.length > IMG_MAX) return Promise.all(k.slice(0, k.length - IMG_MAX).map(x => c.delete(x))); }).catch(() => { });
      }
      return r;
    }));
    return;
  }
  // Biblioteki z CDN i czcionki: najpierw kopia.
  if (/cdn\.jsdelivr\.net|unpkg\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); } return r; })));
  }
});
