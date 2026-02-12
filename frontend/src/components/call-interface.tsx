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
  Monitor,
  MonitorOff,
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
  chatName?: string;
  isGroupCall?: boolean;
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
  chatName,
  isGroupCall,
  onLeave,
}: {
  callId: string;
  callType: "voice" | "video";
  chatName?: string;
  isGroupCall?: boolean;
  onLeave?: () => void;
}) {
  const router = useRouter();
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const connectionState = useConnectionState();

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(callType === "video");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Get video tracks
  const videoTracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: false }
  );

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

  const toggleScreenShare = useCallback(async () => {
    if (!localParticipant) return;
    const newSharing = !isScreenSharing;
    await localParticipant.setScreenShareEnabled(newSharing);
    setIsScreenSharing(newSharing);
  }, [localParticipant, isScreenSharing]);

  const handleLeave = useCallback(async () => {
    try {
      if (isGroupCall) {
        await callsApi.leave(callId);
      } else {
        await callsApi.end(callId);
      }
    } catch (e) {
      console.error("Failed to leave/end call:", e);
    }
    if (onLeave) {
      onLeave();
    } else {
      router.push("/dashboard");
    }
  }, [callId, router, onLeave, isGroupCall]);

  const handleEndForAll = useCallback(async () => {
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

  // Get local video track and screen share track
  const localVideoTrack = videoTracks.find(
    (t) =>
      t.participant.identity === localParticipant?.identity &&
      t.source === Track.Source.Camera
  );
  const screenShareTracks = videoTracks.filter(
    (t) => t.source === Track.Source.ScreenShare
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ─── Status Bar ─── */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-sm font-medium">
            {chatName || (callType === "video" ? "Video Call" : "Voice Call")}
          </span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {totalParticipants}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-muted-foreground">
            {formatDuration(callDuration)}
          </span>
          {/* Participants Panel Toggle */}
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className={`rounded-lg p-2 text-sm transition-colors ${
              showParticipants
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary"
            }`}
            title="Participants"
          >
            <Users className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── Main Content ─── */}
        <div className="flex flex-1 items-center justify-center p-6">
        {callType === "video" ? (
          <div className="w-full max-w-5xl space-y-4">
            {/* Screen share — full width if present */}
            {screenShareTracks.length > 0 && (
              <div className="w-full">
                {screenShareTracks.map((track) => (
                  <div key={track.participant.identity + "-screen"} className="relative aspect-video w-full overflow-hidden rounded-xl bg-secondary">
                    <VideoTrack
                      trackRef={track}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                    <div className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">
                      {track.participant.identity === localParticipant?.identity
                        ? "Your screen"
                        : `${track.participant.name || track.participant.identity}'s screen`}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Camera grid */}
            <div
              className={`grid w-full gap-4 ${
                totalParticipants <= 1
                  ? "grid-cols-1 max-w-2xl mx-auto"
                  : totalParticipants <= 4
                    ? "grid-cols-2"
                    : totalParticipants <= 9
                      ? "grid-cols-3"
                      : "grid-cols-4"
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
                (t) =>
                  t.participant.identity === participant.identity &&
                  t.source === Track.Source.Camera
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

        {/* Audio renderer for remote participants */}
        <RoomAudioRenderer />

        </div>

        {/* ─── Participants Sidebar ─── */}
        {showParticipants && (
          <div className="w-72 border-l border-border bg-secondary/20 p-4 overflow-y-auto">
            <h3 className="mb-4 text-sm font-semibold">
              Participants ({totalParticipants})
            </h3>
            {/* Local */}
            <div className="mb-2 flex items-center gap-3 rounded-lg px-2 py-2 bg-primary/5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                You
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">You</p>
                <p className="text-xs text-muted-foreground">
                  {isMuted ? "Muted" : "Speaking"}
                </p>
              </div>
              {isMuted ? (
                <MicOff className="h-3.5 w-3.5 text-red-500" />
              ) : (
                <Mic className="h-3.5 w-3.5 text-green-500" />
              )}
            </div>
            {/* Remote */}
            {remoteParticipants.map((p) => (
              <div
                key={p.identity}
                className="mb-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary/30"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                  {(p.name || p.identity).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {p.name || p.identity}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.isSpeaking ? "Speaking" : "Listening"}
                  </p>
                </div>
                {!p.isMicrophoneEnabled ? (
                  <MicOff className="h-3.5 w-3.5 text-red-500" />
                ) : (
                  <Mic className="h-3.5 w-3.5 text-green-500" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Controls ─── */}
      <div className="flex items-center justify-center gap-4 border-t border-border py-5">
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
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {/* Video toggle */}
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
            {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>
        )}

        {/* Screen share — available for video or group calls */}
        {(callType === "video" || isGroupCall) && (
          <button
            onClick={toggleScreenShare}
            className={`rounded-full p-4 transition-colors ${
              isScreenSharing
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
            title={isScreenSharing ? "Stop sharing" : "Share screen"}
          >
            {isScreenSharing ? (
              <MonitorOff className="h-5 w-5" />
            ) : (
              <Monitor className="h-5 w-5" />
            )}
          </button>
        )}

        {/* Leave / Hang up */}
        <button
          onClick={handleLeave}
          className="rounded-full bg-red-600 p-4 text-white transition-colors hover:bg-red-700"
          title={isGroupCall ? "Leave call" : "End call"}
        >
          <PhoneOff className="h-6 w-6" />
        </button>

        {/* End for all — group calls only */}
        {isGroupCall && (
          <button
            onClick={handleEndForAll}
            className="rounded-full bg-red-800 px-4 py-3 text-xs font-medium text-white transition-colors hover:bg-red-900"
            title="End call for everyone"
          >
            End All
          </button>
        )}
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
  chatName,
  isGroupCall,
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
      <CallContent
        callId={callId}
        callType={callType}
        chatName={chatName}
        isGroupCall={isGroupCall}
        onLeave={onLeave}
      />
    </LiveKitRoom>
  );
}
