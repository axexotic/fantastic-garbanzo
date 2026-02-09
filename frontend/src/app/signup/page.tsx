"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Globe } from "lucide-react";
import { auth } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "th", name: "Thai", flag: "🇹🇭" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "pt", name: "Portuguese", flag: "🇧🇷" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" },
  { code: "id", name: "Indonesian", flag: "🇮🇩" },
  { code: "tr", name: "Turkish", flag: "🇹🇷" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
];

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

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

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
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Globe className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">VoiceTranslate</span>
          </Link>
          <p className="mt-2 text-muted-foreground">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Email
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
              Username
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
              Display Name
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
              Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Your Language
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

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
