/**
 * WebSocket hook for real-time translation.
 *
 * Connects to the backend WebSocket, sends audio chunks,
 * and receives transcript/translation/audio back.
 */

"use client";

import { useCallback, useRef, useState } from "react";

interface PipelineMetrics {
  stt_ms: number;
  translate_ms: number;
  tts_ms: number;
  total_ms: number;
}

export function useTranslationSocket(
  sessionId: string,
  sourceLang: string,
  targetLang: string
) {
  const wsRef = useRef<WebSocket | null>(null);
  const [transcript, setTranscript] = useState("");
  const [translation, setTranslation] = useState("");
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const connect = useCallback(async () => {
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}/ws/translate/${sessionId}`;

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // Send initial config
        ws.send(
          JSON.stringify({
            type: "config",
            source_lang: sourceLang,
            target_lang: targetLang,
          })
        );
        setIsConnected(true);
        resolve();
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "transcript":
            setTranscript(msg.data);
            setIsProcessing(true);
            break;

          case "translation":
            setTranslation((prev) => prev + msg.data);
            break;

          case "audio":
            // Decode base64 audio and play it
            playAudioChunk(msg.data);
            break;

          case "metrics":
            setMetrics(msg.data);
            setIsProcessing(false);
            // Reset for next utterance
            setTimeout(() => {
              setTranscript("");
              setTranslation("");
            }, 3000);
            break;

          case "error":
            console.error("Translation error:", msg.data);
            setIsProcessing(false);
            break;
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        setIsConnected(false);
        reject(err);
      };

      ws.onclose = () => {
        setIsConnected(false);
      };

      wsRef.current = ws;
    });
  }, [sessionId, sourceLang, targetLang]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const base64 = arrayBufferToBase64(audioData);
      wsRef.current.send(
        JSON.stringify({
          type: "audio",
          data: base64,
        })
      );
    }
  }, []);

  // Play received audio chunk
  const playAudioChunk = async (base64Audio: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioData = base64ToArrayBuffer(base64Audio);
      const audioBuffer = await audioContextRef.current.decodeAudioData(audioData);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();
    } catch (err) {
      console.error("Failed to play audio:", err);
    }
  };

  return {
    transcript,
    translation,
    metrics,
    isProcessing,
    isConnected,
    connect,
    disconnect,
    sendAudio,
  };
}

// Helpers
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
