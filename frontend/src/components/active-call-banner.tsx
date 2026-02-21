"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Phone, Users, Video } from "lucide-react";
import { calls as callsApi } from "@/lib/api";
import type { ActiveCallData } from "@/lib/store";
import { useTranslation } from "@/lib/i18n";

interface ActiveCallBannerProps {
  call: ActiveCallData;
}

export function ActiveCallBanner({ call }: ActiveCallBannerProps) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const { t } = useTranslation();

  const handleJoin = async () => {
    setJoining(true);
    try {
      await callsApi.join(call.call_id);
      router.push(
        `/call/${call.room_name}?callId=${call.call_id}&type=${call.call_type}`
      );
    } catch (err: any) {
      console.error("Failed to join call:", err);
      alert(err.message || "Failed to join call");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="flex items-center justify-between bg-green-600/10 border-b border-green-600/20 px-4 py-2">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600/20">
          {call.call_type === "video" ? (
            <Video className="h-4 w-4 text-green-500" />
          ) : (
            <Phone className="h-4 w-4 text-green-500" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-green-600 dark:text-green-400">
            {t("call.callInProgress", { type: call.call_type === "video" ? t("call.videoCall") : t("call.voiceCall") })}
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            {t("call.participantCount", { count: String(call.participant_count) })}
          </p>
        </div>
      </div>
      <button
        onClick={handleJoin}
        disabled={joining}
        className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
      >
        {joining ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          t("call.join")
        )}
      </button>
    </div>
  );
}
