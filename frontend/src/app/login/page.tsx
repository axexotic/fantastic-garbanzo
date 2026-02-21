"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Globe, ChevronDown } from "lucide-react";
import { auth } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useTranslation, LANGUAGES } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { t, locale, setLocale } = useTranslation();

  /* ── Language quick-switch dropdown ──────────────────── */
  const [langOpen, setLangOpen] = useState(false);
  const [langSearch, setLangSearch] = useState("");
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedLang = LANGUAGES.find((l) => l.code === locale);
  const filteredLangs = langSearch
    ? LANGUAGES.filter(
        (l) =>
          l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
          l.nameEn.toLowerCase().includes(langSearch.toLowerCase())
      )
    : LANGUAGES;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await auth.login({ login, password });
      setAuth(res.user);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed. Is the backend running?");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemo = () => {
    setAuth(
      {
        id: "demo-user-1",
        email: "demo@example.com",
        username: "demo",
        display_name: "Demo User",
        avatar_url: "",
        preferred_language: "en",
        status: "online",
        bio: "Demo account",
      }
    );
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Globe className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">VoiceTranslate</span>
          </Link>
          <p className="mt-2 text-muted-foreground">{t("auth.welcomeBack")}</p>

          {/* Language quick-switch */}
          <div className="mt-3 flex justify-center" ref={langRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangOpen(!langOpen)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary/50 transition-colors"
              >
                <span>{selectedLang?.flag}</span>
                <span>{selectedLang?.name}</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${langOpen ? "rotate-180" : ""}`} />
              </button>
              {langOpen && (
                <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 w-72 rounded-xl border border-border bg-card shadow-lg z-50 p-2">
                  <input
                    type="text"
                    value={langSearch}
                    onChange={(e) => setLangSearch(e.target.value)}
                    placeholder={t("auth.searchLanguage")}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                  <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                    {filteredLangs.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          setLocale(lang.code);
                          setLangOpen(false);
                          setLangSearch("");
                        }}
                        className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                          locale === lang.code
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-secondary/50"
                        }`}
                      >
                        <span>{lang.flag}</span>
                        <span className="truncate">{lang.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              {t("auth.emailOrUsername")}
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              {t("auth.password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? t("auth.loggingIn") : t("auth.login")}
          </button>
        </form>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">{t("common.or")}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDemo}
          className="w-full rounded-lg border border-border py-3 font-medium transition-colors hover:bg-secondary"
        >
          {t("auth.tryDemo")}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          {t("auth.dontHaveAccount")}{" "}
          <Link href="/signup" className="text-primary hover:underline">
            {t("auth.signup")}
          </Link>
        </p>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/forgot-password" className="text-primary hover:underline">
            {t("auth.forgotPassword")}
          </Link>
        </p>
      </div>
    </div>
  );
}
