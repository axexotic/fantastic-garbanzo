"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuthStore, useChatStore, useFriendsStore, useCallStore } from "@/lib/store";
import { chats as chatsApi, friends as friendsApi, voice as voiceApi, preferences as prefsApi } from "@/lib/api";
import { useSocket } from "@/hooks/use-socket";
import { ChatList } from "@/components/chat-list";
import { ChatView } from "@/components/chat-view";
import { FriendsPanel } from "@/components/friends-panel";
import { NewChatModal } from "@/components/new-chat-modal";
import { SettingsPanel } from "@/components/settings-panel";
import { VoiceSetupModal } from "@/components/voice-setup-modal";
import { IncomingCallModal } from "@/components/incoming-call-modal";

type SidePanel = "chats" | "friends" | "settings";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading, loadFromServer, logout } = useAuthStore();
  const { chats, setChats, activeChatId, setActiveChat } = useChatStore();
  const { setFriends, setIncomingRequests } = useFriendsStore();
  const { incomingCall, setIncomingCall } = useCallStore();
  const socket = useSocket();

  const [sidePanel, setSidePanel] = useState<SidePanel>("chats");
  const [showNewChat, setShowNewChat] = useState(false);
  const [showVoiceSetup, setShowVoiceSetup] = useState(false);

  // Auth check — load user from server via cookie
  useEffect(() => {
    loadFromServer();
  }, [loadFromServer]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  // Load data
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        const [chatList, friendList, requests] = await Promise.all([
          chatsApi.list(),
          friendsApi.list(),
          friendsApi.incomingRequests(),
        ]);
        setChats(chatList);
        setFriends(friendList);
        setIncomingRequests(requests);
      } catch (err) {
        console.error("Failed to load data:", err);
      }
    };

    loadData();
  }, [user, setChats, setFriends, setIncomingRequests]);

  // Check voice profile after login — using DB preferences
  useEffect(() => {
    if (!user) return;

    const checkVoiceProfile = async () => {
      try {
        // Check if user has already seen or skipped voice setup (from DB)
        const prefs = await prefsApi.get();
        if (prefs.voice_setup_skipped || prefs.voice_setup_seen) return;

        try {
          // Check if voice profile exists
          await voiceApi.getProfile();
          // Profile exists, no need to show setup
        } catch (err) {
          // No voice profile - show setup modal for first-time users
          setShowVoiceSetup(true);
          // Mark as seen in DB
          await prefsApi.update({ voice_setup_seen: true });
        }
      } catch {
        // Preferences endpoint failed — skip silently
      }
    };

    checkVoiceProfile();
  }, [user]);

  const handleLogout = async () => {
    try {
      const { auth: authApi } = await import("@/lib/api");
      await authApi.logout();
    } catch {
      // Ignore — clear state regardless
    }
    logout();
    router.push("/");
  };

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ─── Left Nav Bar ─── */}
      <div className="flex w-16 flex-col items-center justify-between border-r border-border bg-secondary/30 py-4">
        <div className="space-y-4">
          <button
            onClick={() => setSidePanel("chats")}
            className={`rounded-xl p-3 transition-colors ${
              sidePanel === "chats" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Chats"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
          <button
            onClick={() => setSidePanel("friends")}
            className={`rounded-xl p-3 transition-colors ${
              sidePanel === "friends" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Friends"
          >
            <Users className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => setSidePanel("settings")}
            className={`rounded-xl p-3 transition-colors ${
              sidePanel === "settings" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
          <button
            onClick={handleLogout}
            className="rounded-xl p-3 text-muted-foreground transition-colors hover:text-destructive"
            title="Logout"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ─── Side Panel ─── */}
      <div className="flex w-80 flex-col border-r border-border bg-background">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold capitalize">{sidePanel}</h2>
          {sidePanel === "chats" && (
            <button
              onClick={() => setShowNewChat(true)}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="New chat"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto">
          {sidePanel === "chats" && (
            <ChatList
              chats={chats}
              activeChatId={activeChatId}
              onSelectChat={(id) => setActiveChat(id)}
              currentUserId={user.id}
            />
          )}
          {sidePanel === "friends" && <FriendsPanel />}
          {sidePanel === "settings" && <SettingsPanel />}
        </div>
      </div>

      {/* ─── Main Chat Area ─── */}
      <div className="flex flex-1 flex-col">
        {activeChatId ? (
          <ChatView
            chatId={activeChatId}
            currentUser={user}
            socket={socket}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
            <Globe className="h-16 w-16 text-primary/30" />
            <p className="text-lg">Select a chat to start messaging</p>
            <p className="text-sm">
              Messages are automatically translated to each person&apos;s
              language
            </p>
          </div>
        )}
      </div>

      {/* ─── New Chat Modal ─── */}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onCreated={(chatId) => {
            setShowNewChat(false);
            setActiveChat(chatId);
          }}
        />
      )}

      {/* ─── Voice Setup Modal ─── */}
      {showVoiceSetup && (
        <VoiceSetupModal
          onClose={() => setShowVoiceSetup(false)}
          onComplete={() => setShowVoiceSetup(false)}
        />
      )}

      {/* ─── Incoming Call Modal ─── */}
      {incomingCall && (
        <IncomingCallModal
          call={incomingCall}
          onDismiss={() => setIncomingCall(null)}
        />
      )}
    </div>
  );
}
