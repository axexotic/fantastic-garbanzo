"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Play, Square, Pause, RotateCcw, Upload, Check, Loader2 } from "lucide-react";

interface VoiceRecorderProps {
  minDuration?: number; // Minimum recording duration in seconds
  maxDuration?: number; // Maximum recording duration in seconds
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  disabled?: boolean;
}

type RecordingState = "idle" | "recording" | "paused" | "recorded";

export function VoiceRecorder({
  minDuration = 60,
  maxDuration = 120,
  onRecordingComplete,
  disabled = false,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  const progress = Math.min((duration / minDuration) * 100, 100);
  const isMinDurationMet = duration >= minDuration;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [audioUrl]);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average level
    const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    setAudioLevel(avg / 255);

    if (state === "recording") {
      animationRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [state]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analyser for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setState("recorded");

        // Stop the stream
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(1000); // Collect data every second
      setState("recording");
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((d) => {
          const newDuration = d + 1;
          if (newDuration >= maxDuration) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);

      // Start audio level monitoring
      animationRef.current = requestAnimationFrame(updateAudioLevel);
    } catch (err) {
      console.error("Failed to start recording:", err);
      alert("Microphone access denied. Please enable microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setAudioLevel(0);
  };

  const resetRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setDuration(0);
    setState("idle");
    setIsPlaying(false);
    audioChunksRef.current = [];
  };

  const playRecording = () => {
    if (!audioUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const submitRecording = () => {
    if (!audioChunksRef.current.length) return;

    const audioBlob = new Blob(audioChunksRef.current, {
      type: mediaRecorderRef.current?.mimeType || "audio/webm",
    });
    onRecordingComplete(audioBlob, duration);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      {/* Recording Visualization */}
      <div className="relative">
        {/* Outer ring - progress */}
        <svg className="h-40 w-40 -rotate-90 transform" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-secondary"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${progress * 2.83} 283`}
            className={isMinDurationMet ? "text-green-500" : "text-primary"}
          />
        </svg>

        {/* Inner circle - mic button / status */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-full transition-all ${
              state === "recording"
                ? "bg-red-500/20"
                : state === "recorded"
                ? "bg-green-500/20"
                : "bg-secondary"
            }`}
            style={{
              transform: state === "recording" ? `scale(${1 + audioLevel * 0.2})` : "scale(1)",
            }}
          >
            {state === "idle" && <Mic className="h-10 w-10 text-muted-foreground" />}
            {state === "recording" && <Mic className="h-10 w-10 text-red-500 animate-pulse" />}
            {state === "recorded" && <Check className="h-10 w-10 text-green-500" />}
          </div>
        </div>
      </div>

      {/* Duration Display */}
      <div className="text-center">
        <div className="font-mono text-3xl font-bold">{formatTime(duration)}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {state === "idle" && `Record at least ${formatTime(minDuration)} of your voice`}
          {state === "recording" && (
            isMinDurationMet
              ? "Minimum reached! You can stop or continue recording"
              : `${formatTime(minDuration - duration)} more needed`
          )}
          {state === "recorded" && "Recording complete - review or re-record"}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {state === "idle" && (
          <button
            onClick={startRecording}
            disabled={disabled}
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
          >
            <Mic className="h-5 w-5" />
            Start Recording
          </button>
        )}

        {state === "recording" && (
          <button
            onClick={stopRecording}
            disabled={!isMinDurationMet}
            className={`flex items-center gap-2 rounded-xl px-6 py-3 font-semibold transition-colors ${
              isMinDurationMet
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-secondary text-muted-foreground cursor-not-allowed"
            }`}
            title={isMinDurationMet ? "Stop recording" : `Record ${formatTime(minDuration - duration)} more`}
          >
            <Square className="h-5 w-5" />
            Stop Recording
          </button>
        )}

        {state === "recorded" && (
          <>
            <button
              onClick={playRecording}
              className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 font-medium transition-colors hover:bg-secondary"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-5 w-5" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" />
                  Play
                </>
              )}
            </button>

            <button
              onClick={resetRecording}
              className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 font-medium transition-colors hover:bg-secondary"
            >
              <RotateCcw className="h-5 w-5" />
              Re-record
            </button>

            <button
              onClick={submitRecording}
              disabled={disabled}
              className="flex items-center gap-2 rounded-xl bg-green-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-green-600 disabled:opacity-50"
            >
              <Upload className="h-5 w-5" />
              Use This Recording
            </button>
          </>
        )}
      </div>

      {/* Tips */}
      <div className="max-w-md rounded-xl bg-secondary/50 p-4 text-sm">
        <h4 className="mb-2 font-semibold">Tips for best voice cloning:</h4>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>Speak naturally in your normal voice</li>
          <li>Find a quiet room with no background noise</li>
          <li>Vary your tone — read a story or describe your day</li>
          <li>Keep a consistent distance from your microphone</li>
          <li>Longer recordings (60-120s) produce better results</li>
        </ul>
      </div>
    </div>
  );
}
