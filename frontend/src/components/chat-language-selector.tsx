"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { chats as chatsApi } from "@/lib/api";
import { useChatStore } from "@/lib/store";
import { useTranslation } from "@/lib/i18n";

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

interface ChatLanguageSelectorProps {
  chatId: string;
  currentLanguage: string;
  onClose: () => void;
}

export function ChatLanguageSelector({
  chatId,
  currentLanguage,
  onClose,
}: ChatLanguageSelectorProps) {
  const [saving, setSaving] = useState(false);
  const { updateChat } = useChatStore();
  const { t } = useTranslation();

  const handleSelect = async (langCode: string) => {
    if (langCode === currentLanguage) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await chatsApi.setLanguage(chatId, langCode);
      updateChat(chatId, { my_language: langCode });
      onClose();
    } catch (err) {
      console.error("Language update failed:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-b border-border bg-secondary/30 px-5 py-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {t("chatView.receiveMessagesIn")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleSelect(lang.code)}
            disabled={saving}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
              currentLanguage === lang.code
                ? "bg-primary text-primary-foreground"
                : "bg-secondary hover:bg-secondary/80"
            }`}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
            {currentLanguage === lang.code && (
              <Check className="h-3 w-3" />
            )}
          </button>
        ))}
      </div>
      {saving && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> {t("chatView.updating")}
        </div>
      )}
    </div>
  );
}
