"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, PhoneOff } from "lucide-react";
import { CallInterface } from "@/components/call-interface";
import { calls as callsApi } from "@/lib/api";

export default function CallPage({ params }: { params: { roomId: string } }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const callId = searchParams.get("callId") || "";
  const callType = (searchParams.get("type") as "voice" | "video") || "voice";
  const chatName = searchParams.get("chatName") || "Call";
  const isGroupCall = searchParams.get("group") === "true";

  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!callId) {
      setError("No call ID provided");
      return;
    }

    callsApi
      .join(callId)
      .then((data) => {
        setServerUrl(data.server_url);
        setToken(data.token);
      })
      .catch((err) => {
        console.error("Failed to join call:", err);
        setError(err.message || "Failed to join call");
      });
  }, [callId]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <PhoneOff className="h-10 w-10 text-muted-foreground" />
          <p className="text-destructive">{error}</p>
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

  if (!serverUrl || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Joining call...</p>
        </div>
      </div>
    );
  }

  return (
    <CallInterface
      serverUrl={serverUrl}
      token={token}
      callId={callId}
      callType={callType}
      chatName={chatName}
      isGroupCall={isGroupCall}
    />
  );
}
