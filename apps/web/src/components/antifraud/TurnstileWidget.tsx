"use client";

import Script from "next/script";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset?: (id?: string) => void;
    };
  }
}

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export type TurnstileWidgetHandle = {
  reset: () => void;
};

type Props = {
  onToken: (token: string | null) => void;
  onError?: () => void;
  action?: string;
  size?: "normal" | "compact" | "flexible";
};

/**
 * Shared Cloudflare Turnstile widget (explicit-render mode).
 * Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset (dev-friendly,
 * mirrors verifyTurnstile()'s server-side no-op when TURNSTILE_SECRET_KEY is unset).
 * Extracted from the original register-only inline implementation so
 * login/recovery/phone flows can reuse the exact same render/reset behavior.
 */
const TurnstileWidget = forwardRef<TurnstileWidgetHandle, Props>(
  function TurnstileWidget({ onToken, onError, action, size = "normal" }, ref) {
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    useImperativeHandle(ref, () => ({
      reset: () => {
        window.turnstile?.reset?.(widgetIdRef.current ?? undefined);
        onToken(null);
      },
    }));

    useEffect(() => {
      if (!siteKey || !scriptLoaded || !containerRef.current) return;
      if (widgetIdRef.current) return; // already rendered — guard against StrictMode double-effect

      const options: Record<string, unknown> = {
        sitekey: siteKey,
        size,
        callback: (token: string) => onToken(token),
        "error-callback": () => {
          onToken(null);
          onError?.();
        },
        "expired-callback": () => onToken(null),
      };
      if (action) options.action = action;

      widgetIdRef.current =
        window.turnstile?.render(containerRef.current, options) ?? null;
      if (!widgetIdRef.current) onError?.();
    }, [action, onError, scriptLoaded, onToken, size]);

    if (!siteKey) return null;

    return (
      <>
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          async
          defer
          onLoad={() => setScriptLoaded(true)}
          onError={() => onError?.()}
        />
        <div ref={containerRef} />
      </>
    );
  },
);

export default TurnstileWidget;
