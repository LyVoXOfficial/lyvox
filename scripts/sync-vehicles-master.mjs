#!/usr/bin/env node
/**
 * Мастер-скрипт для синхронизации vehicles
 * 
 * Выполняет все этапы синхронизации:
 * 1. Анализ текущего состояния (JSON vs БД)
 * 2. Проверка дубликатов
 * 3. Генерация нового seed файла (>= 1980)
 * 4. Применение к БД
 * 
 * Использование:
 *   DATABASE_URL=... node scripts/sync-vehicles-master.mjs [--skip-analysis] [--skip-duplicates] [--apply]
 * 
 * Флаги:
 *   --skip-analysis    Пропустить анализ
 *   --skip-duplicates  Пропустить проверку дубликатов
 *   --apply            Применить изменения к БД (по умолчанию только генерация)
 *   --dry-run          Не применять изменения, только показать что будет сделано
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
const skipAnalysis = args.includes('--skip-analysis');
const skipDuplicates = args.includes('--skip-duplicates');
const apply = args.includes('--apply');
const dryRun = args.includes('--dry-run');

// ==========================
// Helpers
// ==========================

function runScript(scriptPath, scriptArgs = []) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Запуск: ${scriptPath} ${scriptArgs.join(' ')}`);
    console.log('─'.repeat(50));
    
    const child = spawn('node', [scriptPath, ...scriptArgs], {
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${scriptPath} завершён успешно\n`);
        resolve();
      } else {
        console.error(`❌ ${scriptPath} завершён с кодом ${code}\n`);
        reject(new Error(`Script failed with code ${code}`));
      }
    });
    
    child.on('error', (err) => {
      console.error(`❌ Ошибка запуска ${scriptPath}:`, err.message);
      reject(err);
    });
  });
}

function printHeader(title) {
  console.log('\n');
  console.log('═'.repeat(60));
  console.log(`   ${title}`);
  console.log('═'.repeat(60));
  console.log('');
}

function printStep(step, title) {
  console.log('\n');
  console.log(`📍 Шаг ${step}: ${title}`);
  console.log('─'.repeat(60));
}

// ==========================
// Main
// ==========================

async function main() {
  printHeader('🚗 СИНХРОНИЗАЦИЯ VEHICLES - MASTER SCRIPT');
  
  console.log('⚙️  Конфигурация:');
  console.log(`   Пропустить анализ:      ${skipAnalysis ? '✅' : '❌'}`);
  console.log(`   Пропустить дубликаты:   ${skipDuplicates ? '✅' : '❌'}`);
  console.log(`   Применить к БД:         ${apply ? '✅' : '❌'}`);
  console.log(`   Dry run:                ${dryRun ? '✅' : '❌'}`);
  console.log('');
  
  try {
    // Шаг 1: Анализ
    if (!skipAnalysis) {
      printStep(1, 'Анализ текущего состояния (JSON vs БД)');
      try {
        await runScript('scripts/analyze-vehicle-sync.mjs');
      } catch (err) {
        console.warn('⚠️  Анализ обнаружил расхождения (это нормально на первом запуске)');
      }
    }
    
    // Шаг 2: Проверка дубликатов
    if (!skipDuplicates) {
      printStep(2, 'Проверка дубликатов в БД');
      try {
        await runScript('scripts/check-vehicle-duplicates.mjs');
      } catch (err) {
        console.warn('⚠️  Обнаружены дубликаты. Рекомендуется исправить перед загрузкой.');
        
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        
        const answer = await new Promise((resolve) => {
          rl.question('\n❓ Продолжить несмотря на дубликаты? (y/N): ', resolve);
        });
        rl.close();
        
        if (answer.toLowerCase() !== 'y') {
          console.log('❌ Отменено пользователем');
          process.exit(1);
        }
      }
    }
    
    // Шаг 3: Генерация seed
    printStep(3, 'Генерация vehicles_seed.sql (>= 1980)');
    await runScript('scripts/generateVehicleSeed.mjs');
    
    if (!existsSync('./vehicles_seed.sql')) {
      throw new Error('vehicles_seed.sql не был создан');
    }
    
    console.log('✅ Файл vehicles_seed.sql создан');
    
    // Шаг 4: Применение к БД
    if (apply) {
      if (dryRun) {
        console.log('\n🔍 DRY RUN: Изменения НЕ будут применены к БД');
        console.log('   Для применения запустите без флага --dry-run');
      } else {
        printStep(4, 'Применение к базе данных');
        
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        
        console.log('\n⚠️  ВНИМАНИЕ: Сейчас будет выполнена загрузка данных в БД!');
        console.log('   Это может занять несколько минут и добавит новые записи.');
        
        const answer = await new Promise((resolve) => {
          rl.question('\n❓ Продолжить? (y/N): ', resolve);
        });
        rl.close();
        
        if (answer.toLowerCase() !== 'y') {
          console.log('❌ Отменено пользователем');
          process.exit(1);
        }
        
        await runScript('scripts/runSeed.mjs', ['./vehicles_seed.sql']);
        
        console.log('\n✅ Данные успешно загружены в БД!');
      }
    } else {
      console.log('\n📝 Для применения к БД запустите с флагом --apply');
    }
    
    // Финальный отчёт
    printHeader('✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА');
    
    console.log('📋 Следующие шаги:');
    console.log('   1. Проверьте vehicles_seed.sql');
    
    if (!apply) {
      console.log('   2. Запустите с флагом --apply для загрузки в БД');
      console.log('      node scripts/sync-vehicles-master.mjs --apply');
    } else {
      console.log('   2. Запустите проверку переводов:');
      console.log('      node scripts/vehicle_i18n_normalize.mjs');
      console.log('   3. Запустите финальную проверку:');
      console.log('      node scripts/analyze-vehicle-sync.mjs');
    }
    
    console.log('');
    
  } catch (err) {
    console.error('\n❌ Ошибка выполнения:', err.message);
    process.exit(1);
  }
}

main();

