/**
 * i18n utilities for Clawdbot UI
 */

import type { Locale, Translations } from "./types.js";
import { en } from "./en.js";
import { zh_CN } from "./zh-CN.js";

// Storage key for locale preference
const LOCALE_STORAGE_KEY = "clawdbot_locale";

// All available translations
const allTranslations: Record<Locale, Translations> = {
  en,
  "zh-CN": zh_CN,
};

// Default locale (browser language or fallback to en)
function getDefaultLocale(): Locale {
  // Check localStorage first
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
  if (stored && allTranslations[stored]) {
    return stored;
  }

  // Check browser language
  const browserLang = navigator.language;
  if (browserLang.startsWith("zh")) {
    return "zh-CN";
  }

  // Fallback to English
  return "en";
}

// Current locale state
let currentLocale: Locale = getDefaultLocale();

// Get current locale
export function getLocale(): Locale {
  return currentLocale;
}

// Set current locale
export function setLocale(locale: Locale): void {
  if (!allTranslations[locale]) {
    console.warn(`Locale "${locale}" not available, falling back to "en"`);
    currentLocale = "en";
  } else {
    currentLocale = locale;
  }
  localStorage.setItem(LOCALE_STORAGE_KEY, currentLocale);
}

// Get all available locales
export function getAvailableLocales(): Array<{ code: Locale; name: string; native: string }> {
  return Object.entries(allTranslations).map(([code, t]) => ({
    code: code as Locale,
    name: t.language.name,
    native: t.language.native,
  }));
}

// Get translation for a key path (e.g., "common.send")
export function t(path: string): string {
  const keys = path.split(".");
  let value: unknown = allTranslations[currentLocale];

  for (const key of keys) {
    if (typeof value === "object" && value !== null) {
      value = (value as Record<string, unknown>)[key];
    } else {
      // Path not found, try fallback to English
      return path as string;
    }
  }

  return typeof value === "string" ? value : path;
}

// Get translation with parameters (e.g., t("common.delete", { name: "test" }))
export function tp(path: string, params: Record<string, string> = {}): string {
  let result = t(path);
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, value);
  }
  return result;
}

// Event for locale changes
type LocaleChangeListener = (locale: Locale) => void;
const listeners = new Set<LocaleChangeListener>();

export function onLocaleChanged(callback: LocaleChangeListener): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function dispatchLocaleChangedEvent(): void {
  for (const listener of listeners) {
    listener(currentLocale);
  }
}

// React directive for locale-aware rendering
// Use this in Lit components to trigger re-renders on locale change
export interface ReactiveLocaleState {
  locale: Locale;
  t: (path: string) => string;
  tp: (path: string, params?: Record<string, string>) => string;
  setLocale: (locale: Locale) => void;
  getAvailableLocales: () => Array<{ code: Locale; name: string; native: string }>;
}

export function useLocale(): ReactiveLocaleState {
  return {
    get locale() {
      return getLocale();
    },
    t,
    tp,
    setLocale,
    getAvailableLocales,
  };
}

// Export current translations for direct access
export { allTranslations, en, zh_CN };
