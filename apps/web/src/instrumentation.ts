// Server-side Sentry initialization
// Loaded via next.config.ts: experimental.instrumentationHook

import { assertEnvOnBoot } from '@/lib/env';

export async function register() {
  // FLAG-05 / SEC-RL2: fail loudly at boot in production if a critical key
  // (Supabase, Upstash) is missing, instead of degrading silently. Runs in both
  // nodejs and edge runtimes so no server variant boots misconfigured.
  assertEnvOnBoot();

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getIntegrationStatus } = await import('@/lib/integrations/registry');
    const status = await getIntegrationStatus('error_tracking');
    if (status.effective && process.env.SENTRY_DSN) {
      const Sentry = await import('@sentry/nextjs');
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        integrations: [],
      });
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge initialization remains intentionally dormant until the capability
    // resolver has an edge-safe, audited config snapshot. Product truth stays OFF.
  }
}
