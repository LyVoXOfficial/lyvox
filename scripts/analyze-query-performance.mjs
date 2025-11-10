#!/usr/bin/env node
/**
 * PERF-001: Query Performance Analysis Script
 * 
 * This script runs EXPLAIN ANALYZE on critical database queries to identify
 * performance bottlenecks and missing indexes.
 * 
 * Usage:
 *   node scripts/analyze-query-performance.mjs
 * 
 * Requires DATABASE_URL in .env.local
 */

import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });

// Critical queries to analyze
const QUERIES = [
  {
    name: "Search adverts with full-text search",
    sql: `
      SELECT * FROM public.search_adverts(
        search_query => 'laptop',
        category_id_filter => NULL,
        price_min_filter => NULL,
        price_max_filter => NULL,
        location_filter => NULL,
        location_lat => NULL,
        location_lng => NULL,
        radius_km => 50,
        sort_by => 'relevance',
        page_offset => 0,
        page_limit => 24,
        verified_only => false
      );
    `,
  },
  {
    name: "User profile adverts query",
    sql: `
      SELECT id, title, price, status, created_at, location
      FROM public.adverts
      WHERE user_id = (SELECT id FROM auth.users LIMIT 1)
      ORDER BY created_at DESC
      LIMIT 50;
    `,
  },
  {
    name: "Favorites with advert join",
    sql: `
      SELECT 
        f.advert_id,
        f.created_at,
        a.id,
        a.title,
        a.price,
        a.currency,
        a.location,
        a.created_at,
        a.user_id,
        a.status
      FROM public.favorites f
      JOIN public.adverts a ON a.id = f.advert_id
      WHERE f.user_id = (SELECT id FROM auth.users LIMIT 1)
      ORDER BY f.created_at DESC
      LIMIT 50;
    `,
  },
  {
    name: "Category tree query",
    sql: `
      SELECT id, parent_id, slug, name_ru, name_en, sort
      FROM public.categories
      WHERE parent_id IS NULL AND is_active = true
      ORDER BY sort;
    `,
  },
  {
    name: "Active adverts by category with price filter",
    sql: `
      SELECT id, title, price, created_at
      FROM public.adverts
      WHERE category_id = (SELECT id FROM public.categories LIMIT 1)
        AND status = 'active'
        AND price >= 100
        AND price <= 1000
      ORDER BY price ASC
      LIMIT 24;
    `,
  },
  {
    name: "Verified sellers filter",
    sql: `
      SELECT a.id, a.title, a.price
      FROM public.adverts a
      JOIN public.profiles p ON p.id = a.user_id
      WHERE a.status = 'active'
        AND p.verified_email = true
        AND p.verified_phone = true
      ORDER BY a.created_at DESC
      LIMIT 24;
    `,
  },
  {
    name: "Media loading for advert",
    sql: `
      SELECT url, sort
      FROM public.media
      WHERE advert_id = (SELECT id FROM public.adverts LIMIT 1)
      ORDER BY sort;
    `,
  },
  {
    name: "Location text search (ILIKE)",
    sql: `
      SELECT id, title, location
      FROM public.adverts
      WHERE status = 'active'
        AND location ILIKE '%Brussels%'
      LIMIT 24;
    `,
  },
];

async function analyzeQuery(name, sql) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`Query: ${name}`);
  console.log("=".repeat(80));
  
  try {
    const explainSql = `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON) ${sql}`;
    const result = await client.query(explainSql);
    
    if (result.rows && result.rows[0] && result.rows[0]["QUERY PLAN"]) {
      const plan = result.rows[0]["QUERY PLAN"][0];
      
      console.log(`Execution Time: ${plan["Execution Time"]?.toFixed(2)} ms`);
      console.log(`Planning Time: ${plan["Planning Time"]?.toFixed(2)} ms`);
      console.log(`Total Cost: ${plan["Plan"]["Total Cost"]?.toFixed(2)}`);
      
      // Check for sequential scans
      const hasSeqScan = JSON.stringify(plan).includes("Seq Scan");
      if (hasSeqScan) {
        console.log("⚠️  WARNING: Sequential scan detected - consider adding indexes");
      }
      
      // Check for index scans
      const hasIndexScan = JSON.stringify(plan).includes("Index Scan") || 
                          JSON.stringify(plan).includes("Bitmap Index Scan");
      if (hasIndexScan) {
        console.log("✅ Index scan detected - good performance");
      }
      
      // Print full plan (formatted)
      console.log("\nFull Plan:");
      const formattedPlan = JSON.stringify(plan, null, 2);
      console.log(formattedPlan.substring(0, 2000)); // Limit output
      if (formattedPlan.length > 2000) {
        console.log("... (truncated)");
      }
    } else {
      console.log("⚠️  Could not parse query plan");
    }
  } catch (error) {
    console.error(`❌ Error analyzing query: ${error.message}`);
    if (error.message.includes("does not exist")) {
      console.log("   (This is expected if tables/data don't exist yet)");
    }
  }
}

async function main() {
  try {
    await client.connect();
    console.log("✅ Connected to database");
    console.log(`📊 Analyzing ${QUERIES.length} critical queries...\n`);
    
    for (const query of QUERIES) {
      await analyzeQuery(query.name, query.sql);
    }
    
    console.log("\n" + "=".repeat(80));
    console.log("✅ Analysis complete!");
    console.log("\nRecommendations:");
    console.log("1. Look for 'Seq Scan' warnings - these indicate missing indexes");
    console.log("2. High 'Execution Time' values may need query optimization");
    console.log("3. Check 'Total Cost' - lower is better");
    console.log("4. Ensure indexes are being used (Index Scan or Bitmap Index Scan)");
    
  } catch (error) {
    console.error("❌ Fatal error:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

