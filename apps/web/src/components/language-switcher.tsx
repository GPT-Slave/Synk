"use client";

import { Languages } from "lucide-react";
import {
  localeNames,
  supportedLocales,
  useI18n,
  type SynkLocale,
} from "@/lib/i18n";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label
      className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-xl border border-white/12 bg-card/95 px-3 py-2 text-xs shadow-xl backdrop-blur-xl"
      dir="ltr"
    >
      <Languages aria-hidden="true" className="size-4 text-primary" />
      <span className="sr-only">{t("Language")}</span>
      <select
        aria-label={t("Language")}
        className="max-w-28 bg-transparent font-medium text-foreground outline-none"
        onChange={(event) => setLocale(event.target.value as SynkLocale)}
        value={locale}
      >
        {supportedLocales.map((code) => (
          <option className="bg-card" key={code} value={code}>
            {localeNames[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
