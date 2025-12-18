// Service Worker for Rala PWA
const CACHE_NAME = 'rala-v1';
const RUNTIME_CACHE = 'rala-runtime-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  './',
  './index.html',
  './about.html',
  './icon.svg',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS.map(url => {
        try {
          return new Request(url, { mode: 'no-cors' });
        } catch (e) {
          return url;
        }
      })).catch(err => {
        console.log('[Service Worker] Some assets failed to cache:', err);
        // Continue even if some assets fail
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Take control of all pages immediately
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests (except CDN)
  if (url.origin !== location.origin && 
      !url.href.includes('cdnjs.cloudflare.com') &&
      !url.href.includes('api.datamuse.com') &&
      !url.href.includes('raw.githubusercontent.com')) {
    return; // Let browser handle it
  }

  // For navigation requests (HTML pages), try cache first, then network
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[Service Worker] Serving from cache:', request.url);
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          // Cache the response for future use
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        }).catch(() => {
          // If offline and no cache, return offline page
          return caches.match('./index.html');
        });
      })
    );
    return;
  }

  // For static assets (JS, CSS, etc.), cache first strategy
  if (request.destination === 'script' || 
      request.destination === 'style' || 
      request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // For API requests (Datamuse), network first, cache fallback
  if (url.href.includes('api.datamuse.com')) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        return caches.match(request);
      })
    );
    return;
  }

  // For YAML dictionary file, let it be handled by the app's IndexedDB caching
  // We don't cache it here since it's already cached in IndexedDB
  // But we can provide offline fallback
  if (url.href.includes('alar.yml')) {
    event.respondWith(
      fetch(request).catch(() => {
        // If offline, return a response indicating offline mode
        // The app will use IndexedDB cache instead
        return new Response('', { 
          status: 503, 
          statusText: 'Service Unavailable (Offline)' 
        });
      })
    );
    return;
  }

  // Default: network first, cache fallback
  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok) {
        const responseToCache = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, responseToCache);
        });
      }
      return response;
    }).catch(() => {
      return caches.match(request);
    })
  );
});
