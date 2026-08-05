const CACHE_NAME = "synk-static-v2";
const BRANDING_PATHS = new Set([
  "/logo.png",
  "/logo_nobg.png",
  "/manifest.webmanifest",
]);

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("synk-static-") && key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (BRANDING_PATHS.has(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const response = await fetch(request, { cache: "reload" });
          if (response.ok) await cache.put(request, response.clone());
          return response;
        } catch {
          return (await cache.match(request)) ?? Response.error();
        }
      }),
    );
    return;
  }

  if (!url.pathname.startsWith("/_next/static/")) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }),
  );
});
