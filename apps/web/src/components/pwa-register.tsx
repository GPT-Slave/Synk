"use client";

import { useEffect } from "react";

const ASSET_RECOVERY_PARAM = "__synk_asset_refresh";

export function PwaRegister() {
  useEffect(() => {
    removeAssetRecoveryMarker();

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

function removeAssetRecoveryMarker() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(ASSET_RECOVERY_PARAM)) return;

  url.searchParams.delete(ASSET_RECOVERY_PARAM);
  window.history.replaceState(window.history.state, "", url.href);
}
