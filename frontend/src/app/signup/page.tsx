"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Globe } from "lucide-react";
import { auth } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useTranslation, LANGUAGES } from "@/lib/i18n";

export default function SignupPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({
    email: "",
    username: "",
    display_name: "",
    password: "",
    preferred_language: "en",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const { t } = useTranslation();

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await auth.signup(form);
      setAuth(res.user);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Globe className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">VoiceTranslate</span>
          </Link>
          <p className="mt-2 text-muted-foreground">{t("auth.createAccount")}</p>
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

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              {t("auth.yourLanguage")}
            </label>
            <select
              value={form.preferred_language}
              onChange={(e) => update("preferred_language", e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
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
