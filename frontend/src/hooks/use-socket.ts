/**
 * WebSocket hook for real-time chat, presence, and notifications.
 *
 * Uses refs for state-dependent values so the connect callback
 * only changes when the token changes, preventing reconnect loops.
 */

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAuthStore } from "@/lib/store";
import { useChatStore, useFriendsStore } from "@/lib/store";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

type MessageHandler = (msg: any) => void;

export function useSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const token = useAuthStore((s) => s.token);
  const incrementUnread = useChatStore((s) => s.incrementUnread);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const updateFriendStatus = useFriendsStore((s) => s.updateFriendStatus);

  // Keep latest values in refs so connect() callback stays stable
  const activeChatIdRef = useRef(activeChatId);
  const incrementUnreadRef = useRef(incrementUnread);
  const updateFriendStatusRef = useRef(updateFriendStatus);

  useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);
  useEffect(() => { incrementUnreadRef.current = incrementUnread; }, [incrementUnread]);
  useEffect(() => { updateFriendStatusRef.current = updateFriendStatus; }, [updateFriendStatus]);

  const connect = useCallback(() => {
    if (!token) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_URL}/ws/${token}`);

    ws.onopen = () => {
      console.log("🔌 WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const type = msg.type;

        // Built-in handlers — read from refs to avoid stale closures
        if (type === "presence") {
          updateFriendStatusRef.current(msg.data.user_id, msg.data.status);
        }

        if (type === "new_message") {
          // If not viewing this chat, increment unread
          if (msg.data.chat_id !== activeChatIdRef.current) {
            incrementUnreadRef.current(msg.data.chat_id);
          }
        }

        // Dispatch to registered handlers
        const handlers = handlersRef.current.get(type);
        if (handlers) {
          handlers.forEach((handler) => handler(msg.data));
        }

        // Wildcard handlers
        const wildcardHandlers = handlersRef.current.get("*");
        if (wildcardHandlers) {
          wildcardHandlers.forEach((handler) => handler(msg));
        }
      } catch (e) {
        console.error("WebSocket message parse error:", e);
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      console.log("🔌 WebSocket disconnected, reconnecting in 3s...");
      reconnectRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    wsRef.current = ws;
  }, [token]); // only reconnect when token changes

  const disconnect = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent reconnect on intentional close
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Auto-connect on mount, reconnect on token change
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // ─── Messaging ─────────────────────────

  const sendMessage = useCallback(
    (chatId: string, content: string, messageType = "text", replyToId?: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "message",
            chat_id: chatId,
            content,
            message_type: messageType,
            reply_to_id: replyToId,
          })
        );
      }
    },
    []
  );

  const joinChat = useCallback((chatId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "join_chat", chat_id: chatId }));
    }
  }, []);

  const leaveChat = useCallback((chatId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "leave_chat", chat_id: chatId }));
    }
  }, []);

  const sendTyping = useCallback((chatId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing", chat_id: chatId }));
    }
  }, []);

  // ─── Event Subscription ────────────────

  const on = useCallback((type: string, handler: MessageHandler) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      handlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  return {
    sendMessage,
    joinChat,
    leaveChat,
    sendTyping,
    on,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
}
