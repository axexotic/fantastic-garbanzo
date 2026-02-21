"use client";

import { useState } from "react";
import {
  Loader2,
  LogOut,
  Settings,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { chats as chatsApi, friends as friendsApi } from "@/lib/api";
import type { ChatPreview, FriendBrief } from "@/lib/api";
import { useFriendsStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

const LANG_FLAGS: Record<string, string> = {
  en: "🇬🇧", th: "🇹🇭", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪",
  ja: "🇯🇵", ko: "🇰🇷", zh: "🇨🇳", ar: "🇸🇦", pt: "🇧🇷",
  ru: "🇷🇺", hi: "🇮🇳", vi: "🇻🇳", id: "🇮🇩", tr: "🇹🇷", it: "🇮🇹",
};

interface GroupSettingsProps {
  chat: ChatPreview;
  currentUserId: string;
  onClose: () => void;
  onUpdated: () => void;
  onLeft?: () => void;
}

export function GroupSettings({ chat, currentUserId, onClose, onUpdated, onLeft }: GroupSettingsProps) {
  const { friends } = useFriendsStore();
  const router = useRouter();
  const { t } = useTranslation();
  const [name, setName] = useState(chat.name || "");
  const [saving, setSaving] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const currentMemberIds = new Set(chat.members?.map((m) => m.id) || []);
  const isAdmin = chat.members?.find((m) => m.id === currentUserId)?.role === "admin";
  const addableFriends = friends.filter((f) => !currentMemberIds.has(f.id));

  const handleRename = async () => {
    if (!name.trim() || name === chat.name) return;
    setSaving(true);
    try {
      await chatsApi.updateGroup(chat.id, { name: name.trim() });
      onUpdated();
    } catch (err) {
      console.error("Rename failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    setActionLoading(userId);
    try {
      await chatsApi.addMembers(chat.id, [userId]);
      onUpdated();
    } catch (err) {
      console.error("Add member failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm(t("group.confirmRemove"))) return;
    setActionLoading(userId);
    try {
      await chatsApi.removeMember(chat.id, userId);
      onUpdated();
    } catch (err) {
      console.error("Remove failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm(t("group.confirmLeave"))) return;
    setLeaving(true);
    try {
      await chatsApi.leaveGroup(chat.id);
      onClose();
      if (onLeft) onLeft();
    } catch (err) {
      console.error("Leave failed:", err);
    } finally {
      setLeaving(false);
    }
  };

  const handleTransferAdmin = async (userId: string) => {
    const member = chat.members?.find((m) => m.id === userId);
    if (!confirm(t("group.confirmTransfer", { name: member?.display_name || "?" }))) return;
    setTransferring(true);
    try {
      await chatsApi.transferAdmin(chat.id, userId);
      onUpdated();
    } catch (err) {
      console.error("Transfer failed:", err);
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t("group.settings")}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-6">
          {/* Group Name */}
          {isAdmin && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">{t("group.groupName")}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={handleRename}
                  disabled={saving || !name.trim() || name === chat.name}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.save")}
                </button>
              </div>
            </div>
          )}

          {/* Members */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium">
                {`${t("group.members")} (${chat.members?.length || 0})`}
              </h3>
              {isAdmin && (
                <button
                  onClick={() => setShowAddPanel(!showAddPanel)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
                >
                  <UserPlus className="h-3.5 w-3.5" /> {t("group.addMember")}
                </button>
              )}
            </div>

            {/* Add Members Panel */}
            {showAddPanel && (
              <div className="mb-3 rounded-lg border border-border p-3">
                <p className="mb-2 text-xs text-muted-foreground">{t("group.addFromFriends")}</p>
                {addableFriends.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("group.allMembersAdded")}</p>
                ) : (
                  <div className="space-y-1">
                    {addableFriends.map((friend) => (
                      <div key={friend.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-secondary/30">
                        <span className="text-sm">{friend.display_name}</span>
                        <button
                          onClick={() => handleAddMember(friend.id)}
                          disabled={actionLoading === friend.id}
                          className="rounded bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
                        >
                          {actionLoading === friend.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            t("group.addMember")
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Member List */}
            {chat.members?.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary/30"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                  {member.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{member.display_name}</span>
                    {member.role === "admin" && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {t("group.admin")}
                      </span>
                    )}
                    {member.id === currentUserId && (
                      <span className="text-[10px] text-muted-foreground">{t("group.you")}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {LANG_FLAGS[member.language || member.preferred_language] || ""}{" "}
                    {member.language || member.preferred_language}
                  </p>
                </div>
                {isAdmin && member.id !== currentUserId && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTransferAdmin(member.id)}
                      disabled={transferring || actionLoading === member.id}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      title={t("group.makeAdmin")}
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={actionLoading === member.id}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title={t("group.removeMember")}
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border px-5 py-4 space-y-2">
          <button
            onClick={handleLeaveGroup}
            disabled={leaving}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          >
            {leaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            {t("group.leaveGroup")}
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-border py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            {t("group.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
