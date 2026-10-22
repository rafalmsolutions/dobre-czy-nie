/* Lupka – stary service worker z głównego adresu. Do 22.10.2026 aplikacja była pod lupka.app/, teraz jest pod /app/
   (ma tam własny service worker), a pod / jest strona. Ten plik zastępuje dawny service worker: czyści jego pamięć
   i wyrejestrowuje się, więc strona zawsze przychodzi świeża z sieci. Pamięci zdjęć, szczegółów i archiwum zostają. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('dcn-d-')).map(k => caches.delete(k)));
    await self.registration.unregister();
    const list = await self.clients.matchAll({ type: 'window' });
    list.forEach(c => { try { c.navigate(c.url); } catch (err) { } });
  })());
});
