#!/usr/bin/env node
/**
 * MON-002: Supabase Alert Checks
 * 
 * This script checks for critical conditions and sends alerts:
 * - High connection count
 * - Slow queries
 * - Database size approaching limit
 * - Unused indexes
 * 
 * Usage:
 *   node scripts/monitor-supabase-alerts.mjs
 * 
 * Requires DATABASE_URL in .env.local
 */

import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });

// Alert thresholds
const ALERTS = {
  maxConnections: 80, // Warn at 80 connections (adjust based on your plan)
  slowQueryThreshold: 5000, // 5 seconds in milliseconds
  dbSizeWarningGB: 8, // Warn at 8 GB (adjust based on your plan)
  dbSizeCriticalGB: 9, // Critical at 9 GB
};

const alerts = [];

async function checkAlerts() {
  try {
    await client.connect();
    console.log("🔍 Checking for alerts...\n");

    // 1. Check connections
    const connections = await client.query(`
      SELECT count(*) as total FROM pg_stat_activity
      WHERE datname = current_database()
    `);
    const totalConnections = parseInt(connections.rows[0].total);
    
    if (totalConnections > ALERTS.maxConnections) {
      alerts.push({
        level: "WARNING",
        message: `High connection count: ${totalConnections} (threshold: ${ALERTS.maxConnections})`,
        metric: "connections",
        value: totalConnections,
      });
    }

    // 2. Check slow queries
    try {
      const slowQueries = await client.query(`
        SELECT count(*) as count, max(mean_exec_time) as max_time
        FROM pg_stat_statements
        WHERE mean_exec_time > $1
      `, [ALERTS.slowQueryThreshold]);
      
      const slowCount = parseInt(slowQueries.rows[0].count);
      const maxTime = parseFloat(slowQueries.rows[0].max_time);
      
      if (slowCount > 0) {
        alerts.push({
          level: "WARNING",
          message: `Slow queries detected: ${slowCount} queries > ${ALERTS.slowQueryThreshold}ms (max: ${maxTime.toFixed(2)}ms)`,
          metric: "slow_queries",
          value: slowCount,
        });
      }
    } catch (err) {
      if (!err.message.includes("pg_stat_statements")) {
        throw err;
      }
    }

    // 3. Check database size
    const dbSize = await client.query(`
      SELECT pg_database_size(current_database()) as size_bytes
    `);
    const sizeBytes = parseInt(dbSize.rows[0].size_bytes);
    const sizeGB = sizeBytes / (1024 * 1024 * 1024);
    
    if (sizeGB > ALERTS.dbSizeCriticalGB) {
      alerts.push({
        level: "CRITICAL",
        message: `Database size critical: ${sizeGB.toFixed(2)} GB (limit: ${ALERTS.dbSizeCriticalGB} GB)`,
        metric: "database_size",
        value: sizeGB,
      });
    } else if (sizeGB > ALERTS.dbSizeWarningGB) {
      alerts.push({
        level: "WARNING",
        message: `Database size warning: ${sizeGB.toFixed(2)} GB (threshold: ${ALERTS.dbSizeWarningGB} GB)`,
        metric: "database_size",
        value: sizeGB,
      });
    }

    // 4. Check for large unused indexes
    const unusedIndexes = await client.query(`
      SELECT 
        count(*) as count,
        sum(pg_relation_size(indexrelid)) as total_size_bytes
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
        AND idx_scan = 0
        AND indexrelid NOT IN (SELECT conindid FROM pg_constraint)
    `);
    const unusedCount = parseInt(unusedIndexes.rows[0].count);
    const unusedSizeMB = parseFloat(unusedIndexes.rows[0].total_size_bytes || 0) / (1024 * 1024);
    
    if (unusedCount > 5 && unusedSizeMB > 100) {
      alerts.push({
        level: "INFO",
        message: `Unused indexes detected: ${unusedCount} indexes using ${unusedSizeMB.toFixed(2)} MB`,
        metric: "unused_indexes",
        value: unusedCount,
      });
    }

    // Report alerts
    if (alerts.length === 0) {
      console.log("✅ No alerts - all metrics within thresholds");
    } else {
      console.log(`⚠️  Found ${alerts.length} alert(s):\n`);
      alerts.forEach((alert, index) => {
        console.log(`${index + 1}. [${alert.level}] ${alert.message}`);
      });
      
      // Exit with error code if critical alerts
      const criticalAlerts = alerts.filter(a => a.level === "CRITICAL");
      if (criticalAlerts.length > 0) {
        console.log(`\n❌ ${criticalAlerts.length} critical alert(s) detected`);
        process.exit(1);
      }
    }

  } catch (error) {
    console.error("❌ Error checking alerts:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkAlerts();

