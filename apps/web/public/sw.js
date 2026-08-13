const CACHE_NAME = "synk-branding-v3";
const SYNK_CACHE_PREFIX = "synk-";
const NEXT_STATIC_PREFIX = "/_next/static/";
const ASSET_RECOVERY_PARAM = "__synk_asset_refresh";
const BRANDING_PATHS = new Set([
  "/logo.png",
  "/logo_nobg.png",
  "/manifest.webmanifest",
]);

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await deleteCaches((key) =>
        key.startsWith(SYNK_CACHE_PREFIX) && key !== CACHE_NAME,
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith(NEXT_STATIC_PREFIX)) {
    event.respondWith(fetchNextAsset(event, request));
    return;
  }

  if (!BRANDING_PATHS.has(url.pathname)) return;
  event.respondWith(fetchBrandingAsset(request));
});

async function fetchNextAsset(event, request) {
  const response = await fetch(request);
  if (!response.ok) {
    await refreshStaleClient(event.clientId);
  }
  return response;
}

async function refreshStaleClient(clientId) {
  if (!clientId) return;

  const client = await self.clients.get(clientId);
  if (!client || client.type !== "window") return;

  const url = new URL(client.url);
  if (url.searchParams.has(ASSET_RECOVERY_PARAM)) return;

  url.searchParams.set(ASSET_RECOVERY_PARAM, String(Date.now()));
  await client.navigate(url.href);
}

async function fetchBrandingAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: "reload" });
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ?? Response.error();
  }
}

async function deleteCaches(matches) {
  const keys = await caches.keys();
  await Promise.all(keys.filter(matches).map((key) => caches.delete(key)));
}
