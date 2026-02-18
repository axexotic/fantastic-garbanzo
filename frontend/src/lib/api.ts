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

// ─── Call Features ─────────────────────────────────────────

export interface PollData {
  id: string;
  question: string;
  options: string[];
  votes: Record<string, string[]>;
  created_by: string;
  created_at: string;
}

export const callFeatures = {
  // Hold / Resume / Transfer
  hold: (callId: string) =>
    request("/api/calls/features/hold", { method: "POST", body: JSON.stringify({ call_id: callId }) }),
  resume: (callId: string) =>
    request("/api/calls/features/resume", { method: "POST", body: JSON.stringify({ call_id: callId }) }),
  transfer: (callId: string, targetUserId: string) =>
    request("/api/calls/features/transfer", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, target_user_id: targetUserId }),
    }),

  // Lock / Unlock
  lock: (callId: string, pin: string) =>
    request("/api/calls/features/lock", { method: "POST", body: JSON.stringify({ call_id: callId, pin }) }),
  unlock: (callId: string) =>
    request("/api/calls/features/unlock", { method: "POST", body: JSON.stringify({ call_id: callId }) }),
  verifyLock: (callId: string, pin: string) =>
    request("/api/calls/features/verify-lock", { method: "POST", body: JSON.stringify({ call_id: callId, pin }) }),

  // Reactions & Raise Hand
  sendReaction: (callId: string, emoji: string) =>
    request("/api/calls/features/reaction", { method: "POST", body: JSON.stringify({ call_id: callId, emoji }) }),
  raiseHand: (callId: string) =>
    request("/api/calls/features/raise-hand", { method: "POST", body: JSON.stringify({ call_id: callId }) }),
  lowerHand: (callId: string) =>
    request("/api/calls/features/lower-hand", { method: "POST", body: JSON.stringify({ call_id: callId }) }),

  // Polls
  createPoll: (callId: string, question: string, options: string[]) =>
    request<PollData>("/api/calls/features/poll/create", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, question, options }),
    }),
  votePoll: (callId: string, pollId: string, optionIndex: number) =>
    request("/api/calls/features/poll/vote", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, poll_id: pollId, option_index: optionIndex }),
    }),

  // Speaking time & Engagement
  reportSpeaking: (callId: string, durationSeconds: number) =>
    request("/api/calls/features/speaking", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, duration_seconds: durationSeconds }),
    }),
  getSpeakingTime: (callId: string) =>
    request<Record<string, number>>(`/api/calls/features/${callId}/speaking-time`),
  getEngagement: (callId: string) =>
    request<any>(`/api/calls/features/${callId}/engagement`),

  // Whiteboard / File share / In-call chat
  whiteboard: (callId: string, action: string, data?: any) =>
    request("/api/calls/features/whiteboard", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, action, data: data || {} }),
    }),
  shareFile: (callId: string, fileName: string, fileUrl: string, fileSize: number) =>
    request("/api/calls/features/share-file", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, file_name: fileName, file_url: fileUrl, file_size: fileSize }),
    }),
  sendInCallChat: (callId: string, message: string) =>
    request("/api/calls/features/in-call-chat", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, message }),
    }),

  // AI features
  getAudioConfig: () => request<any>("/api/calls/features/ai/audio-config"),
  getVideoConfig: () => request<any>("/api/calls/features/ai/video-config"),
  detectTone: (text: string) =>
    request<any>("/api/calls/features/ai/detect-tone", { method: "POST", body: JSON.stringify({ text }) }),
  generateMeetingNotes: (callId: string, transcript: string[]) =>
    request<any>("/api/calls/features/ai/meeting-notes", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, transcript }),
    }),
  getAiSuggestion: (context: string) =>
    request<any>("/api/calls/features/ai/suggestion", { method: "POST", body: JSON.stringify({ context }) }),
  detectInterrupt: (events: any[]) =>
    request<any>("/api/calls/features/ai/interrupt-detect", { method: "POST", body: JSON.stringify({ events }) }),
  moderate: (messages: string[]) =>
    request<any>("/api/calls/features/ai/moderate", { method: "POST", body: JSON.stringify({ messages }) }),
  stressAnalysis: (audioFeatures: any) =>
    request<any>("/api/calls/features/ai/stress-analysis", { method: "POST", body: JSON.stringify({ audio_features: audioFeatures }) }),
  getVoiceStyles: () => request<any>("/api/calls/features/ai/voice-styles"),
  digitalTwin: (personality: string, question: string) =>
    request<any>("/api/calls/features/ai/digital-twin", {
      method: "POST",
      body: JSON.stringify({ personality, question }),
    }),

  // Roles & Permissions
  setRole: (callId: string, targetUserId: string, role: string) =>
    request("/api/calls/features/role", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, target_user_id: targetUserId, role }),
    }),
  getPermissions: (callId: string) =>
    request<any>(`/api/calls/features/${callId}/permissions`),
};

