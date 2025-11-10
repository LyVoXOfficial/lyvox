# Supabase Monitoring Guide (MON-002)

This document describes how to monitor Supabase database, API, and storage usage for LyVoX.

## Overview

Supabase provides built-in monitoring through:
- **Dashboard**: Real-time metrics in Supabase dashboard
- **Logs API**: Programmatic access to logs
- **Database Functions**: Custom monitoring queries
- **Alerts**: Email notifications for critical issues

## Database Performance Metrics

### 1. Query Performance

Monitor slow queries using Supabase logs:

```sql
-- Find slow queries (> 1 second)
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### 2. Table Statistics

Monitor table sizes and growth:

```sql
-- Table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 3. Index Usage

Check index effectiveness:

```sql
-- Index usage statistics
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### 4. Connection Pool

Monitor connection pool usage:

```sql
-- Active connections
SELECT 
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active_connections,
  count(*) FILTER (WHERE state = 'idle') as idle_connections
FROM pg_stat_activity
WHERE datname = current_database();
```

## API Usage Tracking

### 1. Supabase Dashboard

Monitor API usage in Supabase Dashboard:
- **Settings** → **Usage** → **API Requests**
- Track requests per day/week/month
- Monitor rate limit usage

### 2. Custom API Tracking

Create a table to track API usage:

```sql
-- Create API usage tracking table
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL,
  method text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  status_code integer,
  response_time_ms integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX api_usage_logs_created_at_idx ON public.api_usage_logs(created_at);
CREATE INDEX api_usage_logs_endpoint_idx ON public.api_usage_logs(endpoint);
CREATE INDEX api_usage_logs_user_id_idx ON public.api_usage_logs(user_id);
```

### 3. Track API Calls

Add tracking to API routes:

```typescript
// apps/web/src/app/api/example/route.ts
import { supabaseService } from "@/lib/supabaseServer";

const startTime = Date.now();

try {
  // Your API logic
  const result = await processRequest();
  
  // Log successful request
  await logApiUsage({
    endpoint: "/api/example",
    method: "GET",
    statusCode: 200,
    responseTime: Date.now() - startTime,
  });
  
  return NextResponse.json(result);
} catch (error) {
  // Log error
  await logApiUsage({
    endpoint: "/api/example",
    method: "GET",
    statusCode: 500,
    responseTime: Date.now() - startTime,
  });
  throw error;
}
```

## Storage Usage

### 1. Monitor Storage Size

Check storage bucket sizes:

```sql
-- Storage usage (requires storage admin access)
SELECT 
  bucket_id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets;
```

### 2. Track Storage Growth

Monitor storage growth over time:

```sql
-- Create storage tracking table
CREATE TABLE IF NOT EXISTS public.storage_usage_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_name text NOT NULL,
  total_size_bytes bigint,
  file_count integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX storage_usage_snapshots_created_at_idx 
  ON public.storage_usage_snapshots(created_at);
```

### 3. Storage Cleanup

Identify orphaned files:

```sql
-- Find media without associated adverts
SELECT m.id, m.url, m.advert_id
FROM public.media m
LEFT JOIN public.adverts a ON a.id = m.advert_id
WHERE a.id IS NULL;
```

## Monitoring Scripts

### 1. Daily Metrics Script

Create a script to collect daily metrics:

```javascript
// scripts/monitor-daily-metrics.mjs
import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function collectMetrics() {
  await client.connect();
  
  // Database size
  const dbSize = await client.query(`
    SELECT pg_size_pretty(pg_database_size(current_database())) as size
  `);
  
  // Active connections
  const connections = await client.query(`
    SELECT count(*) as total, 
           count(*) FILTER (WHERE state = 'active') as active
    FROM pg_stat_activity
    WHERE datname = current_database()
  `);
  
  // Slow queries
  const slowQueries = await client.query(`
    SELECT query, mean_exec_time
    FROM pg_stat_statements
    WHERE mean_exec_time > 1000
    ORDER BY mean_exec_time DESC
    LIMIT 10
  `);
  
  console.log("Daily Metrics:");
  console.log("Database Size:", dbSize.rows[0].size);
  console.log("Connections:", connections.rows[0]);
  console.log("Slow Queries:", slowQueries.rows);
  
  await client.end();
}

collectMetrics();
```

### 2. Alert Script

Create alerts for critical metrics:

```javascript
// scripts/monitor-alerts.mjs
import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const ALERTS = {
  maxConnections: 80, // Warn at 80% of max
  slowQueryThreshold: 5000, // 5 seconds
  dbSizeThreshold: 10 * 1024 * 1024 * 1024, // 10 GB
};

async function checkAlerts() {
  await client.connect();
  
  // Check connections
  const connections = await client.query(`
    SELECT count(*) as total FROM pg_stat_activity
    WHERE datname = current_database()
  `);
  
  if (connections.rows[0].total > ALERTS.maxConnections) {
    console.warn(`⚠️ High connection count: ${connections.rows[0].total}`);
  }
  
  // Check slow queries
  const slowQueries = await client.query(`
    SELECT count(*) as count
    FROM pg_stat_statements
    WHERE mean_exec_time > $1
  `, [ALERTS.slowQueryThreshold]);
  
  if (slowQueries.rows[0].count > 0) {
    console.warn(`⚠️ Slow queries detected: ${slowQueries.rows[0].count}`);
  }
  
  // Check database size
  const dbSize = await client.query(`
    SELECT pg_database_size(current_database()) as size_bytes
  `);
  
  if (dbSize.rows[0].size_bytes > ALERTS.dbSizeThreshold) {
    console.warn(`⚠️ Database size approaching limit`);
  }
  
  await client.end();
}

checkAlerts();
```

## Supabase Dashboard Monitoring

### Key Metrics to Monitor

1. **Database**
   - Active connections
   - Query performance
   - Database size
   - Index usage

2. **API**
   - Request rate
   - Error rate
   - Response times
   - Rate limit usage

3. **Storage**
   - Total storage used
   - File count
   - Bandwidth usage

4. **Auth**
   - Active users
   - Sign-ups per day
   - Failed login attempts

## Alerts Setup

### 1. Supabase Dashboard Alerts

Configure alerts in Supabase Dashboard:
- **Settings** → **Alerts**
- Set thresholds for:
  - Database connections > 80%
  - API error rate > 5%
  - Storage usage > 90%

### 2. Custom Alerts via Cron

Use Supabase Edge Functions or external cron:

```typescript
// supabase/functions/monitor-alerts/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  // Check metrics
  // Send alerts via email/Slack/webhook
  
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

## Best Practices

1. **Monitor regularly**: Check metrics daily/weekly
2. **Set appropriate thresholds**: Avoid alert fatigue
3. **Track trends**: Monitor growth over time
4. **Automate alerts**: Use Supabase alerts or cron jobs
5. **Document incidents**: Track and resolve issues

## Related Documentation

- [Supabase Monitoring](https://supabase.com/docs/guides/platform/metrics)
- [Supabase Logs](https://supabase.com/docs/guides/platform/logs)
- [PostgreSQL Statistics](https://www.postgresql.org/docs/current/monitoring-stats.html)

