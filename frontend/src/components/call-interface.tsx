"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LiveKitRoom,
  VideoTrack,
  AudioTrack,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  RoomAudioRenderer,
  useConnectionState,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track, ConnectionState, RoomEvent } from "livekit-client";
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
  serverUrl: string;
  token: string;
  callId: string;
  callType: "voice" | "video";
  onLeave?: () => void;
}

/* ─── Participant Video Tile ────────────────────────────── */

function ParticipantTile({
  trackRef,
  isLocal,
  name,
}: {
  trackRef?: any;
  isLocal?: boolean;
  name: string;
}) {
  const label = isLocal ? "You" : name || "Participant";

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-secondary">
      {trackRef ? (
        <VideoTrack
          trackRef={trackRef}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: isLocal ? "scaleX(-1)" : undefined }}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-2xl font-bold text-primary">
            {label.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Name tag */}
      <div className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">
        {label}
      </div>
    </div>
  );
}

/* ─── Call Content (inside LiveKitRoom) ─────────────────── */

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
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const connectionState = useConnectionState();

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(callType === "video");
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Get video tracks
  const videoTracks = useTracks([Track.Source.Camera], {
    onlySubscribed: false,
  });

  // Call timer
  useEffect(() => {
    if (connectionState === ConnectionState.Connected) {
      timerRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [connectionState]);

  // Set camera on/off based on call type after connecting
  useEffect(() => {
    if (localParticipant && connectionState === ConnectionState.Connected) {
      localParticipant.setCameraEnabled(callType === "video");
      localParticipant.setMicrophoneEnabled(true);
    }
  }, [localParticipant, connectionState, callType]);

  const toggleMute = useCallback(async () => {
    if (!localParticipant) return;
    const newMuted = !isMuted;
    await localParticipant.setMicrophoneEnabled(!newMuted);
    setIsMuted(newMuted);
  }, [localParticipant, isMuted]);

  const toggleVideo = useCallback(async () => {
    if (!localParticipant) return;
    const newVideoOn = !isVideoOn;
    await localParticipant.setCameraEnabled(newVideoOn);
    setIsVideoOn(newVideoOn);
  }, [localParticipant, isVideoOn]);

  const handleLeave = useCallback(async () => {
    try {
      await callsApi.end(callId);
    } catch (e) {
      console.error("Failed to end call:", e);
    }
    if (onLeave) {
      onLeave();
    } else {
      router.push("/dashboard");
    }
  }, [callId, router, onLeave]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const totalParticipants = 1 + remoteParticipants.length;

  // Loading state
  if (connectionState === ConnectionState.Connecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Joining call...</p>
        </div>
      </div>
    );
  }

  // Disconnected state
  if (connectionState === ConnectionState.Disconnected) {
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

  // Get local video track
  const localVideoTrack = videoTracks.find(
    (t) => t.participant.identity === localParticipant?.identity
  );

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
            {totalParticipants}
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
              totalParticipants <= 1
                ? "grid-cols-1 max-w-2xl"
                : totalParticipants <= 4
                  ? "grid-cols-2"
                  : "grid-cols-3"
            }`}
          >
            {/* Local participant */}
            <ParticipantTile
              trackRef={localVideoTrack}
              isLocal
              name="You"
            />
            {/* Remote participants */}
            {remoteParticipants.map((participant) => {
              const remoteTrack = videoTracks.find(
                (t) => t.participant.identity === participant.identity
              );
              return (
                <ParticipantTile
                  key={participant.identity}
                  trackRef={remoteTrack}
                  name={participant.name || participant.identity}
                />
              );
            })}
          </div>
        ) : (
          /* Voice-only: show avatars + wave animation */
          <div className="flex flex-col items-center gap-8">
            <div className="flex flex-wrap justify-center gap-6">
              {/* Local */}
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-xl font-bold text-primary">
                  You
                </div>
                <span className="text-xs text-muted-foreground">You</span>
              </div>
              {/* Remote */}
              {remoteParticipants.map((p) => (
                <div key={p.identity} className="flex flex-col items-center gap-2">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-xl font-bold text-foreground">
                    {(p.name || p.identity).charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {p.name || p.identity}
                  </span>
                </div>
              ))}
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

      {/* Audio renderer for remote participants */}
      <RoomAudioRenderer />

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

/* ─── Main Wrapper — connect to LiveKit room ───────────── */

export function CallInterface({
  serverUrl,
  token,
  callId,
  callType,
  onLeave,
}: CallInterfaceProps) {
  const router = useRouter();

  if (!serverUrl || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <PhoneOff className="h-10 w-10 text-muted-foreground" />
          <p className="text-destructive">Missing server URL or token</p>
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
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={true}
      audio={true}
      video={callType === "video"}
      onDisconnected={() => {
        if (onLeave) onLeave();
      }}
    >
      <CallContent callId={callId} callType={callType} onLeave={onLeave} />
    </LiveKitRoom>
  );
}
