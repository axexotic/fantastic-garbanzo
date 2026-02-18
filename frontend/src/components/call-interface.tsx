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
  Hand,
  MessageSquare,
  Settings,
  Share2,
  Copy,
  Pause,
  Play,
  PauseCircle,
  PlayCircle,
  MessageCircle,
  BarChart3,
  Wind,
  Zap,
  Palette,
  Send,
  X,
  Plus,
  CheckCircle,
  Bell,
  Disc3,
  PenTool,
} from "lucide-react";
import { calls as callsApi, callFeatures, recording, whiteboard, video } from "@/lib/api";
import {
  useCallFeaturesStore,
  useRecordingStore,
  useWhiteboardStore,
  useVideoQualityStore,
  useNotificationsStore,
} from "@/lib/store";

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
  isLarge,
  name,
  isRaised,
  bgMode,
}: {
  trackRef?: any;
  isLocal?: boolean;
  isLarge?: boolean;
  name: string;
  isRaised?: boolean;
  bgMode?: "none" | "blur" | "virtual";
}) {
  const label = isLocal ? "You" : name || "Participant";

  return (
    <div className={`relative ${isLarge ? "w-full h-full" : "aspect-video"} overflow-hidden rounded-xl bg-secondary`}>
      {trackRef ? (
        <VideoTrack
          trackRef={trackRef}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: isLocal ? "scaleX(-1)" : undefined,
            filter: bgMode === "blur" ? "blur(5px)" : undefined,
          }}
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

      {/* Raised hand indicator */}
      {isRaised && (
        <div className="absolute top-2 right-2 text-2xl">
          ✋
        </div>
      )}
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

  // Store
  const {
    isOnHold,
    setHold,
    raisedHands,
    toggleHand,
    activePoll,
    setActivePoll,
    inCallMessages,
    addInCallMessage,
    inCallChatOpen,
    setInCallChatOpen,
    viewMode,
    setViewMode,
    showParticipants,
    setShowParticipants,
    bgMode,
    setBgMode,
    pipEnabled,
    setPipEnabled,
    speakingTimes,
    setSpeakingTimes,
    reactions,
    addReaction,
    clearOldReactions,
  } = useCallFeaturesStore();

  // Batch 2 Stores
  const {
    isRecording,
    isPaused,
    recordingDuration,
    startRecording: storeStartRecording,
    stopRecording: storeStopRecording,
    pauseRecording: storePauseRecording,
    resumeRecording: storeResumeRecording,
    setRecordingDuration: setStoreDuration,
  } = useRecordingStore();

  const {
    isOpen: whiteboardOpen,
    selectedTool,
    canUndo,
    canRedo,
    setIsOpen: setWhiteboardOpen,
    setSelectedTool,
    undo,
    redo,
  } = useWhiteboardStore();

  const {
    videoProfile,
    bandwidth,
    videoCodec,
    autoAdjust,
    setVideoProfile,
    setBandwidth,
    setVideoCodec,
    setAutoAdjust,
  } = useVideoQualityStore();

  const {
    notifications,
    unreadCount,
    pushEnabled,
    soundEnabled,
    addNotification,
    markAsRead,
    setPushEnabled,
    setSoundEnabled,
  } = useNotificationsStore();

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(callType === "video");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [cameraIndex, setCameraIndex] = useState(0);
  const [cameras, setCameras] = useState<any[]>([]);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [transferTarget, setTransferTarget] = useState("");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [lockPin, setLockPin] = useState("");
  const [callLocked, setCallLocked] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [engagementScore, setEngagementScore] = useState(0);
  const [sharedFile, setSharedFile] = useState<any>(null);
  const [inCallChatMessage, setInCallChatMessage] = useState("");
  const [reactionEmojis] = useState(["👍", "❤️", "😂", "🔥", "🎉"]);

  // Batch 2 UI States
  const [showVideoQualityModal, setShowVideoQualityModal] = useState(false);
  const [showRecordingSettings, setShowRecordingSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const speakingTimerRef = useRef<Record<string, number>>({});
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Recording duration timer
  useEffect(() => {
    if (isRecording && !isPaused) {
      recordingTimerRef.current = setInterval(() => {
        setStoreDuration(recordingDuration + 1);
      }, 1000);
    } else if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording, isPaused, recordingDuration, setStoreDuration]);

  // Cleanup reactions every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => clearOldReactions(), 5000);
    return () => clearInterval(interval);
  }, [clearOldReactions]);

  // Set camera on/off based on call type after connecting
  useEffect(() => {
    if (localParticipant && connectionState === ConnectionState.Connected) {
      localParticipant.setCameraEnabled(callType === "video" && !isOnHold);
      localParticipant.setMicrophoneEnabled(true && !isOnHold);
    }
  }, [localParticipant, connectionState, callType, isOnHold]);

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

  const toggleHoldCall = useCallback(async () => {
    try {
      if (isOnHold) {
        await callFeatures.resume(callId);
        if (localParticipant) {
          await localParticipant.setMicrophoneEnabled(true);
          await localParticipant.setCameraEnabled(isVideoOn);
        }
      } else {
        await callFeatures.hold(callId);
        if (localParticipant) {
          await localParticipant.setMicrophoneEnabled(false);
          await localParticipant.setCameraEnabled(false);
        }
      }
      setHold(callId, !isOnHold);
    } catch (e) {
      console.error("Failed to toggle hold:", e);
    }
  }, [callId, isOnHold, isVideoOn, localParticipant, setHold]);

  const initiateTransfer = useCallback(async () => {
    if (!transferTarget) return;
    try {
      await callFeatures.transfer(callId, transferTarget);
      setShowTransferModal(false);
      setTransferTarget("");
    } catch (e) {
      console.error("Failed to transfer:", e);
    }
  }, [callId, transferTarget]);

  const toggleBackground = useCallback(() => {
    const modes: Array<"none" | "blur" | "virtual"> = ["none", "blur", "virtual"];
    const nextMode = modes[(modes.indexOf(bgMode) + 1) % modes.length];
    setBgMode(nextMode);
  }, [bgMode, setBgMode]);

  const sendReaction = useCallback(
    async (emoji: string) => {
      try {
        await callFeatures.sendReaction(callId, emoji);
        addReaction({ user_id: localParticipant?.identity || "local", emoji, timestamp: Date.now() });
      } catch (e) {
        console.error("Failed to send reaction:", e);
      }
    },
    [callId, localParticipant, addReaction]
  );

  const toggleRaiseHand = useCallback(async () => {
    const raised = raisedHands.has(localParticipant?.identity || "");
    try {
      if (raised) {
        await callFeatures.lowerHand(callId);
      } else {
        await callFeatures.raiseHand(callId);
      }
      toggleHand(localParticipant?.identity || "", !raised);
    } catch (e) {
      console.error("Failed to toggle hand:", e);
    }
  }, [callId, raisedHands, localParticipant, toggleHand]);

  const createPoll = useCallback(async () => {
    if (!pollQuestion.trim() || pollOptions.some((o) => !o.trim())) return;
    try {
      const poll = await callFeatures.createPoll(callId, pollQuestion, pollOptions);
      setActivePoll(poll);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setShowPollCreator(false);
    } catch (e) {
      console.error("Failed to create poll:", e);
    }
  }, [callId, pollQuestion, pollOptions, setActivePoll]);

  const votePoll = useCallback(
    async (optionIndex: number) => {
      if (!activePoll) return;
      try {
        await callFeatures.votePoll(callId, activePoll.id, optionIndex);
      } catch (e) {
        console.error("Failed to vote:", e);
      }
    },
    [callId, activePoll]
  );

  const sendInCallChat = useCallback(async () => {
    if (!inCallChatMessage.trim()) return;
    try {
      await callFeatures.sendInCallChat(callId, inCallChatMessage);
      addInCallMessage({
        user_id: localParticipant?.identity || "local",
        username: localParticipant?.name || "You",
        message: inCallChatMessage,
        timestamp: new Date().toISOString(),
      });
      setInCallChatMessage("");
    } catch (e) {
      console.error("Failed to send message:", e);
    }
  }, [callId, inCallChatMessage, localParticipant, addInCallMessage]);

  const shareFile = useCallback(async (file: File) => {
    try {
      await callFeatures.shareFile(callId, file.name, URL.createObjectURL(file), file.size);
      setSharedFile({
        name: file.name,
        size: file.size,
        url: URL.createObjectURL(file),
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to share file:", e);
    }
  }, [callId]);

  const getAiSuggestion = useCallback(async () => {
    try {
      const context = `Current speakers: ${Array.from(raisedHands).join(", ")}. Chat: ${inCallMessages
        .slice(-3)
        .map((m) => `${m.username}: ${m.message}`)
        .join(" ")}`;
      const response = await callFeatures.getAiSuggestion(context);
      setAiSuggestion(response.suggestion || "");
    } catch (e) {
      console.error("Failed to get suggestion:", e);
    }
  }, [raisedHands, inCallMessages]);

  // Batch 2: Recording
  const toggleRecording = useCallback(async () => {
    try {
      if (isRecording) {
        await recording.stop(callId);
        storeStopRecording();
      } else {
        await recording.start(callId);
        storeStartRecording();
      }
    } catch (e) {
      console.error("Failed to toggle recording:", e);
      addNotification({
        title: "Recording Error",
        body: `Failed to ${isRecording ? "stop" : "start"} recording`,
        type: "error",
        createdAt: new Date().toISOString(),
        isRead: false,
      });
    }
  }, [callId, isRecording, storeStartRecording, storeStopRecording, addNotification]);

  const pauseRecordingHandler = useCallback(async () => {
    try {
      await recording.pause(callId);
      storePauseRecording();
      addNotification({
        title: "Recording Paused",
        body: "Recording has been paused",
        type: "info",
        createdAt: new Date().toISOString(),
        isRead: false,
      });
    } catch (e) {
      console.error("Failed to pause recording:", e);
      addNotification({
        title: "Pause Error",
        body: "Failed to pause recording",
        type: "error",
        createdAt: new Date().toISOString(),
        isRead: false,
      });
    }
  }, [callId, storePauseRecording, addNotification]);

  const resumeRecordingHandler = useCallback(async () => {
    try {
      await recording.resume(callId);
      storeResumeRecording();
      addNotification({
        title: "Recording Resumed",
        body: "Recording has been resumed",
        type: "info",
        createdAt: new Date().toISOString(),
        isRead: false,
      });
    } catch (e) {
      console.error("Failed to resume recording:", e);
      addNotification({
        title: "Resume Error",
        body: "Failed to resume recording",
        type: "error",
        createdAt: new Date().toISOString(),
        isRead: false,
      });
    }
  }, [callId, storeResumeRecording, addNotification]);

  // Batch 2: Video Quality
  const setVideoQualityProfile = useCallback(
    async (profile: "low" | "medium" | "high" | "hd" | "fullhd" | "4k") => {
      try {
        await video.setProfile(profile);
        setVideoProfile(profile);
        addNotification({
          title: "Video Quality Updated",
          body: `Video quality set to ${profile.toUpperCase()}`,
          type: "success",
          createdAt: new Date().toISOString(),
          isRead: false,
        });
      } catch (e) {
        console.error("Failed to set video profile:", e);
      }
    },
    [setVideoProfile, addNotification]
  );

  const detectBandwidthHandler = useCallback(async () => {
    try {
      const result = await video.detectBandwidth();
      setBandwidth(result.bandwidth);
      setVideoQualityProfile(result.recommended_profile as any);
    } catch (e) {
      console.error("Failed to detect bandwidth:", e);
      addNotification({
        title: "Bandwidth Detection Failed",
        body: "Could not auto-detect bandwidth",
        type: "error",
        createdAt: new Date().toISOString(),
        isRead: false,
      });
    }
  }, [setBandwidth, setVideoQualityProfile, addNotification]);

  // Batch 2: Whiteboard
  const toggleWhiteboard = useCallback(async () => {
    try {
      if (!whiteboardOpen) {
        await whiteboard.create(callId);
        setWhiteboardOpen(true);
        addNotification({
          title: "Whiteboard Started",
          body: "Collaborative whiteboard opened",
          type: "success",
          createdAt: new Date().toISOString(),
          isRead: false,
        });
      } else {
        setWhiteboardOpen(false);
      }
    } catch (e) {
      console.error("Failed to toggle whiteboard:", e);
      addNotification({
        title: "Whiteboard Error",
        body: "Failed to open whiteboard",
        type: "error",
        createdAt: new Date().toISOString(),
        isRead: false,
      });
    }
  }, [callId, whiteboardOpen, setWhiteboardOpen, addNotification]);

  // Batch 2: Notifications
  const toggleNotifications = useCallback(() => {
    setShowNotifications(!showNotifications);
  }, [showNotifications]);

  const handleNotificationRead = useCallback(
    (index: number) => {
      markAsRead(index);
    },
    [markAsRead]
  );

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
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
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
          <div className={`h-2 w-2 rounded-full ${isOnHold ? "bg-yellow-500" : "bg-green-500"}`} />
          <span className="text-sm font-medium">
            {isOnHold ? "On Hold · " : ""}{chatName || (callType === "video" ? "Video Call" : "Voice Call")}
          </span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {totalParticipants}
          </span>
          {callLocked && <span className="text-xs bg-red-500/20 text-red-600 px-2 py-1 rounded">🔒 Locked</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-muted-foreground">{formatDuration(callDuration)}</span>
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className={`rounded-lg p-2 text-sm transition-colors ${
              showParticipants ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
            }`}
            title="Participants"
          >
            <Users className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── Main Content ─── */}
        <div className={`flex flex-1 items-center justify-center p-6 transition-all ${inCallChatOpen ? "pr-0" : ""}`}>
          {callType === "video" ? (
            <div className="w-full max-w-5xl space-y-4">
              {/* Screen share — full width if present */}
              {screenShareTracks.length > 0 && (
                <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-secondary">
                  {screenShareTracks.map((track) => (
                    <VideoTrack
                      key={track.participant.identity + "-screen"}
                      trackRef={track}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ))}
                </div>
              )}

              {/* Camera grid */}
              {viewMode === "grid" || viewMode === "sidebar" ? (
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
                  <ParticipantTile trackRef={localVideoTrack} isLocal name="You" bgMode={bgMode} />
                  {remoteParticipants.map((participant) => {
                    const remoteTrack = videoTracks.find(
                      (t) =>
                        t.participant.identity === participant.identity &&
                        t.source === Track.Source.Camera
                    );
                    const isRaised = raisedHands.has(participant.identity);
                    return (
                      <ParticipantTile
                        key={participant.identity}
                        trackRef={remoteTrack}
                        name={participant.name || participant.identity}
                        isRaised={isRaised}
                        bgMode={bgMode}
                      />
                    );
                  })}
                </div>
              ) : (
                /* Speaker view */
                <div className="flex gap-4 h-full">
                  <div className="flex-1">
                    {currentSpeaker ? (
                      <ParticipantTile
                        isLarge
                        trackRef={videoTracks.find(
                          (t) =>
                            t.participant.identity === currentSpeaker &&
                            t.source === Track.Source.Camera
                        )}
                        name={
                          remoteParticipants.find((p) => p.identity === currentSpeaker)?.name ||
                          currentSpeaker
                        }
                        bgMode={bgMode}
                      />
                    ) : (
                      <ParticipantTile
                        isLarge
                        trackRef={localVideoTrack}
                        isLocal
                        name="You"
                        bgMode={bgMode}
                      />
                    )}
                  </div>
                  <div className="w-40 space-y-2 overflow-y-auto">
                    {remoteParticipants.map((p) => (
                      <div
                        key={p.identity}
                        onClick={() => setCurrentSpeaker(p.identity)}
                        className={`cursor-pointer rounded-lg overflow-hidden aspect-video ${
                          currentSpeaker === p.identity ? "ring-2 ring-primary" : ""
                        }`}
                      >
                        <ParticipantTile
                          trackRef={videoTracks.find(
                            (t) =>
                              t.participant.identity === p.identity &&
                              t.source === Track.Source.Camera
                          )}
                          name={p.name || p.identity}
                          bgMode={bgMode}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Voice-only */
            <div className="flex flex-col items-center gap-8">
              <div className="flex flex-wrap justify-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-xl font-bold text-primary relative">
                    You
                    {raisedHands.has(localParticipant?.identity || "") && (
                      <Hand className="absolute -top-2 -right-2 h-5 w-5 text-yellow-500" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">You</span>
                </div>
                {remoteParticipants.map((p) => (
                  <div key={p.identity} className="flex flex-col items-center gap-2">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-xl font-bold text-foreground relative">
                      {(p.name || p.identity).charAt(0).toUpperCase()}
                      {raisedHands.has(p.identity) && (
                        <Hand className="absolute -top-2 -right-2 h-5 w-5 text-yellow-500" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{p.name || p.identity}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-8 w-1.5 rounded-full bg-primary animate-pulse"
                    style={{ animationDelay: `${i * 150}ms`, animationDuration: "1s" }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Reactions Overlay */}
          {reactions.length > 0 && (
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
              {reactions.map((r, i) => (
                <div
                  key={i}
                  className="absolute text-2xl animate-bounce"
                  style={{
                    left: Math.random() * 100 + "%",
                    top: Math.random() * 100 + "%",
                  }}
                >
                  {r.emoji}
                </div>
              ))}
            </div>
          )}

          <RoomAudioRenderer />
        </div>

        {/* ─── Participants Sidebar ─── */}
        {showParticipants && (
          <div className="w-72 border-l border-border bg-secondary/20 p-4 overflow-y-auto">
            <h3 className="mb-4 text-sm font-semibold">Participants ({totalParticipants})</h3>
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
            {remoteParticipants.map((p) => (
              <div
                key={p.identity}
                className="mb-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary/30"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                  {(p.name || p.identity).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name || p.identity}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.isSpeaking ? "Speaking" : "Listening"}
                  </p>
                </div>
                {!p.isMicrophoneEnabled ? (
                  <MicOff className="h-3.5 w-3.5 text-red-500" />
                ) : (
                  <Mic className="h-3.5 w-3.5 text-green-500" />
                )}
                {raisedHands.has(p.identity) && (
                  <Hand className="h-3.5 w-3.5 text-yellow-500" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ─── In-Call Chat Sidebar ─── */}
        {inCallChatOpen && (
          <div className="w-80 border-l border-border bg-secondary/10 flex flex-col">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="text-sm font-semibold">In-Call Chat</h3>
              <button onClick={() => setInCallChatOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {inCallMessages.map((msg, i) => (
                <div key={i} className="text-xs space-y-0.5">
                  <p className="font-medium text-foreground">{msg.username}</p>
                  <p className="text-muted-foreground break-words">{msg.message}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-border p-4 space-y-2">
              <input
                type="text"
                placeholder="Message..."
                value={inCallChatMessage}
                onChange={(e) => setInCallChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendInCallChat()}
                className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background"
              />
              <button
                onClick={sendInCallChat}
                className="w-full text-xs px-2 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {/* ─── AI Panel ─── */}
        {showAiPanel && (
          <div className="w-80 border-l border-border bg-secondary/10 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">AI Assistant</h3>
              <button onClick={() => setShowAiPanel(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            {aiSuggestion && (
              <div className="bg-primary/10 rounded-lg p-3 text-xs mb-4">
                <p className="font-medium mb-2">Suggestion:</p>
                <p className="text-muted-foreground">{aiSuggestion}</p>
              </div>
            )}
            <button
              onClick={getAiSuggestion}
              className="w-full text-xs px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 mb-4"
            >
              Get Suggestion
            </button>
          </div>
        )}
      </div>

      {/* ─── Active Poll ─── */}
      {activePoll && (
        <div className="fixed bottom-24 left-6 bg-background border border-border rounded-lg p-4 w-96 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold">{activePoll.question}</h4>
            <button onClick={() => setActivePoll(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            {activePoll.options.map((opt, i) => {
              const votes = activePoll.votes[opt]?.length || 0;
              const total = Object.values(activePoll.votes).flat().length || 1;
              const percent = Math.round((votes / total) * 100);
              return (
                <button
                  key={i}
                  onClick={() => votePoll(i)}
                  className="w-full text-left text-xs px-3 py-2 rounded border border-border hover:bg-secondary relative overflow-hidden"
                >
                  <div
                    className="absolute inset-0 bg-primary/20"
                    style={{ width: `${percent}%` }}
                  />
                  <span className="relative">{opt} ({percent}%)</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Modals ─── */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-96">
            <h3 className="text-sm font-semibold mb-4">Transfer Call</h3>
            <select
              value={transferTarget}
              onChange={(e) => setTransferTarget(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded border border-border mb-4"
            >
              <option value="">Select recipient...</option>
              {remoteParticipants.map((p) => (
                <option key={p.identity} value={p.identity}>
                  {p.name || p.identity}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={initiateTransfer}
                className="flex-1 text-xs px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Transfer
              </button>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferTarget("");
                }}
                className="flex-1 text-xs px-3 py-2 rounded border border-border hover:bg-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showPollCreator && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-96">
            <h3 className="text-sm font-semibold mb-4">Create Poll</h3>
            <input
              type="text"
              placeholder="Question..."
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded border border-border mb-3"
            />
            {pollOptions.map((opt, i) => (
              <input
                key={i}
                type="text"
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={(e) => {
                  const next = [...pollOptions];
                  next[i] = e.target.value;
                  setPollOptions(next);
                }}
                className="w-full text-xs px-3 py-2 rounded border border-border mb-2"
              />
            ))}
            <button
              onClick={() => {
                const next = [...pollOptions, ""];
                setPollOptions(next);
              }}
              className="w-full text-xs px-3 py-2 rounded border border-border hover:bg-secondary mb-3"
            >
              + Add Option
            </button>
            <div className="flex gap-2">
              <button
                onClick={createPoll}
                className="flex-1 text-xs px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowPollCreator(false);
                  setPollQuestion("");
                  setPollOptions(["", ""]);
                }}
                className="flex-1 text-xs px-3 py-2 rounded border border-border hover:bg-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Controls ─── */}
      <div className="flex items-center justify-center gap-2 border-t border-border py-4 px-6 flex-wrap">
        {/* Mute toggle */}
        <button
          onClick={toggleMute}
          className={`rounded-full p-3 transition-colors ${
            isMuted ? "bg-red-500/20 text-red-500" : "bg-secondary text-foreground hover:bg-secondary/80"
          }`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {/* Video toggle */}
        {callType === "video" && (
          <button
            onClick={toggleVideo}
            className={`rounded-full p-3 transition-colors ${
              !isVideoOn ? "bg-red-500/20 text-red-500" : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
            title={isVideoOn ? "Turn off camera" : "Turn on camera"}
          >
            {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>
        )}

        {/* Screen share */}
        {(callType === "video" || isGroupCall) && (
          <button
            onClick={toggleScreenShare}
            className={`rounded-full p-3 transition-colors ${
              isScreenSharing ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
            title={isScreenSharing ? "Stop sharing" : "Share screen"}
          >
            {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
          </button>
        )}

        {/* Background toggle */}
        {callType === "video" && (
          <button
            onClick={toggleBackground}
            className="rounded-full p-3 bg-secondary text-foreground hover:bg-secondary/80"
            title={bgMode}
          >
            <Wind className="h-5 w-5" />
          </button>
        )}

        {/* Hold toggle */}
        {isGroupCall && (
          <button
            onClick={toggleHoldCall}
            className={`rounded-full p-3 transition-colors ${
              isOnHold ? "bg-yellow-500/20 text-yellow-600" : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
            title={isOnHold ? "Resume" : "Hold"}
          >
            {isOnHold ? <PlayCircle className="h-5 w-5" /> : <PauseCircle className="h-5 w-5" />}
          </button>
        )}

        {/* Raise hand */}
        <button
          onClick={toggleRaiseHand}
          className={`rounded-full p-3 transition-colors ${
            raisedHands.has(localParticipant?.identity || "")
              ? "bg-yellow-500/20 text-yellow-600"
              : "bg-secondary text-foreground hover:bg-secondary/80"
          }`}
          title="Raise hand"
        >
          <Hand className="h-5 w-5" />
        </button>

        {/* Reactions */}
        <div className="flex gap-1">
          {reactionEmojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              className="text-lg hover:scale-125 transition-transform"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* In-call chat */}
        <button
          onClick={() => setInCallChatOpen(!inCallChatOpen)}
          className={`rounded-full p-3 transition-colors ${
            inCallChatOpen ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"
          }`}
          title="In-call chat"
        >
          <MessageCircle className="h-5 w-5" />
        </button>

        {/* AI Assistant */}
        <button
          onClick={() => setShowAiPanel(!showAiPanel)}
          className={`rounded-full p-3 transition-colors ${
            showAiPanel ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"
          }`}
          title="AI Assistant"
        >
          <Zap className="h-5 w-5" />
        </button>

        {/* Poll */}
        <button
          onClick={() => setShowPollCreator(!showPollCreator)}
          className="rounded-full p-3 bg-secondary text-foreground hover:bg-secondary/80"
          title="Create poll"
        >
          <BarChart3 className="h-5 w-5" />
        </button>

        {/* Transfer */}
        {isGroupCall && (
          <button
            onClick={() => setShowTransferModal(!showTransferModal)}
            className="rounded-full p-3 bg-secondary text-foreground hover:bg-secondary/80"
            title="Transfer call"
          >
            <Share2 className="h-5 w-5" />
          </button>
        )}

        {/* Recording - Batch 2 */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleRecording}
            className={`rounded-full p-3 transition-colors ${
              isRecording ? "bg-red-500/20 text-red-500 animate-pulse" : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
            title={isRecording ? "Stop recording" : "Start recording"}
          >
            <Disc3 className="h-5 w-5" />
          </button>
          {isRecording && (
            <>
              <span className="text-xs font-medium text-red-500">{formatDuration(recordingDuration)}</span>
              <div className="flex gap-1">
                <button
                  onClick={pauseRecordingHandler}
                  disabled={isPaused}
                  className="rounded p-1 text-xs bg-secondary hover:bg-secondary/80 disabled:opacity-50 text-foreground"
                  title="Pause recording"
                >
                  <Pause className="h-3 w-3" />
                </button>
                <button
                  onClick={resumeRecordingHandler}
                  disabled={!isPaused}
                  className="rounded p-1 text-xs bg-secondary hover:bg-secondary/80 disabled:opacity-50 text-foreground"
                  title="Resume recording"
                >
                  <Play className="h-3 w-3" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Whiteboard - Batch 2 */}
        <button
          onClick={toggleWhiteboard}
          className={`rounded-full p-3 transition-colors ${
            whiteboardOpen ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"
          }`}
          title={whiteboardOpen ? "Close whiteboard" : "Open whiteboard"}
        >
          <PenTool className="h-5 w-5" />
        </button>

        {/* Video Quality - Batch 2 */}
        <div className="relative group">
          <button
            onClick={() => setShowVideoQualityModal(!showVideoQualityModal)}
            className={`rounded-full p-3 transition-colors ${
              showVideoQualityModal ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
            title="Video quality"
          >
            <BarChart3 className="h-5 w-5" />
          </button>
          {showVideoQualityModal && (
            <div className="absolute bottom-16 right-0 bg-foreground/95 text-background rounded-lg shadow-lg p-4 min-w-[200px] z-50">
              <p className="text-xs font-semibold mb-2">Video Quality</p>
              <div className="space-y-1">
                {(["low", "medium", "high", "hd", "fullhd", "4k"] as const).map((profile) => (
                  <button
                    key={profile}
                    onClick={() => {
                      setVideoQualityProfile(profile);
                      setShowVideoQualityModal(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs rounded ${
                      videoProfile === profile ? "bg-primary text-primary-foreground" : "hover:bg-primary/20"
                    }`}
                  >
                    {profile.toUpperCase()}
                  </button>
                ))}
              </div>
              <button
                onClick={detectBandwidthHandler}
                className="w-full mt-2 px-3 py-2 text-xs text-center rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Auto Detect
              </button>
            </div>
          )}
        </div>

        {/* Notifications - Batch 2 */}
        <div className="relative">
          <button
            onClick={toggleNotifications}
            className={`rounded-full p-3 transition-colors relative ${
              showNotifications ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
            title="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute bottom-16 right-0 bg-foreground/95 text-background rounded-lg shadow-lg p-4 min-w-[300px] max-h-80 overflow-y-auto z-50">
              <p className="text-xs font-semibold mb-2">Notifications ({unreadCount})</p>
              {notifications.length === 0 ? (
                <p className="text-xs text-muted-foreground">No notifications</p>
              ) : (
                <div className="space-y-2">
                  {notifications.map((notif, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleNotificationRead(idx)}
                      className={`p-2 text-xs rounded cursor-pointer ${
                        notif.isRead
                          ? "bg-secondary/50 opacity-60"
                          : "bg-primary/20 hover:bg-primary/30"
                      }`}
                    >
                      <p className="font-medium">{notif.title}</p>
                      <p className="opacity-80">{notif.body}</p>
                      <p className="text-xs opacity-50 mt-1">{new Date(notif.createdAt).toLocaleTimeString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Settings */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`rounded-full p-3 transition-colors ${
            showSettings ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"
          }`}
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>

        {/* Leave / Hang up */}
        <button
          onClick={handleLeave}
          className="rounded-full bg-red-600 p-3 text-white transition-colors hover:bg-red-700"
          title={isGroupCall ? "Leave call" : "End call"}
        >
          <PhoneOff className="h-6 w-6" />
        </button>

        {/* End for all */}
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
