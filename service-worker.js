/* ================================================================
   SERVICE WORKER — La Mia Agenda PWA
   Strategia: Cache-First con fallback alla rete.
   Tutti i file vengono pre-cachati all'installazione in modo che
   l'app funzioni completamente OFFLINE.
   ================================================================ */

const CACHE_NAME = 'agenda-v1';

// File da pre-cachare all'installazione
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // Font Google — saranno cachati al primo accesso (vedi fetch handler)
];

// ---- Installazione: pre-cacha le risorse fondamentali ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // attiva subito senza aspettare la chiusura delle tab
  );
});

// ---- Attivazione: pulisci le cache vecchie ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim()) // prendi il controllo di tutte le tab aperte
  );
});

// ---- Fetch: Cache-First, poi rete, poi fallback ----
self.addEventListener('fetch', (event) => {
  // Ignora richieste non GET e richieste chrome-extension
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request)
      .then((cached) => {
        if (cached) {
          // Trovato in cache: restituisci subito, aggiorna in background
          const networkFetch = fetch(event.request)
            .then((response) => {
              if (response && response.status === 200) {
                const toCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, toCache));
              }
              return response;
            })
            .catch(() => {}); // offline: va bene, usiamo la cache
          return cached;
        }

        // Non in cache: vai in rete e salva il risultato
        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type === 'opaque') {
              return response;
            }
            const toCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, toCache));
            return response;
          })
          .catch(() => {
            // Offline e non in cache: fallback per HTML
            if (event.request.destination === 'document') {
              return caches.match('./index.html');
            }
          });
      })
  );
});