// ─── Security ──────────────────────────────────────────────

export const security = {
  // 2FA
  setup2FA: () => request<{ secret: string; totp_uri: string; backup_codes: string[] }>("/api/security/2fa/setup", { method: "POST" }),
  verify2FA: (code: string) =>
    request<{ enabled: boolean }>("/api/security/2fa/verify", { method: "POST", body: JSON.stringify({ code }) }),
  validate2FA: (code: string) =>
    request<{ valid: boolean }>("/api/security/2fa/validate", { method: "POST", body: JSON.stringify({ code }) }),
  disable2FA: () => request("/api/security/2fa", { method: "DELETE" }),
  get2FAStatus: () => request<{ enabled: boolean }>("/api/security/2fa/status"),

  // Devices
  registerDevice: (fingerprint: string, name: string, browser: string, os: string) =>
    request("/api/security/devices/register", {
      method: "POST",
      body: JSON.stringify({ fingerprint, name, browser, os }),
    }),
  listDevices: () => request<{ devices: any[] }>("/api/security/devices"),
  trustDevice: (deviceId: string) =>
    request("/api/security/devices/trust", { method: "POST", body: JSON.stringify({ device_id: deviceId }) }),
  revokeDevice: (deviceId: string) =>
    request(`/api/security/devices/${deviceId}`, { method: "DELETE" }),

  // E2E encryption
  storePublicKey: (publicKey: string) =>
    request("/api/security/e2e/public-key", { method: "POST", body: JSON.stringify({ public_key: publicKey }) }),
  getPublicKey: (userId: string) =>
    request<{ user_id: string; public_key: string }>(`/api/security/e2e/public-key/${userId}`),

  // Status
  updateStatus: (status: string) =>
    request<{ status: string }>("/api/security/status", { method: "PATCH", body: JSON.stringify({ status }) }),

  // Favorites
  addFavorite: (friendId: string) =>
    request<{ favorites: string[] }>(`/api/security/favorites/${friendId}`, { method: "POST" }),
  removeFavorite: (friendId: string) =>
    request<{ favorites: string[] }>(`/api/security/favorites/${friendId}`, { method: "DELETE" }),
  getFavorites: () => request<{ favorites: string[] }>("/api/security/favorites"),

  // Contact groups
  createContactGroup: (name: string, memberIds: string[] = []) =>
    request("/api/security/contact-groups", { method: "POST", body: JSON.stringify({ name, member_ids: memberIds }) }),
  listContactGroups: () => request<{ groups: any[] }>("/api/security/contact-groups"),
  deleteContactGroup: (groupId: string) =>
    request(`/api/security/contact-groups/${groupId}`, { method: "DELETE" }),
};

// ─── Analytics ─────────────────────────────────────────────

