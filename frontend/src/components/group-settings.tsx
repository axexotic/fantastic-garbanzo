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
}

export function GroupSettings({ chat, currentUserId, onClose, onUpdated }: GroupSettingsProps) {
  const { friends } = useFriendsStore();
  const [name, setName] = useState(chat.name || "");
  const [saving, setSaving] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
    if (!confirm("Remove this member?")) return;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Group Settings</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-6">
          {/* Group Name */}
          {isAdmin && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Group Name</label>
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
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* Members */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium">
                Members ({chat.members?.length || 0})
              </h3>
              {isAdmin && (
                <button
                  onClick={() => setShowAddPanel(!showAddPanel)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Add
                </button>
              )}
            </div>

            {/* Add Members Panel */}
            {showAddPanel && (
              <div className="mb-3 rounded-lg border border-border p-3">
                <p className="mb-2 text-xs text-muted-foreground">Add from friends:</p>
                {addableFriends.length === 0 ? (
                  <p className="text-xs text-muted-foreground">All friends are already members</p>
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
                            "Add"
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
                        Admin
                      </span>
                    )}
                    {member.id === currentUserId && (
                      <span className="text-[10px] text-muted-foreground">(you)</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {LANG_FLAGS[member.language || member.preferred_language] || ""}{" "}
                    {member.language || member.preferred_language}
                  </p>
                </div>
                {isAdmin && member.id !== currentUserId && (
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={actionLoading === member.id}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-border py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
