/**
 * Global stores — auth, chats, friends.
 * Zero localStorage — auth state comes from HTTP-only cookies + /api/auth/me.
 */

import { create } from "zustand";
import type { UserProfile, ChatPreview, FriendBrief, IncomingRequest } from "./api";

// ─── Auth Store ────────────────────────────────────────────

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  isLoading: boolean;
  setAuth: (user: UserProfile, token?: string) => void;
  setToken: (token: string) => void;
  updateUser: (data: Partial<UserProfile>) => void;
  logout: () => void;
  loadFromServer: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: true,

  setAuth: (user, token) => {
    set({ user, isLoading: false, ...(token ? { accessToken: token } : {}) });
  },

  setToken: (token) => {
    set({ accessToken: token });
  },

  updateUser: (data) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...data } : null,
    })),

  logout: () => {
    set({ user: null, isLoading: false, accessToken: null });
  },

  loadFromServer: async () => {
    try {
      // Dynamic import to avoid circular dependency
      const { auth } = await import("./api");
      const user = await auth.me();
      // Also get a fresh access token for WebSocket use
      let token: string | undefined;
      try {
        const refreshed = await auth.refresh();
        token = refreshed.token;
      } catch {
        // Refresh might fail if not logged in — ignore
      }
      set({ user, isLoading: false, ...(token ? { accessToken: token } : {}) });
    } catch {
      // Not authenticated or server error
      set({ user: null, isLoading: false, accessToken: null });
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

// ─── Call Features Store ───────────────────────────────────

export interface Reaction {
  user_id: string;
  emoji: string;
  timestamp: number;
}

export interface PollState {
  id: string;
  question: string;
  options: string[];
  votes: Record<string, string[]>;
  created_by: string;
}

export interface InCallChatMsg {
  user_id: string;
  username: string;
  message: string;
  timestamp: string;
}

interface CallFeaturesState {
  // Hold/Transfer
  isOnHold: boolean;
  holdCallId: string | null;

  // Reactions
  reactions: Reaction[];
  addReaction: (r: Reaction) => void;
  clearOldReactions: () => void;

  // Raise hand
  raisedHands: Set<string>;
  toggleHand: (userId: string, raised: boolean) => void;

  // Polls
  activePoll: PollState | null;
  setActivePoll: (poll: PollState | null) => void;

  // In-call chat
  inCallMessages: InCallChatMsg[];
  addInCallMessage: (msg: InCallChatMsg) => void;
  inCallChatOpen: boolean;
  setInCallChatOpen: (open: boolean) => void;

  // View mode
  viewMode: "grid" | "speaker" | "sidebar";
  setViewMode: (mode: "grid" | "speaker" | "sidebar") => void;

  // Panels
  showParticipants: boolean;
  showSettings: boolean;
  setShowParticipants: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;

  // Speaking time
  speakingTimes: Record<string, number>;
  setSpeakingTimes: (times: Record<string, number>) => void;

  // Background
  bgMode: "none" | "blur" | "virtual";
  setBgMode: (mode: "none" | "blur" | "virtual") => void;

  // PiP
  pipEnabled: boolean;
  setPipEnabled: (enabled: boolean) => void;

  // Hold
  setHold: (callId: string | null, onHold: boolean) => void;

  // Reset
  resetFeatures: () => void;
}

export const useCallFeaturesStore = create<CallFeaturesState>((set) => ({
  isOnHold: false,
  holdCallId: null,
  reactions: [],
  raisedHands: new Set(),
  activePoll: null,
  inCallMessages: [],
  inCallChatOpen: false,
  viewMode: "grid",
  showParticipants: false,
  showSettings: false,
  speakingTimes: {},
  bgMode: "none",
  pipEnabled: false,

  addReaction: (r) =>
    set((state) => ({ reactions: [...state.reactions, r].slice(-50) })),

  clearOldReactions: () =>
    set((state) => ({
      reactions: state.reactions.filter(
        (r) => Date.now() - r.timestamp < 5000
      ),
    })),

  toggleHand: (userId, raised) =>
    set((state) => {
      const next = new Set(state.raisedHands);
      raised ? next.add(userId) : next.delete(userId);
      return { raisedHands: next };
    }),

  setActivePoll: (poll) => set({ activePoll: poll }),

  addInCallMessage: (msg) =>
    set((state) => ({
      inCallMessages: [...state.inCallMessages, msg].slice(-200),
    })),

  setInCallChatOpen: (open) => set({ inCallChatOpen: open }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setShowParticipants: (show) => set({ showParticipants: show }),
  setShowSettings: (show) => set({ showSettings: show }),
  setSpeakingTimes: (times) => set({ speakingTimes: times }),
  setBgMode: (mode) => set({ bgMode: mode }),
  setPipEnabled: (enabled) => set({ pipEnabled: enabled }),

  setHold: (callId, onHold) =>
    set({ holdCallId: callId, isOnHold: onHold }),

  resetFeatures: () =>
    set({
      isOnHold: false,
      holdCallId: null,
      reactions: [],
      raisedHands: new Set(),
      activePoll: null,
      inCallMessages: [],
      inCallChatOpen: false,
      viewMode: "grid",
      showParticipants: false,
      showSettings: false,
      speakingTimes: {},
      bgMode: "none",
      pipEnabled: false,
    }),
}));

// ─── Video Quality Store ────────────────────────────────────

interface VideoQualityState {
  videoProfile: "low" | "medium" | "high" | "hd" | "fullhd" | "4k";
  setVideoProfile: (profile: VideoQualityState["videoProfile"]) => void;
  bandwidth: number;
  setBandwidth: (bps: number) => void;
  videoCodec: "vp8" | "vp9" | "h264" | "h265";
  setVideoCodec: (codec: VideoQualityState["videoCodec"]) => void;
  autoAdjust: boolean;
  setAutoAdjust: (enabled: boolean) => void;
  screenShareOptimized: boolean;
  setScreenShareOptimized: (optimized: boolean) => void;
}

export const useVideoQualityStore = create<VideoQualityState>((set) => ({
  videoProfile: "medium",
  setVideoProfile: (profile) => set({ videoProfile: profile }),
  bandwidth: 2500,
  setBandwidth: (bps) => set({ bandwidth: bps }),
  videoCodec: "vp8",
  setVideoCodec: (codec) => set({ videoCodec: codec }),
  autoAdjust: true,
  setAutoAdjust: (enabled) => set({ autoAdjust: enabled }),
  screenShareOptimized: false,
  setScreenShareOptimized: (optimized) => set({ screenShareOptimized: optimized }),
}));

// ─── Recording Store ───────────────────────────────────────

interface RecordingState {
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  isPaused: boolean;
  pauseRecording: () => void;
  resumeRecording: () => void;
  recordingDuration: number;
  setRecordingDuration: (seconds: number) => void;
  recordings: Array<{ id: string; duration: number; url: string }>;
  addRecording: (recording: RecordingState["recordings"][0]) => void;
}

export const useRecordingStore = create<RecordingState>((set) => ({
  isRecording: false,
  startRecording: () => set({ isRecording: true, recordingDuration: 0 }),
  stopRecording: () => set({ isRecording: false }),
  isPaused: false,
  pauseRecording: () => set({ isPaused: true }),
  resumeRecording: () => set({ isPaused: false }),
  recordingDuration: 0,
  setRecordingDuration: (seconds) => set({ recordingDuration: seconds }),
  recordings: [],
  addRecording: (recording) =>
    set((state) => ({ recordings: [...state.recordings, recording] })),
}));

// ─── Whiteboard Store ──────────────────────────────────────

interface WhiteboardElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  content?: any;
}

interface WhiteboardState {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  elements: WhiteboardElement[];
  addElement: (element: WhiteboardElement) => void;
  updateElement: (id: string, updates: Partial<WhiteboardElement>) => void;
  deleteElement: (id: string) => void;
  clearWhiteboard: () => void;
  selectedTool: "pen" | "eraser" | "shape" | "text" | "select";
  setSelectedTool: (tool: WhiteboardState["selectedTool"]) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

export const useWhiteboardStore = create<WhiteboardState>((set) => ({
  isOpen: false,
  setIsOpen: (open) => set({ isOpen: open }),
  elements: [],
  addElement: (element) =>
    set((state) => ({ elements: [...state.elements, element] })),
  updateElement: (id, updates) =>
    set((state) => ({
      elements: state.elements.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),
  deleteElement: (id) =>
    set((state) => ({
      elements: state.elements.filter((e) => e.id !== id),
    })),
  clearWhiteboard: () => set({ elements: [] }),
  selectedTool: "pen",
  setSelectedTool: (tool) => set({ selectedTool: tool }),
  canUndo: false,
  canRedo: false,
  undo: () => set({ canRedo: true }),
  redo: () => set({ canUndo: true }),
}));

// ─── Notifications Store ───────────────────────────────────

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: "call" | "message" | "friend_request" | "system";
  createdAt: string;
  isRead: boolean;
}

interface NotificationsState {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (notif: NotificationItem) => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
  pushEnabled: boolean;
  setPushEnabled: (enabled: boolean) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (notif) =>
    set((state) => ({
      notifications: [notif, ...state.notifications].slice(0, 100),
      unreadCount: state.unreadCount + 1,
    })),
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),
  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
  pushEnabled: true,
  setPushEnabled: (enabled) => set({ pushEnabled: enabled }),
  soundEnabled: true,
  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
}));
