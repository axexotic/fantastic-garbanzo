"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Request failed");
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-primary">{t("auth.resetPassword")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("auth.resetPasswordDesc")}
          </p>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <div className="rounded-lg bg-green-500/10 p-4 text-sm text-green-400">
              {t("auth.resetLinkSent")}
            </div>
            <Link
              href="/login"
              className="inline-block text-sm text-primary hover:underline"
            >
              {t("auth.backToLogin")}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                {t("auth.email")}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? t("auth.sending") : t("auth.sendResetLink")}
            </button>
            <p className="text-center text-sm text-muted-foreground">
              {t("auth.rememberPassword")}{" "}
              <Link href="/login" className="text-primary hover:underline">
                {t("auth.login")}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
