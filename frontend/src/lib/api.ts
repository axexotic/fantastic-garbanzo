/**
 * API client — typed fetch wrapper for the backend.
 */

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(body.detail || res.statusText, res.status);
  }

  return res.json();
}

// ─── Auth ──────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url: string;
  preferred_language: string;
  status: string;
  bio: string;
}

export const auth = {
  signup: (data: {
    email: string;
    username: string;
    display_name: string;
    password: string;
    preferred_language?: string;
  }) => request<AuthResponse>("/api/auth/signup", { method: "POST", body: JSON.stringify(data) }),

  login: (data: { login: string; password: string }) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),

  me: () => request<UserProfile>("/api/auth/me"),

  updateProfile: (data: Partial<UserProfile>) =>
    request<UserProfile>("/api/auth/me", { method: "PATCH", body: JSON.stringify(data) }),
};

// ─── Friends ───────────────────────────────────────────────

export interface FriendBrief {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  preferred_language: string;
  status: string;
}

export interface IncomingRequest {
  id: string;
  sender: FriendBrief;
  message: string;
  created_at: string;
}

export const friends = {
  list: () => request<FriendBrief[]>("/api/friends/"),

  search: (q: string) => request<FriendBrief[]>(`/api/friends/search?q=${encodeURIComponent(q)}`),

  sendRequest: (username: string, message?: string) =>
    request("/api/friends/request", {
      method: "POST",
      body: JSON.stringify({ username, message: message || "" }),
    }),

  incomingRequests: () => request<IncomingRequest[]>("/api/friends/requests/incoming"),

  outgoingRequests: () => request<any[]>("/api/friends/requests/outgoing"),

  acceptRequest: (requestId: string) =>
    request(`/api/friends/request/${requestId}/accept`, { method: "POST" }),

  rejectRequest: (requestId: string) =>
    request(`/api/friends/request/${requestId}/reject`, { method: "POST" }),

  unfriend: (friendId: string) =>
    request(`/api/friends/${friendId}`, { method: "DELETE" }),
};

// ─── Chats ─────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  translated_content: string;
  source_language: string;
  translations: Record<string, string>;
  message_type: string;
  reply_to_id: string | null;
  is_edited: boolean;
  created_at: string;
}

export interface ChatMember {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  preferred_language: string;
  status: string;
  language: string;
  role: string;
}

export interface ChatPreview {
  id: string;
  chat_type: "dm" | "group";
  name: string;
  avatar_url: string;
  my_language: string;
  members: ChatMember[];
  last_message: ChatMessage | null;
  unread_count: number;
  updated_at: string;
}

