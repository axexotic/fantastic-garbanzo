"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import {
  DailyProvider,
  DailyAudio,
  DailyVideo,
  useDaily,
  useLocalParticipant,
  useParticipantIds,
  useMeetingState,
  useVideoTrack,
  useAudioTrack,
} from "@daily-co/daily-react";
import {
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { calls as callsApi } from "@/lib/api";

/* ─── Props ─────────────────────────────────────────────── */

interface CallInterfaceProps {
  roomUrl: string;
  token: string;
  callId: string;
  callType: "voice" | "video";
  onLeave?: () => void;
}

/* ─── Participant Video Tile ────────────────────────────── */

function ParticipantTile({
  sessionId,
  isLocal,
  userName,
}: {
  sessionId: string;
  isLocal?: boolean;
  userName?: string;
}) {
  const videoTrack = useVideoTrack(sessionId);
  const audioTrack = useAudioTrack(sessionId);
  const isVideoOn = !videoTrack.isOff;

  const label = isLocal ? "You" : userName || "Participant";

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-secondary">
      {isVideoOn ? (
        <DailyVideo
          sessionId={sessionId}
          mirror={isLocal}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-2xl font-bold text-primary">
            {label.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Muted badge */}
      {audioTrack.isOff && (
        <div className="absolute bottom-2 right-2 rounded-full bg-red-500/80 p-1">
          <MicOff className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Name tag */}
      <div className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">
        {label}
      </div>
    </div>
  );
}

/* ─── Call Content (inside DailyProvider) ───────────────── */

function CallContent({
  callId,
  callType,
  onLeave,
}: {
  callId: string;
  callType: "voice" | "video";
  onLeave?: () => void;
}) {
  const router = useRouter();
  const daily = useDaily();
  const localParticipant = useLocalParticipant();
  const participantIds = useParticipantIds();
  const meetingState = useMeetingState();

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(callType === "video");
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Call timer
  useEffect(() => {
    if (meetingState === "joined-meeting") {
      timerRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [meetingState]);

  // Set camera on/off based on call type after joining
  useEffect(() => {
    if (daily && meetingState === "joined-meeting") {
      daily.setLocalVideo(callType === "video");
    }
  }, [daily, meetingState, callType]);

  const toggleMute = useCallback(() => {
    if (!daily) return;
    const newMuted = !isMuted;
    daily.setLocalAudio(!newMuted);
    setIsMuted(newMuted);
  }, [daily, isMuted]);

  const toggleVideo = useCallback(() => {
    if (!daily) return;
    const newVideoOn = !isVideoOn;
    daily.setLocalVideo(newVideoOn);
    setIsVideoOn(newVideoOn);
  }, [daily, isVideoOn]);

  const handleLeave = useCallback(async () => {
    try {
      await callsApi.end(callId);
    } catch (e) {
      console.error("Failed to end call:", e);
    }
    if (daily) {
      try {
        await daily.leave();
        daily.destroy();
      } catch {}
    }
    if (onLeave) {
      onLeave();
    } else {
      router.push("/dashboard");
    }
  }, [daily, callId, router, onLeave]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const remoteParticipantIds = participantIds.filter(
    (id) => id !== localParticipant?.session_id
  );

  // Loading state
  if (meetingState === "joining-meeting" || meetingState === "new") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Joining call...</p>
        </div>
      </div>
    );
  }

  // Left / error state
  if (meetingState === "left-meeting" || meetingState === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <PhoneOff className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">Call ended</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ─── Status Bar ─── */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-sm text-muted-foreground">
            {callType === "video" ? "Video Call" : "Voice Call"}
          </span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {participantIds.length}
          </span>
        </div>
        <span className="font-mono text-sm text-muted-foreground">
          {formatDuration(callDuration)}
        </span>
      </div>

      {/* ─── Participant Grid ─── */}
      <div className="flex flex-1 items-center justify-center p-6">
        {callType === "video" ? (
          <div
            className={`grid w-full max-w-5xl gap-4 ${
              participantIds.length <= 1
                ? "grid-cols-1 max-w-2xl"
                : participantIds.length <= 4
                  ? "grid-cols-2"
                  : "grid-cols-3"
            }`}
          >
            {localParticipant && (
              <ParticipantTile
                sessionId={localParticipant.session_id}
                isLocal
              />
            )}
            {remoteParticipantIds.map((id) => (
              <ParticipantTile key={id} sessionId={id} />
            ))}
          </div>
        ) : (
          /* Voice-only: show avatars + wave animation */
          <div className="flex flex-col items-center gap-8">
            <div className="flex flex-wrap justify-center gap-6">
              {participantIds.map((id) => {
                const isLocal = id === localParticipant?.session_id;
                return (
                  <div key={id} className="flex flex-col items-center gap-2">
                    <div
                      className={`flex h-20 w-20 items-center justify-center rounded-full text-xl font-bold ${
                        isLocal ? "bg-primary/20 text-primary" : "bg-secondary text-foreground"
                      }`}
                    >
                      {isLocal ? "You" : "P"}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {isLocal ? "You" : "Participant"}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Animated wave bars */}
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-8 w-1.5 rounded-full bg-primary animate-pulse"
                  style={{
                    animationDelay: `${i * 150}ms`,
                    animationDuration: "1s",
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hidden audio element for remote participants */}
      <DailyAudio />

      {/* ─── Controls ─── */}
      <div className="flex items-center justify-center gap-6 border-t border-border py-6">
        {/* Mute toggle */}
        <button
          onClick={toggleMute}
          className={`rounded-full p-4 transition-colors ${
            isMuted
              ? "bg-red-500/20 text-red-500"
              : "bg-secondary text-foreground hover:bg-secondary/80"
          }`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <MicOff className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </button>

        {/* Video toggle — only in video calls */}
        {callType === "video" && (
          <button
            onClick={toggleVideo}
            className={`rounded-full p-4 transition-colors ${
              !isVideoOn
                ? "bg-red-500/20 text-red-500"
                : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
            title={isVideoOn ? "Turn off camera" : "Turn on camera"}
          >
            {isVideoOn ? (
              <Video className="h-6 w-6" />
            ) : (
              <VideoOff className="h-6 w-6" />
            )}
          </button>
        )}

        {/* Hang up */}
        <button
          onClick={handleLeave}
          className="rounded-full bg-red-600 p-5 text-white transition-colors hover:bg-red-700"
          title="Leave call"
        >
          <PhoneOff className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}

/* ─── Main Wrapper — creates Daily call object & provider ─ */

export function CallInterface({
  roomUrl,
  token,
  callId,
  callType,
  onLeave,
}: CallInterfaceProps) {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!roomUrl || !token) {
      console.error("Missing roomUrl or token for Daily.co call");
      return;
    }

    const co = DailyIframe.createCallObject({
      url: roomUrl,
      token,
      startVideoOff: callType !== "video",
      startAudioOff: false,
    });

    setCallObject(co);

    co.join().catch((err: unknown) => {
      console.error("Failed to join Daily.co room:", err);
    });

    return () => {
      co.leave()
        .then(() => co.destroy())
        .catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomUrl, token]);

  if (!callObject) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Initializing call...</p>
        </div>
      </div>
    );
  }

  return (
    <DailyProvider callObject={callObject}>
      <CallContent callId={callId} callType={callType} onLeave={onLeave} />
    </DailyProvider>
  );
}
