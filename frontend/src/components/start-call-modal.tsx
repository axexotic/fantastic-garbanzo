"use client";

import { useState } from "react";
import { Loader2, Phone, Video, X } from "lucide-react";
import { calls as callsApi } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";

interface StartCallModalProps {
  chatId: string;
  chatName: string;
  onClose: () => void;
}

export function StartCallModal({ chatId, chatName, onClose }: StartCallModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const handleStartCall = async (type: "voice" | "video") => {
    setLoading(true);
    setError("");
    try {
      const call = await callsApi.start(chatId, type);
      // Open call in new tab with callId for joining
      window.open(`/call/${call.room_name}?callId=${call.id}&type=${type}`, "_blank");
      onClose();
    } catch (err: any) {
      setError(err.message || t("call.failedStart"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("call.startCall")}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-6 text-sm text-muted-foreground">
          {t("call.startCallWith", { name: chatName })}
        </p>

        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={() => handleStartCall("voice")}
            disabled={loading}
            className="flex flex-1 flex-col items-center gap-2 rounded-xl border border-border py-6 transition-colors hover:bg-secondary"
          >
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <Phone className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium">{t("call.voiceCall")}</span>
              </>
            )}
          </button>
          <button
            onClick={() => handleStartCall("video")}
            disabled={loading}
            className="flex flex-1 flex-col items-center gap-2 rounded-xl border border-border py-6 transition-colors hover:bg-secondary"
          >
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <Video className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium">{t("call.videoCall")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
