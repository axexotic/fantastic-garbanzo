"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Mic, Phone, Zap } from "lucide-react";

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "th", name: "Thai", flag: "🇹🇭" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "pt", name: "Portuguese", flag: "🇧🇷" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
];

export default function HomePage() {
  const router = useRouter();
  const [myLang, setMyLang] = useState("en");
  const [theirLang, setTheirLang] = useState("th");
  const [isCreating, setIsCreating] = useState(false);

  const startCall = async () => {
    setIsCreating(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/rooms/create`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ max_participants: 2 }),
        }
      );
      const data = await res.json();
      router.push(
        `/call/${data.room_name}?lang=${myLang}&target=${theirLang}&token=${data.token}`
      );
    } catch (err) {
      console.error("Failed to create room:", err);
      // For demo: navigate to a test room
      router.push(`/call/demo-room?lang=${myLang}&target=${theirLang}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Hero */}
      <div className="mb-12 text-center">
        <div className="mb-4 flex items-center justify-center gap-2">
          <Globe className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight">VoiceTranslate</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Speak your language. They hear theirs.
        </p>
        <div className="mt-2 flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Zap className="h-4 w-4 text-yellow-500" /> &lt;500ms latency
          </span>
          <span className="flex items-center gap-1">
            <Mic className="h-4 w-4 text-primary" /> Voice preserved
          </span>
        </div>
      </div>

      {/* Language Selection */}
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-xl border border-border bg-secondary/30 p-6">
          {/* My Language */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              I speak
            </label>
            <select
              value={myLang}
              onChange={(e) => setMyLang(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* Swap button */}
          <div className="flex justify-center">
            <button
              onClick={() => {
                setMyLang(theirLang);
                setTheirLang(myLang);
              }}
              className="rounded-full border border-border p-2 transition-colors hover:bg-accent"
            >
              ⇅
            </button>
          </div>

          {/* Their Language */}
          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              They speak
            </label>
            <select
              value={theirLang}
              onChange={(e) => setTheirLang(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Start Call */}
        <button
          onClick={startCall}
          disabled={isCreating || myLang === theirLang}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-6 py-4 text-lg font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
        >
          <Phone className="h-5 w-5" />
          {isCreating ? "Creating room..." : "Start Call"}
        </button>

        {myLang === theirLang && (
          <p className="text-center text-sm text-muted-foreground">
            Select different languages to start a translated call
          </p>
        )}
      </div>

      {/* Footer */}
      <p className="mt-12 text-xs text-muted-foreground">
        Powered by Deepgram + GPT-4 + ElevenLabs + Daily.co
      </p>
    </div>
  );
}
