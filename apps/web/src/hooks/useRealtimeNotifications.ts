"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface Notification {
  id: string;
  type: string;
  channel: string;
  title: string;
  body: string;
  payload: Record<string, any> | null;
  read_at: string | null;
  sent_at: string | null;
  created_at: string;
}

interface UseRealtimeNotificationsOptions {
  userId: string | null;
  onNotification?: (notification: Notification) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

interface UseRealtimeNotificationsReturn {
  isConnected: boolean;
  error: Error | null;
  reconnect: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

/**
 * Hook for subscribing to realtime notifications
 */
export function useRealtimeNotifications({
  userId,
  onNotification,
  onError,
  enabled = true,
}: UseRealtimeNotificationsOptions): UseRealtimeNotificationsReturn {
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
    if (!userId || !enabled) {
      cleanup();
      return;
    }

    cleanup();

    const channelName = `notifications:${userId}`;
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
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!isMountedRef.current) return;

          try {
            const notification = payload.new as Notification;
            onNotification?.(notification);
            setError(null);
            reconnectAttemptsRef.current = 0;
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
        } else if (payload.status === "CHANNEL_ERROR" || payload.status === "TIMED_OUT") {
          const error = new Error(payload.error || "Channel error");
          setError(error);
          setIsConnected(false);
          onError?.(error);
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
  }, [userId, enabled, onNotification, onError, cleanup]);

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
      if (isMountedRef.current && userId && enabled) {
        subscribe();
      }
    }, delay);
  }, [userId, enabled, subscribe, onError]);

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

