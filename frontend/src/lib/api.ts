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

export default { auth, friends, chats, rooms, voice, calls };
