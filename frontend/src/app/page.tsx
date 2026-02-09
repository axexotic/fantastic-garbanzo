"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Globe, MessageCircle, Phone, Users, Zap } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading, loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (!isLoading && user) {
      router.push("/dashboard");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Hero */}
      <div className="mb-12 text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <Globe className="h-12 w-12 text-primary" />
          <h1 className="text-5xl font-bold tracking-tight">VoiceTranslate</h1>
        </div>
        <p className="text-xl text-muted-foreground">
          Chat without language barriers.
        </p>
        <p className="mt-2 text-muted-foreground">
          Send messages, make calls, create groups — all translated in real time.
        </p>
      </div>

      {/* Features */}
      <div className="mb-12 grid max-w-2xl grid-cols-2 gap-6 md:grid-cols-4">
        {[
          { icon: MessageCircle, label: "Translated Chat", desc: "Auto-translate messages" },
          { icon: Phone, label: "Voice Calls", desc: "Real-time voice translation" },
          { icon: Users, label: "Group Chat", desc: "Multi-language groups" },
          { icon: Zap, label: "<500ms", desc: "Feels instant" },
        ].map((f) => (
          <div key={f.label} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-secondary/30 p-4 text-center">
            <f.icon className="h-8 w-8 text-primary" />
            <span className="text-sm font-semibold">{f.label}</span>
            <span className="text-xs text-muted-foreground">{f.desc}</span>
          </div>
        ))}
      </div>

      {/* Auth Buttons */}
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-xl border border-border px-8 py-3 text-lg font-medium transition-colors hover:bg-secondary"
        >
          Log In
        </Link>
        <Link
          href="/signup"
          className="rounded-xl bg-primary px-8 py-3 text-lg font-semibold text-primary-foreground transition-colors hover:opacity-90"
        >
          Sign Up
        </Link>
      </div>

      <p className="mt-12 text-xs text-muted-foreground">
        Powered by GPT-4 + ElevenLabs + Deepgram + Daily.co
      </p>
    </div>
  );
}
