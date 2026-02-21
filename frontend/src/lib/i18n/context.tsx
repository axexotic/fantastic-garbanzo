"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Translations, Language } from "./types";
import { LANGUAGES, DEFAULT_LOCALE, getLanguage } from "./languages";

/* ─── Locale loaders (dynamic import for code-splitting) ──── */
const LOCALE_LOADERS: Record<string, () => Promise<{ default: Translations }>> = {
  en: () => import("./locales/en"),
  th: () => import("./locales/th"),
  es: () => import("./locales/es"),
  fr: () => import("./locales/fr"),
  de: () => import("./locales/de"),
  ja: () => import("./locales/ja"),
  ko: () => import("./locales/ko"),
  zh: () => import("./locales/zh"),
  ar: () => import("./locales/ar"),
  pt: () => import("./locales/pt"),
  ru: () => import("./locales/ru"),
  hi: () => import("./locales/hi"),
  vi: () => import("./locales/vi"),
  id: () => import("./locales/id"),
  tr: () => import("./locales/tr"),
  it: () => import("./locales/it"),
  pl: () => import("./locales/pl"),
  uk: () => import("./locales/uk"),
};

/** Locales that have a full translation file */
export const SUPPORTED_LOCALES = Object.keys(LOCALE_LOADERS);

/* ─── Cookie helpers (no localStorage) ────────────────────── */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  const d = new Date();
  d.setTime(d.getTime() + days * 86400000);
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;expires=${d.toUTCString()};SameSite=Lax`;
}

/* ─── Context shape ───────────────────────────────────────── */
interface I18nContextValue {
  /** Current locale code */
  locale: string;
  /** Current language metadata */
  language: Language;
  /** All available languages */
  languages: Language[];
  /** Translation function — pass a key and optional interpolation params */
  t: (key: keyof Translations, params?: Record<string, string | number>) => string;
  /** Switch to a new locale */
  setLocale: (code: string) => void;
  /** Whether translations are still loading */
  loading: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/* ─── Provider ────────────────────────────────────────────── */
interface I18nProviderProps {
  children: React.ReactNode;
  /** Override initial locale (e.g. from server or user preference) */
  initialLocale?: string;
}

// In-memory cache so we don't re-fetch the same locale
const translationsCache: Record<string, Partial<Translations>> = {};

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<string>(() => {
    // Priority: prop > cookie > browser lang > default
    if (initialLocale && LOCALE_LOADERS[initialLocale]) return initialLocale;
    const saved = getCookie("app_lang");
    if (saved && LOCALE_LOADERS[saved]) return saved;
    if (typeof navigator !== "undefined") {
      const browserLang = navigator.language.split("-")[0];
      if (LOCALE_LOADERS[browserLang]) return browserLang;
    }
    return DEFAULT_LOCALE;
  });

  const [translations, setTranslations] = useState<Partial<Translations> | null>(null);
  const [fallback, setFallback] = useState<Translations | null>(null);
  const [loading, setLoading] = useState(true);

  // Load English fallback once
  useEffect(() => {
    if (translationsCache["en"]) {
      setFallback(translationsCache["en"] as Translations);
    } else {
      LOCALE_LOADERS["en"]().then((mod) => {
        translationsCache["en"] = mod.default;
        setFallback(mod.default as Translations);
      });
    }
  }, []);

  // Load current locale translations
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const code = LOCALE_LOADERS[locale] ? locale : DEFAULT_LOCALE;

    if (translationsCache[code]) {
      setTranslations(translationsCache[code]);
      setLoading(false);
      return;
    }

    LOCALE_LOADERS[code]().then((mod) => {
      if (cancelled) return;
      translationsCache[code] = mod.default;
      setTranslations(mod.default);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  // Update <html> lang and dir attributes
  useEffect(() => {
    const lang = getLanguage(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = lang?.dir === "rtl" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((code: string) => {
    setLocaleState(code);
    setCookie("app_lang", code);
  }, []);

  const t = useCallback(
    (key: keyof Translations, params?: Record<string, string | number>): string => {
      let text =
        (translations && translations[key]) ||
        (fallback && fallback[key]) ||
        (key as string);

      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        });
      }
      return text;
    },
    [translations, fallback]
  );

  const language = useMemo(
    () => getLanguage(locale) || LANGUAGES[0],
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      language,
      languages: LANGUAGES,
      t,
      setLocale,
      loading,
    }),
    [locale, language, t, setLocale, loading]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/* ─── Hook ────────────────────────────────────────────────── */
export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within <I18nProvider>");
  }
  return ctx;
}
