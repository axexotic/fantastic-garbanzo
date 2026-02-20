"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft,
  Bell,
  Camera,
  Check,
  ChevronRight,
  CreditCard,
  DollarSign,
  Eye,
  EyeOff,
  Folder,
  Globe,
  History,
  Loader2,
  Lock,
  MessageCircle,
  Mic,
  Monitor,
  Moon,
  Pencil,
  Phone,
  Settings2,
  Shield,
  Speaker,
  Trash2,
  User,
  Zap,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import {
  auth as authApi,
  voice as voiceApi,
  payments as paymentsApi,
  notifications as notifApi,
  preferences as prefsApi,
  type VoiceProfile,
  type BalanceInfo,
  type CreditTransaction,
  type NotificationPrefs,
  type UserPreferences,
} from "@/lib/api";
import { VoiceRecorder } from "./voice-recorder";

// ─── Types ─────────────────────────────────────────────────

type SettingsSection =
  | "menu"
  | "account"
  | "notifications"
  | "privacy"
  | "chat"
  | "folders"
  | "advanced"
  | "devices"
  | "battery"
  | "payments";

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

const RINGTONE_OPTIONS = [
  { value: "default", label: "Default", emoji: "🔔" },
  { value: "classic", label: "Classic", emoji: "📞" },
  { value: "digital", label: "Digital", emoji: "💫" },
  { value: "melody", label: "Melody", emoji: "🎵" },
  { value: "urgent", label: "Urgent", emoji: "🚨" },
  { value: "gentle", label: "Gentle", emoji: "🌸" },
  { value: "retro", label: "Retro", emoji: "📟" },
  { value: "silent", label: "Silent", emoji: "🔇" },
];

const NOTIFICATION_TONE_OPTIONS = [
  { value: "default", label: "Default", emoji: "🔔" },
  { value: "chime", label: "Chime", emoji: "🎐" },
  { value: "ding", label: "Ding", emoji: "🛎️" },
  { value: "pop", label: "Pop", emoji: "💬" },
  { value: "drop", label: "Drop", emoji: "💧" },
  { value: "bubble", label: "Bubble", emoji: "🫧" },
  { value: "chirp", label: "Chirp", emoji: "🐦" },
  { value: "silent", label: "Silent", emoji: "🔇" },
];

// ─── Toggle Component ──────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
        checked ? "bg-primary" : "bg-border"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5 ${
          checked ? "translate-x-4 ml-0.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

// ─── Select Component ──────────────────────────────────────

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─── Tone Select (with emoji) ──────────────────────────────

function ToneSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string; emoji: string }[];
  onChange: (v: string) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-border bg-background pl-2 pr-6 py-1 text-xs outline-none focus:border-primary cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.emoji} {o.label}
          </option>
        ))}
      </select>
      <ChevronRight className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-90 text-muted-foreground" />
    </div>
  );
}

// ─── Menu Item ─────────────────────────────────────────────

