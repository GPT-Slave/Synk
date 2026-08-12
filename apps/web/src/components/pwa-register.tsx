"use client";

import { useEffect } from "react";

const LEGACY_REFRESH_PARAM = "__synk_sw_refresh";

export function PwaRegister() {
  useEffect(() => {
    removeLegacyRefreshMarker();

    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        await registration.update();
      } catch (error) {
        console.warn("Synk service worker registration failed.", error);
      }
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}

function removeLegacyRefreshMarker() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(LEGACY_REFRESH_PARAM)) return;

  url.searchParams.delete(LEGACY_REFRESH_PARAM);
  window.history.replaceState(window.history.state, "", url.href);
}