export const analytics = {
  callSummary: (days = 30) =>
    request<any>(`/api/analytics/calls/summary?days=${days}`),
  callHistory: (page = 1, perPage = 20, callType?: string) => {
    let url = `/api/analytics/calls/history?page=${page}&per_page=${perPage}`;
    if (callType) url += `&call_type=${callType}`;
    return request<any>(url);
  },
  messageSummary: (days = 30) =>
    request<any>(`/api/analytics/messages/summary?days=${days}`),
  engagement: () => request<any>("/api/analytics/engagement"),
  translationUsage: () => request<any>("/api/analytics/translation/usage"),
};

// ─── Video Quality ────────────────────────────────────────

export const video = {
  // Profile management
  setProfile: (callId: string, profile: "low" | "medium" | "high" | "hd" | "fullhd" | "4k") =>
    request("/api/video/profile/set", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, profile }),
    }),
  getProfile: (callId: string) =>
    request<any>(`/api/video/${callId}/profile`),
  
  // Bandwidth detection
  detectBandwidth: (callId: string) =>
    request<any>("/api/video/bandwidth/detect", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, user_id: "" }),
    }),
  reportBandwidth: (callId: string, bitrateKbps: number) =>
    request("/api/video/bandwidth/report", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, bitrate_kbps: bitrateKbps }),
    }),
  
  // Codec selection
  setCodec: (callId: string, codec: "vp8" | "vp9" | "h264" | "h265") =>
    request("/api/video/codec/set", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, codec }),
    }),
  getCodec: (callId: string) =>
    request<any>(`/api/video/${callId}/codec`),
  getCodecSupport: (callId: string) =>
    request<any>(`/api/video/${callId}/codec/support`),
  
  // Screen share
  optimizeScreenShare: (callId: string) =>
    request("/api/video/screen-share/optimize", {
      method: "POST",
      body: JSON.stringify({ call_id: callId }),
    }),
  getScreenShareStatus: (callId: string) =>
    request<any>(`/api/video/${callId}/screen-share/status`),
  
  // Statistics
  getStats: (callId: string, userId: string) =>
    request<any>(`/api/video/${callId}/user/${userId}/stats`),
  requestKeyframe: (callId: string, userId: string) =>
    request(`/api/video/${callId}/user/${userId}/keyframe`, { method: "POST" }),
  
  // Auto-adjust
  enableAutoAdjust: (callId: string, enabled: boolean) =>
    request(`/api/video/${callId}/auto-adjust`, {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }),
  
  // Advanced settings
  updateSettings: (callId: string, maxWidth: number, maxHeight: number, maxFramerate: number) =>
    request(`/api/video/${callId}/settings/update`, {
      method: "POST",
      body: JSON.stringify({ max_width: maxWidth, max_height: maxHeight, max_framerate: maxFramerate }),
    }),
  toggleMirror: (callId: string, enabled: boolean) =>
    request(`/api/video/${callId}/mirror`, { method: "POST", body: JSON.stringify({ enabled }) }),
  setBackgroundBlur: (callId: string, strength: number) =>
    request(`/api/video/${callId}/blur-background`, {
      method: "POST",
      body: JSON.stringify({ strength }),
    }),
};

// ─── Recording ────────────────────────────────────────────

