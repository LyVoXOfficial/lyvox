"use client";

import { useEffect } from "react";

/**
 * Client-side wrapper that triggers auth state change event
 * This helps update the header when user lands on a protected page after login
 */
export function ProfilePageClientWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Dispatch auth-state-change event to update header
    const event = new CustomEvent("auth-state-change");
    window.dispatchEvent(event);
  }, []);

  return <>{children}</>;
}

