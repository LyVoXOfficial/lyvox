#!/usr/bin/env node
/**
 * Continuous monitoring script for generation insights progress
 * Checks every 30 minutes until 100% complete
 */

import "dotenv/config";
import pg from "pg";
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Try to get DATABASE_URL from apps/web/.env.local
let DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  try {
    const envPath = join(rootDir, 'apps', 'web', '.env.local');
    const envContent = readFileSync(envPath, 'utf8');
    const match = envContent.match(/DATABASE_URL=(.+)/);
    if (match) {
      DATABASE_URL = match[1].trim().replace(/^"/, '').replace(/"$/, '');
    }
  } catch (e) {
    console.error("⚠️  Could not read DATABASE_URL from .env.local");
  }
}

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found. Cannot monitor progress.");
  console.error("   Make sure DATABASE_URL is set in apps/web/.env.local or as environment variable.");
  process.exit(1);
}

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
let checkCount = 0;

async function checkProgress() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    checkCount++;
    
    console.log("\n" + "=".repeat(70));
    console.log(`📊 GENERATION INSIGHTS PROGRESS CHECK #${checkCount}`);
    console.log(`⏰ Time: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`);
    console.log("=".repeat(70) + "\n");

    // 1. Total generations to process
    const { rows: [totalGen] } = await client.query(`
      SELECT COUNT(*) as count 
      FROM vehicle_generations 
      WHERE code IS NOT NULL AND code != ''
    `);
    const total = parseInt(totalGen.count);
    console.log(`🎯 TOTAL GENERATIONS TO PROCESS: ${total}`);

    // 2. Created insights (Russian)
    const { rows: [createdInsights] } = await client.query(`
      SELECT COUNT(*) as count 
      FROM vehicle_generation_insights
    `);
    const created = parseInt(createdInsights.count);
    const insightsPercent = total > 0 ? ((created / total) * 100).toFixed(1) : 0;
    const insightsEmoji = created === total ? '✅' : '⏳';
    console.log(`${insightsEmoji} INSIGHTS CREATED: ${created}/${total} (${insightsPercent}%)`);

    // 3. Translations by locale
    const { rows: translations } = await client.query(`
      SELECT locale, COUNT(*) as count 
      FROM vehicle_generation_insights_i18n 
      GROUP BY locale 
      ORDER BY locale
    `);
    
    console.log(`\n🌐 TRANSLATIONS:`);
    const locales = ['de', 'en', 'fr', 'nl'];
    const translationStatus = {};
    
    locales.forEach(locale => {
      const trans = translations.find(t => t.locale === locale);
      const count = trans ? parseInt(trans.count) : 0;
      const percent = created > 0 ? ((count / created) * 100).toFixed(1) : 0;
      const emoji = (count === created && created > 0) ? '✅' : '⏳';
      console.log(`  ${emoji} ${locale.toUpperCase()}: ${count}/${created} (${percent}%)`);
      translationStatus[locale] = { count, total: created, complete: count === created };
    });

    // 4. Missing insights (first 5)
    const { rows: missing } = await client.query(`
      SELECT 
        vmk.name as make_name,
        vm.name_en as model_name,
        vg.code,
        vg.start_year,
        vg.end_year
      FROM vehicle_generations vg
      JOIN vehicle_models vm ON vm.id = vg.model_id
      JOIN vehicle_makes vmk ON vmk.id = vm.make_id
      LEFT JOIN vehicle_generation_insights vgi ON vgi.generation_id = vg.id
      WHERE vg.code IS NOT NULL 
        AND vg.code != ''
        AND vgi.generation_id IS NULL
      ORDER BY vmk.name, vm.name_en, vg.start_year
      LIMIT 5
    `);

    if (missing.length > 0) {
      console.log(`\n⚠️  MISSING INSIGHTS (showing first ${missing.length}):`);
      missing.forEach(m => {
        console.log(`   - ${m.make_name} ${m.model_name} ${m.code} (${m.start_year}-${m.end_year || 'now'})`);
      });
    }

    // 5. Check if complete
    const isInsightsComplete = created === total && created > 0;
    const areTranslationsComplete = locales.every(
      locale => translationStatus[locale].complete
    );
    const isComplete = isInsightsComplete && areTranslationsComplete;

    console.log(`\n${"=".repeat(70)}`);
    if (isComplete) {
      console.log("🎉 STATUS: 100% COMPLETE! ALL DONE!");
      console.log("   ✅ All insights generated");
      console.log("   ✅ All translations completed");
    } else if (isInsightsComplete && !areTranslationsComplete) {
      console.log("⏳ STATUS: Insights complete (100%), translations in progress...");
      locales.forEach(locale => {
        if (!translationStatus[locale].complete) {
          const remaining = created - translationStatus[locale].count;
          console.log(`   🔄 ${locale.toUpperCase()}: ${remaining} remaining`);
        }
      });
    } else {
      const remaining = total - created;
      console.log(`⏳ STATUS: Generation in progress... (${remaining} insights remaining)`);
    }
    console.log("=".repeat(70) + "\n");

    return { total, created, translations: translationStatus, isComplete };

  } catch (error) {
    console.error("❌ Error checking progress:", error.message);
    return { isComplete: false, error: true };
  } finally {
    await client.end().catch(() => {});
  }
}

async function runMonitoring() {
  console.log("🚀 Starting continuous monitoring...");
  console.log(`⏱️  Check interval: 30 minutes`);
  console.log(`🔄 Press Ctrl+C to stop\n`);

  while (true) {
    try {
      const result = await checkProgress();
      
      if (result.isComplete) {
        console.log("✅ Monitoring complete! Exiting...");
        process.exit(0);
      }

      if (result.error) {
        console.log("⚠️  Error occurred, but will retry in 30 minutes...");
      }

      console.log(`⏰ Next check in 30 minutes (at ${new Date(Date.now() + INTERVAL_MS).toLocaleTimeString('ru-RU')})`);
      console.log(`💤 Sleeping...`);
      
      await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
      
    } catch (error) {
      console.error("❌ Fatal error:", error.message);
      console.log("⏰ Retrying in 30 minutes...");
      await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log("\n\n⚠️  Monitoring stopped by user. Exiting...");
  process.exit(0);
});

// Start monitoring
runMonitoring().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});

