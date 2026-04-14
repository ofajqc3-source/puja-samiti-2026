// ── Service Worker — माँ सरस्वती पूजा समिति PWA ──
const CACHE_NAME = 'puja-samiti-v1';

// Ye files install hone par cache ho jaati hain
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Install: app shell cache karo
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // External CDN files optional hain — fail hone par ignore karo
      return cache.addAll(['./index.html', './manifest.json']).then(function() {
        return Promise.allSettled(
          SHELL_FILES.slice(2).map(function(url) {
            return cache.add(url).catch(function() {});
          })
        );
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activate: purana cache saaf karo
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch: Network first, cache fallback strategy
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Google Apps Script requests — always network (data sync ke liye)
  if (url.includes('script.google.com') || url.includes('script.googleusercontent.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Google Fonts — network first, cache fallback
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request).then(function(res) {
        var clone = res.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(event.request, clone); });
        return res;
      }).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Baaki sab: cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(res) {
        if (res && res.status === 200) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function(c) { c.put(event.request, clone); });
        }
        return res;
      }).catch(function() {
        // Offline fallback — sirf HTML ke liye
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
