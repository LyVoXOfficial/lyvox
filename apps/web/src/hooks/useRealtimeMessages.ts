"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface Message {
  id: number;
  conversation_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at?: string;
}

interface UseRealtimeMessagesOptions {
  conversationId: string | null;
  onMessage?: (message: Message) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

interface UseRealtimeMessagesReturn {
  isConnected: boolean;
  error: Error | null;
  reconnect: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

/**
 * Hook for subscribing to realtime messages in a conversation
 * 
 * @param conversationId - The ID of the conversation to subscribe to
 * @param onMessage - Callback when a new message is received
 * @param onError - Callback when an error occurs
 * @param enabled - Whether the subscription should be active (default: true)
 * 
 * @example
 * ```tsx
 * const { isConnected, error, reconnect } = useRealtimeMessages({
 *   conversationId: "123e4567-e89b-12d3-a456-426614174000",
 *   onMessage: (message) => {
 *     setMessages(prev => [...prev, message]);
 *   },
 *   onError: (error) => {
 *     console.error("Realtime error:", error);
 *   },
 * });
 * ```
 */
export function useRealtimeMessages({
  conversationId,
  onMessage,
  onError,
  enabled = true,
}: UseRealtimeMessagesOptions): UseRealtimeMessagesReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const subscribe = useCallback(() => {
    if (!conversationId || !enabled) {
      cleanup();
      return;
    }

    // Cleanup existing subscription
    cleanup();

    const channelName = `conversation:${conversationId}`;
    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false },
          presence: { key: "" },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (!isMountedRef.current) return;

          try {
            const message = payload.new as Message;
            onMessage?.(message);
            setError(null);
            reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful message
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            onError?.(error);
          }
        },
      )
      .on("system", {}, (payload) => {
        if (!isMountedRef.current) return;

        if (payload.status === "SUBSCRIBED") {
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0;
        } else if (payload.status === "CHANNEL_ERROR") {
          const error = new Error(payload.error || "Channel error");
          setError(error);
          setIsConnected(false);
          onError?.(error);
          
          // Attempt reconnect
          scheduleReconnect();
        } else if (payload.status === "TIMED_OUT") {
          const error = new Error("Connection timed out");
          setError(error);
          setIsConnected(false);
          onError?.(error);
          
          // Attempt reconnect
          scheduleReconnect();
        } else if (payload.status === "CLOSED") {
          setIsConnected(false);
        }
      })
      .subscribe((status) => {
        if (!isMountedRef.current) return;

        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setIsConnected(false);
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            scheduleReconnect();
          }
        }
      });

    channelRef.current = channel;
  }, [conversationId, enabled, onMessage, onError, cleanup]);

  const scheduleReconnect = useCallback(() => {
    if (!isMountedRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      const error = new Error("Max reconnect attempts reached");
      setError(error);
      onError?.(error);
      return;
    }

    reconnectAttemptsRef.current += 1;
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1),
      MAX_RECONNECT_DELAY,
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && conversationId && enabled) {
        subscribe();
      }
    }, delay);
  }, [conversationId, enabled, subscribe, onError]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    subscribe();
  }, [subscribe]);

  useEffect(() => {
    isMountedRef.current = true;
    subscribe();

    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [subscribe, cleanup]);

  return {
    isConnected,
    error,
    reconnect,
  };
}

