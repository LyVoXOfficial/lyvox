#!/usr/bin/env node
/**
 * MON-002: Daily Supabase Metrics Collection
 * 
 * This script collects daily metrics from Supabase:
 * - Database size and growth
 * - Connection pool usage
 * - Slow queries
 * - Table statistics
 * 
 * Usage:
 *   node scripts/monitor-supabase-daily.mjs
 * 
 * Requires DATABASE_URL in .env.local
 */

import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function collectDailyMetrics() {
  try {
    await client.connect();
    console.log("✅ Connected to database\n");

    // 1. Database size
    console.log("📊 Database Size:");
    const dbSize = await client.query(`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as total_size,
        pg_size_pretty(pg_database_size(current_database()) - 
          (SELECT sum(pg_total_relation_size(schemaname||'.'||tablename)) 
           FROM pg_tables WHERE schemaname = 'public')) as overhead
    `);
    console.table(dbSize.rows);

    // 2. Table sizes
    console.log("\n📋 Table Sizes (Top 10):");
    const tableSizes = await client.query(`
      SELECT 
        tablename,
        pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size,
        pg_size_pretty(pg_relation_size('public.'||tablename)) as table_size,
        pg_size_pretty(pg_total_relation_size('public.'||tablename) - 
          pg_relation_size('public.'||tablename)) as indexes_size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size('public.'||tablename) DESC
      LIMIT 10
    `);
    console.table(tableSizes.rows);

    // 3. Connection pool
    console.log("\n🔌 Connection Pool:");
    const connections = await client.query(`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active,
        count(*) FILTER (WHERE state = 'idle') as idle,
        count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);
    console.table(connections.rows);

    // 4. Slow queries (if pg_stat_statements is enabled)
    try {
      console.log("\n🐌 Slow Queries (> 1 second, Top 10):");
      const slowQueries = await client.query(`
        SELECT 
          left(query, 100) as query_preview,
          calls,
          round(mean_exec_time::numeric, 2) as avg_ms,
          round(max_exec_time::numeric, 2) as max_ms,
          round(total_exec_time::numeric, 2) as total_ms
        FROM pg_stat_statements
        WHERE mean_exec_time > 1000
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `);
      if (slowQueries.rows.length > 0) {
        console.table(slowQueries.rows);
      } else {
        console.log("✅ No slow queries detected");
      }
    } catch (err) {
      if (err.message.includes("pg_stat_statements")) {
        console.log("⚠️  pg_stat_statements extension not enabled");
        console.log("   Enable with: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;");
      } else {
        throw err;
      }
    }

    // 5. Index usage
    console.log("\n📑 Index Usage (Top 10 by scans):");
    const indexUsage = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan as scans,
        idx_tup_read as tuples_read
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      ORDER BY idx_scan DESC
      LIMIT 10
    `);
    console.table(indexUsage.rows);

    // 6. Unused indexes (potential cleanup)
    console.log("\n🗑️  Unused Indexes (consider removing):");
    const unusedIndexes = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) as size
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
        AND idx_scan = 0
        AND indexrelid NOT IN (
          SELECT conindid FROM pg_constraint
        )
      ORDER BY pg_relation_size(indexrelid) DESC
      LIMIT 10
    `);
    if (unusedIndexes.rows.length > 0) {
      console.table(unusedIndexes.rows);
    } else {
      console.log("✅ No unused indexes found");
    }

    console.log("\n✅ Daily metrics collection complete");

  } catch (error) {
    console.error("❌ Error collecting metrics:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

collectDailyMetrics();

