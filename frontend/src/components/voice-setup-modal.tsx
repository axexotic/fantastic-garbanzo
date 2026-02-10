"use client";

import { useState } from "react";
import { X, Mic, Volume2, Globe, Sparkles, ChevronRight, Loader2, CheckCircle2 } from "lucide-react";
import { VoiceRecorder } from "./voice-recorder";
import { voice as voiceApi } from "@/lib/api";

interface VoiceSetupModalProps {
  onClose: () => void;
  onComplete: () => void;
}

type Step = "intro" | "record" | "processing" | "success";

export function VoiceSetupModal({ onClose, onComplete }: VoiceSetupModalProps) {
  const [step, setStep] = useState<Step>("intro");
  const [error, setError] = useState<string | null>(null);

  const handleRecordingComplete = async (audioBlob: Blob, duration: number) => {
    setStep("processing");
    setError(null);

    try {
      // Convert to WAV if needed (ElevenLabs prefers WAV)
      await voiceApi.cloneVoice(audioBlob);
      setStep("success");
    } catch (err: any) {
      console.error("Voice cloning failed:", err);
      setError(err.message || "Failed to clone voice. Please try again.");
      setStep("record");
    }
  };

  const handleSkip = () => {
    // Save that user skipped voice setup
    localStorage.setItem("voice_setup_skipped", "true");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-2xl rounded-2xl bg-background shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        {/* ─── Intro Step ─── */}
        {step === "intro" && (
          <div className="p-8">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Clone Your Voice</h2>
              <p className="mt-2 text-muted-foreground">
                Create your personal voice profile for live call translation
              </p>
            </div>

            {/* Features */}
            <div className="mb-8 space-y-4">
              <div className="flex items-start gap-4 rounded-xl bg-secondary/30 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                  <Mic className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Your Voice, Every Language</h3>
                  <p className="text-sm text-muted-foreground">
                    When you call someone, they&apos;ll hear YOU speaking their language,
                    not a generic voice.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-xl bg-secondary/30 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Natural Conversations</h3>
                  <p className="text-sm text-muted-foreground">
                    Your personality and tone are preserved across 20+ languages
                    for more authentic communication.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-xl bg-secondary/30 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                  <Volume2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">60 Second Setup</h3>
                  <p className="text-sm text-muted-foreground">
                    Just record 60 seconds of yourself speaking naturally. Our AI
                    does the rest.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setStep("record")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:opacity-90"
              >
                Set Up Voice Profile
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                onClick={handleSkip}
                className="w-full rounded-xl py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Skip for now — I&apos;ll use a default voice
              </button>
            </div>
          </div>
        )}

        {/* ─── Recording Step ─── */}
        {step === "record" && (
          <div className="p-8">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold">Record Your Voice</h2>
              <p className="mt-2 text-muted-foreground">
                Speak naturally for at least 60 seconds. Read a story, describe your day,
                or just talk!
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <VoiceRecorder
              minDuration={60}
              maxDuration={120}
              onRecordingComplete={handleRecordingComplete}
            />

            <div className="mt-4 text-center">
              <button
                onClick={() => setStep("intro")}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* ─── Processing Step ─── */}
        {step === "processing" && (
          <div className="flex flex-col items-center justify-center p-12">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <h2 className="mt-6 text-2xl font-bold">Creating Your Voice Profile</h2>
            <p className="mt-2 text-center text-muted-foreground">
              Our AI is analyzing your voice patterns. This usually takes 30-60 seconds...
            </p>
            <div className="mt-8 w-full max-w-xs">
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
              </div>
            </div>
          </div>
        )}

        {/* ─── Success Step ─── */}
        {step === "success" && (
          <div className="flex flex-col items-center justify-center p-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <h2 className="mt-6 text-2xl font-bold">Voice Profile Created!</h2>
            <p className="mt-2 text-center text-muted-foreground">
              Your voice is now ready for live translation calls. When you call someone,
              they&apos;ll hear your voice speaking their language!
            </p>

            <div className="mt-8 rounded-xl bg-secondary/50 p-4 text-center text-sm">
              <span className="font-medium">Pro tip:</span>{" "}
              <span className="text-muted-foreground">
                You can update your voice profile anytime in Settings.
              </span>
            </div>

            <button
              onClick={onComplete}
              className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3 font-semibold text-primary-foreground transition-colors hover:opacity-90"
            >
              Start Chatting
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
