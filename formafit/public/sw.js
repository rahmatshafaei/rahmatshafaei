/*
 * FormaFit service worker.
 *
 * Privacy rule: private pages and API responses are never cached. Only public, content-hashed
 * build assets, icons and the static offline page are stored. Navigations always go to the
 * network; the offline page is shown only when the network is unreachable.
 */
const VERSION = "v1";
const STATIC_CACHE = `formafit-static-${VERSION}`;
const PRECACHE = ["/offline.html", "/icon.svg", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("formafit-") && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isCacheableAsset(url) {
  return url.pathname.startsWith("/_next/static/") || PRECACHE.includes(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok && response.type === "basic") cache.put(request, response.clone());
        return response;
      }),
    );
  }
});

/** Only paths within this app (rejects "//other.site", "/\\other.site" and absolute URLs). */
function sameOriginPath(value) {
  try {
    if (typeof value !== "string" || !value.startsWith("/")) return "/hem";
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin ? url.pathname + url.search + url.hash : "/hem";
  } catch {
    return "/hem";
  }
}

/** Push payloads are JSON: { title, body, url, tag }. Anything else is ignored. */
function parsePush(data) {
  try {
    const p = data ? data.json() : null;
    if (!p || typeof p.title !== "string") return null;
    const url = sameOriginPath(p.url);
    return { title: p.title, body: typeof p.body === "string" ? p.body : "", url, tag: typeof p.tag === "string" ? p.tag : undefined };
  } catch {
    return null;
  }
}

self.addEventListener("push", (event) => {
  const payload = parsePush(event.data);
  if (!payload) return;
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      lang: "sv",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(sameOriginPath(event.notification.data?.url), self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (existing) return existing.focus().then((w) => w.navigate(target)).catch(() => self.clients.openWindow(target));
      return self.clients.openWindow(target);
    }),
  );
});
