'use client';

import { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { useCookieConsent } from '@/components/cookie/CookieConsentProvider';

// PERF-07 item 1 (owner-approved defer): @sentry/nextjs is the largest
// remaining shared client chunk (it also carries @vercel/analytics). It used to
// load eagerly via a module-scope `import * as Sentry` in this root-layout
// client component, so it shipped in EVERY route's first-load JS — even though
// it only does anything when NEXT_PUBLIC_SENTRY_DSN is set. We now defer both
// the import and Sentry.init() until after first paint (requestIdleCallback,
// with a setTimeout fallback) and only when a DSN exists.
//
// Tradeoff (owner decision, PERF-07): errors thrown in the first frames after
// load are not captured by Sentry. Today no DSN is configured in prod, so this
// is a pure bundle win with identical behavior; the tradeoff only applies once
// Sentry is enabled.
export function ErrorTrackingProvider({
  errorTrackingEnabled,
  analyticsEnabled,
}: {
  errorTrackingEnabled: boolean;
  analyticsEnabled: boolean;
}) {
  const { consent, decided } = useCookieConsent();
  const analyticsConsent = decided && consent?.analytics === true;

  useEffect(() => {
    if (!errorTrackingEnabled || !analyticsConsent) return;
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;

    const initSentry = () => {
      import('@sentry/nextjs')
        .then((Sentry) => {
          Sentry.init({
            dsn,
            environment: process.env.NODE_ENV || 'development',
            tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
          });
        })
        .catch(() => {
          // Best-effort monitoring — a failed Sentry load must never break the app.
        });
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof idleWindow.requestIdleCallback === 'function') {
      const handle = idleWindow.requestIdleCallback(initSentry);
      return () => idleWindow.cancelIdleCallback?.(handle);
    }

    const timer = window.setTimeout(initSentry, 2000);
    return () => window.clearTimeout(timer);
  }, [analyticsConsent, errorTrackingEnabled]);

  return (
    <>
      {/* Vercel Speed Insights + Web Analytics (automatically enabled if NEXT_PUBLIC_VERCEL_ANALYTICS_ID is set) */}
      {analyticsEnabled && analyticsConsent && <Analytics />}
    </>
  );
}
