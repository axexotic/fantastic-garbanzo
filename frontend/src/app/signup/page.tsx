"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Globe, Search, Check } from "lucide-react";
import { auth } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useTranslation, LANGUAGES } from "@/lib/i18n";

export default function SignupPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { t, locale, setLocale } = useTranslation();

  const [form, setForm] = useState({
    email: "",
    username: "",
    display_name: "",
    password: "",
    preferred_language: locale,
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [langSearch, setLangSearch] = useState("");
  const [showAllLangs, setShowAllLangs] = useState(false);

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  /* ── Language picker logic ─────────────────────────────── */
  const filteredLangs = useMemo(() => {
    if (!langSearch.trim()) return LANGUAGES;
    const q = langSearch.toLowerCase();
    return LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nameEn.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
  }, [langSearch]);

  const displayLangs = showAllLangs ? filteredLangs : filteredLangs.slice(0, 24);

  const handleLangSelect = (code: string) => {
    update("preferred_language", code);
    setLocale(code); // instantly switch entire app UI
  };

  const selectedLang = LANGUAGES.find((l) => l.code === form.preferred_language);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await auth.signup(form);
      setAuth(res.user, res.token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Globe className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">VoiceTranslate</span>
          </Link>
          <p className="mt-2 text-muted-foreground">{t("auth.createAccount")}</p>
        </div>

        {/* ── Language Picker (first & prominent) ────────── */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                {t("auth.yourLanguage")}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t("auth.langPickerHint")}
              </div>
            </div>
            {selectedLang && (
              <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                <span className="text-base">{selectedLang.flag}</span>
                {selectedLang.name}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={langSearch}
              onChange={(e) => setLangSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t("auth.searchLanguage")}
            />
          </div>

          {/* Language Grid */}
          <div className="grid grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-1">
            {displayLangs.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleLangSelect(lang.code)}
                className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs transition-all ${
                  form.preferred_language === lang.code
                    ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1 ring-offset-background"
                    : "hover:bg-secondary/60 border border-transparent hover:border-border"
                }`}
                title={`${lang.name} (${lang.nameEn})`}
              >
                <span className="text-base">{lang.flag}</span>
                <span className="truncate font-medium">{lang.name}</span>
                {form.preferred_language === lang.code && (
                  <Check className="absolute right-1 top-1 h-3 w-3" />
                )}
              </button>
            ))}
          </div>

          {/* Show All / Show Less */}
          {!langSearch && filteredLangs.length > 24 && (
            <button
              type="button"
              onClick={() => setShowAllLangs(!showAllLangs)}
              className="mt-2 w-full text-center text-xs text-primary hover:underline"
            >
              {showAllLangs
                ? t("auth.showLess")
                : t("auth.showAllLanguages", { count: String(LANGUAGES.length) })}
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              {t("auth.email")}
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                {t("auth.username")}
              </label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="cooluser42"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                {t("auth.displayName")}
              </label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => update("display_name", e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Your Name"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              {t("auth.password")}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
              minLength={8}
              required
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1 rounded border-border"
              required
            />
            <span>
              {t("auth.agreeToTerms")}{" "}
              <Link href="/terms" target="_blank" className="text-primary hover:underline">
                {t("auth.termsOfService")}
              </Link>{" "}
              {t("auth.and")}{" "}
              <Link href="/privacy" target="_blank" className="text-primary hover:underline">
                {t("auth.privacyPolicy")}
              </Link>
            </span>
          </label>

          <button
            type="submit"
            disabled={isLoading || !agreedToTerms}
            className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? t("auth.creatingAccount") : t("auth.signup")}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {t("auth.alreadyHaveAccount")}{" "}
          <Link href="/login" className="text-primary hover:underline">
            {t("auth.login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
