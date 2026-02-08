"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Phone, PhoneOff, Captions, BarChart3 } from "lucide-react";
import { useTranslationSocket } from "@/hooks/use-translation-socket";
import { useAudioCapture } from "@/hooks/use-audio-capture";
import { Waveform } from "./waveform";
import { CaptionOverlay } from "./caption-overlay";
import { MetricsPanel } from "./metrics-panel";

interface CallInterfaceProps {
  roomId: string;
  myLang: string;
  targetLang: string;
  token: string;
}

export function CallInterface({
  roomId,
  myLang,
  targetLang,
  token,
}: CallInterfaceProps) {
  const router = useRouter();
  const [isMuted, setIsMuted] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [showMetrics, setShowMetrics] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const {
    transcript,
    translation,
    metrics,
    isProcessing,
    connect,
    disconnect,
    sendAudio,
  } = useTranslationSocket(roomId, myLang, targetLang);

  // Audio capture — sends mic chunks to the WebSocket
  const { isCapturing, start: startCapture, stop: stopCapture, toggleMute: toggleAudioMute } =
    useAudioCapture({
      chunkInterval: 250,
      onAudioChunk: (chunk) => sendAudio(chunk),
    });

  // Start call timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Connect WebSocket on mount, then start mic capture
  useEffect(() => {
    connect().then(() => {
      setIsConnected(true);
      startCapture();
    });
    return () => {
      stopCapture();
      disconnect();
    };
  }, [connect, disconnect, startCapture, stopCapture]);

  const handleHangUp = useCallback(() => {
    stopCapture();
    disconnect();
    router.push("/");
  }, [disconnect, router, stopCapture]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const newMuted = !prev;
      toggleAudioMute(newMuted);
      return newMuted;
    });
  }, [toggleAudioMute]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-background p-4">
      {/* Status Bar */}
      <div className="flex w-full max-w-md items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-yellow-500 animate-pulse"
            }`}
          />
          <span className="text-sm text-muted-foreground">
            {isConnected ? "Connected" : "Connecting..."}
          </span>
        </div>
        <span className="font-mono text-sm text-muted-foreground">
          {formatDuration(callDuration)}
        </span>
      </div>

      {/* Main Call Area */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        {/* Waveform Visualization */}
        <Waveform isActive={!isMuted && isProcessing} />

        {/* Language Indicator */}
        <div className="flex items-center gap-4 text-lg">
          <span className="rounded-lg bg-secondary px-3 py-1 font-medium">
            {myLang.toUpperCase()}
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded-lg bg-primary/20 px-3 py-1 font-medium text-primary">
            {targetLang.toUpperCase()}
          </span>
        </div>

        {/* Captions */}
        {showCaptions && (
          <CaptionOverlay transcript={transcript} translation={translation} />
        )}
      </div>

      {/* Controls */}
      <div className="w-full max-w-md space-y-4 pb-8">
        {/* Metrics toggle */}
        {showMetrics && metrics && <MetricsPanel metrics={metrics} />}

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-6">
          {/* Captions toggle */}
          <button
            onClick={() => setShowCaptions((s) => !s)}
            className={`rounded-full p-4 transition-colors ${
              showCaptions
                ? "bg-secondary text-foreground"
                : "bg-secondary/50 text-muted-foreground"
            }`}
          >
            <Captions className="h-6 w-6" />
          </button>

          {/* Mute */}
          <button
            onClick={toggleMute}
            className={`rounded-full p-4 transition-colors ${
              isMuted
                ? "bg-destructive text-destructive-foreground"
                : "bg-secondary text-foreground"
            }`}
          >
            {isMuted ? (
              <MicOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </button>

          {/* Hang Up */}
          <button
            onClick={handleHangUp}
            className="rounded-full bg-red-600 p-5 text-white transition-colors hover:bg-red-700"
          >
            <PhoneOff className="h-7 w-7" />
          </button>

          {/* Metrics toggle */}
          <button
            onClick={() => setShowMetrics((s) => !s)}
            className={`rounded-full p-4 transition-colors ${
              showMetrics
                ? "bg-secondary text-foreground"
                : "bg-secondary/50 text-muted-foreground"
            }`}
          >
            <BarChart3 className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
