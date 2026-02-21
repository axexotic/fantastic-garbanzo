"use client";

import { useState } from "react";
import { X, Mic, Volume2, Globe, Sparkles, ChevronRight, Loader2, CheckCircle2, Shield } from "lucide-react";
import { VoiceRecorder } from "./voice-recorder";
import { voice as voiceApi, preferences as prefsApi } from "@/lib/api";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

interface VoiceSetupModalProps {
  onClose: () => void;
  onComplete: () => void;
}

type Step = "intro" | "record" | "processing" | "success";

export function VoiceSetupModal({ onClose, onComplete }: VoiceSetupModalProps) {
  const [step, setStep] = useState<Step>("intro");
  const [error, setError] = useState<string | null>(null);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const { t } = useTranslation();

  const handleRecordingComplete = async (audioBlob: Blob, duration: number) => {
    setStep("processing");
    setError(null);

    try {
      // Convert to WAV if needed (ElevenLabs prefers WAV)
      await voiceApi.cloneVoice(audioBlob);
      setStep("success");
    } catch (err: any) {
      console.error("Voice cloning failed:", err);
      setError(err.message || t("voiceSetup.failedClone"));
      setStep("record");
    }
  };

  const handleSkip = async () => {
    // Save that user skipped voice setup in DB
    try {
      await prefsApi.update({ voice_setup_skipped: true });
    } catch {
      // Ignore — close regardless
    }
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
              <h2 className="text-2xl font-bold">{t("voiceSetup.title")}</h2>
              <p className="mt-2 text-muted-foreground">
                {t("voiceSetup.subtitle")}
              </p>
            </div>

            {/* Features */}
            <div className="mb-8 space-y-4">
              <div className="flex items-start gap-4 rounded-xl bg-secondary/30 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                  <Mic className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{t("voiceSetup.feature1Title")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("voiceSetup.feature1Desc")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-xl bg-secondary/30 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{t("voiceSetup.feature2Title")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("voiceSetup.feature2Desc")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-xl bg-secondary/30 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                  <Volume2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{t("voiceSetup.feature3Title")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("voiceSetup.feature3Desc")}
                  </p>
                </div>
              </div>
            </div>

            {/* Voice Data Consent */}
            <div className="mb-4 rounded-xl border border-border bg-secondary/20 p-4">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{t("voiceSetup.consent")}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("voiceSetup.consentText")}
                  </p>
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={voiceConsent}
                      onChange={(e) => setVoiceConsent(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-muted-foreground">
                      {t("voiceSetup.consentCheckbox")}{" "}
                      <Link href="/privacy" target="_blank" className="text-primary hover:underline">
                        {t("auth.privacyPolicy")}
                      </Link>
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setStep("record")}
                disabled={!voiceConsent}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {t("voiceSetup.setupBtn")}
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                onClick={handleSkip}
                className="w-full rounded-xl py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("voiceSetup.skip")}
              </button>
            </div>
          </div>
        )}

        {/* ─── Recording Step ─── */}
        {step === "record" && (
          <div className="p-8">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold">{t("voiceSetup.recordTitle")}</h2>
              <p className="mt-2 text-muted-foreground">
                {t("voiceSetup.recordDesc")}
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
            <h2 className="mt-6 text-2xl font-bold">{t("voiceSetup.creatingTitle")}</h2>
            <p className="mt-2 text-center text-muted-foreground">
              {t("voiceSetup.creatingDesc")}
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
            <h2 className="mt-6 text-2xl font-bold">{t("voiceSetup.doneTitle")}</h2>
            <p className="mt-2 text-center text-muted-foreground">
              {t("voiceSetup.doneDesc")}
            </p>

            <div className="mt-8 rounded-xl bg-secondary/50 p-4 text-center text-sm text-muted-foreground">
              {t("voiceSetup.proTip")}
            </div>

            <button
              onClick={onComplete}
              className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3 font-semibold text-primary-foreground transition-colors hover:opacity-90"
            >
              {t("voiceSetup.startChatting")}
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
