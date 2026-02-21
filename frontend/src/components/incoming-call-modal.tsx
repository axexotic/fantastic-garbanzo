"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Phone, PhoneOff, Video, X } from "lucide-react";
import { calls as callsApi } from "@/lib/api";
import { useCallStore, type IncomingCallData } from "@/lib/store";
import { useTranslation } from "@/lib/i18n";

interface IncomingCallModalProps {
  call: IncomingCallData;
  onDismiss: () => void;
}

export function IncomingCallModal({ call, onDismiss }: IncomingCallModalProps) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [declining, setDeclining] = useState(false);
  const { setIncomingCall } = useCallStore();
  const { t } = useTranslation();
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      handleDecline();
    }, 30000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleAccept = useCallback(async () => {
    setJoining(true);
    try {
      const data = await callsApi.join(call.call_id);
      setIncomingCall(null);
      // Navigate to call page
      router.push(
        `/call/${call.room_name}?callId=${call.call_id}&type=${call.call_type}`
      );
    } catch (err: any) {
      console.error("Failed to join call:", err);
      alert(err.message || t("call.failedJoin"));
    } finally {
      setJoining(false);
    }
  }, [call, router, setIncomingCall]);

  const handleDecline = useCallback(async () => {
    setDeclining(true);
    try {
      await callsApi.decline(call.call_id);
    } catch (err) {
      console.error("Failed to decline:", err);
    } finally {
      setIncomingCall(null);
      setDeclining(false);
      onDismiss();
    }
  }, [call, setIncomingCall, onDismiss]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/20">
            <div className="animate-pulse">
              {call.call_type === "video" ? (
                <Video className="h-10 w-10 text-primary" />
              ) : (
                <Phone className="h-10 w-10 text-primary" />
              )}
            </div>
          </div>
          <h2 className="text-xl font-bold">{call.initiator_name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("call.incomingCall", { type: call.call_type })}
          </p>
        </div>

        {/* Animated ring indicator */}
        <div className="mb-6 flex items-center justify-center gap-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-6 w-1 rounded-full bg-primary animate-pulse"
              style={{
                animationDelay: `${i * 120}ms`,
                animationDuration: "0.8s",
              }}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-8">
          {/* Decline */}
          <button
            onClick={handleDecline}
            disabled={declining || joining}
            className="flex flex-col items-center gap-2"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white transition-transform hover:scale-105 active:scale-95">
              {declining ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <PhoneOff className="h-7 w-7" />
              )}
            </div>
            <span className="text-xs text-muted-foreground">{t("call.decline")}</span>
          </button>

          {/* Accept */}
          <button
            onClick={handleAccept}
            disabled={joining || declining}
            className="flex flex-col items-center gap-2"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-white transition-transform hover:scale-105 active:scale-95">
              {joining ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <Phone className="h-7 w-7" />
              )}
            </div>
            <span className="text-xs text-muted-foreground">{t("call.accept")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
