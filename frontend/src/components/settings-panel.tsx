"use client";

import { useState } from "react";
import { Check, Loader2, Globe } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { auth as authApi } from "@/lib/api";

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "th", label: "Thai", flag: "🇹🇭" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "ko", label: "Korean", flag: "🇰🇷" },
  { code: "zh", label: "Chinese", flag: "🇨🇳" },
  { code: "ar", label: "Arabic", flag: "🇸🇦" },
  { code: "pt", label: "Portuguese", flag: "🇧🇷" },
  { code: "ru", label: "Russian", flag: "🇷🇺" },
  { code: "hi", label: "Hindi", flag: "🇮🇳" },
  { code: "vi", label: "Vietnamese", flag: "🇻🇳" },
  { code: "id", label: "Indonesian", flag: "🇮🇩" },
  { code: "tr", label: "Turkish", flag: "🇹🇷" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
];

export function SettingsPanel() {
  const { user, updateUser } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [language, setLanguage] = useState(user?.preferred_language || "en");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await authApi.updateProfile({
        display_name: displayName,
        bio,
        preferred_language: language,
      });
      updateUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 p-4">
      {/* Profile */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
          Profile
        </h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="Tell people about yourself..."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Username
            </label>
            <input
              type="text"
              value={`@${user.username}`}
              disabled
              className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground"
            />
          </div>
        </div>
      </div>

      {/* Language */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Globe className="h-4 w-4" /> My Language
        </h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Messages from others will be translated to this language.
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                language === lang.code
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 hover:bg-secondary"
              }`}
            >
              <span>{lang.flag}</span>
              <span className="truncate">{lang.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <>
            <Check className="h-4 w-4" /> Saved
          </>
        ) : (
          "Save Changes"
        )}
      </button>
    </div>
  );
}
