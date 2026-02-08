/**
 * Hook for capturing microphone audio and streaming it as chunks.
 *
 * Uses the Web Audio API + MediaRecorder to capture audio from the mic,
 * then sends chunks at a configurable interval.
 */

"use client";

import { useCallback, useRef, useState } from "react";

interface UseAudioCaptureOptions {
  /** How often to emit audio chunks (ms). Default: 250ms */
  chunkInterval?: number;
  /** Called with each audio chunk */
  onAudioChunk: (chunk: ArrayBuffer) => void;
}

export function useAudioCapture({
  chunkInterval = 250,
  onAudioChunk,
}: UseAudioCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          const buffer = await event.data.arrayBuffer();
          onAudioChunk(buffer);
        }
      };

      mediaRecorder.start(chunkInterval);
      mediaRecorderRef.current = mediaRecorder;
      setIsCapturing(true);
    } catch (err) {
      console.error("Failed to capture audio:", err);
    }
  }, [chunkInterval, onAudioChunk]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  const toggleMute = useCallback(
    (muted: boolean) => {
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !muted;
        });
      }
    },
    []
  );

  return { isCapturing, start, stop, toggleMute };
}
