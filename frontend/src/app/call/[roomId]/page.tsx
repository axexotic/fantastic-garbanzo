"use client";

import { useSearchParams } from "next/navigation";
import { CallInterface } from "@/components/call-interface";

export default function CallPage({ params }: { params: { roomId: string } }) {
  const searchParams = useSearchParams();
  const myLang = searchParams.get("lang") || "en";
  const targetLang = searchParams.get("target") || "th";
  const token = searchParams.get("token") || "";

  return (
    <CallInterface
      roomId={params.roomId}
      myLang={myLang}
      targetLang={targetLang}
      token={token}
    />
  );
}
