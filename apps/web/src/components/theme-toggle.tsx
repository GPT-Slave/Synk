"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "synk-theme";
const THEME_CHANGE_EVENT = "synk-theme-change";

export function ThemeToggle() {
  const { t } = useI18n();
  const theme = useSyncExternalStore(
    subscribeToTheme,
    currentTheme,
    serverTheme,
  );

  const nextTheme = theme === "dark" ? "light" : "dark";
  const label =
    nextTheme === "light"
      ? t("Switch to light mode")
      : t("Switch to dark mode");

  function toggleTheme() {
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <button
      aria-label={label}
      aria-pressed={theme === "light"}
      className="fixed bottom-4 left-4 z-[70] grid size-10 place-items-center rounded-xl border border-white/12 bg-card/95 text-foreground shadow-xl backdrop-blur-xl transition hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
      onClick={toggleTheme}
      title={label}
      type="button"
    >
      {theme === "dark" ? (
        <Sun aria-hidden="true" className="size-4" />
      ) : (
        <Moon aria-hidden="true" className="size-4" />
      )}
    </button>
  );
}

function subscribeToTheme(onStoreChange: () => void) {
  function syncStoredTheme(event: StorageEvent) {
    if (event.key !== THEME_STORAGE_KEY) return;
    applyTheme(event.newValue === "light" ? "light" : "dark");
    onStoreChange();
  }

  window.addEventListener("storage", syncStoredTheme);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", syncStoredTheme);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

function currentTheme(): Theme {
  return document.documentElement.classList.contains("light")
    ? "light"
    : "dark";
}

function serverTheme(): Theme {
  return "dark";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}