function MenuItem({
  icon: Icon,
  label,
  sublabel,
  onClick,
  iconColor,
}: {
  icon: any;
  label: string;
  sublabel?: string;
  onClick: () => void;
  iconColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary/50"
    >
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
          iconColor || "bg-primary/10 text-primary"
        }`}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {sublabel && (
          <div className="text-xs text-muted-foreground truncate">{sublabel}</div>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

// ─── Section Header ────────────────────────────────────────

function SectionHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 backdrop-blur px-3 py-2.5">
      <button
        onClick={onBack}
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
  );
}

// ─── Setting Row ───────────────────────────────────────────

function SettingRow({
  label,
  sublabel,
  children,
}: {
  label: string;
  sublabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-sm">{label}</div>
        {sublabel && (
          <div className="text-xs text-muted-foreground">{sublabel}</div>
        )}
      </div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export function SettingsPanel() {
  const { user, updateUser } = useAuthStore();
  const [section, setSection] = useState<SettingsSection>("menu");

  // Profile state
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [language, setLanguage] = useState(user?.preferred_language || "en");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Avatar
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Voice profile
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null);
  const [loadingVoice, setLoadingVoice] = useState(true);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [deletingVoice, setDeletingVoice] = useState(false);

  // Payments
  const [balanceInfo, setBalanceInfo] = useState<BalanceInfo | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [showTransactions, setShowTransactions] = useState(false);
  const [buyingCredits, setBuyingCredits] = useState(false);
  const [buyingChatPlan, setBuyingChatPlan] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number>(500);

  // Notifications
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs | null>(null);
  const [loadingNotif, setLoadingNotif] = useState(true);

  // Preferences
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loadingPrefs, setLoadingPrefs] = useState(true);

  // Devices
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);

  // Password change
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Delete account
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // ─── Load Data ─────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await voiceApi.getProfile();
        setVoiceProfile(profile);
      } catch {
        setVoiceProfile(null);
      } finally {
        setLoadingVoice(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const bal = await paymentsApi.getBalance();
        setBalanceInfo(bal);
      } catch {
        setBalanceInfo(null);
      } finally {
        setLoadingPayments(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const p = await notifApi.getPrefs();
        setNotifPrefs(p);
      } catch {
        setNotifPrefs(null);
      } finally {
        setLoadingNotif(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const p = await prefsApi.get();
        setPrefs(p);
      } catch {
        setPrefs(null);
      } finally {
        setLoadingPrefs(false);
      }
    };
    load();
  }, []);

  // Enumerate devices when devices section opened
  useEffect(() => {
    if (section !== "devices") return;
    const enumerate = async () => {
      try {
        // Request permission first
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        stream.getTracks().forEach((t) => t.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
        setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
        setVideoInputs(devices.filter((d) => d.kind === "videoinput"));
      } catch {
        // Permission denied — still try enumeration
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
          setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
          setVideoInputs(devices.filter((d) => d.kind === "videoinput"));
        } catch {}
      }
    };
    enumerate();
  }, [section]);

  // ─── Handlers ──────────────────────────────────────────

  const handleSaveProfile = async () => {
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
    } catch {
      alert("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5 MB");
      return;
    }
    setUploadingAvatar(true);
    try {
      const result = await authApi.uploadAvatar(file);
      updateUser(result.user);
    } catch (err: any) {
      alert(err.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleDeleteAvatar = async () => {
    try {
      await authApi.deleteAvatar();
      updateUser({ avatar_url: "" });
    } catch {
      alert("Failed to remove avatar");
    }
  };

  const handleVoiceRecordingComplete = async (audioBlob: Blob) => {
    setUploadingVoice(true);
    try {
      const profile = await voiceApi.cloneVoice(audioBlob);
      setVoiceProfile(profile);
      setShowVoiceRecorder(false);
    } catch (err: any) {
      alert(err.message || "Failed to create voice profile");
    } finally {
      setUploadingVoice(false);
    }
  };

  const handleDeleteVoice = async () => {
    if (!confirm("Delete your voice profile?")) return;
    setDeletingVoice(true);
    try {
      await voiceApi.deleteProfile();
      setVoiceProfile(null);
    } catch {
      alert("Failed to delete voice profile");
    } finally {
      setDeletingVoice(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return;
    setChangingPassword(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      alert("Password changed successfully");
      setShowPasswordChange(false);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      alert(err.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) return;
    if (!confirm("This will permanently deactivate your account. Are you sure?"))
      return;
    setDeletingAccount(true);
    try {
      await authApi.deleteAccount(deletePassword);
      alert("Account deactivated");
      window.location.href = "/";
    } catch (err: any) {
      alert(err.message || "Failed to delete account");
    } finally {
      setDeletingAccount(false);
    }
  };

  const updatePref = useCallback(
    async (key: string, value: any) => {
      if (!prefs) return;
      const updated = { ...prefs, [key]: value };
      setPrefs(updated);
      try {
        await prefsApi.update({ [key]: value } as any);
      } catch {}
    },
    [prefs]
  );

  const updateNotif = useCallback(
    async (key: keyof NotificationPrefs, value: any) => {
      if (!notifPrefs) return;
      const updated = { ...notifPrefs, [key]: value };
      setNotifPrefs(updated);
      try {
        await notifApi.updatePrefs({ [key]: value });
      } catch {}
    },
    [notifPrefs]
  );

  if (!user) return null;

  const goBack = () => setSection("menu");
  const initials = (user.display_name || user.username || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // ═══════════════════════════════════════════════════════
  // MAIN MENU
  // ═══════════════════════════════════════════════════════

  if (section === "menu") {
    return (
      <div className="flex flex-col">
        {/* Profile Header */}
        <div className="flex flex-col items-center gap-3 px-4 py-6 border-b border-border">
          {/* Avatar */}
          <div className="relative group">
            <div className="h-20 w-20 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-primary">{initials}</span>
              )}
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110"
            >
              {uploadingAvatar ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <div className="text-center">
            <h3 className="text-base font-semibold">{user.display_name}</h3>
            <p className="text-xs text-muted-foreground">@{user.username}</p>
          </div>
        </div>

        {/* Menu Items */}
        <div className="p-2 space-y-0.5">
          <MenuItem
            icon={User}
            label="My Account"
            sublabel="Profile, language, voice"
            onClick={() => setSection("account")}
            iconColor="bg-blue-500/10 text-blue-500"
          />
          <MenuItem
            icon={Bell}
            label="Notifications & Sounds"
            sublabel="Ringtones, tones, DND"
            onClick={() => setSection("notifications")}
            iconColor="bg-red-500/10 text-red-500"
          />
          <MenuItem
            icon={Shield}
            label="Privacy & Security"
            sublabel="Last seen, read receipts"
            onClick={() => setSection("privacy")}
            iconColor="bg-green-500/10 text-green-500"
          />
          <MenuItem
            icon={MessageCircle}
            label="Chat Settings"
            sublabel="Appearance, translation"
            onClick={() => setSection("chat")}
            iconColor="bg-cyan-500/10 text-cyan-500"
          />
          <MenuItem
            icon={Folder}
            label="Folders"
            sublabel="Organize your chats"
            onClick={() => setSection("folders")}
            iconColor="bg-purple-500/10 text-purple-500"
          />
          <MenuItem
            icon={Settings2}
            label="Advanced"
            sublabel="Data, storage, proxy"
            onClick={() => setSection("advanced")}
            iconColor="bg-gray-500/10 text-gray-500"
          />
          <MenuItem
            icon={Speaker}
            label="Speakers & Camera"
            sublabel="Audio/video devices"
            onClick={() => setSection("devices")}
            iconColor="bg-orange-500/10 text-orange-500"
          />
          <MenuItem
            icon={Zap}
            label="Battery & Animations"
            sublabel="Performance options"
            onClick={() => setSection("battery")}
            iconColor="bg-yellow-500/10 text-yellow-500"
          />

          <div className="my-2 border-t border-border" />

          <MenuItem
            icon={CreditCard}
            label="Payments & Credits"
            sublabel={
              balanceInfo
                ? `${balanceInfo.balance_display} credits`
                : "Manage billing"
            }
            onClick={() => setSection("payments")}
            iconColor="bg-emerald-500/10 text-emerald-500"
          />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // MY ACCOUNT
  // ═══════════════════════════════════════════════════════

  if (section === "account") {
    return (
      <div className="flex flex-col">
        <SectionHeader title="My Account" onBack={goBack} />

        {/* Avatar + Name */}
        <div className="flex items-center gap-4 px-4 py-4 border-b border-border">
          <div className="relative group">
            <div className="h-16 w-16 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold text-primary">
                  {initials}
                </span>
              )}
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
            >
              {uploadingAvatar ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Camera className="h-3 w-3" />
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">{user.display_name}</div>
            <div className="text-xs text-muted-foreground">@{user.username}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
          {user.avatar_url && (
            <button
              onClick={handleDeleteAvatar}
              className="text-xs text-destructive hover:underline"
            >
              Remove
            </button>
          )}
        </div>

        {/* Profile Fields */}
        <div className="px-4 py-3 space-y-3">
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

        {/* Language */}
        <div className="px-4 py-3 border-t border-border">
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <Globe className="h-3.5 w-3.5" /> My Language
          </h4>
          <p className="mb-2 text-xs text-muted-foreground">
            Messages will be translated to this language.
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
        <div className="px-4 py-3 border-t border-border">
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <Mic className="h-3.5 w-3.5" /> Voice Profile
          </h4>
          <p className="mb-2 text-xs text-muted-foreground">
            Your cloned voice is used for live call translation.
          </p>

          {loadingVoice ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : showVoiceRecorder ? (
            <div className="rounded-xl border border-border bg-secondary/20 p-3">
              <VoiceRecorder
                minDuration={60}
                maxDuration={120}
                onRecordingComplete={handleVoiceRecordingComplete}
                disabled={uploadingVoice}
              />
              {uploadingVoice && (
                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Creating voice profile...
                </div>
              )}
              <button
                onClick={() => setShowVoiceRecorder(false)}
                disabled={uploadingVoice}
                className="mt-3 w-full rounded-lg py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : voiceProfile ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-xs font-medium">Voice profile active</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowVoiceRecorder(true)}
                  className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                >
                  Re-record
                </button>
                <button
                  onClick={handleDeleteVoice}
                  disabled={deletingVoice}
                  className="flex items-center gap-1 rounded-lg border border-destructive/50 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  {deletingVoice ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span className="text-xs">No voice profile set up</span>
              </div>
              <button
                onClick={() => setShowVoiceRecorder(true)}
                className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Set Up Voice Profile
              </button>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="px-4 py-3 border-t border-border">
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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

        {/* Account Actions */}
        <div className="px-4 py-3 border-t border-border space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Account Actions
          </h4>

          {/* Change Password */}
          <button
            onClick={() => setShowPasswordChange(!showPasswordChange)}
            className="flex w-full items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm hover:bg-secondary"
          >
            <Lock className="h-4 w-4" /> Change Password
          </button>
          {showPasswordChange && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                type="password"
                placeholder="New password (min 8 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={handleChangePassword}
                disabled={changingPassword || !currentPassword || !newPassword}
                className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {changingPassword ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Update Password"
                )}
              </button>
            </div>
          )}

          {/* Delete Account */}
          <button
            onClick={() => setShowDeleteAccount(!showDeleteAccount)}
            className="flex w-full items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive hover:bg-destructive/20"
          >
            <Trash2 className="h-4 w-4" /> Delete Account
          </button>
          {showDeleteAccount && (
            <div className="space-y-2 rounded-lg border border-destructive/30 p-3">
              <p className="text-xs text-muted-foreground">
                This will permanently deactivate your account. Enter your
                password to confirm.
              </p>
              <input
                type="password"
                placeholder="Your password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-destructive"
              />
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount || !deletePassword}
                className="w-full rounded-lg bg-destructive py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50"
              >
                {deletingAccount ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Confirm Delete"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // NOTIFICATIONS & SOUNDS
  // ═══════════════════════════════════════════════════════

  if (section === "notifications") {
    return (
      <div className="flex flex-col">
        <SectionHeader title="Notifications & Sounds" onBack={goBack} />

        {loadingNotif ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : notifPrefs ? (
          <div className="divide-y divide-border">
            <div className="px-1 py-2">
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Push Notifications
              </p>
              <SettingRow label="Message notifications">
                <Toggle
                  checked={notifPrefs.push_messages}
                  onChange={(v) => updateNotif("push_messages", v)}
                />
              </SettingRow>
              <SettingRow label="Call notifications">
                <Toggle
                  checked={notifPrefs.push_calls}
                  onChange={(v) => updateNotif("push_calls", v)}
                />
              </SettingRow>
              <SettingRow label="Friend request alerts">
                <Toggle
                  checked={notifPrefs.push_friend_requests}
                  onChange={(v) => updateNotif("push_friend_requests", v)}
                />
              </SettingRow>
            </div>

            <div className="px-1 py-2">
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Email Notifications
              </p>
              <SettingRow label="Email on missed calls">
                <Toggle
                  checked={notifPrefs.email_calls}
                  onChange={(v) => updateNotif("email_calls", v)}
                />
              </SettingRow>
              <SettingRow label="Email on friend requests">
                <Toggle
                  checked={notifPrefs.email_friend_requests}
                  onChange={(v) => updateNotif("email_friend_requests", v)}
                />
              </SettingRow>
            </div>

            <div className="px-1 py-2">
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Sounds
              </p>
              <SettingRow label="Sound effects">
                <Toggle
                  checked={notifPrefs.sound_enabled}
                  onChange={(v) => updateNotif("sound_enabled", v)}
                />
              </SettingRow>
              <SettingRow label="Vibration">
                <Toggle
                  checked={notifPrefs.vibration_enabled}
                  onChange={(v) => updateNotif("vibration_enabled", v)}
                />
              </SettingRow>
            </div>

            <div className="px-1 py-2">
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Ringtone & Tones
              </p>
              <SettingRow label="Ringtone" sublabel="Incoming voice/video calls">
                <ToneSelect
                  value={notifPrefs.ringtone}
                  options={RINGTONE_OPTIONS}
                  onChange={(v) => updateNotif("ringtone", v)}
                />
              </SettingRow>
              <SettingRow label="Notification" sublabel="Message alerts">
                <ToneSelect
                  value={notifPrefs.notification_tone}
                  options={NOTIFICATION_TONE_OPTIONS}
                  onChange={(v) => updateNotif("notification_tone", v)}
                />
              </SettingRow>
              <SettingRow label="Group tone" sublabel="Group chat alerts">
                <ToneSelect
                  value={notifPrefs.group_tone}
                  options={NOTIFICATION_TONE_OPTIONS}
                  onChange={(v) => updateNotif("group_tone", v)}
                />
              </SettingRow>
            </div>

            <div className="px-1 py-2">
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Do Not Disturb
              </p>
              <SettingRow label="Enable DND">
                <Toggle
                  checked={notifPrefs.dnd_enabled}
                  onChange={(v) => updateNotif("dnd_enabled", v)}
                />
              </SettingRow>
              {notifPrefs.dnd_enabled && (
                <div className="flex gap-2 px-4 py-2">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">From</label>
                    <input
                      type="time"
                      title="DND start"
                      value={notifPrefs.dnd_start}
                      onChange={(e) => updateNotif("dnd_start", e.target.value)}
                      className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">To</label>
                    <input
                      type="time"
                      title="DND end"
                      value={notifPrefs.dnd_end}
                      onChange={(e) => updateNotif("dnd_end", e.target.value)}
                      className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Could not load notification preferences.
          </p>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // PRIVACY & SECURITY
  // ═══════════════════════════════════════════════════════

  if (section === "privacy") {
    return (
      <div className="flex flex-col">
        <SectionHeader title="Privacy & Security" onBack={goBack} />

        {loadingPrefs ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : prefs ? (
          <div className="divide-y divide-border">
            <div className="px-1 py-2">
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Privacy
              </p>
              <SettingRow label="Last Seen" sublabel="Who can see your last seen time">
                <Select
                  value={prefs.show_last_seen}
                  options={[
                    { value: "everyone", label: "Everyone" },
                    { value: "contacts", label: "Contacts" },
                    { value: "nobody", label: "Nobody" },
                  ]}
                  onChange={(v) => updatePref("show_last_seen", v)}
                />
              </SettingRow>
              <SettingRow
                label="Profile Photo"
                sublabel="Who can see your profile photo"
              >
                <Select
                  value={prefs.show_profile_photo}
                  options={[
                    { value: "everyone", label: "Everyone" },
                    { value: "contacts", label: "Contacts" },
                    { value: "nobody", label: "Nobody" },
                  ]}
                  onChange={(v) => updatePref("show_profile_photo", v)}
                />
              </SettingRow>
              <SettingRow label="Read Receipts" sublabel="Show when you've read messages">
                <Toggle
                  checked={prefs.show_read_receipts}
                  onChange={(v) => updatePref("show_read_receipts", v)}
                />
              </SettingRow>
            </div>

            <div className="px-1 py-2">
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Security
              </p>
              <SettingRow
                label="Two-Factor Auth"
                sublabel="Require code on new device"
              >
                <Toggle
                  checked={prefs.two_factor_enabled}
                  onChange={(v) => updatePref("two_factor_enabled", v)}
                />
              </SettingRow>
              <SettingRow
                label="Active Sessions"
                sublabel="Max simultaneous sessions"
              >
                <Select
                  value={String(prefs.active_sessions_limit)}
                  options={[
                    { value: "1", label: "1" },
                    { value: "3", label: "3" },
                    { value: "5", label: "5" },
                    { value: "10", label: "10" },
                  ]}
                  onChange={(v) =>
                    updatePref("active_sessions_limit", parseInt(v))
                  }
                />
              </SettingRow>
            </div>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Could not load privacy settings.
          </p>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // CHAT SETTINGS
  // ═══════════════════════════════════════════════════════

  if (section === "chat") {
    return (
      <div className="flex flex-col">
        <SectionHeader title="Chat Settings" onBack={goBack} />

        {loadingPrefs ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : prefs ? (
          <div className="divide-y divide-border">
            <div className="px-1 py-2">
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Appearance
              </p>
              <SettingRow label="Font Size">
                <Select
                  value={prefs.chat_font_size}
                  options={[
                    { value: "small", label: "Small" },
                    { value: "medium", label: "Medium" },
                    { value: "large", label: "Large" },
                  ]}
                  onChange={(v) => updatePref("chat_font_size", v)}
                />
              </SettingRow>
              <SettingRow label="Wallpaper">
                <Select
                  value={prefs.chat_wallpaper}
                  options={[
                    { value: "default", label: "Default" },
                    { value: "dark", label: "Dark" },
                    { value: "gradient", label: "Gradient" },
                    { value: "minimal", label: "Minimal" },
                  ]}
                  onChange={(v) => updatePref("chat_wallpaper", v)}
                />
              </SettingRow>
            </div>

            <div className="px-1 py-2">
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Behavior
              </p>
              <SettingRow
                label="Group messages"
                sublabel="Cluster messages by time"
              >
                <Toggle
                  checked={prefs.message_grouping}
                  onChange={(v) => updatePref("message_grouping", v)}
                />
              </SettingRow>
              <SettingRow
                label="Send with Enter"
                sublabel="Enter sends, Shift+Enter new line"
              >
                <Toggle
                  checked={prefs.send_with_enter}
                  onChange={(v) => updatePref("send_with_enter", v)}
                />
              </SettingRow>
              <SettingRow
                label="Auto-translate"
                sublabel="Translate messages automatically"
              >
                <Toggle
                  checked={prefs.auto_translate_messages}
                  onChange={(v) => updatePref("auto_translate_messages", v)}
                />
              </SettingRow>
            </div>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Could not load chat settings.
          </p>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // FOLDERS
  // ═══════════════════════════════════════════════════════

  if (section === "folders") {
    return (
      <div className="flex flex-col">
        <SectionHeader title="Folders" onBack={goBack} />
        <div className="px-4 py-8 text-center">
          <Folder className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <h4 className="text-sm font-semibold">Chat Folders</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Organize your conversations into custom folders. Create folders to
            separate work, friends, and group chats.
          </p>
          <div className="mt-4 space-y-2">
            {["All Chats", "Personal", "Groups"].map((folder) => (
              <div
                key={folder}
                className="flex items-center gap-3 rounded-lg bg-secondary/30 px-4 py-2.5"
              >
                <Folder className="h-4 w-4 text-primary" />
                <span className="text-sm">{folder}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground italic">
            Custom folders coming soon
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // ADVANCED
  // ═══════════════════════════════════════════════════════

  if (section === "advanced") {
    return (
      <div className="flex flex-col">
        <SectionHeader title="Advanced" onBack={goBack} />

        {loadingPrefs ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : prefs ? (
          <div className="divide-y divide-border">
            <div className="px-1 py-2">
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Data & Storage
              </p>
              <SettingRow
                label="Auto-download media"
                sublabel="Photos, audio, documents"
              >
                <Toggle
                  checked={prefs.auto_download_media}
                  onChange={(v) => updatePref("auto_download_media", v)}
                />
              </SettingRow>
              {prefs.auto_download_media && (
                <SettingRow label="Max file size">
                  <Select
                    value={String(prefs.auto_download_max_size_mb)}
                    options={[
                      { value: "1", label: "1 MB" },
                      { value: "5", label: "5 MB" },
                      { value: "10", label: "10 MB" },
                      { value: "25", label: "25 MB" },
                      { value: "50", label: "50 MB" },
                    ]}
                    onChange={(v) =>
                      updatePref("auto_download_max_size_mb", parseInt(v))
                    }
                  />
                </SettingRow>
              )}
              <SettingRow
                label="Data Saver"
                sublabel="Reduce bandwidth usage in calls"
              >
                <Toggle
                  checked={prefs.data_saver_mode}
                  onChange={(v) => updatePref("data_saver_mode", v)}
                />
              </SettingRow>
            </div>

            <div className="px-1 py-2">
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Connection
              </p>
              <SettingRow label="Use Proxy" sublabel="Route through proxy server">
                <Toggle
                  checked={prefs.proxy_enabled}
                  onChange={(v) => updatePref("proxy_enabled", v)}
                />
              </SettingRow>
            </div>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Could not load advanced settings.
          </p>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // SPEAKERS & CAMERA
  // ═══════════════════════════════════════════════════════

  if (section === "devices") {
    return (
      <div className="flex flex-col">
        <SectionHeader title="Speakers & Camera" onBack={goBack} />

        <div className="divide-y divide-border">
          {/* Microphone */}
          <div className="px-1 py-2">
            <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Microphone
            </p>
            {audioInputs.length > 0 ? (
              <div className="px-4 py-2">
                <select
                  value={prefs?.preferred_audio_input || ""}
                  onChange={(e) => updatePref("preferred_audio_input", e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">System Default</option>
                  {audioInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="px-4 py-2 text-xs text-muted-foreground">
                No microphones detected. Allow browser permissions to see
                devices.
              </p>
            )}
          </div>

          {/* Speakers */}
          <div className="px-1 py-2">
            <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Speakers
            </p>
            {audioOutputs.length > 0 ? (
              <div className="px-4 py-2">
                <select
                  value={prefs?.preferred_audio_output || ""}
                  onChange={(e) => updatePref("preferred_audio_output", e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">System Default</option>
                  {audioOutputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="px-4 py-2 text-xs text-muted-foreground">
                No speakers detected.
              </p>
            )}
          </div>

          {/* Camera */}
          <div className="px-1 py-2">
            <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Camera
            </p>
            {videoInputs.length > 0 ? (
              <div className="px-4 py-2">
                <select
                  value={prefs?.preferred_video_input || ""}
                  onChange={(e) => updatePref("preferred_video_input", e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">System Default</option>
                  {videoInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="px-4 py-2 text-xs text-muted-foreground">
                No cameras detected.
              </p>
            )}
          </div>

          {/* Audio Processing */}
          <div className="px-1 py-2">
            <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Audio Processing
            </p>
            <SettingRow label="Echo Cancellation">
              <Toggle
                checked={prefs?.echo_cancellation ?? true}
                onChange={(v) => updatePref("echo_cancellation", v)}
              />
            </SettingRow>
            <SettingRow label="Noise Suppression">
              <Toggle
                checked={prefs?.noise_suppression ?? true}
                onChange={(v) => updatePref("noise_suppression", v)}
              />
            </SettingRow>
            <SettingRow label="Auto Gain Control">
              <Toggle
                checked={prefs?.auto_gain_control ?? true}
                onChange={(v) => updatePref("auto_gain_control", v)}
              />
            </SettingRow>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // BATTERY & ANIMATIONS
  // ═══════════════════════════════════════════════════════

  if (section === "battery") {
    return (
      <div className="flex flex-col">
        <SectionHeader title="Battery & Animations" onBack={goBack} />

        {loadingPrefs ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : prefs ? (
          <div className="divide-y divide-border">
            <div className="px-1 py-2">
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Performance
              </p>
              <SettingRow
                label="Reduce Animations"
                sublabel="Minimize UI transitions"
              >
                <Toggle
                  checked={prefs.reduce_animations}
                  onChange={(v) => updatePref("reduce_animations", v)}
                />
              </SettingRow>
              <SettingRow
                label="Power Saving Mode"
                sublabel="Reduce background activity"
              >
                <Toggle
                  checked={prefs.power_saving_mode}
                  onChange={(v) => updatePref("power_saving_mode", v)}
                />
              </SettingRow>
            </div>

            <div className="px-1 py-2">
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Media
              </p>
              <SettingRow
                label="Auto-play GIFs"
                sublabel="Play animated images automatically"
              >
                <Toggle
                  checked={prefs.auto_play_gifs}
                  onChange={(v) => updatePref("auto_play_gifs", v)}
                />
              </SettingRow>
            </div>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Could not load settings.
          </p>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // PAYMENTS & CREDITS
  // ═══════════════════════════════════════════════════════

  if (section === "payments") {
    return (
      <div className="flex flex-col">
        <SectionHeader title="Payments & Credits" onBack={goBack} />

        <div className="p-4 space-y-4">
          {/* Chat Plan — $15 Lifetime */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <MessageCircle className="h-3.5 w-3.5" /> Chat Plan
            </h4>
            {loadingPayments ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading...
              </div>
            ) : balanceInfo?.chat_plan_purchased ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <div>
                  <div className="text-xs font-semibold text-emerald-500">
                    Lifetime Chat Active
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Unlimited text messaging
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  One-time purchase for unlimited text messaging.
                </p>
                <button
                  disabled={buyingChatPlan}
                  onClick={async () => {
                    setBuyingChatPlan(true);
                    try {
                      const { checkout_url } = await paymentsApi.buyChatPlan();
                      window.location.href = checkout_url;
                    } catch {
                      alert("Failed to start checkout");
                    } finally {
                      setBuyingChatPlan(false);
                    }
                  }}
                  className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {buyingChatPlan ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                    </span>
                  ) : (
                    "Buy Lifetime Chat — $15"
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Voice/Video Credits */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Phone className="h-3.5 w-3.5" /> Voice & Video Credits
            </h4>
            {loadingPayments ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading...
              </div>
            ) : (
              <div className="space-y-3">
                {/* Balance */}
                <div className="flex items-center justify-between rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 px-4 py-3">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Voice Credits
                    </div>
                    <div className="text-xl font-bold text-emerald-500">
                      {balanceInfo?.balance_display || "$0.00"}
                    </div>
                  </div>
                  <DollarSign className="h-7 w-7 text-emerald-500/30" />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-secondary/30 px-2 py-1.5">
                    <div className="text-xs text-muted-foreground">
                      Purchased
                    </div>
                    <div className="text-sm font-semibold">
                      $
                      {(
                        (balanceInfo?.total_purchased_cents || 0) / 100
                      ).toFixed(2)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-secondary/30 px-2 py-1.5">
                    <div className="text-xs text-muted-foreground">Used</div>
                    <div className="text-sm font-semibold">
                      $
                      {((balanceInfo?.total_used_cents || 0) / 100).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Buy */}
                <div>
                  <label className="mb-1.5 block text-xs text-muted-foreground">
                    Top Up
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    {[100, 500, 1000, 2500, 5000, 10000].map((cents) => (
                      <button
                        key={cents}
                        onClick={() => setSelectedAmount(cents)}
                        className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                          selectedAmount === cents
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary/50 hover:bg-secondary"
                        }`}
                      >
                        ${(cents / 100).toFixed(cents >= 100 ? 0 : 2)}
                      </button>
                    ))}
                  </div>
                  <button
                    disabled={buyingCredits}
                    onClick={async () => {
                      setBuyingCredits(true);
                      try {
                        const { checkout_url } =
                          await paymentsApi.buyCredits(selectedAmount);
                        window.location.href = checkout_url;
                      } catch {
                        alert("Failed to start checkout");
                      } finally {
                        setBuyingCredits(false);
                      }
                    }}
                    className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {buyingCredits ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />{" "}
                        Processing...
                      </span>
                    ) : (
                      `Buy $${(selectedAmount / 100).toFixed(
                        selectedAmount >= 100 ? 0 : 2
                      )} Credits`
                    )}
                  </button>
                </div>

                {/* Transactions */}
                <button
                  onClick={async () => {
                    if (!showTransactions) {
                      try {
                        const data = await paymentsApi.getTransactions(20);
                        setTransactions(data.transactions);
                      } catch {}
                    }
                    setShowTransactions(!showTransactions);
                  }}
                  className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <History className="h-3 w-3" />
                  {showTransactions ? "Hide" : "Show"} History
                </button>

                {showTransactions && transactions.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {transactions.map((txn) => (
                      <div
                        key={txn.id}
                        className="flex items-center justify-between rounded-lg bg-secondary/20 px-3 py-1.5 text-xs"
                      >
                        <div>
                          <div className="font-medium capitalize">
                            {txn.transaction_type === "chat_plan"
                              ? "Chat Plan"
                              : txn.transaction_type}
                          </div>
                          <div className="text-muted-foreground">
                            {new Date(txn.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <span
                          className={`font-mono font-semibold ${
                            txn.amount_cents >= 0
                              ? "text-emerald-500"
                              : "text-red-400"
                          }`}
                        >
                          {txn.amount_cents >= 0 ? "+" : ""}$
                          {(Math.abs(txn.amount_cents) / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {showTransactions && transactions.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground">
                    No transactions yet
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
