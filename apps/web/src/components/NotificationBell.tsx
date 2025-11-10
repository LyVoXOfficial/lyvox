"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { useRealtimeNotifications, type Notification } from "@/hooks/useRealtimeNotifications";
import { supabase } from "@/lib/supabaseClient";
import { formatDate } from "@/i18n/format";
import Link from "next/link";

export default function NotificationBell() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUserId = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUserId();
  }, []);

  useEffect(() => {
    if (userId && open) {
      loadNotifications();
    }
  }, [userId, open]);

  const loadNotifications = async () => {
    if (!userId) return;

    try {
      const response = await fetch("/api/notifications?limit=10&unread_only=false");
      const data = await response.json();

      if (data.ok) {
        setNotifications(data.data.notifications || []);
        setUnreadCount(data.data.notifications?.filter((n: Notification) => !n.read_at).length || 0);
      }
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  };

  useRealtimeNotifications({
    userId,
    onNotification: (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      if (!notification.read_at) {
        setUnreadCount((prev) => prev + 1);
      }
    },
    enabled: !!userId,
  });

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: "POST",
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  if (!userId) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <h3 className="font-semibold">{t("notifications.title")}</h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t("notifications.empty")}
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-muted/50 cursor-pointer ${
                    !notification.read_at ? "bg-muted/30" : ""
                  }`}
                  onClick={() => {
                    if (!notification.read_at) {
                      handleMarkAsRead(notification.id);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{notification.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {notification.body}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(notification.created_at, locale, "relative")}
                      </p>
                    </div>
                    {!notification.read_at && (
                      <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {notifications.length > 0 && (
          <div className="p-2 border-t">
            <Link
              href="/notifications"
              className="text-sm text-center block text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              {t("notifications.view_all")}
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

