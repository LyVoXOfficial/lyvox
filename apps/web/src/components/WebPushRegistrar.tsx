"use client";

import { useEffect } from "react";

export function WebPushRegistrar({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || !("serviceWorker" in navigator) || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    navigator.serviceWorker.register("/sw.js").catch(() => null);
  }, [enabled]);

  return null;
}
