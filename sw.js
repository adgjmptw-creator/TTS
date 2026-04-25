// Simple app-shell service worker.
// Cache-first for bundled assets so the app launches offline.
// Bump CACHE_NAME whenever any cached file changes.

const CACHE_NAME = "tts-reader-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./tts.js",
  "./i18n.js",
  "./storage.js",
  "./keepalive.js",
  "./manifest.webmanifest",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Freshen cache in the background.
        fetch(req).then((res) => {
          if (res && res.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
          }
        }).catch(() => { /* offline - fine, we already served cache */ });
        return cached;
      }
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => {
        // Fallback to app shell for navigations so offline reload works.
        if (req.mode === "navigate") return caches.match("./index.html");
        throw new Error("offline and not cached");
      });
    })
  );
});
