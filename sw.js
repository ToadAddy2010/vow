// Offline-Modus: speichert die App-Dateien, damit Vow auch ohne Internet startet.
// Bei jeder neuen Version VERSION hochzählen.
const VERSION = 'vow-domain-v4';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/boot.js',
  './js/cloud.js',
  './js/config.js',
  './js/firebase.js',
  './js/store.js',
  './js/xp.js',
  './js/data.js',
  './js/ui.js',
  './js/logic.js',
  './js/coach.js',
  './js/views/today.js',
  './js/views/habits.js',
  './js/views/body.js',
  './js/views/mind.js',
  './js/views/coachview.js',
  './js/views/profile.js',
  './js/views/onboarding.js',
  './js/views/oath.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Erst Netz versuchen (damit Updates ankommen), sonst aus dem Speicher
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        const copy = res.clone();
        if (res.ok) caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
