/**
 * Global stores — auth, chats, friends.
 */

import { create } from "zustand";
import type { UserProfile, ChatPreview, FriendBrief, IncomingRequest } from "./api";

// ─── Auth Store ────────────────────────────────────────────

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: UserProfile, token: string) => void;
  updateUser: (data: Partial<UserProfile>) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: (user, token) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    set({ user, token, isLoading: false });
  },

  updateUser: (data) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...data } : null,
    })),

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    set({ user: null, token: null, isLoading: false });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, token, isLoading: false });
      } catch {
        set({ isLoading: false });
      }
    } else {
      set({ isLoading: false });
    }
  },
}));

// ─── Chat Store ────────────────────────────────────────────

interface ChatState {
  chats: ChatPreview[];
  activeChatId: string | null;
  setChats: (chats: ChatPreview[]) => void;
  setActiveChat: (id: string | null) => void;
  updateChat: (id: string, data: Partial<ChatPreview>) => void;
  addChat: (chat: ChatPreview) => void;
  incrementUnread: (chatId: string) => void;
  clearUnread: (chatId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  activeChatId: null,

  setChats: (chats) => set({ chats }),

  setActiveChat: (id) => set({ activeChatId: id }),

  updateChat: (id, data) =>
    set((state) => ({
      chats: state.chats.map((c) => (c.id === id ? { ...c, ...data } : c)),
    })),

  addChat: (chat) =>
    set((state) => ({
      chats: [chat, ...state.chats.filter((c) => c.id !== chat.id)],
    })),

  incrementUnread: (chatId) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, unread_count: c.unread_count + 1 } : c
      ),
    })),

  clearUnread: (chatId) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, unread_count: 0 } : c
      ),
    })),
}));

// ─── Friends Store ─────────────────────────────────────────

interface FriendsState {
  friends: FriendBrief[];
  incomingRequests: IncomingRequest[];
  setFriends: (friends: FriendBrief[]) => void;
  setIncomingRequests: (reqs: IncomingRequest[]) => void;
  updateFriendStatus: (userId: string, status: string) => void;
  removeFriend: (userId: string) => void;
}

export const useFriendsStore = create<FriendsState>((set) => ({
  friends: [],
  incomingRequests: [],

  setFriends: (friends) => set({ friends }),

  setIncomingRequests: (reqs) => set({ incomingRequests: reqs }),

  updateFriendStatus: (userId, status) =>
    set((state) => ({
      friends: state.friends.map((f) =>
        f.id === userId ? { ...f, status } : f
      ),
    })),

  removeFriend: (userId) =>
    set((state) => ({
      friends: state.friends.filter((f) => f.id !== userId),
    })),
}));

// ─── Call Store ────────────────────────────────────────────

export interface IncomingCallData {
  call_id: string;
  chat_id: string;
  room_name: string;
  call_type: "voice" | "video";
  initiated_by: string;
  initiator_name: string;
}

export interface ActiveCallData {
  call_id: string;
  chat_id: string;
  room_name: string;
  call_type: "voice" | "video";
  participant_count: number;
}

interface CallState {
  incomingCall: IncomingCallData | null;
  activeCalls: Map<string, ActiveCallData>;  // chat_id -> call data
  setIncomingCall: (call: IncomingCallData | null) => void;
  setActiveCall: (chatId: string, call: ActiveCallData | null) => void;
  updateParticipantCount: (chatId: string, count: number) => void;
  clearAllCalls: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  incomingCall: null,
  activeCalls: new Map(),

  setIncomingCall: (call) => set({ incomingCall: call }),

  setActiveCall: (chatId, call) =>
    set((state) => {
      const next = new Map(state.activeCalls);
      if (call) {
        next.set(chatId, call);
      } else {
        next.delete(chatId);
      }
      return { activeCalls: next };
    }),

  updateParticipantCount: (chatId, count) =>
    set((state) => {
      const next = new Map(state.activeCalls);
      const existing = next.get(chatId);
      if (existing) {
        next.set(chatId, { ...existing, participant_count: count });
      }
      return { activeCalls: next };
    }),

  clearAllCalls: () => set({ incomingCall: null, activeCalls: new Map() }),
}));