export const chats = {
  list: () => request<ChatPreview[]>("/api/chats/"),

  createDM: (friendId: string) =>
    request<{ chat_id: string; existing: boolean }>("/api/chats/dm", {
      method: "POST",
      body: JSON.stringify({ friend_id: friendId }),
    }),

  createGroup: (name: string, memberIds: string[]) =>
    request<{ chat_id: string; name: string }>("/api/chats/group", {
      method: "POST",
      body: JSON.stringify({ name, member_ids: memberIds }),
    }),

  getMessages: (chatId: string, limit = 50, before?: string) => {
    let url = `/api/chats/${chatId}/messages?limit=${limit}`;
    if (before) url += `&before=${before}`;
    return request<ChatMessage[]>(url);
  },

  sendMessage: (chatId: string, content: string, messageType = "text", replyToId?: string) =>
    request<ChatMessage>(`/api/chats/${chatId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, message_type: messageType, reply_to_id: replyToId }),
    }),

  setLanguage: (chatId: string, language: string) =>
    request(`/api/chats/${chatId}/language`, {
      method: "PATCH",
      body: JSON.stringify({ language }),
    }),

  addMembers: (chatId: string, userIds: string[]) =>
    request(`/api/chats/${chatId}/members`, {
      method: "POST",
      body: JSON.stringify({ user_ids: userIds }),
    }),

  removeMember: (chatId: string, userId: string) =>
    request(`/api/chats/${chatId}/members/${userId}`, { method: "DELETE" }),

  updateGroup: (chatId: string, data: { name?: string; avatar_url?: string }) =>
    request(`/api/chats/${chatId}`, { method: "PATCH", body: JSON.stringify(data) }),

  leaveGroup: (chatId: string) =>
    request(`/api/chats/${chatId}/leave`, { method: "POST" }),

  transferAdmin: (chatId: string, userId: string) =>
    request(`/api/chats/${chatId}/transfer-admin`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    }),

  searchMessages: (query: string, limit = 30) =>
    request<{ results: ChatMessage[]; total: number }>(
      `/api/chats/search/messages?q=${encodeURIComponent(query)}&limit=${limit}`
    ),
};

// ─── Rooms (WebRTC) ────────────────────────────────────────

export const rooms = {
  create: (data?: { name?: string; max_participants?: number }) =>
    request<{ room_name: string; room_url: string; token: string }>("/api/rooms/create", {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),

  getToken: (roomName: string) =>
    request<{ token: string }>(`/api/rooms/${roomName}/token`, { method: "POST" }),
};

// ─── Voice Profile ─────────────────────────────────────────

export interface VoiceProfile {
  user_id: string;
  voice_id: string;
  status: "active" | "processing" | "failed";
  created_at?: string;
}

export const voice = {
  getProfile: () =>
    request<VoiceProfile>("/api/voice/profile"),

  cloneVoice: async (audioBlob: Blob): Promise<VoiceProfile> => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const formData = new FormData();
    formData.append("audio_file", audioBlob, "voice_sample.wav");

    const res = await fetch(`${API_URL}/api/voice/clone`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new ApiError(body.detail || res.statusText, res.status);
    }

    return res.json();
  },

  deleteProfile: () =>
    request<{ success: boolean }>("/api/voice/profile", { method: "DELETE" }),
};

// ─── Calls ─────────────────────────────────────────────────

export interface CallInfo {
  id: string;
  chat_id: string;
  room_name: string;
  room_url: string;
  token: string;
  call_type: "voice" | "video";
  status: string;
  initiated_by: string;
}

export const calls = {
  start: (chatId: string, callType: "voice" | "video" = "voice") =>
    request<CallInfo>("/api/calls/start", {
      method: "POST",
      body: JSON.stringify({ chat_id: chatId, call_type: callType }),
    }),

  join: (callId: string) =>
    request<{ token: string; server_url: string; room_name: string }>(`/api/calls/${callId}/join`, {
      method: "POST",
    }),

  end: (callId: string) =>
    request(`/api/calls/${callId}/end`, { method: "POST" }),

  leave: (callId: string) =>
    request<{ success: boolean; remaining_participants: number }>(`/api/calls/${callId}/leave`, {
      method: "POST",
    }),

  decline: (callId: string) =>
    request(`/api/calls/${callId}/decline`, { method: "POST" }),

  getActive: (chatId: string) =>
    request<CallInfo | null>(`/api/calls/active/${chatId}`),

  getParticipants: (callId: string) =>
    request<{
      participants: Array<{
        user_id: string;
        display_name: string;
        username: string;
        language: string;
        status: string;
        joined_at: string | null;
      }>;
      total: number;
      active: number;
    }>(`/api/calls/${callId}/participants`),

  list: () =>
    request<{ calls: CallInfo[]; total: number }>("/api/calls/"),
};

// ─── Payments ──────────────────────────────────────────────

export interface SubscriptionInfo {
  plan: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export const payments = {
  getSubscription: () =>
    request<SubscriptionInfo>("/api/payments/subscription"),

  createCheckout: (priceId?: string) =>
    request<{ checkout_url: string }>("/api/payments/checkout", {
      method: "POST",
      body: JSON.stringify({ price_id: priceId }),
    }),

  openPortal: () =>
    request<{ portal_url: string }>("/api/payments/portal", { method: "POST" }),
};

// ─── Admin ─────────────────────────────────────────────────

export interface AdminStats {
  total_users: number;
  active_users_24h: number;
  total_chats: number;
  total_messages: number;
  total_calls: number;
  total_translations: number;
  avg_translation_latency_ms: number | null;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  display_name: string;
  preferred_language: string;
  status: string;
  is_active: boolean;
  created_at: string;
  last_seen_at: string | null;
}

export const admin = {
  stats: () => request<AdminStats>("/api/admin/stats"),

  users: (skip = 0, limit = 50, search = "") =>
    request<AdminUser[]>(
      `/api/admin/users?skip=${skip}&limit=${limit}&search=${encodeURIComponent(search)}`
    ),

  toggleUserActive: (userId: string) =>
    request<{ id: string; is_active: boolean }>(`/api/admin/users/${userId}/toggle-active`, {
      method: "PATCH",
    }),

  translationLogs: (skip = 0, limit = 50) =>
    request<any[]>(`/api/admin/translation-logs?skip=${skip}&limit=${limit}`),

  languageAnalytics: () => request<any[]>("/api/admin/analytics/languages"),
};

// ─── AI Analysis ───────────────────────────────────────────

export const ai = {
  summarizeCall: (callId: string) =>
    request<any>(`/api/ai/calls/${callId}/summarize`, { method: "POST" }),

  callSentiment: (callId: string) =>
    request<any>(`/api/ai/calls/${callId}/sentiment`, { method: "POST" }),

  callEntities: (callId: string) =>
    request<any>(`/api/ai/calls/${callId}/entities`, { method: "POST" }),

  callActionItems: (callId: string) =>
    request<any>(`/api/ai/calls/${callId}/action-items`, { method: "POST" }),

  fullCallAnalysis: (callId: string) =>
    request<any>(`/api/ai/calls/${callId}/full-analysis`, { method: "POST" }),

  summarizeChat: (chatId: string) =>
    request<any>(`/api/ai/chats/${chatId}/summarize`, { method: "POST" }),

  chatSentiment: (chatId: string) =>
    request<any>(`/api/ai/chats/${chatId}/sentiment`, { method: "POST" }),

  analyzeText: (text: string) =>
    request<any>("/api/ai/analyze/summarize", { method: "POST", body: JSON.stringify({ text }) }),
};

// ─── Notifications ─────────────────────────────────────────

export interface NotificationPrefs {
  email_messages: boolean;
  email_calls: boolean;
  email_friend_requests: boolean;
  push_messages: boolean;
  push_calls: boolean;
  push_friend_requests: boolean;
  sound_enabled: boolean;
  dnd_enabled: boolean;
  dnd_start: string;
  dnd_end: string;
}

export const notifications = {
  getPrefs: () => request<NotificationPrefs>("/api/notifications/"),

  updatePrefs: (data: Partial<NotificationPrefs>) =>
    request<NotificationPrefs>("/api/notifications/", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// ─── Integrations ──────────────────────────────────────────

export interface WebhookInfo {
  id: string;
  name: string;
  provider: string;
  webhook_url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export const integrations = {
  listWebhooks: () => request<WebhookInfo[]>("/api/integrations/webhooks"),

  createWebhook: (data: { name: string; provider: string; webhook_url: string; events?: string[] }) =>
    request<WebhookInfo>("/api/integrations/webhooks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateWebhook: (id: string, data: Partial<WebhookInfo>) =>
    request("/api/integrations/webhooks/" + id, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteWebhook: (id: string) =>
    request(`/api/integrations/webhooks/${id}`, { method: "DELETE" }),

  testWebhook: (id: string) =>
    request<{ success: boolean }>(`/api/integrations/webhooks/${id}/test`, { method: "POST" }),

  calendarEvents: () => request<{ events: any[]; total: number }>("/api/integrations/calendar/upcoming-calls"),
};

// ─── Password Reset ────────────────────────────────────────

export const passwordReset = {
  forgotPassword: (email: string) =>
    request<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, new_password: string) =>
    request<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password }),
    }),
};

// ─── Chat Extras ───────────────────────────────────────────

export const chatExtras = {
  markRead: (chatId: string) =>
    request(`/api/chats/${chatId}/read`, { method: "POST" }),

  exportTranscript: (chatId: string, format: "json" | "txt" | "csv" = "json") =>
    request<any>(`/api/chats/${chatId}/export?format=${format}`),
};

export default { auth, friends, chats, rooms, voice, calls, payments, admin, ai, notifications, integrations };
