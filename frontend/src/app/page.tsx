"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Globe, MessageCircle, Phone, Users, Zap, Video } from "lucide-react";
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
          <h1 className="text-5xl font-bold tracking-tight">FlaskAI</h1>
        </div>
        <p className="text-xl text-muted-foreground">
          Speak your language. They hear theirs.
        </p>
        <p className="mt-2 max-w-md mx-auto text-muted-foreground">
          Real-time voice & video calls with instant same-voice translation.
          So seamless you won&apos;t even know it&apos;s there.
        </p>
      </div>

      {/* Features — voice/video first */}
      <div className="mb-12 grid max-w-2xl grid-cols-2 gap-6 md:grid-cols-4">
        {[
          { icon: Phone, label: "Voice Calls", desc: "Your voice, their language" },
          { icon: Video, label: "Video Calls", desc: "Face-to-face, no barriers" },
          { icon: Zap, label: "<500ms", desc: "Feels like real conversation" },
          { icon: MessageCircle, label: "Chat", desc: "$15 lifetime messaging" },
        ].map((f) => (
          <div key={f.label} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-secondary/30 p-4 text-center">
            <f.icon className="h-8 w-8 text-primary" />
            <span className="text-sm font-semibold">{f.label}</span>
            <span className="text-xs text-muted-foreground">{f.desc}</span>
          </div>
        ))}
      </div>

      {/* Pricing summary */}
      <div className="mb-12 flex flex-wrap justify-center gap-4">
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 px-6 py-4 text-center">
          <div className="text-2xl font-bold text-indigo-400">$15</div>
          <div className="text-xs text-muted-foreground">Lifetime Chat</div>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-6 py-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">$1+</div>
          <div className="text-xs text-muted-foreground">Voice Credits</div>
        </div>
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
        Powered by GPT-4 + ElevenLabs + Deepgram + LiveKit
      </p>
      <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
        <Link href="/terms" className="hover:text-foreground hover:underline">
          Terms of Service
        </Link>
        <Link href="/privacy" className="hover:text-foreground hover:underline">
          Privacy Policy
        </Link>
      </div>
    </div>
  );
}
