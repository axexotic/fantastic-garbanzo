/**
 * WebSocket hook for real-time chat, presence, and notifications.
 *
 * Uses refs for state-dependent values so the connect callback
 * stays stable, preventing reconnect loops.
 * Auth: token passed in URL path (/ws/{token}) — more reliable than cookies for WS.
 */

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAuthStore } from "@/lib/store";
import { useChatStore, useFriendsStore, useCallStore } from "@/lib/store";
import { auth } from "@/lib/api";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

type MessageHandler = (msg: any) => void;

export function useSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setToken = useAuthStore((s) => s.setToken);
  const incrementUnread = useChatStore((s) => s.incrementUnread);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const updateFriendStatus = useFriendsStore((s) => s.updateFriendStatus);
  const setIncomingCall = useCallStore((s) => s.setIncomingCall);
  const setActiveCall = useCallStore((s) => s.setActiveCall);
  const updateParticipantCount = useCallStore((s) => s.updateParticipantCount);

  // Keep latest values in refs so connect() callback stays stable
  const accessTokenRef = useRef(accessToken);
  const setTokenRef = useRef(setToken);
  const activeChatIdRef = useRef(activeChatId);
  const incrementUnreadRef = useRef(incrementUnread);
  const updateFriendStatusRef = useRef(updateFriendStatus);
  const setIncomingCallRef = useRef(setIncomingCall);
  const setActiveCallRef = useRef(setActiveCall);
  const updateParticipantCountRef = useRef(updateParticipantCount);

  useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);
  useEffect(() => { setTokenRef.current = setToken; }, [setToken]);
  useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);
  useEffect(() => { incrementUnreadRef.current = incrementUnread; }, [incrementUnread]);
  useEffect(() => { updateFriendStatusRef.current = updateFriendStatus; }, [updateFriendStatus]);
  useEffect(() => { setIncomingCallRef.current = setIncomingCall; }, [setIncomingCall]);
  useEffect(() => { setActiveCallRef.current = setActiveCall; }, [setActiveCall]);
  useEffect(() => { updateParticipantCountRef.current = updateParticipantCount; }, [updateParticipantCount]);

  const connect = useCallback(() => {
    if (!user) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Use token-in-URL for reliable auth; fall back to cookie-based
    const token = accessTokenRef.current;
    const wsUrl = token ? `${WS_URL}/ws/${token}` : `${WS_URL}/ws`;
    const ws = new WebSocket(wsUrl);

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

        // Call events
        if (type === "incoming_call") {
          setIncomingCallRef.current({
            call_id: msg.data.call_id,
            chat_id: msg.data.chat_id,
            room_name: msg.data.room_name,
            call_type: msg.data.call_type,
            initiated_by: msg.data.initiated_by,
            initiator_name: msg.data.initiator_name,
          });
          setActiveCallRef.current(msg.data.chat_id, {
            call_id: msg.data.call_id,
            chat_id: msg.data.chat_id,
            room_name: msg.data.room_name,
            call_type: msg.data.call_type,
            participant_count: 1,
          });
        }

        if (type === "call_ended") {
          setActiveCallRef.current(msg.data.chat_id, null);
          setIncomingCallRef.current(null);
        }

        if (type === "participant_joined" || type === "participant_left") {
          updateParticipantCountRef.current(
            msg.data.chat_id,
            msg.data.participant_count
          );
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
      // Refresh token before reconnecting to ensure we always have a valid token
      console.log("🔌 WebSocket disconnected, refreshing token...");
      auth.refresh()
        .then((res) => {
          setTokenRef.current(res.token);
        })
        .catch(() => {
          // Refresh failed — might be logged out; connect anyway (will fail gracefully)
        })
        .finally(() => {
          reconnectRef.current = setTimeout(connect, 3000);
        });
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    wsRef.current = ws;
  }, [user]); // reconnect when user changes (login/logout)

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

  // Auto-connect on mount, reconnect on user change
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // If token arrives (e.g. after loadFromServer) and WS is not open, reconnect immediately
  useEffect(() => {
    if (accessToken && user && wsRef.current?.readyState !== WebSocket.OPEN) {
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      connect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

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

  const markRead = useCallback((chatId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "mark_read", chat_id: chatId }));
    }
  }, []);

  const declineCall = useCallback((callId: string, chatId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "call_decline", call_id: callId, chat_id: chatId })
      );
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
    markRead,
    declineCall,
    on,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
}
