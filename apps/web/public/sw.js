const CACHE_NAME = "synk-branding-v3";
const SYNK_CACHE_PREFIX = "synk-";
const LEGACY_CODE_CACHE_PREFIX = "synk-static-";
const LEGACY_REFRESH_PARAM = "__synk_sw_refresh";
const LEGACY_CLEANUP_WINDOW_MS = 5_000;
const CLIENT_HANDOFF_DELAY_MS = 250;
const BRANDING_PATHS = new Set([
  "/logo.png",
  "/logo_nobg.png",
  "/manifest.webmanifest",
]);

let legacyCleanupUntil = 0;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const hadLegacyCodeCache = keys.some((key) =>
        key.startsWith(LEGACY_CODE_CACHE_PREFIX),
      );

      if (hadLegacyCodeCache) {
        legacyCleanupUntil = Date.now() + LEGACY_CLEANUP_WINDOW_MS;
      }

      await deleteCaches((key) =>
        key.startsWith(SYNK_CACHE_PREFIX) && key !== CACHE_NAME,
      );
      await self.clients.claim();

      if (!hadLegacyCodeCache) return;

      // Chromium may ignore a navigation requested in the same microtask as
      // clients.claim(). Give the controller handoff a short moment to settle,
      // then reload the old runtime under this worker with a one-time marker.
      await new Promise((resolve) => setTimeout(resolve, CLIENT_HANDOFF_DELAY_MS));
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      await Promise.allSettled(
        windows.map((client) => {
          const url = new URL(client.url);
          url.searchParams.set(LEGACY_REFRESH_PARAM, String(Date.now()));
          return client.navigate(url.href);
        }),
      );

      // Requests that were already being handled by the retired cache-first
      // worker can finish after the first delete and recreate its cache. Once
      // clients have moved to this worker, give those handlers time to drain
      // and remove legacy code caches one final time.
      await new Promise((resolve) => setTimeout(resolve, 500));
      await deleteLegacyCodeCaches();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (Date.now() < legacyCleanupUntil) {
    event.waitUntil(deleteLegacyCodeCaches());
  }

  if (!BRANDING_PATHS.has(url.pathname)) return;

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
});

async function deleteLegacyCodeCaches() {
  await deleteCaches((key) => key.startsWith(LEGACY_CODE_CACHE_PREFIX));
}

async function deleteCaches(matches) {
  const keys = await caches.keys();
  await Promise.all(keys.filter(matches).map((key) => caches.delete(key)));
}
