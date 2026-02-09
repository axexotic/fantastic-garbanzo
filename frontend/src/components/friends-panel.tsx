"use client";

import { useState } from "react";
import {
  Check,
  Search,
  UserMinus,
  UserPlus,
  X,
  MessageCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { useFriendsStore, useChatStore } from "@/lib/store";
import { friends as friendsApi, chats as chatsApi } from "@/lib/api";
import type { FriendBrief } from "@/lib/api";

const LANG_FLAGS: Record<string, string> = {
  en: "🇬🇧", th: "🇹🇭", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪",
  ja: "🇯🇵", ko: "🇰🇷", zh: "🇨🇳", ar: "🇸🇦", pt: "🇧🇷",
  ru: "🇷🇺", hi: "🇮🇳", vi: "🇻🇳", id: "🇮🇩", tr: "🇹🇷", it: "🇮🇹",
};

type Tab = "friends" | "requests" | "search";

export function FriendsPanel() {
  const { friends, incomingRequests, setFriends, setIncomingRequests, removeFriend } =
    useFriendsStore();
  const { addChat, setActiveChat } = useChatStore();

  const [tab, setTab] = useState<Tab>("friends");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendBrief[]>([]);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await friendsApi.search(searchQuery);
      setSearchResults(results);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (username: string) => {
    setActionLoading(username);
    try {
      await friendsApi.sendRequest(username);
      setSearchResults((prev) =>
        prev.map((u) =>
          u.username === username ? { ...u, status: "request_sent" } : u
        )
      );
    } catch (err: any) {
      alert(err.message || "Failed to send request");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAccept = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await friendsApi.acceptRequest(requestId);
      setIncomingRequests(incomingRequests.filter((r) => r.id !== requestId));
      const updated = await friendsApi.list();
      setFriends(updated);
    } catch (err) {
      console.error("Accept failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await friendsApi.rejectRequest(requestId);
      setIncomingRequests(incomingRequests.filter((r) => r.id !== requestId));
    } catch (err) {
      console.error("Reject failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnfriend = async (friendId: string) => {
    if (!confirm("Remove this friend?")) return;
    setActionLoading(friendId);
    try {
      await friendsApi.unfriend(friendId);
      removeFriend(friendId);
    } catch (err) {
      console.error("Unfriend failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartChat = async (friendId: string) => {
    setActionLoading(friendId);
    try {
      const { chat_id } = await chatsApi.createDM(friendId);
      // Reload chat list
      const chatList = await chatsApi.list();
      chatList.forEach((c) => addChat(c));
      setActiveChat(chat_id);
    } catch (err) {
      console.error("Create DM failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["friends", "requests", "search"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
            {t === "requests" && incomingRequests.length > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {incomingRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ─── Friends List ─── */}
        {tab === "friends" && (
          <div>
            {friends.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No friends yet. Search for people to add!
              </div>
            ) : (
              friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30"
                >
                  <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-medium">
                      {friend.display_name.charAt(0).toUpperCase()}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                        friend.status === "online" ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{friend.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      @{friend.username}{" "}
                      {LANG_FLAGS[friend.preferred_language] &&
                        LANG_FLAGS[friend.preferred_language]}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleStartChat(friend.id)}
                      disabled={actionLoading === friend.id}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      title="Message"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleUnfriend(friend.id)}
                      disabled={actionLoading === friend.id}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Unfriend"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── Incoming Requests ─── */}
        {tab === "requests" && (
          <div>
            {incomingRequests.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No pending friend requests
              </div>
            ) : (
              incomingRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-medium">
                    {req.sender.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {req.sender.display_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @{req.sender.username}
                      {req.message && ` — "${req.message}"`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleAccept(req.id)}
                      disabled={actionLoading === req.id}
                      className="rounded-lg bg-primary/10 p-2 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                      title="Accept"
                    >
                      {actionLoading === req.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={actionLoading === req.id}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Reject"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── Search Users ─── */}
        {tab === "search" && (
          <div>
            <div className="p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSearch();
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg bg-secondary/50 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:bg-secondary"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Go"}
                </button>
              </form>
            </div>

            {searchResults.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-medium">
                  {user.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    @{user.username}{" "}
                    {LANG_FLAGS[user.preferred_language] &&
                      LANG_FLAGS[user.preferred_language]}
                  </p>
                </div>
                <button
                  onClick={() => handleSendRequest(user.username)}
                  disabled={
                    actionLoading === user.username ||
                    (user as any).status === "request_sent"
                  }
                  className={`rounded-lg p-2 transition-colors ${
                    (user as any).status === "request_sent"
                      ? "text-muted-foreground"
                      : "text-primary hover:bg-primary/10"
                  }`}
                  title={
                    (user as any).status === "request_sent"
                      ? "Request sent"
                      : "Send friend request"
                  }
                >
                  {actionLoading === user.username ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (user as any).status === "request_sent" ? (
                    <Clock className="h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
