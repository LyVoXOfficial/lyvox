'use client';

import * as Sentry from '@sentry/nextjs';
import { Analytics } from '@vercel/analytics/react';

// Initialize Sentry on the client side if DSN is provided and error tracking is enabled
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
}

export function ErrorTrackingProvider() {
  return (
    <>
      {/* Vercel Speed Insights + Web Analytics (automatically enabled if NEXT_PUBLIC_VERCEL_ANALYTICS_ID is set) */}
      <Analytics />
    </>
  );
}
