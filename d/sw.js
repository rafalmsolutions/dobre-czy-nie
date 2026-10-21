/* Stary adres /d/: wersja D jest od 21.10.2026 główną aplikacją. Ten service worker usuwa się sam i przenosi otwarte okna na główny adres. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    await self.registration.unregister();
    const list = await self.clients.matchAll({ type: 'window' });
    list.forEach(c => { try { const u = new URL(c.url); c.navigate(new URL('../', self.location).href + u.hash); } catch (err) { } });
  })());
});
