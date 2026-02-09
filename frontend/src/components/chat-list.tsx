"use client";

import { useState } from "react";
import { Search, Globe, Users, User } from "lucide-react";
import type { ChatPreview } from "@/lib/api";

interface ChatListProps {
  chats: ChatPreview[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  currentUserId: string;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getChatDisplayName(chat: ChatPreview, currentUserId: string): string {
  if (chat.chat_type === "group") return chat.name || "Group Chat";
  const other = chat.members?.find((m) => m.id !== currentUserId);
  return other?.display_name || chat.name || "Chat";
}

function getChatAvatar(chat: ChatPreview, currentUserId: string): string | null {
  if (chat.chat_type === "group") return chat.avatar_url;
  const other = chat.members?.find((m) => m.id !== currentUserId);
  return other?.avatar_url || null;
}

function getOtherLanguage(chat: ChatPreview, currentUserId: string): string | null {
  if (chat.chat_type !== "dm") return null;
  const other = chat.members?.find((m) => m.id !== currentUserId);
  return other?.language || other?.preferred_language || null;
}

const LANG_FLAGS: Record<string, string> = {
  en: "🇬🇧", th: "🇹🇭", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪",
  ja: "🇯🇵", ko: "🇰🇷", zh: "🇨🇳", ar: "🇸🇦", pt: "🇧🇷",
  ru: "🇷🇺", hi: "🇮🇳", vi: "🇻🇳", id: "🇮🇩", tr: "🇹🇷", it: "🇮🇹",
};

export function ChatList({ chats, activeChatId, onSelectChat, currentUserId }: ChatListProps) {
  const [search, setSearch] = useState("");

  const filtered = chats.filter((c) => {
    if (!search) return true;
    const name = getChatDisplayName(c, currentUserId).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col">
      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg bg-secondary/50 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:bg-secondary"
          />
        </div>
      </div>

      {/* Chat Items */}
      {filtered.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {search ? "No chats found" : "No chats yet — start one!"}
        </div>
      ) : (
        filtered.map((chat) => {
          const name = getChatDisplayName(chat, currentUserId);
          const otherLang = getOtherLanguage(chat, currentUserId);
          const lastMsg = chat.last_message;
          const isActive = chat.id === activeChatId;

          return (
            <button
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                isActive
                  ? "bg-primary/10 border-l-2 border-primary"
                  : "hover:bg-secondary/50"
              }`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-lg">
                  {chat.chat_type === "group" ? (
                    <Users className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <span>{name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                {otherLang && LANG_FLAGS[otherLang] && (
                  <span className="absolute -bottom-0.5 -right-0.5 text-xs">
                    {LANG_FLAGS[otherLang]}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium">{name}</span>
                  {lastMsg && (
                    <span className="flex-shrink-0 text-xs text-muted-foreground">
                      {formatTime(lastMsg.created_at)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-muted-foreground">
                    {lastMsg
                      ? lastMsg.content.length > 50
                        ? lastMsg.content.slice(0, 50) + "…"
                        : lastMsg.content
                      : "No messages yet"}
                  </p>
                  {chat.unread_count > 0 && (
                    <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {chat.unread_count > 99 ? "99+" : chat.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
