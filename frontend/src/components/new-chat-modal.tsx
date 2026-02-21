"use client";

import { useState } from "react";
import { Loader2, MessageCircle, Users, X } from "lucide-react";
import { useFriendsStore } from "@/lib/store";
import { chats as chatsApi } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";

interface NewChatModalProps {
  onClose: () => void;
  onCreated: (chatId: string) => void;
}

type Mode = "dm" | "group";

export function NewChatModal({ onClose, onCreated }: NewChatModalProps) {
  const { friends } = useFriendsStore();
  const [mode, setMode] = useState<Mode>("dm");
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleCreate = async () => {
    setError("");
    setLoading(true);
    try {
      if (mode === "dm") {
        if (selected.size !== 1) {
          setError(t("newChat.selectOneFriend"));
          setLoading(false);
          return;
        }
        const friendId = Array.from(selected)[0];
        const { chat_id } = await chatsApi.createDM(friendId);
        onCreated(chat_id);
      } else {
        if (selected.size < 1) {
          setError(t("newChat.selectAtLeastOne"));
          setLoading(false);
          return;
        }
        if (!groupName.trim()) {
          setError(t("newChat.enterGroupName"));
          setLoading(false);
          return;
        }
        const { chat_id } = await chatsApi.createGroup(
          groupName.trim(),
          Array.from(selected)
        );
        onCreated(chat_id);
      }
    } catch (err: any) {
      setError(err.message || t("newChat.failedCreate"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">{t("newChat.title")}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 px-5 pt-4">
          <button
            onClick={() => {
              setMode("dm");
              setSelected(new Set());
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === "dm"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageCircle className="h-4 w-4" /> {t("newChat.directMessage")}
          </button>
          <button
            onClick={() => {
              setMode("group");
              setSelected(new Set());
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === "group"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" /> {t("newChat.groupChat")}
          </button>
        </div>

        {/* Group Name */}
        {mode === "group" && (
          <div className="px-5 pt-3">
            <input
              type="text"
              placeholder={t("newChat.groupName")}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
        )}

        {/* Friends List */}
        <div className="max-h-64 overflow-y-auto px-5 py-3">
          <p className="mb-2 text-xs text-muted-foreground">
            {mode === "dm"
              ? t("newChat.selectFriend")
              : t("newChat.selectMembers")}
          </p>
          {friends.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("newChat.addFriendsFirst")}
            </p>
          ) : (
            friends.map((friend) => {
              const isSelected = selected.has(friend.id);
              return (
                <button
                  key={friend.id}
                  onClick={() => {
                    if (mode === "dm") {
                      setSelected(new Set([friend.id]));
                    } else {
                      toggleSelect(friend.id);
                    }
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    isSelected ? "bg-primary/10" : "hover:bg-secondary/50"
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30"
                    }`}
                  >
                    {isSelected && (
                      <svg
                        className="h-3 w-3 text-primary-foreground"
                        viewBox="0 0 12 12"
                      >
                        <path
                          d="M3.5 6L5.5 8L8.5 4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          fill="none"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                    {friend.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {friend.display_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @{friend.username}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Error & Actions */}
        <div className="border-t border-border px-5 py-4">
          {error && (
            <p className="mb-3 text-sm text-destructive">{error}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || selected.size === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("common.create")
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
