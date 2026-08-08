import { ApiError } from "@/lib/auth-api";
import type { SynkLocale } from "@/lib/i18n";

type Variables = Record<string, string | number>;
type Translate = (message: string, variables?: Variables) => string;

export function localizedErrorMessage(
  error: unknown,
  locale: SynkLocale,
  t: Translate,
  fallback: string,
) {
  const fallbackMessage = t(fallback);
  if (!(error instanceof ApiError)) return fallbackMessage;

  const translated = t(error.message);
  if (locale === "en" || translated !== error.message) return translated;
  return fallbackMessage;
}
