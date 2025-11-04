#!/usr/bin/env node
/**
 * МАСТЕР-СКРИПТ: Полная обработка CSV → БД
 * 
 * Процесс:
 * 1. Импорт и обогащение из CSV
 * 2. Генерация SQL seed
 * 3. Применение к БД
 * 4. Проверка результатов
 * 
 * Использование:
 *   GOOGLE_API_KEY="..." DATABASE_URL="..." node scripts/csv-import-master.mjs --make BMW
 *   GOOGLE_API_KEY="..." DATABASE_URL="..." node scripts/csv-import-master.mjs --all
 *   GOOGLE_API_KEY="..." DATABASE_URL="..." node scripts/csv-import-master.mjs --batch-size 5
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
const makeName = args.find(a => a.startsWith('--make='))?.split('=')[1] || 
                 (args.includes('--make') ? args[args.indexOf('--make') + 1] : '');
const processAll = args.includes('--all');
const batchSize = args.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '10';
const apply = args.includes('--apply');
const dryRun = args.includes('--dry-run');

if (!process.env.GOOGLE_API_KEY) {
  console.error('❌ GOOGLE_API_KEY required');
  process.exit(1);
}

function runCommand(cmd, cmdArgs = []) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Запуск: ${cmd} ${cmdArgs.join(' ')}`);
    console.log('─'.repeat(60));
    
    const child = spawn(cmd, cmdArgs, {
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${cmd} завершён\n`);
        resolve();
      } else {
        console.error(`❌ ${cmd} failed with code ${code}\n`);
        reject(new Error(`Command failed: ${cmd}`));
      }
    });
    
    child.on('error', (err) => {
      console.error(`❌ Ошибка: ${err.message}`);
      reject(err);
    });
  });
}

async function main() {
  console.log('');
  console.log('═'.repeat(60));
  console.log('🚗 CSV IMPORT MASTER SCRIPT');
  console.log('═'.repeat(60));
  console.log('');
  console.log('⚙️  Конфигурация:');
  console.log(`   Марка: ${makeName || (processAll ? 'ВСЕ' : 'не указана')}`);
  console.log(`   Batch size: ${batchSize}`);
  console.log(`   Применить к БД: ${apply ? '✅' : '❌'}`);
  console.log(`   Dry run: ${dryRun ? '✅' : '❌'}`);
  console.log('');
  
  if (!makeName && !processAll) {
    console.error('❌ Укажите --make=МАРКА или --all');
    console.error('');
    console.error('Примеры:');
    console.error('  node scripts/csv-import-master.mjs --make BMW --apply');
    console.error('  node scripts/csv-import-master.mjs --all --batch-size 5');
    process.exit(1);
  }
  
  try {
    // Step 1: Import and enrich from CSV
    console.log('');
    console.log('═'.repeat(60));
    console.log('📍 ШАГ 1: Импорт и обогащение из CSV');
    console.log('═'.repeat(60));
    
    const importArgs = ['scripts/import-csv-batch.mjs'];
    if (makeName) {
      process.env.MAKE = makeName;
    }
    process.env.BATCH_SIZE = batchSize;
    
    await runCommand('node', importArgs);
    
    if (!existsSync('seed/vehicles_from_csv_enriched.json')) {
      throw new Error('Enriched JSON не был создан');
    }
    
    // Step 2: Generate SQL seed
    console.log('');
    console.log('═'.repeat(60));
    console.log('📍 ШАГ 2: Генерация SQL seed');
    console.log('═'.repeat(60));
    
    process.env.INPUT_JSON = 'seed/vehicles_from_csv_enriched.json';
    await runCommand('node', ['scripts/generateVehicleSeed.mjs']);
    
    if (!existsSync('./vehicles_seed.sql')) {
      throw new Error('vehicles_seed.sql не был создан');
    }
    
    // Step 3: Apply to DB (if requested)
    if (apply && !dryRun) {
      console.log('');
      console.log('═'.repeat(60));
      console.log('📍 ШАГ 3: Применение к базе данных');
      console.log('═'.repeat(60));
      
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL required for --apply');
      }
      
      await runCommand('node', ['scripts/runSeed.mjs', './vehicles_seed.sql']);
      
      // Step 4: Verify
      console.log('');
      console.log('═'.repeat(60));
      console.log('📍 ШАГ 4: Проверка результатов');
      console.log('═'.repeat(60));
      
      if (makeName) {
        process.env.DATABASE_URL = process.env.DATABASE_URL;
        await runCommand('node', ['scripts/check-bmw-in-db.mjs']);
      }
    }
    
    // Final report
    console.log('');
    console.log('═'.repeat(60));
    console.log('🎉 ЗАВЕРШЕНО УСПЕШНО!');
    console.log('═'.repeat(60));
    console.log('');
    console.log('📄 Созданные файлы:');
    console.log('   - seed/vehicles_from_csv_enriched.json');
    console.log('   - vehicles_seed.sql');
    console.log('');
    
    if (!apply) {
      console.log('ℹ️  Для применения к БД запустите с флагом --apply:');
      console.log(`   DATABASE_URL="..." node scripts/csv-import-master.mjs --make ${makeName || 'BMW'} --apply`);
    } else {
      console.log('✅ Данные успешно загружены в БД!');
    }
    console.log('');
    
  } catch (err) {
    console.error('\n❌ Ошибка:', err.message);
    process.exit(1);
  }
}

main();

