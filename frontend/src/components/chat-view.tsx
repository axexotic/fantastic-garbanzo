"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  Globe,
  Loader2,
  Phone,
  Send,
  Settings2,
  Users,
  Video,
} from "lucide-react";
import { chats as chatsApi, calls as callsApi } from "@/lib/api";
import type { ChatMessage, ChatPreview, UserProfile } from "@/lib/api";
import { useChatStore, useCallStore } from "@/lib/store";
import { ChatLanguageSelector } from "./chat-language-selector";
import { ActiveCallBanner } from "./active-call-banner";
import { GroupSettings } from "./group-settings";
import { useRouter } from "next/navigation";

interface ChatViewProps {
  chatId: string;
  currentUser: UserProfile;
  socket: ReturnType<typeof import("@/hooks/use-socket").useSocket>;
}

const LANG_NAMES: Record<string, string> = {
  en: "English",     th: "Thai",       es: "Spanish",
  fr: "French",      de: "German",     ja: "Japanese",
  ko: "Korean",      zh: "Chinese",    ar: "Arabic",
  pt: "Portuguese",  ru: "Russian",    hi: "Hindi",
  vi: "Vietnamese",  id: "Indonesian", tr: "Turkish",
  it: "Italian",
};

const LANG_FLAGS: Record<string, string> = {
  en: "🇬🇧", th: "🇹🇭", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪",
  ja: "🇯🇵", ko: "🇰🇷", zh: "🇨🇳", ar: "🇸🇦", pt: "🇧🇷",
  ru: "🇷🇺", hi: "🇮🇳", vi: "🇻🇳", id: "🇮🇩", tr: "🇹🇷", it: "🇮🇹",
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function getChatName(chat: ChatPreview, uid: string) {
  if (chat.chat_type === "group") return chat.name || "Group Chat";
  const other = chat.members?.find((m) => m.id !== uid);
  return other?.display_name || chat.name || "Chat";
}

function getMemberName(members: ChatPreview["members"], senderId: string) {
  const member = members?.find((m) => m.id === senderId);
  return member?.display_name || "Unknown";
}

export function ChatView({ chatId, currentUser, socket }: ChatViewProps) {
  const { chats, clearUnread } = useChatStore();
  const { activeCalls } = useCallStore();
  const chat = chats.find((c) => c.id === chatId);
  const activeCall = activeCalls.get(chatId);
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showLangSelector, setShowLangSelector] = useState(false);
  const [startingCall, setStartingCall] = useState<"voice" | "video" | null>(null);
  const [showGroupSettings, setShowGroupSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSent = useRef(0);

  const myLanguage = chat?.my_language || currentUser.preferred_language || "en";

  // Load messages
  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessages([]);

    chatsApi
      .getMessages(chatId)
      .then((msgs) => {
        if (active) {
          setMessages(msgs.reverse()); // API returns newest-first
          setLoading(false);
          setTimeout(scrollToBottom, 100);
        }
      })
      .catch(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [chatId]);

  // Join/leave chat room via WebSocket
  useEffect(() => {
    socket.joinChat(chatId);
    clearUnread(chatId);
    return () => {
      socket.leaveChat(chatId);
    };
  }, [chatId, socket, clearUnread]);

  // Listen for incoming messages
  useEffect(() => {
    const unsub = socket.on("new_message", (data: any) => {
      if (data.chat_id === chatId) {
        const msg: ChatMessage = {
          id: data.message_id || data.id,
          chat_id: data.chat_id,
          sender_id: data.sender_id,
          content: data.content,
          translated_content: data.translated_content || "",
          source_language: data.source_language || "",
          translations: data.translations || {},
          message_type: data.message_type || "text",
          reply_to_id: data.reply_to_id || null,
          is_edited: false,
          created_at: data.created_at || new Date().toISOString(),
        };
        setMessages((prev) => [...prev, msg]);
        // Auto-scroll if near bottom
        if (containerRef.current) {
          const { scrollTop, scrollHeight, clientHeight } =
            containerRef.current;
          if (scrollHeight - scrollTop - clientHeight < 150) {
            setTimeout(scrollToBottom, 50);
          }
        }
      }
    });
    return unsub;
  }, [chatId, socket]);

  // Typing indicators
  useEffect(() => {
    const unsub = socket.on("typing", (data: any) => {
      if (data.chat_id === chatId && data.user_id !== currentUser.id) {
        setTypingUsers((prev) => new Set(prev).add(data.user_id));
        // Clear after 3 seconds
        setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(data.user_id);
            return next;
          });
        }, 3000);
      }
    });
    return unsub;
  }, [chatId, socket, currentUser.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 200);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setSending(true);
    try {
      await chatsApi.sendMessage(chatId, text);
      // Message will arrive via WebSocket
    } catch (err) {
      console.error("Send failed:", err);
      setInput(text); // Restore on failure
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    // Throttle typing indicator to 2s
    const now = Date.now();
    if (now - lastTypingSent.current > 2000) {
      socket.sendTyping(chatId);
      lastTypingSent.current = now;
    }
  };

  const handleStartCall = async (callType: "voice" | "video") => {
    setStartingCall(callType);
    try {
      const call = await callsApi.start(chatId, callType);
      const isGroup = chat?.chat_type === "group";
      const name = encodeURIComponent(chatName);
      router.push(`/call/${call.room_name}?callId=${call.id}&type=${callType}&chatName=${name}&group=${isGroup}`);
    } catch (err: any) {
      console.error("Failed to start call:", err);
      alert(err.message || "Failed to start call");
    } finally {
      setStartingCall(null);
    }
  };

  const toggleOriginal = (msgId: string) => {
    setShowOriginal((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const getDisplayContent = (msg: ChatMessage) => {
    // If from current user, show original
    if (msg.sender_id === currentUser.id) return msg.content;
    // Show translated version in user's language
    if (msg.translations && msg.translations[myLanguage]) {
      return msg.translations[myLanguage];
    }
    if (msg.translated_content) return msg.translated_content;
    return msg.content;
  };

  const isTranslated = (msg: ChatMessage) => {
    if (msg.sender_id === currentUser.id) return false;
    return (
      (msg.translations && msg.translations[myLanguage] && msg.source_language !== myLanguage) ||
      (msg.translated_content && msg.source_language !== myLanguage)
    );
  };

  // Group messages by date
  const groupedMessages: { date: string; msgs: ChatMessage[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const date = new Date(msg.created_at).toDateString();
    if (date !== currentDate) {
      currentDate = date;
      groupedMessages.push({ date: msg.created_at, msgs: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].msgs.push(msg);
    }
  }

  if (!chat) return null;

  const chatName = getChatName(chat, currentUser.id);
  const otherMembers = chat.members?.filter((m) => m.id !== currentUser.id) || [];

  return (
    <div className="flex h-full flex-col">
      {/* ─── Chat Header ─── */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-medium">
            {chat.chat_type === "group" ? (
              <Users className="h-5 w-5 text-muted-foreground" />
            ) : (
              chatName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold">{chatName}</h2>
            <p className="text-xs text-muted-foreground">
              {chat.chat_type === "group"
                ? `${chat.members?.length || 0} members`
                : otherMembers[0]
                  ? `Speaks ${LANG_NAMES[otherMembers[0].preferred_language] || otherMembers[0].preferred_language}`
                  : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowLangSelector(!showLangSelector)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title={`Receiving in: ${LANG_NAMES[myLanguage] || myLanguage}`}
          >
            <Globe className="h-5 w-5" />
            <span className="sr-only">Language</span>
          </button>
          <button 
            onClick={() => handleStartCall("voice")}
            disabled={!!startingCall}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50" 
            title="Voice call"
          >
            {startingCall === "voice" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Phone className="h-5 w-5" />
            )}
          </button>
          <button 
            onClick={() => handleStartCall("video")}
            disabled={!!startingCall}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50" 
            title="Video call"
          >
            {startingCall === "video" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Video className="h-5 w-5" />
            )}
          </button>
          {chat.chat_type === "group" && (
            <button
              onClick={() => setShowGroupSettings(true)}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="Group settings"
            >
              <Settings2 className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Language Selector Dropdown */}
      {showLangSelector && (
        <ChatLanguageSelector
          chatId={chatId}
          currentLanguage={myLanguage}
          onClose={() => setShowLangSelector(false)}
        />
      )}

      {/* Active Call Banner */}
      {activeCall && (
        <ActiveCallBanner call={activeCall} />
      )}

      {/* ─── Messages ─── */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto px-5 py-4"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Globe className="h-10 w-10 text-primary/30" />
            <p>No messages yet — say hello!</p>
            <p className="text-xs">
              Messages will be auto-translated to each person&apos;s language
            </p>
          </div>
        ) : (
          <>
            {groupedMessages.map((group, gi) => (
              <div key={gi}>
                {/* Date Separator */}
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">
                    {formatDate(group.date)}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Messages */}
                {group.msgs.map((msg) => {
                  const isMine = msg.sender_id === currentUser.id;
                  const translated = isTranslated(msg);
                  const displayContent = getDisplayContent(msg);
                  const showingOriginal = showOriginal[msg.id];

                  return (
                    <div
                      key={msg.id}
                      className={`mb-3 flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          isMine
                            ? "rounded-br-md bg-primary text-primary-foreground"
                            : "rounded-bl-md bg-secondary"
                        }`}
                      >
                        {/* Sender name in groups */}
                        {!isMine && chat.chat_type === "group" && (
                          <p className="mb-1 text-xs font-semibold text-primary">
                            {getMemberName(chat.members, msg.sender_id)}
                          </p>
                        )}

                        {/* Message Content */}
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {showingOriginal ? msg.content : displayContent}
                        </p>

                        {/* Translation indicator */}
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5">
                            {translated && (
                              <button
                                onClick={() => toggleOriginal(msg.id)}
                                className={`text-[10px] transition-colors ${
                                  isMine
                                    ? "text-primary-foreground/60 hover:text-primary-foreground/80"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {showingOriginal ? (
                                  <>Show translated</>
                                ) : (
                                  <>
                                    {LANG_FLAGS[msg.source_language] || "🌐"}{" "}
                                    Show original
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                          <span
                            className={`text-[10px] ${
                              isMine
                                ? "text-primary-foreground/50"
                                : "text-muted-foreground"
                            }`}
                          >
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 rounded-full bg-secondary p-2 shadow-lg transition-colors hover:bg-secondary/80"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Typing Indicator */}
      {typingUsers.size > 0 && (
        <div className="px-5 py-1 text-xs text-muted-foreground">
          {Array.from(typingUsers)
            .map((uid) => getMemberName(chat.members, uid))
            .join(", ")}{" "}
          {typingUsers.size === 1 ? "is" : "are"} typing...
        </div>
      )}

      {/* ─── Message Input ─── */}
      <div className="border-t border-border px-5 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-3"
        >
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              rows={1}
              className="w-full resize-none rounded-xl bg-secondary/50 px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:bg-secondary"
              style={{ maxHeight: "120px" }}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
          Auto-translating to {LANG_FLAGS[myLanguage]}{" "}
          {LANG_NAMES[myLanguage] || myLanguage}
        </p>
      </div>

      {/* Group Settings Modal */}
      {showGroupSettings && chat.chat_type === "group" && (
        <GroupSettings
          chat={chat}
          currentUserId={currentUser.id}
          onClose={() => setShowGroupSettings(false)}
          onUpdated={() => {
            setShowGroupSettings(false);
          }}
          onLeft={() => {
            setShowGroupSettings(false);
          }}
        />
      )}
    </div>
  );
}