export const recording = {
  start: (callId: string, format: "webm" | "mp4" | "wav" | "m4a" = "webm") =>
    request("/api/recording/start", { method: "POST", body: JSON.stringify({ call_id: callId, format }) }),
  stop: (callId: string) =>
    request(`/api/recording/${callId}/stop`, { method: "POST" }),
  getStatus: (callId: string) =>
    request<any>(`/api/recording/${callId}/status`),
  pause: (callId: string) =>
    request(`/api/recording/${callId}/pause`, { method: "POST" }),
  resume: (callId: string) =>
    request(`/api/recording/${callId}/resume`, { method: "POST" }),
  
  // Management
  listRecordings: (skip?: number, limit?: number) =>
    request<any>(`/api/recording/list?skip=${skip || 0}&limit=${limit || 50}`),
  getRecording: (callId: string) =>
    request<any>(`/api/recording/${callId}`),
  deleteRecording: (callId: string) =>
    request(`/api/recording/${callId}`, { method: "DELETE" }),
  getDownloadUrl: (callId: string, expiryHours?: number) =>
    request<any>(`/api/recording/${callId}/download-url?expiry_hours=${expiryHours || 24}`),
  getMetadata: (callId: string) =>
    request<any>(`/api/recording/${callId}/metadata`),
  
  // Transcription
  transcribe: (callId: string, language?: string) =>
    request("/api/recording/transcribe", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, language: language || "en" }),
    }),
  getTranscription: (callId: string) =>
    request<any>(`/api/recording/${callId}/transcription`),
  getTranscriptionStatus: (callId: string) =>
    request<any>(`/api/recording/${callId}/transcription/status`),
  exportTranscription: (callId: string, format?: string) =>
    request(`/api/recording/${callId}/transcription/export`, {
      method: "POST",
      body: JSON.stringify({ format: format || "srt" }),
    }),
};

// ─── Whiteboard ────────────────────────────────────────────

export const whiteboard = {
  create: (callId: string) =>
    request("/api/whiteboard/create", { method: "POST", body: JSON.stringify({ call_id: callId }) }),
  get: (callId: string) =>
    request<any>(`/api/whiteboard/${callId}`),
  
  // Elements
  addElement: (callId: string, type: string, content: any, x: number, y: number, width?: number, height?: number) =>
    request("/api/whiteboard/element/add", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, type, content, x, y, width: width || 100, height: height || 100 }),
    }),
  updateElement: (callId: string, elementId: string, updates: any) =>
    request("/api/whiteboard/element/update", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, element_id: elementId, updates }),
    }),
  deleteElement: (callId: string, elementId: string) =>
    request(`/api/whiteboard/${callId}/element/${elementId}`, { method: "DELETE" }),
  
  // Operations
  clear: (callId: string) =>
    request(`/api/whiteboard/${callId}/clear`, { method: "POST" }),
  undo: (callId: string) =>
    request(`/api/whiteboard/${callId}/undo`, { method: "POST" }),
  redo: (callId: string) =>
    request(`/api/whiteboard/${callId}/redo`, { method: "POST" }),
  
  // Export
  export: (callId: string, format?: string) =>
    request(`/api/whiteboard/${callId}/export`, {
      method: "POST",
      body: JSON.stringify({ format: format || "json" }),
    }),
  getDownloadUrl: (callId: string, format?: string) =>
    request<any>(`/api/whiteboard/${callId}/export/download?format=${format || "json"}`),
  
  // Collaboration
  getCollaborators: (callId: string) =>
    request<any>(`/api/whiteboard/${callId}/collaborators`),
  updateCursor: (callId: string, x: number, y: number) =>
    request(`/api/whiteboard/${callId}/cursor`, { method: "POST", body: JSON.stringify({ x, y }) }),
  
  // Tools
  penTool: (callId: string, color?: string, width?: number) =>
    request("/api/whiteboard/tool/pen", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, color: color || "#000000", width: width || 2 }),
    }),
  eraserTool: (callId: string, size?: number) =>
    request("/api/whiteboard/tool/eraser", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, size: size || 10 }),
    }),
  shapeTool: (callId: string, shapeType?: string) =>
    request("/api/whiteboard/tool/shape", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, shape_type: shapeType || "rectangle" }),
    }),
  textTool: (callId: string, fontSize?: number) =>
    request("/api/whiteboard/tool/text", {
      method: "POST",
      body: JSON.stringify({ call_id: callId, font_size: fontSize || 14 }),
    }),
  selectionTool: (callId: string) =>
    request(`/api/whiteboard/${callId}/selection`, { method: "POST" }),
};

export default {
  auth, friends, chats, rooms, voice, calls, payments, admin, ai,
  notifications, integrations, callFeatures, security, analytics, video, recording, whiteboard,
};
