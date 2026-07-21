const CACHE_NAME = 'cute-bear-timer-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install Event - cache assets & skip waiting immediately
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching assets for v2');
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event - clean up old caches & claim clients immediately
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network-First for HTML/navigation, Cache-First for static assets
self.addEventListener('fetch', (e) => {
  const isHtmlNavigation = e.request.mode === 'navigate' || 
                           (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html'));
                           
  if (isHtmlNavigation) {
    // Network-First for HTML so new updates load instantly
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clonedResponse));
          }
          return response;
        })
        .catch(() => caches.match(e.request).then(res => res || caches.match('./index.html')))
    );
  } else {
    // Cache-First with Network fallback for static assets
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseToCache));
          }
          return networkResponse;
        });
      })
    );
  }
});
