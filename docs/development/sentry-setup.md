# Sentry Setup Guide (MON-001)

This document describes how to set up Sentry for error tracking and performance monitoring in LyVoX.

## Overview

Sentry provides:
- **Error Tracking**: Automatic error capture with stack traces
- **Performance Monitoring**: Track slow API routes and database queries
- **Alerts**: Email/Slack notifications for critical errors
- **Release Tracking**: Track errors by deployment version

## Installation

### 1. Install Sentry SDK

```bash
cd apps/web
pnpm add @sentry/nextjs
```

### 2. Initialize Sentry

Run the Sentry wizard:

```bash
pnpm exec @sentry/wizard@latest -i nextjs
```

Or manually configure:

### 3. Environment Variables

Add to `.env.local` and Vercel:

```env
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_ORG=your-org
SENTRY_PROJECT=lyvox-web
SENTRY_AUTH_TOKEN=your-auth-token

# Optional: Environment
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
```

### 4. Configuration Files

Sentry wizard creates:
- `sentry.client.config.ts` - Client-side configuration
- `sentry.server.config.ts` - Server-side configuration
- `sentry.edge.config.ts` - Edge runtime configuration
- `instrumentation.ts` - Next.js instrumentation hook

## Integration with Error Logger

The `errorLogger.ts` is already set up to integrate with Sentry. After Sentry is configured, update `sendToMonitoring()`:

```typescript
import * as Sentry from "@sentry/nextjs";

private sendToMonitoring(level: LogLevel, message: string, context?: LogContext): void {
  if (level !== LogLevel.ERROR && level !== LogLevel.FATAL) return;
  if (this.isDevelopment) return;

  if (context?.error instanceof Error) {
    Sentry.captureException(context.error, {
      level: level === LogLevel.FATAL ? "fatal" : "error",
      tags: {
        component: context.component,
        action: context.action,
      },
      extra: {
        message,
        userId: context.userId,
        metadata: context.metadata,
      },
    });
  } else {
    Sentry.captureMessage(message, {
      level: level === LogLevel.FATAL ? "fatal" : "error",
      tags: {
        component: context?.component,
        action: context?.action,
      },
      extra: context?.metadata,
    });
  }
}
```

## Performance Monitoring

### Track API Routes

Add performance monitoring to API routes:

```typescript
// apps/web/src/app/api/example/route.ts
import * as Sentry from "@sentry/nextjs";

export async function GET(request: Request) {
  const transaction = Sentry.startTransaction({
    op: "http.server",
    name: "GET /api/example",
  });

  try {
    // Your API logic
    return NextResponse.json({ ok: true });
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  } finally {
    transaction.finish();
  }
}
```

### Track Database Queries

Monitor slow database queries:

```typescript
import * as Sentry from "@sentry/nextjs";

const span = Sentry.startSpan({
  op: "db.query",
  name: "search_adverts",
});

try {
  const result = await supabase.rpc("search_adverts", params);
  return result;
} finally {
  span?.finish();
}
```

## Alerts Configuration

### 1. Create Alert Rules in Sentry Dashboard

1. Go to **Alerts** → **Create Alert Rule**
2. Set conditions:
   - **When**: Error rate > 10% in 5 minutes
   - **Then**: Send email/Slack notification
3. Add filters:
   - Environment: production
   - Tags: component, action

### 2. Recommended Alerts

- **Critical Errors**: Fatal errors in production
- **High Error Rate**: > 10 errors/minute
- **Performance Degradation**: P95 latency > 2s
- **Database Slow Queries**: Query time > 1s

## Release Tracking

### Automatic Release Tracking

Sentry automatically tracks releases when deployed to Vercel if configured.

### Manual Release Tracking

```typescript
// In your deployment script
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  environment: process.env.VERCEL_ENV || "development",
});
```

## User Context

Set user context for better error tracking:

```typescript
import * as Sentry from "@sentry/nextjs";

// In authenticated routes
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.display_name,
});
```

## Source Maps

Sentry needs source maps to show readable stack traces:

1. Enable source maps in `next.config.ts`:
```typescript
productionBrowserSourceMaps: true,
```

2. Upload source maps during build:
```bash
pnpm exec @sentry/cli sourcemaps inject
pnpm build
pnpm exec @sentry/cli sourcemaps upload
```

## Testing

### Test Error Capture

```typescript
// Test endpoint
import * as Sentry from "@sentry/nextjs";

export async function GET() {
  Sentry.captureException(new Error("Test error"));
  return NextResponse.json({ ok: true });
}
```

### Test Performance Monitoring

```typescript
const transaction = Sentry.startTransaction({
  op: "test",
  name: "test-transaction",
});

await new Promise(resolve => setTimeout(resolve, 1000));

transaction.finish();
```

## Best Practices

1. **Don't log sensitive data**: Sanitize user data before sending to Sentry
2. **Use tags for filtering**: Tag errors by component, action, user type
3. **Set appropriate sample rates**: 100% for errors, 10% for performance
4. **Monitor alert noise**: Adjust thresholds to avoid alert fatigue
5. **Review errors regularly**: Triage and fix high-priority errors

## Related Documentation

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Sentry Alerts](https://docs.sentry.io/product/alerts/)

