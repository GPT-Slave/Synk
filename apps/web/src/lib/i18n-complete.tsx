"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import {
  I18nProvider as RuntimeProvider,
  localeNames,
  resolveLocale,
  supportedLocales,
  useI18n as useRuntimeI18n,
  type SynkLocale,
} from "./i18n-runtime";
import { extraTranslations } from "./i18n-extra";
import { uiTranslations } from "./i18n-ui";

export { localeNames, resolveLocale, supportedLocales };
export type { SynkLocale };

type Variables = Record<string, string | number>;
type RuntimeValue = ReturnType<typeof useRuntimeI18n>;

const CompleteI18nContext = createContext<RuntimeValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <RuntimeProvider>
      <CompleteI18nBridge>{children}</CompleteI18nBridge>
    </RuntimeProvider>
  );
}

function CompleteI18nBridge({ children }: { children: React.ReactNode }) {
  const runtime = useRuntimeI18n();
  const t = useCallback(
    (message: string, variables?: Variables) => {
      const translated =
        uiTranslations[runtime.locale]?.[message] ??
        extraTranslations[runtime.locale]?.[message];
      return translated
        ? interpolate(translated, variables)
        : runtime.t(message, variables);
    },
    [runtime],
  );
  const value = useMemo<RuntimeValue>(() => ({ ...runtime, t }), [runtime, t]);
  return (
    <CompleteI18nContext.Provider value={value}>
      {children}
    </CompleteI18nContext.Provider>
  );
}

export function useI18n() {
  const value = useContext(CompleteI18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider.");
  return value;
}

function interpolate(message: string, variables?: Variables) {
  if (!variables) return message;
  return message.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    Object.hasOwn(variables, key) ? String(variables[key]) : placeholder,
  );
}
