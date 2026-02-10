/* eslint-disable no-undef */
const SHELL_CACHE = "pickdrive-shell-v1";
const RUNTIME_CACHE = "pickdrive-runtime-v1";
const IMAGE_CACHE = "pickdrive-images-v1";
const MEDIA_CACHE = "pickdrive-media-v1";

const SHELL_ASSETS = [
  "/",
  "/offline",
  "/manifest.json",
  "/favicon-32x32.png",
  "/favicon-16x16.png",
  "/apple-touch-icon.png",
  "/icon-192x192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if ([SHELL_CACHE, RUNTIME_CACHE, IMAGE_CACHE].includes(key)) {
              return undefined;
            }
            return caches.delete(key);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

const networkFirst = async (request) => {
  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error("Network failed");
  }
};

const cacheFirst = async (request, cacheName) => {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  const cache = await caches.open(cacheName);
  cache.put(request, response.clone());
  return response;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.headers.get("range")) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(request).catch(() => caches.match("/offline"))
    );
    return;
  }

  if (request.destination === "image") {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  if (
    request.destination === "video" ||
    url.pathname.endsWith(".mp4") ||
    url.pathname.endsWith(".webm")
  ) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
    return;
  }

  if (url.pathname.endsWith(".pdf")) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  event.respondWith(networkFirst(request));
});
