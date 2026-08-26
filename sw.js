/* Keeps a permanent copy of the tracker on the device so it opens with no
   internet at all. Serves the saved copy instantly, then quietly refreshes it
   in the background whenever there IS a connection — so an update shows up the
   next time the app is opened. */

const CACHE = 'vape-tracker-v1';
const PAGES = ['./', './index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // Cache each path on its own — if one isn't there, install still
      // succeeds rather than leaving the device with no saved copy at all.
      .then(c => Promise.all(PAGES.map(p => c.add(p).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Google Fonts and anything else off-site: try the network, shrug if it fails.
  // The page has real font fallbacks, so losing them offline costs nothing.
  if (!req.url.startsWith(self.location.origin)) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      const fresh = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);

      // Saved copy first so it opens instantly and works with no signal;
      // the network copy replaces it in the cache for next time.
      return cached || fresh;
    })
  );
});
