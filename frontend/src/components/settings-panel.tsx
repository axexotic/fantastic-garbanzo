"use client";

import { useState, useEffect } from "react";
import { Check, Loader2, Globe, Mic, Trash2, CheckCircle2, AlertCircle, Bell } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { auth as authApi, voice as voiceApi, payments as paymentsApi, notifications as notifApi, type VoiceProfile, type SubscriptionInfo, type NotificationPrefs } from "@/lib/api";
import { VoiceRecorder } from "./voice-recorder";

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

  // Voice profile state
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null);
  const [loadingVoice, setLoadingVoice] = useState(true);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [deletingVoice, setDeletingVoice] = useState(false);

  // Subscription state
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs | null>(null);
  const [loadingNotif, setLoadingNotif] = useState(true);
  const [savingNotif, setSavingNotif] = useState(false);

  // Load voice profile on mount
  useEffect(() => {
    const loadVoiceProfile = async () => {
      try {
        const profile = await voiceApi.getProfile();
        setVoiceProfile(profile);
      } catch (err) {
        // No profile exists, that's fine
        setVoiceProfile(null);
      } finally {
        setLoadingVoice(false);
      }
    };
    const loadSubscription = async () => {
      try {
        const sub = await paymentsApi.getSubscription();
        setSubscription(sub);
      } catch {
        setSubscription(null);
      } finally {
        setLoadingSub(false);
      }
    };
    loadVoiceProfile();
    loadSubscription();
    const loadNotifPrefs = async () => {
      try {
        const prefs = await notifApi.getPrefs();
        setNotifPrefs(prefs);
      } catch {
        setNotifPrefs(null);
      } finally {
        setLoadingNotif(false);
      }
    };
    loadNotifPrefs();
  }, []);

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

  const handleVoiceRecordingComplete = async (audioBlob: Blob, duration: number) => {
    setUploadingVoice(true);
    try {
      const profile = await voiceApi.cloneVoice(audioBlob);
      setVoiceProfile(profile);
      setShowVoiceRecorder(false);
    } catch (err: any) {
      console.error("Voice upload failed:", err);
      alert(err.message || "Failed to create voice profile");
    } finally {
      setUploadingVoice(false);
    }
  };

  const handleDeleteVoice = async () => {
    if (!confirm("Delete your voice profile? You'll need to re-record to use voice translation.")) {
      return;
    }
    setDeletingVoice(true);
    try {
      await voiceApi.deleteProfile();
      setVoiceProfile(null);
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeletingVoice(false);
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

      {/* Voice Profile */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Mic className="h-4 w-4" /> Voice Profile
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Your cloned voice is used for live call translation. Others will hear YOU speaking their language.
        </p>

        {loadingVoice ? (
          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 px-4 py-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading voice profile...</span>
          </div>
        ) : showVoiceRecorder ? (
          <div className="rounded-xl border border-border bg-secondary/20 p-4">
            <VoiceRecorder
              minDuration={60}
              maxDuration={120}
              onRecordingComplete={handleVoiceRecordingComplete}
              disabled={uploadingVoice}
            />
            {uploadingVoice && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating voice profile...
              </div>
            )}
            <button
              onClick={() => setShowVoiceRecorder(false)}
              disabled={uploadingVoice}
              className="mt-4 w-full rounded-lg py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : voiceProfile ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg bg-green-500/10 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div className="flex-1">
                <div className="text-sm font-medium">Voice profile active</div>
                <div className="text-xs text-muted-foreground">
                  Your voice will be used for call translations
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowVoiceRecorder(true)}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary"
              >
                Re-record Voice
              </button>
              <button
                onClick={handleDeleteVoice}
                disabled={deletingVoice}
                className="flex items-center gap-1 rounded-lg border border-destructive/50 px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
              >
                {deletingVoice ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg bg-amber-500/10 px-4 py-3">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <div className="flex-1">
                <div className="text-sm font-medium">No voice profile</div>
                <div className="text-xs text-muted-foreground">
                  Record your voice to enable personalized call translation
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowVoiceRecorder(true)}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Set Up Voice Profile
            </button>
          </div>
        )}
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

      {/* Notification Preferences */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Bell className="h-4 w-4" /> Notifications
        </h3>
        {loadingNotif ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : notifPrefs ? (
          <div className="space-y-2">
            {([
              { key: "push_messages", label: "Message notifications" },
              { key: "push_calls", label: "Call notifications" },
              { key: "push_friend_requests", label: "Friend request alerts" },
              { key: "email_calls", label: "Email on missed calls" },
              { key: "email_friend_requests", label: "Email on friend requests" },
              { key: "sound_enabled", label: "Sound effects" },
              { key: "dnd_enabled", label: "Do Not Disturb" },
            ] as { key: keyof NotificationPrefs; label: string }[]).map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2 cursor-pointer"
              >
                <span className="text-sm">{label}</span>
                <input
                  type="checkbox"
                  checked={!!notifPrefs[key]}
                  onChange={async () => {
                    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
                    setNotifPrefs(updated);
                    setSavingNotif(true);
                    try {
                      await notifApi.updatePrefs({ [key]: !notifPrefs[key] });
                    } catch {}
                    setSavingNotif(false);
                  }}
                  className="h-4 w-4 accent-primary"
                />
              </label>
            ))}
            {notifPrefs.dnd_enabled && (
              <div className="flex gap-2 pl-1">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">From</label>
                  <input
                    type="time"
                    title="DND start time"
                    value={notifPrefs.dnd_start}
                    onChange={async (e) => {
                      const v = e.target.value;
                      setNotifPrefs({ ...notifPrefs, dnd_start: v });
                      await notifApi.updatePrefs({ dnd_start: v });
                    }}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">To</label>
                  <input
                    type="time"
                    title="DND end time"
                    value={notifPrefs.dnd_end}
                    onChange={async (e) => {
                      const v = e.target.value;
                      setNotifPrefs({ ...notifPrefs, dnd_end: v });
                      await notifApi.updatePrefs({ dnd_end: v });
                    }}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Could not load preferences.</p>
        )}
      </div>

      {/* Subscription */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Subscription
        </h3>
        {loadingSub ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Current Plan</span>
              <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary capitalize">
                {subscription?.plan || "free"}
              </span>
            </div>
            {subscription?.current_period_end && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Renews</span>
                <span>{new Date(subscription.current_period_end).toLocaleDateString()}</span>
              </div>
            )}
            {subscription?.plan === "free" ? (
              <button
                onClick={async () => {
                  try {
                    const { checkout_url } = await paymentsApi.createCheckout();
                    window.location.href = checkout_url;
                  } catch {}
                }}
                className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Upgrade to Pro
              </button>
            ) : (
              <button
                onClick={async () => {
                  try {
                    const { portal_url } = await paymentsApi.openPortal();
                    window.location.href = portal_url;
                  } catch {}
                }}
                className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
              >
                Manage Subscription
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
