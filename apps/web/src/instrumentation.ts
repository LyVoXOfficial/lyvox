// Server-side Sentry initialization
// Loaded via next.config.ts: experimental.instrumentationHook

import * as Sentry from '@sentry/nextjs';
import { assertEnvOnBoot } from '@/lib/env';

export function register() {
  // FLAG-05 / SEC-RL2: fail loudly at boot in production if a critical key
  // (Supabase, Upstash) is missing, instead of degrading silently. Runs in both
  // nodejs and edge runtimes so no server variant boots misconfigured.
  assertEnvOnBoot();

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        integrations: [],
      });
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      });
    }
  }
}
